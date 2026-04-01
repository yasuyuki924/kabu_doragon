(function () {
  const MANIFEST_PATH = "./data/manifest.json";
  const THEME_MAP_PATH = "./data/theme_map.json";
  const WATCHLIST_PATH = "./data/watchlist.json";
  const WATCHLIST_STORAGE_KEY = "local-stock-dashboard.watchlist.v6";
  const SCANNER_PICKS_STORAGE_KEY = "local-stock-dashboard.scanner-picks.v1";
  const REGISTERED_STORAGE_KEY = "local-stock-dashboard.registered-picks.v1";
  const NOTE_STORAGE_PREFIX = "local-stock-dashboard.note.";
  const PERIOD_MONTHS = [1, 2, 3, 4, 5, 6];
  const TICKER_CHART_MODES = [
    { key: "1m", label: "1ヶ月", timeframe: "daily", rangeValue: 1, useBarCount: false },
    { key: "3m", label: "3ヶ月", timeframe: "daily", rangeValue: 3, useBarCount: false },
    { key: "6m", label: "6ヶ月", timeframe: "daily", rangeValue: 6, useBarCount: false },
    { key: "weekly", label: "週足", timeframe: "weekly", rangeValue: 30, useBarCount: true },
    { key: "monthly", label: "月足", timeframe: "monthly", rangeValue: 24, useBarCount: true },
  ];
  const RANKING_CONFIG = [
    { key: "gainers", label: "値上がり率" },
    { key: "losers", label: "値下がり率" },
    { key: "volume_spike", label: "出来高増加" },
    { key: "new_high", label: "新高値" },
    { key: "deviation25", label: "25日線乖離" },
    { key: "deviation75", label: "75日線乖離" },
    { key: "deviation200", label: "200日線乖離" },
    { key: "lower_shadow", label: "下ひげ" },
    { key: "rebound_signal", label: "反発シグナル" },
    { key: "watch_candidates", label: "監視候補" },
  ];
  const TSE_MARKETS = new Set(["TSE", "プライム", "スタンダード", "グロース"]);
  const MARKET_TAGS = new Set(["tse", "prime", "standard", "growth"]);
  const TYPE_FILTERS = [
    { key: "", label: "全銘柄" },
    { key: "gainers", label: "値上がり率" },
    { key: "losers", label: "値下がり率" },
    { key: "new_high", label: "新高値" },
    { key: "deviation25", label: "25日線乖離" },
    { key: "deviation75", label: "75日線乖離" },
    { key: "deviation200", label: "200日線乖離" },
  ];
  const INDEX_SCANNER_LIMITS = [50, 100, 200];
  const INDEX_SCANNER_MONTHS = [1, 3, 6, 12];
    const INDEX_SCANNER_TIMEFRAMES = ["daily", "weekly", "monthly"];
  const INDEX_SCANNER_TIMEFRAME_RANGES = {
    daily: [
      { months: 1, label: "1M" },
      { months: 3, label: "3M" },
      { months: 6, label: "6M" },
    ],
    weekly: [
      { months: 12, label: "1Y" },
      { months: 36, label: "3Y" },
    ],
    monthly: [
      { months: 36, label: "3Y" },
      { months: 60, label: "5Y" },
    ],
  };
  const INDEX_SCANNER_TURNOVER_OPTIONS = [0, 50000000, 100000000, 500000000, 1000000000];
  const INDEX_SCANNER_MIN_CLOSE = 50;
  const STOP_HIGH_EPSILON = 0.5;
  const JPX_PRICE_LIMIT_TABLE = [
    [100, 30],
    [200, 50],
    [500, 80],
    [700, 100],
    [1000, 150],
    [1500, 300],
    [2000, 400],
    [3000, 500],
    [5000, 700],
    [7000, 1000],
    [10000, 1500],
    [15000, 3000],
    [20000, 4000],
    [30000, 5000],
    [50000, 7000],
    [70000, 10000],
    [100000, 15000],
    [150000, 30000],
    [200000, 40000],
    [300000, 50000],
    [500000, 70000],
    [700000, 100000],
    [1000000, 150000],
    [1500000, 300000],
    [2000000, 400000],
    [3000000, 500000],
    [5000000, 700000],
    [7000000, 1000000],
    [10000000, 1500000],
    [15000000, 3000000],
    [20000000, 4000000],
    [30000000, 5000000],
    [50000000, 7000000],
    [Infinity, 10000000],
  ];

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

  async function initTickerPage() {
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
            value: await loadTickerPayloadWithDiagnostics(record.code, { selectedDate: state.selectedDate }),
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
        const { payload, validation, shape, requestUrl, status, responseBody } = result.value;
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
          payload.ohlcv,
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

  async function initIndexScannerPage() {
    const sortSelect = document.getElementById("indexSort");
    const stickyBar = document.getElementById("indexStickyBar");
    const stickyPickedLink = document.getElementById("indexStickyPickedLink");
    const stickyRefreshButton = document.getElementById("indexStickyRefreshButton");
    const stickyDateButton = document.getElementById("indexStickyDateButton");
    const stickyDatePopover = document.getElementById("indexStickyDatePopover");
    const stickyTimeframeGroup = document.getElementById("indexStickyTimeframe");
    const stickySortSelect = document.getElementById("indexStickySort");
    const stickyLimitSelect = document.getElementById("indexStickyLimit");
    const stickySelectAllPicksButton = document.getElementById("indexStickySelectAllButton");
    const stickyResetPicksButton = document.getElementById("indexStickyResetPicksButton");
    const stickyFiltersButton = document.getElementById("indexStickyFiltersButton");
    const stickyFiltersPopover = document.getElementById("indexStickyFiltersPopover");
    const stickyMiniCalendar = document.getElementById("indexStickyMiniCalendar");
    const stickyTagSelect = document.getElementById("indexStickyTag");
    const stickyThemeSelect = document.getElementById("indexStickyTheme");
    const stickyTurnoverSelect = document.getElementById("indexStickyTurnover");
    const stickyAdvanced = document.getElementById("indexStickyAdvanced");
    const stickyDeviationTitle = document.getElementById("indexStickyDeviationTitle");
    const stickyDevMinInput = document.getElementById("indexStickyDev200Min");
    const stickyDevMaxInput = document.getElementById("indexStickyDev200Max");
    const stickyDevMinNumberInput = document.getElementById("indexStickyDev200MinNumber");
    const stickyDevMaxNumberInput = document.getElementById("indexStickyDev200MaxNumber");
    const stickyDevRangeFill = document.getElementById("indexStickyDev200RangeFill");
    const stickyDevApplyButton = document.getElementById("indexStickyDev200Apply");
    const stickyDevResetButton = document.getElementById("indexStickyDev200Reset");
    const dev200Button = document.getElementById("indexDev200Button");
    const dev200Popover = document.getElementById("indexDev200Popover");
    const deviationPopoverTitle = document.getElementById("indexDeviationPopoverTitle");
    const dev200ModeSelect = document.getElementById("indexDev200Mode");
    const dev200MinInput = document.getElementById("indexDev200Min");
    const dev200MaxInput = document.getElementById("indexDev200Max");
    const dev200ApplyButton = document.getElementById("indexDev200Apply");
    const dev200ResetButton = document.getElementById("indexDev200Reset");
    const tagSelect = document.getElementById("indexTag") || stickyTagSelect;
    const themeSelect = document.getElementById("indexTheme") || stickyThemeSelect;
    const turnoverSelect = document.getElementById("indexTurnover") || stickyTurnoverSelect;
    const limitSelect = document.getElementById("indexLimit");
    const timeframeGroup = document.getElementById("indexTimeframe");
    const timeframePopover = document.getElementById("indexTimeframePopover");
    const timeframePopoverTitle = document.getElementById("indexTimeframePopoverTitle");
    const timeframeOptions = document.getElementById("indexTimeframeOptions");
    const rangeChip = document.getElementById("indexRangeChip");
    const pickedLink = document.getElementById("indexPickedLink");
    const updatedStatus = document.getElementById("indexUpdatedStatus");
    const refreshButton = document.getElementById("indexRefreshButton");
    const selectAllPicksButton = document.getElementById("indexSelectAllButton");
    const resetPicksButton = document.getElementById("indexResetPicksButton");
    const miniCalendar = document.getElementById("indexMiniCalendar") || stickyMiniCalendar;
    const errorBox = document.getElementById("indexError");
    const list = document.getElementById("indexList");

    const state = {
      manifest: null,
      overview: null,
      sort: "gainers",
      tag: "",
      theme: "",
      turnover: 0,
      limit: 100,
      timeframe: "daily",
      rangeMonths: 3,
      rangeMonthsByTimeframe: {
        daily: 3,
        weekly: 12,
        monthly: 36,
      },
      timeframePopoverOpen: false,
      timeframePopoverTarget: "",
      deviationFilters: {
        deviation25: { mode: "", min: "", max: "" },
        deviation75: { mode: "", min: "", max: "" },
        deviation200: { mode: "", min: "", max: "" },
      },
      deviationDrafts: {
        deviation25: { mode: "", min: "", max: "" },
        deviation75: { mode: "", min: "", max: "" },
        deviation200: { mode: "", min: "", max: "" },
      },
      pendingManifest: null,
      hasFreshUpdate: false,
      isRefreshing: false,
      headerStatusFlashTimer: null,
      headerStatusFlashActive: false,
      manifestPollId: null,
      dev200PopoverOpen: false,
      stickyDateOpen: false,
      stickyFiltersOpen: false,
      selectedDate: "",
      calendarMonth: null,
      picks: {},
      themeOrder: [],
      visibleRecords: [],
    };

    if (stickyDatePopover && stickyDatePopover.parentElement !== document.body) {
      document.body.appendChild(stickyDatePopover);
    }
    if (stickyFiltersPopover && stickyBar && stickyFiltersPopover.parentElement !== stickyBar.parentElement) {
      stickyBar.insertAdjacentElement("afterend", stickyFiltersPopover);
    }

    const params = new URLSearchParams(window.location.search);
    state.sort = params.get("sort") || state.sort;
    state.tag = params.get("tag") || "";
    state.theme = params.get("theme") || "";
    state.turnover = INDEX_SCANNER_TURNOVER_OPTIONS.includes(Number(params.get("turnover")))
      ? Number(params.get("turnover"))
      : 0;
    state.limit = INDEX_SCANNER_LIMITS.includes(Number(params.get("limit"))) ? Number(params.get("limit")) : state.limit;
    state.timeframe = INDEX_SCANNER_TIMEFRAMES.includes(params.get("timeframe")) ? params.get("timeframe") : state.timeframe;
    state.rangeMonths = normalizeIndexScannerRangeMonths(state.timeframe, params.get("range"), state.rangeMonths);
    state.rangeMonthsByTimeframe[state.timeframe] = state.rangeMonths;
    state.deviationFilters.deviation25 = {
      mode: normalizeDeviationFilterInputMode(params.get("dev25_mode")),
      min: normalizeDeviationFilterValue(params.get("dev25_min")),
      max: normalizeDeviationFilterValue(params.get("dev25_max")),
    };
    state.deviationFilters.deviation75 = {
      mode: normalizeDeviationFilterInputMode(params.get("dev75_mode")),
      min: normalizeDeviationFilterValue(params.get("dev75_min")),
      max: normalizeDeviationFilterValue(params.get("dev75_max")),
    };
    state.deviationFilters.deviation200 = {
      mode: normalizeDeviationFilterInputMode(params.get("dev200_mode")),
      min: normalizeDeviationFilterValue(params.get("dev200_min")),
      max: normalizeDeviationFilterValue(params.get("dev200_max")),
    };
    const genericDevMin = normalizeDeviationFilterValue(params.get("devMin"));
    const genericDevMax = normalizeDeviationFilterValue(params.get("devMax"));
    const activeDeviationKeyFromUrl = getActiveDeviationSortKey(state.sort);
    if (activeDeviationKeyFromUrl && (genericDevMin !== "" || genericDevMax !== "")) {
      state.deviationFilters[activeDeviationKeyFromUrl] = buildDeviationFilterFromBounds(genericDevMin, genericDevMax);
    }
    state.deviationDrafts = {
      deviation25: { ...state.deviationFilters.deviation25 },
      deviation75: { ...state.deviationFilters.deviation75 },
      deviation200: { ...state.deviationFilters.deviation200 },
    };
    state.picks = loadScannerPicks();
    if (sortSelect) {
      sortSelect.value = state.sort;
    }
    themeSelect.value = state.theme;
    turnoverSelect.value = String(state.turnover);
    limitSelect.value = String(state.limit);
    if (stickySortSelect) {
      stickySortSelect.value = state.sort;
    }
    if (stickyLimitSelect) {
      stickyLimitSelect.value = String(state.limit);
    }
    if (stickyTurnoverSelect) {
      stickyTurnoverSelect.value = String(state.turnover);
    }
    const initialDeviationFilter = getActiveDeviationFilter(state);
    if (dev200ModeSelect) {
      dev200ModeSelect.value = initialDeviationFilter.mode || "gte";
    }
    if (dev200MinInput) {
      dev200MinInput.value = initialDeviationFilter.min;
    }
    if (dev200MaxInput) {
      dev200MaxInput.value = initialDeviationFilter.max;
    }
    if (stickyDevMinInput) {
      stickyDevMinInput.value = initialDeviationFilter.min || "-20";
    }
    if (stickyDevMaxInput) {
      stickyDevMaxInput.value = initialDeviationFilter.max || "20";
    }

    function updateTimeframeUI() {
      if (!timeframeGroup) {
        return;
      }
      timeframeGroup.querySelectorAll(".group-btn").forEach((btn) => {
        const isActive = btn.dataset.value === state.timeframe;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function updateRangeChip() {
      if (!rangeChip) {
        return;
      }
      rangeChip.textContent = "";
    }

    function updateStickyTimeframeUI() {
      if (!stickyTimeframeGroup) {
        return;
      }
      stickyTimeframeGroup.querySelectorAll(".group-btn").forEach((btn) => {
        const isActive = btn.dataset.value === state.timeframe;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function updateStickyBarVisibility() {
      if (!stickyBar) {
        return;
      }
      stickyBar.hidden = false;
    }

    function updateStickyHeaderActions() {
      if (!stickyPickedLink) {
        return;
      }
      const pickCount = Object.keys(state.picks || {}).length;
      stickyPickedLink.textContent = pickCount > 0 ? `Picks ${pickCount}` : "Picks";
    }

    function updateStickyFiltersUi() {
      const activeKey = getActiveDeviationSortKey(state.sort);
      const activeFilter = getActiveDeviationFilter(state);
      const activeDraft = getActiveDeviationDraft(state);
      const hasFilterSettings =
        Boolean(state.tag) || Boolean(state.theme) || Number(state.turnover || 0) > 0 || Boolean(activeFilter.mode || activeFilter.min || activeFilter.max);
      if (stickyFiltersButton) {
        const deviationSummary = activeKey ? formatDeviationFilterSummary(activeFilter) : "";
        stickyFiltersButton.textContent = deviationSummary || (hasFilterSettings ? "Filters ON" : "Filters");
        stickyFiltersButton.setAttribute("aria-expanded", state.stickyFiltersOpen ? "true" : "false");
        stickyFiltersButton.classList.toggle("is-active", state.stickyFiltersOpen || hasFilterSettings);
      }
      if (stickyFiltersPopover) {
        stickyFiltersPopover.hidden = !state.stickyFiltersOpen;
        stickyFiltersPopover.classList.toggle("is-open", state.stickyFiltersOpen);
      }
      if (stickyTagSelect) {
        stickyTagSelect.value = state.tag;
      }
      if (stickyThemeSelect) {
        stickyThemeSelect.value = state.theme;
      }
      if (stickyTurnoverSelect) {
        stickyTurnoverSelect.value = String(state.turnover);
      }
      if (stickyAdvanced) {
        stickyAdvanced.hidden = !activeKey;
      }
      if (stickyDeviationTitle) {
        stickyDeviationTitle.textContent = activeKey ? getDeviationSortLabel(activeKey) : "Deviation";
      }
      setStickyDeviationControls(activeDraft);
    }

    function updateStickyDateUi() {
      if (stickyDateButton) {
        const label = state.selectedDate ? state.selectedDate.replace(/-/g, ".") : "";
        stickyDateButton.textContent = label ? `Date ${label} ▼` : "Date ▼";
        stickyDateButton.setAttribute("aria-expanded", state.stickyDateOpen ? "true" : "false");
      }
      if (stickyDatePopover) {
        stickyDatePopover.hidden = !state.stickyDateOpen;
        stickyDatePopover.classList.toggle("is-open", state.stickyDateOpen);
        if (state.stickyDateOpen) {
          requestAnimationFrame(positionDatePopover);
        } else {
          stickyDatePopover.style.left = "";
          stickyDatePopover.style.top = "";
          stickyDatePopover.style.maxHeight = "";
        }
      }
    }

    function buildDeviationFilterFromBounds(minValue, maxValue) {
      const min = normalizeDeviationFilterValue(minValue);
      const max = normalizeDeviationFilterValue(maxValue);
      if (min === "" && max === "") {
        return { mode: "", min: "", max: "" };
      }
      if (min !== "" && max !== "") {
        const minNum = Number(min);
        const maxNum = Number(max);
        if (Number.isFinite(minNum) && Number.isFinite(maxNum) && minNum > maxNum) {
          return { mode: "between", min: String(maxNum), max: String(minNum) };
        }
        return { mode: "between", min, max };
      }
      if (min !== "") {
        return { mode: "gte", min, max: "" };
      }
      return { mode: "lte", min: "", max };
    }

    function formatDeviationFilterSummary(filter) {
      if (!filter || (!filter.mode && filter.min === "" && filter.max === "")) {
        return "";
      }
      if (filter.min !== "" && filter.max !== "") {
        return `Dev ${formatDeviationPercent(filter.min)} ~ ${formatDeviationPercent(filter.max)}`;
      }
      if (filter.min !== "") {
        return `Dev >= ${formatDeviationPercent(filter.min)}`;
      }
      if (filter.max !== "") {
        return `Dev <= ${formatDeviationPercent(filter.max)}`;
      }
      return "";
    }

    function setStickyDeviationControls(filter) {
      const min = filter?.min ?? "";
      const max = filter?.max ?? "";
      if (stickyDevMinInput) {
        stickyDevMinInput.value = min === "" ? "-20" : String(min);
      }
      if (stickyDevMaxInput) {
        stickyDevMaxInput.value = max === "" ? "20" : String(max);
      }
      if (stickyDevMinNumberInput) {
        stickyDevMinNumberInput.value = min === "" ? "" : Number(min).toFixed(1);
      }
      if (stickyDevMaxNumberInput) {
        stickyDevMaxNumberInput.value = max === "" ? "" : Number(max).toFixed(1);
      }
      syncStickyDeviationSliderUi("state");
    }

    function formatDeviationPercent(value) {
      const numeric = Number(value || 0);
      const text = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
      return `${numeric > 0 ? "+" : ""}${text}%`;
    }

    function clampDeviationSliderValue(value, fallback = 0) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return fallback;
      }
      return Math.max(-20, Math.min(20, Math.round(numeric * 10) / 10));
    }

    function syncStickyDeviationSliderUi(source = "slider") {
      if (!stickyDevMinInput || !stickyDevMaxInput) {
        return;
      }
      let minValue = -20;
      let maxValue = 20;
      let minDraftValue = stickyDevMinNumberInput?.value?.trim?.() ?? "";
      let maxDraftValue = stickyDevMaxNumberInput?.value?.trim?.() ?? "";

      if (source === "slider") {
        minValue = clampDeviationSliderValue(stickyDevMinInput.value, -20);
        maxValue = clampDeviationSliderValue(stickyDevMaxInput.value, 20);
        if (minValue > maxValue) {
          if (document.activeElement === stickyDevMinInput) {
            maxValue = minValue;
          } else {
            minValue = maxValue;
          }
        }
        stickyDevMinInput.value = String(minValue);
        stickyDevMaxInput.value = String(maxValue);
        minDraftValue = minValue.toFixed(1);
        maxDraftValue = maxValue.toFixed(1);
        if (stickyDevMinNumberInput) {
          stickyDevMinNumberInput.value = minDraftValue;
        }
        if (stickyDevMaxNumberInput) {
          stickyDevMaxNumberInput.value = maxDraftValue;
        }
      } else {
        minValue = minDraftValue === "" ? -20 : clampDeviationSliderValue(minDraftValue, -20);
        maxValue = maxDraftValue === "" ? 20 : clampDeviationSliderValue(maxDraftValue, 20);
        if (minValue > maxValue) {
          if (document.activeElement === stickyDevMinInput || document.activeElement === stickyDevMinNumberInput) {
            maxValue = minValue;
            if (maxDraftValue !== "") {
              maxDraftValue = maxValue.toFixed(1);
            }
          } else {
            minValue = maxValue;
            if (minDraftValue !== "") {
              minDraftValue = minValue.toFixed(1);
            }
          }
        }
        stickyDevMinInput.value = String(minValue);
        stickyDevMaxInput.value = String(maxValue);
        if (source === "input") {
          if (stickyDevMinNumberInput && minDraftValue !== "") {
            stickyDevMinNumberInput.value = Number(minDraftValue).toFixed(1);
          }
          if (stickyDevMaxNumberInput && maxDraftValue !== "") {
            stickyDevMaxNumberInput.value = Number(maxDraftValue).toFixed(1);
          }
        }
      }
      const percent = (value) => ((value + 20) / 40) * 100;
      if (stickyDevRangeFill) {
        stickyDevRangeFill.style.left = `${percent(minValue)}%`;
        stickyDevRangeFill.style.width = `${Math.max(0, percent(maxValue) - percent(minValue))}%`;
      }
      const activeKey = getActiveDeviationSortKey(state.sort);
      if (activeKey && source !== "state") {
        const nextDraft = buildDeviationFilterFromBounds(
          minDraftValue,
          maxDraftValue,
        );
        state.deviationDrafts[activeKey] = nextDraft;
      }
    }

    function positionFloatingPopover(anchor, popover, options = {}) {
      if (!anchor || !popover) {
        return;
      }
      const widthPadding = Number(options.widthPadding || 12);
      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxLeft = Math.max(widthPadding, viewportWidth - popoverRect.width - widthPadding);
      const idealLeft = anchorRect.right - popoverRect.width;
      const left = Math.min(Math.max(widthPadding, idealLeft), maxLeft);
      const top = Math.min(
        Math.max(8, anchorRect.bottom + 8),
        Math.max(8, viewportHeight - popoverRect.height - 8),
      );
      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
    }

    function positionDatePopover() {
      if (!stickyDateButton || !stickyDatePopover) {
        return;
      }
      const gap = 8;
      const padding = 12;
      const anchorRect = stickyDateButton.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      stickyDatePopover.style.left = "0px";
      stickyDatePopover.style.top = "0px";
      stickyDatePopover.style.maxHeight = `min(360px, calc(100vh - 24px))`;

      const popoverRect = stickyDatePopover.getBoundingClientRect();
      const popoverWidth = Math.min(popoverRect.width, viewportWidth - padding * 2);
      const naturalHeight = popoverRect.height;
      const availableBelow = viewportHeight - anchorRect.bottom - gap - padding;
      const availableAbove = anchorRect.top - gap - padding;
      const shouldOpenAbove = availableBelow < naturalHeight && availableAbove > availableBelow;
      const availableHeight = Math.max(180, shouldOpenAbove ? availableAbove : availableBelow);
      const maxHeight = Math.min(360, Math.max(180, availableHeight));

      stickyDatePopover.style.maxHeight = `${Math.round(maxHeight)}px`;
      const measuredHeight = Math.min(stickyDatePopover.getBoundingClientRect().height, maxHeight);
      const left = Math.min(
        Math.max(padding, anchorRect.left),
        Math.max(padding, viewportWidth - popoverWidth - padding)
      );
      const top = shouldOpenAbove
        ? Math.max(padding, anchorRect.top - measuredHeight - gap)
        : Math.min(viewportHeight - measuredHeight - padding, anchorRect.bottom + gap);

      stickyDatePopover.style.left = `${Math.round(left)}px`;
      stickyDatePopover.style.top = `${Math.round(top)}px`;
    }

    function updateTimeframePopover() {
      const targetTimeframe = state.timeframePopoverTarget || state.timeframe;
      const options = INDEX_SCANNER_TIMEFRAME_RANGES[targetTimeframe] || [];
      const targetRangeMonths = state.rangeMonthsByTimeframe[targetTimeframe] || options[0]?.months || state.rangeMonths;
      if (timeframePopoverTitle) {
        timeframePopoverTitle.textContent = `${indexScannerTimeframeLabel(targetTimeframe)} Range`;
      }
      if (timeframeOptions) {
        timeframeOptions.innerHTML = options
          .map((option) => `
            <button
              type="button"
              class="index-timeframe-option${option.months === targetRangeMonths ? " is-active" : ""}"
              data-timeframe-option="${targetTimeframe}"
              data-range-months="${option.months}"
            >${option.label}</button>
          `)
          .join("");
        Array.from(timeframeOptions.querySelectorAll("button[data-timeframe-option]")).forEach((button) => {
          button.addEventListener("click", async () => {
            state.timeframe = String(button.dataset.timeframeOption || state.timeframe);
            state.rangeMonths = normalizeIndexScannerRangeMonths(state.timeframe, button.dataset.rangeMonths, state.rangeMonths);
            state.rangeMonthsByTimeframe[state.timeframe] = state.rangeMonths;
            state.timeframePopoverOpen = false;
            state.timeframePopoverTarget = "";
            updateTimeframeUI();
            updateRangeChip();
            updateTimeframePopover();
            try {
              errorBox.hidden = true;
              list.innerHTML = '<div class="empty-cell">読み込み中...</div>';
              state.overview = await loadOverview(state.selectedDate, state.timeframe);
              renderTagOptions();
            } catch (error) {
              showError(errorBox, error.message);
              return;
            }
            await render();
          });
        });
      }
      if (timeframePopover) {
        const isOpen = state.timeframePopoverOpen && Boolean(state.timeframePopoverTarget);
        timeframePopover.hidden = !isOpen;
        timeframePopover.classList.toggle("is-open", isOpen);
      }
    }

    updateTimeframeUI();
    updateStickyTimeframeUI();
    updateRangeChip();
    updateTimeframePopover();
    updateDeviation200Controls();
    updateStickyDateUi();
    updateStickyFiltersUi();
    updateStickyBarVisibility();
    if (pickedLink) {
      pickedLink.href = "./picked.html";
    }
    if (stickyPickedLink) {
      stickyPickedLink.href = "./picked.html";
    }

    [...new Set([sortSelect, tagSelect, themeSelect, turnoverSelect, limitSelect, stickySortSelect, stickyTagSelect, stickyThemeSelect, stickyTurnoverSelect, stickyLimitSelect].filter(Boolean))]
      .forEach((control) => {
      control.addEventListener("change", async () => {
        state.sort = stickySortSelect?.matches(":focus") ? stickySortSelect.value : sortSelect.value;
        state.tag = stickyTagSelect?.matches(":focus") ? stickyTagSelect.value : tagSelect.value;
        state.theme = stickyThemeSelect?.matches(":focus") ? stickyThemeSelect.value : themeSelect.value;
        state.turnover = Number(stickyTurnoverSelect?.matches(":focus") ? stickyTurnoverSelect.value : turnoverSelect.value);
        state.limit = Number(stickyLimitSelect?.matches(":focus") ? stickyLimitSelect.value : limitSelect.value);
        if (sortSelect) sortSelect.value = state.sort;
        if (stickySortSelect) stickySortSelect.value = state.sort;
        if (tagSelect) tagSelect.value = state.tag;
        if (stickyTagSelect) stickyTagSelect.value = state.tag;
        if (themeSelect) themeSelect.value = state.theme;
        if (stickyThemeSelect) stickyThemeSelect.value = state.theme;
        if (turnoverSelect) turnoverSelect.value = String(state.turnover);
        if (stickyTurnoverSelect) stickyTurnoverSelect.value = String(state.turnover);
        if (limitSelect) limitSelect.value = String(state.limit);
        if (stickyLimitSelect) stickyLimitSelect.value = String(state.limit);
        const activeDeviationKey = getActiveDeviationSortKey(state.sort);
        if (activeDeviationKey) {
          state.deviationDrafts[activeDeviationKey] = { ...state.deviationFilters[activeDeviationKey] };
        }
        updateDeviation200Controls();
        updateStickyFiltersUi();
        await render();
      });
    });

    [stickyDevMinInput, stickyDevMaxInput].filter(Boolean).forEach((input) => {
      input.addEventListener("input", () => {
        syncStickyDeviationSliderUi("slider");
      });
    });

    [stickyDevMinNumberInput, stickyDevMaxNumberInput].filter(Boolean).forEach((input) => {
      input.addEventListener("input", () => {
        syncStickyDeviationSliderUi("input");
      });
      input.addEventListener("change", () => {
        syncStickyDeviationSliderUi("input");
      });
    });

    stickyDevApplyButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      const activeKey = getActiveDeviationSortKey(state.sort);
      if (!activeKey) {
        return;
      }
      const nextFilter = buildDeviationFilterFromBounds(
        stickyDevMinNumberInput?.value,
        stickyDevMaxNumberInput?.value,
      );
      state.deviationDrafts[activeKey] = nextFilter;
      state.deviationFilters[activeKey] = nextFilter;
      setStickyDeviationControls(nextFilter);
      console.debug('[Deviation Apply]', {
        draftDevMin: stickyDevMinNumberInput?.value ?? '',
        draftDevMax: stickyDevMaxNumberInput?.value ?? '',
        appliedDevMin: nextFilter.min,
        appliedDevMax: nextFilter.max,
      });
      updateDeviation200Controls();
      updateStickyFiltersUi();
      await render();
      console.debug('[Deviation Apply Result]', {
        updatedUrl: window.location.href,
        filteredResultCount: state.visibleRecords?.length ?? 0,
      });
    });

    stickyDevResetButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      const activeKey = getActiveDeviationSortKey(state.sort);
      if (activeKey) {
        state.deviationDrafts[activeKey] = { mode: "", min: "", max: "" };
        state.deviationFilters[activeKey] = { mode: "", min: "", max: "" };
      }
      if (stickyDevMinNumberInput) stickyDevMinNumberInput.value = "";
      if (stickyDevMaxNumberInput) stickyDevMaxNumberInput.value = "";
      setStickyDeviationControls({ mode: "", min: "", max: "" });
      updateDeviation200Controls();
      updateStickyFiltersUi();
      await render();
    });

    stickyFiltersButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.stickyFiltersOpen = !state.stickyFiltersOpen;
      state.stickyDateOpen = false;
      updateStickyFiltersUi();
      updateStickyDateUi();
    });

    stickyFiltersPopover?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    stickyDateButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.stickyDateOpen = !state.stickyDateOpen;
      state.stickyFiltersOpen = false;
      updateStickyDateUi();
      updateStickyFiltersUi();
    });

    stickyDatePopover?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", (event) => {
      if (state.timeframePopoverOpen && timeframePopover && timeframeGroup) {
        if (!timeframePopover.contains(event.target) && !timeframeGroup.contains(event.target)) {
          state.timeframePopoverOpen = false;
          state.timeframePopoverTarget = "";
          updateTimeframePopover();
        }
      }
      if (state.stickyFiltersOpen && stickyFiltersPopover && stickyFiltersButton) {
        if (!stickyFiltersPopover.contains(event.target) && !stickyFiltersButton.contains(event.target)) {
          state.stickyFiltersOpen = false;
          updateStickyFiltersUi();
        }
      }
      if (state.stickyDateOpen && stickyDatePopover && stickyDateButton) {
        if (!stickyDatePopover.contains(event.target) && !stickyDateButton.contains(event.target)) {
          state.stickyDateOpen = false;
          updateStickyDateUi();
        }
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (state.timeframePopoverOpen) {
          state.timeframePopoverOpen = false;
          state.timeframePopoverTarget = "";
          updateTimeframePopover();
        }
        if (state.stickyFiltersOpen) {
          state.stickyFiltersOpen = false;
          updateStickyFiltersUi();
        }
        if (state.stickyDateOpen) {
          state.stickyDateOpen = false;
          updateStickyDateUi();
        }
      }
    });

    window.addEventListener("resize", () => {
      if (state.stickyDateOpen) {
        positionDatePopover();
      }
    });

    window.addEventListener("scroll", () => {
      if (state.stickyDateOpen) {
        positionDatePopover();
      }
    }, { passive: true });

    if (timeframeGroup) {
      const LONG_PRESS_MS = 420;
      timeframeGroup.querySelectorAll(".group-btn").forEach((btn) => {
        let longPressTimer = null;
        let longPressTriggered = false;

        const clearLongPressTimer = () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        };

        const openTimeframePopover = () => {
          state.timeframePopoverTarget = String(btn.dataset.value || state.timeframe);
          state.timeframePopoverOpen = true;
          updateTimeframePopover();
        };

        btn.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) {
            return;
          }
          longPressTriggered = false;
          clearLongPressTimer();
          longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            openTimeframePopover();
          }, LONG_PRESS_MS);
        });

        ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
          btn.addEventListener(eventName, clearLongPressTimer);
        });

        btn.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          clearLongPressTimer();
          const nextTimeframe = String(btn.dataset.value || state.timeframe);
          if (longPressTriggered) {
            longPressTriggered = false;
            return;
          }
          if (state.timeframe === nextTimeframe && !state.timeframePopoverOpen) {
            return;
          }
          state.timeframe = nextTimeframe;
          state.rangeMonths = normalizeIndexScannerRangeMonths(
            state.timeframe,
            state.rangeMonthsByTimeframe[state.timeframe],
            state.rangeMonths,
          );
          state.rangeMonthsByTimeframe[state.timeframe] = state.rangeMonths;
          state.timeframePopoverOpen = false;
          state.timeframePopoverTarget = "";
          updateTimeframeUI();
          updateRangeChip();
          updateTimeframePopover();
          try {
            errorBox.hidden = true;
            list.innerHTML = '<div class="empty-cell">読み込み中...</div>';
            state.overview = await loadOverview(state.selectedDate, state.timeframe);
            renderTagOptions();
          } catch (error) {
            showError(errorBox, error.message);
            return;
          }
          await render();
        });
      });
    }

    if (resetPicksButton) {
      resetPicksButton.addEventListener("click", async () => {
        resetScannerPicks(state);
        await render();
      });
    }
    if (stickyResetPicksButton) {
      stickyResetPicksButton.addEventListener("click", async () => {
        resetScannerPicks(state);
        await render();
      });
    }
    if (selectAllPicksButton) {
      selectAllPicksButton.addEventListener("click", async () => {
        selectAllScannerPicks(state.visibleRecords, state);
        await render();
      });
    }
    if (stickySelectAllPicksButton) {
      stickySelectAllPicksButton.addEventListener("click", async () => {
        selectAllScannerPicks(state.visibleRecords, state);
        await render();
      });
    }
    refreshButton?.addEventListener("click", async () => {
      state.isRefreshing = true;
      updateHeaderStatus();
      await runRefreshAction(refreshButton, errorBox, async () => {
        state.manifest = state.pendingManifest || await loadManifest();
        state.pendingManifest = null;
        state.hasFreshUpdate = false;
        await loadDate(state.selectedDate || state.manifest.latestDate);
        await render();
      });
      state.isRefreshing = false;
      triggerHeaderStatusFlash();
      updateHeaderStatus();
    });

    try {
      state.manifest = await loadManifest();
      state.themeOrder = await loadThemeOrder();
      await loadDate(params.get("date") || state.manifest.latestDate);
      await render();
      startManifestPolling();
    } catch (error) {
      showError(errorBox, error.message);
    }

    async function loadDate(requestedDate) {
      state.selectedDate = resolveAvailableDate(requestedDate, state.manifest.availableDates);
      state.overview = await loadOverview(state.selectedDate, state.timeframe);
      state.calendarMonth = startOfMonth(parseDate(state.selectedDate));
      renderTagOptions();
      renderDateControls();
      renderCalendar();
    }

    function renderTagOptions() {
      const turnoverRecords = filterByTurnover(state.overview.records || [], state.turnover);
      const industries = [...new Set(
        turnoverRecords
          .map((record) => String(record.industry || "").trim())
          .filter(
            (industry) =>
              industry &&
              !TSE_MARKETS.has(industry) &&
              !MARKET_TAGS.has(industry.toLowerCase())
          )
      )].sort();
      tagSelect.innerHTML = ['<option value="">All</option>']
        .concat(industries.map((industry) => `<option value="${escapeHtml(industry)}">${escapeHtml(industry)}</option>`))
        .join("");
      if (stickyTagSelect) {
        stickyTagSelect.innerHTML = tagSelect.innerHTML;
      }
      if (state.tag && !industries.includes(state.tag)) {
        state.tag = "";
      }
      tagSelect.value = state.tag;
      if (stickyTagSelect) {
        stickyTagSelect.value = state.tag;
      }
    }

    function renderThemeOptions() {
      const turnoverRecords = filterByTurnover(state.overview.records || [], state.turnover);
      const availableThemes = new Set();
      turnoverRecords.forEach((record) => {
        (record.themes || []).forEach((theme) => {
          const label = String(theme || "").trim();
          if (label) {
            availableThemes.add(label);
          }
        });
      });
      const orderedThemes = state.themeOrder.filter((theme) => availableThemes.has(theme));
      const extraThemes = [...availableThemes].filter((theme) => !state.themeOrder.includes(theme)).sort((left, right) =>
        left.localeCompare(right, "ja", { sensitivity: "base" })
      );
      const themeOptions = ["", ...orderedThemes, ...extraThemes];
      themeSelect.innerHTML = themeOptions
        .map((theme) => `<option value="${escapeHtml(theme)}">${escapeHtml(theme || "All")}</option>`)
        .join("");
      if (stickyThemeSelect) {
        stickyThemeSelect.innerHTML = themeSelect.innerHTML;
      }
      if (state.theme && !availableThemes.has(state.theme)) {
        state.theme = "";
      }
      themeSelect.value = state.theme;
      if (stickyThemeSelect) {
        stickyThemeSelect.value = state.theme;
      }
    }

    function updateIndexHeaderActions() {
      if (!pickedLink) {
        return;
      }
      const pickCount = Object.keys(state.picks || {}).length;
      pickedLink.textContent = pickCount > 0 ? `Picks ${pickCount}` : "Picks";
      if (stickyPickedLink) {
        stickyPickedLink.textContent = pickCount > 0 ? `Picks ${pickCount}` : "Picks";
      }
    }

    function updateHeaderStatus() {
      if (!updatedStatus) {
        return;
      }
      const currentSnapshot = state.manifest?.currentSnapshot || {};
      const statusState = resolveHeaderStatusState(currentSnapshot?.generatedAt, {
        snapshot: currentSnapshot,
        hasFreshUpdate: state.hasFreshUpdate,
        isRefreshing: state.isRefreshing,
        flash: state.headerStatusFlashActive,
      });
      const timeParts = formatSnapshotGeneratedAtParts(currentSnapshot?.generatedAt);
      updatedStatus.className = [
        "index-header-status",
        `index-header-status--${statusState.tone}`,
        statusState.pending ? "index-header-status--pending" : "",
        statusState.refreshing ? "index-header-status--refreshing" : "",
        statusState.flash ? "index-header-status--flash" : "",
      ]
        .filter(Boolean)
        .join(" ");
      updatedStatus.setAttribute(
        "title",
        [
          statusState.label,
          statusState.marketPhase,
          timeParts.full || "--",
          statusState.pending ? "new data ready" : "",
          statusState.refreshing ? "refreshing" : "",
        ]
          .filter(Boolean)
          .join(" / ")
      );
      updatedStatus.innerHTML = `
        <span class="index-header-status-dot" aria-hidden="true"></span>
        <span class="index-header-status-body">
          <span class="index-header-status-topline">
            <span class="index-header-status-label">${escapeHtml(statusState.label)}</span>
            <span class="index-header-status-market">${escapeHtml(statusState.marketPhase)}</span>
          </span>
          <span class="index-header-status-bottomline">
            <span class="index-header-status-date">${escapeHtml(timeParts.date || "--/--")}</span>
            <span class="index-header-status-time">
              <span class="index-header-status-hm">${escapeHtml(timeParts.hm || "--:--")}</span>
              <span class="index-header-status-seconds">${escapeHtml(timeParts.seconds || "")}</span>
            </span>
          </span>
        </span>
      `;
    }

    function resolveHeaderStatusState(generatedAt, options = {}) {
      const hasFreshUpdate = Boolean(options.hasFreshUpdate);
      const isRefreshing = Boolean(options.isRefreshing);
      const flash = Boolean(options.flash);
      const snapshot = options.snapshot || {};
      const marketPhase = resolveHeaderMarketPhase();
      const tone = resolveHeaderStatusTone(generatedAt, { hasFreshUpdate, isRefreshing });
      return {
        tone,
        pending: hasFreshUpdate,
        refreshing: isRefreshing,
        flash,
        label: resolveHeaderStatusLabel(snapshot, marketPhase),
        marketPhase,
      };
    }

    function resolveHeaderStatusLabel(snapshot, marketPhase) {
      if (String(snapshot?.status || "").trim() === "finalized" || String(snapshot?.type || "").trim() === "daily") {
        return "EOD";
      }
      if (marketPhase === "PRE") {
        return "PRE";
      }
      if (marketPhase === "JP CLOSED" || marketPhase === "AFTER") {
        return "CLOSED";
      }
      return "LIVE";
    }

    function resolveHeaderStatusTone(generatedAt, options = {}) {
      if (options.isRefreshing) {
        return "refreshing";
      }
      if (options.hasFreshUpdate) {
        return "pending";
      }
      if (!generatedAt) {
        return "neutral";
      }
      const parsed = parseSnapshotGeneratedAtToDate(generatedAt);
      if (!parsed) {
        return "neutral";
      }
      const ageMinutes = Math.max(0, (Date.now() - parsed.getTime()) / 60000);
      if (ageMinutes <= 5) {
        return "fresh";
      }
      if (ageMinutes <= 30) {
        return "warm";
      }
      if (ageMinutes <= 60) {
        return "stale";
      }
      return "critical";
    }

    function resolveHeaderMarketPhase() {
      const now = new Date();
      const day = now.getDay();
      if (day === 0 || day === 6) {
        return "JP CLOSED";
      }
      const minutes = now.getHours() * 60 + now.getMinutes();
      if (minutes < 9 * 60) {
        return "PRE";
      }
      if ((minutes >= 9 * 60 && minutes < 11 * 60 + 30) || (minutes >= 12 * 60 + 30 && minutes <= 15 * 60 + 30)) {
        return "JP LIVE";
      }
      if (minutes > 15 * 60 + 30 && minutes <= 18 * 60) {
        return "AFTER";
      }
      return "JP CLOSED";
    }

    function parseSnapshotGeneratedAtToDate(value) {
      const raw = String(value || "").trim();
      if (!raw) {
        return null;
      }
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function formatSnapshotGeneratedAtParts(value) {
      const text = String(value || "").trim();
      if (!text) {
        return { full: "", date: "", hm: "", seconds: "" };
      }
      const date = new Date(text);
      if (Number.isNaN(date.getTime())) {
        return { full: text, date: "", hm: text, seconds: "" };
      }
      const pad = (number) => String(number).padStart(2, "0");
      const datePart = `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
      const hmPart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
      const secondsPart = `:${pad(date.getSeconds())}`;
      return {
        full: `${datePart} ${hmPart}${secondsPart}`,
        date: datePart,
        hm: hmPart,
        seconds: secondsPart,
      };
    }

    function triggerHeaderStatusFlash() {
      if (state.headerStatusFlashTimer) {
        window.clearTimeout(state.headerStatusFlashTimer);
      }
      state.headerStatusFlashActive = true;
      updateHeaderStatus();
      state.headerStatusFlashTimer = window.setTimeout(() => {
        state.headerStatusFlashActive = false;
        state.headerStatusFlashTimer = null;
        updateHeaderStatus();
      }, 1200);
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

    function isManifestNewer(nextManifest, currentManifest) {
      return manifestRevisionKey(nextManifest) !== manifestRevisionKey(currentManifest);
    }

    async function checkForManifestUpdate() {
      try {
        const latestManifest = await loadManifest();
        if (isManifestNewer(latestManifest, state.manifest)) {
          state.pendingManifest = latestManifest;
          state.hasFreshUpdate = true;
        } else {
          state.pendingManifest = null;
          state.hasFreshUpdate = false;
        }
        updateHeaderStatus();
      } catch (_error) {
      }
    }

    function startManifestPolling() {
      if (state.manifestPollId) {
        clearInterval(state.manifestPollId);
      }
      state.manifestPollId = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          void checkForManifestUpdate();
        }
      }, 30000);
    }

    async function render() {
      errorBox.hidden = true;
      list.innerHTML = '<div class="empty-cell">読み込み中...</div>';
      state.picks = loadScannerPicks();
      updateIndexHeaderActions();
      renderTagOptions();
      renderThemeOptions();
      const turnoverRecords = filterByTurnover(state.overview.records || [], state.turnover);
      const priceFilteredRecords = filterByMinimumClose(turnoverRecords, INDEX_SCANNER_MIN_CLOSE);
      const baseFiltered = priceFilteredRecords.filter(
        (record) => (!state.tag || record.industry === state.tag) && (!state.theme || (record.themes || []).includes(state.theme))
      );
      let scannerBase = baseFiltered;
      if (state.sort === "lower_shadow") {
        scannerBase = baseFiltered.filter(isLowerShadowCandidate);
      } else if (state.sort === "stop_high") {
        scannerBase = baseFiltered.filter((record) => getStopHighStatus(record) !== "none");
      } else if (state.sort === "new_high_20d") {
        scannerBase = baseFiltered.filter((record) => record.newHigh20d === true);
      } else if (isDeviationSort(state.sort)) {
        const deviationFilter = getActiveDeviationFilter(state);
        scannerBase = baseFiltered.filter((record) => {
          const deviationValue = getDeviationValueBySort(record, state.sort);
          return deviationValue != null && matchesDeviationFilter(deviationValue, deviationFilter.mode, deviationFilter.min, deviationFilter.max);
        });
      } else if (state.sort === "trend_turn") {
        scannerBase = baseFiltered.filter((record) => record.trendTurnCandidate === true);
      } else if (state.sort === "rebound_signal") {
        scannerBase = baseFiltered.filter((record) => String(record.signalCategory || "") !== "none");
      }
      const filtered = sortScannerRecords(scannerBase, state.sort).slice(0, state.limit);
      state.visibleRecords = filtered;
      syncIndexScannerUrl(
        state.selectedDate,
        state.sort,
        state.tag,
        state.theme,
        state.turnover,
        state.limit,
        state.rangeMonths,
        state.timeframe,
        state.deviationFilters
      );
      if (stickySortSelect) {
        stickySortSelect.value = state.sort;
      }
      if (stickyLimitSelect) {
        stickyLimitSelect.value = String(state.limit);
      }
      if (stickyTurnoverSelect) {
        stickyTurnoverSelect.value = String(state.turnover);
      }
      updateStickyTimeframeUI();
      updateRangeChip();
      updateStickyFiltersUi();
      updateHeaderStatus();

      if (!filtered.length) {
        if (selectAllPicksButton) {
          selectAllPicksButton.disabled = true;
        }
        if (stickySelectAllPicksButton) {
          stickySelectAllPicksButton.disabled = true;
        }
        list.innerHTML = '<div class="empty-cell">該当する銘柄がありません。</div>';
        return;
      }
      if (selectAllPicksButton) {
        selectAllPicksButton.disabled = false;
      }
      if (stickySelectAllPicksButton) {
        stickySelectAllPicksButton.disabled = false;
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
            value: await loadTickerPayloadWithDiagnostics(record.code, { selectedDate: state.selectedDate }),
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
        const { payload, validation, shape, requestUrl, status, responseBody } = result.value;
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
        renderScannerCompactChart(`scanChart-${record.code}`, record.code, payload.ohlcv, state.selectedDate, state.rangeMonths, {
          timeframe: state.timeframe,
          useBarCount: false,
        });
        const linksElement = document.getElementById(`scanLinks-${record.code}`);
        if (linksElement) {
          linksElement.innerHTML = renderScannerItemLinks(payload, record, state);
        }
      });
    }

    function renderDateControls() {
      updateStickyDateUi();
    }

    function updateDeviation200Controls() {
      const activeKey = getActiveDeviationSortKey(state.sort);
      const activeFilter = getActiveDeviationFilter(state);
      const activeDraft = getActiveDeviationDraft(state);
      const hasSettings = Boolean(activeFilter.mode || activeFilter.min || activeFilter.max);
      const activeLabel = getDeviationSortLabel(activeKey);
      if (dev200Button) {
        dev200Button.hidden = !activeKey;
        dev200Button.classList.toggle("is-active", hasSettings);
        dev200Button.textContent = hasSettings ? "Advanced ON" : "Advanced ▼";
        dev200Button.setAttribute("aria-expanded", activeKey && state.dev200PopoverOpen ? "true" : "false");
      }
      if (deviationPopoverTitle) {
        deviationPopoverTitle.textContent = activeLabel || "Deviation";
      }
      if (dev200Popover) {
        const isOpen = Boolean(activeKey) && state.dev200PopoverOpen;
        dev200Popover.hidden = !isOpen;
        dev200Popover.classList.toggle("is-open", isOpen);
      }
      if (dev200ModeSelect) {
        dev200ModeSelect.value = activeFilter.mode || "gte";
      }
      if (dev200MinInput && dev200MinInput.value !== activeFilter.min) {
        dev200MinInput.value = activeFilter.min;
      }
      if (dev200MaxInput && dev200MaxInput.value !== activeFilter.max) {
        dev200MaxInput.value = activeFilter.max;
      }
      const activeMode = normalizeDeviationFilterInputMode(dev200ModeSelect?.value) || activeFilter.mode || "gte";
      if (dev200MinInput) {
        dev200MinInput.disabled = activeMode === "lte";
      }
      if (dev200MaxInput) {
        dev200MaxInput.disabled = activeMode === "gte";
      }
      if (stickyAdvanced) {
        stickyAdvanced.hidden = !activeKey;
      }
      if (stickyDeviationTitle) {
        stickyDeviationTitle.textContent = activeLabel || "Deviation";
      }
      setStickyDeviationControls(activeDraft);
    }

    function renderCalendar() {
      const minMonth = startOfMonth(parseDate(state.manifest.availableDates[0]));
      const maxMonth = startOfMonth(parseDate(state.manifest.availableDates.at(-1)));
      renderMiniCalendar(
        stickyMiniCalendar || miniCalendar,
        state.calendarMonth || startOfMonth(parseDate(state.selectedDate)),
        state.selectedDate,
        state.manifest.availableDates,
        async (nextDate) => {
          state.stickyDateOpen = false;
          updateStickyDateUi();
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

  async function initPickedPage() {
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
    };

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

    refreshButton?.addEventListener("click", async () => {
      await runRefreshAction(refreshButton, errorBox, async () => {
        state.manifest = await loadManifest();
        state.selectedDate = String(state.manifest.latestDate || "");
        await render();
      });
    });

    try {
      state.manifest = await loadManifest();
      state.selectedDate = String(state.manifest.latestDate || "");
      await render();
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
        revokeExportEntries(state.exportEntries);
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
              <td>${renderTickerIdentity(pick.code, pick.name, { variant: "table", showCode: false })}</td>
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

    async function renderPickedCharts(picks) {
      if (!chartList) {
        return;
      }

      const failures = [];
      const loadedResults = await mapWithConcurrency(picks, CHART_FETCH_CONCURRENCY, async (pick) => {
        try {
          const inspected = await loadTickerPayloadWithDiagnostics(pick.code, { selectedDate: state.selectedDate });
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

      chartItems.forEach((entry) => {
        if (entry.kind !== "success") {
          return;
        }
        const { inspected, record } = entry;
        renderScannerCompactChart(`pickedChart-${record.code}`, record.code, inspected.payload.ohlcv || [], state.selectedDate, state.bars, {
          timeframe: state.timeframe,
          useBarCount: true,
        });
        const linksElement = document.getElementById(`pickedLinks-${record.code}`);
        if (linksElement) {
          linksElement.innerHTML = renderPickedItemLinks(inspected.payload, record, state);
        }
      });

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

  async function initRegisteredPage() {
    const title = document.getElementById("registeredTitle");
    const meta = document.getElementById("registeredMeta");
    const exportMessage = document.getElementById("registeredExportMessage");
    const exportTradingViewButton = document.getElementById("registeredExportTradingViewButton");
    const exportHyperButton = document.getElementById("registeredExportHyperButton");
    const exportList = document.getElementById("registeredExportList");
    const errorBox = document.getElementById("registeredError");
    const chartList = document.getElementById("registeredChartList");
    const tableBody = document.getElementById("registeredTableBody");

    const state = {
      exportEntries: [],
      manifest: null,
      selectedDate: "",
      bars: 63,
      timeframe: "daily",
      set: null,
    };

    try {
      const params = new URLSearchParams(window.location.search);
      const id = String(params.get("id") || "").trim();
      if (!id) {
        throw new Error("登録セットIDが指定されていません。");
      }

      state.set = getRegisteredSetById(id);
      if (!state.set) {
        throw new Error("指定された登録セットが見つかりません。");
      }

      state.manifest = await loadManifest();
      state.selectedDate = resolveRegisteredSelectedDate(state.set, state.manifest);
      renderMeta();
      renderTable();
      bindExportEvents();
      await renderCharts();
      exportMessage.textContent = "登録セットから TradingView 用TXTと HYPER SBI 2 用CSVを生成します。";
    } catch (error) {
      showError(errorBox, error.message);
      if (chartList) {
        chartList.innerHTML = '<div class="empty-cell picked-chart-empty">登録セットを表示できません。</div>';
      }
      if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">登録セットを表示できません。</td></tr>';
      }
      if (exportTradingViewButton) {
        exportTradingViewButton.disabled = true;
      }
      if (exportHyperButton) {
        exportHyperButton.disabled = true;
      }
    }

    function renderMeta() {
      if (title) {
        title.textContent = String(state.set?.name || "登録セット");
      }
      if (meta) {
        meta.textContent = `${formatPickedDateTime(state.set?.registeredAt)} / ${formatNumber(Number(state.set?.count || 0), 0)}銘柄`;
      }
    }

    function renderTable() {
      const items = dedupeScannerPicks(state.set?.items || []);
      if (!tableBody) {
        return;
      }
      if (!items.length) {
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">登録銘柄がありません。</td></tr>';
        return;
      }
      tableBody.innerHTML = items
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.code)}</td>
              <td>${renderTickerIdentity(item.code, item.name || "-", { variant: "table", showCode: false })}</td>
              <td>${escapeHtml(item.market || "-")}</td>
              <td>${escapeHtml(formatPickedDateTime(item.selectedAt))}</td>
            </tr>
          `
        )
        .join("");
    }

    function bindExportEvents() {
      const items = dedupeScannerPicks(state.set?.items || []);
      const hasItems = items.length > 0;
      if (exportTradingViewButton) {
        exportTradingViewButton.disabled = !hasItems;
        exportTradingViewButton.addEventListener("click", () => {
          triggerExportDownloads([buildTradingViewExportEntry(items)]);
          renderExportEntries(exportList, []);
          exportMessage.textContent = "TradingView 用TXTをダウンロードしました。";
        });
      }
      if (exportHyperButton) {
        exportHyperButton.disabled = !hasItems;
        exportHyperButton.addEventListener("click", () => {
          const entries = buildHyperExportEntries(items);
          triggerExportDownloads(entries);
          renderExportEntries(exportList, []);
          exportMessage.textContent = `HYPER SBI 2 用CSVを${formatNumber(items.length, 0)}銘柄でダウンロードしました。`;
        });
      }
    }

    async function renderCharts() {
      if (!chartList) {
        return;
      }
      errorBox.hidden = true;
      const items = dedupeScannerPicks(state.set?.items || []);
      if (!items.length) {
        chartList.innerHTML = '<div class="empty-cell picked-chart-empty">登録銘柄がありません。</div>';
        return;
      }

      const failures = [];
      const loadedResults = await mapWithConcurrency(items, CHART_FETCH_CONCURRENCY, async (item) => {
        try {
          const inspected = await loadTickerPayloadWithDiagnostics(item.code, { selectedDate: state.selectedDate });
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
        chartList.innerHTML = '<div class="empty-cell picked-chart-empty">チャート表示可能な銘柄がありません。</div>';
        if (failures.length) {
          showError(errorBox, `チャート読込に失敗: ${failures.slice(0, 3).join(" / ")}`);
        }
        return;
      }

      if (failures.length) {
        showError(errorBox, `一部のチャート読込に失敗: ${failures.slice(0, 3).join(" / ")}`);
      }

      chartList.innerHTML = chartItems
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
        renderScannerCompactChart(
          `registeredChart-${record.code}`,
          record.code,
          inspected.payload.ohlcv || [],
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
  }

  async function loadManifest() {
    const payload = await fetchJson(MANIFEST_PATH);
    if (!Array.isArray(payload.availableDates) || !payload.latestDate) {
      throw new Error("manifest.json の形式が不正です。");
    }
    return payload;
  }

  async function loadThemeOrder() {
    const payload = await fetchJson(THEME_MAP_PATH);
    const items = Array.isArray(payload?.themes) ? payload.themes : [];
    return items
      .map((item) => String(item?.name || item?.label || "").trim())
      .filter(Boolean);
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
    const suffix = timeframe === "weekly" ? "_weekly" : timeframe === "monthly" ? "_monthly" : "";
    return fetchJson(`./data/overview/${date}/market_pulse${suffix}.json`);
  }

  async function loadRanking(date, key) {
    const path = `./data/rankings/${date}/${key}.json`;
    const response = await fetch(path);
    if (!response.ok) {
      if (key === "lower_shadow" && response.status === 404) {
        return { date, ranking: rankingLabel(key), count: 0, items: [] };
      }
      if (key === "rebound_signal" && response.status === 404) {
        return { date, ranking: rankingLabel(key), count: 0, items: [] };
      }
      throw new Error(`JSON 読み込み失敗: ${path} (${response.status})`);
    }
    return response.json();
  }

  async function loadTickerPayload(code) {
    return fetchJson(`./data/tickers/${code}.json`);
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
    const raw = localStorage.getItem(SCANNER_PICKS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      localStorage.removeItem(SCANNER_PICKS_STORAGE_KEY);
      return {};
    }
  }

  function saveScannerPicks(picks) {
    localStorage.setItem(SCANNER_PICKS_STORAGE_KEY, JSON.stringify(picks));
  }

  function loadRegisteredPicks() {
    const raw = localStorage.getItem(REGISTERED_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
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
    localStorage.setItem(REGISTERED_STORAGE_KEY, JSON.stringify(Array.isArray(records) ? records : []));
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

  function buildRegisteredDisplayName(userLabel, registeredAt) {
    return `${formatYmd(registeredAt)} ${String(userLabel || "").trim()}`;
  }

  function registerAllPicks(picks, userLabel) {
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
      name: buildRegisteredDisplayName(trimmedLabel, registeredAt),
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

  function buildTradingViewExportEntry(items) {
    const blob = createDownloadBlob(toTradingViewText(items));
    return {
      key: "tradingview",
      label: "TradingView",
      fileName: "tradingview_watchlist.txt",
      count: items.length,
      href: blob.url,
      revoke: blob.revoke,
    };
  }

  function buildHyperExportEntries(items) {
    const blob = createDownloadBlob(toHyperSbi2Csv(items), "text/csv;charset=utf-8");
    return [
      {
        key: "hyper",
        label: "HYPER SBI 2",
        fileName: "hyper_sbi2_codes.csv",
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
    const ohlcv = Array.isArray(payload?.ohlcv) ? payload.ohlcv : [];
    if (!ohlcv.length) {
      issues.push("ohlcv missing or empty");
      return { issues, warnings, parsedCandleCount: 0, invalidRowCount: 0, hasSelectedDate: false, selectedDateMissing: false };
    }
    const invalidRows = ohlcv.filter(
      (row) => !row || row.date == null || row.open == null || row.high == null || row.low == null || row.close == null || row.volume == null
    );
    if (invalidRows.length) {
      issues.push(`ohlcv contains ${invalidRows.length} invalid rows`);
    }
    const hasSelectedDate = ohlcv.some((row) => row?.date === selectedDate);
    if (selectedDate && !hasSelectedDate) {
      warnings.push(`selected date ${selectedDate} missing`);
    }
    return {
      issues,
      warnings,
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

  async function fetchJson(path) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`JSON 読み込み失敗: ${path} (${response.status})`);
      }
      return response.json();
    } catch (error) {
      if (typeof window !== "undefined" && window.location?.protocol === "file:") {
        throw new Error("この画面は file:// では開けません。http://127.0.0.1:8010/index.html で開いてください。");
      }
      if (error instanceof TypeError && String(error.message || "").includes("Failed to fetch")) {
        throw new Error("データ取得に失敗しました。http://127.0.0.1:8010/index.html で開いているか確認してください。");
      }
      throw error;
    }
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

  function parseDate(value) {
    return new Date(`${value}T00:00:00`);
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addMonths(date, delta) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + delta);
    return next;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addCalendarMonths(date, delta) {
    return startOfMonth(addMonths(date, delta));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatNumber(value, digits = 2) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    const numericValue = Number(value);
    return numericValue.toLocaleString("ja-JP", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  }

  function formatSignedNumber(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatNumber(value)}`;
  }

  function formatSignedPercent(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    const sign = value > 0 ? "+" : "";
    return `${sign}${Number(value).toFixed(2)}%`;
  }

  function formatRatio(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    return `${Number(value).toFixed(2)}x`;
  }

  function formatPercent(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    return `${Number(value).toFixed(2)}%`;
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
    if (sortKey === "gainers") {
      return items.sort((a, b) => compareNullableNumbers(b.changePercent, a.changePercent));
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
    if (sortKey === "volume") {
      return items.sort((a, b) => compareNullableNumbers(b.volumeRatio25, a.volumeRatio25));
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
    if (sortKey === "trend_turn") {
      return items.sort(
        (a, b) =>
          compareNullableNumbers(b.trendTurnScore, a.trendTurnScore) ||
          compareNullableNumbers(b.trendTurnAboveMa75Ratio, a.trendTurnAboveMa75Ratio) ||
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
    if (sortKey === "deviation25") {
      return items.sort((a, b) => compareNullableNumbers(b.distanceToMa25, a.distanceToMa25));
    }
    if (sortKey === "deviation75") {
      return items.sort((a, b) => compareNullableNumbers(b.distanceToMa75, a.distanceToMa75));
    }
    if (sortKey === "deviation200") {
      return items.sort((a, b) => compareNullableNumbers(b.distanceToMa200, a.distanceToMa200));
    }
    if (sortKey === "lower_shadow") {
      return items.sort(compareLowerShadowRecords);
    }
    if (sortKey === "watch_candidates") {
      return items.sort((a, b) => compareNullableNumbers(b.watchCandidateScore, a.watchCandidateScore));
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

  function scannerSortLabel(sortKey) {
    return {
      gainers: "Gainers",
      stop_high: "Stop High",
      losers: "Losers",
      volume: "Volume",
      code: "Code",
      new_high: "New High",
      new_high_20d: "20D Close High",
      trend_turn: "ベース・リカバリー",
      rebound_signal: "Rebound",
      deviation25: "MA25 Dev",
      deviation75: "MA75 Dev",
      deviation200: "MA200 Dev",
      lower_shadow: "Lower Shadow",
      watch_candidates: "Watchlist",
    }[sortKey] || sortKey;
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
    return records.filter((record) => Number(record.close) >= minimumClose);
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
      layout: { background: { color: "#111827" }, textColor: "#8899ae" },
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
    const selectedIndex = findSelectedIndex(rows, selectedDate);
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
      close: row.close,
      change: row.change,
      changePercent: row.changePercent,
      volume: row.volume,
      high: row.high,
      low: row.low,
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

  function renderPickedScannerItem(record, index, state) {
    const rank = index + 1;
    return `
      <article class="scanner-item picked-scanner-item">
        <div class="scanner-rank-table">
          <table>
            <thead>
              <tr>
                <th class="num scanner-col-rank">Rank</th>
                <th class="scanner-col-code">Code</th>
                <th class="num scanner-col-close">Price</th>
                <th class="num scanner-col-change">Change</th>
                <th class="num scanner-col-volume">Volume</th>
                <th class="num scanner-col-high">High</th>
                <th class="num scanner-col-low">Low</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="num">${formatNumber(rank, 0)}</td>
                <td class="scanner-name-cell">
                  <div class="scanner-name-cell-inner">
                    ${renderTickerIdentity(record.code, record.name, {
                      href: buildTickerUrl(record.code, state.selectedDate, ""),
                      variant: "scanner",
                    })}
                  </div>
                </td>
                <td class="scanner-trade-cell">
                  <div class="scanner-trade-split">
                    <span id="scanTradeDate-${escapeHtml(record.code)}" class="scanner-trade-date">${formatScannerTradeDate(state.selectedDate)}</span>
                    <span id="scanTradePrice-${escapeHtml(record.code)}" class="scanner-trade-price">${formatNumber(record.close)}</span>
                  </div>
                </td>
                <td id="scanChange-${escapeHtml(record.code)}" class="num">
                  ${escapeHtml(formatSignedNumber(record.change))} ${formatSignedPercentHtml(record.changePercent)}
                </td>
                <td id="scanVolume-${escapeHtml(record.code)}" class="num">${formatNumber(record.volume, 0)}</td>
                <td id="scanHigh-${escapeHtml(record.code)}" class="num">${formatNumber(record.high)}</td>
                <td id="scanLow-${escapeHtml(record.code)}" class="num">${formatNumber(record.low)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="scanner-item-chart-wrap">
          <div id="pickedChart-${escapeHtml(record.code)}" class="scanner-chart"></div>
        </div>
        <div class="scanner-item-links scanner-item-links--picked">
          <div id="pickedLinks-${escapeHtml(record.code)}" class="scanner-item-links-main scanner-item-links-main--picked">
            <a class="picked-link-pill" href="${buildTickerUrl(record.code, state.selectedDate, "")}">📈 Detail</a>
          </div>
          <button type="button" class="row-button picked-remove-button picked-card-remove picked-link-pill picked-link-pill--danger" data-remove-pick="${escapeHtml(record.code)}">✕ Remove</button>
        </div>
      </article>
    `;
  }

  function renderRegisteredScannerItem(record, index, state) {
    const rank = index + 1;
    return `
      <article class="scanner-item">
        <div class="scanner-rank-table">
          <table>
            <thead>
              <tr>
                <th class="num scanner-col-rank">順位</th>
                <th class="scanner-col-code">コード</th>
                <th class="num scanner-col-close">取引値</th>
                <th class="num scanner-col-change">前日比</th>
                <th class="num scanner-col-volume">出来高</th>
                <th class="num scanner-col-high">高値</th>
                <th class="num scanner-col-low">安値</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="num">${formatNumber(rank, 0)}</td>
                <td class="scanner-name-cell">
                  <div class="scanner-name-cell-inner">
                    ${renderTickerIdentity(record.code, record.name, {
                      href: buildTickerUrl(record.code, state.selectedDate, ""),
                      variant: "scanner",
                    })}
                  </div>
                </td>
                <td class="scanner-trade-cell">
                  <div class="scanner-trade-split">
                    <span id="scanTradeDate-${escapeHtml(record.code)}" class="scanner-trade-date">${formatScannerTradeDate(state.selectedDate)}</span>
                    <span id="scanTradePrice-${escapeHtml(record.code)}" class="scanner-trade-price">${formatNumber(record.close)}</span>
                  </div>
                </td>
                <td id="scanChange-${escapeHtml(record.code)}" class="num">${escapeHtml(formatSignedNumber(record.change))} ${formatSignedPercentHtml(record.changePercent)}</td>
                <td id="scanVolume-${escapeHtml(record.code)}" class="num">${formatNumber(record.volume, 0)}</td>
                <td id="scanHigh-${escapeHtml(record.code)}" class="num">${formatNumber(record.high)}</td>
                <td id="scanLow-${escapeHtml(record.code)}" class="num">${formatNumber(record.low)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="scanner-item-chart-wrap">
          <div id="registeredChart-${escapeHtml(record.code)}" class="scanner-chart"></div>
        </div>
        <div class="scanner-item-links">
          <div id="registeredLinks-${escapeHtml(record.code)}" class="scanner-item-links-main">
            <a href="${buildTickerUrl(record.code, state.selectedDate, "")}">個別ページ</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderScannerItem(record, index, state) {
    const rank = index + 1;
    const rankingKey = state.sort === "code" ? "" : mapScannerSortToRanking(state.sort);
    const picked = Boolean(state.picks[record.code]);
    const stopHighStatus = getStopHighStatus(record);
    const hasStopHighBadge = stopHighStatus !== "none";
    const stopHighClass = hasStopHighBadge ? " scanner-item-stop-high" : "";
    const stopHighBadgeClass = stopHighStatus === "peeled" ? " scanner-stop-high-badge--peeled" : "";
    const stopHighBadge = hasStopHighBadge
      ? ` <span class="scanner-stop-high-badge${stopHighBadgeClass}">S高</span>`
      : "";
    return `
      <article class="scanner-item${stopHighClass}">
        <div class="scanner-rank-table">
          <table>
            <thead>
              <tr>
                <th class="num scanner-col-rank">順位</th>
                <th class="scanner-col-code">コード</th>
                <th class="num scanner-col-close">取引値</th>
                <th class="num scanner-col-change">前日比</th>
                <th class="num scanner-col-volume">出来高</th>
                <th class="num scanner-col-high">高値</th>
                <th class="num scanner-col-low">安値</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="num">${formatNumber(rank, 0)}</td>
                <td class="scanner-name-cell">
                  <div class="scanner-name-cell-inner scanner-name-cell-inner--with-badge">
                    ${renderTickerIdentity(record.code, record.name, {
                      href: buildTickerUrl(record.code, state.selectedDate, rankingKey),
                      variant: "scanner",
                    })}
                    ${stopHighBadge}
                  </div>
                </td>
                <td class="scanner-trade-cell">
                  <div class="scanner-trade-split">
                    <span id="scanTradeDate-${escapeHtml(record.code)}" class="scanner-trade-date">${formatScannerTradeDate(state.selectedDate)}</span>
                    <span id="scanTradePrice-${escapeHtml(record.code)}" class="scanner-trade-price">${formatNumber(record.close)}</span>
                  </div>
                </td>
                <td id="scanChange-${escapeHtml(record.code)}" class="num">
                  ${escapeHtml(formatSignedNumber(record.change))} ${formatSignedPercentHtml(record.changePercent)}
                </td>
                <td id="scanVolume-${escapeHtml(record.code)}" class="num">${formatNumber(record.volume, 0)}</td>
                <td id="scanHigh-${escapeHtml(record.code)}" class="num">${formatNumber(record.high)}</td>
                <td id="scanLow-${escapeHtml(record.code)}" class="num">${formatNumber(record.low)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="scanner-item-chart-wrap">
          <div id="scanChart-${escapeHtml(record.code)}" class="scanner-chart"></div>
        </div>
        <div class="scanner-item-links">
          <div id="scanLinks-${escapeHtml(record.code)}" class="scanner-item-links-main">
            <a href="${buildTickerUrl(record.code, state.selectedDate, rankingKey)}">Detail</a>
          </div>
          <label class="scanner-pick-toggle">
            <input type="checkbox" data-pick-code="${escapeHtml(record.code)}"${picked ? " checked" : ""} />
            <span>Pick</span>
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
    const links = payload.links || {};
    if (links.quote) {
      items.push({ label: "Yahoo", href: links.quote });
    }
    if (links.ir) {
      items.push({ label: "IR", href: links.ir });
    }
    if (links.official) {
      items.push({ label: "公式サイト", href: links.official });
    }
    if (links.wikipedia) {
      items.push({ label: "Wikipedia", href: links.wikipedia });
    }
    return items
      .filter((item) => item.href)
      .map((item) =>
        item.local
          ? `<a href="${item.href}">${escapeHtml(item.label)}</a>`
          : `<a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>`
      )
      .join('<span class="scanner-link-separator">|</span>');
  }

  function renderPickedItemLinks(payload, record, state) {
    const items = [
      {
        label: "📈 Detail",
        href: buildTickerUrl(record.code, state.selectedDate, ""),
        local: true,
      },
    ];
    const links = payload.links || {};
    if (links.quote) {
      items.push({ label: "↗ Yahoo", href: links.quote });
    }
    return items
      .filter((item) => item.href)
      .map((item) =>
        item.local
          ? `<a class="picked-link-pill" href="${item.href}">${escapeHtml(item.label)}</a>`
          : `<a class="picked-link-pill" href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>`
      )
      .join("");
  }

  const TICKER_NAME_EXACT_ALIASES = new Map([
    ["フジ・メディア・ホールディングス", "フジHD"],
    ["トリドールホールディングス", "トリドールHD"],
    ["三井倉庫ホールディングス", "三井倉庫HD"],
    ["Ｆｉｎａｔｅｘｔホールディングス", "Finatext HD"],
    ["日本電信電話", "NTT"],
    ["東京電力ホールディングス", "東京電力HD"],
    ["デリカフーズホールディングス", "デリカフーズHD"],
    ["Ｇｒｅｅｎ　Ｅａｒｔｈ　Ｉｎｓｔｉｔｕｔｅ", "Green Earth Inst."],
  ]);

  const TICKER_NAME_REPLACEMENTS = [
    [/ホールディングス/g, "HD"],
    [/ホールディング/g, "HD"],
    [/ＨＤ/g, "HD"],
  ];

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

  function setScannerTableValues(code, row) {
    if (!row) {
      return;
    }
    const tradeDate = document.getElementById(`scanTradeDate-${code}`);
    const tradePrice = document.getElementById(`scanTradePrice-${code}`);
    const change = document.getElementById(`scanChange-${code}`);
    const volume = document.getElementById(`scanVolume-${code}`);
    const high = document.getElementById(`scanHigh-${code}`);
    const low = document.getElementById(`scanLow-${code}`);
    if (tradeDate) {
      tradeDate.textContent = formatScannerTradeDate(row.date);
    }
    if (tradePrice) {
      tradePrice.textContent = formatNumber(row.close);
    }
    if (change) {
      change.innerHTML = `${escapeHtml(formatSignedNumber(row.change))} ${formatSignedPercentHtml(row.changePercent)}`;
      change.className = "num";
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
    const visibleRows = useBarCount
      ? selectRowsByBarWindow(chartRows, selectedIndex, rangeValue)
      : selectRowsByMonths(chartRows, selectedDate, rangeValue, {
          selectedIndex,
          extendToLatest: Boolean(options.extendToLatest),
        });
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
      layout: { background: { color: "#111827" }, textColor: "#8899ae", fontSize: 8 },
      rightPriceScale: {
        borderColor: "rgba(30, 58, 95, 0.4)",
        scaleMargins: { top: 0.05, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "rgba(30, 58, 95, 0.4)",
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
      if (clickedRow && typeof options.onRowSelect === "function") {
        options.onRowSelect(clickedRow);
      }
    });
    const timeScale = chart.timeScale();
    const visibleCount = visibleRows.length;
    timeScale.setVisibleLogicalRange({
      from: -0.5,
      to: visibleCount - 1 + 3,
    });
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
    renderCompactStyleChart(element, rows, selectedDate, rangeValue, {
      ...options,
      code,
      height: 173,
      onInitialRow: (row) => setScannerTableValues(code, row),
      onRowSelect: (row) => setScannerTableValues(code, row),
    });
  }

  function renderTickerChart(element, rows, selectedIndex, modeKey, chartMeta, onRowSelect) {
    const selectedRow = rows[selectedIndex];
    if (!selectedRow) {
      return;
    }
    const mode = getTickerChartMode(modeKey);
    renderCompactStyleChart(element, rows, selectedRow.date, mode.rangeValue, {
      height: 346,
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

  function syncIndexScannerUrl(date, sort, tag, theme, turnover, limit, rangeMonths, timeframe, deviationFilters = {}) {
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
    params.set("turnover", String(turnover));
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

  const DEVIATION_SORT_KEYS = ["deviation25", "deviation75", "deviation200"];
  const DEVIATION_URL_KEY_MAP = { deviation25: "dev25", deviation75: "dev75", deviation200: "dev200" };

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

  function roundNumber(value, digits = 4) {
    if (value == null || Number.isNaN(value)) {
      return null;
    }
    return Number(value.toFixed(digits));
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
      trend_turn: "trend_turn",
      rebound_signal: "rebound_signal",
      deviation25: "deviation25",
      deviation75: "deviation75",
      deviation200: "deviation200",
      lower_shadow: "lower_shadow",
      watch_candidates: "watch_candidates",
      code: "",
    }[sortKey] || "";
  }
})();
