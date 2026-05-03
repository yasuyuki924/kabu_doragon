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

    chartItems.forEach((entry) => {
      if (entry.kind !== "success") {
        return;
      }
      const { inspected, record } = entry;
      const chartPayload = inspected.chartPayload || inspected.payload;
      renderScannerCompactChart(
        `registeredChart-${record.code}`,
        record.code,
        chartPayload.ohlcv || [],
        state.selectedDate,
        state.bars,
        { timeframe: state.timeframe, useBarCount: true }
      );
      const linksElement = document.getElementById(`registeredLinks-${record.code}`);
      if (linksElement) {
        linksElement.innerHTML = renderScannerItemLinks(inspected.payload, record, { selectedDate: state.selectedDate, sort: "code" });
      }
    });
  }

  window.KabuPageRegisteredChart = Object.freeze({ renderRegisteredCharts });
})();
