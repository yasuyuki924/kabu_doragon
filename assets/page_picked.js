(function () {
  async function initPickedPage(deps) {
    const {
      buildHyperExportEntries,
      buildPickedRecordFromPayload,
      buildTickerUrl,
      buildTradingViewExportEntry,
      CHART_FETCH_CONCURRENCY,
      dedupeScannerPicks,
      diffShapeAgainstBaseline,
      escapeHtml,
      formatNumber,
      formatPickedDateTime,
      formatSnapshotGeneratedAt,
      getRegisteredSetById,
      loadManifest,
      loadRegisteredPicks,
      loadScannerPicks,
      loadTickerForChartWithFallback,
      mapWithConcurrency,
      registerAllPicks,
      removePickByCode,
      removeRegisteredSetById,
      renderChartFetchFailedItem,
      renderExportEntries,
      renderPickedItemLinks,
      renderPickedScannerItem,
      renderRegisteredSetRow,
      renderScannerCompactChart,
      renderScannerItemLinks,
      runRefreshAction,
      showError,
      startAutoRefreshPolling,
      sortedScannerPicks,
      triggerExportDownloads,
    } = deps;

    const count = document.getElementById("pickedCount");
    const countBadge = document.getElementById("pickedCountBadge");
    const setsBadge = document.getElementById("pickedSetsBadge");
    const updatedBadge = document.getElementById("pickedUpdatedBadge");
    const exportMessage = document.getElementById("pickedExportMessage");
    const exportTradingViewButton = document.getElementById("pickedExportTradingViewButton");
    const exportHyperButton = document.getElementById("pickedExportHyperButton");
    const headerExportButton = document.getElementById("pickedHeaderExportButton");
    const headerSaveButton = document.getElementById("pickedHeaderSaveButton");
    const exportList = document.getElementById("pickedExportList");
    const registerAllButton = document.getElementById("pickedRegisterAllButton");
    const registerCount = document.getElementById("pickedRegisterCount");
    const registerList = document.getElementById("pickedRegisterList");
    const registerNameModal = document.getElementById("registerNameModal");
    const registerNameInput = document.getElementById("registerNameInput");
    const registerNameError = document.getElementById("registerNameError");
    const registerNameOkButton = document.getElementById("registerNameOkButton");
    const registerNameCancelButton = document.getElementById("registerNameCancelButton");
    const refreshButton = document.getElementById("pickedRefreshButton");
    const errorBox = document.getElementById("pickedError");
    const body = document.getElementById("pickedTableBody");
    const chartList = document.getElementById("pickedChartList");
    const state = {
      exportEntries: [],
      manifest: null,
      selectedDate: "",
      bars: 63,
      timeframe: "daily",
      sort: "code",
      registered: [],
      cardChartTimeframes: new Map(),
      fullChartPayloadCache: new Map(),
      fullChartRequestCache: new Map(),
    };
    const CARD_CHART_RANGE_MONTHS = Object.freeze({ daily: 3, weekly: 36, monthly: 60 });

    let stopAutoRefreshPolling = null;

    bindRegisterNameModalEvents();
    closeRegisterNameModal();

    exportTradingViewButton?.addEventListener("click", () => {
      const picks = dedupeScannerPicks(sortedScannerPicks(loadScannerPicks()));
      triggerExportDownloads([buildTradingViewExportEntry(picks)]);
      renderExportEntries(exportList, []);
      exportMessage.textContent = "TradingView TXT downloaded.";
    });

    exportHyperButton?.addEventListener("click", () => {
      const picks = dedupeScannerPicks(sortedScannerPicks(loadScannerPicks()));
      const entries = buildHyperExportEntries(picks);
      triggerExportDownloads(entries);
      renderExportEntries(exportList, []);
      exportMessage.textContent = `HYPER SBI 2 CSV downloaded for ${formatNumber(picks.length, 0)} picks.`;
    });

    headerExportButton?.addEventListener("click", () => {
      exportTradingViewButton?.click();
    });

    registerAllButton?.addEventListener("click", () => {
      const picks = dedupeScannerPicks(sortedScannerPicks(loadScannerPicks()));
      if (!picks.length) {
        showError(errorBox, "No picks available to save.");
        return;
      }
      errorBox.hidden = true;
      openRegisterNameModal();
    });

    headerSaveButton?.addEventListener("click", () => {
      registerAllButton?.click();
    });

    async function refreshPickedPage(nextManifest = null) {
      await runRefreshAction(refreshButton, errorBox, async () => {
        state.manifest = nextManifest || await loadManifest();
        state.selectedDate = String(state.manifest.latestDate || "");
        await render();
      });
    }

    refreshButton?.addEventListener("click", async () => {
      await refreshPickedPage();
    });

    try {
      state.manifest = await loadManifest();
      state.selectedDate = String(state.manifest.latestDate || "");
      await render();
      stopAutoRefreshPolling = startAutoRefreshPolling({
        getCurrentManifest: () => state.manifest,
        onRefresh: async (latestManifest) => {
          await refreshPickedPage(latestManifest);
        },
      });
    } catch (error) {
      showError(errorBox, error.message);
    }

    async function render() {
      const picks = sortedScannerPicks(loadScannerPicks());
      state.registered = loadRegisteredPicks();
      const pickCountText = formatNumber(picks.length, 0);
      if (count) {
        count.textContent = `${pickCountText}`;
      }
      if (countBadge) {
        countBadge.textContent = `Count ${pickCountText}`;
      }
      if (registerCount) {
        registerCount.textContent = `${formatNumber(state.registered.length, 0)}`;
      }
      if (setsBadge) {
        setsBadge.textContent = `Sets ${formatNumber(state.registered.length, 0)}`;
      }
      if (updatedBadge) {
        const generatedAt = formatSnapshotGeneratedAt(state.manifest?.currentSnapshot?.generatedAt);
        updatedBadge.textContent = generatedAt ? `Updated ${generatedAt}` : "Updated --";
      }
      errorBox.hidden = true;
      renderRegisteredPanel(state.registered);
      const hasPicks = picks.length > 0;
      if (registerAllButton) {
        registerAllButton.disabled = false;
      }
      if (exportTradingViewButton) {
        exportTradingViewButton.disabled = !hasPicks;
      }
      if (exportHyperButton) {
        exportHyperButton.disabled = !hasPicks;
      }
      if (!picks.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty-cell">選別銘柄はありません。トップ画面でチェックしてください。</td></tr>';
        if (chartList) {
          chartList.innerHTML = '<div class="empty-cell picked-chart-empty">No picks yet.</div>';
        }
        state.exportEntries = [];
        renderExportEntries(exportList, []);
        exportMessage.textContent = "No picks available for export.";
        return;
      }

      renderPickedTable(picks);
      await renderPickedCharts(picks);

      if (!state.exportEntries.length) {
        exportMessage.textContent = "Export the current picks as TradingView TXT or HYPER SBI 2 CSV.";
        exportList.innerHTML = "";
      }
    }

    function renderPickedTable(picks) {
      body.innerHTML = picks
        .map(
          (pick) => `
            <tr>
              <td>${escapeHtml(pick.code)}</td>
              <td>${deps.renderTickerIdentity(pick.code, pick.name, { variant: "table", showCode: false })}</td>
              <td>${escapeHtml(pick.market)}</td>
              <td>${escapeHtml(formatPickedDateTime(pick.selectedAt))}</td>
              <td>
                <div class="actions-cell">
                  <button type="button" class="row-button picked-remove-button" data-remove-pick="${escapeHtml(pick.code)}">解除</button>
                </div>
              </td>
            </tr>
          `
        )
        .join("");

      Array.from(body.querySelectorAll("button[data-remove-pick]")).forEach((button) => {
        button.addEventListener("click", async () => {
          removePickByCode(button.dataset.removePick);
          exportMessage.textContent = "Pick list changed. Re-export if needed.";
          await render();
        });
      });
    }

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
      if (window.KabuAppUtils?.isPublicHostedSite?.()) {
        return false;
      }
      return timeframe === "monthly" || (timeframe === "weekly" && Number(rangeMonths) > 12);
    }

    function updateCardChartTimeframeControls(code, timeframe) {
      chartList?.querySelectorAll("[data-card-chart-code]").forEach((button) => {
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

    async function renderPickedCardChart(record, inspected) {
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
      renderScannerCompactChart(`pickedChart-${record.code}`, record.code, chartRows, record.date || state.selectedDate, rangeMonths, {
        timeframe,
        useBarCount: false,
        extendToLatest: true,
        events: record.events || record.chartEvents || record.newsEvents || record.disclosureEvents || [],
      });
    }

    function bindPickedCardTimeframeEvents(chartItems) {
      chartList?.querySelectorAll("[data-card-chart-timeframe]").forEach((button) => {
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
          void renderPickedCardChart(entry.record, entry.inspected);
        });
      });
    }

    async function renderPickedCharts(picks) {
      if (!chartList) {
        return;
      }

      const failures = [];
      const loadedResults = await mapWithConcurrency(picks, CHART_FETCH_CONCURRENCY, async (pick) => {
        try {
          const inspected = await loadTickerForChartWithFallback(pick.code, { selectedDate: state.selectedDate, allowStaleSelectedDate: true });
          const record = buildPickedRecordFromPayload(pick, inspected.payload, state.selectedDate);
          if (!record) {
            return { pick, status: "invalid", inspected, reason: "日付に一致する価格データなし" };
          }
          return { pick, status: "fulfilled", inspected, record };
        } catch (error) {
          return { pick, status: "rejected", reason: error.message || String(error) };
        }
      });
      const baselineShape = loadedResults.find((result) => result.status === "fulfilled" && !result.inspected.validation.issues.length)?.inspected.shape || null;
      const chartItems = loadedResults.map((result, index) => {
        if (result.status === "fulfilled" && !result.inspected.validation.issues.length) {
          return { kind: "success", index, record: result.record, inspected: result.inspected };
        }
        const code = result.pick.code;
        if (result.status === "rejected") {
          failures.push(`${code}: ${result.reason}`);
          return {
            kind: "failed",
            index,
            code,
            name: result.pick.name,
            message: result.reason,
          };
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
        return {
          kind: "failed",
          index,
          code,
          name: result.pick.name,
          message: validationIssues,
        };
      });

      if (!chartItems.length) {
        chartList.innerHTML = '<div class="empty-cell picked-chart-empty">No chart-ready picks found.</div>';
        if (failures.length) {
          showError(errorBox, `Chart load failed: ${failures.slice(0, 3).join(" / ")}`);
        }
        return;
      }

      if (failures.length) {
        showError(errorBox, `Some charts failed to load: ${failures.slice(0, 3).join(" / ")}`);
      }

      chartList.innerHTML = chartItems
        .map((entry) => {
          if (entry.kind === "success") {
            return renderPickedScannerItem(entry.record, entry.index, state);
          }
          return renderChartFetchFailedItem(entry.code, entry.name, entry.index, state, {
            picked: true,
            english: true,
            message: entry.message,
            linksMarkup: `<a class="picked-link-pill" href="${buildTickerUrl(entry.code, state.selectedDate, "")}">📈 Detail</a>`,
            actionMarkup: `<button type="button" class="row-button picked-remove-button picked-card-remove picked-link-pill picked-link-pill--danger" data-remove-pick="${escapeHtml(entry.code)}">✕ Remove</button>`,
          });
        })
        .join("");

      for (const entry of chartItems) {
        if (entry.kind !== "success") {
          continue;
        }
        const { inspected, record } = entry;
        await renderPickedCardChart(record, inspected);
        const linksElement = document.getElementById(`pickedLinks-${record.code}`);
        if (linksElement) {
          linksElement.innerHTML = renderPickedItemLinks(inspected.payload, record, state);
        }
      }

      bindPickedCardTimeframeEvents(chartItems);

      Array.from(chartList.querySelectorAll("button[data-remove-pick]")).forEach((button) => {
        button.addEventListener("click", async () => {
          removePickByCode(button.dataset.removePick);
          exportMessage.textContent = "Pick list changed. Re-export if needed.";
          await render();
        });
      });
    }

    function renderRegisteredPanel(entries) {
      if (!registerList) {
        return;
      }
      if (!entries.length) {
        registerList.innerHTML = '<div class="empty-cell">No saved sets.</div>';
        return;
      }
      registerList.innerHTML = entries
        .slice(0, 20)
        .map((entry) => renderRegisteredSetRow(entry))
        .join("");

      Array.from(registerList.querySelectorAll("button[data-open-registered-set]")).forEach((button) => {
        button.addEventListener("click", () => {
          const id = String(button.dataset.openRegisteredSet || "").trim();
          if (!id) {
            return;
          }
          window.location.href = `./registered.html?id=${encodeURIComponent(id)}`;
        });
      });

      Array.from(registerList.querySelectorAll("button[data-remove-registered-set]")).forEach((button) => {
        button.addEventListener("click", async () => {
          const id = String(button.dataset.removeRegisteredSet || "").trim();
          if (!id) {
            return;
          }
          removeRegisteredSetById(id);
          exportMessage.textContent = "Saved set deleted.";
          await render();
        });
      });
    }

    function openRegisterNameModal() {
      if (!registerNameModal || !registerNameInput) {
        return;
      }
      if (registerNameError) {
        registerNameError.hidden = true;
        registerNameError.textContent = "";
      }
      registerNameInput.value = "";
      registerNameModal.classList.remove("is-hidden");
      registerNameModal.hidden = false;
      registerNameInput.focus();
      registerNameInput.select();
    }

    function closeRegisterNameModal() {
      if (!registerNameModal) {
        return;
      }
      registerNameModal.classList.add("is-hidden");
      registerNameModal.hidden = true;
      if (registerNameError) {
        registerNameError.hidden = true;
        registerNameError.textContent = "";
      }
    }

    async function submitRegisterNameModal() {
      const input = String(registerNameInput?.value || "").trim();
      if (!input) {
        if (registerNameError) {
          registerNameError.hidden = false;
          registerNameError.textContent = "Enter a set name.";
        }
        registerNameInput?.focus();
        return;
      }
      try {
        const picks = dedupeScannerPicks(sortedScannerPicks(loadScannerPicks()));
        const entry = registerAllPicks(picks, input);
        closeRegisterNameModal();
        exportMessage.textContent = `Saved: ${entry.name}`;
        await render();
      } catch (error) {
        showError(errorBox, error.message);
      }
    }

    function bindRegisterNameModalEvents() {
      registerNameOkButton?.addEventListener("click", (event) => {
        event.preventDefault();
        submitRegisterNameModal();
      });
      registerNameCancelButton?.addEventListener("click", (event) => {
        event.preventDefault();
        closeRegisterNameModal();
      });
      registerNameModal?.addEventListener("click", (event) => {
        if (event.target === registerNameModal) {
          closeRegisterNameModal();
        }
      });
      registerNameInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitRegisterNameModal();
        }
      });
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && registerNameModal && !registerNameModal.hidden) {
          closeRegisterNameModal();
        }
      });
    }
  }

  window.KabuPagePicked = Object.freeze({ initPickedPage });
})();
