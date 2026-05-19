(function () {
  async function renderRegisteredCharts(ui, state, deps) {
    const {
      buildPickedRecordFromPayload,
      buildTickerUrl,
      CHART_FETCH_CONCURRENCY,
      diffShapeAgainstBaseline,
      loadTickerForChartWithFallback,
      mapWithConcurrency,
      renderChartFetchFailedItem,
      renderRegisteredScannerItem,
      renderScannerCompactChart,
      renderScannerItemLinks,
      showError,
    } = deps;
    const { getRegisteredItems } = window.KabuPageRegisteredState;
    const CARD_CHART_RANGE_MONTHS = Object.freeze({ daily: 3, weekly: 36, monthly: 60 });

    if (!ui.chartList) {
      return;
    }
    ui.errorBox.hidden = true;
    const items = getRegisteredItems(state.set, deps.dedupeScannerPicks);
    if (!items.length) {
      ui.chartList.innerHTML = '<div class="empty-cell picked-chart-empty">登録銘柄がありません。</div>';
      return;
    }

    const failures = [];
    const loadedResults = await mapWithConcurrency(items, CHART_FETCH_CONCURRENCY, async (item) => {
      try {
        const inspected = await loadTickerForChartWithFallback(item.code, { selectedDate: state.selectedDate });
        const record = buildPickedRecordFromPayload(item, inspected.payload, state.selectedDate);
        if (!record) {
          return { item, status: "invalid", inspected, reason: "日付に一致する価格データなし" };
        }
        return { item, status: "fulfilled", inspected, record };
      } catch (error) {
        return { item, status: "rejected", reason: error.message || String(error) };
      }
    });
    const baselineShape = loadedResults.find((result) => result.status === "fulfilled" && !result.inspected.validation.issues.length)?.inspected.shape || null;
    const chartItems = loadedResults.map((result, index) => {
      if (result.status === "fulfilled" && !result.inspected.validation.issues.length) {
        return { kind: "success", index, record: result.record, inspected: result.inspected };
      }
      const code = result.item.code;
      if (result.status === "rejected") {
        failures.push(`${code}: ${result.reason}`);
        return { kind: "failed", index, code, name: result.item.name, message: result.reason };
      }
      const validationIssues = result.inspected.validation.issues.length
        ? result.inspected.validation.issues.join(", ")
        : result.reason;
      console.debug("[ticker-chart:validation]", {
        code,
        requestUrl: result.inspected.requestUrl,
        status: result.inspected.status,
        responseBody: result.inspected.responseBody.slice(0, 1200),
        parsedCandleCount: result.inspected.validation.parsedCandleCount,
        issues: result.inspected.validation.issues,
        warnings: result.inspected.validation.warnings,
        shapeDiff: diffShapeAgainstBaseline(baselineShape, result.inspected.shape),
      });
      failures.push(`${code}: ${validationIssues}`);
      return { kind: "failed", index, code, name: result.item.name, message: validationIssues };
    });

    if (!chartItems.length) {
      ui.chartList.innerHTML = '<div class="empty-cell picked-chart-empty">チャート表示可能な銘柄がありません。</div>';
      if (failures.length) {
        showError(ui.errorBox, `チャート読込に失敗: ${failures.slice(0, 3).join(" / ")}`);
      }
      return;
    }

    if (failures.length) {
      showError(ui.errorBox, `一部のチャート読込に失敗: ${failures.slice(0, 3).join(" / ")}`);
    }

    ui.chartList.innerHTML = chartItems
      .map((entry) => {
        if (entry.kind === "success") {
          return renderRegisteredScannerItem(entry.record, entry.index, state);
        }
        return renderChartFetchFailedItem(entry.code, entry.name, entry.index, state, {
          message: entry.message,
          linksMarkup: `<a href="${buildTickerUrl(entry.code, state.selectedDate, "")}">個別ページ</a>`,
        });
      })
      .join("");

    function normalizeCardChartTimeframe(value) {
      const timeframe = String(value || "").trim();
      return ["daily", "weekly", "monthly"].includes(timeframe) ? timeframe : "daily";
    }

    function getCardChartTimeframe(code) {
      return normalizeCardChartTimeframe(state.cardChartTimeframes.get(String(code)) || state.timeframe);
    }

    function getCardChartRangeMonths(timeframe) {
      return CARD_CHART_RANGE_MONTHS[normalizeCardChartTimeframe(timeframe)] || CARD_CHART_RANGE_MONTHS.daily;
    }

    function shouldUseFullChartRows(timeframe, rangeMonths) {
      return timeframe === "monthly" || (timeframe === "weekly" && Number(rangeMonths) > 12);
    }

    function updateCardChartTimeframeControls(code, timeframe) {
      ui.chartList?.querySelectorAll("[data-card-chart-code]").forEach((button) => {
        if (button.getAttribute("data-card-chart-code") !== String(code)) {
          return;
        }
        const isActive = button.getAttribute("data-card-chart-timeframe") === timeframe;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function parseOhlcvCsv(text) {
      return String(text || "")
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((line) => {
          const [date, open, high, low, close, volume] = line.split(",");
          return {
            date,
            open: Number(open),
            high: Number(high),
            low: Number(low),
            close: Number(close),
            volume: Number(volume),
          };
        })
        .filter((row) => row.date && Number.isFinite(row.close));
    }

    async function loadFullChartRows(code) {
      const cacheKey = String(code || "");
      const cached = state.fullChartPayloadCache.get(cacheKey);
      if (cached) {
        return cached;
      }
      if (!state.fullChartRequestCache.has(cacheKey)) {
        state.fullChartRequestCache.set(
          cacheKey,
          fetch(`./data/ohlcv/${cacheKey}.csv`, { cache: "no-store" })
            .then(async (response) => {
              if (!response.ok) {
                throw new Error(`CSV 読み込み失敗: ${cacheKey} (${response.status})`);
              }
              const rows = parseOhlcvCsv(await response.text());
              state.fullChartPayloadCache.set(cacheKey, rows);
              return rows;
            })
            .finally(() => {
              state.fullChartRequestCache.delete(cacheKey);
            })
        );
      }
      return state.fullChartRequestCache.get(cacheKey);
    }

    async function renderRegisteredCardChart(record, inspected) {
      const timeframe = getCardChartTimeframe(record.code);
      const rangeMonths = getCardChartRangeMonths(timeframe);
      const chartPayload = inspected.chartPayload || inspected.payload;
      let chartRows = chartPayload.ohlcv || [];
      if (shouldUseFullChartRows(timeframe, rangeMonths)) {
        try {
          chartRows = await loadFullChartRows(record.code);
        } catch (_error) {
        }
      }
      updateCardChartTimeframeControls(record.code, timeframe);
      renderScannerCompactChart(
        `registeredChart-${record.code}`,
        record.code,
        chartRows,
        state.selectedDate,
        rangeMonths,
        {
          timeframe,
          useBarCount: false,
          extendToLatest: true,
          events: record.events || record.chartEvents || record.newsEvents || record.disclosureEvents || [],
        }
      );
    }

    function bindRegisteredCardTimeframeEvents() {
      ui.chartList?.querySelectorAll("[data-card-chart-timeframe]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const code = String(button.getAttribute("data-card-chart-code") || "");
          const timeframe = normalizeCardChartTimeframe(button.getAttribute("data-card-chart-timeframe"));
          const entry = chartItems.find((item) => item.kind === "success" && String(item.record.code) === code);
          if (!code || !entry) {
            return;
          }
          state.cardChartTimeframes.set(code, timeframe);
          updateCardChartTimeframeControls(code, timeframe);
          void renderRegisteredCardChart(entry.record, entry.inspected);
        });
      });
    }

    for (const entry of chartItems) {
      if (entry.kind !== "success") {
        continue;
      }
      const { inspected, record } = entry;
      await renderRegisteredCardChart(record, inspected);
      const linksElement = document.getElementById(`registeredLinks-${record.code}`);
      if (linksElement) {
        linksElement.innerHTML = renderScannerItemLinks(inspected.payload, record, { selectedDate: state.selectedDate, sort: "code" });
      }
    }
    bindRegisteredCardTimeframeEvents();
  }

  window.KabuPageRegisteredChart = Object.freeze({ renderRegisteredCharts });
})();
