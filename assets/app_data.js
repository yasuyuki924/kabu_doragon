(function () {
  async function loadManifestData(fetchJson, manifestPath) {
    const payload = await fetchJson(manifestPath);
    if (!Array.isArray(payload.availableDates) || !payload.latestDate) {
      throw new Error("manifest.json の形式が不正です。");
    }
    return payload;
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
    return fetchJson(`./data/overview/${date}/market_pulse${suffix}.json`);
  }

  async function loadRankingData(date, key, rankingLabel) {
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

  async function loadTickerPayloadData(fetchJson, code) {
    return fetchJson(`./data/tickers/${code}.json`);
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
    loadOverviewData,
    loadRankingData,
    loadThemeOrderData,
    loadTickerPayloadData,
    readJsonStorage,
    writeJsonStorage,
  });
})();
