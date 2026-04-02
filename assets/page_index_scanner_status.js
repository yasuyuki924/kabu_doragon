(function () {
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

  function resolveHeaderMarketPhase(options = {}) {
    const now = options.now instanceof Date ? options.now : new Date();
    const isJapaneseHoliday = typeof options.isJapaneseHoliday === "function" ? options.isJapaneseHoliday : () => false;
    const day = now.getDay();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (day === 0 || day === 6 || isJapaneseHoliday(currentDate)) {
      return "JP HOLIDAY";
    }
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes < 8 * 60) {
      return "PRE";
    }
    if (minutes < 9 * 60) {
      return "PRE-OPEN";
    }
    if (minutes < 11 * 60 + 30) {
      return "JP LIVE";
    }
    if (minutes < 12 * 60 + 30) {
      return "LUNCH BREAK";
    }
    if (minutes < 15 * 60 + 25) {
      return "JP LIVE";
    }
    if (minutes < 15 * 60 + 30) {
      return "CLOSING AUCTION";
    }
    if (minutes < 18 * 60) {
      return "AFTER CLOSE";
    }
    return "JP CLOSED";
  }

  function resolveHeaderStatusLabel(snapshot, marketPhase) {
    const snapshotStatus = String(snapshot?.status || "").trim();
    const snapshotType = String(snapshot?.type || "").trim();
    if (snapshotStatus === "finalized" || snapshotType === "daily") {
      return "EOD";
    }
    if (marketPhase === "PRE" || marketPhase === "PRE-OPEN") {
      return "PRE";
    }
    if (marketPhase === "LUNCH BREAK") {
      return "PAUSE";
    }
    if (marketPhase === "CLOSING AUCTION") {
      return "CLOSE";
    }
    if (marketPhase === "AFTER CLOSE") {
      return "POST";
    }
    if (marketPhase === "JP HOLIDAY" || marketPhase === "JP CLOSED") {
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
    const marketPhase = options.marketPhase || "JP CLOSED";
    const ageMinutes = Math.max(0, (Date.now() - parsed.getTime()) / 60000);
    const isOffHours = marketPhase === "JP HOLIDAY" || marketPhase === "JP CLOSED" || marketPhase === "AFTER CLOSE";
    if (ageMinutes <= 5) {
      return "fresh";
    }
    if (ageMinutes <= 30) {
      return "warm";
    }
    if (ageMinutes <= 60) {
      return "stale";
    }
    return isOffHours ? "neutral" : "critical";
  }

  function resolveHeaderStatusState(generatedAt, options = {}) {
    const marketPhase = resolveHeaderMarketPhase({ isJapaneseHoliday: options.isJapaneseHoliday });
    return {
      tone: resolveHeaderStatusTone(generatedAt, {
        hasFreshUpdate: Boolean(options.hasFreshUpdate),
        isRefreshing: Boolean(options.isRefreshing),
        marketPhase,
      }),
      pending: Boolean(options.hasFreshUpdate),
      refreshing: Boolean(options.isRefreshing),
      flash: Boolean(options.flash),
      label: resolveHeaderStatusLabel(options.snapshot || {}, marketPhase),
      marketPhase,
    };
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

  window.KabuPageIndexScannerStatus = Object.freeze({
    formatSnapshotGeneratedAtParts,
    isManifestNewer,
    manifestRevisionKey,
    parseSnapshotGeneratedAtToDate,
    resolveHeaderMarketPhase,
    resolveHeaderStatusLabel,
    resolveHeaderStatusState,
    resolveHeaderStatusTone,
  });
})();
