(function () {
  function bindRegisteredExportEvents(ui, state, deps) {
    const {
      buildHyperExportEntries,
      buildTradingViewExportEntry,
      dedupeScannerPicks,
      formatNumber,
      renderExportEntries,
      triggerExportDownloads,
    } = deps;
    const { getRegisteredItems } = window.KabuPageRegisteredState;
    const { setRegisteredExportMessage } = window.KabuPageRegisteredRender;
    const items = getRegisteredItems(state.set, dedupeScannerPicks);
    const hasItems = items.length > 0;

    if (ui.exportTradingViewButton) {
      ui.exportTradingViewButton.disabled = !hasItems;
      ui.exportTradingViewButton.addEventListener("click", () => {
        triggerExportDownloads([buildTradingViewExportEntry(items)]);
        renderExportEntries(ui.exportList, []);
        setRegisteredExportMessage(ui, "TradingView 用TXTをダウンロードしました。");
      });
    }

    if (ui.exportHyperButton) {
      ui.exportHyperButton.disabled = !hasItems;
      ui.exportHyperButton.addEventListener("click", () => {
        const entries = buildHyperExportEntries(items);
        triggerExportDownloads(entries);
        renderExportEntries(ui.exportList, []);
        setRegisteredExportMessage(ui, `HYPER SBI 2 用CSVを${formatNumber(items.length, 0)}銘柄でダウンロードしました。`);
      });
    }
  }

  window.KabuPageRegisteredEvents = Object.freeze({ bindRegisteredExportEvents });
})();
