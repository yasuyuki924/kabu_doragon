(function () {
  const DEFAULT_CODE = "6501";
  const DEFAULT_PERIOD = "3m";
  const PERIODS = [
    { key: "1m", label: "1か月", months: 1 },
    { key: "3m", label: "3か月", months: 3 },
    { key: "6m", label: "6か月", months: 6 },
    { key: "1y", label: "1年", months: 12 },
    { key: "all", label: "全期間", months: null },
  ];
  const FRAMES = [
    { key: "day", label: "日足", active: true },
    { key: "week", label: "週足", active: false },
    { key: "month", label: "月足", active: false },
  ];

  const state = {
    code: DEFAULT_CODE,
    selectedDate: "",
    period: DEFAULT_PERIOD,
    payload: null,
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const params = new URLSearchParams(window.location.search);
    state.code = params.get("code") || DEFAULT_CODE;

    renderFrameButtons();
    renderPeriodButtons();

    try {
      const payload = await loadSampleTickerPayload(state.code);
      state.payload = payload;
      const rows = payload.ohlcv || [];
      if (!rows.length) {
        throw new Error(`${state.code} の時系列データがありません。`);
      }
      state.selectedDate = resolveSelectedDate(rows, params.get("date"));
      renderAll();
    } catch (error) {
      renderError(error.message);
    }
  }

  async function loadSampleTickerPayload(code) {
    const response = await fetch(`./data/tickers/${encodeURIComponent(code)}.json`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`${code} のサンプルデータを読み込めませんでした。`);
    }
    return response.json();
  }

  function renderAll() {
    const rows = state.payload.ohlcv || [];
    const selectedIndex = rows.findIndex((row) => row.date === state.selectedDate);
    if (selectedIndex < 0) {
      renderError(`${state.code} の ${state.selectedDate} データがありません。`);
      return;
    }
    const row = rows[selectedIndex];
    renderSampleHeader(state.payload, row, state.selectedDate);
    renderSummaryStack(row, state.payload);
    renderMetricStack(row, state.payload);
    renderFutureMetricStack(row, state.payload);
    renderSampleChart(state.payload, rows, selectedIndex, state.period);
  }

  function renderSampleHeader(payload, row, selectedDate) {
    document.getElementById("sampleTickerTitle").textContent = `${payload.code} ${payload.name}`.trim();
    document.getElementById("sampleTickerMeta").textContent = [
      payload.market || "-",
      payload.industry || payload.sector || "-",
      payload.themes?.length ? payload.themes.join(" / ") : null,
      `基準日 ${selectedDate}`,
    ]
      .filter(Boolean)
      .join(" / ");
    document.getElementById("sampleBaseDate").textContent = selectedDate;
    document.getElementById("sampleClose").textContent = formatNumber(row.close);

    const changeEl = document.getElementById("sampleChange");
    changeEl.textContent = `${formatSignedNumber(row.change)} (${formatSignedPercent(row.changePercent)})`;
    changeEl.classList.remove("sample-state-up", "sample-state-down");
    changeEl.classList.add(getSignedClass(row.changePercent));

    document.title = `${payload.code} ${payload.name} | ticker_sample`;
    document.getElementById("sampleStatus").textContent = `${payload.code} 実データ読込`;
  }

  function renderSummaryStack(row, payload) {
    const cards = [
      {
        label: "基準日",
        value: row.date,
        note: payload.market || "-",
        className: "",
      },
      {
        label: "終値",
        value: formatNumber(row.close),
        note: `${payload.code} ${payload.name}`,
        className: "",
      },
      {
        label: "前日比",
        value: `${formatSignedNumber(row.change)} (${formatSignedPercent(row.changePercent)})`,
        note: "前日終値比",
        className: getSignedClass(row.changePercent),
      },
      {
        label: "出来高倍率",
        value: formatRatio(row.volumeRatio25),
        note: `出来高 ${formatNumber(row.volume, 0)}`,
        className: row.volumeRatio25 >= 1 ? "sample-state-up" : "",
      },
    ];

    document.getElementById("sampleSummaryCards").innerHTML = cards
      .map(
        (card) => `
          <article class="sample-info-card">
            <div class="sample-info-label">${escapeHtml(card.label)}</div>
            <div class="sample-info-value ${escapeHtml(card.className)}">${escapeHtml(card.value)}</div>
            <div class="sample-info-note">${escapeHtml(card.note)}</div>
          </article>
        `
      )
      .join("");
  }

  function renderMetricStack(row, payload) {
    const cards = [
      {
        label: "5日線乖離",
        value: formatSignedPercent(computeDistanceToMa5(row)),
        note: `MA5 ${formatNumber(row.ma5)}`,
        className: getSignedClass(computeDistanceToMa5(row)),
      },
      {
        label: "25日線乖離",
        value: formatSignedPercent(row.distanceToMa25),
        note: `MA25 ${formatNumber(row.ma25)}`,
        className: getSignedClass(row.distanceToMa25),
      },
      {
        label: "高値更新情報",
        value: row.newHigh52w ? "52週高値更新" : "更新なし",
        note: row.newHigh52w ? "当日高値が52週高値圏" : "高値圏監視継続",
        className: row.newHigh52w ? "sample-state-up" : "",
      },
      {
        label: "出来高倍率",
        value: formatRatio(row.volumeRatio25),
        note: `出来高 ${formatNumber(row.volume, 0)}`,
        className: row.volumeRatio25 >= 1 ? "sample-state-up" : "",
      },
      {
        label: "ランキング順位",
        value: buildDummyRankLabel(row),
        note: payload.themes?.length ? `テーマ ${payload.themes[0]}` : "ランキング未連携",
        className: "",
      },
    ];

    document.getElementById("sampleInfoCards").innerHTML = cards
      .map(
        (card) => `
          <article class="sample-info-card">
            <div class="sample-info-label">${escapeHtml(card.label)}</div>
            <div class="sample-info-value ${escapeHtml(card.className)}">${escapeHtml(card.value)}</div>
            <div class="sample-info-note">${escapeHtml(card.note)}</div>
          </article>
        `
      )
      .join("");
  }

  function renderFutureMetricStack(row, payload) {
    const items = buildFutureMetricItems(row, payload);
    document.getElementById("sampleFutureItems").innerHTML = items
      .map(
        (item) => `
          <article class="sample-info-card">
            <div class="sample-info-label">${escapeHtml(item.label)}</div>
            <div class="sample-info-value ${escapeHtml(item.className || "")}">${escapeHtml(item.value)}</div>
            <div class="sample-info-note">${escapeHtml(item.note || "")}</div>
          </article>
        `
      )
      .join("");
  }

  function renderSampleChart(payload, rows, selectedIndex, periodKey) {
    const selectedDate = rows[selectedIndex].date;
    const visibleRows = sliceRowsByPeriod(rows, selectedDate, periodKey);
    const colors = readChartTheme();
    const dates = visibleRows.map((row) => row.date);

    document.getElementById("sampleChartMeta").textContent =
      `${selectedDate} 基準 / ${visibleRows[0].date} - ${visibleRows[visibleRows.length - 1].date}`;

    const traces = [
      {
        type: "candlestick",
        x: dates,
        open: visibleRows.map((row) => row.open),
        high: visibleRows.map((row) => row.high),
        low: visibleRows.map((row) => row.low),
        close: visibleRows.map((row) => row.close),
        name: "日足",
        xaxis: "x",
        yaxis: "y",
        increasing: { line: { color: colors.rise }, fillcolor: rgba(colors.rise, 0.72) },
        decreasing: { line: { color: colors.fall }, fillcolor: rgba(colors.fall, 0.72) },
      },
      {
        type: "scatter",
        mode: "lines",
        x: dates,
        y: visibleRows.map((row) => row.ma5),
        name: "MA5",
        xaxis: "x",
        yaxis: "y",
        line: { width: 1.6, color: colors.ma5 },
      },
      {
        type: "scatter",
        mode: "lines",
        x: dates,
        y: visibleRows.map((row) => row.ma25),
        name: "MA25",
        xaxis: "x",
        yaxis: "y",
        line: { width: 1.8, color: colors.ma25 },
      },
      {
        type: "scatter",
        mode: "lines",
        x: dates,
        y: visibleRows.map((row) => row.ma75),
        name: "MA75",
        xaxis: "x",
        yaxis: "y",
        line: { width: 1.8, color: colors.ma75 },
      },
      {
        type: "bar",
        x: dates,
        y: visibleRows.map((row) => row.volume),
        name: "出来高",
        xaxis: "x",
        yaxis: "y2",
        marker: {
          color: visibleRows.map((row) =>
            row.close >= row.open ? "rgba(209, 48, 82, 0.42)" : "rgba(40, 104, 169, 0.42)"
          ),
        },
      },
    ];

    const layout = {
      margin: { t: 10, r: 10, b: 18, l: 40 },
      paper_bgcolor: colors.bg,
      plot_bgcolor: colors.panel,
      showlegend: true,
      dragmode: false,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.06,
        font: { size: 9, color: colors.text },
      },
      xaxis: {
        domain: [0, 1],
        anchor: "y",
        type: "category",
        categoryorder: "array",
        categoryarray: dates,
        rangeslider: { visible: false },
        showgrid: true,
        gridcolor: colors.grid,
        fixedrange: true,
        tickfont: { size: 8, color: colors.muted },
      },
      yaxis: {
        domain: [0.31, 1],
        showgrid: true,
        gridcolor: colors.grid,
        fixedrange: true,
        tickfont: { size: 8, color: colors.muted },
      },
      yaxis2: {
        domain: [0, 0.23],
        showgrid: true,
        gridcolor: colors.grid,
        fixedrange: true,
        tickfont: { size: 8, color: colors.muted },
      },
      bargap: 0.16,
      shapes: [
        {
          type: "line",
          xref: "x",
          yref: "paper",
          x0: state.selectedDate,
          x1: state.selectedDate,
          y0: 0,
          y1: 1,
          line: {
            color: colors.marker,
            width: 1.2,
            dash: "dot",
          },
        },
      ],
      annotations: [
        {
          xref: "x",
          yref: "paper",
          x: state.selectedDate,
          y: 1.02,
          text: "基準日",
          showarrow: false,
          font: { size: 8, color: colors.marker },
          bgcolor: colors.bg,
        },
      ],
    };

    const config = {
      displayModeBar: false,
      responsive: true,
      scrollZoom: false,
      doubleClick: false,
    };

    window.Plotly.newPlot("sampleChart", traces, layout, config);
  }

  function renderPeriodButtons() {
    const container = document.getElementById("samplePeriodButtons");
    container.innerHTML = PERIODS.map(
      (period) =>
        `<button class="sample-button${period.key === state.period ? " is-active" : ""}" data-period="${period.key}">${period.label}</button>`
    ).join("");

    Array.from(container.querySelectorAll("[data-period]")).forEach((button) => {
      button.addEventListener("click", () => {
        state.period = button.dataset.period;
        renderPeriodButtons();
        if (state.payload) {
          renderAll();
        }
      });
    });
  }

  function renderFrameButtons() {
    const container = document.getElementById("sampleFrameButtons");
    container.innerHTML = FRAMES.map(
      (frame) =>
        `<button class="sample-button is-ghost${frame.active ? " is-active" : ""}" type="button">${frame.label}</button>`
    ).join("");
  }

  function resolveSelectedDate(rows, requestedDate) {
    const dates = rows.map((row) => row.date);
    if (requestedDate && dates.includes(requestedDate)) {
      return requestedDate;
    }
    return dates[dates.length - 1];
  }

  function sliceRowsByPeriod(rows, selectedDate, periodKey) {
    const selectedIndex = rows.findIndex((row) => row.date === selectedDate);
    if (selectedIndex < 0) {
      return rows;
    }

    const currentDate = parseDate(selectedDate);
    const period = PERIODS.find((item) => item.key === periodKey) || PERIODS[1];
    if (period.months == null) {
      return rows.slice(0, selectedIndex + 1);
    }

    const cutoff = new Date(currentDate.getTime());
    cutoff.setMonth(cutoff.getMonth() - period.months);
    const visibleRows = rows.filter((row, index) => parseDate(row.date) >= cutoff && index <= selectedIndex);
    return visibleRows.length ? visibleRows : rows.slice(Math.max(0, selectedIndex - 60), selectedIndex + 1);
  }

  function computeDistanceToMa5(row) {
    if (row.ma5 == null || row.close == null || Number(row.ma5) === 0) {
      return null;
    }
    return ((Number(row.close) - Number(row.ma5)) / Number(row.ma5)) * 100;
  }

  function buildDummyRankLabel(row) {
    if (row.newHigh52w) {
      return "新高値 8位";
    }
    if (Number(row.changePercent || 0) >= 0) {
      return "値上がり率 12位";
    }
    return "値下がり率 12位";
  }

  function getSignedClass(value) {
    if (value == null || Number.isNaN(Number(value)) || Number(value) === 0) {
      return "";
    }
    return Number(value) > 0 ? "sample-state-up" : "sample-state-down";
  }

  function buildFutureMetricItems(row, payload) {
    const themes = payload.themes || [];
    return [
      {
        label: "MA75乖離",
        value: formatSignedPercent(row.distanceToMa75),
        note: `MA75 ${formatNumber(row.ma75)}`,
        className: getSignedClass(row.distanceToMa75),
      },
      {
        label: "MA200乖離",
        value: formatSignedPercent(row.distanceToMa200),
        note: row.ma200 == null ? "長期線未計算" : `MA200 ${formatNumber(row.ma200)}`,
        className: getSignedClass(row.distanceToMa200),
      },
      {
        label: "52週位置",
        value: row.rangePosition52w == null ? "-" : `${Number(row.rangePosition52w).toFixed(1)}%`,
        note: "52週レンジ内の位置",
        className: getSignedClass(row.rangePosition52w),
      },
      {
        label: "RCI12",
        value: row.rci12 == null ? "-" : Number(row.rci12).toFixed(1),
        note: "短期の勢い",
        className: getSignedClass(row.rci12),
      },
      {
        label: "RCI24",
        value: row.rci24 == null ? "-" : Number(row.rci24).toFixed(1),
        note: "中期の勢い",
        className: getSignedClass(row.rci24),
      },
      {
        label: "RCI48",
        value: row.rci48 == null ? "-" : Number(row.rci48).toFixed(1),
        note: "長期の勢い",
        className: getSignedClass(row.rci48),
      },
      {
        label: "テーマ1",
        value: themes[0] || "-",
        note: "主要テーマ",
        className: "",
      },
      {
        label: "テーマ2",
        value: themes[1] || "-",
        note: "副テーマ",
        className: "",
      },
      {
        label: "出来高MA5",
        value: formatNumber(row.volumeMa5, 0),
        note: "短期出来高平均",
        className: "",
      },
      {
        label: "出来高MA25",
        value: formatNumber(row.volumeMa25, 0),
        note: "標準出来高平均",
        className: "",
      },
      {
        label: "市場",
        value: payload.market || "-",
        note: payload.industry || payload.sector || "-",
        className: "",
      },
      {
        label: "監視メモ枠",
        value: "余白",
        note: "将来の独自項目用",
        className: "",
      },
    ];
  }

  function readChartTheme() {
    const styles = getComputedStyle(document.documentElement);
    return {
      bg: styles.getPropertyValue("--sample-bg").trim() || "#edf1f6",
      panel: styles.getPropertyValue("--sample-panel").trim() || "#ffffff",
      text: styles.getPropertyValue("--sample-text").trim() || "#172334",
      muted: styles.getPropertyValue("--sample-muted").trim() || "#5e6b7d",
      grid: styles.getPropertyValue("--sample-line").trim() || "#cdd7e4",
      rise: styles.getPropertyValue("--sample-rise").trim() || "#d13052",
      fall: styles.getPropertyValue("--sample-fall").trim() || "#2868a9",
      ma5: styles.getPropertyValue("--sample-ma5").trim() || "#2d8f57",
      ma25: styles.getPropertyValue("--sample-ma25").trim() || "#d58a1e",
      ma75: styles.getPropertyValue("--sample-ma75").trim() || "#7850b7",
      marker: styles.getPropertyValue("--sample-marker").trim() || "#2f3f58",
    };
  }

  function renderError(message) {
    document.getElementById("sampleStatus").textContent = message;
    document.getElementById("sampleStatus").classList.add("sample-state-down");
    document.getElementById("sampleChartMeta").textContent = message;
    document.getElementById("sampleChart").innerHTML = "";
    document.getElementById("sampleInfoCards").innerHTML = `
      <article class="sample-info-card">
        <div class="sample-info-label">読込状態</div>
        <div class="sample-info-value sample-state-down">サンプル表示失敗</div>
        <div class="sample-info-note">${escapeHtml(message)}</div>
      </article>
    `;
  }

  function parseDate(value) {
    return new Date(`${value}T00:00:00`);
  }

  function formatNumber(value, digits = 0) {
    if (value == null || Number.isNaN(Number(value))) {
      return "-";
    }
    const fixed = Number(value).toFixed(digits);
    return Number(fixed).toLocaleString("ja-JP", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatSignedNumber(value) {
    if (value == null || Number.isNaN(Number(value))) {
      return "-";
    }
    const number = Number(value);
    const sign = number > 0 ? "+" : number < 0 ? "" : "";
    return `${sign}${formatNumber(number, 0)}`;
  }

  function formatSignedPercent(value) {
    if (value == null || Number.isNaN(Number(value))) {
      return "-";
    }
    const number = Number(value);
    const sign = number > 0 ? "+" : number < 0 ? "" : "";
    return `${sign}${number.toFixed(2)}%`;
  }

  function formatRatio(value) {
    if (value == null || Number.isNaN(Number(value))) {
      return "-";
    }
    return `${Number(value).toFixed(2)}x`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function rgba(hexColor, alpha) {
    const hex = String(hexColor || "").trim().replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
      return `rgba(0, 0, 0, ${alpha})`;
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
})();
