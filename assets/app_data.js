(function () {
  async function requestWithDesktopFallback(path) {
    const requestPath = String(path || "");
    let response = await fetch(requestPath, { cache: "no-store" });
    const shouldFallback = window.KabuAppUtils?.shouldUseDesktopPortFallback?.(requestPath);
    if (!response.ok && response.status === 404 && shouldFallback) {
      const fallbackUrl = window.KabuAppUtils?.buildDesktopPortFallbackUrl?.(requestPath);
      if (fallbackUrl && fallbackUrl !== requestPath) {
        response = await fetch(fallbackUrl, { cache: "no-store" });
      }
    }
    return response;
  }

  async function loadManifestData(fetchJson, manifestPath) {
    const payload = await fetchJson(manifestPath);
    if (!Array.isArray(payload.availableDates) || !payload.latestDate) {
      throw new Error("manifest.json の形式が不正です。");
    }
    return payload;
  }

  async function loadUpdateHealthData(updateHealthPath) {
    const response = await requestWithDesktopFallback(updateHealthPath);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`JSON 読み込み失敗: ${updateHealthPath} (${response.status})`);
    }
    const payload = await response.json();
    return payload && typeof payload === "object" ? payload : null;
  }

  async function loadThemeOrderData(fetchJson, themeMapPath) {
    const payload = await fetchJson(themeMapPath);
    const items = Array.isArray(payload?.themes) ? payload.themes : [];
    return items
      .map((item) => String(item?.name || item?.label || "").trim())
      .filter(Boolean);
  }

  async function loadOverviewData(fetchJson, date, timeframe = "daily") {
    const suffix = timeframe === "weekly" ? "_weekly" : timeframe === "monthly" ? "_monthly" : "";
    const litePath = `./data/public_json/overview_lite/${date}/market_pulse${suffix}.json`;
    const publicPath = `./data/public_json/overview_recent/${date}/market_pulse${suffix}.json`;
    const legacyPath = `./data/overview/${date}/market_pulse${suffix}.json`;
    const dataMode = new URLSearchParams(window.location.search).get("dataMode") || "";
    if (dataMode === "legacy") {
      try {
        return await fetchJson(legacyPath);
      } catch (legacyError) {
        console.warn("[overview:legacy:missing]", { date, timeframe, reason: legacyError.message || String(legacyError) });
        return fetchJson(litePath);
      }
    }
    try {
      return await fetchJson(litePath);
    } catch (liteError) {
      console.info("[overview:lite:fallback]", { date, timeframe, reason: liteError.message || String(liteError) });
      try {
        return await fetchJson(publicPath);
      } catch (publicError) {
        console.info("[overview:public_json:fallback]", { date, timeframe, reason: publicError.message || String(publicError) });
        return fetchJson(legacyPath);
      }
    }
  }

  async function loadRankingData(date, key, rankingLabel) {
    const path = `./data/rankings/${date}/${key}.json`;
    const response = await requestWithDesktopFallback(path);
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

  async function loadTickerPayloadData(fetchJson, code) {
    return fetchJson(`./data/tickers/${code}.json`);
  }

  async function loadTickerMetaData(fetchJson, code) {
    return fetchJson(`./data/public_json/ticker_meta/${code}.json`);
  }

  async function loadTickerDetailRecentData(fetchJson, code, years = 1) {
    return fetchJson(`./data/public_json/ticker_detail_recent/${years}y/${code}.json`);
  }

  async function loadTickerSummaryData(fetchJson, date) {
    return fetchJson(`./data/cache/ticker_summary/${date}.json`);
  }

  function normalizeYahooMetric(value) {
    return String(value || "")
      .replace(/\[用語\]\([^)]+\)/g, "")
      .replace(/\[[^\]]+\]\([^)]+\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractYahooMetric(text, pattern) {
    const matched = text.match(pattern);
    return normalizeYahooMetric(matched?.[1] || "");
  }

  function parseYahooFinanceMarkdown(code, text) {
    const symbol = `${String(code || "").replace(/\.T$/i, "")}.T`;
    const sourceUrl = `https://finance.yahoo.co.jp/quote/${symbol}`;
    return {
      code: String(code || ""),
      symbol,
      sourceUrl,
      marketCap: extractYahooMetric(text, /時価総額[\s\S]{0,120}?\s([0-9,]+\s百万円(?:\([^)]+\))?)/),
      sharesOutstanding: extractYahooMetric(text, /発行済株式数[\s\S]{0,120}?\s([0-9,]+\s株(?:\([^)]+\))?)/),
      dividendYield: extractYahooMetric(text, /配当利回り（会社予想）[\s\S]{0,120}?\s([0-9.\-]+%|---\(--:--\)|---)/),
      dividendPerShare: extractYahooMetric(text, /1株配当（会社予想）[\s\S]{0,120}?\s([0-9.\-]+(?:\([^)]+\))?|---(?:\([^)]+\))?)/),
      per: extractYahooMetric(text, /PER（会社予想）[\s\S]{0,120}?(?:\(連\))?\s*([0-9.]+\s倍)/),
      pbr: extractYahooMetric(text, /PBR（実績）[\s\S]{0,120}?(?:\(連\))?\s*([0-9.]+\s倍)/),
      eps: extractYahooMetric(text, /EPS（会社予想）[\s\S]{0,120}?(?:\(連\))?\s*([0-9.]+(?:\([^)]+\))?)/),
      bps: extractYahooMetric(text, /BPS（実績）[\s\S]{0,120}?(?:\(連\))?\s*([0-9.]+)/),
      roe: extractYahooMetric(text, /ROE（実績）[\s\S]{0,120}?(?:\(連\))?\s*([0-9.]+%)/),
      equityRatio: extractYahooMetric(text, /自己資本比率（実績）[\s\S]{0,120}?(?:\(連\))?\s*([0-9.]+%)/),
      minPurchase: extractYahooMetric(text, /最低購入代金[\s\S]{0,120}?\s([0-9,]+(?:\([^)]+\))?)/),
      unitShares: extractYahooMetric(text, /単元株数[\s\S]{0,120}?\s([0-9,]+\s株)/),
      marginRatio: extractYahooMetric(text, /信用倍率[\s\S]{0,120}?\s([0-9.]+\s倍(?:\([^)]+\))?)/),
      nextEarningsDate: extractYahooMetric(text, /次回の決算発表日は([^\n。]+(?:頃)?)/),
      earningsSummary: extractYahooMetric(text, /株式会社[^\n]*当中間期業績[^\n]*。/),
    };
  }

  async function loadYahooFinanceProfileData(code) {
    const normalizedCode = String(code || "").trim().replace(/\.T$/i, "");
    if (!normalizedCode) {
      throw new Error("Yahoo Finance 取得用のコードがありません。");
    }
    const url = `https://r.jina.ai/http://finance.yahoo.co.jp/quote/${encodeURIComponent(normalizedCode)}.T`;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Yahoo Finance 取得失敗: ${response.status}`);
      }
      const text = await response.text();
      return parseYahooFinanceMarkdown(normalizedCode, text);
    } catch (error) {
      throw new Error(`Yahoo Finance 指標の取得に失敗しました: ${error.message}`);
    }
  }

  function readJsonStorage(key, fallbackValue) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallbackValue;
    }
    try {
      return JSON.parse(raw);
    } catch (_error) {
      localStorage.removeItem(key);
      return fallbackValue;
    }
  }

  function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  window.KabuAppData = Object.freeze({
    loadManifestData,
    loadUpdateHealthData,
    loadOverviewData,
    loadRankingData,
    loadThemeOrderData,
    loadTickerPayloadData,
    loadTickerMetaData,
    loadTickerDetailRecentData,
    loadTickerSummaryData,
    loadYahooFinanceProfileData,
    readJsonStorage,
    writeJsonStorage,
  });
})();
