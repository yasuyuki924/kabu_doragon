(function () {
  const WATCHLIST_PATH = "./data/watchlist.json";
  const SUMMARY_PATH = "./data/market_summary.json";
  const WATCHLIST_STORAGE_KEY = "local-stock-dashboard.watchlist.v3";
  const NOTE_STORAGE_PREFIX = "local-stock-dashboard.note.";
  const PERIOD_MONTHS = [1, 2, 3, 4, 5, 6];
  const MA_WINDOWS = [5, 25, 75, 200];
  const VOLUME_MA_WINDOWS = [5, 25];
  const RCI_WINDOWS = [12, 24, 48];

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
    const summaryCount = document.getElementById("summaryCount");
    const summaryRisers = document.getElementById("summaryRisers");
    const summaryFallers = document.getElementById("summaryFallers");
    const summaryFlats = document.getElementById("summaryFlats");
    const searchInput = document.getElementById("searchInput");
    const rankingUp = document.getElementById("rankingUpBody");
    const rankingDown = document.getElementById("rankingDownBody");
    const rankingVolume = document.getElementById("rankingVolumeBody");
    const rankingPrice = document.getElementById("rankingPriceBody");
    const rankingMomentum = document.getElementById("rankingMomentumBody");
    const rankingWatch = document.getElementById("rankingWatchBody");
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
    const clearMarketFilterButton = document.getElementById("clearMarketFilterButton");
    const tagFilters = document.getElementById("tagFilters");
    const clearTagFilterButton = document.getElementById("clearTagFilterButton");
    const addTickerButton = document.getElementById("addTickerButton");
    const resetWatchlistButton = document.getElementById("resetWatchlistButton");
    const editorPanel = document.getElementById("editorPanel");
    const editorTitle = document.getElementById("editorTitle");
    const cancelEditorButton = document.getElementById("cancelEditorButton");
    const tickerForm = document.getElementById("tickerForm");

    const state = {
      records: [],
      query: "",
      sortKey: "ticker",
      sortDirection: "asc",
      activeMarket: "",
      activeTag: "",
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

    clearTagFilterButton.addEventListener("click", () => {
      state.activeTag = "";
      render();
    });

    clearMarketFilterButton.addEventListener("click", () => {
      state.activeMarket = "";
      render();
    });

    addTickerButton.addEventListener("click", () => openEditor());
    cancelEditorButton.addEventListener("click", () => closeEditor());

    resetWatchlistButton.addEventListener("click", async () => {
      localStorage.removeItem(WATCHLIST_STORAGE_KEY);
      state.records = await loadWatchlistWithQuotes();
      closeEditor();
      render();
    });

    tickerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const originalTicker = String(tickerForm.elements.originalTicker.value || "");
      const existingRecord = state.records.find((record) => record.ticker === originalTicker);
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

      const duplicate = state.records.find(
        (record) => record.ticker === nextRecord.ticker && record.ticker !== originalTicker
      );
      if (duplicate) {
        showError(errorBox, `コード ${nextRecord.ticker} は既に存在します。`);
        return;
      }

      errorBox.hidden = true;
      const nextRecords = [...state.records];
      const editIndex = nextRecords.findIndex((record) => record.ticker === originalTicker);
      if (editIndex >= 0) {
        nextRecords[editIndex] = nextRecord;
      } else {
        nextRecords.push(nextRecord);
      }
      state.records = sortWatchlistRecords(nextRecords);
      persistWatchlist(state.records);
      closeEditor();
      render();
    });

    try {
      state.records = await loadWatchlistWithQuotes();
      renderMiniCalendar(miniCalendar, new Date());
      render();
    } catch (error) {
      showError(errorBox, error.message);
      body.innerHTML = '<tr><td colspan="10" class="empty-cell">銘柄一覧を読み込めませんでした。</td></tr>';
      meta.textContent = `データ未読込: ${error.message} / http://127.0.0.1:8010/index.html で開いてください`;
    }

    function render() {
      renderMarketFilters(marketFilters, state.records, state.activeMarket, (market) => {
        state.activeMarket = state.activeMarket === market ? "" : market;
        render();
      });
      renderTagFilters(tagFilters, state.records, state.activeTag, (tag) => {
        state.activeTag = state.activeTag === tag ? "" : tag;
        render();
      });

      const filtered = state.records
        .filter((record) => {
          const queryMatch =
            !state.query ||
            [record.ticker, record.name].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(state.query)
            );
          const marketMatch = !state.activeMarket || record.market === state.activeMarket;
          const tagMatch = !state.activeTag || (record.tags || []).includes(state.activeTag);
          return queryMatch && marketMatch && tagMatch;
        })
        .sort((left, right) => compareRecords(left, right, state.sortKey, state.sortDirection));

      const risers = filtered.filter((record) => (record.changePercent || 0) > 0).length;
      const fallers = filtered.filter((record) => (record.changePercent || 0) < 0).length;
      const flats = filtered.length - risers - fallers;
      const latestDates = filtered.map((record) => record.latestDate).filter(Boolean);
      const validTrendRecords = filtered.filter((record) => record.latestClose != null);
      const averageChange = average(
        filtered.map((record) => record.changePercent).filter((value) => value != null)
      );
      summaryCount.textContent = formatNumber(filtered.length, 0);
      summaryRisers.textContent = formatNumber(risers, 0);
      summaryFallers.textContent = formatNumber(fallers, 0);
      summaryFlats.textContent = formatNumber(flats, 0);
      meta.textContent = `${filtered.length} / ${state.records.length} 件${state.activeMarket ? ` | 市場: ${state.activeMarket}` : ""}${state.activeTag ? ` | タグ: ${state.activeTag}` : ""}`;
      marketPulseMeta.textContent = state.query
        ? `検索: ${state.query}${state.activeMarket ? ` / 市場: ${state.activeMarket}` : ""}${state.activeTag ? ` / タグ: ${state.activeTag}` : ""}`
        : state.activeMarket
          ? `市場: ${state.activeMarket}${state.activeTag ? ` / タグ: ${state.activeTag}` : ""}`
          : state.activeTag
            ? `タグ: ${state.activeTag}`
          : "全監視銘柄ベース";
      overviewLatestDate.textContent = latestDates.length ? latestDates.sort().at(-1) : "-";
      overviewDataCoverage.textContent = validTrendRecords.length
        ? `${formatNumber(validTrendRecords.length, 0)}銘柄に価格データあり`
        : "価格データなし";
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
      renderBreadthList(
        sectorHeatmap,
        summarizeGroups(filtered, (record) => record.sector || record.market || "未分類", (record) => record.changePercent),
        ({ label, value, count }) => ({
          label,
          value: `${formatSignedPercent(value)} / ${formatNumber(count, 0)}件`,
          className: getChangeClass(value),
        })
      );
      renderBreadthList(
        tagHeatmap,
        summarizeTagCounts(filtered),
        ({ label, count }) => ({
          label,
          value: `${formatNumber(count, 0)}件`,
          className: "",
        })
      );
      renderRankingTable(
        rankingUp,
        topN(filtered, (record) => record.changePercent, true),
        (record) => [record.ticker, record.name, formatSignedPercent(record.changePercent)]
      );
      renderRankingTable(
        rankingDown,
        topN(filtered, (record) => record.changePercent, false),
        (record) => [record.ticker, record.name, formatSignedPercent(record.changePercent)]
      );
      renderRankingTable(
        rankingVolume,
        topN(filtered, (record) => record.latestVolume, true),
        (record) => [record.ticker, record.name, formatNumber(record.latestVolume, 0)]
      );
      renderRankingTable(
        rankingPrice,
        topN(filtered, (record) => record.latestClose, true),
        (record) => [record.ticker, record.name, formatNumber(record.latestClose)]
      );
      renderRankingTable(
        rankingMomentum,
        topN(filtered, (record) => (record.changePercent || 0) + ((record.latestClose || 0) / 1000), true),
        (record) => [record.ticker, record.name, formatNumber(record.latestClose), formatSignedPercent(record.changePercent)]
      );
      renderRankingTable(
        rankingWatch,
        [...filtered]
          .sort((a, b) => (b.tags?.includes("watch") ? 1 : 0) - (a.tags?.includes("watch") ? 1 : 0))
          .slice(0, 10),
        (record) => [record.ticker, record.name, (record.tags || []).join(", ")]
      );

      if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="10" class="empty-cell">該当する銘柄がありません。</td></tr>';
        return;
      }

      body.innerHTML = filtered
        .map((record) => {
          const tags = Array.isArray(record.tags) && record.tags.length
            ? `<div class="chip-list">${record.tags
                .map((tag) => `<button type="button" class="chip filter-chip${tag === state.activeTag ? " active" : ""}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`)
                .join("")}</div>`
            : '<span class="subtle">-</span>';

          return `
            <tr data-ticker="${escapeHtml(record.ticker)}">
              <td>${escapeHtml(record.ticker)}</td>
              <td>${escapeHtml(record.name)}</td>
              <td>${escapeHtml(record.market)}</td>
              <td class="num">${formatNumber(record.latestClose)}</td>
              <td class="num ${getChangeClass(record.changePercent)}">${formatSignedPercent(record.changePercent)}</td>
              <td class="num ${getSignedValueClass(record.distanceToMa25)}">${formatSignedPercent(record.distanceToMa25)}</td>
              <td class="num">${formatNumber(record.latestVolume, 0)}</td>
              <td>${escapeHtml(record.sector || "-")}</td>
              <td>${tags}</td>
              <td>
                <div class="actions-cell">
                  <button type="button" class="row-button" data-action="edit" data-ticker="${escapeHtml(record.ticker)}">編集</button>
                  <button type="button" class="row-button" data-action="delete" data-ticker="${escapeHtml(record.ticker)}">削除</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      Array.from(body.querySelectorAll("tr[data-ticker]")).forEach((row) => {
        row.addEventListener("click", (event) => {
          if (event.target.closest("button")) {
            return;
          }
          window.location.href = `./ticker.html?t=${encodeURIComponent(row.dataset.ticker)}`;
        });
      });

      Array.from(body.querySelectorAll("button[data-action='edit']")).forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const record = state.records.find((item) => item.ticker === button.dataset.ticker);
          openEditor(record);
        });
      });

      Array.from(body.querySelectorAll("button[data-action='delete']")).forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          state.records = state.records.filter((item) => item.ticker !== button.dataset.ticker);
          persistWatchlist(state.records);
          closeEditor();
          render();
        });
      });

      Array.from(body.querySelectorAll("button[data-tag]")).forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          state.activeTag = state.activeTag === button.dataset.tag ? "" : button.dataset.tag;
          render();
        });
      });
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
    const chartEl = document.getElementById("chart");
    const noteArea = document.getElementById("tickerNote");
    const noteStatus = document.getElementById("noteStatus");
    const saveNoteButton = document.getElementById("saveNoteButton");
    const clearNoteButton = document.getElementById("clearNoteButton");
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

    const params = new URLSearchParams(window.location.search);
    const ticker = params.get("t");
    if (!ticker) {
      showError(errorBox, "URL パラメータ t がありません。例: ticker.html?t=3133");
      return;
    }

    const state = {
      selectedMonths: 3,
      info: null,
      rows: [],
    };

    periodButtons.innerHTML = PERIOD_MONTHS.map(
      (month) => `<button class="period-button${month === state.selectedMonths ? " active" : ""}" data-months="${month}">${month}ヶ月</button>`
    ).join("");

    Array.from(periodButtons.querySelectorAll(".period-button")).forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedMonths = Number(button.dataset.months);
        updatePeriodButtonState(periodButtons, state.selectedMonths);
        renderChart();
      });
    });

    noteArea.value = loadTickerNote(ticker);
    noteStatus.textContent = noteArea.value ? "保存済み" : "未保存";

    saveNoteButton.addEventListener("click", () => {
      localStorage.setItem(`${NOTE_STORAGE_PREFIX}${ticker}`, noteArea.value);
      noteStatus.textContent = "保存済み";
    });

    clearNoteButton.addEventListener("click", () => {
      noteArea.value = "";
      localStorage.removeItem(`${NOTE_STORAGE_PREFIX}${ticker}`);
      noteStatus.textContent = "未保存";
    });

    noteArea.addEventListener("input", () => {
      noteStatus.textContent = "未保存";
    });

    try {
      const watchlist = await loadWatchlist();
      state.info = watchlist.find((record) => String(record.ticker) === String(ticker)) || null;
      state.rows = await fetchCsv(`./data/ohlcv/${ticker}.csv`);
    } catch (error) {
      showError(errorBox, error.message);
      return;
    }

    if (!state.rows.length) {
      showError(errorBox, `${ticker} のOHLCVデータが空です。`);
      return;
    }

    const latest = state.rows[state.rows.length - 1];
    const previous = state.rows[state.rows.length - 2] || null;
    const change = previous ? latest.close - previous.close : 0;
    const changePercent = previous && previous.close ? (change / previous.close) * 100 : 0;
    const metrics = calculateTechnicalSnapshot(state.rows);
    tickerTitle.textContent = `${ticker} ${state.info?.name || ""}`.trim();
    tickerMeta.textContent = [
      state.info?.market || "市場未設定",
      latest?.date ? `最新日付 ${latest.date}` : null,
      state.info?.tags?.length ? `タグ: ${state.info.tags.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" / ");
    summaryClose.textContent = formatNumber(latest.close);
    summaryChange.textContent = `${formatSignedNumber(change)} (${formatSignedPercent(changePercent)})`;
    summaryChange.className = `summary-value ${getChangeClass(changePercent)}`;
    summaryOpen.textContent = formatNumber(latest.open);
    summaryRange.textContent = `${formatNumber(latest.high)} / ${formatNumber(latest.low)}`;
    summaryVolume.textContent = formatNumber(latest.volume, 0);
    profileMeta.textContent = state.rows.length ? `${formatNumber(state.rows.length, 0)}本のローソク足` : "-";
    profileMarket.textContent = state.info?.market || "-";
    profileSector.textContent = state.info?.sector || "-";
    profileIndustry.textContent = state.info?.industry || "-";
    profileTags.textContent = state.info?.tags?.length ? state.info.tags.join(", ") : "-";
    techDistanceMa25.textContent = formatSignedPercent(metrics.distanceToMa25);
    techDistanceMa75.textContent = formatSignedPercent(metrics.distanceToMa75);
    techDistanceMa200.textContent = formatSignedPercent(metrics.distanceToMa200);
    techVolumeRatio.textContent = formatRatio(metrics.volumeRatio25);
    techRciSummary.textContent = [metrics.rci12, metrics.rci24, metrics.rci48]
      .map((value) => (value == null ? "-" : Number(value).toFixed(1)))
      .join(" / ");
    techRangePosition.textContent = formatPercent(metrics.rangePosition52w);
    [
      [techDistanceMa25, metrics.distanceToMa25],
      [techDistanceMa75, metrics.distanceToMa75],
      [techDistanceMa200, metrics.distanceToMa200],
      [techRangePosition, metrics.rangePosition52w],
    ].forEach(([element, value]) => {
      const className = getSignedValueClass(value);
      if (className) {
        element.classList.add(className);
      }
    });

    externalLinks.innerHTML = state.info?.links
      ? Object.entries(state.info.links)
          .filter(([, href]) => href)
          .map(([label, href]) => `<a class="link-pill" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`)
          .join("")
      : "";

    renderChart();

    function renderChart() {
      const latestDate = parseDate(state.rows[state.rows.length - 1].date);
      const cutoff = addMonths(latestDate, -state.selectedMonths);
      const visibleRows = state.rows.filter((row) => parseDate(row.date) >= cutoff);

      if (!visibleRows.length) {
        showError(errorBox, `${state.selectedMonths}ヶ月分の表示対象データがありません。`);
        return;
      }

      errorBox.hidden = true;
      chartMeta.textContent = `${state.selectedMonths}ヶ月表示 / ${visibleRows[0].date} - ${visibleRows[visibleRows.length - 1].date}`;

      const dates = visibleRows.map((row) => row.date);
      const opens = visibleRows.map((row) => row.open);
      const highs = visibleRows.map((row) => row.high);
      const lows = visibleRows.map((row) => row.low);
      const closes = visibleRows.map((row) => row.close);
      const volumes = visibleRows.map((row) => row.volume);

      const traces = [
        {
          type: "candlestick",
          x: dates,
          open: opens,
          high: highs,
          low: lows,
          close: closes,
          name: "ローソク足",
          xaxis: "x",
          yaxis: "y",
          increasing: { line: { color: "#e11d48" }, fillcolor: "#fecdd3" },
          decreasing: { line: { color: "#0369a1" }, fillcolor: "#dbeafe" },
        },
        {
          type: "bar",
          x: dates,
          y: volumes,
          name: "出来高",
          xaxis: "x",
          yaxis: "y2",
          marker: {
            color: visibleRows.map((row) => (row.close >= row.open ? "rgba(225, 29, 72, 0.35)" : "rgba(3, 105, 161, 0.35)")),
          },
        },
      ];

      MA_WINDOWS.forEach((windowSize, index) => {
        traces.push({
          type: "scatter",
          mode: "lines",
          x: dates,
          y: movingAverage(visibleRows.map((row) => row.close), windowSize),
          name: `MA${windowSize}`,
          xaxis: "x",
          yaxis: "y",
          line: {
            width: 1.8,
            color: ["#16a34a", "#f59e0b", "#7c3aed", "#111827"][index],
          },
        });
      });

      VOLUME_MA_WINDOWS.forEach((windowSize, index) => {
        traces.push({
          type: "scatter",
          mode: "lines",
          x: dates,
          y: movingAverage(visibleRows.map((row) => row.volume), windowSize),
          name: `出来高MA${windowSize}`,
          xaxis: "x",
          yaxis: "y2",
          line: {
            width: 1.6,
            color: ["#b45309", "#475569"][index],
          },
        });
      });

      RCI_WINDOWS.forEach((windowSize, index) => {
        traces.push({
          type: "scatter",
          mode: "lines",
          x: dates,
          y: calculateRciSeries(visibleRows, windowSize),
          name: `RCI${windowSize}`,
          xaxis: "x2",
          yaxis: "y3",
          line: {
            width: 1.6,
            color: ["#ef4444", "#0f766e", "#1d4ed8"][index],
          },
        });
      });

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
        ],
      };

      Plotly.newPlot(chartEl, traces, layout, {
        responsive: true,
        displayModeBar: false,
      });
    }
  }

  async function initScannerPage() {
    const sortSelect = document.getElementById("scannerSort");
    const tagSelect = document.getElementById("scannerTag");
    const limitSelect = document.getElementById("scannerLimit");
    const monthsSelect = document.getElementById("scannerMonths");
    const meta = document.getElementById("scannerMeta");
    const errorBox = document.getElementById("scannerError");
    const list = document.getElementById("scannerList");

    const state = {
      records: [],
      sort: "gainers",
      tag: "",
      limit: 50,
      months: 3,
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
      control.addEventListener("change", () => {
        state.sort = sortSelect.value;
        state.tag = tagSelect.value;
        state.limit = Number(limitSelect.value);
        state.months = Number(monthsSelect.value);
        render();
      });
    });

    try {
      state.records = await loadWatchlistWithQuotes();
      const tags = [...new Set(state.records.flatMap((record) => record.tags || []))].sort();
      tagSelect.innerHTML = ['<option value="">すべて</option>']
        .concat(tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`))
        .join("");
      tagSelect.value = state.tag;
      await render();
    } catch (error) {
      showError(errorBox, error.message);
    }

    async function render() {
      errorBox.hidden = true;
      list.innerHTML = '<div class="empty-cell">読み込み中...</div>';
      const filtered = sortScannerRecords(
        state.records.filter((record) => !state.tag || (record.tags || []).includes(state.tag)),
        state.sort
      ).slice(0, state.limit);
      meta.textContent = `${filtered.length}銘柄 / 並び順: ${scannerSortLabel(state.sort)} / 期間: ${state.months}ヶ月`;

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
                  <a href="./ticker.html?t=${encodeURIComponent(record.ticker)}">${escapeHtml(record.ticker)} ${escapeHtml(record.name)}</a>
                  <span class="${getChangeClass(record.changePercent)}">${formatSignedPercent(record.changePercent)}</span>
                </div>
                <div class="scanner-card-stats">
                  <span>終値 ${formatNumber(record.latestClose)}</span>
                  <span>出来高 ${formatNumber(record.latestVolume, 0)}</span>
                  <span>${escapeHtml(record.market)}</span>
                </div>
              </div>
              <div id="scanChart-${escapeHtml(record.ticker)}" class="scanner-chart"></div>
            </article>
          `
        )
        .join("");

      for (const record of filtered) {
        try {
          const rows = await fetchCsv(`./data/ohlcv/${record.ticker}.csv`);
          renderMiniChart(`scanChart-${record.ticker}`, rows, state.months);
        } catch (error) {
          showError(errorBox, `一部のチャート読込に失敗: ${error.message}`);
        }
      }
    }
  }

  async function loadWatchlist() {
    const baseRecords = sortWatchlistRecords((await fetchJson(WATCHLIST_PATH)).map(normalizeWatchlistRecord));
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

      // Ignore stale localStorage created against an older, much smaller universe.
      if (baseRecords.length >= 500) {
        if ((baseRecordCount && baseRecordCount !== baseRecords.length) || localRecords.length < baseRecords.length * 0.9) {
          localStorage.removeItem(WATCHLIST_STORAGE_KEY);
          return baseRecords;
        }
      }

      return sortWatchlistRecords(localRecords.map(normalizeWatchlistRecord));
    } catch (_error) {
      localStorage.removeItem(WATCHLIST_STORAGE_KEY);
      return baseRecords;
    }
  }

  async function loadWatchlistWithQuotes() {
    const records = await loadWatchlist();
    const summaryMap = await loadSummaryMap();

    if (summaryMap.size) {
      return records.map((record) => ({
        ...record,
        ...emptySummaryMetrics(),
        ...(summaryMap.get(record.ticker) || {}),
      }));
    }

    const enriched = await Promise.all(records.map((record) => enrichRecordFromCsv(record)));
    return enriched;
  }

  async function loadSummaryMap() {
    try {
      const payload = await fetchJson(SUMMARY_PATH);
      const records = Array.isArray(payload) ? payload : payload.records;
      if (!Array.isArray(records)) {
        return new Map();
      }
      return new Map(
        records
          .filter((record) => record?.ticker)
          .map((record) => [String(record.ticker), { ...emptySummaryMetrics(), ...record }])
      );
    } catch (_error) {
      return new Map();
    }
  }

  async function enrichRecordFromCsv(record) {
    try {
      const rows = await fetchCsv(`./data/ohlcv/${record.ticker}.csv`);
      const latest = rows[rows.length - 1] || null;
      const previous = rows[rows.length - 2] || null;
      const latestClose = latest?.close ?? null;
      const latestVolume = latest?.volume ?? null;
      const changePercent =
        latest && previous && previous.close ? ((latest.close - previous.close) / previous.close) * 100 : null;
      const metrics = calculateTechnicalSnapshot(rows);
      return { ...record, latestClose, latestVolume, changePercent, latestDate: latest?.date ?? null, ...metrics };
    } catch (_error) {
      return { ...record, ...emptySummaryMetrics() };
    }
  }

  function emptySummaryMetrics() {
    return {
      latestClose: null,
      latestVolume: null,
      changePercent: null,
      latestDate: null,
      distanceToMa25: null,
      distanceToMa75: null,
      distanceToMa200: null,
      volumeRatio25: null,
      rci12: null,
      rci24: null,
      rci48: null,
      rangePosition52w: null,
    };
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
      ticker: String(record.ticker || "").trim(),
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

  function renderTagFilters(container, records, activeTag, onClick) {
    const tags = [...new Set(records.flatMap((record) => record.tags || []))].sort((left, right) =>
      left.localeCompare(right, "ja", { sensitivity: "base" })
    );
    container.innerHTML = tags.length
      ? tags
          .map(
            (tag) =>
              `<button type="button" class="chip filter-chip${tag === activeTag ? " active" : ""}" data-tag-filter="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
          )
          .join("")
      : '<span class="subtle">タグがありません。</span>';

    Array.from(container.querySelectorAll("button[data-tag-filter]")).forEach((button) => {
      button.addEventListener("click", () => onClick(button.dataset.tagFilter));
    });
  }

  function renderMarketFilters(container, records, activeMarket, onClick) {
    const markets = [...new Set(records.map((record) => record.market).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right, "ja", { sensitivity: "base" })
    );
    container.innerHTML = markets.length
      ? markets
          .map(
            (market) =>
              `<button type="button" class="chip filter-chip${market === activeMarket ? " active" : ""}" data-market-filter="${escapeHtml(market)}">${escapeHtml(market)}</button>`
          )
          .join("")
      : '<span class="subtle">市場区分がありません。</span>';

    Array.from(container.querySelectorAll("button[data-market-filter]")).forEach((button) => {
      button.addEventListener("click", () => onClick(button.dataset.marketFilter));
    });
  }

  function loadTickerNote(ticker) {
    return localStorage.getItem(`${NOTE_STORAGE_PREFIX}${ticker}`) || "";
  }

  async function fetchJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`JSON 読み込み失敗: ${path} (${response.status})`);
    }
    return response.json();
  }

  async function fetchCsv(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`CSV 読み込み失敗: ${path} (${response.status})`);
    }
    const text = await response.text();
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift()?.split(",") || [];
    return lines
      .filter(Boolean)
      .map((line) => {
        const values = line.split(",");
        return headers.reduce((row, header, index) => {
          const key = header.trim();
          const value = (values[index] || "").trim();
          row[key] = key === "date" ? value : Number(value);
          return row;
        }, {});
      })
      .sort((left, right) => parseDate(left.date) - parseDate(right.date));
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

  function movingAverage(values, windowSize) {
    return values.map((_, index) => {
      if (index + 1 < windowSize) {
        return null;
      }
      const windowValues = values.slice(index - windowSize + 1, index + 1);
      const sum = windowValues.reduce((total, value) => total + value, 0);
      return Number((sum / windowSize).toFixed(2));
    });
  }

  function average(values) {
    if (!values.length) {
      return null;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  function latestMovingAverage(values, windowSize) {
    return movingAverage(values, windowSize).at(-1) ?? null;
  }

  function distanceFromBaseline(value, baseline) {
    if (value == null || baseline == null || baseline === 0) {
      return null;
    }
    return ((value - baseline) / baseline) * 100;
  }

  function calculateTechnicalSnapshot(rows) {
    if (!rows.length) {
      return {
        distanceToMa25: null,
        distanceToMa75: null,
        distanceToMa200: null,
        volumeRatio25: null,
        rci12: null,
        rci24: null,
        rci48: null,
        rangePosition52w: null,
      };
    }

    const closes = rows.map((row) => row.close);
    const volumes = rows.map((row) => row.volume);
    const latestClose = closes.at(-1) ?? null;
    const latestVolume = volumes.at(-1) ?? null;
    const ma25 = latestMovingAverage(closes, 25);
    const ma75 = latestMovingAverage(closes, 75);
    const ma200 = latestMovingAverage(closes, 200);
    const volumeMa25 = latestMovingAverage(volumes, 25);
    const lookback252 = rows.slice(-252);
    const highs = lookback252.map((row) => row.high);
    const lows = lookback252.map((row) => row.low);
    const highest52w = highs.length ? Math.max(...highs) : null;
    const lowest52w = lows.length ? Math.min(...lows) : null;
    const rangePosition52w =
      latestClose != null && highest52w != null && lowest52w != null && highest52w !== lowest52w
        ? ((latestClose - lowest52w) / (highest52w - lowest52w)) * 100
        : null;

    return {
      distanceToMa25: distanceFromBaseline(latestClose, ma25),
      distanceToMa75: distanceFromBaseline(latestClose, ma75),
      distanceToMa200: distanceFromBaseline(latestClose, ma200),
      volumeRatio25: latestVolume != null && volumeMa25 != null && volumeMa25 !== 0 ? latestVolume / volumeMa25 : null,
      rci12: calculateRciSeries(rows, 12).at(-1) ?? null,
      rci24: calculateRciSeries(rows, 24).at(-1) ?? null,
      rci48: calculateRciSeries(rows, 48).at(-1) ?? null,
      rangePosition52w,
    };
  }

  function calculateRciSeries(rows, windowSize) {
    const closes = rows.map((row) => row.close);
    return closes.map((_, index) => {
      if (index + 1 < windowSize) {
        return null;
      }
      return calculateRci(closes.slice(index - windowSize + 1, index + 1));
    });
  }

  function calculateRci(values) {
    const n = values.length;
    const timeRanks = values.map((_, index) => index + 1);
    const priceRanks = rankValues(values);
    const sumSquared = timeRanks.reduce((total, timeRank, index) => {
      const diff = timeRank - priceRanks[index];
      return total + diff * diff;
    }, 0);
    const rci = (1 - (6 * sumSquared) / (n * (n * n - 1))) * 100;
    return Number(rci.toFixed(2));
  }

  function rankValues(values) {
    const sorted = values
      .map((value, index) => ({ value, index }))
      .sort((left, right) => left.value - right.value);

    const ranks = new Array(values.length);
    let cursor = 0;
    while (cursor < sorted.length) {
      let end = cursor;
      while (end + 1 < sorted.length && sorted[end + 1].value === sorted[cursor].value) {
        end += 1;
      }
      const averageRank = (cursor + end + 2) / 2;
      for (let index = cursor; index <= end; index += 1) {
        ranks[sorted[index].index] = averageRank;
      }
      cursor = end + 1;
    }
    return ranks;
  }

  function updatePeriodButtonState(container, selectedMonths) {
    Array.from(container.querySelectorAll(".period-button")).forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.months) === selectedMonths);
    });
  }

  function showError(element, message) {
    element.textContent = message;
    element.hidden = false;
    element.scrollIntoView({ block: "nearest" });
  }

  function parseDate(value) {
    return new Date(`${value}T00:00:00`);
  }

  function addMonths(date, delta) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + delta);
    return next;
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
    return Number(value).toLocaleString("ja-JP", {
      minimumFractionDigits: digits,
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

  function topN(records, selector, desc) {
    const next = [...records].sort((a, b) => compareNullableNumbers(selector(a), selector(b)));
    if (desc) {
      next.reverse();
    }
    return next.slice(0, 10);
  }

  function renderRankingTable(container, records, formatter) {
    container.innerHTML = records.length
      ? `<table class="ranking-list"><tbody>${records
          .map((record, index) => {
            const cols = formatter(record)
              .map((value, colIndex) =>
                colIndex === 1
                  ? `<td><a href="./ticker.html?t=${encodeURIComponent(record.ticker)}">${escapeHtml(value)}</a></td>`
                  : `<td>${escapeHtml(value)}</td>`
              )
              .join("");
            return `<tr><td>${index + 1}</td>${cols}</tr>`;
          })
          .join("")}</tbody></table>`
      : '<div class="empty-cell">表示データなし</div>';
  }

  function summarizeGroups(records, groupSelector, valueSelector) {
    const groups = new Map();
    records.forEach((record) => {
      const label = groupSelector(record);
      const value = valueSelector(record);
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
      .slice(0, 8);
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

  function renderMiniCalendar(container, date) {
    if (!container) {
      return;
    }
    const year = date.getFullYear();
    const month = date.getMonth();
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
      <div class="meta">${year}年${month + 1}月</div>
      <table class="mini-calendar">
        <thead>
          <tr><th>日</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th>土</th></tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    `;
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
      return items.sort((a, b) => compareNullableNumbers(b.latestVolume, a.latestVolume));
    }
    return items.sort((a, b) => a.ticker.localeCompare(b.ticker, "ja", { numeric: true, sensitivity: "base" }));
  }

  function scannerSortLabel(sortKey) {
    return {
      gainers: "値上がり率順",
      losers: "値下がり率順",
      volume: "出来高順",
      code: "コード順",
    }[sortKey] || sortKey;
  }

  function renderMiniChart(elementId, rows, months) {
    const element = document.getElementById(elementId);
    if (!element || !window.LightweightCharts) {
      return;
    }
    element.innerHTML = "";
    const latestDate = parseDate(rows[rows.length - 1].date);
    const cutoff = addMonths(latestDate, -months);
    const visibleRows = rows.filter((row) => parseDate(row.date) >= cutoff);
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
          .map((row, rowIndex) => ({
            time: row.date,
            value: movingAverage(visibleRows.map((item) => item.close), windowSize)[rowIndex],
          }))
          .filter((item) => item.value != null)
      );
    });
    chart.timeScale().fitContent();
  }
})();
