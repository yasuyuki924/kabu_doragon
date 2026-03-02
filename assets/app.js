(function () {
  const MANIFEST_PATH = "./data/manifest.json";
  const THEME_MAP_PATH = "./data/theme_map.json";
  const WATCHLIST_PATH = "./data/watchlist.json";
  const WATCHLIST_STORAGE_KEY = "local-stock-dashboard.watchlist.v6";
  const SCANNER_PICKS_STORAGE_KEY = "local-stock-dashboard.scanner-picks.v1";
  const NOTE_STORAGE_PREFIX = "local-stock-dashboard.note.";
  const PERIOD_MONTHS = [1, 2, 3, 4, 5, 6];
  const RANKING_CONFIG = [
    { key: "gainers", label: "値上がり率" },
    { key: "losers", label: "値下がり率" },
    { key: "volume_spike", label: "出来高増加" },
    { key: "new_high", label: "新高値" },
    { key: "deviation25", label: "25日線乖離" },
    { key: "deviation75", label: "75日線乖離" },
    { key: "deviation200", label: "200日線乖離" },
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
  const INDEX_SCANNER_BARS = [21, 63, 126, 252];
  const INDEX_SCANNER_TIMEFRAMES = ["daily", "weekly", "monthly"];
  const INDEX_SCANNER_TURNOVER_OPTIONS = [0, 50000000, 100000000, 500000000, 1000000000];

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
      meta.textContent = `${state.selectedDate} / ${filtered.length}件${state.activeType ? ` | 種類: ${typeFilterLabel(state.activeType)}` : ""}${state.activeMarket ? ` | 市場: ${state.activeMarket}` : ""}${state.activeIndustry ? ` | 業種: ${state.activeIndustry}` : ""}${state.activeTheme ? ` | テーマ: ${state.activeTheme}` : ""}`;
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
              <td>${escapeHtml(record.name)}</td>
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
      selectedMonths: 3,
      selectedDate: "",
    };

    periodButtons.innerHTML = PERIOD_MONTHS.map(
      (month) => `<button class="period-button${month === state.selectedMonths ? " active" : ""}" data-months="${month}">${month}ヶ月</button>`
    ).join("");

    Array.from(periodButtons.querySelectorAll(".period-button")).forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedMonths = Number(button.dataset.months);
        updatePeriodButtonState(periodButtons, state.selectedMonths);
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

    function renderTicker() {
      const rows = state.payload.ohlcv || [];
      const selectedIndex = findSelectedIndex(rows, state.selectedDate);
      if (selectedIndex < 0) {
        showError(errorBox, `${code} の ${state.selectedDate} 時点データがありません。`);
        return;
      }
      const row = rows[selectedIndex];
      state.selectedDate = row.date;
      tickerDatePicker.value = row.date;
      syncTickerUrl(code, state.selectedDate, state.rankingKey);
      if (backLink) {
        backLink.href = `./index.html?date=${encodeURIComponent(state.selectedDate)}`;
      }

      tickerTitle.textContent = `${code} ${state.payload.name}`.trim();
      tickerMeta.textContent = [
        state.payload.market || "市場未設定",
        `${state.selectedDate} 基準`,
        state.payload.tags?.length ? `タグ: ${state.payload.tags.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" / ");

      summaryDate.textContent = state.selectedDate;
      summaryRank.textContent = state.rankingItem ? `${state.rankingItem.rank}位` : "-";
      summaryClose.textContent = formatNumber(row.close);
      summaryChange.textContent = `${formatSignedNumber(row.change)} (${formatSignedPercent(row.changePercent)})`;
      summaryChange.className = `summary-value ${getChangeClass(row.changePercent)}`;
      summaryOpen.textContent = formatNumber(row.open);
      summaryRange.textContent = `${formatNumber(row.high)} / ${formatNumber(row.low)}`;
      summaryVolume.textContent = formatNumber(row.volume, 0);
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

      externalLinks.innerHTML = Object.entries(state.payload.links || {})
        .filter(([, href]) => href)
        .map(
          ([label, href]) =>
            `<a class="link-pill" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
        )
        .join("");

      renderTickerChart(chartEl, rows, selectedIndex, state.selectedMonths, chartMeta);
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
      meta.textContent = `${state.selectedDate} / ${filtered.length}銘柄 / 並び順: ${scannerSortLabel(state.sort)} / 期間: ${indexScannerPeriodLabel(state.months)}`;

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

      for (const record of filtered) {
        try {
          const payload = await loadTickerPayload(record.code);
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
        } catch (error) {
          showError(errorBox, `一部のチャート読込に失敗: ${error.message}`);
        }
      }
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
    const tagSelect = document.getElementById("indexTag");
    const themeSelect = document.getElementById("indexTheme");
    const turnoverSelect = document.getElementById("indexTurnover");
    const limitSelect = document.getElementById("indexLimit");
    const barsSelect = document.getElementById("indexBars");
    const timeframeSelect = document.getElementById("indexTimeframe");
    const pickedLink = document.getElementById("indexPickedLink");
    const resetPicksButton = document.getElementById("indexResetPicksButton");
    const miniCalendar = document.getElementById("indexMiniCalendar");
    const dateMeta = document.getElementById("indexDateMeta");
    const meta = document.getElementById("indexMeta");
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
      bars: 63,
      timeframe: "daily",
      selectedDate: "",
      calendarMonth: null,
      picks: {},
      themeOrder: [],
    };

    const params = new URLSearchParams(window.location.search);
    state.sort = params.get("sort") || state.sort;
    state.tag = params.get("tag") || "";
    state.theme = params.get("theme") || "";
    state.turnover = INDEX_SCANNER_TURNOVER_OPTIONS.includes(Number(params.get("turnover")))
      ? Number(params.get("turnover"))
      : 0;
    state.limit = INDEX_SCANNER_LIMITS.includes(Number(params.get("limit"))) ? Number(params.get("limit")) : state.limit;
    state.bars = INDEX_SCANNER_BARS.includes(Number(params.get("bars"))) ? Number(params.get("bars")) : state.bars;
    state.timeframe = INDEX_SCANNER_TIMEFRAMES.includes(params.get("timeframe")) ? params.get("timeframe") : state.timeframe;
    state.picks = loadScannerPicks();
    sortSelect.value = state.sort;
    themeSelect.value = state.theme;
    turnoverSelect.value = String(state.turnover);
    limitSelect.value = String(state.limit);
    barsSelect.value = String(state.bars);
    timeframeSelect.value = state.timeframe;
    if (pickedLink) {
      pickedLink.href = "./picked.html";
    }

    [sortSelect, tagSelect, themeSelect, turnoverSelect, limitSelect, barsSelect, timeframeSelect].forEach((control) => {
      control.addEventListener("change", async () => {
        state.sort = sortSelect.value;
        state.tag = tagSelect.value;
        state.theme = themeSelect.value;
        state.turnover = Number(turnoverSelect.value);
        state.limit = Number(limitSelect.value);
        state.bars = Number(barsSelect.value);
        state.timeframe = timeframeSelect.value;
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
      state.themeOrder = await loadThemeOrder();
      await loadDate(params.get("date") || state.manifest.latestDate);
      await render();
    } catch (error) {
      showError(errorBox, error.message);
    }

    async function loadDate(requestedDate) {
      state.selectedDate = resolveAvailableDate(requestedDate, state.manifest.availableDates);
      state.overview = await loadOverview(state.selectedDate);
      state.calendarMonth = startOfMonth(parseDate(state.selectedDate));
      renderTagOptions();
      renderDateControls();
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
      tagSelect.innerHTML = ['<option value="">すべて</option>']
        .concat(industries.map((industry) => `<option value="${escapeHtml(industry)}">${escapeHtml(industry)}</option>`))
        .join("");
      if (state.tag && !industries.includes(state.tag)) {
        state.tag = "";
      }
      tagSelect.value = state.tag;
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
        .map((theme) => `<option value="${escapeHtml(theme)}">${escapeHtml(theme || "すべて")}</option>`)
        .join("");
      if (state.theme && !availableThemes.has(state.theme)) {
        state.theme = "";
      }
      themeSelect.value = state.theme;
    }

    async function render() {
      errorBox.hidden = true;
      list.innerHTML = '<div class="empty-cell">読み込み中...</div>';
      renderTagOptions();
      renderThemeOptions();
      const turnoverRecords = filterByTurnover(state.overview.records || [], state.turnover);
      const filtered = sortScannerRecords(
        turnoverRecords.filter(
          (record) => (!state.tag || record.industry === state.tag) && (!state.theme || (record.themes || []).includes(state.theme))
        ),
        state.sort
      ).slice(0, state.limit);
      syncIndexScannerUrl(
        state.selectedDate,
        state.sort,
        state.tag,
        state.theme,
        state.turnover,
        state.limit,
        state.bars,
        state.timeframe
      );
      renderCalendar();
      meta.textContent = `基準日: ${state.selectedDate}`;

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

      for (const record of filtered) {
        try {
          const payload = await loadTickerPayload(record.code);
          renderScannerCompactChart(`scanChart-${record.code}`, record.code, payload.ohlcv, state.selectedDate, state.bars, {
            timeframe: state.timeframe,
            useBarCount: true,
          });
          const linksElement = document.getElementById(`scanLinks-${record.code}`);
          if (linksElement) {
            linksElement.innerHTML = renderScannerItemLinks(payload, record, state);
          }
        } catch (error) {
          showError(errorBox, `一部のチャート読込に失敗: ${error.message}`);
        }
      }
    }

    function renderDateControls() {
      dateMeta.textContent = `${state.selectedDate}基準 / ${state.manifest.availableDates.length}営業日保存 / 最新 ${state.manifest.latestDate}`;
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

  function initPickedPage() {
    const count = document.getElementById("pickedCount");
    const exportMessage = document.getElementById("pickedExportMessage");
    const exportTradingViewButton = document.getElementById("pickedExportTradingViewButton");
    const exportHyperButton = document.getElementById("pickedExportHyperButton");
    const exportList = document.getElementById("pickedExportList");
    const errorBox = document.getElementById("pickedError");
    const body = document.getElementById("pickedTableBody");
    const state = {
      exportEntries: [],
    };

    exportTradingViewButton?.addEventListener("click", () => {
      const picks = dedupeScannerPicks(sortedScannerPicks(loadScannerPicks()));
      replaceExportEntries(state, [buildTradingViewExportEntry(picks)], exportList);
      exportMessage.textContent = "出力候補は毎回最新だけ表示します。過去に保存したダウンロードファイルは自動削除されません。";
    });

    exportHyperButton?.addEventListener("click", () => {
      const picks = dedupeScannerPicks(sortedScannerPicks(loadScannerPicks()));
      replaceExportEntries(state, buildHyperExportEntries(picks), exportList);
      exportMessage.textContent = "出力候補は毎回最新だけ表示します。過去に保存したダウンロードファイルは自動削除されません。";
    });

    try {
      render();
    } catch (error) {
      showError(errorBox, error.message);
    }

    function render() {
      const picks = sortedScannerPicks(loadScannerPicks());
      count.textContent = `${formatNumber(picks.length, 0)}件`;
      errorBox.hidden = true;
      const hasPicks = picks.length > 0;
      if (exportTradingViewButton) {
        exportTradingViewButton.disabled = !hasPicks;
      }
      if (exportHyperButton) {
        exportHyperButton.disabled = !hasPicks;
      }
      if (!picks.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty-cell">選別銘柄はありません。トップ画面でチェックしてください。</td></tr>';
        revokeExportEntries(state.exportEntries);
        state.exportEntries = [];
        renderExportEntries(exportList, []);
        exportMessage.textContent = "選別銘柄がないため出力できません。";
        return;
      }

      body.innerHTML = picks
        .map(
          (pick) => `
            <tr>
              <td>${escapeHtml(pick.code)}</td>
              <td>${escapeHtml(pick.name)}</td>
              <td>${escapeHtml(pick.market)}</td>
              <td>${escapeHtml(formatPickedDateTime(pick.selectedAt))}</td>
              <td><button type="button" class="row-button picked-remove-button" data-remove-pick="${escapeHtml(pick.code)}">解除</button></td>
            </tr>
          `
        )
        .join("");

      Array.from(body.querySelectorAll("button[data-remove-pick]")).forEach((button) => {
        button.addEventListener("click", () => {
          const next = loadScannerPicks();
          delete next[button.dataset.removePick];
          saveScannerPicks(next);
          exportMessage.textContent = "選別内容が変わりました。必要なら再作成してください。";
          render();
        });
      });

      if (!state.exportEntries.length) {
        exportMessage.textContent = "選別済み銘柄から TradingView 用TXTと HYPER SBI 2 用CSVを生成します。";
        exportList.innerHTML = "";
      }
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

  async function loadOverview(date) {
    return fetchJson(`./data/overview/${date}/market_pulse.json`);
  }

  async function loadRanking(date, key) {
    return fetchJson(`./data/rankings/${date}/${key}.json`);
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

  function buildScannerPickPayload(record) {
    return {
      code: String(record.code || record.ticker || "").trim(),
      name: String(record.name || "").trim(),
      market: String(record.market || "").trim(),
      selectedAt: new Date().toISOString(),
    };
  }

  function toggleScannerPick(record, checked, state) {
    const code = String(record.code || record.ticker || "").trim();
    if (!code) {
      return;
    }
    if (checked) {
      state.picks[code] = buildScannerPickPayload(record);
    } else {
      delete state.picks[code];
    }
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

  function chunkScannerPicks(items, size = 50) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
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
    return chunkScannerPicks(items, 50).map((chunk, index) => {
      const blob = createDownloadBlob(toHyperSbi2Csv(chunk), "text/csv;charset=utf-8");
      return {
        key: `hyper-${index + 1}`,
        label: "HYPER SBI 2",
        fileName: `hyper_sbi2_codes_${String(index + 1).padStart(2, "0")}.csv`,
        count: chunk.length,
        href: blob.url,
        revoke: blob.revoke,
      };
    });
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

  async function fetchJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`JSON 読み込み失敗: ${path} (${response.status})`);
    }
    return response.json();
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

  function average(values) {
    if (!values.length) {
      return null;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  function updatePeriodButtonState(container, selectedMonths) {
    Array.from(container.querySelectorAll(".period-button")).forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.months) === selectedMonths);
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
                <td><a href="${detailUrl}">${escapeHtml(record.code)} ${escapeHtml(record.name)}</a></td>
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
      <div class="mini-calendar-title-row">
        <div class="mini-calendar-title">今月</div>
      </div>
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
    if (sortKey === "deviation25") {
      return items.sort((a, b) => compareNullableNumbers(b.distanceToMa25, a.distanceToMa25));
    }
    if (sortKey === "deviation75") {
      return items.sort((a, b) => compareNullableNumbers(b.distanceToMa75, a.distanceToMa75));
    }
    if (sortKey === "deviation200") {
      return items.sort((a, b) => compareNullableNumbers(b.distanceToMa200, a.distanceToMa200));
    }
    if (sortKey === "watch_candidates") {
      return items.sort((a, b) => compareNullableNumbers(b.watchCandidateScore, a.watchCandidateScore));
    }
    return items.sort((a, b) => String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" }));
  }

  function scannerSortLabel(sortKey) {
    return {
      gainers: "値上がり率順",
      losers: "値下がり率順",
      volume: "出来高増加順",
      code: "コード順",
      new_high: "新高値順",
      deviation25: "25日線乖離順",
      deviation75: "75日線乖離順",
      deviation200: "200日線乖離順",
      watch_candidates: "監視候補順",
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

  function turnoverLabel(value) {
    return {
      0: "0",
      50000000: "5000万",
      100000000: "1億",
      500000000: "5億",
      1000000000: "10億",
    }[Number(value)] || "0";
  }

  function indexScannerPeriodLabel(months) {
    return `${indexScannerBarCountFromMonths(months)}（${months}ヶ月）`;
  }

  function indexScannerBarCountFromMonths(months) {
    return {
      1: 21,
      3: 63,
      6: 126,
      12: 252,
    }[Number(months)] || 63;
  }

  function indexScannerBarLabel(bars) {
    return `${bars}本`;
  }

  function indexScannerTimeframeLabel(timeframe) {
    return {
      daily: "日足",
      weekly: "週足",
      monthly: "月足",
    }[timeframe] || "日足";
  }

  function renderMiniChart(elementId, rows, selectedDate, months) {
    const element = document.getElementById(elementId);
    if (!element || !window.LightweightCharts) {
      return;
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
      layout: { background: { color: "#ffffff" }, textColor: "#5b6773" },
      rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.3 } },
      timeScale: { borderColor: "#d7dde5" },
      grid: { vertLines: { color: "#eef2f7" }, horzLines: { color: "#eef2f7" } },
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#d9485f",
      downColor: "#2b6cb0",
      borderVisible: false,
      wickUpColor: "#d9485f",
      wickDownColor: "#2b6cb0",
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
      color: "rgba(76, 99, 133, 0.35)",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });
    volumeSeries.setData(
      visibleRows.map((row) => ({
        time: row.date,
        value: row.volume,
        color: row.close >= row.open ? "rgba(217, 72, 95, 0.35)" : "rgba(43, 108, 176, 0.35)",
      }))
    );
    [5, 25, 75].forEach((windowSize, index) => {
      const series = chart.addLineSeries({
        color: ["#16a34a", "#f59e0b", "#6d28d9"][index],
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

  function renderScannerItem(record, index, state) {
    const rank = index + 1;
    const rankingKey = state.sort === "code" ? "" : mapScannerSortToRanking(state.sort);
    const picked = Boolean(state.picks[record.code]);
    return `
      <article class="scanner-item">
        <div class="scanner-rank-table">
          <table>
            <thead>
              <tr>
                <th class="num scanner-col-rank">順位</th>
                <th class="scanner-col-code">コード</th>
                <th class="scanner-col-name">名称</th>
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
                <td>${escapeHtml(record.code)}</td>
                <td class="scanner-name-cell">
                  <a
                    class="${scannerNameClass(record.name)}"
                    href="${buildTickerUrl(record.code, state.selectedDate, rankingKey)}"
                    title="${escapeHtml(record.name)}"
                  >
                    ${escapeHtml(record.name)}
                  </a>
                </td>
                <td class="scanner-trade-cell">
                  <div class="scanner-trade-split">
                    <span id="scanTradeDate-${escapeHtml(record.code)}" class="scanner-trade-date">${formatScannerTradeDate(state.selectedDate)}</span>
                    <span id="scanTradePrice-${escapeHtml(record.code)}" class="scanner-trade-price">${formatNumber(record.close)}</span>
                  </div>
                </td>
                <td id="scanChange-${escapeHtml(record.code)}" class="num ${getChangeClass(record.changePercent)}">
                  ${formatSignedNumber(record.change)} ${formatSignedPercent(record.changePercent)}
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
            <a href="${buildTickerUrl(record.code, state.selectedDate, rankingKey)}">個別ページ</a>
          </div>
          <label class="scanner-pick-toggle">
            <input type="checkbox" data-pick-code="${escapeHtml(record.code)}"${picked ? " checked" : ""} />
            <span>選別</span>
          </label>
        </div>
      </article>
    `;
  }

  function renderScannerItemLinks(payload, record, state) {
    const rankingKey = state.sort === "code" ? "" : mapScannerSortToRanking(state.sort);
    const items = [
      {
        label: "個別ページ",
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
      change.textContent = `${formatSignedNumber(row.change)} ${formatSignedPercent(row.changePercent)}`;
      change.className = `num ${getChangeClass(row.changePercent)}`.trim();
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

  function renderScannerCompactChart(elementId, code, rows, selectedDate, rangeValue, options = {}) {
    const element = document.getElementById(elementId);
    if (!element || !window.LightweightCharts) {
      return;
    }
    element.innerHTML = "";
    const timeframe = options.timeframe || "daily";
    const useBarCount = Boolean(options.useBarCount);
    const chartRows = buildScannerChartRows(rows, timeframe);
    const selectedIndex = findSelectedChartIndex(chartRows, selectedDate, timeframe);
    if (selectedIndex < 0) {
      return;
    }
    const visibleRows = useBarCount
      ? selectRowsByBarWindow(chartRows, selectedIndex, rangeValue)
      : selectRowsByMonths(chartRows, selectedDate, rangeValue);
    if (!visibleRows.length) {
      return;
    }
    const baseRow = chartRows[selectedIndex];
    setScannerTableValues(code, baseRow);
    const chart = window.LightweightCharts.createChart(element, {
      height: 173,
      layout: { background: { color: "#ffffff" }, textColor: "#111111", fontSize: 8 },
      rightPriceScale: {
        borderColor: "#c8d4e3",
        scaleMargins: { top: 0.05, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "#c8d4e3",
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
      grid: { vertLines: { color: "#edf2f7" }, horzLines: { color: "#edf2f7" } },
      crosshair: {
        vertLine: { visible: false, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4a60",
      downColor: "#2d6fb2",
      borderVisible: true,
      borderUpColor: "#ef4a60",
      borderDownColor: "#2d6fb2",
      wickUpColor: "#ef4a60",
      wickDownColor: "#2d6fb2",
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
    candleSeries.setMarkers([
      {
        time: baseRow.date,
        position: "aboveBar",
        color: "#6b7280",
        shape: "circle",
        text: selectedDate.slice(5),
      },
    ]);
    const volumeColor = "rgba(110, 110, 110, 0.42)";
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: volumeColor,
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
      [5, "#d9485f"],
      [25, "#2b6cb0"],
      [75, "#2f855a"],
      [200, "#f59e0b"],
    ].forEach(([windowSize, color]) => {
      const series = chart.addLineSeries({
        color,
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
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
      if (clickedRow) {
        setScannerTableValues(code, clickedRow);
      }
    });
    const timeScale = chart.timeScale();
    const visibleCount = visibleRows.length;
    timeScale.setVisibleLogicalRange({
      from: -0.5,
      to: visibleCount - 1 + 3,
    });
  }

  function renderTickerChart(element, rows, selectedIndex, months, chartMeta) {
    if (!element || !window.LightweightCharts) {
      return;
    }
    element.innerHTML = "";
    const anchorDate = parseDate(rows[selectedIndex].date);
    const cutoff = addMonths(anchorDate, -months);
    const visibleRows = rows.filter((row, index) => parseDate(row.date) >= cutoff && index <= selectedIndex + 10);
    if (!visibleRows.length) {
      return;
    }

    chartMeta.textContent = `${rows[selectedIndex].date} 基準 / ${visibleRows[0].date} - ${visibleRows[visibleRows.length - 1].date}`;
    const chart = window.LightweightCharts.createChart(element, {
      height: 720,
      layout: { background: { color: "#ffffff" }, textColor: "#111111", fontSize: 11 },
      rightPriceScale: {
        borderColor: "#c8d4e3",
        scaleMargins: { top: 0.05, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "#c8d4e3",
        rightOffset: 0,
        barSpacing: 9,
        minBarSpacing: 6,
        fixLeftEdge: true,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time, tickMarkType) => formatScannerTickMark(time, tickMarkType),
      },
      grid: { vertLines: { color: "#edf2f7" }, horzLines: { color: "#edf2f7" } },
      handleScroll: false,
      handleScale: false,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4a60",
      downColor: "#2d6fb2",
      borderVisible: true,
      borderUpColor: "#ef4a60",
      borderDownColor: "#2d6fb2",
      wickUpColor: "#ef4a60",
      wickDownColor: "#2d6fb2",
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
    candleSeries.setMarkers([
      {
        time: rows[selectedIndex].date,
        position: "aboveBar",
        color: "#6b7280",
        shape: "circle",
        text: rows[selectedIndex].date.slice(5),
      },
    ]);

    const volumeColor = "rgba(110, 110, 110, 0.42)";
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: volumeColor,
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
      [5, "#d9485f"],
      [25, "#2b6cb0"],
      [75, "#2f855a"],
      [200, "#1f2937"],
    ].forEach(([windowSize, color]) => {
      const series = chart.addLineSeries({
        color,
        lineWidth: Number(windowSize) === 200 ? 1 : 1.5,
        lastValueVisible: false,
        priceLineVisible: false,
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
    const visibleCount = visibleRows.length;
    timeScale.setVisibleLogicalRange({
      from: -0.5,
      to: visibleCount - 1 + 3,
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

  function syncTickerUrl(code, date, rankingKey) {
    const params = new URLSearchParams(window.location.search);
    params.set("code", code);
    params.set("date", date);
    if (rankingKey) {
      params.set("from", rankingKey);
    } else {
      params.delete("from");
    }
    history.replaceState({}, "", `./ticker.html?${params.toString()}`);
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

  function syncIndexScannerUrl(date, sort, tag, theme, turnover, limit, bars, timeframe) {
    const params = new URLSearchParams(window.location.search);
    params.set("date", date);
    params.set("sort", sort);
    params.set("limit", String(limit));
    params.set("bars", String(bars));
    params.set("timeframe", timeframe);
    params.delete("months");
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
    params.delete("condition");
    history.replaceState({}, "", `./index.html?${params.toString()}`);
  }

  function selectRowsByMonths(rows, selectedDate, months) {
    const selectedIndex = findSelectedIndex(rows, selectedDate);
    if (selectedIndex < 0) {
      return [];
    }
    const anchorDate = parseDate(rows[selectedIndex].date);
    const cutoff = addMonths(anchorDate, -months);
    return rows.filter((row, index) => parseDate(row.date) >= cutoff && index <= selectedIndex + 8);
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
      losers: "losers",
      volume: "volume_spike",
      new_high: "new_high",
      deviation25: "deviation25",
      deviation75: "deviation75",
      deviation200: "deviation200",
      watch_candidates: "watch_candidates",
      code: "",
    }[sortKey] || "";
  }
})();
