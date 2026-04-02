(function () {
  async function initTickerPage(deps) {
    const {
      NOTE_STORAGE_PREFIX,
      TICKER_CHART_MODES,
      buildTickerUrl,
      escapeHtml,
      findSelectedIndex,
      formatNumber,
      formatPercent,
      formatRatio,
      formatScannerTradeDate,
      formatSignedNumber,
      formatSignedPercent,
      formatSignedPercentHtml,
      formatSnapshotBaseDate,
      getSignedValueClass,
      loadManifest,
      loadTickerNote,
      loadTickerPayload,
      loadRanking,
      normalizeTickerChartMode,
      rankingLabel,
      renderStrategyBadges,
      renderStrategyReasons,
      renderTickerChart,
      renderTickerIdentity,
      resolveAvailableDate,
      resolvePickerDate,
      runRefreshAction,
      showError,
      syncSnapshotStatusUi,
      syncTickerUrl,
      updatePeriodButtonState,
    } = deps;

    const tickerTitle = document.getElementById("tickerTitle");
    const tickerMeta = document.getElementById("tickerMeta");
    const chartMeta = document.getElementById("chartMeta");
    const refreshButton = document.getElementById("tickerRefreshButton");
    const refreshMeta = document.getElementById("tickerRefreshMeta");
    const snapshotBadge = document.getElementById("tickerSnapshotBadge");
    const externalLinks = document.getElementById("externalLinks");
    const errorBox = document.getElementById("detailErrorBox");
    const periodButtons = document.getElementById("periodButtons");
    const tickerDatePicker = document.getElementById("tickerDatePicker");
    const tickerRankMeta = document.getElementById("tickerRankMeta");
    const chartEl = document.getElementById("chart");
    const noteArea = document.getElementById("tickerNote");
    const noteStatus = document.getElementById("noteStatus");
    const saveNoteButton = document.getElementById("saveNoteButton");
    const clearNoteButton = document.getElementById("clearNoteButton");
    const summaryDate = document.getElementById("summaryDate");
    const summaryRank = document.getElementById("summaryRank");
    const summaryClose = document.getElementById("summaryClose");
    const summaryChange = document.getElementById("summaryChange");
    const summaryOpen = document.getElementById("summaryOpen");
    const summaryRange = document.getElementById("summaryRange");
    const summaryVolume = document.getElementById("summaryVolume");
    const profileMeta = document.getElementById("profileMeta");
    const profileMarket = document.getElementById("profileMarket");
    const profileSector = document.getElementById("profileSector");
    const profileIndustry = document.getElementById("profileIndustry");
    const profileTags = document.getElementById("profileTags");
    const techDistanceMa25 = document.getElementById("techDistanceMa25");
    const techDistanceMa75 = document.getElementById("techDistanceMa75");
    const techDistanceMa200 = document.getElementById("techDistanceMa200");
    const techVolumeRatio = document.getElementById("techVolumeRatio");
    const techRciSummary = document.getElementById("techRciSummary");
    const techRangePosition = document.getElementById("techRangePosition");
    const tickerCardRank = document.getElementById("tickerCardRank");
    const tickerCardCode = document.getElementById("tickerCardCode");
    const tickerCardTradeDate = document.getElementById("tickerCardTradeDate");
    const tickerCardTradePrice = document.getElementById("tickerCardTradePrice");
    const tickerCardChange = document.getElementById("tickerCardChange");
    const tickerCardVolume = document.getElementById("tickerCardVolume");
    const tickerCardHigh = document.getElementById("tickerCardHigh");
    const tickerCardLow = document.getElementById("tickerCardLow");
    const tickerCardLinks = document.getElementById("tickerCardLinks");
    const strategyBadges = document.getElementById("strategyBadges");
    const strategyReasons = document.getElementById("strategyReasons");
    const backLink = document.querySelector(".eyebrow a");

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || params.get("t");
    const rankingKey = params.get("from") || "";
    if (!code) {
      showError(errorBox, "URL パラメータ code がありません。例: ticker.html?code=3133&date=2026-02-10");
      return;
    }

    const state = {
      manifest: null,
      payload: null,
      rankingKey,
      rankingItem: null,
      selectedChartMode: normalizeTickerChartMode(params.get("chart") || "3m"),
      selectedDate: "",
    };

    periodButtons.innerHTML = TICKER_CHART_MODES.map(
      (mode) =>
        `<button class="period-button${mode.key === state.selectedChartMode ? " active" : ""}" data-chart-mode="${mode.key}">${mode.label}</button>`
    ).join("");

    Array.from(periodButtons.querySelectorAll(".period-button")).forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedChartMode = normalizeTickerChartMode(button.dataset.chartMode);
        updatePeriodButtonState(periodButtons, state.selectedChartMode);
        renderTicker();
      });
    });

    noteArea.value = loadTickerNote(code);
    noteStatus.textContent = noteArea.value ? "保存済み" : "未保存";

    saveNoteButton.addEventListener("click", () => {
      localStorage.setItem(`${NOTE_STORAGE_PREFIX}${code}`, noteArea.value);
      noteStatus.textContent = "保存済み";
    });

    clearNoteButton.addEventListener("click", () => {
      noteArea.value = "";
      localStorage.removeItem(`${NOTE_STORAGE_PREFIX}${code}`);
      noteStatus.textContent = "未保存";
    });

    noteArea.addEventListener("input", () => {
      noteStatus.textContent = "未保存";
    });

    tickerDatePicker.addEventListener("change", async () => {
      state.selectedDate = resolvePickerDate(
        tickerDatePicker.value,
        state.payload.ohlcv.map((row) => row.date),
        state.selectedDate
      );
      await refreshRankContext();
      renderTicker();
    });

    refreshButton?.addEventListener("click", async () => {
      await runRefreshAction(refreshButton, errorBox, async () => {
        state.manifest = await loadManifest();
        state.payload = await loadTickerPayload(code);
        const availableDates = state.payload.ohlcv.map((row) => row.date);
        state.selectedDate = resolveAvailableDate(state.selectedDate || state.manifest.latestDate, availableDates);
        tickerDatePicker.min = availableDates[0];
        tickerDatePicker.max = availableDates.at(-1);
        await refreshRankContext();
        renderTicker();
      });
    });

    try {
      state.manifest = await loadManifest();
      state.payload = await loadTickerPayload(code);
      const availableDates = state.payload.ohlcv.map((row) => row.date);
      state.selectedDate = resolveAvailableDate(params.get("date") || state.manifest.latestDate, availableDates);
      tickerDatePicker.min = availableDates[0];
      tickerDatePicker.max = availableDates.at(-1);
      await refreshRankContext();
      renderTicker();
    } catch (error) {
      showError(errorBox, error.message);
    }

    async function refreshRankContext() {
      state.rankingItem = null;
      if (!state.rankingKey) {
        return;
      }
      try {
        const ranking = await loadRanking(state.selectedDate, state.rankingKey);
        state.rankingItem = (ranking.items || []).find((item) => String(item.code) === String(code)) || null;
      } catch (_error) {
        state.rankingItem = null;
      }
    }

    function setTickerCardValues(row) {
      if (tickerCardTradeDate) {
        tickerCardTradeDate.textContent = formatScannerTradeDate(row.date);
      }
      if (tickerCardTradePrice) {
        tickerCardTradePrice.textContent = formatNumber(row.close);
      }
      if (tickerCardChange) {
        tickerCardChange.innerHTML = `${escapeHtml(formatSignedNumber(row.change))} ${formatSignedPercentHtml(row.changePercent)}`;
      }
      if (tickerCardVolume) {
        tickerCardVolume.textContent = formatNumber(row.volume, 0);
      }
      if (tickerCardHigh) {
        tickerCardHigh.textContent = formatNumber(row.high);
      }
      if (tickerCardLow) {
        tickerCardLow.textContent = formatNumber(row.low);
      }
    }

    function setTickerSummaryValues(row) {
      summaryDate.textContent = row.date || "-";
      summaryClose.textContent = formatNumber(row.close);
      summaryChange.innerHTML = `${escapeHtml(formatSignedNumber(row.change))} ${formatSignedPercentHtml(row.changePercent, {
        withParens: true,
      })}`;
      summaryChange.className = "summary-value";
      summaryOpen.textContent = formatNumber(row.open);
      summaryRange.textContent = `${formatNumber(row.high)} / ${formatNumber(row.low)}`;
      summaryVolume.textContent = formatNumber(row.volume, 0);
      techDistanceMa25.textContent = formatSignedPercent(row.distanceToMa25);
      techDistanceMa75.textContent = formatSignedPercent(row.distanceToMa75);
      techDistanceMa200.textContent = formatSignedPercent(row.distanceToMa200);
      techVolumeRatio.textContent = formatRatio(row.volumeRatio25);
      techRciSummary.textContent = [row.rci12, row.rci24, row.rci48]
        .map((value) => (value == null ? "-" : Number(value).toFixed(1)))
        .join(" / ");
      techRangePosition.textContent = formatPercent(row.rangePosition52w);
      [techDistanceMa25, techDistanceMa75, techDistanceMa200, techRangePosition].forEach((element) => {
        element.classList.remove("rise", "fall");
      });
      [
        [techDistanceMa25, row.distanceToMa25],
        [techDistanceMa75, row.distanceToMa75],
        [techDistanceMa200, row.distanceToMa200],
        [techRangePosition, row.rangePosition52w],
      ].forEach(([element, value]) => {
        const className = getSignedValueClass(value);
        if (className) {
          element.classList.add(className);
        }
      });
    }

    function renderTicker() {
      const rows = state.payload.ohlcv || [];
      const selectedIndex = findSelectedIndex(rows, state.selectedDate);
      if (selectedIndex < 0) {
        showError(errorBox, `${code} の ${state.selectedDate} 時点データがありません。`);
        return;
      }
      const row = rows[selectedIndex];
      const latestRow = rows.at(-1) || row;
      state.selectedDate = row.date;
      tickerDatePicker.value = row.date;
      syncTickerUrl(code, state.selectedDate, state.rankingKey, state.selectedChartMode);
      if (backLink) {
        backLink.href = `./index.html?date=${encodeURIComponent(state.selectedDate)}`;
      }

      tickerTitle.textContent = `${code} ${state.payload.name}`.trim();
      tickerMeta.textContent = [
        state.payload.market || "市場未設定",
        formatSnapshotBaseDate(
          state.selectedDate,
          state.payload.snapshotDate === state.selectedDate
            ? resolveTickerSnapshot(state)
            : null
        ),
        state.payload.tags?.length ? `タグ: ${state.payload.tags.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" / ");
      syncSnapshotStatusUi(snapshotBadge, refreshMeta, state.selectedDate, resolveTickerSnapshot(state));

      summaryRank.textContent = state.rankingItem ? `${state.rankingItem.rank}位` : "-";
      if (tickerCardRank) {
        tickerCardRank.textContent = state.rankingItem ? `${state.rankingItem.rank}` : "-";
      }
      if (tickerCardCode) {
        tickerCardCode.innerHTML = renderTickerIdentity(code, state.payload.name || code, {
          href: buildTickerUrl(code, state.selectedDate, state.rankingKey),
          variant: "detail",
        });
      }
      setTickerSummaryValues(row);
      setTickerCardValues(latestRow);
      tickerRankMeta.textContent = state.rankingItem
        ? `${rankingLabel(state.rankingKey)} / ${state.rankingItem.rank}位`
        : state.rankingKey
          ? `${rankingLabel(state.rankingKey)} / 圏外`
          : "ランキング指定なし";

      profileMeta.textContent = `${formatNumber(rows.length, 0)}本のローソク足 / ${state.selectedDate}`;
      profileMarket.textContent = state.payload.market || "-";
      profileSector.textContent = state.payload.sector || "-";
      profileIndustry.textContent = state.payload.industry || "-";
      profileTags.textContent = state.payload.tags?.length ? state.payload.tags.join(", ") : "-";
      if (strategyBadges) {
        strategyBadges.innerHTML = renderStrategyBadges(row, { empty: '<span class="meta">一致なし</span>' });
      }
      if (strategyReasons) {
        strategyReasons.innerHTML = renderStrategyReasons(row, { limit: 6, empty: "一致理由なし" }) || "一致理由なし";
      }

      externalLinks.innerHTML = Object.entries(state.payload.links || {})
        .filter(([, href]) => href)
        .map(
          ([label, href]) =>
            `<a class="link-pill" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
        )
        .join("");
      if (tickerCardLinks) {
        const detailItems = [
          { label: "銘柄一覧", href: `./index.html?date=${encodeURIComponent(state.selectedDate)}`, local: true },
          { label: "Yahoo", href: state.payload.links?.quote || "" },
        ];
        tickerCardLinks.innerHTML = detailItems
          .filter((item) => item.href)
          .map((item) =>
            item.local
              ? `<a href="${item.href}">${escapeHtml(item.label)}</a>`
              : `<a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>`
          )
          .join('<span class="scanner-link-separator">|</span>');
      }

      renderTickerChart(chartEl, rows, selectedIndex, state.selectedChartMode, chartMeta, (chartRow) => {
        setTickerSummaryValues(chartRow);
        setTickerCardValues(chartRow);
      });
    }

    function resolveTickerSnapshot(currentState) {
      if (currentState.payload?.snapshotDate !== currentState.selectedDate || !currentState.payload?.snapshotType) {
        return null;
      }
      const currentSnapshot = currentState.manifest?.currentSnapshot;
      if (
        currentSnapshot &&
        currentSnapshot.date === currentState.payload.snapshotDate &&
        currentSnapshot.type === currentState.payload.snapshotType
      ) {
        return currentSnapshot;
      }
      return {
        date: currentState.payload.snapshotDate,
        type: currentState.payload.snapshotType,
        generatedAt: null,
      };
    }
  }

  window.KabuPageTicker = Object.freeze({ initTickerPage });
})();
