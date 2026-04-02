(function () {
  function renderRegisteredMeta(ui, state, deps) {
    const { formatNumber, formatPickedDateTime } = deps;
    if (ui.title) {
      ui.title.textContent = String(state.set?.name || "登録セット");
    }
    if (ui.meta) {
      ui.meta.textContent = `${formatPickedDateTime(state.set?.registeredAt)} / ${formatNumber(Number(state.set?.count || 0), 0)}銘柄`;
    }
  }

  function renderRegisteredTable(ui, state, deps) {
    const { escapeHtml, formatPickedDateTime, renderTickerIdentity } = deps;
    const { getRegisteredItems } = window.KabuPageRegisteredState;
    const items = getRegisteredItems(state.set, deps.dedupeScannerPicks);
    if (!ui.tableBody) {
      return;
    }
    if (!items.length) {
      ui.tableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">登録銘柄がありません。</td></tr>';
      return;
    }
    ui.tableBody.innerHTML = items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.code)}</td>
            <td>${renderTickerIdentity(item.code, item.name || "-", { variant: "table", showCode: false })}</td>
            <td>${escapeHtml(item.market || "-")}</td>
            <td>${escapeHtml(formatPickedDateTime(item.selectedAt))}</td>
          </tr>
        `
      )
      .join("");
  }

  function setRegisteredExportMessage(ui, message) {
    if (ui.exportMessage) {
      ui.exportMessage.textContent = message;
    }
  }

  function renderRegisteredFailure(ui, message) {
    if (ui.chartList) {
      ui.chartList.innerHTML = '<div class="empty-cell picked-chart-empty">登録セットを表示できません。</div>';
    }
    if (ui.tableBody) {
      ui.tableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">登録セットを表示できません。</td></tr>';
    }
    if (ui.exportTradingViewButton) {
      ui.exportTradingViewButton.disabled = true;
    }
    if (ui.exportHyperButton) {
      ui.exportHyperButton.disabled = true;
    }
    setRegisteredExportMessage(ui, message || "");
  }

  window.KabuPageRegisteredRender = Object.freeze({
    renderRegisteredFailure,
    renderRegisteredMeta,
    renderRegisteredTable,
    setRegisteredExportMessage,
  });
})();
