(function () {
  const MANIFEST_PATH = "./data/manifest.json";
  const WATCHLIST_PATH = "./data/watchlist.json";
  const WATCHLIST_STORAGE_KEY = "local-stock-dashboard.watchlist.v5";
  const NOTE_STORAGE_PREFIX = "local-stock-dashboard.note.";
  const PERIOD_MONTHS = [1, 2, 3, 4, 5, 6];
  const RANKING_CONFIG = [
    { key: "gainers", elementId: "rankingUpBody", label: "値上がり率" },
    { key: "losers", elementId: "rankingDownBody", label: "値下がり率" },
    { key: "volume_spike", elementId: "rankingVolumeBody", label: "出来高増加" },
    { key: "new_high", elementId: "rankingPriceBody", label: "新高値" },
    { key: "deviation25", elementId: "rankingMomentumBody", label: "25日線乖離" },
    { key: "watch_candidates", elementId: "rankingWatchBody", label: "監視候補" },
  ];
  const TSE_MARKETS = new Set(["TSE", "プライム", "スタンダード", "グロース"]);

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (page === "watchlist") {
      initWatchlistPage();
    }
    if (page === "ticker") {
      initTickerPage();
    }
    if (page === "scanner") {
      initScannerPage();
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
    const marketFilters = document.getElementById("marketFilters");
    const industryFilters = document.getElementById("tagFilters");
    const addTickerButton = document.getElementById("addTickerButton");
    const resetWatchlistButton = document.getElementById("resetWatchlistButton");
    const editorPanel = document.getElementById("editorPanel");
    const editorTitle = document.getElementById("editorTitle");
    const cancelEditorButton = document.getElementById("cancelEditorButton");
    const tickerForm = document.getElementById("tickerForm");
    const rankingContainers = new Map(
      RANKING_CONFIG.map((item) => [item.key, document.getElementById(item.elementId)])
    );

    const state = {
      manifest: null,
      watchlist: [],
      selectedDate: "",
      overview: null,
      rankings: {},
      query: "",
      sortKey: "ticker",
      sortDirection: "asc",
      activeMarket: "",
      activeIndustry: "",
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
      syncIndexUrl(selectedDate);
      renderDateControls();
      render();
    }

    function renderDateControls() {
      const availableDates = state.manifest.availableDates;
      dateMeta.textContent = `${state.selectedDate}基準 / ${availableDates.length}営業日保存 / 最新 ${state.manifest.latestDate}`;
    }

    function render() {
      const mergedRecords = mergeOverviewWithWatchlist(state.overview?.records || [], state.watchlist, state.selectedDate);

      renderMarketFilters(marketFilters, mergedRecords, state.activeMarket, (market) => {
        state.activeMarket = market;
        render();
      });
      renderIndustryFilters(industryFilters, mergedRecords, state.activeIndustry, (industry) => {
        state.activeIndustry = industry;
        render();
      });

      const filtered = mergedRecords
        .filter((record) => matchesFilter(record, state.query, state.activeMarket, state.activeIndustry))
        .sort((left, right) => compareRecords(left, right, state.sortKey, state.sortDirection));

      const risers = filtered.filter((record) => (record.changePercent || 0) > 0).length;
      const fallers = filtered.filter((record) => (record.changePercent || 0) < 0).length;
      const flats = filtered.length - risers - fallers;
      const validTrendRecords = filtered.filter((record) => record.close != null);
      const averageChange = average(filtered.map((record) => record.changePercent).filter((value) => value != null));

      summaryCount.textContent = formatNumber(filtered.length, 0);
      summaryRisers.textContent = formatNumber(risers, 0);
      summaryFallers.textContent = formatNumber(fallers, 0);
      summaryFlats.textContent = formatNumber(flats, 0);
      meta.textContent = `${state.selectedDate} / ${filtered.length}件${state.activeMarket ? ` | 市場: ${state.activeMarket}` : ""}${state.activeIndustry ? ` | 業種: ${state.activeIndustry}` : ""}`;
      marketPulseMeta.textContent = `${state.selectedDate} 基準${state.query ? ` / 検索: ${state.query}` : ""}`;
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

      RANKING_CONFIG.forEach((item) => {
        const payload = state.rankings[item.key];
        const records = (payload?.items || []).filter((record) =>
          matchesFilter(
            {
              ticker: record.code,
              name: record.name,
              market: record.market,
              industry: record.industry,
            },
            "",
            state.activeMarket,
            state.activeIndustry
          )
        );
        renderRankingTable(rankingContainers.get(item.key), item.label, item.key, state.selectedDate, records);
      });

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
    const miniCalendar = document.getElementById("scannerMiniCalendar");
    const dateMeta = document.getElementById("scannerDateMeta");
    const prevDateButton = document.getElementById("scannerPrevDateButton");
    const nextDateButton = document.getElementById("scannerNextDateButton");
    const latestDateButton = document.getElementById("scannerLatestDateButton");
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
    };

    const params = new URLSearchParams(window.location.search);
    state.sort = params.get("sort") || state.sort;
    state.tag = params.get("tag") || "";
    state.limit = Number(params.get("limit") || state.limit);
    state.months = Number(params.get("months") || state.months);
    sortSelect.value = state.sort;
    limitSelect.value = String(state.limit);
    monthsSelect.value = String(state.months);

    [sortSelect, tagSelect, limitSelect, monthsSelect].forEach((control) => {
      control.addEventListener("change", async () => {
        state.sort = sortSelect.value;
        state.tag = tagSelect.value;
        state.limit = Number(limitSelect.value);
        state.months = Number(monthsSelect.value);
        await render();
      });
    });

    prevDateButton.addEventListener("click", async () => {
      const index = state.manifest.availableDates.indexOf(state.selectedDate);
      if (index > 0) {
        await loadDate(state.manifest.availableDates[index - 1]);
        await render();
      }
    });

    nextDateButton.addEventListener("click", async () => {
      const index = state.manifest.availableDates.indexOf(state.selectedDate);
      if (index >= 0 && index < state.manifest.availableDates.length - 1) {
        await loadDate(state.manifest.availableDates[index + 1]);
        await render();
      }
    });

    latestDateButton.addEventListener("click", async () => {
      await loadDate(state.manifest.latestDate);
      await render();
    });

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
      meta.textContent = `${state.selectedDate} / ${filtered.length}銘柄 / 並び順: ${scannerSortLabel(state.sort)} / 期間: ${state.months}ヶ月`;

      if (!filtered.length) {
        list.innerHTML = '<div class="empty-cell">該当する銘柄がありません。</div>';
        return;
      }

      list.innerHTML = filtered
        .map(
          (record, index) => `
            <article class="scanner-card">
              <div class="scanner-card-head">
                <div class="scanner-card-title">
                  <span>${index + 1}.</span>
                  <a href="${buildTickerUrl(record.code, state.selectedDate, state.sort === "code" ? "" : mapScannerSortToRanking(state.sort))}">
                    ${escapeHtml(record.code)} ${escapeHtml(record.name)}
                  </a>
                  <span class="${getChangeClass(record.changePercent)}">${formatSignedPercent(record.changePercent)}</span>
                </div>
                <div class="scanner-card-stats">
                  <span>終値 ${formatNumber(record.close)}</span>
                  <span>出来高倍率 ${formatRatio(record.volumeRatio25)}</span>
                  <span>${escapeHtml(record.market)}</span>
                </div>
              </div>
              <div id="scanChart-${escapeHtml(record.code)}" class="scanner-chart"></div>
            </article>
          `
        )
        .join("");

      for (const record of filtered) {
        try {
          const payload = await loadTickerPayload(record.code);
          renderMiniChart(`scanChart-${record.code}`, payload.ohlcv, state.selectedDate, state.months);
        } catch (error) {
          showError(errorBox, `一部のチャート読込に失敗: ${error.message}`);
        }
      }
    }

    function renderDateControls() {
      const availableDates = state.manifest.availableDates;
      const index = availableDates.indexOf(state.selectedDate);
      prevDateButton.disabled = index <= 0;
      nextDateButton.disabled = index < 0 || index >= availableDates.length - 1;
      latestDateButton.disabled = state.selectedDate === state.manifest.latestDate;
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
    const payload = await fetchJson(MANIFEST_PATH);
    if (!Array.isArray(payload.availableDates) || !payload.latestDate) {
      throw new Error("manifest.json の形式が不正です。");
    }
    return payload;
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

  function matchesFilter(record, query, activeMarket, activeIndustry) {
    const queryMatch =
      !query ||
      [record.ticker, record.code, record.name].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      );
    const marketMatch = !activeMarket || record.market === activeMarket;
    const industryMatch = !activeIndustry || record.industry === activeIndustry;
    return queryMatch && marketMatch && industryMatch;
  }

  function renderIndustryFilters(container, records, activeIndustry, onClick) {
    const excluded = new Set(["tse", "prime", "standard", "growth"]);
    const industries = [...new Set(records.map((record) => String(record.industry || "").trim()).filter(Boolean))]
      .filter((industry) => !excluded.has(industry) && !records.some((record) => record.market === industry))
      .sort((left, right) => left.localeCompare(right, "ja", { sensitivity: "base" }));
    const options = ["全業種", ...industries];
    container.innerHTML = options.length
      ? options
          .map(
            (industry) =>
              `<button type="button" class="chip filter-chip${(!activeIndustry && industry === "全業種") || industry === activeIndustry ? " active" : ""}" data-industry-filter="${escapeHtml(industry)}">${escapeHtml(industry)}</button>`
          )
          .join("")
      : '<span class="subtle">業種がありません。</span>';

    Array.from(container.querySelectorAll("button[data-industry-filter]")).forEach((button) => {
      button.addEventListener("click", () => onClick(button.dataset.industryFilter === "全業種" ? "" : button.dataset.industryFilter));
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
                <td>${label === "新高値" ? formatNumber(record.close) : label === "出来高増加" ? formatRatio(record.volumeRatio25) : label === "25日線乖離" ? formatSignedPercent(record.distanceToMa25) : label === "監視候補" ? formatNumber(record.close) : formatNumber(record.close)}</td>
              </tr>
            `;
          })
          .join("")}</tbody></table>`
      : '<div class="empty-cell">表示データなし</div>';
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
        counts.set(tag, (counts.get(tag) || 0) + 1);
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
    return items.sort((a, b) => String(a.code).localeCompare(String(b.code), "ja", { numeric: true, sensitivity: "base" }));
  }

  function scannerSortLabel(sortKey) {
    return {
      gainers: "値上がり率順",
      losers: "値下がり率順",
      volume: "出来高増加順",
      code: "コード順",
    }[sortKey] || sortKey;
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
    chart.timeScale().fitContent();
  }

  function renderTickerChart(element, rows, selectedIndex, months, chartMeta) {
    const anchorDate = parseDate(rows[selectedIndex].date);
    const cutoff = addMonths(anchorDate, -months);
    const visibleRows = rows.filter((row, index) => parseDate(row.date) >= cutoff && index <= selectedIndex + 10);
    if (!visibleRows.length) {
      return;
    }

    chartMeta.textContent = `${rows[selectedIndex].date} 基準 / ${visibleRows[0].date} - ${visibleRows[visibleRows.length - 1].date}`;
    const dates = visibleRows.map((row) => row.date);
    const traces = [
      {
        type: "candlestick",
        x: dates,
        open: visibleRows.map((row) => row.open),
        high: visibleRows.map((row) => row.high),
        low: visibleRows.map((row) => row.low),
        close: visibleRows.map((row) => row.close),
        name: "ローソク足",
        xaxis: "x",
        yaxis: "y",
        increasing: { line: { color: "#e11d48" }, fillcolor: "#fecdd3" },
        decreasing: { line: { color: "#0369a1" }, fillcolor: "#dbeafe" },
      },
      {
        type: "bar",
        x: dates,
        y: visibleRows.map((row) => row.volume),
        name: "出来高",
        xaxis: "x",
        yaxis: "y2",
        marker: {
          color: visibleRows.map((row) => (row.close >= row.open ? "rgba(225, 29, 72, 0.35)" : "rgba(3, 105, 161, 0.35)")),
        },
      },
    ];

    [5, 25, 75, 200].forEach((windowSize, index) => {
      traces.push({
        type: "scatter",
        mode: "lines",
        x: dates,
        y: visibleRows.map((row) => row[`ma${windowSize}`]),
        name: `MA${windowSize}`,
        xaxis: "x",
        yaxis: "y",
        line: {
          width: 1.8,
          color: ["#16a34a", "#f59e0b", "#7c3aed", "#111827"][index],
        },
      });
    });

    [5, 25].forEach((windowSize, index) => {
      traces.push({
        type: "scatter",
        mode: "lines",
        x: dates,
        y: visibleRows.map((row) => row[`volumeMa${windowSize}`]),
        name: `出来高MA${windowSize}`,
        xaxis: "x",
        yaxis: "y2",
        line: {
          width: 1.6,
          color: ["#b45309", "#475569"][index],
        },
      });
    });

    [12, 24, 48].forEach((windowSize, index) => {
      traces.push({
        type: "scatter",
        mode: "lines",
        x: dates,
        y: visibleRows.map((row) => row[`rci${windowSize}`]),
        name: `RCI${windowSize}`,
        xaxis: "x2",
        yaxis: "y3",
        line: {
          width: 1.6,
          color: ["#ef4444", "#0f766e", "#1d4ed8"][index],
        },
      });
    });

    const markerDate = rows[selectedIndex].date;
    const layout = {
      margin: { t: 20, r: 20, b: 32, l: 52 },
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      showlegend: true,
      legend: { orientation: "h", y: 1.08, x: 0 },
      xaxis: {
        domain: [0, 1],
        anchor: "y",
        rangeslider: { visible: false },
        showgrid: true,
        gridcolor: "#edf2f7",
      },
      yaxis: {
        domain: [0.42, 1],
        title: { text: "Price" },
        showgrid: true,
        gridcolor: "#edf2f7",
      },
      yaxis2: {
        domain: [0.27, 0.4],
        title: { text: "Volume" },
        showgrid: true,
        gridcolor: "#edf2f7",
      },
      xaxis2: {
        domain: [0, 1],
        anchor: "y3",
        matches: "x",
        showgrid: true,
        gridcolor: "#edf2f7",
      },
      yaxis3: {
        domain: [0, 0.21],
        title: { text: "RCI" },
        range: [-100, 100],
        zeroline: true,
        zerolinecolor: "#94a3b8",
        showgrid: true,
        gridcolor: "#edf2f7",
      },
      shapes: [
        { type: "line", xref: "paper", x0: 0, x1: 1, yref: "y3", y0: 80, y1: 80, line: { color: "#cbd5e1", dash: "dot" } },
        { type: "line", xref: "paper", x0: 0, x1: 1, yref: "y3", y0: -80, y1: -80, line: { color: "#cbd5e1", dash: "dot" } },
        { type: "line", xref: "x", x0: markerDate, x1: markerDate, yref: "paper", y0: 0, y1: 1, line: { color: "#111827", width: 1, dash: "dot" } },
      ],
      annotations: [
        {
          x: markerDate,
          y: 1.03,
          xref: "x",
          yref: "paper",
          text: `基準日 ${markerDate}`,
          showarrow: false,
          font: { size: 11, color: "#111827" },
          bgcolor: "#f8fafc",
          bordercolor: "#cfd7e3",
          borderwidth: 1,
        },
      ],
    };

    Plotly.newPlot(element, traces, layout, {
      responsive: true,
      displayModeBar: false,
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

  function syncIndexUrl(date) {
    const params = new URLSearchParams(window.location.search);
    params.set("date", date);
    history.replaceState({}, "", `./index.html?${params.toString()}`);
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
    history.replaceState({}, "", `./scanner.html?${params.toString()}`);
  }

  function rankingLabel(key) {
    return RANKING_CONFIG.find((item) => item.key === key)?.label || key;
  }

  function mapScannerSortToRanking(sortKey) {
    return {
      gainers: "gainers",
      losers: "losers",
      volume: "volume_spike",
      code: "",
    }[sortKey] || "";
  }
})();
