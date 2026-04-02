(function () {
  function createRegisteredPageState() {
    return {
      exportEntries: [],
      manifest: null,
      selectedDate: "",
      bars: 63,
      timeframe: "daily",
      set: null,
    };
  }

  function resolveRegisteredSetId(search) {
    const params = new URLSearchParams(search);
    return String(params.get("id") || "").trim();
  }

  function getRegisteredItems(set, dedupeScannerPicks) {
    return dedupeScannerPicks(set?.items || []);
  }

  window.KabuPageRegisteredState = Object.freeze({
    createRegisteredPageState,
    getRegisteredItems,
    resolveRegisteredSetId,
  });
})();
