(function () {
  const {
    MANIFEST_PATH,
    UPDATE_HEALTH_PATH,
    OHLCV_QUALITY_SUMMARY_PATH,
    OVERVIEW_LITE_INDEX_PATH,
    THEME_MAP_PATH,
    WATCHLIST_PATH,
    WATCHLIST_STORAGE_KEY,
    SCANNER_PICKS_STORAGE_KEY,
    REGISTERED_STORAGE_KEY,
    NOTE_STORAGE_PREFIX,
    PERIOD_MONTHS,
    TICKER_CHART_MODES,
    RANKING_CONFIG,
    STRATEGY_CONFIG,
    TSE_MARKETS,
    MARKET_TAGS,
    TYPE_FILTERS,
    INDEX_SCANNER_LIMITS,
    INDEX_SCANNER_MONTHS,
    INDEX_SCANNER_SORT_OPTIONS,
    INDEX_SCANNER_RANKING_OPTIONS,
    INDEX_SCANNER_RANKING_SORTS,
    INDEX_SCANNER_TIMEFRAMES,
    INDEX_SCANNER_TIMEFRAME_RANGES,
    INDEX_SCANNER_TURNOVER_OPTIONS,
    INDEX_SCANNER_MIN_CLOSE,
    STALE_TOLERANCE_BUSINESS_DAYS,
    STOP_HIGH_EPSILON,
    JPX_PRICE_LIMIT_TABLE,
    TICKER_NAME_EXACT_ALIASES,
    TICKER_NAME_REPLACEMENTS,
    DEVIATION_SORT_KEYS,
    DEVIATION_URL_KEY_MAP,
  } = window.KabuAppConfig;
  const {
    addCalendarMonths,
    addMonths,
    buildDesktopPortFallbackUrl,
    escapeHtml,
    fetchJson,
    formatDateKey,
    formatNumber,
    formatPercent,
    formatRatio,
    formatSignedNumber,
    formatSignedPercent,
    parseDate,
    roundNumber,
    shouldUseDesktopPortFallback,
    startOfMonth,
  } = window.KabuAppUtils;
  const {
    loadManifestData,
    loadUpdateHealthData,
    loadOhlcvQualitySummaryData,
    loadOverviewDateIndexData,
    loadOverviewData,
    loadRankingData,
    loadThemeOrderData,
    loadTickerDetailRecentData,
    loadTickerMetaData,
    loadTickerPayloadData,
    loadTickerSummaryData,
    loadYahooFinanceProfileData,
    readJsonStorage,
    writeJsonStorage,
  } = window.KabuAppData;


  function buildPageDeps() {
    return {
      CHART_FETCH_CONCURRENCY,
      INDEX_SCANNER_LIMITS,
      INDEX_SCANNER_MIN_CLOSE,
      INDEX_SCANNER_MONTHS,
      INDEX_SCANNER_SORT_OPTIONS,
      INDEX_SCANNER_TIMEFRAMES,
      INDEX_SCANNER_TIMEFRAME_RANGES,
      INDEX_SCANNER_TURNOVER_OPTIONS,
      STALE_TOLERANCE_BUSINESS_DAYS,
      STRATEGY_CONFIG,
      MARKET_TAGS,
      TSE_MARKETS,
      NOTE_STORAGE_PREFIX,
      STOP_HIGH_EPSILON,
      TICKER_CHART_MODES,
      addCalendarMonths,
      addMonths,
      buildFilterSnapshotFromState,
      buildHyperExportEntries,
      buildPickedRecordFromPayload,
      buildPickedRecordFromSummary,
      buildRegisteredDisplayName,
      buildRegisteredItemFromPick,
      buildScannerPickPayload,
      buildTickerUrl,
      buildTradingViewExportEntry,
      dedupeScannerPicks,
      diffShapeAgainstBaseline,
      escapeHtml,
      findSelectedIndex,
      filterByMinimumClose,
      filterByTurnover,
      formatDateKey,
      formatNumber,
      formatPercent,
      formatPickedDateTime,
      formatRatio,
      formatScannerTradeDate,
      formatSignedNumber,
      formatSignedPercent,
      formatSignedPercentHtml,
      formatSnapshotBaseDate,
      formatSnapshotGeneratedAt,
      roundNumber,
      getActiveDeviationDraft,
      getActiveDeviationFilter,
      getActiveDeviationSortKey,
      getDeviationSortLabel,
      getDeviationValueBySort,
      getSignedValueClass,
      getRegisteredSetById,
      getStopHighStatus,
      indexScannerRangeLabel,
      indexScannerTimeframeLabel,
      isJapaneseHoliday,
      isDeviationSort,
      isLowerShadowCandidate,
      loadManifest,
      loadOverviewDateIndex,
      loadOverview,
      loadOhlcvQualitySummary,
      loadUpdateHealth,
      loadRanking,
      loadRegisteredPicks,
      loadScannerPicks,
      loadThemeOrder,
      loadTickerNote,
      loadTickerMeta,
      loadTickerDetailRecent,
      loadTickerPayload,
      loadTickerSummary,
      loadYahooFinanceProfile,
      isLegacyDataMode,
      isRecentDataMode,
      getRecentTickerDataUrl,
      loadRecentTickerForChart,
      loadTickerForChartWithFallback,
      loadTickerPayloadWithDiagnostics,
      mapWithConcurrency,
      matchesDeviationFilter,
      normalizeDeviationFilterInputMode,
      normalizeDeviationFilterValue,
      normalizeIndexScannerRangeMonths,
      normalizeTickerChartMode,
      parseDate,
      rankingLabel,
      readJsonStorage,
      registerAllPicks,
      removePickByCode,
      removeRegisteredSetById,
      renderChartFetchFailedItem,
      renderChartFailure,
      renderChartStatus,
      renderExportEntries,
      renderMiniCalendar,
      renderPickedItemLinks,
      renderPickedScannerItem,
      renderRegisteredScannerItem,
      renderRegisteredSetRow,
      renderScannerCompactChart,
      renderScannerExternalLinks,
      renderScannerItem,
      renderScannerItemLinks,
      renderStrategyBadges,
      renderStrategyReasons,
      strategyLabel,
      startAutoRefreshPolling,
      renderTickerChart,
      renderTickerIdentity,
      resetScannerPicks,
      resolveAvailableDate,
      resolveVisibleManifestGeneratedAt,
      resolvePickerDate,
      resolveRegisteredSelectedDate,
      runRefreshAction,
      saveRegisteredPicks,
      saveScannerPicks,
      scannerSortLabel,
      selectAllScannerPicks,
      showError,
      sortScannerRecords,
      summarizeScannerRecordQuality,
      sortedScannerPicks,
      startOfMonth,
      syncIndexScannerUrl,
      syncSnapshotStatusUi,
      syncTickerUrl,
      toggleScannerPick,
      triggerExportDownloads,
      turnoverLabel,
      updatePeriodButtonState,
      writeJsonStorage,
    };
  }

  function initTickerPage() {
    return window.KabuPageTicker.initTickerPage(buildPageDeps());
  }

  function initPickedPage() {
    return window.KabuPagePicked.initPickedPage(buildPageDeps());
  }

  function initRegisteredPage() {
    return window.KabuPageRegistered.initRegisteredPage(buildPageDeps());
  }

  function initIndexScannerPage() {
    return window.KabuPageIndexScanner.initIndexScannerPage(buildPageDeps());
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (page === "watchlist") {
      initWatchlistPage();
    }
    if (page === "index-scanner") {
      initIndexScannerPage();
    }
    if (page === "ticker") {
      initTickerPage();
    }
    if (page === "picked") {
      initPickedPage();
    }
    if (page === "registered") {
      initRegisteredPage();
    }
  });

  async function initWatchlistPage() {
    const body = document.getElementById("watchlistBody");
    const meta = document.getElementById("watchlistMeta");
    const errorBox = document.getElementById("errorBox");
    const dateMeta = document.getElementById("dateMeta");
    const summaryCount = document.getElementById("summaryCount");
    const summaryRisers = document.getElementById("summaryRisers");
    const summaryFallers = document.getElementById("summaryFallers");
    const summaryFlats = document.getElementById("summaryFlats");
    const searchInput = document.getElementById("searchInput");
    const miniCalendar = document.getElementById("miniCalendar");
    const marketPulseMeta = document.getElementById("marketPulseMeta");
    const overviewLatestDate = document.getElementById("overviewLatestDate");
    const overviewDataCoverage = document.getElementById("overviewDataCoverage");
    const overviewAboveMa25 = document.getElementById("overviewAboveMa25");
    const overviewAboveMa75 = document.getElementById("overviewAboveMa75");
    const overviewAboveMa200 = document.getElementById("overviewAboveMa200");
    const overviewAverageChange = document.getElementById("overviewAverageChange");
    const sectorHeatmap = document.getElementById("sectorHeatmap");
    const tagHeatmap = document.getElementById("tagHeatmap");
    const sortButtons = Array.from(document.querySelectorAll(".sort-button"));
    const typeFilters = document.getElementById("typeFilters");
    const marketFilters = document.getElementById("marketFilters");
    const industryFilters = document.getElementById("tagFilters");
    const themeFilters = document.getElementById("themeFilters");
    const addTickerButton = document.getElementById("addTickerButton");
    const resetWatchlistButton = document.getElementById("resetWatchlistButton");
    const editorPanel = document.getElementById("editorPanel");
    const editorTitle = document.getElementById("editorTitle");
    const cancelEditorButton = document.getElementById("cancelEditorButton");
    const tickerForm = document.getElementById("tickerForm");
    const rankingPrimaryTitle = document.getElementById("rankingPrimaryTitle");
    const rankingPrimaryBody = document.getElementById("rankingPrimaryBody");

    const state = {
      manifest: null,
      watchlist: [],
      selectedDate: "",
      overview: null,
      rankings: {},
      query: "",
      sortKey: "ticker",
      sortDirection: "asc",
      sortMode: "manual",
      activeType: "",
      activeMarket: "",
      activeIndustry: "",
      activeTheme: "",
      calendarMonth: null,
    };

    searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      render();
    });

    sortButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextKey = button.dataset.sortKey;
        if (state.sortKey === nextKey) {
          state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = nextKey;
          state.sortDirection = "asc";
        }
        state.sortMode = "manual";
        render();
      });
    });

    addTickerButton.addEventListener("click", () => openEditor());
    cancelEditorButton.addEventListener("click", () => closeEditor());

    resetWatchlistButton.addEventListener("click", async () => {
      localStorage.removeItem(WATCHLIST_STORAGE_KEY);
      state.watchlist = await loadWatchlist();
      closeEditor();
      render();
    });

    tickerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const originalTicker = String(tickerForm.elements.originalTicker.value || "");
      const existingRecord = state.watchlist.find((record) => record.ticker === originalTicker);
      const formData = new FormData(tickerForm);
      const nextRecord = normalizeWatchlistRecord({
        ticker: formData.get("ticker"),
        name: formData.get("name"),
        market: formData.get("market"),
        tags: splitTags(formData.get("tags")),
        themes: existingRecord?.themes || [],
        sector: existingRecord?.sector || "",
        industry: existingRecord?.industry || "",
        links: {
          ...(existingRecord?.links || {}),
          ir: formData.get("ir"),
          news: formData.get("news"),
        },
      });

      if (!nextRecord.ticker || !nextRecord.name) {
        showError(errorBox, "コードと銘柄名は必須です。");
        return;
      }

      const duplicate = state.watchlist.find(
        (record) => record.ticker === nextRecord.ticker && record.ticker !== originalTicker
      );
      if (duplicate) {
        showError(errorBox, `コード ${nextRecord.ticker} は既に存在します。`);
        return;
      }

      errorBox.hidden = true;
      const nextRecords = [...state.watchlist];
      const editIndex = nextRecords.findIndex((record) => record.ticker === originalTicker);
      if (editIndex >= 0) {
        nextRecords[editIndex] = nextRecord;
      } else {
        nextRecords.push(nextRecord);
      }
      state.watchlist = sortWatchlistRecords(nextRecords);
      persistWatchlist(state.watchlist);
      closeEditor();
      render();
    });

    try {
      state.watchlist = await loadWatchlist();
      state.manifest = await loadManifest();
      const params = new URLSearchParams(window.location.search);
      state.activeType = normalizeTypeFilter(params.get("type"));
      state.sortMode = state.activeType ? "type" : "manual";
      state.activeMarket = String(params.get("market") || "").trim();
      state.activeTheme = String(params.get("theme") || "").trim();
      state.activeIndustry = state.activeTheme ? "" : String(params.get("industry") || "").trim();
      const initialDate = resolveAvailableDate(params.get("date") || state.manifest.latestDate, state.manifest.availableDates);
      await loadDateBundle(initialDate);
    } catch (error) {
      showError(errorBox, error.message);
      body.innerHTML = '<tr><td colspan="10" class="empty-cell">日付別データを読み込めませんでした。</td></tr>';
      meta.textContent = `データ未読込: ${error.message}`;
    }

    async function loadDateBundle(requestedDate) {
      const selectedDate = resolveAvailableDate(requestedDate, state.manifest.availableDates);
      const requests = [
        loadOverview(selectedDate),
        ...RANKING_CONFIG.map((item) => loadRanking(selectedDate, item.key)),
      ];
      const [overview, ...rankingPayloads] = await Promise.all(requests);
      state.selectedDate = selectedDate;
      state.overview = overview;
      state.rankings = Object.fromEntries(
        rankingPayloads.map((payload, index) => [RANKING_CONFIG[index].key, payload])
      );
      state.calendarMonth = startOfMonth(parseDate(selectedDate));
      renderDateControls();
      render();
    }

    function renderDateControls() {
      const availableDates = state.manifest.availableDates;
      dateMeta.textContent = `${state.selectedDate}基準 / ${availableDates.length}営業日保存 / 最新 ${state.manifest.latestDate}`;
    }

    function render() {
      const mergedRecords = mergeOverviewWithWatchlist(state.overview?.records || [], state.watchlist, state.selectedDate);
      const facetRecords = mergedRecords.filter((record) =>
        matchesFilter(record, "", state.activeMarket, "", "", state.activeType)
      );

      renderTypeFilters(typeFilters, state.activeType, (type) => {
        state.activeType = type;
        state.sortMode = type ? "type" : "manual";
        render();
      });
      renderMarketFilters(marketFilters, mergedRecords, state.activeMarket, (market) => {
        state.activeMarket = market;
        render();
      });
      renderIndustryFilters(industryFilters, facetRecords, state.activeIndustry, (industry) => {
        state.activeIndustry = industry;
        if (industry) {
          state.activeTheme = "";
        }
        render();
      }, Boolean(state.activeTheme));
      renderThemeFilters(themeFilters, facetRecords, state.activeTheme, (theme) => {
        state.activeTheme = theme;
        if (theme) {
          state.activeIndustry = "";
        }
        render();
      }, Boolean(state.activeIndustry));

      const filtered = mergedRecords
        .filter((record) => matchesFilter(record, state.query, state.activeMarket, state.activeIndustry, state.activeTheme, state.activeType))
        .sort((left, right) => compareRecordSet(left, right, state));

      const risers = filtered.filter((record) => (record.changePercent || 0) > 0).length;
      const fallers = filtered.filter((record) => (record.changePercent || 0) < 0).length;
      const flats = filtered.length - risers - fallers;
      const validTrendRecords = filtered.filter((record) => record.close != null);
      const averageChange = average(filtered.map((record) => record.changePercent).filter((value) => value != null));

      summaryCount.textContent = formatNumber(filtered.length, 0);
      summaryRisers.textContent = formatNumber(risers, 0);
      summaryFallers.textContent = formatNumber(fallers, 0);
      summaryFlats.textContent = formatNumber(flats, 0);
      meta.textContent = `${formatSnapshotBaseDate(state.selectedDate, state.manifest.currentSnapshot)} / ${filtered.length}件${state.activeType ? ` | 種類: ${typeFilterLabel(state.activeType)}` : ""}${state.activeMarket ? ` | 市場: ${state.activeMarket}` : ""}${state.activeIndustry ? ` | 業種: ${state.activeIndustry}` : ""}${state.activeTheme ? ` | テーマ: ${state.activeTheme}` : ""}`;
      marketPulseMeta.textContent = `${state.selectedDate} 基準${state.activeType ? ` / 種類: ${typeFilterLabel(state.activeType)}` : ""}${state.query ? ` / 検索: ${state.query}` : ""}`;
      overviewLatestDate.textContent = state.selectedDate;
      overviewDataCoverage.textContent = `${formatNumber(validTrendRecords.length, 0)}銘柄に日次スナップショットあり`;
      overviewAboveMa25.textContent = formatRatioCount(
        validTrendRecords.filter((record) => (record.distanceToMa25 || 0) > 0).length,
        validTrendRecords.length
      );
      overviewAboveMa75.textContent = formatRatioCount(
        validTrendRecords.filter((record) => (record.distanceToMa75 || 0) > 0).length,
        validTrendRecords.length
      );
      overviewAboveMa200.textContent = formatRatioCount(
        validTrendRecords.filter((record) => (record.distanceToMa200 || 0) > 0).length,
        validTrendRecords.length
      );
      overviewAverageChange.textContent = formatSignedPercent(averageChange);
      renderBreadthList(sectorHeatmap, summarizeGroups(filtered, "sector", "changePercent"), ({ label, value, count }) => ({
        label,
        value: `${formatSignedPercent(value)} / ${formatNumber(count, 0)}件`,
        className: getChangeClass(value),
      }));
      renderBreadthList(tagHeatmap, summarizeTagCounts(filtered), ({ label, count }) => ({
        label,
        value: `${formatNumber(count, 0)}件`,
        className: "",
      }));
      renderCalendar();
      syncIndexUrlState(state);

      const primaryRankingKey = resolvePrimaryRankingKey(state.activeType);
      const primaryPayload = state.rankings[primaryRankingKey];
      const primaryRecords = (primaryPayload?.items || []).filter((record) =>
        matchesFilter(
          {
            ticker: record.code,
            name: record.name,
            market: record.market,
            industry: record.industry,
            themes: record.themes || [],
            changePercent: record.changePercent,
            newHigh52w: record.newHigh52w,
            distanceToMa25: record.distanceToMa25,
            distanceToMa75: record.distanceToMa75,
            distanceToMa200: record.distanceToMa200,
          },
          "",
          state.activeMarket,
          state.activeIndustry,
          state.activeTheme,
          state.activeType
        )
      );
      rankingPrimaryTitle.textContent = resolvePrimaryRankingLabel(state.activeType);
      renderRankingTable(rankingPrimaryBody, resolvePrimaryRankingLabel(state.activeType), primaryRankingKey, state.selectedDate, primaryRecords);

      if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="10" class="empty-cell">該当する銘柄がありません。</td></tr>';
        return;
      }

      body.innerHTML = filtered
        .map((record) => {
          const industry = record.industry
            ? `<button type="button" class="chip filter-chip${record.industry === state.activeIndustry ? " active" : ""}" data-industry="${escapeHtml(record.industry)}">${escapeHtml(record.industry)}</button>`
            : '<span class="subtle">-</span>';

          return `
            <tr data-code="${escapeHtml(record.ticker)}">
              <td>${escapeHtml(record.ticker)}</td>
              <td>${renderTickerIdentity(record.ticker, record.name, { variant: "table", showCode: false })}</td>
              <td>${escapeHtml(record.market)}</td>
              <td class="num">${formatNumber(record.close)}</td>
              <td class="num ${getChangeClass(record.changePercent)}">${formatSignedPercent(record.changePercent)}</td>
              <td class="num ${getSignedValueClass(record.distanceToMa25)}">${formatSignedPercent(record.distanceToMa25)}</td>
              <td class="num">${formatNumber(record.volume, 0)}</td>
              <td>${escapeHtml(record.sector || "-")}</td>
              <td>${industry}</td>
              <td>
                <div class="actions-cell">
                  <button type="button" class="row-button" data-action="edit" data-code="${escapeHtml(record.ticker)}">編集</button>
                  <button type="button" class="row-button" data-action="delete" data-code="${escapeHtml(record.ticker)}">削除</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      Array.from(body.querySelectorAll("tr[data-code]")).forEach((row) => {
        row.addEventListener("click", (event) => {
          if (event.target.closest("button")) {
            return;
          }
          window.location.href = buildTickerUrl(row.dataset.code, state.selectedDate);
        });
      });

      Array.from(body.querySelectorAll("button[data-action='edit']")).forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const record = state.watchlist.find((item) => item.ticker === button.dataset.code);
          openEditor(record);
        });
      });

      Array.from(body.querySelectorAll("button[data-action='delete']")).forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          state.watchlist = state.watchlist.filter((item) => item.ticker !== button.dataset.code);
          persistWatchlist(state.watchlist);
          closeEditor();
          render();
        });
      });

      Array.from(body.querySelectorAll("button[data-industry]")).forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          state.activeIndustry = state.activeIndustry === button.dataset.industry ? "" : button.dataset.industry;
          if (state.activeIndustry) {
            state.activeTheme = "";
          }
          render();
        });
      });
    }

    function renderCalendar() {
      const minMonth = startOfMonth(parseDate(state.manifest.availableDates[0]));
      const maxMonth = startOfMonth(parseDate(state.manifest.availableDates.at(-1)));
      renderMiniCalendar(
        miniCalendar,
        state.calendarMonth || startOfMonth(parseDate(state.selectedDate)),
        state.selectedDate,
        state.manifest.availableDates,
        async (nextDate) => {
          await loadDateBundle(nextDate);
        },
        {
          minMonth,
          maxMonth,
          onPrevMonth: () => {
            state.calendarMonth = addCalendarMonths(state.calendarMonth, -1);
            renderCalendar();
          },
          onNextMonth: () => {
            state.calendarMonth = addCalendarMonths(state.calendarMonth, 1);
            renderCalendar();
          },
        }
      );
    }

    function openEditor(record) {
      editorPanel.hidden = false;
      editorTitle.textContent = record ? `${record.ticker} を編集` : "銘柄を追加";
      tickerForm.reset();
      tickerForm.elements.formMode.value = record ? "edit" : "create";
      tickerForm.elements.originalTicker.value = record?.ticker || "";
      tickerForm.elements.ticker.value = record?.ticker || "";
      tickerForm.elements.name.value = record?.name || "";
      tickerForm.elements.market.value = record?.market || "TSE";
      tickerForm.elements.tags.value = (record?.tags || []).join(",");
      tickerForm.elements.ir.value = record?.links?.ir || "";
      tickerForm.elements.news.value = record?.links?.news || "";
    }

    function closeEditor() {
      editorPanel.hidden = true;
      tickerForm.reset();
    }
  }


  async function initScannerPage() {
    const sortSelect = document.getElementById("scannerSort");
    const tagSelect = document.getElementById("scannerTag");
    const limitSelect = document.getElementById("scannerLimit");
    const monthsSelect = document.getElementById("scannerMonths");
    const pickedLink = document.getElementById("scannerPickedLink");
    const resetPicksButton = document.getElementById("scannerResetPicksButton");
    const miniCalendar = document.getElementById("scannerMiniCalendar");
    const dateMeta = document.getElementById("scannerDateMeta");
    const meta = document.getElementById("scannerMeta");
    const errorBox = document.getElementById("scannerError");
    const list = document.getElementById("scannerList");

    const state = {
      manifest: null,
      overview: null,
      sort: "gainers",
      tag: "",
      limit: 50,
      months: 3,
      selectedDate: "",
      calendarMonth: null,
      picks: {},
    };

    const params = new URLSearchParams(window.location.search);
    state.sort = params.get("sort") || state.sort;
    state.tag = params.get("tag") || "";
    state.limit = Number(params.get("limit") || state.limit);
    state.months = Number(params.get("months") || state.months);
    state.picks = loadScannerPicks();
    sortSelect.value = state.sort;
    limitSelect.value = String(state.limit);
    monthsSelect.value = String(state.months);
    if (pickedLink) {
      pickedLink.href = "./picked.html";
    }

    [sortSelect, tagSelect, limitSelect, monthsSelect].forEach((control) => {
      control.addEventListener("change", async () => {
        state.sort = sortSelect.value;
        state.tag = tagSelect.value;
        state.limit = Number(limitSelect.value);
        state.months = Number(monthsSelect.value);
        await render();
      });
    });

    if (resetPicksButton) {
      resetPicksButton.addEventListener("click", async () => {
        resetScannerPicks(state);
        await render();
      });
    }

    try {
      state.manifest = await loadManifest();
      await loadDate(params.get("date") || state.manifest.latestDate);
      await render();
    } catch (error) {
      showError(errorBox, error.message);
    }

    async function loadDate(requestedDate) {
      state.selectedDate = resolveAvailableDate(requestedDate, state.manifest.availableDates);
      state.overview = await loadOverview(state.selectedDate);
      state.calendarMonth = startOfMonth(parseDate(state.selectedDate));
      const tags = [...new Set((state.overview.records || []).flatMap((record) => record.tags || []))].sort();
      tagSelect.innerHTML = ['<option value="">すべて</option>']
        .concat(tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`))
        .join("");
      if (state.tag && !tags.includes(state.tag)) {
        state.tag = "";
      }
      tagSelect.value = state.tag;
      renderDateControls();
    }

    async function render() {
      errorBox.hidden = true;
      list.innerHTML = '<div class="empty-cell">読み込み中...</div>';
      const filtered = sortScannerRecords(
        (state.overview.records || []).filter((record) => !state.tag || (record.tags || []).includes(state.tag)),
        state.sort
      ).slice(0, state.limit);
      syncScannerUrl(state.selectedDate, state.sort, state.tag, state.limit, state.months);
      renderCalendar();
      meta.textContent = `${formatSnapshotBaseDate(state.selectedDate, state.manifest.currentSnapshot)} / ${filtered.length}銘柄 / 並び順: ${scannerSortLabel(state.sort)} / 期間: ${indexScannerPeriodLabel(state.months)}`;

      if (!filtered.length) {
        list.innerHTML = '<div class="empty-cell">該当する銘柄がありません。</div>';
        return;
      }

      list.innerHTML = filtered
        .map((record, index) => renderScannerItem(record, index, state))
        .join("");

      filtered.forEach((record) => {
        const checkbox = list.querySelector(`input[data-pick-code="${record.code}"]`);
        if (!checkbox) {
          return;
        }
        checkbox.addEventListener("change", () => {
          toggleScannerPick(record, checkbox.checked, state);
        });
      });

      const results = await mapWithConcurrency(filtered, CHART_FETCH_CONCURRENCY, async (record) => {
        try {
          return {
            record,
            status: "fulfilled",
            value: await loadTickerForChartWithFallback(record.code, { selectedDate: state.selectedDate }),
          };
        } catch (error) {
          return { record, status: "rejected", reason: error };
        }
      });

      const baselineShape = results.find((result) => result.status === "fulfilled" && !result.value.validation.issues.length)?.value.shape || null;

      results.forEach((result) => {
        const record = result.record;
        if (result.status === "rejected") {
          renderChartFailure(`scanChart-${record.code}`, "データ取得失敗");
          showError(errorBox, `一部のチャート読込に失敗: ${record.code} / ${result.reason?.message}`);
          return;
        }
        const { payload, chartPayload, validation, shape, requestUrl, status, responseBody } = result.value;
        if (validation.issues.length) {
          console.debug("[ticker-chart:validation]", {
            code: record.code,
            requestUrl,
            status,
            responseBody: responseBody.slice(0, 1200),
            parsedCandleCount: validation.parsedCandleCount,
            issues: validation.issues,
            warnings: validation.warnings,
            shapeDiff: diffShapeAgainstBaseline(baselineShape, shape),
          });
          renderChartFailure(`scanChart-${record.code}`, "データ取得失敗");
          showError(errorBox, `一部のチャート読込に失敗: ${record.code} / ${validation.issues.join(", ")}`);
          return;
        }
        renderScannerCompactChart(
          `scanChart-${record.code}`,
          record.code,
          (chartPayload || payload).ohlcv,
          state.selectedDate,
          state.months
        );
        const linksElement = document.getElementById(`scanLinks-${record.code}`);
        if (linksElement) {
          linksElement.innerHTML = renderScannerItemLinks(payload, record, state);
        }
      });
    }

    function renderDateControls() {
      const availableDates = state.manifest.availableDates;
      dateMeta.textContent = `${state.selectedDate}基準 / ${availableDates.length}営業日保存 / 最新 ${state.manifest.latestDate}`;
    }

    function renderCalendar() {
      const minMonth = startOfMonth(parseDate(state.manifest.availableDates[0]));
      const maxMonth = startOfMonth(parseDate(state.manifest.availableDates.at(-1)));
      renderMiniCalendar(
        miniCalendar,
        state.calendarMonth || startOfMonth(parseDate(state.selectedDate)),
        state.selectedDate,
        state.manifest.availableDates,
        async (nextDate) => {
          await loadDate(nextDate);
          await render();
        },
        {
          minMonth,
          maxMonth,
          onPrevMonth: () => {
            state.calendarMonth = addCalendarMonths(state.calendarMonth, -1);
            renderCalendar();
          },
          onNextMonth: () => {
            state.calendarMonth = addCalendarMonths(state.calendarMonth, 1);
            renderCalendar();
          },
        }
      );
    }
  }




  async function loadManifest() {
    return loadManifestData(fetchJson, MANIFEST_PATH);
  }

  async function loadOverviewDateIndex() {
    return loadOverviewDateIndexData(OVERVIEW_LITE_INDEX_PATH);
  }

  async function loadUpdateHealth() {
    try {
      return await loadUpdateHealthData(UPDATE_HEALTH_PATH);
    } catch (_error) {
      return null;
    }
  }

  async function loadOhlcvQualitySummary() {
    try {
      return await loadOhlcvQualitySummaryData(OHLCV_QUALITY_SUMMARY_PATH);
    } catch (_error) {
      return null;
    }
  }

  function manifestRevisionKey(manifest) {
    const currentSnapshot = manifest?.currentSnapshot || {};
    return JSON.stringify({
      latestDate: String(manifest?.latestDate || "").trim(),
      snapshotDate: String(currentSnapshot?.date || "").trim(),
      snapshotType: String(currentSnapshot?.type || "").trim(),
      snapshotStatus: String(currentSnapshot?.status || "").trim(),
      generatedAt: String(currentSnapshot?.generatedAt || "").trim(),
    });
  }

  function hasManifestRevisionChanged(nextManifest, currentManifest) {
    return manifestRevisionKey(nextManifest) !== manifestRevisionKey(currentManifest);
  }

  function resolveVisibleManifestGeneratedAt(manifest, selectedDate = "") {
    const manifestGeneratedAt = String(manifest?.generatedAt || "").trim();
    const snapshot = manifest?.currentSnapshot || {};
    const snapshotGeneratedAt = String(snapshot?.generatedAt || "").trim();
    const snapshotDate = String(snapshot?.date || "").trim();
    const targetDate = String(selectedDate || "").trim();
    if (!snapshotGeneratedAt) {
      return manifestGeneratedAt;
    }
    if (targetDate && snapshotDate && snapshotDate !== targetDate) {
      return manifestGeneratedAt || snapshotGeneratedAt;
    }
    const manifestTime = manifestGeneratedAt ? Date.parse(manifestGeneratedAt) : NaN;
    const snapshotTime = snapshotGeneratedAt ? Date.parse(snapshotGeneratedAt) : NaN;
    if (Number.isFinite(manifestTime) && Number.isFinite(snapshotTime)) {
      return manifestTime > snapshotTime ? manifestGeneratedAt : snapshotGeneratedAt;
    }
    return manifestGeneratedAt || snapshotGeneratedAt;
  }

  function startAutoRefreshPolling({
    getCurrentManifest,
    onRefresh,
    onError,
    intervalMs = 30000,
  }) {
    let timerId = null;
    let disposed = false;
    let inFlight = false;

    const runCheck = async () => {
      if (disposed || inFlight || document.visibilityState !== "visible") {
        return;
      }
      inFlight = true;
      try {
        const latestManifest = await loadManifest();
        if (hasManifestRevisionChanged(latestManifest, getCurrentManifest?.())) {
          await onRefresh(latestManifest);
        }
      } catch (error) {
        onError?.(error);
      } finally {
        inFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runCheck();
      }
    };

    timerId = window.setInterval(() => {
      void runCheck();
    }, intervalMs);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      if (timerId) {
        window.clearInterval(timerId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }

  async function loadThemeOrder() {
    return loadThemeOrderData(fetchJson, THEME_MAP_PATH);
  }

  function snapshotTypeLabel(snapshotType, snapshotStatus) {
    if (snapshotStatus === "finalized") {
      return "完了";
    }
    if (snapshotStatus === "stale" || snapshotType === "stale_after_close") {
      return "暫定データ（引け後未確定）";
    }
    if (snapshotType === "am") {
      return "前場";
    }
    if (snapshotType === "yf_intraday") {
      return "暫定データ";
    }
    if (snapshotType === "daily") {
      return "完了";
    }
    return "";
  }

  function formatSnapshotBaseDate(selectedDate, snapshot) {
    const date = String(selectedDate || "").trim();
    if (!date) {
      return "";
    }
    const snapshotDate = String(snapshot?.date || "").trim();
    const label =
      snapshotDate === date
        ? snapshotTypeLabel(
            String(snapshot?.type || "").trim(),
            String(snapshot?.status || "").trim(),
          )
        : "";
    const generatedAt = snapshotDate === date ? formatSnapshotGeneratedAt(snapshot?.generatedAt) : "";
    return `基準日: ${date}${label ? ` / ${label}` : ""}${generatedAt ? ` / 最終更新: ${generatedAt}` : ""}`;
  }

  function formatSnapshotGeneratedAt(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return text;
    }
    return new Intl.DateTimeFormat("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function isSnapshotStatusVisible(selectedDate, snapshot) {
    if (String(snapshot?.status || "").trim() === "finalized") {
      return true;
    }
    return (
      String(selectedDate || "").trim() !== "" &&
      String(snapshot?.date || "").trim() === String(selectedDate || "").trim() &&
      ["yf_intraday", "daily", "stale_after_close"].includes(String(snapshot?.type || "").trim())
    );
  }

  function syncSnapshotStatusUi(badgeElement, metaElement, selectedDate, snapshot) {
    const active = isSnapshotStatusVisible(selectedDate, snapshot);
    if (badgeElement) {
      const label = active
        ? snapshotTypeLabel(
            String(snapshot?.type || "").trim(),
            String(snapshot?.status || "").trim(),
          )
        : "";
      badgeElement.textContent = label;
      badgeElement.hidden = !active || !label;
    }
    if (metaElement) {
      metaElement.textContent = active
        ? `最終更新: ${formatSnapshotGeneratedAt(snapshot?.generatedAt) || "-"}`
        : "";
      metaElement.hidden = !active;
    }
  }

  async function runRefreshAction(button, errorBox, fn) {
    if (!button) {
      await fn();
      return;
    }
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "更新中...";
    if (errorBox) {
      errorBox.hidden = true;
    }
    try {
      await fn();
    } catch (_error) {
      if (errorBox) {
        showError(errorBox, "再読込に失敗しました。数秒後にもう一度お試しください。");
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function loadOverview(date, timeframe = "daily") {
    return loadOverviewData(fetchJson, date, timeframe);
  }

  async function loadRanking(date, key) {
    return loadRankingData(date, key, rankingLabel);
  }

  async function loadTickerPayload(code) {
    return loadTickerPayloadData(fetchJson, code);
  }

  async function loadTickerMeta(code) {
    return loadTickerMetaData(fetchJson, code);
  }

  async function loadTickerDetailRecent(code, years = 1) {
    return loadTickerDetailRecentData(fetchJson, code, years);
  }

  async function loadTickerSummary(date) {
    return loadTickerSummaryData(fetchJson, date);
  }

  async function loadYahooFinanceProfile(code) {
    return loadYahooFinanceProfileData(code);
  }

  async function loadWatchlist() {
    const baseRecords = sortWatchlistRecords((await fetchJson(WATCHLIST_PATH)).map(normalizeWatchlistRecord));
    const baseRecordMap = new Map(baseRecords.map((record) => [record.ticker, record]));
    const local = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!local) {
      return baseRecords;
    }

    try {
      const parsed = JSON.parse(local);
      const localRecords = Array.isArray(parsed) ? parsed : parsed.records;
      const baseRecordCount = Array.isArray(parsed) ? null : Number(parsed.baseRecordCount || 0);
      if (!Array.isArray(localRecords)) {
        return baseRecords;
      }

      if (baseRecords.length >= 500) {
        if ((baseRecordCount && baseRecordCount !== baseRecords.length) || localRecords.length < baseRecords.length * 0.9) {
          localStorage.removeItem(WATCHLIST_STORAGE_KEY);
          return baseRecords;
        }
      }

      const normalizedLocalRecords = localRecords.map(normalizeWatchlistRecord);
      const mergedRecordMap = new Map(baseRecordMap);
      normalizedLocalRecords.forEach((record) => {
        const baseRecord = baseRecordMap.get(record.ticker);
        if (baseRecord) {
          mergedRecordMap.set(record.ticker, {
            ...baseRecord,
            name: record.name || baseRecord.name,
            market: record.market || baseRecord.market,
            tags: record.tags?.length ? record.tags : baseRecord.tags,
            themes: record.themes?.length ? record.themes : baseRecord.themes,
            links: { ...(baseRecord.links || {}), ...(record.links || {}) },
          });
          return;
        }
        if (!TSE_MARKETS.has(record.market)) {
          mergedRecordMap.set(record.ticker, record);
        }
      });
      return sortWatchlistRecords([...mergedRecordMap.values()]);
    } catch (_error) {
      localStorage.removeItem(WATCHLIST_STORAGE_KEY);
      return baseRecords;
    }
  }

  function persistWatchlist(records) {
    localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify({
        baseRecordCount: records.length,
        records: sortWatchlistRecords(records),
      })
    );
  }

  function loadScannerPicks() {
    const parsed = readJsonStorage(SCANNER_PICKS_STORAGE_KEY, {});
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }

  function saveScannerPicks(picks) {
    writeJsonStorage(SCANNER_PICKS_STORAGE_KEY, picks);
  }

  function loadRegisteredPicks() {
    const parsed = readJsonStorage(REGISTERED_STORAGE_KEY, []);
    try {
      if (Array.isArray(parsed)) {
        if (parsed.every((entry) => entry && typeof entry === "object" && Array.isArray(entry.items))) {
          return parsed
            .slice()
            .sort((left, right) => String(right?.registeredAt || "").localeCompare(String(left?.registeredAt || "")));
        }
        const legacyItems = parsed
          .map((item) => buildRegisteredItemFromPick(item))
          .filter((item) => item.code);
        if (legacyItems.length) {
          return [
            {
              id: `legacy-${Date.now()}`,
              name: "移行データ / 条件情報なし",
              registeredAt: new Date().toISOString(),
              count: legacyItems.length,
              items: legacyItems,
            },
          ];
        }
        return [];
      }
      if (parsed && typeof parsed === "object") {
        const legacyItems = Object.values(parsed)
          .map((item) => buildRegisteredItemFromPick(item))
          .filter((item) => item.code);
        if (legacyItems.length) {
          return [
            {
              id: `legacy-${Date.now()}`,
              name: "移行データ / 条件情報なし",
              registeredAt: new Date().toISOString(),
              count: legacyItems.length,
              items: legacyItems,
            },
          ];
        }
      }
      return [];
    } catch (_error) {
      localStorage.removeItem(REGISTERED_STORAGE_KEY);
      return [];
    }
  }

  function saveRegisteredPicks(records) {
    writeJsonStorage(REGISTERED_STORAGE_KEY, Array.isArray(records) ? records : []);
  }

  function removePickByCode(code) {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) {
      return;
    }
    const next = loadScannerPicks();
    delete next[normalizedCode];
    saveScannerPicks(next);
  }

  function buildFilterSnapshotFromState(state) {
    if (!state || typeof state !== "object") {
      return null;
    }
    const bars = state.rangeMonths != null ? Number(state.rangeMonths) : state.months != null ? Number(state.months) : 3;
    return {
      date: String(state.selectedDate || "").trim(),
      sort: String(state.sort || "").trim(),
      tag: String(state.tag || "").trim(),
      theme: String(state.theme || "").trim(),
      turnover: Number(state.turnover || 0),
      limit: Number(state.limit || 0),
      bars: Number.isFinite(bars) ? bars : 63,
      timeframe: String(state.timeframe || "daily").trim() || "daily",
      selectedStrategies: Array.isArray(state.selectedStrategies)
        ? state.selectedStrategies.map((strategyId) => String(strategyId || "").trim()).filter(Boolean)
        : [],
      sourcePage: String(document.body?.dataset?.page || "").trim(),
    };
  }

  function formatFilterSummary(snapshot) {
    if (!snapshot) {
      return "条件情報なし";
    }
    const parts = [];
    const date = String(snapshot.date || "").trim();
    const sort = String(snapshot.sort || "").trim();
    parts.push(date || "日付不明");
    parts.push(sort ? scannerSortLabel(sort) : "条件不明");
    const tag = String(snapshot.tag || "").trim();
    if (tag) {
      parts.push(`業種:${tag}`);
    }
    const theme = String(snapshot.theme || "").trim();
    if (theme) {
      parts.push(`テーマ:${theme}`);
    }
    const turnover = Number(snapshot.turnover || 0);
    if (turnover > 0) {
      parts.push(`売買代金>=${turnoverLabel(turnover)}`);
    }
    const bars = Number(snapshot.bars || 63);
    parts.push(indexScannerRangeLabel(String(snapshot.timeframe || "daily"), Number.isFinite(bars) ? bars : 3));
    parts.push(indexScannerTimeframeLabel(String(snapshot.timeframe || "daily")));
    return parts.join(" / ");
  }

  function buildScannerPickPayload(record, state) {
    const filterSnapshot = buildFilterSnapshotFromState(state);
    return {
      code: String(record.code || record.ticker || "").trim(),
      name: String(record.name || "").trim(),
      market: String(record.market || "").trim(),
      selectedAt: new Date().toISOString(),
      filterSnapshot,
      filterSummary: formatFilterSummary(filterSnapshot),
    };
  }

  function buildRegisteredItemFromPick(pick) {
    const filterSnapshot = pick?.filterSnapshot && typeof pick.filterSnapshot === "object" ? pick.filterSnapshot : null;
    return {
      code: String(pick?.code || "").trim(),
      name: String(pick?.name || "").trim(),
      market: String(pick?.market || "").trim(),
      selectedAt: String(pick?.selectedAt || ""),
      registeredAt: new Date().toISOString(),
      filterSnapshot,
      filterSummary: formatFilterSummary(filterSnapshot),
    };
  }

  function formatYmd(isoValue) {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) {
      return String(isoValue || "").slice(0, 10);
    }
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function buildRegisteredDisplayName(userLabel, registeredAt, conditionLabel = "") {
    const trimmedLabel = String(userLabel || "").trim();
    const trimmedConditionLabel = String(conditionLabel || "").trim();
    if (trimmedConditionLabel) {
      return [trimmedLabel, trimmedConditionLabel].filter(Boolean).join(" / ");
    }
    return `${formatYmd(registeredAt)} ${trimmedLabel}`;
  }

  function registerAllPicks(picks, userLabel, filterContext = null) {
    const normalized = dedupeScannerPicks(Array.isArray(picks) ? picks : []);
    if (!normalized.length) {
      throw new Error("登録対象の選別銘柄がありません。");
    }
    const trimmedLabel = String(userLabel || "").trim();
    if (!trimmedLabel) {
      throw new Error("登録名を入力してください。");
    }
    const registeredAt = new Date().toISOString();
    const items = normalized.map((pick) => buildRegisteredItemFromPick(pick)).filter((item) => item.code);
    if (!items.length) {
      throw new Error("登録対象の銘柄コードが取得できません。");
    }
    const entry = {
      id: `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: buildRegisteredDisplayName(trimmedLabel, registeredAt, buildSearchConditionDisplayName(filterContext)),
      registeredAt,
      count: items.length,
      items,
    };
    const records = loadRegisteredPicks();
    records.unshift(entry);
    saveRegisteredPicks(records);
    return entry;
  }

  function removeRegisteredSetById(id) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) {
      return;
    }
    const records = loadRegisteredPicks();
    saveRegisteredPicks(records.filter((entry) => String(entry?.id || "") !== normalizedId));
  }

  function getRegisteredSetById(id) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) {
      return null;
    }
    const records = loadRegisteredPicks();
    return records.find((entry) => String(entry?.id || "") === normalizedId) || null;
  }

  function toggleScannerPick(record, checked, state) {
    const code = String(record.code || record.ticker || "").trim();
    if (!code) {
      return;
    }
    if (checked) {
      state.picks[code] = buildScannerPickPayload(record, state);
    } else {
      delete state.picks[code];
    }
    saveScannerPicks(state.picks);
  }

  function selectAllScannerPicks(records, state) {
    const source = Array.isArray(records) ? records : [];
    if (!source.length) {
      return;
    }
    const next = { ...(state.picks || {}) };
    source.forEach((record) => {
      const code = String(record?.code || record?.ticker || "").trim();
      if (!code) {
        return;
      }
      next[code] = buildScannerPickPayload(record, state);
    });
    state.picks = next;
    saveScannerPicks(state.picks);
  }

  function resetScannerPicks(state) {
    state.picks = {};
    localStorage.removeItem(SCANNER_PICKS_STORAGE_KEY);
  }

  function sortedScannerPicks(picks) {
    return Object.values(picks).sort((left, right) => String(right.selectedAt || "").localeCompare(String(left.selectedAt || "")));
  }

  function formatPickedDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value || "-");
    }
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function dedupeScannerPicks(picks) {
    const byCode = new Map();
    picks.forEach((pick) => {
      const code = String(pick.code || "").trim();
      if (!code) {
        return;
      }
      const current = byCode.get(code);
      if (!current || String(pick.selectedAt || "") > String(current.selectedAt || "")) {
        byCode.set(code, pick);
      }
    });
    return [...byCode.values()].sort((left, right) => {
      const dateCompare = String(right.selectedAt || "").localeCompare(String(left.selectedAt || ""));
      return dateCompare || String(left.code || "").localeCompare(String(right.code || ""), "ja", { numeric: true, sensitivity: "base" });
    });
  }

  function toTradingViewSymbols(items) {
    return items
      .map((item) => String(item.code || "").trim())
      .filter(Boolean)
      .map((code) => `TSE:${code}`);
  }

  function toTradingViewText(items) {
    return toTradingViewSymbols(items).join(",");
  }

  function toHyperSbi2Csv(items) {
    return ["code"]
      .concat(
        items
          .map((item) => String(item.code || "").trim())
          .filter(Boolean)
      )
      .join("\n")
      .concat("\n");
  }

  function createDownloadBlob(text, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    return {
      url,
      revoke: () => URL.revokeObjectURL(url),
    };
  }

  function lookupConfigLabel(config, key) {
    const normalizedKey = String(key || "").trim();
    return (config || []).find((item) => String(item?.key || "") === normalizedKey)?.label || "";
  }

  function selectedStrategyLabels(context) {
    const explicitStrategies = Array.isArray(context?.selectedStrategies) ? context.selectedStrategies : [];
    const labels = explicitStrategies
      .map((strategyId) => lookupConfigLabel(STRATEGY_CONFIG, strategyId) || String(strategyId || "").trim())
      .filter(Boolean);
    const sort = String(context?.sort || "").trim();
    if (lookupConfigLabel(INDEX_SCANNER_SORT_OPTIONS, sort)) {
      labels.push(lookupConfigLabel(INDEX_SCANNER_SORT_OPTIONS, sort));
    }
    return [...new Set(labels)];
  }

  function rankingLabelFromContext(context) {
    const sort = String(context?.sort || "").trim();
    return lookupConfigLabel(INDEX_SCANNER_RANKING_OPTIONS, sort);
  }

  function turnoverConditionLabel(value) {
    const turnover = Number(value || 0);
    if (!(turnover > 0)) {
      return "売買代金指定なし";
    }
    if (turnover >= 100000000) {
      const oku = turnover / 100000000;
      return Number.isInteger(oku) ? `${oku}億円以上` : `${formatNumber(oku, 1)}億円以上`;
    }
    if (turnover >= 10000) {
      return `${formatNumber(turnover / 10000, 0)}万円以上`;
    }
    return `${formatNumber(turnover, 0)}円以上`;
  }

  function buildSearchConditionParts(context) {
    if (!context || typeof context !== "object") {
      return [];
    }
    const parts = [];
    const date = String(context?.date || "").trim();
    if (date) {
      parts.push(date);
    }
    selectedStrategyLabels(context).forEach((label) => parts.push(label));
    const rankingLabel = rankingLabelFromContext(context);
    if (rankingLabel) {
      parts.push(rankingLabel);
    }
    parts.push(turnoverConditionLabel(context?.turnover));
    return parts.filter(Boolean);
  }

  function buildSearchConditionDisplayName(context) {
    return buildSearchConditionParts(context).join(" / ");
  }

  function sanitizeDownloadFilePart(value) {
    return String(value || "")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "")
      .replace(/_+/g, "_");
  }

  function buildSearchConditionFileBase(context, fallback = "kabu_list") {
    const base = buildSearchConditionParts(context).map(sanitizeDownloadFilePart).filter(Boolean).join("_");
    return base || fallback;
  }

  function buildTradingViewExportEntry(items, filterContext = null) {
    const blob = createDownloadBlob(toTradingViewText(items));
    const fileBase = buildSearchConditionFileBase(filterContext, "");
    return {
      key: "tradingview",
      label: "TradingView",
      fileName: fileBase ? `${fileBase}_TradingView.txt` : "tradingview_watchlist.txt",
      count: items.length,
      href: blob.url,
      revoke: blob.revoke,
    };
  }

  function buildHyperExportEntries(items, filterContext = null) {
    const blob = createDownloadBlob(toHyperSbi2Csv(items), "text/csv;charset=utf-8");
    const fileBase = buildSearchConditionFileBase(filterContext, "");
    return [
      {
        key: "hyper",
        label: "HYPER SBI 2",
        fileName: fileBase ? `${fileBase}_HYPER_SBI2.csv` : "hyper_sbi2_codes.csv",
        count: items.length,
        href: blob.url,
        revoke: blob.revoke,
      },
    ];
  }

  function revokeExportEntries(entries) {
    entries.forEach((entry) => entry?.revoke?.());
  }

  function renderExportEntries(container, entries) {
    if (!container) {
      return;
    }
    if (!entries.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = entries
      .map(
        (entry) => `
          <div class="picked-export-item">
            <div>
              <div class="picked-export-name">${escapeHtml(entry.fileName)}</div>
              <div class="picked-export-meta">${escapeHtml(entry.label)} / ${formatNumber(entry.count, 0)}件</div>
            </div>
            <a class="picked-export-download" href="${entry.href}" download="${escapeHtml(entry.fileName)}">ダウンロード</a>
          </div>
        `
      )
      .join("");
  }

  function replaceExportEntries(state, nextEntries, container) {
    revokeExportEntries(state.exportEntries);
    state.exportEntries = nextEntries;
    renderExportEntries(container, nextEntries);
  }

  function triggerExportDownloads(entries) {
    entries.forEach((entry) => {
      const anchor = document.createElement("a");
      anchor.href = entry.href;
      anchor.download = entry.fileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        anchor.remove();
        entry.revoke?.();
      }, 2000);
    });
  }

  function normalizeWatchlistRecord(record) {
    const links = Object.entries(record?.links || {}).reduce((accumulator, [key, value]) => {
      const normalizedKey = String(key || "").trim();
      const normalizedValue = String(value || "").trim();
      if (normalizedKey && normalizedValue) {
        accumulator[normalizedKey] = normalizedValue;
      }
      return accumulator;
    }, {});

    return {
      ticker: String(record.ticker || record.code || "").trim(),
      name: String(record.name || "").trim(),
      market: String(record.market || "").trim(),
      tags: splitTags(record.tags),
      themes: splitTags(record.themes),
      sector: String(record.sector || "").trim(),
      industry: String(record.industry || "").trim(),
      links,
    };
  }

  function splitTags(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function sortWatchlistRecords(records) {
    return [...records].sort((left, right) =>
      left.ticker.localeCompare(right.ticker, "ja", { numeric: true, sensitivity: "base" })
    );
  }

  function mergeOverviewWithWatchlist(records, watchlist, date) {
    const watchlistMap = new Map(watchlist.map((record) => [record.ticker, record]));
    const merged = records.map((record) => {
      const watch = watchlistMap.get(String(record.code));
      return {
        ticker: String(record.code),
        name: watch?.name || record.name || "",
        market: watch?.market || record.market || "",
        sector: watch?.sector || record.sector || "",
        industry: watch?.industry || record.industry || "",
        themes: watch?.themes || record.themes || [],
        tags: watch?.tags || record.tags || [],
        links: { ...(record.links || {}), ...(watch?.links || {}) },
        latestDate: date,
        close: record.close,
        volume: record.volume,
        change: record.change,
        changePercent: record.changePercent,
        distanceToMa25: record.distanceToMa25,
        distanceToMa75: record.distanceToMa75,
        distanceToMa200: record.distanceToMa200,
        volumeRatio25: record.volumeRatio25,
        rci12: record.rci12,
        rci24: record.rci24,
        rci48: record.rci48,
        rangePosition52w: record.rangePosition52w,
        newHigh52w: record.newHigh52w,
      };
    });

    watchlist.forEach((record) => {
      if (!merged.find((item) => item.ticker === record.ticker)) {
        merged.push({
          ...record,
          latestDate: date,
          close: null,
          volume: null,
          change: null,
          changePercent: null,
          distanceToMa25: null,
          distanceToMa75: null,
          distanceToMa200: null,
          volumeRatio25: null,
          rci12: null,
          rci24: null,
          rci48: null,
          rangePosition52w: null,
          newHigh52w: null,
        });
      }
    });
    return merged;
  }

  function matchesFilter(record, query, activeMarket, activeIndustry, activeTheme = "", activeType = "") {
    const queryMatch =
      !query ||
      [record.ticker, record.code, record.name].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      );
    const marketMatch = !activeMarket || record.market === activeMarket;
    const industryMatch = !activeIndustry || record.industry === activeIndustry;
    const themeMatch = !activeTheme || (record.themes || []).includes(activeTheme);
    const numericChange = Number(record.changePercent || 0);
    const typeMatch =
      !activeType ||
      (activeType === "gainers" && numericChange > 0) ||
      (activeType === "losers" && numericChange < 0) ||
      (activeType === "new_high" && record.newHigh52w === true) ||
      (activeType === "deviation25" && record.distanceToMa25 != null) ||
      (activeType === "deviation75" && record.distanceToMa75 != null) ||
      (activeType === "deviation200" && record.distanceToMa200 != null);
    return queryMatch && marketMatch && industryMatch && themeMatch && typeMatch;
  }

  function renderTypeFilters(container, activeType, onClick) {
    if (!container) {
      return;
    }
    container.innerHTML = TYPE_FILTERS.map(
      ({ key, label }) =>
        `<button type="button" class="chip filter-chip${key === activeType ? " active" : ""}" data-type-filter="${escapeHtml(key)}">${escapeHtml(label)}</button>`
    ).join("");

    Array.from(container.querySelectorAll("button[data-type-filter]")).forEach((button) => {
      button.addEventListener("click", () => onClick(button.dataset.typeFilter || ""));
    });
  }

  function renderIndustryFilters(container, records, activeIndustry, onClick, disabled = false) {
    const industries = [...new Set(records.map((record) => String(record.industry || "").trim()).filter(Boolean))]
      .filter((industry) => !MARKET_TAGS.has(industry) && !records.some((record) => record.market === industry))
      .sort((left, right) => left.localeCompare(right, "ja", { sensitivity: "base" }));
    const options = ["全業種", ...industries];
    container.innerHTML = options.length
      ? options
          .map(
            (industry) =>
              `<button type="button" class="chip filter-chip${(!activeIndustry && industry === "全業種") || industry === activeIndustry ? " active" : ""}${disabled && industry !== "全業種" ? " disabled" : ""}" data-industry-filter="${escapeHtml(industry)}"${disabled && industry !== "全業種" ? " disabled" : ""}>${escapeHtml(industry)}</button>`
          )
          .join("")
      : '<span class="subtle">業種がありません。</span>';

    Array.from(container.querySelectorAll("button[data-industry-filter]")).forEach((button) => {
      button.addEventListener("click", () => onClick(button.dataset.industryFilter === "全業種" ? "" : button.dataset.industryFilter));
    });
  }

  function renderThemeFilters(container, records, activeTheme, onClick, disabled = false) {
    if (!container) {
      return;
    }
    const seen = new Set();
    const themes = [];
    records.forEach((record) => {
      (record.themes || []).forEach((theme) => {
        const label = String(theme || "").trim();
        if (!label || seen.has(label)) {
          return;
        }
        seen.add(label);
        themes.push(label);
      });
    });
    const options = ["全テーマ", ...themes];
    container.innerHTML = options.length
      ? options
          .map(
            (theme) =>
              `<button type="button" class="chip filter-chip${(!activeTheme && theme === "全テーマ") || theme === activeTheme ? " active" : ""}${disabled && theme !== "全テーマ" ? " disabled" : ""}" data-theme-filter="${escapeHtml(theme)}"${disabled && theme !== "全テーマ" ? " disabled" : ""}>${escapeHtml(theme)}</button>`
          )
          .join("")
      : '<span class="subtle">テーマがありません。</span>';

    Array.from(container.querySelectorAll("button[data-theme-filter]")).forEach((button) => {
      button.addEventListener("click", () => onClick(button.dataset.themeFilter === "全テーマ" ? "" : button.dataset.themeFilter));
    });
  }

  function renderMarketFilters(container, records, activeMarket, onClick) {
    const markets = [...new Set(records.map((record) => record.market).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right, "ja", { sensitivity: "base" })
    );
    const options = ["全市場", ...markets];
    container.innerHTML = options.length
      ? options
          .map(
            (market) =>
              `<button type="button" class="chip filter-chip${(!activeMarket && market === "全市場") || market === activeMarket ? " active" : ""}" data-market-filter="${escapeHtml(market)}">${escapeHtml(market)}</button>`
          )
          .join("")
      : '<span class="subtle">市場区分がありません。</span>';

    Array.from(container.querySelectorAll("button[data-market-filter]")).forEach((button) => {
      button.addEventListener("click", () => onClick(button.dataset.marketFilter === "全市場" ? "" : button.dataset.marketFilter));
    });
  }

  const _chartInstances = new Map();
  const CHART_FETCH_CONCURRENCY = 8;

  function getTickerDataUrl(code) {
    return `./data/tickers/${code}.json`;
  }

  function getDataModeParam() {
    try {
      return new URLSearchParams(window.location.search).get("dataMode") || "";
    } catch (_error) {
      return "";
    }
  }

  function isLegacyDataMode() {
    return getDataModeParam() === "legacy";
  }

  function isRecentDataMode() {
    return !isLegacyDataMode();
  }

  function getRecentTickerDataUrl(code) {
    return `./data/public_json/ticker_recent/1y/ohlcv_ma/${code}.json`;
  }

  function normalizeRecentTickerPayload(code, payload) {
    const ohlcv = Array.isArray(payload) ? payload : Array.isArray(payload?.ohlcv) ? payload.ohlcv : [];
    const enrichedOhlcv = ohlcv.map((row, index) => {
      if (!row || typeof row !== "object") {
        return row;
      }
      const close = Number(row.close);
      const previousClose = index > 0 ? Number(ohlcv[index - 1]?.close) : NaN;
      const change = Number.isFinite(Number(row.change)) ? Number(row.change) : Number.isFinite(close) && Number.isFinite(previousClose) ? close - previousClose : null;
      const changePercent = Number.isFinite(Number(row.changePercent))
        ? Number(row.changePercent)
        : change != null && Number.isFinite(previousClose) && previousClose !== 0
          ? (change / previousClose) * 100
          : null;
      return {
        ...row,
        change,
        changePercent,
      };
    });
    return {
      code: String(code || payload?.code || ""),
      snapshotType: "recent_1y_ohlcv_ma",
      ohlcv: enrichedOhlcv,
    };
  }

  function summarizeTickerPayloadShape(payload) {
    const ohlcv = Array.isArray(payload?.ohlcv) ? payload.ohlcv : [];
    const sampleRow = ohlcv.find((row) => row && typeof row === "object") || null;
    return {
      topLevelKeys: Object.keys(payload || {}).sort(),
      rowKeys: sampleRow ? Object.keys(sampleRow).sort() : [],
      snapshotDate: payload?.snapshotDate || null,
      snapshotType: payload?.snapshotType || null,
      candleCount: ohlcv.length,
    };
  }

  function diffShapeAgainstBaseline(baseline, current) {
    if (!baseline) {
      return null;
    }
    return {
      missingTopLevelKeys: baseline.topLevelKeys.filter((key) => !current.topLevelKeys.includes(key)),
      extraTopLevelKeys: current.topLevelKeys.filter((key) => !baseline.topLevelKeys.includes(key)),
      missingRowKeys: baseline.rowKeys.filter((key) => !current.rowKeys.includes(key)),
      extraRowKeys: current.rowKeys.filter((key) => !baseline.rowKeys.includes(key)),
    };
  }

  function validateTickerPayloadForChart(payload, selectedDate) {
    const issues = [];
    const warnings = [];
    const reasonCodes = [];
    const ohlcv = Array.isArray(payload?.ohlcv) ? payload.ohlcv : [];
    if (!ohlcv.length) {
      warnings.push("ohlcv missing or empty");
      reasonCodes.push("NO_OHLCV");
      return { issues, warnings, reasonCodes, parsedCandleCount: 0, invalidRowCount: 0, hasSelectedDate: false, selectedDateMissing: false };
    }
    const invalidRows = ohlcv.filter(
      (row) => !row || row.date == null || row.open == null || row.high == null || row.low == null || row.close == null || row.volume == null
    );
    if (invalidRows.length) {
      issues.push(`ohlcv contains ${invalidRows.length} invalid rows`);
      reasonCodes.push("PARSE_FAIL");
    }
    const hasSelectedDate = ohlcv.some((row) => row?.date === selectedDate);
    if (selectedDate && !hasSelectedDate) {
      warnings.push(`selected date ${selectedDate} missing`);
      reasonCodes.push("STALE_ND");
    }
    return {
      issues,
      warnings,
      reasonCodes,
      parsedCandleCount: ohlcv.length,
      invalidRowCount: invalidRows.length,
      hasSelectedDate,
      selectedDateMissing: Boolean(selectedDate && !hasSelectedDate),
    };
  }

  async function loadTickerPayloadWithDiagnostics(code, options = {}) {
    const requestUrl = getTickerDataUrl(code);
    let response;
    let responseBody = "";
    try {
      response = await fetch(requestUrl, { cache: "no-store" });
      if (!response.ok && response.status === 404 && shouldUseDesktopPortFallback(requestUrl)) {
        const fallbackUrl = buildDesktopPortFallbackUrl(requestUrl);
        if (fallbackUrl && fallbackUrl !== requestUrl) {
          response = await fetch(fallbackUrl, { cache: "no-store" });
        }
      }
      responseBody = await response.text();
      console.debug("[ticker-chart:response]", {
        code,
        requestUrl,
        status: response.status,
        responseBody: responseBody.slice(0, 1200),
      });
      if (!response.ok) {
        throw new Error(`JSON 読み込み失敗: ${requestUrl} (${response.status})`);
      }
      const payload = JSON.parse(responseBody);
      const validation = validateTickerPayloadForChart(payload, options.selectedDate);
      console.debug("[ticker-chart:payload]", {
        code,
        requestUrl,
        status: response.status,
        parsedCandleCount: validation.parsedCandleCount,
        invalidRowCount: validation.invalidRowCount,
        hasSelectedDate: validation.hasSelectedDate,
        warnings: validation.warnings,
        snapshotDate: payload?.snapshotDate ?? null,
        snapshotType: payload?.snapshotType ?? null,
      });
      return {
        code,
        requestUrl,
        status: response.status,
        responseBody,
        payload,
        validation,
        chartPayload: payload,
        shape: summarizeTickerPayloadShape(payload),
      };
    } catch (error) {
      console.debug("[ticker-chart:error]", {
        code,
        requestUrl,
        status: response?.status ?? null,
        responseBody: responseBody.slice(0, 1200),
        parsedCandleCount: 0,
        message: error.message,
      });
      throw error;
    }
  }

  async function loadRecentTickerForChart(code, options = {}) {
    const requestUrl = getRecentTickerDataUrl(code);
    let responseBody = "";
    try {
      const rawPayload = await fetchJson(requestUrl);
      responseBody = JSON.stringify(rawPayload);
      const payload = normalizeRecentTickerPayload(code, rawPayload);
      const validation = validateTickerPayloadForChart(payload, options.selectedDate);
      if (!validation.parsedCandleCount) {
        throw new Error("ohlcv missing or empty");
      }
      if (validation.issues.length) {
        throw new Error(validation.issues.join(", "));
      }
      if (validation.selectedDateMissing && !options.allowStaleSelectedDate) {
        throw new Error(`selected date ${options.selectedDate} missing`);
      }
      return {
        code,
        requestUrl,
        status: 200,
        responseBody,
        payload,
        validation,
        chartPayload: payload,
        shape: summarizeTickerPayloadShape(payload),
      };
    } catch (error) {
      error.recentFallbackReason = error.message || String(error);
      throw error;
    }
  }

  async function loadTickerForChartWithFallback(code, options = {}) {
    if (isLegacyDataMode()) {
      try {
        return await loadTickerPayloadWithDiagnostics(code, options);
      } catch (legacyError) {
        const reason = legacyError?.message || String(legacyError);
        console.warn("[ticker-chart:legacy:missing]", { code, reason });
        const recentInspected = await loadRecentTickerForChart(code, options);
        return {
          ...recentInspected,
          chartSource: "recent-legacy-fallback",
          fallbackReason: reason,
        };
      }
    }
    try {
      const recentInspected = await loadRecentTickerForChart(code, options);
      console.info("[ticker-chart:recent]", {
        code,
        requestUrl: recentInspected.requestUrl,
        parsedCandleCount: recentInspected.validation.parsedCandleCount,
      });
      return {
        ...recentInspected,
        chartSource: "recent",
      };
    } catch (error) {
      const reason = error?.recentFallbackReason || error?.message || String(error);
      console.info("[ticker-chart:recent:fallback]", { code, reason });
      try {
        const recentInspected = await loadRecentTickerForChart(code, { ...options, selectedDate: "", allowStaleSelectedDate: true });
        return {
          ...recentInspected,
          chartSource: "recent-stale-fallback",
          fallbackReason: reason,
        };
      } catch (staleError) {
        const staleReason = staleError?.recentFallbackReason || staleError?.message || String(staleError);
        console.info("[ticker-chart:legacy:fallback]", { code, reason: staleReason });
        const legacyInspected = await loadTickerPayloadWithDiagnostics(code, { ...options, allowStaleSelectedDate: true });
        return {
          ...legacyInspected,
          chartSource: "legacy-recent-fallback",
          fallbackReason: `${reason}; ${staleReason}`,
        };
      }
    }
  }

  async function mapWithConcurrency(items, limit, iteratee) {
    const results = new Array(items.length);
    let cursor = 0;
    async function worker() {
      while (cursor < items.length) {
        const currentIndex = cursor;
        cursor += 1;
        results[currentIndex] = await iteratee(items[currentIndex], currentIndex);
      }
    }
    const workerCount = Math.max(1, Math.min(limit, items.length));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }

  function renderChartFailure(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) {
      return;
    }
    if (_chartInstances.has(elementId)) {
      try {
        _chartInstances.get(elementId).remove();
      } catch (_) {}
      _chartInstances.delete(elementId);
    }
    element.innerHTML = `<div class="chart-inline-error">データ取得失敗<br /><span>${escapeHtml(message)}</span></div>`;
  }

  function renderChartStatus(elementId, title, message, statusClass = "") {
    const element = document.getElementById(elementId);
    if (!element) {
      return;
    }
    if (_chartInstances.has(elementId)) {
      try {
        _chartInstances.get(elementId).remove();
      } catch (_) {}
      _chartInstances.delete(elementId);
    }
    const className = ["chart-inline-error", statusClass].filter(Boolean).join(" ");
    element.innerHTML = `<div class="${className}">${escapeHtml(title)}<br /><span>${escapeHtml(message)}</span></div>`;
  }

  function renderChartFetchFailedItem(code, name, index, state, options = {}) {
    const rank = index + 1;
    const links = options.linksMarkup || "";
    const actionMarkup = options.actionMarkup || "";
    const failureMessage = String(options.message || "JSON を確認してください");
    const detailHref = buildTickerUrl(code, state.selectedDate, "");
    const tableLabels = options.english
      ? {
          rank: "Rank",
          code: "Code",
          close: "Price",
          change: "Change",
          volume: "Volume",
          high: "High",
          low: "Low",
        }
      : {
          rank: "順位",
          code: "コード",
          close: "取引値",
          change: "前日比",
          volume: "出来高",
          high: "高値",
          low: "安値",
        };
    return `
      <article class="scanner-item scanner-item--fetch-failed">
        <div class="scanner-rank-table">
          <table>
            <thead>
              <tr>
                <th class="num scanner-col-rank">${tableLabels.rank}</th>
                <th class="scanner-col-code">${tableLabels.code}</th>
                <th class="num scanner-col-close">${tableLabels.close}</th>
                <th class="num scanner-col-change">${tableLabels.change}</th>
                <th class="num scanner-col-volume">${tableLabels.volume}</th>
                <th class="num scanner-col-high">${tableLabels.high}</th>
                <th class="num scanner-col-low">${tableLabels.low}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="num">${formatNumber(rank, 0)}</td>
                <td class="scanner-name-cell">
                  <div class="scanner-name-cell-inner">
                    ${renderTickerIdentity(code, name, { href: detailHref, variant: "scanner" })}
                  </div>
                </td>
                <td class="num">-</td>
                <td class="num">-</td>
                <td class="num">-</td>
                <td class="num">-</td>
                <td class="num">-</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="scanner-item-chart-wrap">
          <div class="chart-inline-error">データ取得失敗<br /><span>${escapeHtml(failureMessage)}</span></div>
        </div>
        <div class="scanner-item-links${options.picked ? " scanner-item-links--picked" : ""}">
          <div class="scanner-item-links-main${options.picked ? " scanner-item-links-main--picked" : ""}">${links}</div>
          ${actionMarkup}
        </div>
      </article>
    `;
  }

  function compareRecords(left, right, key, direction) {
    const leftValue = left[key];
    const rightValue = right[key];
    const base =
      typeof leftValue === "number" || typeof rightValue === "number"
        ? compareNullableNumbers(leftValue, rightValue)
        : String(leftValue || "").localeCompare(String(rightValue || ""), "ja", { numeric: true, sensitivity: "base" });
    return direction === "asc" ? base : -base;
  }

  function compareRecordSet(left, right, state) {
    if (state.activeType && state.sortMode === "type") {
      return compareByType(left, right, state.activeType);
    }
    return compareRecords(left, right, state.sortKey, state.sortDirection);
  }

  function compareByType(left, right, activeType) {
    if (activeType === "new_high") {
      const leftFlag = left.newHigh52w ? 1 : 0;
      const rightFlag = right.newHigh52w ? 1 : 0;
      return (
        compareNullableNumbers(rightFlag, leftFlag) ||
        compareNullableNumbers(right.changePercent, left.changePercent) ||
        compareNullableNumbers(right.distanceToMa25, left.distanceToMa25) ||
        String(left.ticker || left.code || "").localeCompare(String(right.ticker || right.code || ""), "ja", {
          numeric: true,
          sensitivity: "base",
        })
      );
    }
    const spec = deriveTypeSort(activeType);
    if (!spec) {
      return 0;
    }
    return compareRecords(left, right, spec.key, spec.direction);
  }

  function deriveTypeSort(activeType) {
    return {
      gainers: { key: "changePercent", direction: "desc" },
      losers: { key: "changePercent", direction: "asc" },
      deviation25: { key: "distanceToMa25", direction: "desc" },
      deviation75: { key: "distanceToMa75", direction: "desc" },
      deviation200: { key: "distanceToMa200", direction: "desc" },
    }[activeType] || null;
  }

  function compareNullableNumbers(leftValue, rightValue) {
    if (leftValue == null && rightValue == null) {
      return 0;
    }
    if (leftValue == null) {
      return 1;
    }
    if (rightValue == null) {
      return -1;
    }
    return leftValue - rightValue;
  }

  function computeLowerShadowMetrics(record) {
    if ([record.open, record.high, record.low, record.close].some((value) => value == null)) {
      return {
        body: null,
        lowerShadow: null,
        upperShadow: null,
        range: null,
        lowerShadowRatio: null,
        isLowerShadow: false,
        shadowStrength: "none",
        reason: "missing OHLC",
        strengthPriority: 3,
      };
    }
    const open = Number(record.open);
    const high = Number(record.high);
    const low = Number(record.low);
    const close = Number(record.close);
    if ([open, high, low, close].some((value) => Number.isNaN(value))) {
      return {
        body: null,
        lowerShadow: null,
        upperShadow: null,
        range: null,
        lowerShadowRatio: null,
        isLowerShadow: false,
        shadowStrength: "none",
        reason: "missing OHLC",
        strengthPriority: 3,
      };
    }
    const range = high - low;
    if (!(range > 0)) {
      return {
        body: Math.abs(close - open),
        lowerShadow: Math.min(open, close) - low,
        upperShadow: high - Math.max(open, close),
        range,
        lowerShadowRatio: null,
        isLowerShadow: false,
        shadowStrength: "none",
        reason: "range is zero",
        strengthPriority: 3,
      };
    }
    const body = Math.abs(close - open);
    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const lowerShadow = bodyLow - low;
    const upperShadow = high - bodyHigh;
    const lowerShadowRatio = lowerShadow / range;
    if (!(lowerShadow > 0)) {
      return {
        body,
        lowerShadow,
        upperShadow,
        range,
        lowerShadowRatio,
        isLowerShadow: false,
        shadowStrength: "none",
        reason: "no lower shadow",
        strengthPriority: 3,
      };
    }

    let shadowStrength = "none";
    let strengthPriority = 3;
    if (lowerShadow >= body * 3.0 && lowerShadowRatio >= 0.45 && upperShadow <= lowerShadow * 0.6) {
      shadowStrength = "strong";
      strengthPriority = 0;
    } else if (lowerShadow >= body * 2.0 && lowerShadowRatio >= 0.35) {
      shadowStrength = "medium";
      strengthPriority = 1;
    } else if (lowerShadow >= body * 1.2 && lowerShadowRatio >= 0.25) {
      shadowStrength = "weak";
      strengthPriority = 2;
    }

    const isLowerShadow =
      lowerShadow > 0 &&
      range > 0 &&
      lowerShadow >= body * 2.0 &&
      lowerShadowRatio >= 0.35 &&
      upperShadow <= lowerShadow * 0.8;

    let reason = "does not meet lower shadow rule";
    if (isLowerShadow) {
      reason =
        shadowStrength === "strong"
          ? "strong: lower shadow dominates with small upper shadow"
          : "medium: long lower shadow and clear rebound shape";
    } else if (shadowStrength === "weak") {
      reason = "weak lower shadow only";
    } else if (!(lowerShadow >= body * 2.0)) {
      reason = "lower shadow too short vs body";
    } else if (!(lowerShadowRatio >= 0.35)) {
      reason = "lower shadow ratio too small";
    } else if (!(upperShadow <= lowerShadow * 0.8)) {
      reason = "upper shadow too large";
    } else {
      reason = "does not meet lower shadow rule";
    }

    return {
      body,
      lowerShadow,
      upperShadow,
      range,
      lowerShadowRatio,
      isLowerShadow,
      shadowStrength,
      reason,
      strengthPriority,
    };
  }

  function isLowerShadowCandidate(record) {
    return Boolean(computeLowerShadowMetrics(record)?.isLowerShadow);
  }

  function compareLowerShadowRecords(left, right) {
    const leftMetrics = computeLowerShadowMetrics(left);
    const rightMetrics = computeLowerShadowMetrics(right);
    return (
      compareNullableNumbers(leftMetrics.strengthPriority, rightMetrics.strengthPriority) ||
      compareNullableNumbers(rightMetrics.lowerShadowRatio, leftMetrics.lowerShadowRatio) ||
      compareNullableNumbers(rightMetrics.lowerShadow, leftMetrics.lowerShadow) ||
      String(left.code).localeCompare(String(right.code), "ja", { numeric: true, sensitivity: "base" })
    );
  }

  function average(values) {
    if (!values.length) {
      return null;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  function updatePeriodButtonState(container, selectedMode) {
    Array.from(container.querySelectorAll(".period-button")).forEach((button) => {
      button.classList.toggle("active", button.dataset.chartMode === selectedMode);
    });
  }

  function showError(element, message) {
    element.textContent = message;
    element.hidden = false;
    if (element.scrollIntoView) {
      element.scrollIntoView({ block: "nearest" });
    }
  }


  function formatSignedPercentHtml(value, options = {}) {
    const className = getChangeClass(value);
    const text = formatSignedPercent(value);
    const wrapped = options.withParens ? `(${text})` : text;
    if (!className) {
      return escapeHtml(wrapped);
    }
    return `<span class="${className}">${escapeHtml(wrapped)}</span>`;
  }

  function formatRatioCount(count, total) {
    if (!total) {
      return "-";
    }
    return `${formatNumber(count, 0)} / ${formatNumber(total, 0)} (${((count / total) * 100).toFixed(1)}%)`;
  }

  function getChangeClass(value) {
    if (value > 0) {
      return "rise";
    }
    if (value < 0) {
      return "fall";
    }
    return "";
  }

  function getSignedValueClass(value) {
    if (value == null || Number.isNaN(value)) {
      return "";
    }
    if (value > 0) {
      return "rise";
    }
    if (value < 0) {
      return "fall";
    }
    return "";
  }

  function renderRankingTable(container, label, rankingKey, selectedDate, records) {
    if (!container) {
      return;
    }
    container.innerHTML = records.length
      ? `<table class="ranking-list"><tbody>${records
          .map((record) => {
            const detailUrl = buildTickerUrl(record.code, selectedDate, rankingKey);
            return `
              <tr>
                <td>${record.rank}</td>
                <td>${renderTickerIdentity(record.code, record.name, { href: detailUrl, variant: "ranking", compact: true })}</td>
                <td class="${getChangeClass(record.changePercent)}">${formatSignedPercent(record.changePercent)}</td>
                <td>${formatRankingValue(label, record)}</td>
              </tr>
            `;
          })
          .join("")}</tbody></table>`
      : '<div class="empty-cell">表示データなし</div>';
  }

  function formatRankingValue(label, record) {
    if (label === "出来高増加") {
      return formatRatio(record.volumeRatio25);
    }
    if (label === "下ひげ") {
      if (record.shadowStrength && record.shadowStrength !== "none" && record.lowerShadowRatio != null) {
        return `${record.shadowStrength} ${formatPercent(Number(record.lowerShadowRatio) * 100)}`;
      }
      return "-";
    }
    if (label === "25日線乖離") {
      return formatSignedPercent(record.distanceToMa25);
    }
    if (label === "75日線乖離") {
      return formatSignedPercent(record.distanceToMa75);
    }
    if (label === "200日線乖離") {
      return formatSignedPercent(record.distanceToMa200);
    }
    return formatNumber(record.close);
  }

  function summarizeGroups(records, groupKey, valueKey) {
    const groups = new Map();
    records.forEach((record) => {
      const label = record[groupKey] || record.market || "未分類";
      const value = record[valueKey];
      if (value == null) {
        return;
      }
      if (!groups.has(label)) {
        groups.set(label, { label, count: 0, total: 0 });
      }
      const current = groups.get(label);
      current.count += 1;
      current.total += value;
    });
    return [...groups.values()]
      .map((item) => ({ ...item, value: item.total / item.count }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 12);
  }

  function summarizeTagCounts(records) {
    const counts = new Map();
    records.forEach((record) => {
      (record.tags || []).forEach((tag) => {
        const normalizedTag = String(tag || "").trim();
        if (!normalizedTag || MARKET_TAGS.has(normalizedTag)) {
          return;
        }
        counts.set(normalizedTag, (counts.get(normalizedTag) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ja"))
      .slice(0, 12);
  }

  function renderBreadthList(container, items, formatter) {
    if (!container) {
      return;
    }
    container.innerHTML = items.length
      ? items
          .map((item) => {
            const view = formatter(item);
            return `
              <div class="breadth-item">
                <div class="breadth-item-label">${escapeHtml(view.label)}</div>
                <div class="breadth-item-value ${escapeHtml(view.className || "")}">${escapeHtml(view.value)}</div>
              </div>
            `;
          })
          .join("")
      : '<div class="empty-cell">表示データなし</div>';
  }

  function renderMiniCalendar(container, date, selectedDate, availableDates = [], onSelect = null, options = {}) {
    if (!container) {
      return;
    }
    const year = date.getFullYear();
    const month = date.getMonth();
    const selected = parseDate(selectedDate);
    const availableDateSet = new Set(availableDates);
    const minMonth = options.minMonth ? startOfMonth(options.minMonth) : null;
    const maxMonth = options.maxMonth ? startOfMonth(options.maxMonth) : null;
    const currentMonth = startOfMonth(date);
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startWeekday = first.getDay();
    const cells = [];
    for (let index = 0; index < startWeekday; index += 1) {
      cells.push("");
    }
    for (let day = 1; day <= last.getDate(); day += 1) {
      cells.push(String(day));
    }
    while (cells.length % 7 !== 0) {
      cells.push("");
    }
    const rows = [];
    for (let index = 0; index < cells.length; index += 7) {
      rows.push(cells.slice(index, index + 7));
    }
    container.innerHTML = `
      <div class="mini-calendar-head">
        <button type="button" class="mini-calendar-nav" data-calendar-nav="prev"${minMonth && currentMonth <= minMonth ? " disabled" : ""}>&lt;</button>
        <div class="mini-calendar-month">${year}年${month + 1}月</div>
        <button type="button" class="mini-calendar-nav" data-calendar-nav="next"${maxMonth && currentMonth >= maxMonth ? " disabled" : ""}>&gt;</button>
      </div>
      <table class="mini-calendar">
        <thead>
          <tr><th>日</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th>土</th></tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row, rowIndex) =>
                `<tr>${row
                  .map((cell, colIndex) => {
                    if (!cell) {
                      return "<td></td>";
                    }
                    const cellDate = new Date(year, month, Number(cell));
                    const cellDateKey = formatDateKey(cellDate);
                    const weekday = cellDate.getDay();
                    const isSelected =
                      selected.getFullYear() === year &&
                      selected.getMonth() === month &&
                      selected.getDate() === Number(cell);
                    const isHoliday = isJapaneseHoliday(cellDate);
                    const isSaturday = weekday === 6;
                    const isSunday = weekday === 0;
                    const isSelectable = availableDateSet.has(cellDateKey);
                    const className = [
                      isSelected ? "active-day" : "",
                      isHoliday || isSunday ? "holiday" : "",
                      isSaturday ? "saturday" : "",
                      !isSelectable ? "disabled-day" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return `<td class="${className}">${
                      isSelectable
                        ? `<button type="button" class="mini-calendar-button selectable-day-button" data-date="${cellDateKey}">${cell}</button>`
                        : `<span class="mini-calendar-label">${cell}</span>`
                    }</td>`;
                  })
                  .join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;

    if (typeof onSelect === "function") {
      Array.from(container.querySelectorAll("button[data-date]")).forEach((button) => {
        button.addEventListener("click", () => onSelect(button.dataset.date));
      });
    }
    const prevMonthButton = container.querySelector("button[data-calendar-nav='prev']");
    const nextMonthButton = container.querySelector("button[data-calendar-nav='next']");
    if (prevMonthButton && typeof options.onPrevMonth === "function" && !prevMonthButton.disabled) {
      prevMonthButton.addEventListener("click", options.onPrevMonth);
    }
    if (nextMonthButton && typeof options.onNextMonth === "function" && !nextMonthButton.disabled) {
      nextMonthButton.addEventListener("click", options.onNextMonth);
    }
  }

  function sortScannerRecords(records, sortKey) {
    const items = [...records];
    const rankingSort = INDEX_SCANNER_RANKING_SORTS?.[sortKey];
    if (rankingSort?.key) {
      const direction = rankingSort.direction === "asc" ? "asc" : "desc";
      return items.sort((a, b) => {
        const leftValue = a[rankingSort.key];
        const rightValue = b[rankingSort.key];
        const leftMissing = leftValue == null;
        const rightMissing = rightValue == null;
        if (leftMissing || rightMissing) {
          return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1;
        }
        const compared = direction === "asc"
          ? compareNullableNumbers(leftValue, rightValue)
          : compareNullableNumbers(rightValue, leftValue);
        return compared || String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" });
      });
    }
    if (sortKey === "stop_high") {
      return items.sort(
        (a, b) =>
          compareNullableNumbers(b.changePercent, a.changePercent) ||
          compareNullableNumbers(b.volumeRatio25, a.volumeRatio25) ||
          String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" })
      );
    }
    if (sortKey === "losers") {
      return items.sort((a, b) => compareNullableNumbers(a.changePercent, b.changePercent));
    }
    if (sortKey === "new_high") {
      return items.sort(
        (a, b) =>
          compareNullableNumbers(b.newHigh52w ? 1 : 0, a.newHigh52w ? 1 : 0) ||
          compareNullableNumbers(b.changePercent, a.changePercent) ||
          compareNullableNumbers(b.distanceToMa25, a.distanceToMa25) ||
          String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" })
      );
    }
    if (sortKey === "new_high_20d") {
      return items.sort(
        (a, b) =>
          compareNullableNumbers(b.newHigh20d ? 1 : 0, a.newHigh20d ? 1 : 0) ||
          compareNullableNumbers(b.changePercent, a.changePercent) ||
          compareNullableNumbers(b.volumeRatio25, a.volumeRatio25) ||
          String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" })
      );
    }
    if (sortKey === "bullish_close_breakout_20d") {
      return items.sort(
        (a, b) =>
          compareNullableNumbers(b.bullishCloseBreakout20d ? 1 : 0, a.bullishCloseBreakout20d ? 1 : 0) ||
          compareNullableNumbers(b.changePercent, a.changePercent) ||
          compareNullableNumbers(b.volumeRatio25, a.volumeRatio25) ||
          String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" })
      );
    }
    if (sortKey === "trend_turn") {
      return items.sort(
        (a, b) =>
          compareNullableNumbers(a.trendTurnRangePct, b.trendTurnRangePct) ||
          compareNullableNumbers(Math.abs(a.distanceToMa200 || 0), Math.abs(b.distanceToMa200 || 0)) ||
          compareNullableNumbers(b.volumeRatio25, a.volumeRatio25) ||
          compareNullableNumbers(b.changePercent, a.changePercent) ||
          String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" })
      );
    }
    if (sortKey === "rebound_signal") {
      const priority = {
        strong_rebound: 0,
        rebound_candidate: 1,
        lower_wick_only: 2,
      };
      return items.sort(
        (a, b) =>
          compareNullableNumbers(
            -(priority[String(a.signalCategory || "")] ?? 9),
            -(priority[String(b.signalCategory || "")] ?? 9)
          ) ||
          compareNullableNumbers(b.changePercent, a.changePercent) ||
          compareNullableNumbers(b.volumeRatio25, a.volumeRatio25) ||
          String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" })
      );
    }
    if (sortKey === "lower_shadow") {
      return items.sort(compareLowerShadowRecords);
    }
    if (sortKey === "watch_candidates") {
      return items.sort((a, b) => compareNullableNumbers(b.watchCandidateScore, a.watchCandidateScore));
    }
    if (sortKey === "strategy_high_pullback_30") {
      const highPullbackMetrics = (record) => record?.strategyMetrics?.high_pullback_30 || record?.highPullback30 || {};
      const highPullbackDropRate = (record) => record?.highPullback30DropRate ?? highPullbackMetrics(record).dropRate;
      const highPullbackDropDistance = (record) => {
        const dropRate = Number(highPullbackDropRate(record));
        return Number.isFinite(dropRate) ? Math.abs(dropRate - 30) : null;
      };
      return items.sort(
        (a, b) =>
          compareNullableNumbers(highPullbackDropDistance(a), highPullbackDropDistance(b)) ||
          compareNullableNumbers(highPullbackDropRate(b), highPullbackDropRate(a)) ||
          compareNullableNumbers(a.changePercent, b.changePercent) ||
          String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" })
      );
    }
    if (sortKey === "strategy_strong_trend_pullback_rebound") {
      const strategyId = "strong_trend_pullback_rebound";
      return items.sort(
        (a, b) =>
          compareNullableNumbers(
            Number((b.strategyScores || {})[strategyId] || b.strongTrendPullbackReboundScore || 0),
            Number((a.strategyScores || {})[strategyId] || a.strongTrendPullbackReboundScore || 0)
          ) ||
          compareNullableNumbers(b.changePercent, a.changePercent) ||
          compareNullableNumbers(b.volumeRatio25, a.volumeRatio25) ||
          String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" })
      );
    }
    const strategySortMap = {
      strategy_minervini: "minervini_trend_template",
      strategy_stage2: "stan_weinstein_stage2",
      strategy_turtle: "turtle_donchian_breakout",
      strategy_canslim: "can_slim",
      strategy_rsi2: "rsi2_pullback",
    };
    if (strategySortMap[sortKey]) {
      const strategyId = strategySortMap[sortKey];
      return items.sort(
        (a, b) =>
          compareNullableNumbers(
            Number((b.strategyScores || {})[strategyId] || 0),
            Number((a.strategyScores || {})[strategyId] || 0)
          ) ||
          compareNullableNumbers(b.changePercent, a.changePercent) ||
          compareNullableNumbers(b.volumeRatio25, a.volumeRatio25) ||
          String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" })
      );
    }
    return items.sort((a, b) => String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" }));
  }

  function getPriceLimitWidth(prevClose) {
    const price = Number(prevClose);
    if (!Number.isFinite(price) || price <= 0) {
      return null;
    }
    for (const [maxPrice, width] of JPX_PRICE_LIMIT_TABLE) {
      if (price < maxPrice) {
        return width;
      }
    }
    return null;
  }

  function getStopHighStatus(record) {
    const close = Number(record?.close);
    const high = Number(record?.high);
    const change = Number(record?.change);
    if (!Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(change)) {
      return "none";
    }
    const prevClose = close - change;
    if (!(prevClose > 0)) {
      return "none";
    }
    const limitWidth = getPriceLimitWidth(prevClose);
    if (limitWidth == null) {
      return "none";
    }
    const limitUpPrice = prevClose + limitWidth;
    const reachedLimit = Math.abs(high - limitUpPrice) <= STOP_HIGH_EPSILON;
    if (!reachedLimit) {
      return "none";
    }
    const isLock = Math.abs(close - limitUpPrice) <= STOP_HIGH_EPSILON;
    return isLock ? "lock" : "peeled";
  }

  function getStopLowStatus(record) {
    const close = Number(record?.close);
    const low = Number(record?.low);
    const change = Number(record?.change);
    if (!Number.isFinite(close) || !Number.isFinite(low) || !Number.isFinite(change)) {
      return "none";
    }
    const prevClose = close - change;
    if (!(prevClose > 0)) {
      return "none";
    }
    const limitWidth = getPriceLimitWidth(prevClose);
    if (limitWidth == null) {
      return "none";
    }
    const limitDownPrice = prevClose - limitWidth;
    const reachedLimit = Math.abs(low - limitDownPrice) <= STOP_HIGH_EPSILON;
    if (!reachedLimit) {
      return "none";
    }
    const isLock = Math.abs(close - limitDownPrice) <= STOP_HIGH_EPSILON;
    return isLock ? "lock" : "peeled";
  }

  function getLimitMoveStatus(record) {
    const stopHighStatus = getStopHighStatus(record);
    if (stopHighStatus !== "none") {
      return {
        className: stopHighStatus === "peeled" ? "scanner-limit-marker--high-peeled" : "scanner-limit-marker--high-lock",
        label: stopHighStatus === "peeled" ? "ストップ高剥がれ" : "ストップ高",
      };
    }
    const stopLowStatus = getStopLowStatus(record);
    if (stopLowStatus !== "none") {
      return {
        className: stopLowStatus === "peeled" ? "scanner-limit-marker--low-peeled" : "scanner-limit-marker--low-lock",
        label: stopLowStatus === "peeled" ? "ストップ安剥がれ" : "ストップ安",
      };
    }
    return null;
  }

  function renderLimitMoveMarker(record) {
    const status = getLimitMoveStatus(record);
    if (!status) {
      return "";
    }
    return `<span class="scanner-limit-marker ${status.className}" title="${escapeHtml(status.label)}" aria-label="${escapeHtml(status.label)}">S</span>`;
  }

  function scannerSortLabel(sortKey) {
    return {
      gainers: "Gainers",
      stop_high: "Stop High",
      losers: "Losers",
      volume: "Volume",
      code: "Code",
      new_high: "New High",
      new_high_20d: "20D Close High",
      bullish_close_breakout_20d: "陽線クローズブレイク20",
      trend_turn: "200日線回復（ベース・リカバリー）",
      rebound_signal: "Rebound",
      deviation25: "MA25 Dev",
      deviation75: "MA75 Dev",
      deviation200: "MA200 Dev",
      lower_shadow: "Lower Shadow",
      watch_candidates: "Watchlist",
      strategy_minervini: "成長ブレイク（Minervini）",
      strategy_stage2: "中期上昇入り（Stage 2）",
      strategy_turtle: "高値ブレイク（Turtle）",
      strategy_canslim: "CAN SLIM",
      strategy_rsi2: "上昇中の押し目（RSI(2)）",
      strategy_high_pullback_30: "高値調整（30% Pullback）",
      strategy_strong_trend_pullback_rebound: "強トレンド押し目リバウンド",
    }[sortKey] || sortKey;
  }

  function strategyLabel(strategyId) {
    return STRATEGY_CONFIG.find((item) => item.key === strategyId)?.label || strategyId;
  }

  function collectStrategyBadges(record) {
    const matches = Array.isArray(record?.strategyMatches) ? record.strategyMatches : [];
    return matches.map((strategyId) => ({
      id: strategyId,
      label: strategyLabel(strategyId),
      score: Number((record?.strategyScores || {})[strategyId] || 0),
    }));
  }

  function renderStrategyReasons(record, options = {}) {
    const matches = Array.isArray(record?.strategyMatches) ? record.strategyMatches : [];
    if (!matches.length) {
      return options.empty || "";
    }
    const limit = Number(options.limit || 4);
    const lines = [];
    matches.forEach((strategyId) => {
      const reasons = (record?.strategyReasons || {})[strategyId] || [];
      reasons.slice(0, limit).forEach((reason) => {
        lines.push(`<li>${escapeHtml(`${strategyLabel(strategyId)}: ${reason}`)}</li>`);
      });
    });
    if (!lines.length) {
      return options.empty || "";
    }
    return `<ul class="strategy-reason-list">${lines.join("")}</ul>`;
  }

  function renderStrategyPopoverContent(record, strategyId) {
    const reasons = (record?.strategyReasons || {})[strategyId] || [];
    const items = reasons.length
      ? reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")
      : "<li>条件情報はまだありません。</li>";
    return `
      <section class="scanner-item-strategy-panel" data-strategy-panel="${escapeHtml(strategyId)}" hidden>
        <div class="scanner-item-strategy-popover-title">${escapeHtml(strategyLabel(strategyId))}</div>
        <ul class="scanner-item-strategy-popover-list">${items}</ul>
      </section>
    `;
  }

  function strategyBadgeTone(strategyId) {
    return {
      minervini_trend_template: "minervini",
      stan_weinstein_stage2: "stage2",
      turtle_donchian_breakout: "turtle",
      can_slim: "canslim",
      rsi2_pullback: "rsi2",
    }[strategyId] || "default";
  }

  function renderStrategyBadges(record, options = {}) {
    const badges = collectStrategyBadges(record);
    if (!badges.length) {
      return options.empty || "";
    }
    return `
      <div class="strategy-badge-row">
        ${badges
          .map(
            (badge) => `
              <span class="strategy-badge-pill strategy-badge-pill--${escapeHtml(strategyBadgeTone(badge.id))}">
                ${escapeHtml(badge.label)}
              </span>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderScannerStrategyBar(record) {
    const badges = collectStrategyBadges(record);
    if (!badges.length) {
      return "";
    }
    const code = escapeHtml(String(record?.code || ""));
    return `
      <div class="scanner-item-strategy-bar" data-strategy-bar>
        <div class="scanner-item-strategy-badges" aria-label="Strategy badges">
          ${badges
            .map(
              (badge) => `
                <button
                  type="button"
                  class="scanner-item-strategy-badge scanner-item-strategy-badge--${escapeHtml(strategyBadgeTone(badge.id))}"
                  data-strategy-badge="${escapeHtml(badge.id)}"
                  data-code="${code}"
                  aria-expanded="false"
                >
                  <span class="scanner-item-strategy-badge-label">${escapeHtml(badge.label)}</span>
                </button>
              `
            )
            .join("")}
        </div>
        <div class="scanner-item-strategy-popover" data-strategy-popover hidden>
          ${badges.map((badge) => renderStrategyPopoverContent(record, badge.id)).join("")}
        </div>
      </div>
    `;
  }

  function normalizeTickerCodeForExternalLink(code) {
    return String(code || "").trim().replace(/\.T$/i, "").toUpperCase();
  }

  function buildYahooFinanceUrl(code) {
    const normalizedCode = normalizeTickerCodeForExternalLink(code);
    return normalizedCode ? `https://finance.yahoo.co.jp/quote/${encodeURIComponent(normalizedCode)}.T` : "";
  }

  function buildXSearchUrl(record) {
    const code = normalizeTickerCodeForExternalLink(record?.code);
    if (!code) {
      return "";
    }
    const name = String(record?.name || "").trim();
    const query = [code, name, "株"].filter(Boolean).join(" ");
    return `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;
  }

  function buildIrSearchUrl(record) {
    const code = normalizeTickerCodeForExternalLink(record?.code);
    if (!code) {
      return "";
    }
    return `https://kabutan.jp/stock/news?code=${encodeURIComponent(code)}&nmode=3`;
  }

  function buildNewsSearchUrl(record) {
    const code = normalizeTickerCodeForExternalLink(record?.code);
    if (!code) {
      return "";
    }
    const name = String(record?.name || "").trim();
    const query = [code, name, "ニュース"].filter(Boolean).join(" ");
    return `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
  }

  function renderScannerExternalLinks(record) {
    const links = record?.links || {};
    const items = [
      { label: "Y!", title: "Yahoo Financeで開く", href: links.quote || buildYahooFinanceUrl(record?.code), tone: "yahoo" },
      { label: "X", title: "Xで検索", href: buildXSearchUrl(record), tone: "x" },
      { label: "IR", title: "株探の会社開示情報で開く", href: buildIrSearchUrl(record), tone: "ir" },
      { label: "News", title: "ニュースを検索", href: buildNewsSearchUrl(record), tone: "news" },
    ];
    return `
      <div class="scanner-external-links" aria-label="外部情報リンク">
        ${items
          .filter((item) => item.href)
          .map(
            (item) => `
              <a
                class="scanner-external-link scanner-external-link--${escapeHtml(item.tone)}"
                href="${escapeHtml(item.href)}"
                target="_blank"
                rel="noreferrer"
                title="${escapeHtml(item.title)}"
              >${escapeHtml(item.label)}</a>
            `
          )
          .join("")}
      </div>
    `;
  }

  function filterByTurnover(records, turnoverThreshold) {
    if (!turnoverThreshold) {
      return [...records];
    }
    return records.filter((record) => {
      return Number(record.turnoverMa5 || 0) >= turnoverThreshold;
    });
  }

  function filterByMinimumClose(records, minimumClose) {
    return records.filter((record) => {
      const reasons = Array.isArray(record?.dataQuality?.reasonCodes) ? record.dataQuality.reasonCodes : [];
      if (reasons.includes("NO_OHLCV") || reasons.includes("FETCH_FAIL") || reasons.includes("PARSE_FAIL")) {
        return true;
      }
      return Number(record.close) >= minimumClose;
    });
  }

  function turnoverLabel(value) {
    return {
      0: "0",
      50000000: "50M",
      100000000: "100M",
      500000000: "500M",
      1000000000: "1B",
    }[Number(value)] || "0";
  }

  function indexScannerPeriodLabel(months) {
    return `${months}ヶ月`;
  }

  function normalizeIndexScannerRangeMonths(timeframe, value, fallback = 3) {
    const options = INDEX_SCANNER_TIMEFRAME_RANGES[timeframe] || INDEX_SCANNER_TIMEFRAME_RANGES.daily;
    const numeric = Number(value);
    if (options.some((option) => option.months === numeric)) {
      return numeric;
    }
    return options.some((option) => option.months === Number(fallback)) ? Number(fallback) : options[0].months;
  }

  function indexScannerRangeLabel(timeframe, months) {
    const option = (INDEX_SCANNER_TIMEFRAME_RANGES[timeframe] || []).find((item) => item.months === Number(months));
    return option?.label || `${months}M`;
  }

  function indexScannerTimeframeLabel(timeframe) {
    return {
      daily: "Day",
      weekly: "Week",
      monthly: "Month",
    }[timeframe] || "Day";
  }

  function renderMiniChart(elementId, rows, selectedDate, months) {
    const element = document.getElementById(elementId);
    if (!element || !window.LightweightCharts) {
      return;
    }
    if (_chartInstances.has(elementId)) {
      try { _chartInstances.get(elementId).remove(); } catch (_) {}
      _chartInstances.delete(elementId);
    }
    element.innerHTML = "";
    const selectedIndex = findSelectedIndex(rows, selectedDate);
    if (selectedIndex < 0) {
      return;
    }
    const anchorDate = parseDate(rows[selectedIndex].date);
    const cutoff = addMonths(anchorDate, -months);
    const visibleRows = rows.filter((row, index) => parseDate(row.date) >= cutoff && index <= selectedIndex + 10);
    const chart = window.LightweightCharts.createChart(element, {
      height: 280,
      layout: { background: { color: "#111827" }, textColor: "#b8c7d9" },
      rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.3 }, borderColor: "rgba(30, 58, 95, 0.4)" },
      timeScale: { borderColor: "rgba(30, 58, 95, 0.4)" },
      grid: { vertLines: { color: "rgba(30, 58, 95, 0.2)" }, horzLines: { color: "rgba(30, 58, 95, 0.2)" } },
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4444",
      downColor: "#3b82f6",
      borderVisible: false,
      wickUpColor: "#ef4444",
      wickDownColor: "#3b82f6",
    });
    candleSeries.setData(
      visibleRows.map((row) => ({
        time: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
      }))
    );
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "rgba(56, 97, 150, 0.3)",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });
    volumeSeries.setData(
      visibleRows.map((row) => ({
        time: row.date,
        value: row.volume,
        color: row.close >= row.open ? "rgba(239, 68, 68, 0.35)" : "rgba(59, 130, 246, 0.35)",
      }))
    );
    [5, 25, 75].forEach((windowSize, index) => {
      const series = chart.addLineSeries({
        color: ["#22c55e", "#f59e0b", "#a78bfa"][index],
        lineWidth: 1,
      });
      series.setData(
        visibleRows
          .map((row) => ({
            time: row.date,
            value: row[`ma${windowSize}`],
          }))
          .filter((item) => item.value != null)
      );
    });
    const timeScale = chart.timeScale();
    timeScale.fitContent();
    const visibleRange = timeScale.getVisibleLogicalRange();
    if (visibleRange) {
      timeScale.setVisibleLogicalRange({
        from: visibleRange.from,
        to: visibleRange.to + 3,
      });
    }
  }

  function buildPickedRecordFromPayload(pick, payload, selectedDate) {
    const rows = Array.isArray(payload?.ohlcv) ? payload.ohlcv : [];
    if (!rows.length) {
      return null;
    }
    const exactIndex = findSelectedIndex(rows, selectedDate);
    const selectedIndex = exactIndex >= 0 ? exactIndex : rows.length - 1;
    const row = rows[selectedIndex];
    if (!row) {
      return null;
    }
    return {
      code: String(pick.code || payload.code || ""),
      name: String(pick.name || payload.name || ""),
      market: String(pick.market || payload.market || ""),
      sector: String(payload.sector || ""),
      industry: String(payload.industry || ""),
      themes: Array.isArray(payload.themes) ? payload.themes : [],
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      links: payload.links && typeof payload.links === "object" ? payload.links : {},
      close: row.close,
      date: row.date,
      change: row.change,
      changePercent: row.changePercent,
      volume: row.volume,
      high: row.high,
      low: row.low,
    };
  }

  function buildPickedRecordFromSummary(pick, summary) {
    if (!summary || typeof summary !== "object") {
      return {
        code: String(pick.code || ""),
        name: String(pick.name || ""),
        market: String(pick.market || ""),
        sector: "",
        industry: "",
        themes: [],
        tags: [],
        links: {},
        close: null,
        change: null,
        changePercent: null,
        volume: null,
        high: null,
        low: null,
      };
    }
    return {
      code: String(pick.code || summary.code || ""),
      name: String(pick.name || summary.name || ""),
      market: String(pick.market || summary.market || ""),
      sector: String(summary.sector || ""),
      industry: String(summary.industry || ""),
      themes: Array.isArray(summary.themes) ? summary.themes : [],
      tags: Array.isArray(summary.tags) ? summary.tags : [],
      links: summary.links && typeof summary.links === "object" ? summary.links : {},
      close: summary.close ?? null,
      change: summary.change ?? null,
      changePercent: summary.changePercent ?? null,
      volume: summary.volume ?? null,
      high: summary.high ?? null,
      low: summary.low ?? null,
    };
  }

  function resolveRegisteredSelectedDate(set, manifest) {
    const candidates = [...new Set((set?.items || []).map((item) => String(item?.filterSnapshot?.date || "").trim()).filter(Boolean))].sort(
      (left, right) => right.localeCompare(left)
    );
    const requested = candidates[0] || manifest.latestDate;
    return resolveAvailableDate(requested, manifest.availableDates);
  }

  function renderRegisteredSetRow(entry) {
    const id = String(entry?.id || "");
    return `
      <div class="picked-register-item">
        <div class="picked-register-item-head">
          <div>
            <div class="picked-register-name">${escapeHtml(entry?.name || "Untitled")}</div>
            <div class="picked-register-meta">${escapeHtml(formatPickedDateTime(entry?.registeredAt))} / ${formatNumber(
              Number(entry?.count || 0),
              0
            )} picks</div>
          </div>
          <div class="picked-register-item-actions">
            <button type="button" class="row-button" data-open-registered-set="${escapeHtml(id)}">Open</button>
            <button type="button" class="row-button picked-remove-button" data-remove-registered-set="${escapeHtml(id)}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  function formatTurnoverOku(closeValue, volumeValue) {
    const close = Number(closeValue);
    const volume = Number(volumeValue);
    if (!Number.isFinite(close) || !Number.isFinite(volume) || close <= 0 || volume < 0) {
      return "-";
    }
    const oku = (close * volume) / 100000000;
    if (oku >= 100) {
      return `${formatNumber(Math.round(oku), 0)}億`;
    }
    if (oku >= 10) {
      return `${oku.toFixed(1).replace(/\.0$/, "")}億`;
    }
    return `${oku.toFixed(1)}億`;
  }

  function renderScannerCompactHeader(record, rank, state, rankingKey = "") {
    const qualityBadges = renderScannerQualityBadges(summarizeScannerRecordQuality(record, state.selectedDate));
    const detailHref = buildTickerUrl(record.code, state.selectedDate, rankingKey);
    return `
      <div class="scanner-card-header">
        <div class="scanner-card-header-left">
          <span class="scanner-card-rank">#${formatNumber(rank, 0)}</span>
          <a class="scanner-card-identity" href="${escapeHtml(detailHref)}">
            <span class="scanner-card-code">${escapeHtml(String(record.code || ""))}</span>
            <span class="scanner-card-name">${escapeHtml(String(record.name || ""))}</span>
          </a>
        </div>
        <div class="scanner-card-header-right">
          <span id="scanChange-${escapeHtml(record.code)}" class="num scanner-compact-change scanner-change-cell ${getChangeClass(record.changePercent)}">
            ${formatSignedPercentHtml(record.changePercent)}${renderLimitMoveMarker(record)}
          </span>
          <span id="scanTradePrice-${escapeHtml(record.code)}" class="scanner-card-price">${formatNumber(record.close)}円</span>
          <span id="scanTurnover-${escapeHtml(record.code)}" class="scanner-card-turnover">${formatTurnoverOku(record.close, record.volume)}</span>
          ${qualityBadges}
          <span id="scanTradeDate-${escapeHtml(record.code)}" class="scanner-trade-selected-date" hidden></span>
        </div>
      </div>
      ${renderScannerStrategyMeta(record, state)}
    `;
  }

  function renderScannerStrategyMeta(record, state) {
    return `${renderHighPullbackMeta(record, state)}${renderStrongTrendPullbackMeta(record, state)}`;
  }

  function renderHighPullbackMeta(record, state) {
    if (state?.sort !== "strategy_high_pullback_30") {
      return "";
    }
    const metrics = record?.strategyMetrics?.high_pullback_30 || {};
    const highDate = record.highPullback30HighDate || metrics.highDate;
    const lowDate = record.highPullback30LowDate || metrics.afterLowDate;
    const high = record.highPullback30Highest200 || metrics.highest200;
    const low = record.highPullback30AfterLow || metrics.afterLow;
    const dropRate = record.highPullback30DropRate ?? metrics.dropRate;
    if (!highDate || !lowDate || dropRate == null) {
      return "";
    }
    const highLabel = high != null ? `${formatScannerTradeDate(highDate)} ${formatNumber(high)}` : formatScannerTradeDate(highDate);
    const lowLabel = low != null ? `${formatScannerTradeDate(lowDate)} ${formatNumber(low)}` : formatScannerTradeDate(lowDate);
    return `
      <div class="scanner-high-pullback-meta">
        <span>高値 ${escapeHtml(highLabel)}</span>
        <span class="scanner-high-pullback-arrow">→</span>
        <span>安値 ${escapeHtml(lowLabel)}</span>
        <strong>-${formatNumber(dropRate, 1)}%</strong>
      </div>
    `;
  }

  function renderStrongTrendPullbackMeta(record, state) {
    if (state?.sort !== "strategy_strong_trend_pullback_rebound") {
      return "";
    }
    const metrics = record?.strategyMetrics?.strong_trend_pullback_rebound || {};
    const pullbackType = record.strongTrendPullbackReboundType || metrics.pullbackType;
    const typeLabel = pullbackType === "deep_reset_pullback" ? "深押しリセット" : "通常押し目";
    const risePct = record.strongTrendPullbackReboundRisePct ?? metrics.risePct;
    const dropPct = record.strongTrendPullbackReboundDropPct ?? metrics.dropPct;
    const score = record.strongTrendPullbackReboundScore ?? metrics.score;
    const volumeRatio = record.strongTrendPullbackReboundVolumeRatio20 ?? metrics.volumeRatio20;
    if (risePct == null || dropPct == null || score == null) {
      return "";
    }
    return `
      <div class="scanner-high-pullback-meta">
        <strong>${escapeHtml(typeLabel)}</strong>
        <span>上昇 +${formatNumber(risePct, 1)}%</span>
        <span>押し -${formatNumber(dropPct, 1)}%</span>
        ${volumeRatio != null ? `<span>出来高 ${formatNumber(volumeRatio, 1)}倍</span>` : ""}
        <strong>Score ${formatNumber(score, 0)}</strong>
      </div>
    `;
  }

  function renderPickedScannerItem(record, index, state) {
    const rank = index + 1;
    const cardChartTimeframe = String(state.cardChartTimeframes?.get?.(String(record.code)) || state.timeframe || "daily");
    const stopHighStatus = getStopHighStatus(record);
    const hasStopHighBadge = stopHighStatus !== "none";
    const stopHighClass = hasStopHighBadge ? " scanner-item-stop-high" : "";
    const externalLinks = renderScannerExternalLinks(record);
    return `
      <article class="scanner-item picked-scanner-item${stopHighClass}">
        ${renderScannerCompactHeader(record, rank, state, "")}
        <div class="scanner-item-chart-wrap">
          <div id="pickedChart-${escapeHtml(record.code)}" class="scanner-chart"></div>
        </div>
        <div class="scanner-item-links scanner-item-links--picked">
          <div id="pickedLinks-${escapeHtml(record.code)}" class="scanner-item-links-main scanner-item-links-main--picked">
            ${renderPickedItemLinks(record, record, state)}
          </div>
          <div class="scanner-item-links-center">${externalLinks}</div>
          ${renderScannerCardTimeframeButtons(record.code, cardChartTimeframe)}
          <button type="button" class="row-button picked-remove-button picked-card-remove picked-link-pill picked-link-pill--danger" data-remove-pick="${escapeHtml(record.code)}">Remove</button>
        </div>
      </article>
    `;
  }

  function renderRegisteredScannerItem(record, index, state) {
    const rank = index + 1;
    const cardChartTimeframe = String(state.cardChartTimeframes?.get?.(String(record.code)) || state.timeframe || "daily");
    const externalLinks = renderScannerExternalLinks(record);
    return `
      <article class="scanner-item">
        ${renderScannerCompactHeader(record, rank, state, "")}
        <div class="scanner-item-chart-wrap">
          <div id="registeredChart-${escapeHtml(record.code)}" class="scanner-chart"></div>
        </div>
        <div class="scanner-item-links">
          <div id="registeredLinks-${escapeHtml(record.code)}" class="scanner-item-links-main">
            ${renderScannerItemLinks(record, record, { selectedDate: state.selectedDate, sort: "code" })}
          </div>
          <div class="scanner-item-links-center">${externalLinks}</div>
          ${renderScannerCardTimeframeButtons(record.code, cardChartTimeframe)}
        </div>
      </article>
    `;
  }

  function renderScannerCardTimeframeButtons(code, activeTimeframe) {
    const normalizedActive = ["daily", "weekly", "monthly"].includes(activeTimeframe) ? activeTimeframe : "daily";
    return `
      <div class="scanner-card-timeframe" aria-label="チャート表示足">
        ${["daily", "weekly", "monthly"]
          .map((timeframe) => {
            const label = { daily: "日", weekly: "週", monthly: "月" }[timeframe];
            const isActive = normalizedActive === timeframe;
            return `
              <button
                type="button"
                class="scanner-card-timeframe-btn${isActive ? " is-active" : ""}"
                data-card-chart-code="${escapeHtml(code)}"
                data-card-chart-timeframe="${timeframe}"
                aria-pressed="${isActive ? "true" : "false"}"
              >${label}</button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderScannerItem(record, index, state) {
    const rank = index + 1;
    const rankingKey = state.sort === "code" ? "" : mapScannerSortToRanking(state.sort);
    const picked = Boolean(state.picks[record.code]);
    const cardChartTimeframe = String(state.cardChartTimeframes?.get?.(String(record.code)) || state.timeframe || "daily");
    const stopHighStatus = getStopHighStatus(record);
    const hasStopHighBadge = stopHighStatus !== "none";
    const stopHighClass = hasStopHighBadge ? " scanner-item-stop-high" : "";
    const pickedClass = picked ? " scanner-item-picked" : "";
    const externalLinks = renderScannerExternalLinks(record);
    return `
      <article class="scanner-item${stopHighClass}${pickedClass}" data-scanner-card-code="${escapeHtml(record.code)}">
        ${renderScannerCompactHeader(record, rank, state, rankingKey)}
        <div class="scanner-item-chart-wrap" data-pick-chart-code="${escapeHtml(record.code)}">
          <div id="scanChart-${escapeHtml(record.code)}" class="scanner-chart"></div>
        </div>
        <div class="scanner-item-links">
          <div id="scanLinks-${escapeHtml(record.code)}" class="scanner-item-links-main">
            ${renderScannerItemLinks(record, record, state)}
          </div>
          <div class="scanner-item-links-center">${externalLinks}</div>
          ${renderScannerCardTimeframeButtons(record.code, cardChartTimeframe)}
          <label class="scanner-pick-toggle${picked ? " is-picked" : ""}" title="${picked ? "Listから外す" : "Listに追加"}">
            <input
              type="checkbox"
              data-pick-code="${escapeHtml(record.code)}"
              aria-label="${picked ? "Listから外す" : "Listに追加"}"
              ${picked ? " checked" : ""}
            />
            <span class="scanner-pick-icon" aria-hidden="true">${picked ? "★" : "☆"}</span>
            <span class="scanner-pick-label">${picked ? "Pick済" : "Pick"}</span>
          </label>
        </div>
      </article>
    `;
  }

  function renderScannerItemLinks(payload, record, state) {
    const rankingKey = state.sort === "code" ? "" : mapScannerSortToRanking(state.sort);
    const items = [
      {
        label: "Detail",
        href: buildTickerUrl(record.code, state.selectedDate, rankingKey),
        local: true,
      },
    ];
    return items
      .filter((item) => item.href)
      .map((item) =>
        item.local
          ? `<a href="${item.href}">${escapeHtml(item.label)}</a>`
          : `<a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>`
      )
      .join('<span class="scanner-link-separator">|</span>');
  }

  function summarizeScannerRecordQuality(record, selectedDate) {
    const quality = record && typeof record.dataQuality === "object" ? record.dataQuality : {};
    const reasonCodes = Array.isArray(quality.reasonCodes) ? [...new Set(quality.reasonCodes.map((item) => String(item || "").trim()).filter(Boolean))] : [];
    const staleBusinessDays = Number.isFinite(Number(quality.staleBusinessDays)) ? Number(quality.staleBusinessDays) : 0;
    const fallbackLastDataDate = String(record?.date || "").trim();
    const lastDataDate = String(quality.lastDataDate || fallbackLastDataDate || "").trim();
    const isStale = reasonCodes.includes("STALE_ND") && staleBusinessDays > Number(STALE_TOLERANCE_BUSINESS_DAYS || 1);
    return {
      lastDataDate,
      reasonCodes,
      staleBusinessDays,
      isStale,
      selectedDate: String(selectedDate || "").trim(),
    };
  }

  function renderScannerQualityBadges(quality) {
    const badges = [];
    if (quality.isStale) {
      badges.push(`<span class="scanner-quality-badge scanner-quality-badge--stale">遅延</span>`);
    }
    quality.reasonCodes.forEach((reasonCode) => {
      if (reasonCode === "STALE_ND") {
        return;
      }
      badges.push(`<span class="scanner-quality-badge scanner-quality-badge--reason">${escapeHtml(reasonCode)}</span>`);
    });
    if (!badges.length) {
      return "";
    }
    return `<span class="scanner-quality-badges">${badges.join("")}</span>`;
  }

  function renderPickedItemLinks(payload, record, state) {
    const items = [
      {
        label: "Detail",
        href: buildTickerUrl(record.code, state.selectedDate, ""),
        local: true,
      },
    ];
    return items
      .filter((item) => item.href)
      .map((item) =>
        item.local
          ? `<a href="${item.href}">${escapeHtml(item.label)}</a>`
          : `<a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>`
      )
      .join('<span class="scanner-link-separator">|</span>');
  }

  function abbreviateTickerName(name) {
    const fullName = String(name || "").trim();
    if (!fullName) {
      return "";
    }
    const exactAlias = TICKER_NAME_EXACT_ALIASES.get(fullName);
    if (exactAlias) {
      return exactAlias;
    }
    return TICKER_NAME_REPLACEMENTS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), fullName);
  }

  function renderTickerIdentity(code, name, options = {}) {
    const codeText = String(code || "").trim();
    const fullName = String(name || codeText || "-").trim() || "-";
    const shortName = abbreviateTickerName(fullName) || fullName;
    const variant = options.variant || "default";
    const compact = Boolean(options.compact);
    const overlay = Boolean(options.overlay);
    const showCode = options.showCode !== false;
    const href = options.href || "";
    const title = escapeHtml(fullName);
    const identityClasses = [
      "tickerIdentity",
      "ticker-identity",
      `tickerIdentity--${variant}`,
      compact ? "tickerCompact" : "",
      overlay ? "tickerOverlay" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const nameClasses = ["tickerName", "ticker-name", compact ? "tickerName--compact" : ""].filter(Boolean).join(" ");
    const nameMarkup = href
      ? `<a class="${nameClasses}" href="${href}" title="${title}" data-full-name="${title}">${escapeHtml(shortName)}</a>`
      : `<span class="${nameClasses}" title="${title}" data-full-name="${title}">${escapeHtml(shortName)}</span>`;
    return `
      <div class="${identityClasses}" data-full-name="${title}">
        ${showCode ? `<span class="tickerCode ticker-code">${escapeHtml(codeText || "-")}</span>` : ""}
        ${nameMarkup}
        <span class="tickerTooltip ticker-tooltip" role="tooltip">${title}</span>
      </div>
    `;
  }

  function scannerNameClass(name) {
    const length = String(name || "").length;
    if (length >= 21) {
      return "scanner-name-link scanner-name-link--tight";
    }
    if (length >= 13) {
      return "scanner-name-link scanner-name-link--compact";
    }
    return "scanner-name-link scanner-name-link--normal";
  }

  function formatScannerTradeDate(value) {
    if (!value) {
      return "-";
    }
    const date = parseDate(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${date.getMonth() + 1}/${date.getDate()}(${weekdays[date.getDay()]})`;
  }

  function resolveRowByTime(rows, timeValue) {
    if (!timeValue) {
      return null;
    }
    return rows.find((row) => row.date === timeValue) || null;
  }

  function setScannerTableValues(code, row, options = {}) {
    if (!row) {
      return;
    }
    const tradeDate = document.getElementById(`scanTradeDate-${code}`);
    const tradePrice = document.getElementById(`scanTradePrice-${code}`);
    const change = document.getElementById(`scanChange-${code}`);
    const turnover = document.getElementById(`scanTurnover-${code}`);
    const volume = document.getElementById(`scanVolume-${code}`);
    const high = document.getElementById(`scanHigh-${code}`);
    const low = document.getElementById(`scanLow-${code}`);
    if (tradePrice) {
      tradePrice.textContent = formatNumber(row.close);
    }
    if (tradeDate) {
      tradeDate.textContent = formatScannerTradeDate(row.date);
      tradeDate.hidden = !options.showDate;
    }
    if (change) {
      change.innerHTML = `${formatSignedPercentHtml(row.changePercent)}${renderLimitMoveMarker(row)}`;
      change.className = `num scanner-compact-change scanner-change-cell ${getChangeClass(row.changePercent)}`.trim();
    }
    if (turnover) {
      turnover.textContent = formatTurnoverOku(row.close, row.volume);
    }
    if (volume) {
      volume.textContent = formatNumber(row.volume, 0);
    }
    if (high) {
      high.textContent = formatNumber(row.high);
    }
    if (low) {
      low.textContent = formatNumber(row.low);
    }
  }

  function formatScannerTickMark(time, tickMarkType) {
    const yearType = window.LightweightCharts?.TickMarkType?.Year ?? "Year";
    const monthType = window.LightweightCharts?.TickMarkType?.Month ?? "Month";
    const date = typeof time === "string" ? parseDate(time) : new Date(time.year, time.month - 1, time.day);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    if (tickMarkType === yearType || tickMarkType === "Year") {
      return String(date.getFullYear()).slice(-2);
    }
    if (tickMarkType === monthType || tickMarkType === "Month") {
      return String(date.getMonth() + 1);
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function appendWhitespaceAnchorRow(rows, anchorDate) {
    const normalizedDate = String(anchorDate || "").trim();
    if (!normalizedDate || !rows.length) {
      return rows;
    }
    const lastRow = rows[rows.length - 1];
    if (!lastRow || String(lastRow.date || "") >= normalizedDate) {
      return rows;
    }
    return [
      ...rows,
      {
        time: normalizedDate,
      },
    ];
  }

  function normalizeChartEventType(value) {
    const type = String(value || "").trim().toLowerCase();
    if (["ir", "tdnet", "disclosure"].includes(type)) return "ir";
    if (["news", "n"].includes(type)) return "news";
    if (["x", "sns", "social"].includes(type)) return "sns";
    if (["earnings", "kessan", "決算"].includes(type)) return "earnings";
    return "default";
  }

  function chartEventLabel(type) {
    return {
      ir: "IR",
      news: "N",
      sns: "X",
      earnings: "決",
      default: "•",
    }[type] || "•";
  }

  function normalizeScannerChartEvents(events) {
    return (Array.isArray(events) ? events : [])
      .map((event) => {
        const date = String(event?.date || event?.time || "").trim();
        if (!date) {
          return null;
        }
        const type = normalizeChartEventType(event?.type || event?.source || event?.category);
        return {
          date,
          type,
          label: String(event?.label || chartEventLabel(type)).trim(),
          title: String(event?.title || event?.headline || event?.summary || chartEventLabel(type)).trim(),
        };
      })
      .filter(Boolean);
  }

  function renderCompactChartEventMarkers(element, chart, visibleRows, events) {
    const normalizedEvents = normalizeScannerChartEvents(events);
    if (!element || !chart || !normalizedEvents.length) {
      return;
    }
    const visibleDates = new Set(visibleRows.map((row) => String(row.date || "")));
    const eventLayer = document.createElement("div");
    eventLayer.className = "scanner-chart-event-layer";
    element.appendChild(eventLayer);

    const draw = () => {
      eventLayer.innerHTML = "";
      normalizedEvents
        .filter((event) => visibleDates.has(event.date))
        .forEach((event) => {
          const x = chart.timeScale().timeToCoordinate(event.date);
          if (!Number.isFinite(x)) {
            return;
          }
          const marker = document.createElement("span");
          marker.className = `scanner-chart-event-marker scanner-chart-event-marker--${event.type}`;
          marker.textContent = event.label;
          marker.title = event.title;
          marker.style.left = `${Math.round(x)}px`;
          eventLayer.appendChild(marker);
        });
    };

    requestAnimationFrame(draw);
  }

  function renderScannerChartDateTooltip(element, chart, visibleRows) {
    if (!element || !chart || !visibleRows.length) {
      return;
    }
    const tooltip = document.createElement("div");
    tooltip.className = "scanner-chart-date-tooltip";
    tooltip.hidden = true;
    element.appendChild(tooltip);

    const hideTooltip = () => {
      tooltip.hidden = true;
    };
    chart.subscribeCrosshairMove((param) => {
      if (!param?.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        hideTooltip();
        return;
      }
      const row = resolveRowByTime(visibleRows, param.time);
      if (!row) {
        hideTooltip();
        return;
      }
      tooltip.textContent = formatScannerTradeDate(row.date);
      tooltip.hidden = false;
      const width = tooltip.offsetWidth || 64;
      const x = Math.max(8, Math.min(element.clientWidth - width - 8, Math.round(param.point.x - width / 2)));
      tooltip.style.left = `${x}px`;
    });
    element.addEventListener("mouseleave", hideTooltip);
  }

  function renderCompactStyleChart(element, rows, selectedDate, rangeValue, options = {}) {
    if (!element || !window.LightweightCharts) {
      return;
    }
    // 既存チャートインスタンスを正しく破棄してメモリを解放
    const elementId = element.id || element;
    if (_chartInstances.has(elementId)) {
      try {
        _chartInstances.get(elementId).remove();
      } catch (_) {
        // 破棄済みの場合は無視
      }
      _chartInstances.delete(elementId);
    }
    element.innerHTML = "";
    const timeframe = options.timeframe || "daily";
    const useBarCount = Boolean(options.useBarCount);
    const chartRows = buildScannerChartRows(rows, timeframe);
    const selectedIndex = findSelectedChartIndex(chartRows, selectedDate, timeframe);
    if (selectedIndex < 0) {
      if (elementId) {
        renderChartFailure(elementId, "選択日に一致する価格データがありません");
      }
      return;
    }
    const isMobileScannerCard =
      document.body?.dataset?.page === "index-scanner" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 640px)").matches;
    let visibleRows = useBarCount
      ? selectRowsByBarWindow(chartRows, selectedIndex, rangeValue)
      : selectRowsByMonths(chartRows, selectedDate, rangeValue, {
          selectedIndex,
          extendToLatest: Boolean(options.extendToLatest),
        });
    if (isMobileScannerCard && timeframe === "daily" && visibleRows.length) {
      const firstVisibleIndex = chartRows.findIndex((row) => row.date === visibleRows[0].date);
      if (firstVisibleIndex > 0) {
        visibleRows = chartRows.slice(Math.max(0, firstVisibleIndex - 2), firstVisibleIndex).concat(visibleRows);
      }
    }
    if (!visibleRows.length) {
      if (elementId) {
        renderChartFailure(elementId, "表示期間に利用できる価格データがありません");
      }
      return;
    }
    const anomaly = detectChartScaleAnomaly(visibleRows);
    if (anomaly) {
      console.warn("[chart-scale-anomaly]", {
        code: options.code || null,
        fromDate: anomaly.fromDate,
        toDate: anomaly.toDate,
        fromClose: anomaly.fromClose,
        toClose: anomaly.toClose,
        ratio: anomaly.ratio,
      });
    }
    const baseRow = chartRows[selectedIndex];
    if (typeof options.onInitialRow === "function") {
      options.onInitialRow(baseRow);
    }
    if (options.metaTarget) {
      options.metaTarget.textContent = `${baseRow.date} 基準 / ${visibleRows[0].date} - ${visibleRows[visibleRows.length - 1].date}`;
    }
    const chart = window.LightweightCharts.createChart(element, {
      height: options.height || 173,
      layout: { background: { color: "#111827" }, textColor: "#d2def0", fontSize: 9 },
      rightPriceScale: {
        borderColor: "rgba(96, 132, 182, 0.64)",
        scaleMargins: { top: 0.05, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "rgba(96, 132, 182, 0.64)",
        rightOffset: 0,
        barSpacing: 7,
        minBarSpacing: 5,
        fixLeftEdge: true,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time, tickMarkType) => formatScannerTickMark(time, tickMarkType),
      },
      grid: { vertLines: { color: "rgba(30, 58, 95, 0.2)" }, horzLines: { color: "rgba(30, 58, 95, 0.2)" } },
      crosshair: {
        vertLine: {
          visible: true,
          labelVisible: false,
          width: 1,
          color: "rgba(203, 213, 225, 0.5)",
          style: window.LightweightCharts?.LineStyle?.Dotted ?? 1,
        },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4444",
      downColor: "#3b82f6",
      borderVisible: true,
      borderUpColor: "#ef4444",
      borderDownColor: "#3b82f6",
      wickUpColor: "#ef4444",
      wickDownColor: "#3b82f6",
      crosshairMarkerVisible: false,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: "rgba(252, 165, 165, 0.9)",
    });
    candleSeries.setData(
      visibleRows.map((row) => ({
        time: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        ...(row.date === baseRow.date
          ? row.close >= row.open
            ? {
                color: "#fca5a5",
                borderColor: "#fca5a5",
                wickColor: "#fca5a5",
              }
            : {
                color: "#93c5fd",
                borderColor: "#93c5fd",
                wickColor: "#93c5fd",
              }
          : {}),
      }))
    );
    const volumeColor = "rgba(56, 97, 150, 0.35)";
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: volumeColor,
      crosshairMarkerVisible: false,
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.84, bottom: 0 },
      borderVisible: false,
    });
    volumeSeries.setData(
      visibleRows.map((row) => ({
        time: row.date,
        value: row.volume,
        color: volumeColor,
      }))
    );
    [
      [5, "#ef4444"],
      [25, "#3b82f6"],
      [75, "#22c55e"],
      [200, "#f59e0b"],
    ].forEach(([windowSize, color]) => {
      const series = chart.addLineSeries({
        color,
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData(
        visibleRows
          .map((row) => ({
            time: row.date,
            value: row[`ma${windowSize}`],
          }))
          .filter((item) => item.value != null)
      );
    });
    chart.subscribeClick((param) => {
      if (!param || !param.time) {
        return;
      }
      const clickedRow = resolveRowByTime(chartRows, param.time);
      if (!clickedRow) {
        return;
      }
      if (typeof options.onRowSelect === "function") {
        options.onRowSelect(clickedRow);
      }
    });
    const timeScale = chart.timeScale();
    const visibleCount = visibleRows.length;
    timeScale.setVisibleLogicalRange({
      from: -0.5,
      to: visibleCount - 1 + (isMobileScannerCard ? 1 : 3),
    });
    renderCompactChartEventMarkers(element, chart, visibleRows, options.events);
    renderScannerChartDateTooltip(element, chart, visibleRows);
    // インスタンスを登録して次回の再描画時に正しく破棄できるようにする
    if (element.id) {
      _chartInstances.set(element.id, chart);
    }
  }

  function renderScannerCompactChart(elementId, code, rows, selectedDate, rangeValue, options = {}) {
    const element = document.getElementById(elementId);
    if (!element) {
      return;
    }
    const initialRowOverride =
      options.initialRowOverride && typeof options.initialRowOverride === "object"
        ? {
            ...options.initialRowOverride,
            date: String(options.initialRowOverride.date || selectedDate || "").trim(),
          }
        : null;
    renderCompactStyleChart(element, rows, selectedDate, rangeValue, {
      ...options,
      code,
      height: options.height || element.clientHeight || 208,
      onInitialRow: (row) => setScannerTableValues(code, initialRowOverride || row),
      onRowSelect: (row) => setScannerTableValues(code, row),
    });
  }

  function renderTickerChart(element, rows, selectedIndex, modeKey, chartMeta, onRowSelect, options = {}) {
    const selectedRow = rows[selectedIndex];
    if (!element || !selectedRow) {
      return;
    }
    const mode = getTickerChartMode(modeKey);
    renderCompactStyleChart(element, rows, selectedRow.date, mode.rangeValue, {
      height: options.height || 224,
      code: chartMeta?.dataset?.code || null,
      metaTarget: chartMeta,
      extendToLatest: true,
      timeframe: mode.timeframe,
      useBarCount: mode.useBarCount,
      onInitialRow: (chartRow) => {
        const resolvedRow = resolveTickerChartSelectionRow(rows, chartRow, mode.timeframe);
        onRowSelect?.(resolvedRow);
      },
      onRowSelect: (chartRow) => {
        const resolvedRow = resolveTickerChartSelectionRow(rows, chartRow, mode.timeframe);
        onRowSelect?.(resolvedRow);
      },
    });
  }

  function loadTickerNote(ticker) {
    return localStorage.getItem(`${NOTE_STORAGE_PREFIX}${ticker}`) || "";
  }

  function resolveAvailableDate(requestedDate, availableDates) {
    if (!availableDates?.length) {
      return requestedDate || "";
    }
    if (!requestedDate) {
      return availableDates.at(-1);
    }
    if (availableDates.includes(requestedDate)) {
      return requestedDate;
    }
    const eligible = availableDates.filter((value) => value <= requestedDate);
    return eligible.at(-1) || availableDates[0];
  }

  function resolvePickerDate(requestedDate, availableDates, fallbackDate) {
    if (availableDates.includes(requestedDate)) {
      return requestedDate;
    }
    return fallbackDate || resolveAvailableDate(requestedDate, availableDates);
  }

  function isJapaneseHoliday(date) {
    const weekday = date.getDay();
    if (weekday === 0) {
      return true;
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    if (isBaseJapaneseHoliday(date)) {
      return true;
    }
    if (year >= 1985 && weekday !== 6) {
      const previousDay = new Date(year, month - 1, day - 1);
      const nextDay = new Date(year, month - 1, day + 1);
      if (isBaseJapaneseHoliday(previousDay) && isBaseJapaneseHoliday(nextDay)) {
        return true;
      }
    }
    if (weekday === 1) {
      const previousDay = new Date(year, month - 1, day - 1);
      return isBaseJapaneseHoliday(previousDay);
    }
    return false;
  }

  function isBaseJapaneseHoliday(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = date.getDay();
    const year = date.getFullYear();
    return isFixedHoliday(month, day) || isHappyMondayHoliday(month, day, weekday) || isEquinoxHoliday(month, day, year);
  }

  function isFixedHoliday(month, day) {
    return new Set(["1-1", "2-11", "2-23", "4-29", "5-3", "5-4", "5-5", "8-11", "11-3", "11-23"]).has(
      `${month}-${day}`
    );
  }

  function isHappyMondayHoliday(month, day, weekday) {
    return (
      (month === 1 && weekday === 1 && day >= 8 && day <= 14) ||
      (month === 7 && weekday === 1 && day >= 15 && day <= 21) ||
      (month === 9 && weekday === 1 && day >= 15 && day <= 21) ||
      (month === 10 && weekday === 1 && day >= 8 && day <= 14)
    );
  }

  function isEquinoxHoliday(month, day, year) {
    if (month === 3) {
      return day === vernalEquinoxDay(year);
    }
    if (month === 9) {
      return day === autumnalEquinoxDay(year);
    }
    return false;
  }

  function vernalEquinoxDay(year) {
    return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }

  function autumnalEquinoxDay(year) {
    return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }

  function findSelectedIndex(rows, requestedDate) {
    let lastIndex = -1;
    rows.forEach((row, index) => {
      if (row.date <= requestedDate) {
        lastIndex = index;
      }
    });
    return lastIndex >= 0 ? lastIndex : rows.length - 1;
  }

  function buildTickerUrl(code, date, rankingKey = "") {
    const params = new URLSearchParams();
    params.set("code", code);
    if (date) {
      params.set("date", date);
    }
    if (rankingKey) {
      params.set("from", rankingKey);
    }
    return `./ticker.html?${params.toString()}`;
  }

  function syncIndexUrlState(state) {
    const params = new URLSearchParams(window.location.search);
    params.set("date", state.selectedDate);
    if (state.activeType) {
      params.set("type", state.activeType);
    } else {
      params.delete("type");
    }
    if (state.activeMarket) {
      params.set("market", state.activeMarket);
    } else {
      params.delete("market");
    }
    if (state.activeTheme) {
      params.set("theme", state.activeTheme);
      params.delete("industry");
    } else if (state.activeIndustry) {
      params.set("industry", state.activeIndustry);
      params.delete("theme");
    } else {
      params.delete("industry");
      params.delete("theme");
    }
    history.replaceState({}, "", `./index.html?${params.toString()}`);
  }

  function normalizeTypeFilter(value) {
    return TYPE_FILTERS.some((item) => item.key === value) ? value : "";
  }

  function typeFilterLabel(value) {
    return TYPE_FILTERS.find((item) => item.key === value)?.label || "全銘柄";
  }

  function resolvePrimaryRankingKey(activeType) {
    return activeType || "gainers";
  }

  function resolvePrimaryRankingLabel(activeType) {
    return activeType ? typeFilterLabel(activeType) : "値上がり率";
  }

  function syncTickerUrl(code, date, rankingKey, chartMode = "3m") {
    const params = new URLSearchParams(window.location.search);
    params.set("code", code);
    params.set("date", date);
    if (rankingKey) {
      params.set("from", rankingKey);
    } else {
      params.delete("from");
    }
    params.set("chart", normalizeTickerChartMode(chartMode));
    history.replaceState({}, "", `./ticker.html?${params.toString()}`);
  }

  function normalizeTickerChartMode(value) {
    return TICKER_CHART_MODES.some((mode) => mode.key === value) ? value : "3m";
  }

  function getTickerChartMode(modeKey) {
    return TICKER_CHART_MODES.find((mode) => mode.key === normalizeTickerChartMode(modeKey)) || TICKER_CHART_MODES[1];
  }

  function resolveTickerChartSelectionRow(rows, chartRow, timeframe) {
    if (!chartRow) {
      return rows.at(-1) || null;
    }
    if (timeframe === "daily") {
      return chartRow;
    }
    return rows.find((row) => row.date === chartRow.date) || rows.at(-1) || chartRow;
  }

  function syncScannerUrl(date, sort, tag, limit, months) {
    const params = new URLSearchParams(window.location.search);
    params.set("date", date);
    params.set("sort", sort);
    params.set("limit", String(limit));
    params.set("months", String(months));
    if (tag) {
      params.set("tag", tag);
    } else {
      params.delete("tag");
    }
    history.replaceState({}, "", `./index.html?${params.toString()}`);
  }

  function syncIndexScannerUrl(date, sort, tag, theme, turnover, limit, rangeMonths, timeframe, deviationFilters = {}, selectedStrategies = [], pullbackDropPct = "") {
    const params = new URLSearchParams(window.location.search);
    params.set("date", date);
    params.set("sort", sort);
    params.set("limit", String(limit));
    params.set("range", String(rangeMonths));
    params.set("timeframe", timeframe);
    params.delete("months");
    params.delete("bars");
    if (tag) {
      params.set("tag", tag);
    } else {
      params.delete("tag");
    }
    if (theme) {
      params.set("theme", theme);
    } else {
      params.delete("theme");
    }
    if (selectedStrategies.length) {
      params.set("strategy", selectedStrategies[0]);
    } else {
      params.delete("strategy");
    }
    params.set("turnover", String(turnover));
    if (sort === "strategy_high_pullback_30" && pullbackDropPct) {
      params.set("pullback", String(pullbackDropPct));
    } else {
      params.delete("pullback");
    }
    DEVIATION_SORT_KEYS.forEach((key) => {
      const shortKey = DEVIATION_URL_KEY_MAP[key];
      const filter = deviationFilters[key] || { mode: "", min: "", max: "" };
      if (filter.mode) {
        params.set(`${shortKey}_mode`, filter.mode);
      } else {
        params.delete(`${shortKey}_mode`);
      }
      if (filter.min !== "") {
        params.set(`${shortKey}_min`, String(filter.min));
      } else {
        params.delete(`${shortKey}_min`);
      }
      if (filter.max !== "") {
        params.set(`${shortKey}_max`, String(filter.max));
      } else {
        params.delete(`${shortKey}_max`);
      }
    });
    const activeDeviationKey = getActiveDeviationSortKey(sort);
    const activeDeviationFilter = activeDeviationKey ? (deviationFilters[activeDeviationKey] || { mode: "", min: "", max: "" }) : { mode: "", min: "", max: "" };
    if (activeDeviationFilter.min !== "") {
      params.set('devMin', String(activeDeviationFilter.min));
    } else {
      params.delete('devMin');
    }
    if (activeDeviationFilter.max !== "") {
      params.set('devMax', String(activeDeviationFilter.max));
    } else {
      params.delete('devMax');
    }
    params.delete("condition");
    history.replaceState({}, "", `./index.html?${params.toString()}`);
  }

  function normalizeDeviationFilterInputMode(value) {
    return ["gte", "lte", "between"].includes(String(value || "").trim()) ? String(value || "").trim() : "";
  }

  function isDeviationSort(sortKey) {
    return DEVIATION_SORT_KEYS.includes(sortKey);
  }

  function getActiveDeviationSortKey(sortKey) {
    return isDeviationSort(sortKey) ? sortKey : "";
  }

  function getActiveDeviationFilter(state) {
    const activeKey = getActiveDeviationSortKey(state.sort);
    if (!activeKey) {
      return { mode: "", min: "", max: "" };
    }
    return state.deviationFilters[activeKey] || { mode: "", min: "", max: "" };
  }

  function getActiveDeviationDraft(state) {
    const activeKey = getActiveDeviationSortKey(state.sort);
    if (!activeKey) {
      return { mode: "", min: "", max: "" };
    }
    return state.deviationDrafts[activeKey] || { mode: "", min: "", max: "" };
  }

  function getDeviationValueBySort(record, sortKey) {
    if (sortKey === "deviation25") return record.distanceToMa25;
    if (sortKey === "deviation75") return record.distanceToMa75;
    if (sortKey === "deviation200") return record.distanceToMa200;
    return null;
  }

  function getDeviationSortLabel(sortKey) {
    if (sortKey === "deviation25") return "MA25 Deviation";
    if (sortKey === "deviation75") return "MA75 Deviation";
    if (sortKey === "deviation200") return "MA200 Deviation";
    return "";
  }

  function normalizeDeviationFilterValue(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
      return "";
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? String(numeric) : "";
  }

  function matchesDeviationFilter(deviationValue, mode, minValue, maxValue) {
    if (deviationValue == null) {
      return false;
    }
    const value = Number(deviationValue);
    if (!Number.isFinite(value)) {
      return false;
    }
    const normalizedMode = normalizeDeviationFilterInputMode(mode);
    if (!normalizedMode) {
      return true;
    }
    const min = minValue === "" ? null : Number(minValue);
    const max = maxValue === "" ? null : Number(maxValue);
    if (normalizedMode === "gte") {
      return min == null ? true : value >= min;
    }
    if (normalizedMode === "lte") {
      return max == null ? true : value <= max;
    }
    if (min != null && value < min) {
      return false;
    }
    if (max != null && value > max) {
      return false;
    }
    return min != null || max != null;
  }

  function selectRowsByMonths(rows, selectedDate, months, options = {}) {
    const selectedIndex = Number.isInteger(options.selectedIndex) ? options.selectedIndex : findSelectedIndex(rows, selectedDate);
    if (selectedIndex < 0) {
      return [];
    }
    const anchorDate = parseDate(rows[selectedIndex].date);
    const cutoff = addMonths(anchorDate, -months);
    return rows.filter((row, index) => {
      if (parseDate(row.date) < cutoff) {
        return false;
      }
      if (options.extendToLatest) {
        return true;
      }
      return index <= selectedIndex + 8;
    });
  }

  function buildScannerChartRows(rows, timeframe) {
    if (timeframe === "weekly") {
      return enrichAggregatedRows(aggregateRowsByPeriod(rows, weekBucketKey));
    }
    if (timeframe === "monthly") {
      return enrichAggregatedRows(aggregateRowsByPeriod(rows, monthBucketKey));
    }
    return rows;
  }

  function detectChartScaleAnomaly(rows) {
    for (let index = 1; index < rows.length; index += 1) {
      const previousClose = Number(rows[index - 1]?.close || 0);
      const currentClose = Number(rows[index]?.close || 0);
      if (!(previousClose > 0 && currentClose > 0)) {
        continue;
      }
      const ratio = currentClose / previousClose;
      if (ratio >= 6 || ratio <= 1 / 6) {
        return {
          fromDate: rows[index - 1].date,
          toDate: rows[index].date,
          fromClose: previousClose,
          toClose: currentClose,
          ratio: Number(ratio.toFixed(4)),
        };
      }
    }
    return null;
  }

  function aggregateRowsByPeriod(rows, bucketKeyFn) {
    const buckets = [];
    rows.forEach((row) => {
      const key = bucketKeyFn(row.date);
      const current = buckets[buckets.length - 1];
      if (!current || current.key !== key) {
        buckets.push({
          key,
          rows: [row],
        });
        return;
      }
      current.rows.push(row);
    });
    return buckets.map(({ rows: bucketRows }) => {
      const first = bucketRows[0];
      const last = bucketRows[bucketRows.length - 1];
      return {
        periodStartDate: first.date,
        date: last.date,
        open: first.open,
        high: bucketRows.reduce((max, row) => Math.max(max, Number(row.high || row.close || 0)), Number(first.high || first.close || 0)),
        low: bucketRows.reduce((min, row) => Math.min(min, Number(row.low || row.close || 0)), Number(first.low || first.close || 0)),
        close: last.close,
        volume: bucketRows.reduce((total, row) => total + Number(row.volume || 0), 0),
      };
    });
  }

  function enrichAggregatedRows(rows) {
    const maWindows = [5, 25, 75, 200];
    const maValues = Object.fromEntries(maWindows.map((windowSize) => [windowSize, computeMovingAverage(rows, windowSize)]));
    return rows.map((row, index) => {
      const previousClose = index > 0 ? rows[index - 1].close : null;
      const change = previousClose == null ? null : roundNumber(row.close - previousClose, 4);
      const changePercent = previousClose ? roundNumber((change / previousClose) * 100, 4) : null;
      return {
        ...row,
        change,
        changePercent,
        ma5: maValues[5][index],
        ma25: maValues[25][index],
        ma75: maValues[75][index],
        ma200: maValues[200][index],
      };
    });
  }

  function computeMovingAverage(rows, windowSize) {
    const results = [];
    let total = 0;
    rows.forEach((row, index) => {
      total += Number(row.close || 0);
      if (index >= windowSize) {
        total -= Number(rows[index - windowSize].close || 0);
      }
      if (index + 1 < windowSize) {
        results.push(null);
        return;
      }
      results.push(roundNumber(total / windowSize, 4));
    });
    return results;
  }

  function weekBucketKey(dateValue) {
    const date = parseDate(dateValue);
    const offset = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - offset);
    return formatDateKey(monday);
  }

  function monthBucketKey(dateValue) {
    const date = parseDate(dateValue);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function findSelectedChartIndex(rows, selectedDate, timeframe) {
    if (!rows.length) {
      return -1;
    }
    if (timeframe === "daily") {
      return findSelectedIndex(rows, selectedDate);
    }
    const containingIndex = rows.findIndex((row) => {
      const startDate = row.periodStartDate || row.date;
      return startDate <= selectedDate && selectedDate <= row.date;
    });
    if (containingIndex >= 0) {
      return containingIndex;
    }
    return findSelectedIndex(rows, selectedDate);
  }

  function selectRowsByBarWindow(rows, selectedIndex, barCount) {
    if (!rows.length) {
      return [];
    }
    let endIndex = rows.length - 1;
    let startIndex = Math.max(0, endIndex - barCount + 1);
    if (selectedIndex < startIndex) {
      startIndex = selectedIndex;
      endIndex = Math.min(rows.length - 1, startIndex + barCount - 1);
    }
    return rows.slice(startIndex, endIndex + 1);
  }

  function rankingLabel(key) {
    return RANKING_CONFIG.find((item) => item.key === key)?.label || key;
  }

  function mapScannerSortToRanking(sortKey) {
    return {
      gainers: "gainers",
      stop_high: "",
      losers: "losers",
      volume: "volume_spike",
      new_high: "new_high",
      new_high_20d: "",
      bullish_close_breakout_20d: "",
      trend_turn: "trend_turn",
      rebound_signal: "rebound_signal",
      deviation25: "deviation25",
      deviation75: "deviation75",
      deviation200: "deviation200",
      lower_shadow: "lower_shadow",
      watch_candidates: "watch_candidates",
      strategy_minervini: "strategy_minervini",
      strategy_stage2: "strategy_stage2",
      strategy_turtle: "strategy_turtle",
      strategy_canslim: "strategy_canslim",
      strategy_rsi2: "strategy_rsi2",
      strategy_strong_trend_pullback_rebound: "",
      code: "",
    }[sortKey] || "";
  }
})();
