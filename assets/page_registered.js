(function () {
  async function initRegisteredPage(deps) {
    const { createRegisteredPageState, resolveRegisteredSetId } = window.KabuPageRegisteredState;
    const { bindRegisteredExportEvents } = window.KabuPageRegisteredEvents;
    const {
      renderRegisteredFailure,
      renderRegisteredMeta,
      renderRegisteredTable,
      setRegisteredExportMessage,
    } = window.KabuPageRegisteredRender;
    const { renderRegisteredCharts } = window.KabuPageRegisteredChart;
    const {
      getRegisteredSetById,
      loadManifest,
      resolveRegisteredSelectedDate,
      showError,
    } = deps;

    const ui = {
      title: document.getElementById("registeredTitle"),
      meta: document.getElementById("registeredMeta"),
      exportMessage: document.getElementById("registeredExportMessage"),
      exportTradingViewButton: document.getElementById("registeredExportTradingViewButton"),
      exportHyperButton: document.getElementById("registeredExportHyperButton"),
      exportList: document.getElementById("registeredExportList"),
      errorBox: document.getElementById("registeredError"),
      chartList: document.getElementById("registeredChartList"),
      tableBody: document.getElementById("registeredTableBody"),
    };
    const state = createRegisteredPageState();

    try {
      const id = resolveRegisteredSetId(window.location.search);
      if (!id) {
        throw new Error("登録セットIDが指定されていません。");
      }

      state.set = getRegisteredSetById(id);
      if (!state.set) {
        throw new Error("指定された登録セットが見つかりません。");
      }

      state.manifest = await loadManifest();
      state.selectedDate = resolveRegisteredSelectedDate(state.set, state.manifest);
      renderRegisteredMeta(ui, state, deps);
      renderRegisteredTable(ui, state, deps);
      bindRegisteredExportEvents(ui, state, deps);
      await renderRegisteredCharts(ui, state, deps);
      setRegisteredExportMessage(ui, "登録セットから TradingView 用TXTと HYPER SBI 2 用CSVを生成します。");
    } catch (error) {
      showError(ui.errorBox, error.message);
      renderRegisteredFailure(ui, error.message);
    }
  }

  window.KabuPageRegistered = Object.freeze({ initRegisteredPage });
})();
