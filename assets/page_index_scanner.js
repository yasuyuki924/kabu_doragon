(function () {
  async function initIndexScannerPage(deps) {
    with (deps) {
        const {
          formatSnapshotGeneratedAtParts,
          isManifestNewer,
          resolveHeaderStatusState,
        } = window.KabuPageIndexScannerStatus;
        const sortSelect = document.getElementById("indexSort");
        const stickyBar = document.getElementById("indexStickyBar");
        const stickyPickedLink = document.getElementById("indexStickyPickedLink");
        const stickyRefreshButton = document.getElementById("indexStickyRefreshButton");
        const stickyDateButton = document.getElementById("indexStickyDateButton");
        const stickyDatePopover = document.getElementById("indexStickyDatePopover");
        const stickyTimeframeGroup = document.getElementById("indexStickyTimeframe");
        const stickySortSelect = document.getElementById("indexStickySort");
        const stickyLimitSelect = document.getElementById("indexStickyLimit");
        const stickySelectAllPicksButton = document.getElementById("indexStickySelectAllButton");
        const stickyResetPicksButton = document.getElementById("indexStickyResetPicksButton");
        const stickyFiltersButton = document.getElementById("indexStickyFiltersButton");
        const stickyFiltersPopover = document.getElementById("indexStickyFiltersPopover");
        const stickyMiniCalendar = document.getElementById("indexStickyMiniCalendar");
        const stickyTagSelect = document.getElementById("indexStickyTag");
        const stickyThemeSelect = document.getElementById("indexStickyTheme");
        const stickyTurnoverSelect = document.getElementById("indexStickyTurnover");
        const stickyStrategySelect = document.getElementById("indexStickyStrategy");
        const stickyAdvanced = document.getElementById("indexStickyAdvanced");
        const stickyDeviationTitle = document.getElementById("indexStickyDeviationTitle");
        const stickyDevMinInput = document.getElementById("indexStickyDev200Min");
        const stickyDevMaxInput = document.getElementById("indexStickyDev200Max");
        const stickyDevMinNumberInput = document.getElementById("indexStickyDev200MinNumber");
        const stickyDevMaxNumberInput = document.getElementById("indexStickyDev200MaxNumber");
        const stickyDevRangeFill = document.getElementById("indexStickyDev200RangeFill");
        const stickyDevApplyButton = document.getElementById("indexStickyDev200Apply");
        const stickyDevResetButton = document.getElementById("indexStickyDev200Reset");
        const dev200Button = document.getElementById("indexDev200Button");
        const dev200Popover = document.getElementById("indexDev200Popover");
        const deviationPopoverTitle = document.getElementById("indexDeviationPopoverTitle");
        const dev200ModeSelect = document.getElementById("indexDev200Mode");
        const dev200MinInput = document.getElementById("indexDev200Min");
        const dev200MaxInput = document.getElementById("indexDev200Max");
        const dev200ApplyButton = document.getElementById("indexDev200Apply");
        const dev200ResetButton = document.getElementById("indexDev200Reset");
        const tagSelect = document.getElementById("indexTag") || stickyTagSelect;
        const themeSelect = document.getElementById("indexTheme") || stickyThemeSelect;
        const turnoverSelect = document.getElementById("indexTurnover") || stickyTurnoverSelect;
        const limitSelect = document.getElementById("indexLimit");
        const rankingSelect = document.getElementById("indexExtraFilter");
        const timeframeGroup = document.getElementById("indexTimeframe");
        const timeframePopover = document.getElementById("indexTimeframePopover");
        const timeframePopoverTitle = document.getElementById("indexTimeframePopoverTitle");
        const timeframeOptions = document.getElementById("indexTimeframeOptions");
        const rangeChip = document.getElementById("indexRangeChip");
        const pickedLink = document.getElementById("indexPickedLink");
        const picksMenuButton = document.getElementById("indexPicksMenuButton");
        const picksMenu = document.getElementById("indexPicksMenu");
        const updatedStatus = document.getElementById("indexUpdatedStatus");
        const refreshButton = document.getElementById("indexRefreshButton");
        const selectAllPicksButton = document.getElementById("indexSelectAllButton");
        const resetPicksButton = document.getElementById("indexResetPicksButton");
        const customCodeModal = document.getElementById("indexCustomCodeModal");
        const customCodeInput = document.getElementById("indexCustomCodeInput");
        const customCodeMeta = document.getElementById("indexCustomCodeMeta");
        const customCodeApplyButton = document.getElementById("indexCustomCodeApply");
        const customCodeCancelButton = document.getElementById("indexCustomCodeCancel");
        const customCodeCloseButton = document.getElementById("indexCustomCodeClose");
        const customCodeClearButton = document.getElementById("indexCustomCodeClear");
        const customCodeExitButton = document.getElementById("indexCustomCodeExit");
        const miniCalendar = document.getElementById("indexMiniCalendar") || stickyMiniCalendar;
        const errorBox = document.getElementById("indexError");
        const dataQualitySummaryBox = document.getElementById("indexDataQualitySummary");
        const list = document.getElementById("indexList");
      
        const state = {
          manifest: null,
          updateHealth: null,
          overviewDateIndex: null,
          overview: null,
          sort: "gainers",
          tag: "",
          theme: "",
          turnover: 1000000000,
          limit: 200,
          timeframe: "daily",
          rangeMonths: 3,
          rangeMonthsByTimeframe: {
            daily: 3,
            weekly: 12,
            monthly: 60,
          },
          timeframePopoverOpen: false,
          timeframePopoverTarget: "",
          deviationFilters: {
            deviation25: { mode: "", min: "", max: "" },
            deviation75: { mode: "", min: "", max: "" },
            deviation200: { mode: "", min: "", max: "" },
          },
          deviationDrafts: {
            deviation25: { mode: "", min: "", max: "" },
            deviation75: { mode: "", min: "", max: "" },
            deviation200: { mode: "", min: "", max: "" },
          },
          pendingManifest: null,
          hasFreshUpdate: false,
          isRefreshing: false,
          headerStatusFlashTimer: null,
          headerStatusFlashActive: false,
          manifestPollId: null,
          dev200PopoverOpen: false,
          stickyDateOpen: false,
          stickyFiltersOpen: false,
          selectedDate: "",
          calendarMonth: null,
          picks: {},
          themeOrder: [],
          visibleRecords: [],
          selectedStrategies: [],
          customCodeText: "",
          customCodes: [],
          customCodeMissing: [],
          chartObserver: null,
          chartPayloadCache: new Map(),
          chartRequestCache: new Map(),
          fullChartPayloadCache: new Map(),
          fullChartRequestCache: new Map(),
          chartRenderedCodes: new Set(),
          cardChartTimeframes: new Map(),
          chartBaselineShape: null,
        };
        const DEFAULT_INDEX_SORT = "gainers";
        const DEFAULT_INDEX_LIMIT = 200;
        const CUSTOM_CODE_SORT = "custom_codes";
        const CARD_CHART_RANGE_MONTHS = Object.freeze({ daily: 3, weekly: 36, monthly: 60 });
        const rankingOptions = window.KabuAppConfig?.INDEX_SCANNER_RANKING_OPTIONS || [];
        const strategySortKeys = new Set(INDEX_SCANNER_SORT_OPTIONS.map((item) => item.key));
        const rankingSortKeys = new Set(rankingOptions.map((item) => item.key));

        function normalizeOverviewDateList(values) {
          return [...new Set((Array.isArray(values) ? values : [])
            .map((value) => String(value || "").trim())
            .filter(Boolean))]
            .sort();
        }

        function getOverviewDatesForTimeframe(timeframe = state.timeframe) {
          const key = timeframe === "weekly" ? "weekly" : timeframe === "monthly" ? "monthly" : "daily";
          const indexedDates = normalizeOverviewDateList(state.overviewDateIndex?.[key]);
          if (indexedDates.length) {
            return indexedDates;
          }
          return normalizeOverviewDateList(state.manifest?.availableDates || []);
        }

        function overviewDatePeriodKey(dateValue, timeframe) {
          if (timeframe === "monthly") {
            return String(dateValue || "").slice(0, 7);
          }
          if (timeframe === "weekly") {
            const date = parseDate(dateValue);
            if (Number.isNaN(date.getTime())) {
              return "";
            }
            const monday = new Date(date);
            monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
            return formatDateKey(monday);
          }
          return String(dateValue || "");
        }

        function resolveOverviewDateForTimeframe(requestedDate, timeframe = state.timeframe) {
          const availableDates = getOverviewDatesForTimeframe(timeframe);
          if (!requestedDate || !availableDates.length || timeframe === "daily" || availableDates.includes(requestedDate)) {
            return resolveAvailableDate(requestedDate, availableDates);
          }
          const requestedPeriod = overviewDatePeriodKey(requestedDate, timeframe);
          const periodEndDate = availableDates.find(
            (dateValue) => dateValue >= requestedDate && overviewDatePeriodKey(dateValue, timeframe) === requestedPeriod
          );
          return periodEndDate || resolveAvailableDate(requestedDate, availableDates);
        }

        function strategyControlValue() {
          return strategySortKeys.has(state.sort) && state.sort !== DEFAULT_INDEX_SORT ? state.sort : "";
        }

        function rankingControlValue() {
          return rankingSortKeys.has(state.sort) ? state.sort : "";
        }

        function isCustomCodeMode() {
          return state.sort === CUSTOM_CODE_SORT;
        }

        function limitControlValue() {
          return String(state.limit);
        }

        function effectiveTurnoverFilter() {
          return !isCustomCodeMode() && state.timeframe === "daily" ? state.turnover : 0;
        }

        function readStrategyControlValue(control) {
          return String(control?.value || "").trim() || DEFAULT_INDEX_SORT;
        }

        function readRankingControlValue(control) {
          return String(control?.value || "").trim() || DEFAULT_INDEX_SORT;
        }

        function readLimitControlValue(control) {
          const value = Number(control?.value || DEFAULT_INDEX_LIMIT);
          return INDEX_SCANNER_LIMITS.includes(value) ? value : DEFAULT_INDEX_LIMIT;
        }

        function normalizeCustomCodeInput(text) {
          const seen = new Set();
          return String(text || "")
            .replace(/[，、\n\r\t]+/g, " ")
            .split(/[\s,]+/)
            .map((item) => item.trim().replace(/\.T$/i, "").replace(/[^\dA-Za-z]/g, "").toUpperCase())
            .filter(Boolean)
            .filter((code) => {
              if (seen.has(code)) {
                return false;
              }
              seen.add(code);
              return true;
            });
        }

        function formatCustomCodeText(codes) {
          return normalizeCustomCodeInput(codes).join(" ");
        }

        function updateCustomCodeMeta() {
          if (!customCodeMeta) {
            return;
          }
          const codes = normalizeCustomCodeInput(customCodeInput?.value || "");
          customCodeMeta.textContent = `${codes.length}件${codes.length ? " / 重複は適用時に除外" : ""}`;
        }

        function openCustomCodeModal() {
          if (!customCodeModal || !customCodeInput) {
            return;
          }
          customCodeInput.value = state.customCodeText || formatCustomCodeText(state.customCodes);
          updateCustomCodeMeta();
          customCodeModal.hidden = false;
          customCodeModal.classList.add("is-open");
          window.setTimeout(() => customCodeInput.focus(), 0);
        }

        function closeCustomCodeModal() {
          if (!customCodeModal) {
            return;
          }
          customCodeModal.hidden = true;
          customCodeModal.classList.remove("is-open");
        }

        function exitCustomCodeMode() {
          state.sort = DEFAULT_INDEX_SORT;
          closeCustomCodeModal();
          if (rankingSelect) rankingSelect.value = rankingControlValue();
          if (sortSelect) sortSelect.value = strategyControlValue();
          if (stickySortSelect) stickySortSelect.value = strategyControlValue();
        }

        let stopAutoRefreshPolling = null;
      
        if (stickyDatePopover && stickyDatePopover.parentElement !== document.body) {
          document.body.appendChild(stickyDatePopover);
        }
        if (stickyFiltersPopover && stickyBar && stickyFiltersPopover.parentElement !== stickyBar.parentElement) {
          stickyBar.insertAdjacentElement("afterend", stickyFiltersPopover);
        }

        function renderSortOptions(select) {
          if (!select) {
            return;
          }
          select.innerHTML = [
            '<option value="">ストラテジー</option>',
            ...INDEX_SCANNER_SORT_OPTIONS.map(
              (item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`
            ),
          ].join("");
        }

        function renderRankingOptions(select) {
          if (!select) {
            return;
          }
          select.innerHTML = [
            '<option value="">ランキング</option>',
            ...rankingOptions.map(
              (item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`
            ),
          ].join("");
        }

        renderSortOptions(sortSelect);
        renderSortOptions(stickySortSelect);
        renderRankingOptions(rankingSelect);
      
        const params = new URLSearchParams(window.location.search);
        const indexSortKeys = new Set([...strategySortKeys, ...rankingSortKeys]);
        const requestedSort = params.get("sort") || state.sort;
        state.sort = indexSortKeys.has(requestedSort) && requestedSort !== CUSTOM_CODE_SORT ? requestedSort : DEFAULT_INDEX_SORT;
        state.tag = "";
        state.theme = "";
        state.selectedStrategies = [];
        state.turnover = params.has("turnover") && INDEX_SCANNER_TURNOVER_OPTIONS.includes(Number(params.get("turnover")))
          ? Number(params.get("turnover"))
          : state.turnover;
        state.limit = INDEX_SCANNER_LIMITS.includes(Number(params.get("limit"))) ? Number(params.get("limit")) : state.limit;
        state.timeframe = INDEX_SCANNER_TIMEFRAMES.includes(params.get("timeframe")) ? params.get("timeframe") : state.timeframe;
        state.rangeMonths = normalizeIndexScannerRangeMonths(state.timeframe, params.get("range"), state.rangeMonths);
        state.rangeMonthsByTimeframe[state.timeframe] = state.rangeMonths;
        state.deviationDrafts = {
          deviation25: { ...state.deviationFilters.deviation25 },
          deviation75: { ...state.deviationFilters.deviation75 },
          deviation200: { ...state.deviationFilters.deviation200 },
        };
        state.picks = loadScannerPicks();
        if (sortSelect) {
          sortSelect.value = strategyControlValue();
        }
        if (rankingSelect) {
          rankingSelect.value = rankingControlValue();
        }
        themeSelect.value = state.theme;
        turnoverSelect.value = String(state.turnover);
        limitSelect.value = limitControlValue();
        if (stickySortSelect) {
          stickySortSelect.value = strategyControlValue();
        }
        if (stickyLimitSelect) {
          stickyLimitSelect.value = limitControlValue();
        }
        if (stickyTurnoverSelect) {
          stickyTurnoverSelect.value = String(effectiveTurnoverFilter());
        }
        if (stickyStrategySelect) {
          stickyStrategySelect.innerHTML = INDEX_SCANNER_SORT_OPTIONS.map(
            (item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`
          ).join("");
          stickyStrategySelect.value = state.sort;
        }
        const initialDeviationFilter = getActiveDeviationFilter(state);
        if (dev200ModeSelect) {
          dev200ModeSelect.value = initialDeviationFilter.mode || "gte";
        }
        if (dev200MinInput) {
          dev200MinInput.value = initialDeviationFilter.min;
        }
        if (dev200MaxInput) {
          dev200MaxInput.value = initialDeviationFilter.max;
        }
        if (stickyDevMinInput) {
          stickyDevMinInput.value = initialDeviationFilter.min || "-20";
        }
        if (stickyDevMaxInput) {
          stickyDevMaxInput.value = initialDeviationFilter.max || "20";
        }
      
        function updateTimeframeUI() {
          if (!timeframeGroup) {
            return;
          }
          timeframeGroup.querySelectorAll(".group-btn").forEach((btn) => {
            const isActive = btn.dataset.value === state.timeframe;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
          });
        }
      
        function updateRangeChip() {
          if (!rangeChip) {
            return;
          }
          rangeChip.textContent = "";
        }
      
        function updateStickyTimeframeUI() {
          if (!stickyTimeframeGroup) {
            return;
          }
          stickyTimeframeGroup.querySelectorAll(".group-btn").forEach((btn) => {
            const isActive = btn.dataset.value === state.timeframe;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
          });
        }
      
        function updateStickyBarVisibility() {
          if (!stickyBar) {
            return;
          }
          stickyBar.hidden = false;
        }
      
        function updateStickyHeaderActions() {
          if (!stickyPickedLink) {
            return;
          }
          const pickCount = Object.keys(state.picks || {}).length;
          stickyPickedLink.textContent = pickCount > 0 ? `Picks ${pickCount}` : "Picks";
        }
      
        function updateStickyFiltersUi() {
          const activeKey = getActiveDeviationSortKey(state.sort);
          const activeFilter = getActiveDeviationFilter(state);
          const activeDraft = getActiveDeviationDraft(state);
          const effectiveTurnover = effectiveTurnoverFilter();
          const hasFilterSettings =
            Boolean(state.tag) || Boolean(state.theme) || Number(effectiveTurnover || 0) > 0 || Boolean(activeFilter.mode || activeFilter.min || activeFilter.max);
          if (stickyFiltersButton) {
            const deviationSummary = activeKey ? formatDeviationFilterSummary(activeFilter) : "";
            stickyFiltersButton.textContent = deviationSummary || (hasFilterSettings ? "Filters ON" : "Filters");
            stickyFiltersButton.setAttribute("aria-expanded", state.stickyFiltersOpen ? "true" : "false");
            stickyFiltersButton.classList.toggle("is-active", state.stickyFiltersOpen || hasFilterSettings);
          }
          if (stickyFiltersPopover) {
            stickyFiltersPopover.hidden = !state.stickyFiltersOpen;
            stickyFiltersPopover.classList.toggle("is-open", state.stickyFiltersOpen);
          }
          if (stickyTagSelect) {
            stickyTagSelect.value = state.tag;
          }
          if (stickyThemeSelect) {
            stickyThemeSelect.value = state.theme;
          }
          if (stickyTurnoverSelect) {
            stickyTurnoverSelect.value = String(effectiveTurnover);
            stickyTurnoverSelect.disabled = state.timeframe !== "daily";
            stickyTurnoverSelect.title = state.timeframe === "daily" ? "" : "週足/月足では売買代金フィルタを適用しません";
          }
          if (stickyStrategySelect) {
            stickyStrategySelect.value = state.selectedStrategies[0] || "";
          }
          if (stickyAdvanced) {
            stickyAdvanced.hidden = !activeKey;
          }
          if (stickyDeviationTitle) {
            stickyDeviationTitle.textContent = activeKey ? getDeviationSortLabel(activeKey) : "Deviation";
          }
          setStickyDeviationControls(activeDraft);
        }
      
        function updateStickyDateUi() {
          if (stickyDateButton) {
            const label = state.selectedDate ? state.selectedDate.replace(/-/g, ".") : "";
            stickyDateButton.textContent = label ? `${label} ▼` : "日付 ▼";
            stickyDateButton.setAttribute("aria-expanded", state.stickyDateOpen ? "true" : "false");
          }
          if (stickyDatePopover) {
            stickyDatePopover.hidden = !state.stickyDateOpen;
            stickyDatePopover.classList.toggle("is-open", state.stickyDateOpen);
            if (state.stickyDateOpen) {
              requestAnimationFrame(positionDatePopover);
            } else {
              stickyDatePopover.style.left = "";
              stickyDatePopover.style.top = "";
              stickyDatePopover.style.maxHeight = "";
            }
          }
        }

        function setPicksMenuOpen(isOpen) {
          if (!picksMenu || !picksMenuButton) {
            return;
          }
          picksMenu.hidden = !isOpen;
          picksMenu.classList.toggle("is-open", isOpen);
          picksMenuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
        }
      
        function buildDeviationFilterFromBounds(minValue, maxValue) {
          const min = normalizeDeviationFilterValue(minValue);
          const max = normalizeDeviationFilterValue(maxValue);
          if (min === "" && max === "") {
            return { mode: "", min: "", max: "" };
          }
          if (min !== "" && max !== "") {
            const minNum = Number(min);
            const maxNum = Number(max);
            if (Number.isFinite(minNum) && Number.isFinite(maxNum) && minNum > maxNum) {
              return { mode: "between", min: String(maxNum), max: String(minNum) };
            }
            return { mode: "between", min, max };
          }
          if (min !== "") {
            return { mode: "gte", min, max: "" };
          }
          return { mode: "lte", min: "", max };
        }
      
        function formatDeviationFilterSummary(filter) {
          if (!filter || (!filter.mode && filter.min === "" && filter.max === "")) {
            return "";
          }
          if (filter.min !== "" && filter.max !== "") {
            return `Dev ${formatDeviationPercent(filter.min)} ~ ${formatDeviationPercent(filter.max)}`;
          }
          if (filter.min !== "") {
            return `Dev >= ${formatDeviationPercent(filter.min)}`;
          }
          if (filter.max !== "") {
            return `Dev <= ${formatDeviationPercent(filter.max)}`;
          }
          return "";
        }
      
        function setStickyDeviationControls(filter) {
          const min = filter?.min ?? "";
          const max = filter?.max ?? "";
          if (stickyDevMinInput) {
            stickyDevMinInput.value = min === "" ? "-20" : String(min);
          }
          if (stickyDevMaxInput) {
            stickyDevMaxInput.value = max === "" ? "20" : String(max);
          }
          if (stickyDevMinNumberInput) {
            stickyDevMinNumberInput.value = min === "" ? "" : Number(min).toFixed(1);
          }
          if (stickyDevMaxNumberInput) {
            stickyDevMaxNumberInput.value = max === "" ? "" : Number(max).toFixed(1);
          }
          syncStickyDeviationSliderUi("state");
        }
      
        function formatDeviationPercent(value) {
          const numeric = Number(value || 0);
          const text = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
          return `${numeric > 0 ? "+" : ""}${text}%`;
        }
      
        function clampDeviationSliderValue(value, fallback = 0) {
          const numeric = Number(value);
          if (!Number.isFinite(numeric)) {
            return fallback;
          }
          return Math.max(-20, Math.min(20, Math.round(numeric * 10) / 10));
        }
      
        function syncStickyDeviationSliderUi(source = "slider") {
          if (!stickyDevMinInput || !stickyDevMaxInput) {
            return;
          }
          let minValue = -20;
          let maxValue = 20;
          let minDraftValue = stickyDevMinNumberInput?.value?.trim?.() ?? "";
          let maxDraftValue = stickyDevMaxNumberInput?.value?.trim?.() ?? "";
      
          if (source === "slider") {
            minValue = clampDeviationSliderValue(stickyDevMinInput.value, -20);
            maxValue = clampDeviationSliderValue(stickyDevMaxInput.value, 20);
            if (minValue > maxValue) {
              if (document.activeElement === stickyDevMinInput) {
                maxValue = minValue;
              } else {
                minValue = maxValue;
              }
            }
            stickyDevMinInput.value = String(minValue);
            stickyDevMaxInput.value = String(maxValue);
            minDraftValue = minValue.toFixed(1);
            maxDraftValue = maxValue.toFixed(1);
            if (stickyDevMinNumberInput) {
              stickyDevMinNumberInput.value = minDraftValue;
            }
            if (stickyDevMaxNumberInput) {
              stickyDevMaxNumberInput.value = maxDraftValue;
            }
          } else {
            minValue = minDraftValue === "" ? -20 : clampDeviationSliderValue(minDraftValue, -20);
            maxValue = maxDraftValue === "" ? 20 : clampDeviationSliderValue(maxDraftValue, 20);
            if (minValue > maxValue) {
              if (document.activeElement === stickyDevMinInput || document.activeElement === stickyDevMinNumberInput) {
                maxValue = minValue;
                if (maxDraftValue !== "") {
                  maxDraftValue = maxValue.toFixed(1);
                }
              } else {
                minValue = maxValue;
                if (minDraftValue !== "") {
                  minDraftValue = minValue.toFixed(1);
                }
              }
            }
            stickyDevMinInput.value = String(minValue);
            stickyDevMaxInput.value = String(maxValue);
            if (source === "input") {
              if (stickyDevMinNumberInput && minDraftValue !== "") {
                stickyDevMinNumberInput.value = Number(minDraftValue).toFixed(1);
              }
              if (stickyDevMaxNumberInput && maxDraftValue !== "") {
                stickyDevMaxNumberInput.value = Number(maxDraftValue).toFixed(1);
              }
            }
          }
          const percent = (value) => ((value + 20) / 40) * 100;
          if (stickyDevRangeFill) {
            stickyDevRangeFill.style.left = `${percent(minValue)}%`;
            stickyDevRangeFill.style.width = `${Math.max(0, percent(maxValue) - percent(minValue))}%`;
          }
          const activeKey = getActiveDeviationSortKey(state.sort);
          if (activeKey && source !== "state") {
            const nextDraft = buildDeviationFilterFromBounds(
              minDraftValue,
              maxDraftValue,
            );
            state.deviationDrafts[activeKey] = nextDraft;
          }
        }
      
        function positionFloatingPopover(anchor, popover, options = {}) {
          if (!anchor || !popover) {
            return;
          }
          const widthPadding = Number(options.widthPadding || 12);
          const anchorRect = anchor.getBoundingClientRect();
          const popoverRect = popover.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const maxLeft = Math.max(widthPadding, viewportWidth - popoverRect.width - widthPadding);
          const idealLeft = anchorRect.right - popoverRect.width;
          const left = Math.min(Math.max(widthPadding, idealLeft), maxLeft);
          const top = Math.min(
            Math.max(8, anchorRect.bottom + 8),
            Math.max(8, viewportHeight - popoverRect.height - 8),
          );
          popover.style.left = `${Math.round(left)}px`;
          popover.style.top = `${Math.round(top)}px`;
        }
      
        function positionDatePopover() {
          if (!stickyDateButton || !stickyDatePopover) {
            return;
          }
          const gap = 8;
          const padding = 12;
          const anchorRect = stickyDateButton.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
      
          stickyDatePopover.style.left = "0px";
          stickyDatePopover.style.top = "0px";
          stickyDatePopover.style.maxHeight = `min(360px, calc(100vh - 24px))`;
      
          const popoverRect = stickyDatePopover.getBoundingClientRect();
          const popoverWidth = Math.min(popoverRect.width, viewportWidth - padding * 2);
          const naturalHeight = popoverRect.height;
          const availableBelow = viewportHeight - anchorRect.bottom - gap - padding;
          const availableAbove = anchorRect.top - gap - padding;
          const shouldOpenAbove = availableBelow < naturalHeight && availableAbove > availableBelow;
          const availableHeight = Math.max(180, shouldOpenAbove ? availableAbove : availableBelow);
          const maxHeight = Math.min(360, Math.max(180, availableHeight));
      
          stickyDatePopover.style.maxHeight = `${Math.round(maxHeight)}px`;
          const measuredHeight = Math.min(stickyDatePopover.getBoundingClientRect().height, maxHeight);
          const left = Math.min(
            Math.max(padding, anchorRect.left),
            Math.max(padding, viewportWidth - popoverWidth - padding)
          );
          const top = shouldOpenAbove
            ? Math.max(padding, anchorRect.top - measuredHeight - gap)
            : Math.min(viewportHeight - measuredHeight - padding, anchorRect.bottom + gap);
      
          stickyDatePopover.style.left = `${Math.round(left)}px`;
          stickyDatePopover.style.top = `${Math.round(top)}px`;
        }
      
        function updateTimeframePopover() {
          const targetTimeframe = state.timeframePopoverTarget || state.timeframe;
          const options = INDEX_SCANNER_TIMEFRAME_RANGES[targetTimeframe] || [];
          const targetRangeMonths = state.rangeMonthsByTimeframe[targetTimeframe] || options[0]?.months || state.rangeMonths;
          if (timeframePopoverTitle) {
            timeframePopoverTitle.textContent = `${indexScannerTimeframeLabel(targetTimeframe)} Range`;
          }
          if (timeframeOptions) {
            timeframeOptions.innerHTML = options
              .map((option) => `
                <button
                  type="button"
                  class="index-timeframe-option${option.months === targetRangeMonths ? " is-active" : ""}"
                  data-timeframe-option="${targetTimeframe}"
                  data-range-months="${option.months}"
                >${option.label}</button>
              `)
              .join("");
            Array.from(timeframeOptions.querySelectorAll("button[data-timeframe-option]")).forEach((button) => {
              button.addEventListener("click", async () => {
                state.timeframe = String(button.dataset.timeframeOption || state.timeframe);
                state.rangeMonths = normalizeIndexScannerRangeMonths(state.timeframe, button.dataset.rangeMonths, state.rangeMonths);
                state.rangeMonthsByTimeframe[state.timeframe] = state.rangeMonths;
                state.timeframePopoverOpen = false;
                state.timeframePopoverTarget = "";
                updateTimeframeUI();
                updateRangeChip();
                updateTimeframePopover();
                try {
                  errorBox.hidden = true;
                  list.innerHTML = '<div class="empty-cell">読み込み中...</div>';
                  state.overview = await loadOverview(state.selectedDate, state.timeframe);
                  renderTagOptions();
                } catch (error) {
                  showError(errorBox, error.message);
                  return;
                }
                await render();
              });
            });
          }
          if (timeframePopover) {
            const isOpen = state.timeframePopoverOpen && Boolean(state.timeframePopoverTarget);
            timeframePopover.hidden = !isOpen;
            timeframePopover.classList.toggle("is-open", isOpen);
          }
        }

        updateTimeframeUI();
        updateStickyTimeframeUI();
        updateRangeChip();
        updateTimeframePopover();
        updateDeviation200Controls();
        updateStickyDateUi();
        updateStickyFiltersUi();
        updateStickyBarVisibility();
        if (pickedLink) {
          pickedLink.href = "./picked.html";
        }
        if (stickyPickedLink) {
          stickyPickedLink.href = "./picked.html";
        }
      
        [...new Set([sortSelect, rankingSelect, tagSelect, themeSelect, turnoverSelect, limitSelect, stickySortSelect, stickyTagSelect, stickyThemeSelect, stickyTurnoverSelect, stickyLimitSelect].filter(Boolean))]
          .forEach((control) => {
          control.addEventListener("change", async () => {
            const activeSortControl = stickySortSelect?.matches(":focus") ? stickySortSelect : sortSelect;
            if (control === rankingSelect) {
              state.sort = readRankingControlValue(rankingSelect);
            } else if (control === sortSelect || control === stickySortSelect) {
              state.sort = readStrategyControlValue(activeSortControl);
            }
            state.tag = stickyTagSelect?.matches(":focus") ? stickyTagSelect.value : tagSelect.value;
            state.theme = stickyThemeSelect?.matches(":focus") ? stickyThemeSelect.value : themeSelect.value;
            state.turnover = Number(stickyTurnoverSelect?.matches(":focus") ? stickyTurnoverSelect.value : turnoverSelect.value);
            state.limit = readLimitControlValue(stickyLimitSelect?.matches(":focus") ? stickyLimitSelect : limitSelect);
            if (sortSelect) sortSelect.value = strategyControlValue();
            if (rankingSelect) rankingSelect.value = rankingControlValue();
            if (stickySortSelect) stickySortSelect.value = strategyControlValue();
            if (tagSelect) tagSelect.value = state.tag;
            if (stickyTagSelect) stickyTagSelect.value = state.tag;
            if (themeSelect) themeSelect.value = state.theme;
            if (stickyThemeSelect) stickyThemeSelect.value = state.theme;
            if (turnoverSelect) turnoverSelect.value = String(state.turnover);
            if (stickyTurnoverSelect) stickyTurnoverSelect.value = String(effectiveTurnoverFilter());
            if (limitSelect) limitSelect.value = limitControlValue();
            if (stickyLimitSelect) stickyLimitSelect.value = limitControlValue();
            const activeDeviationKey = getActiveDeviationSortKey(state.sort);
            if (activeDeviationKey) {
              state.deviationDrafts[activeDeviationKey] = { ...state.deviationFilters[activeDeviationKey] };
            }
            updateDeviation200Controls();
            updateStickyFiltersUi();
            if (isCustomCodeMode()) {
              openCustomCodeModal();
            }
            await render();
          });
        });
      
        [stickyDevMinInput, stickyDevMaxInput].filter(Boolean).forEach((input) => {
          input.addEventListener("input", () => {
            syncStickyDeviationSliderUi("slider");
          });
        });
      
        [stickyDevMinNumberInput, stickyDevMaxNumberInput].filter(Boolean).forEach((input) => {
          input.addEventListener("input", () => {
            syncStickyDeviationSliderUi("input");
          });
          input.addEventListener("change", () => {
            syncStickyDeviationSliderUi("input");
          });
        });
      
        stickyDevApplyButton?.addEventListener("click", async (event) => {
          event.preventDefault();
          const activeKey = getActiveDeviationSortKey(state.sort);
          if (!activeKey) {
            return;
          }
          const nextFilter = buildDeviationFilterFromBounds(
            stickyDevMinNumberInput?.value,
            stickyDevMaxNumberInput?.value,
          );
          state.deviationDrafts[activeKey] = nextFilter;
          state.deviationFilters[activeKey] = nextFilter;
          setStickyDeviationControls(nextFilter);
          console.debug('[Deviation Apply]', {
            draftDevMin: stickyDevMinNumberInput?.value ?? '',
            draftDevMax: stickyDevMaxNumberInput?.value ?? '',
            appliedDevMin: nextFilter.min,
            appliedDevMax: nextFilter.max,
          });
          updateDeviation200Controls();
          updateStickyFiltersUi();
          await render();
          console.debug('[Deviation Apply Result]', {
            updatedUrl: window.location.href,
            filteredResultCount: state.visibleRecords?.length ?? 0,
          });
        });
      
        stickyDevResetButton?.addEventListener("click", async (event) => {
          event.preventDefault();
          const activeKey = getActiveDeviationSortKey(state.sort);
          if (activeKey) {
            state.deviationDrafts[activeKey] = { mode: "", min: "", max: "" };
            state.deviationFilters[activeKey] = { mode: "", min: "", max: "" };
          }
          if (stickyDevMinNumberInput) stickyDevMinNumberInput.value = "";
          if (stickyDevMaxNumberInput) stickyDevMaxNumberInput.value = "";
          setStickyDeviationControls({ mode: "", min: "", max: "" });
          updateDeviation200Controls();
          updateStickyFiltersUi();
          await render();
        });

        stickyFiltersButton?.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          state.stickyFiltersOpen = !state.stickyFiltersOpen;
          state.stickyDateOpen = false;
          updateStickyFiltersUi();
          updateStickyDateUi();
        });
      
        stickyFiltersPopover?.addEventListener("click", (event) => {
          event.stopPropagation();
        });
      
        stickyDateButton?.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          state.stickyDateOpen = !state.stickyDateOpen;
          state.stickyFiltersOpen = false;
          updateStickyDateUi();
          updateStickyFiltersUi();
        });
      
        stickyDatePopover?.addEventListener("click", (event) => {
          event.stopPropagation();
        });

        picksMenuButton?.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setPicksMenuOpen(Boolean(picksMenu?.hidden));
          state.stickyDateOpen = false;
          state.stickyFiltersOpen = false;
          updateStickyDateUi();
          updateStickyFiltersUi();
        });

        picksMenu?.addEventListener("click", (event) => {
          event.stopPropagation();
        });
      
        document.addEventListener("click", (event) => {
          if (picksMenu && picksMenuButton && !picksMenu.hidden) {
            if (!picksMenu.contains(event.target) && !picksMenuButton.contains(event.target)) {
              setPicksMenuOpen(false);
            }
          }
          if (state.timeframePopoverOpen && timeframePopover && timeframeGroup) {
            if (!timeframePopover.contains(event.target) && !timeframeGroup.contains(event.target)) {
              state.timeframePopoverOpen = false;
              state.timeframePopoverTarget = "";
              updateTimeframePopover();
            }
          }
          if (state.stickyFiltersOpen && stickyFiltersPopover && stickyFiltersButton) {
            if (!stickyFiltersPopover.contains(event.target) && !stickyFiltersButton.contains(event.target)) {
              state.stickyFiltersOpen = false;
              updateStickyFiltersUi();
            }
          }
          if (state.stickyDateOpen && stickyDatePopover && stickyDateButton) {
            if (!stickyDatePopover.contains(event.target) && !stickyDateButton.contains(event.target)) {
              state.stickyDateOpen = false;
              updateStickyDateUi();
            }
          }
          if (!(event.target instanceof Element) || !event.target.closest("[data-strategy-bar]")) {
            closeAllStrategyPopovers();
          }
        });
      
        window.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            if (state.timeframePopoverOpen) {
              state.timeframePopoverOpen = false;
              state.timeframePopoverTarget = "";
              updateTimeframePopover();
            }
            if (state.stickyFiltersOpen) {
              state.stickyFiltersOpen = false;
              updateStickyFiltersUi();
            }
            if (state.stickyDateOpen) {
              state.stickyDateOpen = false;
              updateStickyDateUi();
            }
            setPicksMenuOpen(false);
            closeCustomCodeModal();
            closeAllStrategyPopovers();
          }
        });
      
        window.addEventListener("resize", () => {
          if (state.stickyDateOpen) {
            positionDatePopover();
          }
        });
      
        window.addEventListener("scroll", () => {
          if (state.stickyDateOpen) {
            positionDatePopover();
          }
        }, { passive: true });
      
        if (timeframeGroup) {
          const LONG_PRESS_MS = 420;
          timeframeGroup.querySelectorAll(".group-btn").forEach((btn) => {
            let longPressTimer = null;
            let longPressTriggered = false;
      
            const clearLongPressTimer = () => {
              if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
              }
            };
      
            const openTimeframePopover = () => {
              state.timeframePopoverTarget = String(btn.dataset.value || state.timeframe);
              state.timeframePopoverOpen = true;
              updateTimeframePopover();
            };
      
            btn.addEventListener("pointerdown", (event) => {
              if (event.button !== 0) {
                return;
              }
              longPressTriggered = false;
              clearLongPressTimer();
              longPressTimer = setTimeout(() => {
                longPressTriggered = true;
                openTimeframePopover();
              }, LONG_PRESS_MS);
            });
      
            ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
              btn.addEventListener(eventName, clearLongPressTimer);
            });
      
            btn.addEventListener("click", async (event) => {
              event.preventDefault();
              event.stopPropagation();
              clearLongPressTimer();
              const nextTimeframe = String(btn.dataset.value || state.timeframe);
              if (longPressTriggered) {
                longPressTriggered = false;
                return;
              }
              if (state.timeframe === nextTimeframe && !state.timeframePopoverOpen) {
                openTimeframePopover();
                return;
              }
              state.timeframe = nextTimeframe;
              state.rangeMonths = normalizeIndexScannerRangeMonths(
                state.timeframe,
                state.rangeMonthsByTimeframe[state.timeframe],
                state.rangeMonths,
              );
              state.rangeMonthsByTimeframe[state.timeframe] = state.rangeMonths;
              state.timeframePopoverOpen = false;
              state.timeframePopoverTarget = "";
              updateTimeframeUI();
              updateRangeChip();
              updateTimeframePopover();
              try {
                errorBox.hidden = true;
                list.innerHTML = '<div class="empty-cell">読み込み中...</div>';
                await loadDate(state.selectedDate);
              } catch (error) {
                showError(errorBox, error.message);
                return;
              }
              await render();
            });
          });
        }
      
        if (resetPicksButton) {
          resetPicksButton.addEventListener("click", async () => {
            setPicksMenuOpen(false);
            resetScannerPicks(state);
            await render();
          });
        }
        if (stickyResetPicksButton) {
          stickyResetPicksButton.addEventListener("click", async () => {
            resetScannerPicks(state);
            await render();
          });
        }
        if (selectAllPicksButton) {
          selectAllPicksButton.addEventListener("click", async () => {
            setPicksMenuOpen(false);
            selectAllScannerPicks(state.visibleRecords, state);
            await render();
          });
        }
        if (stickySelectAllPicksButton) {
          stickySelectAllPicksButton.addEventListener("click", async () => {
            selectAllScannerPicks(state.visibleRecords, state);
            await render();
          });
        }

        customCodeInput?.addEventListener("input", updateCustomCodeMeta);
        customCodeApplyButton?.addEventListener("click", async () => {
          state.customCodes = normalizeCustomCodeInput(customCodeInput?.value || "");
          state.customCodeText = formatCustomCodeText(state.customCodes);
          if (customCodeInput) {
            customCodeInput.value = state.customCodeText;
          }
          state.sort = CUSTOM_CODE_SORT;
          closeCustomCodeModal();
          if (rankingSelect) rankingSelect.value = rankingControlValue();
          if (sortSelect) sortSelect.value = strategyControlValue();
          if (stickySortSelect) stickySortSelect.value = strategyControlValue();
          await render();
        });
        customCodeClearButton?.addEventListener("click", () => {
          if (customCodeInput) {
            customCodeInput.value = "";
          }
          updateCustomCodeMeta();
        });
        customCodeExitButton?.addEventListener("click", async () => {
          exitCustomCodeMode();
          await render();
        });
        [customCodeCancelButton, customCodeCloseButton].filter(Boolean).forEach((button) => {
          button.addEventListener("click", async () => {
            closeCustomCodeModal();
            if (isCustomCodeMode() && !state.customCodes.length) {
              exitCustomCodeMode();
              await render();
            }
          });
        });
        customCodeModal?.addEventListener("click", async (event) => {
          if (event.target !== customCodeModal) {
            return;
          }
          closeCustomCodeModal();
          if (isCustomCodeMode() && !state.customCodes.length) {
            exitCustomCodeMode();
            await render();
          }
        });

        async function refreshIndexScanner(nextManifest = null) {
          state.isRefreshing = true;
          updateHeaderStatus();
          await runRefreshAction(refreshButton, errorBox, async () => {
            state.manifest = nextManifest || state.pendingManifest || await loadManifest();
            state.overviewDateIndex = await loadOverviewDateIndex();
            state.pendingManifest = null;
            state.hasFreshUpdate = false;
            await loadDate(state.selectedDate || state.manifest.latestDate);
            await render();
          });
          state.isRefreshing = false;
          triggerHeaderStatusFlash();
          updateHeaderStatus();
        }

        refreshButton?.addEventListener("click", async () => {
          await refreshIndexScanner();
        });
      
        try {
          state.manifest = await loadManifest();
          state.overviewDateIndex = await loadOverviewDateIndex();
          state.themeOrder = await loadThemeOrder();
          await loadDate(params.get("date") || state.manifest.latestDate);
          await render();
          startManifestPolling();
        } catch (error) {
          showError(errorBox, error.message);
        }
      
        async function loadDate(requestedDate) {
          state.selectedDate = resolveOverviewDateForTimeframe(requestedDate, state.timeframe);
          state.overview = await loadOverview(state.selectedDate, state.timeframe);
          state.updateHealth = await loadUpdateHealth();
          state.calendarMonth = startOfMonth(parseDate(state.selectedDate));
          renderTagOptions();
          renderDateControls();
          renderCalendar();
        }
      
        function renderTagOptions() {
          const turnoverRecords = filterByTurnover(state.overview.records || [], effectiveTurnoverFilter());
          const industries = [...new Set(
            turnoverRecords
              .map((record) => String(record.industry || "").trim())
              .filter(
                (industry) =>
                  industry &&
                  !TSE_MARKETS.has(industry) &&
                  !MARKET_TAGS.has(industry.toLowerCase())
              )
          )].sort();
          tagSelect.innerHTML = ['<option value="">すべて</option>']
            .concat(industries.map((industry) => `<option value="${escapeHtml(industry)}">${escapeHtml(industry)}</option>`))
            .join("");
          if (stickyTagSelect) {
            stickyTagSelect.innerHTML = tagSelect.innerHTML;
          }
          if (state.tag && !industries.includes(state.tag)) {
            state.tag = "";
          }
          tagSelect.value = state.tag;
          if (stickyTagSelect) {
            stickyTagSelect.value = state.tag;
          }
        }
      
        function renderThemeOptions() {
          const turnoverRecords = filterByTurnover(state.overview.records || [], effectiveTurnoverFilter());
          const availableThemes = new Set();
          turnoverRecords.forEach((record) => {
            (record.themes || []).forEach((theme) => {
              const label = String(theme || "").trim();
              if (label) {
                availableThemes.add(label);
              }
            });
          });
          const orderedThemes = state.themeOrder.filter((theme) => availableThemes.has(theme));
          const extraThemes = [...availableThemes].filter((theme) => !state.themeOrder.includes(theme)).sort((left, right) =>
            left.localeCompare(right, "ja", { sensitivity: "base" })
          );
          const themeOptions = ["", ...orderedThemes, ...extraThemes];
          themeSelect.innerHTML = themeOptions
            .map((theme) => `<option value="${escapeHtml(theme)}">${escapeHtml(theme || "すべて")}</option>`)
            .join("");
          if (stickyThemeSelect) {
            stickyThemeSelect.innerHTML = themeSelect.innerHTML;
          }
          if (state.theme && !availableThemes.has(state.theme)) {
            state.theme = "";
          }
          themeSelect.value = state.theme;
          if (stickyThemeSelect) {
            stickyThemeSelect.value = state.theme;
          }
        }
      
        function updateIndexHeaderActions() {
          if (!pickedLink) {
            return;
          }
          const pickCount = Object.keys(state.picks || {}).length;
          pickedLink.textContent = pickCount > 0 ? `Picks ${pickCount}` : "Picks";
          if (stickyPickedLink) {
            stickyPickedLink.textContent = pickCount > 0 ? `Picks ${pickCount}` : "Picks";
          }
        }
      
        function updateHeaderStatus() {
          if (!updatedStatus) {
            return;
          }
          const currentSnapshot = state.manifest?.currentSnapshot || {};
          const rawHealthPayload = state.updateHealth && typeof state.updateHealth === "object" ? state.updateHealth : null;
          const healthCheckedAt = String(rawHealthPayload?.checkedAt || "").trim();
          const healthCheckedAtMs = healthCheckedAt ? Date.parse(healthCheckedAt) : NaN;
          const manifestGeneratedAtMs = Date.parse(String(state.manifest?.generatedAt || ""));
          const healthAgeMs = Number.isFinite(healthCheckedAtMs) ? Math.max(0, Date.now() - healthCheckedAtMs) : Number.POSITIVE_INFINITY;
          const isHealthOutdated =
            !Number.isFinite(healthCheckedAtMs) ||
            healthAgeMs > 6 * 60 * 60 * 1000 ||
            (Number.isFinite(manifestGeneratedAtMs) && healthCheckedAtMs + 60_000 < manifestGeneratedAtMs);
          const healthPayload = isHealthOutdated ? null : rawHealthPayload;
          const healthManifest = healthPayload?.manifest || {};
          const reasonCodes = Array.isArray(healthPayload?.reasonCodes) ? healthPayload.reasonCodes : [];
          const launchAgentRegistered = healthPayload?.launchAgentRegistered === false
            ? false
            : Boolean(healthPayload?.launchAgent?.registered ?? true);
          const healthLatestDate = String(healthManifest.latestDate || state.manifest?.latestDate || "").trim();
          const healthGeneratedAt = String(
            healthManifest.generatedAt || state.manifest?.generatedAt || currentSnapshot?.generatedAt || ""
          ).trim();
          const hasDelay = reasonCodes.some((code) =>
            ["STALE_MANIFEST", "STALE_UPDATE_STATE", "LOG_NOT_UPDATED", "RECOVERY_FAILED"].includes(String(code || ""))
          );
          const healthAlerts = [];
          if (hasDelay) {
            healthAlerts.push("更新遅延");
          }
          if (!launchAgentRegistered) {
            healthAlerts.push("自動更新未登録");
          }
          const healthUpdatedAt = healthCheckedAt || healthGeneratedAt;
          const healthUpdatedAtParts = formatSnapshotGeneratedAtParts(healthUpdatedAt);
          const healthUpdatedAtLabel = healthUpdatedAtParts.hm || healthUpdatedAtParts.full || healthUpdatedAt || "--";
          const statusState = resolveHeaderStatusState(currentSnapshot?.generatedAt, {
            snapshot: currentSnapshot,
            hasFreshUpdate: state.hasFreshUpdate,
            isRefreshing: state.isRefreshing,
            flash: state.headerStatusFlashActive,
            isJapaneseHoliday,
          });
          const headerLatestDate = String(healthLatestDate || currentSnapshot?.date || state.manifest?.latestDate || "").trim();
          const headerLatestDateLabel = headerLatestDate ? headerLatestDate.replace(/-/g, ".") : "--";
          const healthStatus = String(rawHealthPayload?.status || "").trim().toLowerCase();
          const isUpdateFailed = healthStatus === "failed" || reasonCodes.some((code) => String(code || "").includes("FAILED"));
          const isUpdating = Boolean(statusState.pending || statusState.refreshing || hasDelay);
          const headerStateClass = isUpdateFailed
            ? "failed"
            : isUpdating
              ? "updating"
              : "latest";
          const headerLabel = isUpdateFailed ? "更新失敗" : isUpdating ? (statusState.refreshing ? "更新中" : "更新待ち") : "最新";
          const autoUpdateLabel = launchAgentRegistered && !isUpdateFailed && !isUpdating ? "自動更新 OK" : launchAgentRegistered ? "自動更新 要確認" : "自動更新 未登録";
          updatedStatus.className = [
            "index-header-status",
            `index-header-status--${statusState.tone}`,
            `index-header-status--${headerStateClass}`,
            statusState.pending ? "index-header-status--pending" : "",
            statusState.refreshing ? "index-header-status--refreshing" : "",
            statusState.flash ? "index-header-status--flash" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const headerTooltip = [
            `最新データ日 ${headerLatestDateLabel}`,
            `最終更新 ${healthUpdatedAtLabel}`,
            `${autoUpdateLabel}${healthAlerts.length ? ` / ${healthAlerts.join(",")}` : ""}`,
            statusState.pending ? "new data ready" : "",
            statusState.refreshing ? "refreshing" : "",
          ]
            .filter(Boolean)
            .join(" / ");
          updatedStatus.removeAttribute("title");
          updatedStatus.setAttribute("data-status-tooltip", headerTooltip);
          updatedStatus.innerHTML = `
            <span class="index-header-status-dot" aria-hidden="true"></span>
            <span class="index-header-status-body">
              <span class="index-header-status-topline">
                <span class="index-header-status-market">${escapeHtml(headerLabel)}</span>
              </span>
            </span>
          `;
        }

        function closeStrategyPopover(card) {
          if (!card) {
            return;
          }
          const popover = card.querySelector("[data-strategy-popover]");
          if (popover) {
            popover.hidden = true;
          }
          card.querySelectorAll("[data-strategy-badge]").forEach((button) => {
            button.classList.remove("is-active");
            button.setAttribute("aria-expanded", "false");
          });
          card.querySelectorAll("[data-strategy-panel]").forEach((panel) => {
            panel.hidden = true;
          });
        }

        function closeAllStrategyPopovers() {
          list?.querySelectorAll(".scanner-item").forEach((card) => closeStrategyPopover(card));
        }

        function disconnectChartObserver() {
          if (state.chartObserver) {
            state.chartObserver.disconnect();
            state.chartObserver = null;
          }
        }

        function renderChartLoadingState(code, title = "Chart standby", message = "表示領域に入ると読み込みます") {
          const element = document.getElementById(`scanChart-${code}`);
          if (!element) {
            return;
          }
          element.innerHTML = `<div class="chart-inline-error chart-placeholder">${escapeHtml(title)}<br /><span>${escapeHtml(message)}</span></div>`;
        }

        function summarizeOverviewDataQuality(overview) {
          const summary = overview?.dataQualitySummary;
          if (summary && typeof summary === "object") {
            return {
              matchedCount: Number(summary.matchedCount || 0),
              staleCount: Number(summary.staleCount || 0),
              emptyCount: Number(summary.emptyCount || 0),
            };
          }
          const records = Array.isArray(overview?.records) ? overview.records : [];
          let matchedCount = 0;
          let staleCount = 0;
          let emptyCount = 0;
          records.forEach((record) => {
            const quality = summarizeScannerRecordQuality(record, state.selectedDate);
            if (quality.reasonCodes.includes("NO_OHLCV")) {
              emptyCount += 1;
            } else if (quality.isStale) {
              staleCount += 1;
            } else {
              matchedCount += 1;
            }
          });
          return { matchedCount, staleCount, emptyCount };
        }

        function renderDataQualitySummary() {
          if (!dataQualitySummaryBox) {
            return;
          }
          if (isCustomCodeMode()) {
            dataQualitySummaryBox.hidden = false;
            dataQualitySummaryBox.innerHTML = `
              <span class="index-data-quality-chip">コード指定中 <strong>${formatNumber(state.customCodes.length, 0)}</strong></span>
              <span class="index-data-quality-chip">フィルター無効</span>
              ${state.customCodeMissing.length ? `<span class="index-data-quality-chip">未検出 <strong>${formatNumber(state.customCodeMissing.length, 0)}</strong></span>` : ""}
            `;
            return;
          }
          const summary = summarizeOverviewDataQuality(state.overview);
          dataQualitySummaryBox.hidden = false;
          dataQualitySummaryBox.innerHTML = `
            <span class="index-data-quality-chip">最新一致 <strong>${formatNumber(summary.matchedCount, 0)}</strong></span>
            <span class="index-data-quality-chip">遅延 <strong>${formatNumber(summary.staleCount, 0)}</strong></span>
            <span class="index-data-quality-chip">空データ <strong>${formatNumber(summary.emptyCount, 0)}</strong></span>
          `;
        }

        function normalizeCardChartTimeframe(value) {
          const timeframe = String(value || "").trim();
          return INDEX_SCANNER_TIMEFRAMES.includes(timeframe) ? timeframe : state.timeframe;
        }

        function getCardChartTimeframe(code) {
          return normalizeCardChartTimeframe(state.cardChartTimeframes.get(String(code)) || state.timeframe);
        }

        function getCardChartRangeMonths(timeframe) {
          return CARD_CHART_RANGE_MONTHS[normalizeCardChartTimeframe(timeframe)] || CARD_CHART_RANGE_MONTHS.daily;
        }

        function getChartCacheKey(record, timeframe = getCardChartTimeframe(record.code)) {
          return `${isRecentDataMode() ? "recent" : "legacy"}:${timeframe}:${getCardChartRangeMonths(timeframe)}:${state.selectedDate}:${record.code}`;
        }

        function shouldUseFullChartRows(timeframe, rangeMonths) {
          return timeframe === "monthly" || (timeframe === "weekly" && Number(rangeMonths) > 12);
        }

        function updateCardChartTimeframeControls(code, timeframe) {
          list?.querySelectorAll("[data-card-chart-code]").forEach((button) => {
            if (button.getAttribute("data-card-chart-code") !== String(code)) {
              return;
            }
            const isActive = button.getAttribute("data-card-chart-timeframe") === timeframe;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
          });
        }

        function parseOhlcvCsv(text) {
          return String(text || "")
            .trim()
            .split(/\r?\n/)
            .slice(1)
            .map((line) => {
              const [date, open, high, low, close, volume] = line.split(",");
              return {
                date,
                open: Number(open),
                high: Number(high),
                low: Number(low),
                close: Number(close),
                volume: Number(volume),
              };
            })
            .filter((row) => row.date && Number.isFinite(row.close));
        }

        async function loadFullChartRows(code) {
          const cacheKey = `${state.selectedDate}:${code}`;
          const cached = state.fullChartPayloadCache.get(cacheKey);
          if (cached) {
            return cached;
          }
          if (!state.fullChartRequestCache.has(cacheKey)) {
            state.fullChartRequestCache.set(
              cacheKey,
              fetch(`./data/ohlcv/${code}.csv`, { cache: "no-store" })
                .then(async (response) => {
                  if (!response.ok) {
                    throw new Error(`CSV 読み込み失敗: ${code} (${response.status})`);
                  }
                  const rows = parseOhlcvCsv(await response.text());
                  if (!rows.length) {
                    throw new Error(`CSVに価格データがありません: ${code}`);
                  }
                  state.fullChartPayloadCache.set(cacheKey, rows);
                  return rows;
                })
                .finally(() => {
                  state.fullChartRequestCache.delete(cacheKey);
                })
            );
          }
          return state.fullChartRequestCache.get(cacheKey);
        }

        async function ensureScannerCardChart(record, options = {}) {
          const chartTimeframe = getCardChartTimeframe(record.code);
          const chartRangeMonths = getCardChartRangeMonths(chartTimeframe);
          const cacheKey = getChartCacheKey(record, chartTimeframe);
          updateCardChartTimeframeControls(record.code, chartTimeframe);
          if (!options.force && state.chartRenderedCodes.has(cacheKey)) {
            return;
          }
          const chartElementId = `scanChart-${record.code}`;
          const linksElement = document.getElementById(`scanLinks-${record.code}`);
          const chartElement = document.getElementById(chartElementId);
          if (!chartElement || !linksElement) {
            return;
          }

          let inspected = state.chartPayloadCache.get(cacheKey);
          if (!inspected) {
            if (!state.chartRequestCache.has(cacheKey)) {
              state.chartRequestCache.set(
                cacheKey,
                loadTickerForChartWithFallback(record.code, { selectedDate: state.selectedDate })
                  .then((value) => {
                    state.chartPayloadCache.set(cacheKey, value);
                    return value;
                  })
                  .finally(() => {
                    state.chartRequestCache.delete(cacheKey);
                  })
              );
            }
            try {
              inspected = await state.chartRequestCache.get(cacheKey);
            } catch (error) {
              renderChartFailure(chartElementId, "データ取得失敗");
              showError(errorBox, `一部のチャート読込に失敗: ${record.code} / FETCH_FAIL / ${error?.message || error}`);
              return;
            }
          }

          const { payload, chartPayload, validation, shape, requestUrl, status, responseBody } = inspected;
          const reasonCodes = Array.isArray(validation.reasonCodes) ? validation.reasonCodes : [];
          const isNoOhlcv = reasonCodes.includes("NO_OHLCV");
          if (validation.issues.length) {
            console.debug("[ticker-chart:validation]", {
              code: record.code,
              requestUrl,
              status,
              responseBody: responseBody.slice(0, 1200),
              parsedCandleCount: validation.parsedCandleCount,
              issues: validation.issues,
              warnings: validation.warnings,
              reasonCodes,
              shapeDiff: diffShapeAgainstBaseline(state.chartBaselineShape, shape),
            });
            renderChartFailure(chartElementId, "データ取得失敗");
            showError(errorBox, `一部のチャート読込に失敗: ${record.code} / PARSE_FAIL / ${validation.issues.join(", ")}`);
            return;
          }

          if (isNoOhlcv) {
            console.debug("[ticker-chart:no-ohlcv]", { code: record.code, requestUrl, reasonCode: "NO_OHLCV" });
            renderChartStatus(chartElementId, "データなし", "NO_OHLCV", "chart-placeholder");
            linksElement.innerHTML = renderScannerItemLinks(payload, record, state);
            state.chartRenderedCodes.add(cacheKey);
            return;
          }

          if (!state.chartBaselineShape) {
            state.chartBaselineShape = shape;
          }

          let chartRows = (chartPayload || payload).ohlcv;
          if (shouldUseFullChartRows(chartTimeframe, chartRangeMonths)) {
            try {
              chartRows = await loadFullChartRows(record.code);
            } catch (error) {
              console.warn("[scanner-chart:full-range:fallback]", { code: record.code, reason: error?.message || String(error) });
            }
          }

          renderScannerCompactChart(chartElementId, record.code, chartRows, state.selectedDate, chartRangeMonths, {
            timeframe: chartTimeframe,
            useBarCount: false,
            extendToLatest: true,
            events: record.events || record.chartEvents || record.newsEvents || record.disclosureEvents || [],
          });
          linksElement.innerHTML = renderScannerItemLinks(payload, record, state);
          state.chartRenderedCodes.add(cacheKey);
        }

        function observeScannerCharts(records) {
          disconnectChartObserver();
          if (!("IntersectionObserver" in window)) {
            records.slice(0, 8).forEach((record) => {
              void ensureScannerCardChart(record);
            });
            return;
          }
          state.chartObserver = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                  return;
                }
                const code = String(entry.target.getAttribute("data-chart-code") || "");
                const record = records.find((item) => String(item.code) === code);
                if (!record) {
                  state.chartObserver?.unobserve(entry.target);
                  return;
                }
                state.chartObserver?.unobserve(entry.target);
                void ensureScannerCardChart(record);
              });
            },
            {
              root: null,
              rootMargin: "240px 0px 360px",
              threshold: 0.05,
            }
          );

          records.forEach((record, index) => {
            const chartElement = document.getElementById(`scanChart-${record.code}`);
            if (!chartElement) {
              return;
            }
            chartElement.setAttribute("data-chart-code", String(record.code));
            if (index < 4) {
              void ensureScannerCardChart(record);
              return;
            }
            renderChartLoadingState(record.code);
            state.chartObserver.observe(chartElement);
          });
        }

        function bindStrategyPopoverEvents() {
          list?.querySelectorAll("[data-strategy-badge]").forEach((button) => {
            button.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              const badge = event.currentTarget;
              if (!(badge instanceof HTMLElement)) {
                return;
              }
              const card = badge.closest(".scanner-item");
              const popover = card?.querySelector("[data-strategy-popover]");
              const strategyId = badge.dataset.strategyBadge || "";
              const targetPanel = [...(card?.querySelectorAll("[data-strategy-panel]") || [])].find(
                (panel) => panel.getAttribute("data-strategy-panel") === strategyId
              );
              if (!card || !popover || !targetPanel) {
                return;
              }
              const alreadyOpen = badge.classList.contains("is-active") && !popover.hidden;
              closeAllStrategyPopovers();
              if (alreadyOpen) {
                return;
              }
              popover.hidden = false;
              card.querySelectorAll("[data-strategy-panel]").forEach((panel) => {
                panel.hidden = panel !== targetPanel;
              });
              card.querySelectorAll("[data-strategy-badge]").forEach((item) => {
                const isActive = item === badge;
                item.classList.toggle("is-active", isActive);
                item.setAttribute("aria-expanded", isActive ? "true" : "false");
              });
            });
          });
        }

        function bindCardChartTimeframeEvents(records) {
          list?.querySelectorAll("[data-card-chart-timeframe]").forEach((button) => {
            button.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              const code = String(button.getAttribute("data-card-chart-code") || "");
              const timeframe = normalizeCardChartTimeframe(button.getAttribute("data-card-chart-timeframe"));
              const record = records.find((item) => String(item.code) === code);
              if (!code || !record) {
                return;
              }
              state.cardChartTimeframes.set(code, timeframe);
              updateCardChartTimeframeControls(code, timeframe);
              renderChartLoadingState(code, "Chart loading", "表示足を切り替えています");
              void ensureScannerCardChart(record, { force: true });
            });
          });
        }
      
        function triggerHeaderStatusFlash() {
          if (state.headerStatusFlashTimer) {
            window.clearTimeout(state.headerStatusFlashTimer);
          }
          state.headerStatusFlashActive = true;
          updateHeaderStatus();
          state.headerStatusFlashTimer = window.setTimeout(() => {
            state.headerStatusFlashActive = false;
            state.headerStatusFlashTimer = null;
            updateHeaderStatus();
          }, 1200);
        }
      
        async function checkForManifestUpdate() {
          try {
            const latestManifest = await loadManifest();
            if (isManifestNewer(latestManifest, state.manifest)) {
              state.pendingManifest = latestManifest;
              state.hasFreshUpdate = false;
              await refreshIndexScanner(latestManifest);
            } else {
              state.pendingManifest = null;
              state.hasFreshUpdate = false;
            }
            updateHeaderStatus();
          } catch (_error) {
          }
        }
      
        function startManifestPolling() {
          if (stopAutoRefreshPolling) {
            stopAutoRefreshPolling();
          }
          if (state.manifestPollId) {
            clearInterval(state.manifestPollId);
          }
          stopAutoRefreshPolling = startAutoRefreshPolling({
            getCurrentManifest: () => state.manifest,
            onRefresh: async (latestManifest) => {
              if (state.isRefreshing) {
                state.pendingManifest = latestManifest;
                return;
              }
              state.pendingManifest = latestManifest;
              await checkForManifestUpdate();
            },
          });
        }
      
        async function render() {
          errorBox.hidden = true;
          disconnectChartObserver();
          list.innerHTML = '<div class="empty-cell">読み込み中...</div>';
          state.picks = loadScannerPicks();
          state.chartRenderedCodes = new Set();
          state.chartBaselineShape = null;
          updateIndexHeaderActions();
          renderTagOptions();
          renderThemeOptions();
          let filtered = [];
          if (isCustomCodeMode()) {
            const recordsByCode = new Map((state.overview.records || []).map((record) => [String(record.code || "").toUpperCase(), record]));
            state.customCodeMissing = [];
            filtered = state.customCodes
              .map((code) => {
                const record = recordsByCode.get(String(code).toUpperCase());
                if (!record) {
                  state.customCodeMissing.push(code);
                }
                return record;
              })
              .filter(Boolean);
          } else {
            state.customCodeMissing = [];
            const turnoverRecords = filterByTurnover(state.overview.records || [], effectiveTurnoverFilter());
            const priceFilteredRecords = filterByMinimumClose(turnoverRecords, INDEX_SCANNER_MIN_CLOSE);
            const baseFiltered = priceFilteredRecords.filter(
              (record) => (!state.tag || record.industry === state.tag) && (!state.theme || (record.themes || []).includes(state.theme))
            );
            let scannerBase = state.selectedStrategies.length
              ? baseFiltered.filter((record) => state.selectedStrategies.every((strategyId) => (record.strategyMatches || []).includes(strategyId)))
              : baseFiltered;
            if (state.sort === "lower_shadow") {
              scannerBase = scannerBase.filter(isLowerShadowCandidate);
            } else if (state.sort === "stop_high") {
              scannerBase = scannerBase.filter((record) => getStopHighStatus(record) !== "none");
            } else if (state.sort === "new_high_20d") {
              scannerBase = scannerBase.filter((record) => record.newHigh20d === true);
            } else if (state.sort === "bullish_close_breakout_20d") {
              scannerBase = scannerBase.filter((record) => record.bullishCloseBreakout20d === true);
            } else if (isDeviationSort(state.sort)) {
              const deviationFilter = getActiveDeviationFilter(state);
              scannerBase = scannerBase.filter((record) => {
                const deviationValue = getDeviationValueBySort(record, state.sort);
                return deviationValue != null && matchesDeviationFilter(deviationValue, deviationFilter.mode, deviationFilter.min, deviationFilter.max);
              });
            } else if (state.sort === "trend_turn") {
              scannerBase = scannerBase.filter((record) => record.trendTurnCandidate === true);
            } else if (state.sort === "rebound_signal") {
              scannerBase = scannerBase.filter((record) => String(record.signalCategory || "") !== "none");
            } else if (state.sort === "strategy_minervini") {
              scannerBase = scannerBase.filter((record) => (record.strategyMatches || []).includes("minervini_trend_template"));
            } else if (state.sort === "strategy_stage2") {
              scannerBase = scannerBase.filter((record) => (record.strategyMatches || []).includes("stan_weinstein_stage2"));
            } else if (state.sort === "strategy_turtle") {
              scannerBase = scannerBase.filter((record) => (record.strategyMatches || []).includes("turtle_donchian_breakout"));
            } else if (state.sort === "strategy_canslim") {
              scannerBase = scannerBase.filter((record) => (record.strategyMatches || []).includes("can_slim"));
            } else if (state.sort === "strategy_rsi2") {
              scannerBase = scannerBase.filter((record) => (record.strategyMatches || []).includes("rsi2_pullback"));
            }
            filtered = sortScannerRecords(scannerBase, state.sort).slice(0, state.limit);
          }
          state.visibleRecords = filtered;
          syncIndexScannerUrl(
            state.selectedDate,
            isCustomCodeMode() ? DEFAULT_INDEX_SORT : state.sort,
            state.tag,
            state.theme,
            state.turnover,
            state.limit,
            state.rangeMonths,
            state.timeframe,
            state.deviationFilters,
            state.selectedStrategies
          );
          if (stickySortSelect) {
            stickySortSelect.value = strategyControlValue();
          }
          if (sortSelect) {
            sortSelect.value = strategyControlValue();
          }
          if (rankingSelect) {
            rankingSelect.value = rankingControlValue();
          }
          if (stickyLimitSelect) {
            stickyLimitSelect.value = limitControlValue();
          }
          if (stickyTurnoverSelect) {
            stickyTurnoverSelect.value = String(effectiveTurnoverFilter());
          }
          updateStickyTimeframeUI();
          updateRangeChip();
          updateStickyFiltersUi();
          updateHeaderStatus();
          renderDataQualitySummary();
      
          if (!filtered.length) {
            if (selectAllPicksButton) {
              selectAllPicksButton.disabled = true;
            }
            if (stickySelectAllPicksButton) {
              stickySelectAllPicksButton.disabled = true;
            }
            list.innerHTML = isCustomCodeMode()
              ? state.customCodes.length
                ? `<div class="index-custom-code-notice">見つからないコード: ${escapeHtml(state.customCodeMissing.join(", "))}</div><div class="empty-cell">表示できる指定コードがありません。</div>`
                : '<div class="empty-cell">指定コードを入力して「適用」を押してください。</div>'
              : '<div class="empty-cell">該当する銘柄がありません。</div>';
            return;
          }
          if (selectAllPicksButton) {
            selectAllPicksButton.disabled = false;
          }
          if (stickySelectAllPicksButton) {
            stickySelectAllPicksButton.disabled = false;
          }
      
          const missingNotice = isCustomCodeMode() && state.customCodeMissing.length
            ? `<div class="index-custom-code-notice">見つからないコード: ${escapeHtml(state.customCodeMissing.join(", "))}</div>`
            : "";
          list.innerHTML = missingNotice + filtered
            .map((record, index) => renderScannerItem(record, index, state))
            .join("");
      
          filtered.forEach((record) => {
            const checkbox = list.querySelector(`input[data-pick-code="${record.code}"]`);
            if (!checkbox) {
              return;
            }
            checkbox.addEventListener("change", () => {
              toggleScannerPick(record, checkbox.checked, state);
              updateIndexHeaderActions();
            });
          });
          bindStrategyPopoverEvents();
          bindCardChartTimeframeEvents(filtered);
          observeScannerCharts(filtered);
        }

        stickyStrategySelect?.addEventListener("change", () => {
          state.selectedStrategies = stickyStrategySelect.value ? [stickyStrategySelect.value] : [];
          render();
        });
      
        function renderDateControls() {
          updateStickyDateUi();
        }
      
        function updateDeviation200Controls() {
          const activeKey = getActiveDeviationSortKey(state.sort);
          const activeFilter = getActiveDeviationFilter(state);
          const activeDraft = getActiveDeviationDraft(state);
          const hasSettings = Boolean(activeFilter.mode || activeFilter.min || activeFilter.max);
          const activeLabel = getDeviationSortLabel(activeKey);
          if (dev200Button) {
            dev200Button.hidden = !activeKey;
            dev200Button.classList.toggle("is-active", hasSettings);
            dev200Button.textContent = hasSettings ? "Advanced ON" : "Advanced ▼";
            dev200Button.setAttribute("aria-expanded", activeKey && state.dev200PopoverOpen ? "true" : "false");
          }
          if (deviationPopoverTitle) {
            deviationPopoverTitle.textContent = activeLabel || "Deviation";
          }
          if (dev200Popover) {
            const isOpen = Boolean(activeKey) && state.dev200PopoverOpen;
            dev200Popover.hidden = !isOpen;
            dev200Popover.classList.toggle("is-open", isOpen);
          }
          if (dev200ModeSelect) {
            dev200ModeSelect.value = activeFilter.mode || "gte";
          }
          if (dev200MinInput && dev200MinInput.value !== activeFilter.min) {
            dev200MinInput.value = activeFilter.min;
          }
          if (dev200MaxInput && dev200MaxInput.value !== activeFilter.max) {
            dev200MaxInput.value = activeFilter.max;
          }
          const activeMode = normalizeDeviationFilterInputMode(dev200ModeSelect?.value) || activeFilter.mode || "gte";
          if (dev200MinInput) {
            dev200MinInput.disabled = activeMode === "lte";
          }
          if (dev200MaxInput) {
            dev200MaxInput.disabled = activeMode === "gte";
          }
          if (stickyAdvanced) {
            stickyAdvanced.hidden = !activeKey;
          }
          if (stickyDeviationTitle) {
            stickyDeviationTitle.textContent = activeLabel || "Deviation";
          }
          setStickyDeviationControls(activeDraft);
        }
      
        function renderCalendar() {
          const availableDates = getOverviewDatesForTimeframe(state.timeframe);
          const minMonth = startOfMonth(parseDate(availableDates[0] || state.selectedDate));
          const maxMonth = startOfMonth(parseDate(availableDates.at(-1) || state.selectedDate));
          renderMiniCalendar(
            stickyMiniCalendar || miniCalendar,
            state.calendarMonth || startOfMonth(parseDate(state.selectedDate)),
            state.selectedDate,
            availableDates,
            async (nextDate) => {
              state.stickyDateOpen = false;
              updateStickyDateUi();
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
      
  }

  window.KabuPageIndexScanner = Object.freeze({ initIndexScannerPage });
})();
