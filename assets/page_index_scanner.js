(function () {
  async function initIndexScannerPage(deps) {
    with (deps) {
        const {
          formatSnapshotGeneratedAtParts,
          isManifestNewer,
          resolveHeaderStatusState,
        } = window.KabuPageIndexScannerStatus;
        const sortSelect = document.getElementById("indexSort");
        const strategyDropdown = document.getElementById("indexStrategyDropdown");
        const strategyDropdownButton = document.getElementById("indexStrategyDropdownButton");
        const strategyDropdownMenu = document.getElementById("indexStrategyDropdownMenu");
        const rankingDropdown = document.getElementById("indexRankingDropdown");
        const rankingDropdownButton = document.getElementById("indexRankingDropdownButton");
        const rankingDropdownMenu = document.getElementById("indexRankingDropdownMenu");
        const limitDropdown = document.getElementById("indexLimitDropdown");
        const limitDropdownButton = document.getElementById("indexLimitDropdownButton");
        const limitDropdownMenu = document.getElementById("indexLimitDropdownMenu");
        const turnoverDropdown = document.getElementById("indexTurnoverDropdown");
        const turnoverDropdownButton = document.getElementById("indexTurnoverDropdownButton");
        const turnoverDropdownMenu = document.getElementById("indexTurnoverDropdownMenu");
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
        const rankingLabel = document.getElementById("indexRankingLabel");
        const timeframeGroup = document.getElementById("indexTimeframe");
        const timeframePopover = document.getElementById("indexTimeframePopover");
        const timeframePopoverTitle = document.getElementById("indexTimeframePopoverTitle");
        const timeframeOptions = document.getElementById("indexTimeframeOptions");
        const rangeChip = document.getElementById("indexRangeChip");
        const pickedLink = document.getElementById("indexPickedLink");
        const picksMenuButton = document.getElementById("indexPicksMenuButton");
        const picksMenu = document.getElementById("indexPicksMenu");
        const picksMenuToggle = picksMenuButton || pickedLink;
        const updatedStatus = document.getElementById("indexUpdatedStatus");
        const resultCount = document.getElementById("indexResultCount");
        const refreshButton = document.getElementById("indexRefreshButton");
        const addCodesButton = document.getElementById("indexAddCodesButton");
        const exportTradingViewButton = document.getElementById("indexExportTradingViewButton");
        const exportHyperButton = document.getElementById("indexExportHyperButton");
        const viewListButton = document.getElementById("indexViewListButton");
        const saveListButton = document.getElementById("indexSaveListButton");
        const openListButton = document.getElementById("indexOpenListButton");
        const exitListButton = document.getElementById("indexExitListButton");
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
        const listSaveModal = document.getElementById("indexListSaveModal");
        const listSaveInput = document.getElementById("indexListSaveInput");
        const listSaveError = document.getElementById("indexListSaveError");
        const listSaveOkButton = document.getElementById("indexListSaveOk");
        const listSaveCancelButton = document.getElementById("indexListSaveCancel");
        const listSetsModal = document.getElementById("indexListSetsModal");
        const listSetsBody = document.getElementById("indexListSetsBody");
        const listSetsCloseButton = document.getElementById("indexListSetsClose");
        const miniCalendar = document.getElementById("indexMiniCalendar") || stickyMiniCalendar;
        const errorBox = document.getElementById("indexError");
        const dataQualitySummaryBox = document.getElementById("indexDataQualitySummary");
        const list = document.getElementById("indexList");
      
        const state = {
          manifest: null,
          updateHealth: null,
          ohlcvQualitySummary: null,
          overviewDateIndex: null,
          overview: null,
          sort: "gainers",
          tag: "",
          theme: "",
          turnover: 1000000000,
          limit: 200,
          timeframe: "daily",
          rangeMonths: 3,
          highPullbackDropPct: 30,
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
          activeListName: "",
          activeListCodes: [],
          activeListMissing: [],
          activeListViewing: false,
          chartObserver: null,
          chartPayloadCache: new Map(),
          chartRequestCache: new Map(),
          highPullbackRecentPayloadCache: new Map(),
          highPullbackRecentRequestCache: new Map(),
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
        const DAILY_ONLY_SORT_KEYS = new Set(["strategy_high_pullback_30", "strategy_strong_trend_pullback_rebound"]);
        const HIGH_PULLBACK_STRATEGY_ID = "high_pullback_30";
        const STRONG_TREND_PULLBACK_STRATEGY_ID = "strong_trend_pullback_rebound";
        const HIGH_PULLBACK_MIN_BARS = 200;
        const HIGH_PULLBACK_LOOKAHEAD_BARS = 10;
        const HIGH_PULLBACK_RECENT_ACHIEVEMENT_BARS = 5;
        const HIGH_PULLBACK_FILTER_CONCURRENCY = 24;
        const DEFAULT_HIGH_PULLBACK_DROP_PCT = 30;
        const STRONG_TREND_PULLBACK_LOOKBACK_BARS = 60;
        const STRONG_TREND_PULLBACK_MIN_RISE_PCT = 30;
        const STRONG_TREND_PULLBACK_MIN_DROP_PCT = 15;
        const STRONG_TREND_PULLBACK_DEEP_DROP_PCT = 30;
        const STRONG_TREND_PULLBACK_MAX_DROP_PCT = 45;
        const STRONG_TREND_PULLBACK_FILTER_CONCURRENCY = 24;

        function isDailyOnlySort(sortKey = state.sort) {
          return DAILY_ONLY_SORT_KEYS.has(sortKey);
        }

        function enforceDailyOnlySortTimeframe() {
          if (!isDailyOnlySort()) {
            return false;
          }
          if (state.timeframe === "daily") {
            return false;
          }
          state.timeframe = "daily";
          state.rangeMonths = normalizeIndexScannerRangeMonths("daily", state.rangeMonthsByTimeframe.daily, 3);
          state.rangeMonthsByTimeframe.daily = state.rangeMonths;
          state.timeframePopoverOpen = false;
          state.timeframePopoverTarget = "";
          return true;
        }

        function normalizeHighPullbackDropPct(value) {
          return DEFAULT_HIGH_PULLBACK_DROP_PCT;
        }

        function highPullbackDropPct() {
          return normalizeHighPullbackDropPct(state.highPullbackDropPct);
        }

        function syncCurrentIndexScannerUrl() {
          if (!state.selectedDate) {
            return;
          }
          syncIndexScannerUrl(
            state.selectedDate,
            isCustomCodeMode() || isListMode() ? DEFAULT_INDEX_SORT : state.sort,
            state.tag,
            state.theme,
            effectiveTurnoverFilter(),
            state.limit,
            state.rangeMonths,
            state.timeframe,
            state.deviationFilters,
            state.selectedStrategies,
            isDailyOnlySort() ? highPullbackDropPct() : ""
          );
        }

        function normalizeOverviewDateList(values) {
          return [...new Set((Array.isArray(values) ? values : [])
            .map((value) => String(value || "").trim())
            .filter(Boolean))]
            .sort();
        }

        function compactOverviewDatesByPeriod(dates, timeframe) {
          if (timeframe === "daily") {
            return dates;
          }
          const latestByPeriod = new Map();
          dates.forEach((dateValue) => {
            latestByPeriod.set(overviewDatePeriodKey(dateValue, timeframe), dateValue);
          });
          return [...latestByPeriod.values()].sort();
        }

        function getOverviewDatesForTimeframe(timeframe = state.timeframe) {
          const key = timeframe === "weekly" ? "weekly" : timeframe === "monthly" ? "monthly" : "daily";
          const indexedDates = normalizeOverviewDateList(state.overviewDateIndex?.[key]);
          if (indexedDates.length) {
            return compactOverviewDatesByPeriod(indexedDates, key);
          }
          return compactOverviewDatesByPeriod(normalizeOverviewDateList(state.manifest?.availableDates || []), key);
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

        function findHighPullback30Match(rows, selectedDate) {
          const eligibleRows = (Array.isArray(rows) ? rows : [])
            .filter((row) => row?.date && (!selectedDate || row.date <= selectedDate))
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
          if (eligibleRows.length < HIGH_PULLBACK_MIN_BARS) {
            return null;
          }
          const windowRows = eligibleRows.slice(-HIGH_PULLBACK_MIN_BARS);
          let highIndex = -1;
          let highest = -Infinity;
          windowRows.forEach((row, index) => {
            const high = Number(row.high);
            if (Number.isFinite(high) && high >= highest) {
              highest = high;
              highIndex = index;
            }
          });
          if (!(highest > 0) || highIndex < 0) {
            return null;
          }
          const afterRows = windowRows.slice(highIndex + 1, highIndex + 1 + HIGH_PULLBACK_LOOKAHEAD_BARS);
          if (!afterRows.length) {
            return null;
          }
          let lowIndex = -1;
          let afterLow = Infinity;
          afterRows.forEach((row, index) => {
            const low = Number(row.low);
            if (Number.isFinite(low) && low < afterLow) {
              afterLow = low;
              lowIndex = index;
            }
          });
          if (!Number.isFinite(afterLow) || lowIndex < 0) {
            return null;
          }
          const barsToLow = lowIndex + 1;
          const dropRate = ((highest - afterLow) / highest) * 100;
          if (dropRate < highPullbackDropPct()) {
            return null;
          }
          const windowStartIndex = eligibleRows.length - windowRows.length;
          const lowWindowIndex = highIndex + 1 + lowIndex;
          const lowEligibleIndex = windowStartIndex + lowWindowIndex;
          const barsSinceLow = eligibleRows.length - 1 - lowEligibleIndex;
          if (barsSinceLow >= HIGH_PULLBACK_RECENT_ACHIEVEMENT_BARS) {
            return null;
          }
          const currentClose = Number(eligibleRows[eligibleRows.length - 1]?.close);
          return {
            highest200: roundNumber(highest, 4),
            highDate: windowRows[highIndex].date,
            afterLow: roundNumber(afterLow, 4),
            afterLowDate: afterRows[lowIndex].date,
            barsToLow,
            barsSinceLow,
            dropRate: roundNumber(dropRate, 4),
            currentClose: Number.isFinite(currentClose) ? roundNumber(currentClose, 4) : null,
            currentDrawdownPct: Number.isFinite(currentClose) ? roundNumber(((highest - currentClose) / highest) * 100, 4) : null,
          };
        }

        function hasHighPullbackLookbackRows(rows, selectedDate) {
          return (Array.isArray(rows) ? rows : []).filter((row) => row?.date && (!selectedDate || row.date <= selectedDate)).length >= HIGH_PULLBACK_MIN_BARS;
        }

        function finiteNumber(value) {
          const number = Number(value);
          return Number.isFinite(number) ? number : null;
        }

        function distancePctFromBaseline(value, baseline) {
          const current = finiteNumber(value);
          const base = finiteNumber(baseline);
          if (current == null || !(base > 0)) {
            return null;
          }
          return ((current - base) / base) * 100;
        }

        function averageRows(rows, getter) {
          const values = (Array.isArray(rows) ? rows : [])
            .map(getter)
            .map(finiteNumber)
            .filter((value) => value != null);
          return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
        }

        function lowerWickRatio(row) {
          const open = finiteNumber(row?.open);
          const high = finiteNumber(row?.high);
          const low = finiteNumber(row?.low);
          const close = finiteNumber(row?.close);
          if (open == null || high == null || low == null || close == null || high <= low) {
            return null;
          }
          return (Math.min(open, close) - low) / (high - low);
        }

        function enrichStrongTrendRows(rows) {
          const sourceRows = (Array.isArray(rows) ? rows : [])
            .filter((row) => row?.date && Number.isFinite(Number(row.close)))
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
          const windows = [5, 25, 75];
          return sourceRows.map((row, index) => {
            const enriched = { ...row };
            windows.forEach((windowSize) => {
              const key = `ma${windowSize}`;
              if (finiteNumber(enriched[key]) != null) {
                return;
              }
              if (index + 1 < windowSize) {
                enriched[key] = null;
                return;
              }
              const values = sourceRows.slice(index + 1 - windowSize, index + 1).map((item) => finiteNumber(item.close));
              enriched[key] = values.every((value) => value != null)
                ? roundNumber(values.reduce((total, value) => total + value, 0) / windowSize, 4)
                : null;
            });
            return enriched;
          });
        }

        function findStrongTrendPullbackReboundMatch(rows, selectedDate) {
          const eligibleRows = enrichStrongTrendRows(rows)
            .filter((row) => row?.date && (!selectedDate || row.date <= selectedDate))
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
          if (eligibleRows.length < STRONG_TREND_PULLBACK_LOOKBACK_BARS + 10) {
            return null;
          }
          const current = eligibleRows[eligibleRows.length - 1];
          const currentClose = finiteNumber(current.close);
          const currentMa5 = finiteNumber(current.ma5);
          const currentMa25 = finiteNumber(current.ma25);
          const currentMa75 = finiteNumber(current.ma75);
          if (currentClose == null || currentMa5 == null || currentMa75 == null || currentClose < currentMa5) {
            return null;
          }

          const trendWindow = eligibleRows.slice(-STRONG_TREND_PULLBACK_LOOKBACK_BARS);
          let lowIndex = -1;
          let low = Infinity;
          let highIndex = -1;
          let high = -Infinity;
          let risePct = -Infinity;
          trendWindow.forEach((row, index) => {
            const rowLow = finiteNumber(row.low);
            if (rowLow != null && rowLow < low) {
              low = rowLow;
              lowIndex = index;
            }
            const rowHigh = finiteNumber(row.high);
            if (rowHigh != null && lowIndex >= 0 && index >= lowIndex) {
              const candidateRisePct = ((rowHigh - low) / low) * 100;
              if (candidateRisePct > risePct) {
                risePct = candidateRisePct;
                high = rowHigh;
                highIndex = index;
              }
            }
          });
          if (!(low > 0) || !(high > 0) || highIndex <= lowIndex || risePct < STRONG_TREND_PULLBACK_MIN_RISE_PCT) {
            return null;
          }

          const pullbackRows = trendWindow.slice(highIndex + 1);
          if (!pullbackRows.length) {
            return null;
          }
          const currentDrawdownPct = ((high - currentClose) / high) * 100;
          if (
            currentDrawdownPct < STRONG_TREND_PULLBACK_MIN_DROP_PCT ||
            currentDrawdownPct > STRONG_TREND_PULLBACK_MAX_DROP_PCT
          ) {
            return null;
          }

          const oldMa75 = finiteNumber(eligibleRows[Math.max(0, eligibleRows.length - 21)]?.ma75);
          const ma75SlopePct = oldMa75 && currentMa75 ? ((currentMa75 - oldMa75) / oldMa75) * 100 : null;
          if (ma75SlopePct != null && ma75SlopePct < -3) {
            return null;
          }
          const distanceToMa75 = distancePctFromBaseline(currentClose, currentMa75);
          if (distanceToMa75 != null && distanceToMa75 < -8) {
            return null;
          }

          const pullbackTouchesMa25 = pullbackRows.some((row) => {
            const ma25 = finiteNumber(row.ma25);
            if (!ma25) return false;
            const lowDistance = Math.abs(distancePctFromBaseline(row.low, ma25) ?? Infinity);
            const closeDistance = Math.abs(distancePctFromBaseline(row.close, ma25) ?? Infinity);
            return Math.min(lowDistance, closeDistance) <= 3;
          });
          const pullbackTouchesMa75 = pullbackRows.some((row) => {
            const ma75 = finiteNumber(row.ma75);
            if (!ma75) return false;
            const lowDistance = Math.abs(distancePctFromBaseline(row.low, ma75) ?? Infinity);
            const closeDistance = Math.abs(distancePctFromBaseline(row.close, ma75) ?? Infinity);
            return Math.min(lowDistance, closeDistance) <= 5;
          });
          if (!pullbackTouchesMa25 && !pullbackTouchesMa75) {
            return null;
          }

          const previous = eligibleRows[eligibleRows.length - 2] || null;
          const ma5SlopeUp = currentMa5 != null && finiteNumber(previous?.ma5) != null ? currentMa5 >= finiteNumber(previous.ma5) : false;
          const recent5 = eligibleRows.slice(-6, -1);
          const recent10 = eligibleRows.slice(-11, -1);
          const recent5High = Math.max(...recent5.map((row) => finiteNumber(row.high) ?? -Infinity));
          const recent10High = Math.max(...recent10.map((row) => finiteNumber(row.high) ?? -Infinity));
          const closeBreaks5High = Number.isFinite(recent5High) && currentClose > recent5High;
          const closeBreaks10High = Number.isFinite(recent10High) && currentClose > recent10High;
          const volume20 = averageRows(eligibleRows.slice(-21, -1), (row) => row.volume);
          const currentVolume = finiteNumber(current.volume);
          const volumeRatio20 = volume20 && currentVolume != null ? currentVolume / volume20 : null;
          const riseSegment = trendWindow.slice(lowIndex, highIndex + 1);
          const riseAboveMa25Ratio = riseSegment.length
            ? riseSegment.filter((row) => finiteNumber(row.close) != null && finiteNumber(row.ma25) != null && Number(row.close) > Number(row.ma25)).length / riseSegment.length
            : 0;
          const pullbackVolume = averageRows(pullbackRows.slice(-10), (row) => row.volume);
          const riseVolume = averageRows(riseSegment.slice(-10), (row) => row.volume);
          const volumeCooled = pullbackVolume != null && riseVolume != null ? pullbackVolume <= riseVolume * 0.9 : false;
          const maxLowerWick = Math.max(...pullbackRows.slice(-10).map((row) => lowerWickRatio(row) ?? 0));
          const hasLowerWick = maxLowerWick >= 0.35;

          const pullbackType =
            currentDrawdownPct >= STRONG_TREND_PULLBACK_DEEP_DROP_PCT ? "deep_reset_pullback" : "normal_pullback";
          const reboundLabel =
            pullbackType === "deep_reset_pullback"
              ? "deep_reset_rebound"
              : pullbackTouchesMa25 && currentClose >= (currentMa25 ?? Infinity)
                ? "ma25_rebound"
                : "ma75_rebound";

          let score = 0;
          score += Math.min(15, Math.max(0, ((risePct - 30) / 50) * 15 + 6));
          if (currentDrawdownPct < 18) score += 14;
          else if (currentDrawdownPct < 25) score += 20;
          else if (currentDrawdownPct < 30) score += 16;
          else if (currentDrawdownPct < 35) score += 12;
          else score += 8;
          if (pullbackTouchesMa25) score += 10;
          if (pullbackTouchesMa75) score += 10;
          if (currentClose >= currentMa5) score += 5;
          if (currentMa25 != null && currentClose >= currentMa25) score += 6;
          if (currentClose >= currentMa75) score += 4;
          if (ma5SlopeUp) score += 4;
          if (closeBreaks5High) score += 5;
          if (closeBreaks10High) score += 4;
          if (volumeRatio20 != null && volumeRatio20 >= 1.2) score += 8;
          else if (volumeRatio20 != null && volumeRatio20 >= 1) score += 5;
          if (volumeCooled) score += 4;
          if (hasLowerWick) score += 4;
          score += Math.min(10, riseAboveMa25Ratio * 10);
          if (ma75SlopePct == null || ma75SlopePct >= 0) score += 5;
          else score += 2;
          if (pullbackType === "deep_reset_pullback") {
            score = Math.min(score, 82);
          }
          if (score < (pullbackType === "deep_reset_pullback" ? 48 : 55)) {
            return null;
          }

          return {
            score: roundNumber(Math.min(100, score), 4),
            pullbackType,
            reboundLabel,
            risePct: roundNumber(risePct, 4),
            dropPct: roundNumber(currentDrawdownPct, 4),
            lowDate: trendWindow[lowIndex]?.date || null,
            highDate: trendWindow[highIndex]?.date || null,
            high: roundNumber(high, 4),
            low: roundNumber(low, 4),
            distanceToMa25: currentMa25 ? roundNumber(distancePctFromBaseline(currentClose, currentMa25), 4) : null,
            distanceToMa75: currentMa75 ? roundNumber(distancePctFromBaseline(currentClose, currentMa75), 4) : null,
            ma75SlopePct: ma75SlopePct == null ? null : roundNumber(ma75SlopePct, 4),
            volumeRatio20: volumeRatio20 == null ? null : roundNumber(volumeRatio20, 4),
            riseAboveMa25Ratio: roundNumber(riseAboveMa25Ratio, 4),
            touchedMa25: pullbackTouchesMa25,
            touchedMa75: pullbackTouchesMa75,
            closeBreaks5High,
            closeBreaks10High,
          };
        }

        function isStrongTrendPullbackReboundPrefilterCandidate(record) {
          const close = finiteNumber(record?.close);
          const ma5 = finiteNumber(record?.ma5);
          const ma75 = finiteNumber(record?.ma75);
          if (close == null) {
            return true;
          }
          if (ma5 != null && close < ma5) {
            return false;
          }
          const distanceToMa75 = finiteNumber(record?.distanceToMa75) ?? distancePctFromBaseline(close, ma75);
          if (distanceToMa75 != null && distanceToMa75 < -8) {
            return false;
          }
          const high52w = finiteNumber(record?.high52w);
          if (high52w != null && high52w > 0) {
            const drawdownFrom52wHigh = ((high52w - close) / high52w) * 100;
            if (drawdownFrom52wHigh < STRONG_TREND_PULLBACK_MIN_DROP_PCT) {
              return false;
            }
          }
          return true;
        }

        function attachStrongTrendPullbackReboundMatch(record, metrics) {
          const strategyMatches = [...new Set([...(record.strategyMatches || []), STRONG_TREND_PULLBACK_STRATEGY_ID])];
          const strategyScores = { ...(record.strategyScores || {}), [STRONG_TREND_PULLBACK_STRATEGY_ID]: metrics.score };
          const strategyMetrics = { ...(record.strategyMetrics || {}), [STRONG_TREND_PULLBACK_STRATEGY_ID]: metrics };
          const typeLabel = metrics.pullbackType === "deep_reset_pullback" ? "深押しリセット" : "通常押し目";
          const strategyReasons = {
            ...(record.strategyReasons || {}),
            [STRONG_TREND_PULLBACK_STRATEGY_ID]: [
              `${typeLabel} / 上昇 +${formatNumber(metrics.risePct, 1)}%`,
              `高値から -${formatNumber(metrics.dropPct, 1)}% / Score ${formatNumber(metrics.score, 0)}`,
            ],
          };
          return {
            ...record,
            strategyMatches,
            strategyScores,
            strategyMetrics,
            strategyReasons,
            strongTrendPullbackReboundCandidate: true,
            strongTrendPullbackReboundScore: metrics.score,
            strongTrendPullbackReboundType: metrics.pullbackType,
            strongTrendPullbackReboundLabel: metrics.reboundLabel,
            strongTrendPullbackReboundRisePct: metrics.risePct,
            strongTrendPullbackReboundDropPct: metrics.dropPct,
            strongTrendPullbackReboundVolumeRatio20: metrics.volumeRatio20,
          };
        }

        function strongTrendPullbackReboundMetricsFromRecord(record) {
          const metrics = record?.strategyMetrics?.[STRONG_TREND_PULLBACK_STRATEGY_ID] || record?.strongTrendPullbackRebound || {};
          const score = finiteNumber(record?.strongTrendPullbackReboundScore) ?? finiteNumber(record?.strategyScores?.[STRONG_TREND_PULLBACK_STRATEGY_ID]) ?? finiteNumber(metrics.score);
          if (score == null) {
            return null;
          }
          return {
            ...metrics,
            score,
            pullbackType: record?.strongTrendPullbackReboundType || metrics.pullbackType,
            reboundLabel: record?.strongTrendPullbackReboundLabel || metrics.reboundLabel,
            risePct: finiteNumber(record?.strongTrendPullbackReboundRisePct) ?? finiteNumber(metrics.risePct),
            dropPct: finiteNumber(record?.strongTrendPullbackReboundDropPct) ?? finiteNumber(metrics.dropPct),
            volumeRatio20: finiteNumber(record?.strongTrendPullbackReboundVolumeRatio20) ?? finiteNumber(metrics.volumeRatio20),
          };
        }

        async function filterStrongTrendPullbackReboundRecords(records) {
          const out = [];
          await mapWithConcurrency(records, STRONG_TREND_PULLBACK_FILTER_CONCURRENCY, async (record) => {
            const savedStrongTrendPullbackMatch =
              record.strongTrendPullbackReboundCandidate === true ||
              (record.strategyMatches || []).includes(STRONG_TREND_PULLBACK_STRATEGY_ID);
            if (savedStrongTrendPullbackMatch) {
              const metrics = strongTrendPullbackReboundMetricsFromRecord(record);
              if (metrics) {
                out.push(attachStrongTrendPullbackReboundMatch(record, metrics));
                return;
              }
            }
            try {
              let rows = await loadHighPullbackRecentRows(record.code);
              let metrics = findStrongTrendPullbackReboundMatch(rows, state.selectedDate);
              if (!metrics) {
                const rowsBeforeSelectedDate = (Array.isArray(rows) ? rows : []).filter((row) => row?.date && (!state.selectedDate || row.date <= state.selectedDate));
                if (rowsBeforeSelectedDate.length < STRONG_TREND_PULLBACK_LOOKBACK_BARS + 10) {
                  rows = await loadFullChartRows(record.code);
                  metrics = findStrongTrendPullbackReboundMatch(rows, state.selectedDate);
                }
              }
              if (metrics) {
                out.push(attachStrongTrendPullbackReboundMatch(record, metrics));
              }
            } catch (error) {
              console.debug("[strong-trend-pullback-rebound:skip]", { code: record.code, reason: error?.message || String(error) });
            }
          });
          return out;
        }

        function attachHighPullback30Match(record, metrics) {
          const strategyMatches = [...new Set([...(record.strategyMatches || []), HIGH_PULLBACK_STRATEGY_ID])];
          const strategyScores = { ...(record.strategyScores || {}), [HIGH_PULLBACK_STRATEGY_ID]: metrics.dropRate };
          const strategyMetrics = { ...(record.strategyMetrics || {}), [HIGH_PULLBACK_STRATEGY_ID]: metrics };
          const highLabel = metrics.highDate ? ` (${metrics.highDate})` : "";
          const lowLabel = metrics.afterLowDate ? ` (${metrics.afterLowDate})` : "";
          const barsLabel = metrics.barsToLow != null ? `${metrics.barsToLow}本後に ` : "";
          const strategyReasons = {
            ...(record.strategyReasons || {}),
            [HIGH_PULLBACK_STRATEGY_ID]: [
              `高値 ${formatNumber(metrics.highest200, 0)}${highLabel}`,
              `${barsLabel}安値 ${formatNumber(metrics.afterLow, 0)}${lowLabel} / -${formatNumber(metrics.dropRate, 1)}%`,
            ],
          };
          return {
            ...record,
            strategyMatches,
            strategyScores,
            strategyMetrics,
            strategyReasons,
            highPullback30Candidate: true,
            highPullback30DropRate: metrics.dropRate,
            highPullback30DropDistance: Math.abs(Number(metrics.dropRate) - highPullbackDropPct()),
            highPullback30SortBand:
              metrics.currentDrawdownPct != null &&
              metrics.currentDrawdownPct >= highPullbackDropPct() - 5 &&
              metrics.currentDrawdownPct <= highPullbackDropPct() + 10
                ? 0
                : 1,
            highPullback30CurrentDrawdownPct: metrics.currentDrawdownPct,
            highPullback30Highest200: metrics.highest200,
            highPullback30AfterLow: metrics.afterLow,
            highPullback30HighDate: metrics.highDate,
            highPullback30LowDate: metrics.afterLowDate,
            highPullback30BarsToLow: metrics.barsToLow,
          };
        }

        function highPullbackMetricsFromRecord(record) {
          const metrics = record?.strategyMetrics?.[HIGH_PULLBACK_STRATEGY_ID] || record?.highPullback30 || {};
          const dropRate = record?.highPullback30DropRate ?? metrics.dropRate;
          if (!Number.isFinite(Number(dropRate))) {
            return null;
          }
          return {
            ...metrics,
            highest200: record?.highPullback30Highest200 ?? metrics.highest200,
            highDate: record?.highPullback30HighDate ?? metrics.highDate,
            afterLow: record?.highPullback30AfterLow ?? metrics.afterLow,
            afterLowDate: record?.highPullback30LowDate ?? metrics.afterLowDate,
            barsToLow: record?.highPullback30BarsToLow ?? metrics.barsToLow,
            barsSinceLow: metrics.barsSinceLow,
            dropRate: Number(dropRate),
            currentClose: metrics.currentClose,
            currentDrawdownPct: record?.highPullback30CurrentDrawdownPct ?? metrics.currentDrawdownPct,
          };
        }

        async function filterHighPullback30Records(records) {
          const out = [];
          await mapWithConcurrency(records, HIGH_PULLBACK_FILTER_CONCURRENCY, async (record) => {
            const savedHighPullbackMatch =
              record.highPullback30Candidate === true || (record.strategyMatches || []).includes(HIGH_PULLBACK_STRATEGY_ID);
            if (savedHighPullbackMatch) {
              const metrics = highPullbackMetricsFromRecord(record);
              if (metrics) {
                out.push(attachHighPullback30Match(record, metrics));
                return;
              }
            }
            const high52w = Number(record.high52w);
            const low52w = Number(record.low52w);
            const rangeDrop = high52w > 0 && Number.isFinite(low52w) ? ((high52w - low52w) / high52w) * 100 : NaN;
            if (!Number.isFinite(rangeDrop) || rangeDrop < highPullbackDropPct()) {
              return;
            }
            try {
              let metrics = null;
              let recentRows = null;
              try {
                recentRows = await loadHighPullbackRecentRows(record.code);
                metrics = findHighPullback30Match(recentRows, state.selectedDate);
              } catch (_recentError) {
                metrics = null;
              }
              if (!metrics && !hasHighPullbackLookbackRows(recentRows, state.selectedDate)) {
                metrics = findHighPullback30Match(await loadFullChartRows(record.code), state.selectedDate);
              }
              if (metrics) {
                out.push(attachHighPullback30Match(record, metrics));
              }
            } catch (error) {
              console.debug("[high-pullback-30:skip]", { code: record.code, reason: error?.message || String(error) });
            }
          });
          return out;
        }

        function strategyControlValue() {
          return strategySortKeys.has(state.sort) && state.sort !== DEFAULT_INDEX_SORT ? state.sort : "";
        }

        function rankingControlValue() {
          if (isDailyOnlySort()) {
            return "";
          }
          return rankingSortKeys.has(state.sort) ? state.sort : "";
        }

        function isStrategySortActive() {
          return strategySortKeys.has(state.sort) && state.sort !== DEFAULT_INDEX_SORT;
        }

        function isRankingSortActive() {
          return rankingSortKeys.has(state.sort) || state.sort === DEFAULT_INDEX_SORT;
        }

        function isCustomCodeMode() {
          return state.sort === CUSTOM_CODE_SORT;
        }

        function isListMode() {
          return state.activeListViewing === true;
        }

        function limitControlValue() {
          return String(state.limit);
        }

        function effectiveTurnoverFilter() {
          if (isDailyOnlySort()) {
            return 0;
          }
          return !isCustomCodeMode() && !isListMode() && state.timeframe === "daily" ? state.turnover : 0;
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
          customCodeMeta.textContent = `${codes.length}件${codes.length ? " / 既存Listと重複するコードは1件に統合" : ""}`;
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
          syncHeaderDropdownsUi();
        }

        function openListSaveModal() {
          if (!listSaveModal || !listSaveInput || !listSaveError) {
            return;
          }
          listSaveInput.value = "";
          listSaveError.hidden = true;
          listSaveError.textContent = "";
          listSaveModal.hidden = false;
          listSaveModal.classList.remove("is-hidden");
          window.setTimeout(() => listSaveInput.focus(), 0);
        }

        function closeListSaveModal() {
          if (!listSaveModal) {
            return;
          }
          listSaveModal.hidden = true;
          listSaveModal.classList.add("is-hidden");
        }

        function openListSetsModal() {
          if (!listSetsModal) {
            return;
          }
          renderSavedListSets();
          listSetsModal.hidden = false;
          listSetsModal.classList.add("is-open");
        }

        function closeListSetsModal() {
          if (!listSetsModal) {
            return;
          }
          listSetsModal.hidden = true;
          listSetsModal.classList.remove("is-open");
        }

        function currentListPicks() {
          const picks = loadScannerPicks();
          const values = sortedScannerPicks(picks);
          if (!isListMode()) {
            return dedupeScannerPicks(values);
          }
          const byCode = new Map(values.map((pick) => [String(pick.code || "").trim().toUpperCase(), pick]));
          return state.activeListCodes
            .map((code) => byCode.get(String(code).toUpperCase()) || { code })
            .filter((pick) => String(pick.code || "").trim());
        }

        function setActiveListFromPicks(picks, name = "List") {
          const normalized = dedupeScannerPicks(Array.isArray(picks) ? picks : []);
          const next = {};
          normalized.forEach((pick) => {
            const code = String(pick.code || "").trim().toUpperCase();
            if (!code) {
              return;
            }
            next[code] = { ...pick, code };
          });
          saveScannerPicks(next);
          state.picks = next;
          state.activeListCodes = Object.keys(next);
          state.activeListName = name;
          state.activeListViewing = true;
        }

        function viewCurrentPickList() {
          const picks = loadScannerPicks();
          const normalized = dedupeScannerPicks(sortedScannerPicks(picks));
          state.picks = picks;
          state.activeListCodes = normalized.map((pick) => String(pick.code || "").trim().toUpperCase()).filter(Boolean);
          state.activeListMissing = [];
          state.activeListName = "現在のList";
          state.activeListViewing = true;
        }

        function exitListMode() {
          state.activeListCodes = [];
          state.activeListMissing = [];
          state.activeListName = "";
          state.activeListViewing = false;
          state.customCodes = [];
          state.customCodeMissing = [];
          state.customCodeText = "";
          if (isCustomCodeMode()) {
            exitCustomCodeMode();
          }
        }

        function buildManualPick(code, record = null) {
          if (record) {
            return buildScannerPickPayload(record, state);
          }
          const filterSnapshot = buildFilterSnapshotFromState(state);
          return {
            code: String(code || "").trim().toUpperCase(),
            name: "",
            market: "",
            selectedAt: new Date().toISOString(),
            filterSnapshot,
            filterSummary: "手入力コード",
          };
        }

        function addCodesToList(codes) {
          const normalized = normalizeCustomCodeInput(codes);
          if (!normalized.length) {
            return;
          }
          const recordsByCode = new Map((state.overview?.records || []).map((record) => [String(record.code || "").toUpperCase(), record]));
          const next = { ...(loadScannerPicks() || {}) };
          normalized.forEach((code) => {
            next[code] = buildManualPick(code, recordsByCode.get(code));
          });
          saveScannerPicks(next);
          state.picks = next;
          state.activeListCodes = Object.keys(next);
          state.activeListName = "手入力List";
          state.customCodes = normalized;
          state.customCodeText = formatCustomCodeText(normalized);
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

        function strategyDropdownLabel() {
          if (!sortSelect) {
            return "ストラテジー";
          }
          const selected = sortSelect.options[sortSelect.selectedIndex];
          return selected?.textContent?.trim() || "ストラテジー";
        }

        function customDropdowns() {
          return [
            { root: strategyDropdown, select: sortSelect, button: strategyDropdownButton, menu: strategyDropdownMenu, fallback: "ストラテジー", optionAttribute: "data-strategy-dropdown-value" },
            { root: rankingDropdown, select: rankingSelect, button: rankingDropdownButton, menu: rankingDropdownMenu, fallback: "ランキング", optionAttribute: "data-ranking-dropdown-value" },
            { root: limitDropdown, select: limitSelect, button: limitDropdownButton, menu: limitDropdownMenu, fallback: "表示件数", optionAttribute: "data-limit-dropdown-value" },
            { root: turnoverDropdown, select: turnoverSelect, button: turnoverDropdownButton, menu: turnoverDropdownMenu, fallback: "売買代金", optionAttribute: "data-turnover-dropdown-value" },
          ];
        }

        function customDropdownLabel(control) {
          const selected = control.select?.options?.[control.select.selectedIndex];
          return selected?.textContent?.trim() || control.fallback;
        }

        function closeCustomDropdown(control) {
          if (!control.menu || !control.button) {
            return;
          }
          control.menu.hidden = true;
          control.button.setAttribute("aria-expanded", "false");
        }

        function closeStrategyDropdown() {
          closeCustomDropdown(customDropdowns()[0]);
        }

        function closeAllHeaderDropdowns(exceptControl = null) {
          customDropdowns().forEach((control) => {
            if (control !== exceptControl) {
              closeCustomDropdown(control);
            }
          });
        }

        function syncCustomDropdownUi(control) {
          if (!control.select || !control.button || !control.menu) {
            return;
          }
          control.button.textContent = customDropdownLabel(control);
          control.button.classList.toggle("index-sticky-select--muted", control.select.classList.contains("index-sticky-select--muted"));
          control.menu.querySelectorAll(`[${control.optionAttribute}]`).forEach((option) => {
            const isSelected = option.getAttribute(control.optionAttribute) === control.select.value;
            option.classList.toggle("is-selected", isSelected);
            option.setAttribute("aria-selected", isSelected ? "true" : "false");
          });
        }

        function syncStrategyDropdownUi() {
          syncCustomDropdownUi(customDropdowns()[0]);
        }

        function syncHeaderDropdownsUi() {
          customDropdowns().forEach(syncCustomDropdownUi);
        }

        function renderCustomDropdownOptions(control) {
          if (!control.select || !control.menu) {
            return;
          }
          control.menu.innerHTML = [...control.select.options].map((option) => {
            const value = escapeHtml(option.value);
            const label = escapeHtml(option.textContent || "");
            return `<button class="index-strategy-dropdown-option" type="button" role="option" ${control.optionAttribute}="${value}">${label}</button>`;
          }).join("");
          syncCustomDropdownUi(control);
        }

        function renderStrategyDropdownOptions() {
          renderCustomDropdownOptions(customDropdowns()[0]);
        }

        function renderHeaderDropdownOptions() {
          customDropdowns().forEach(renderCustomDropdownOptions);
        }

        function renderRankingOptions(select) {
          if (rankingLabel) {
            rankingLabel.hidden = true;
          }
          if (!select) {
            return;
          }
          select.disabled = false;
          select.hidden = false;
          select.innerHTML = [
            '<option value="">ランキング</option>',
            ...rankingOptions.map(
              (item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`
            ),
          ].join("");
        }

        function updateSortPriorityUi() {
          const strategyActive = isStrategySortActive();
          const rankingActive = isRankingSortActive();
          [sortSelect, stickySortSelect].filter(Boolean).forEach((select) => {
            select.classList.toggle("index-sticky-select--muted", rankingActive && !strategyActive);
          });
          strategyDropdownButton?.classList.toggle("index-sticky-select--muted", rankingActive && !strategyActive);
          [rankingSelect, rankingLabel].filter(Boolean).forEach((control) => {
            control.classList.toggle("index-sticky-select--muted", strategyActive);
          });
          rankingDropdownButton?.classList.toggle("index-sticky-select--muted", strategyActive);
        }

        renderSortOptions(sortSelect);
        renderSortOptions(stickySortSelect);
        renderRankingOptions(rankingSelect);
        renderHeaderDropdownOptions();
      
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
        state.highPullbackDropPct = normalizeHighPullbackDropPct(params.get("pullback"));
        enforceDailyOnlySortTimeframe();
        renderRankingOptions(rankingSelect);
        renderHeaderDropdownOptions();
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
        turnoverSelect.value = String(effectiveTurnoverFilter());
        limitSelect.value = limitControlValue();
        updateSortPriorityUi();
        syncHeaderDropdownsUi();
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
            const timeframe = btn.dataset.value;
            const isDisabled = isDailyOnlySort() && timeframe !== "daily";
            const isActive = timeframe === state.timeframe;
            btn.classList.toggle("active", isActive);
            btn.classList.toggle("is-disabled", isDisabled);
            btn.disabled = isDisabled;
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
            btn.setAttribute("aria-disabled", isDisabled ? "true" : "false");
            btn.title = isDisabled ? "高値調整（30% Pullback）は日足のみ対応です" : "";
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
            const timeframe = btn.dataset.value;
            const isDisabled = isDailyOnlySort() && timeframe !== "daily";
            const isActive = timeframe === state.timeframe;
            btn.classList.toggle("active", isActive);
            btn.classList.toggle("is-disabled", isDisabled);
            btn.disabled = isDisabled;
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
            btn.setAttribute("aria-disabled", isDisabled ? "true" : "false");
            btn.title = isDisabled ? "高値調整（30% Pullback）は日足のみ対応です" : "";
          });
        }

        function updateDailyOnlySortUi() {
          renderRankingOptions(rankingSelect);
          renderCustomDropdownOptions(customDropdowns()[1]);
          if (rankingSelect) {
            rankingSelect.value = rankingControlValue();
          }
          updateSortPriorityUi();
          syncHeaderDropdownsUi();
          updateTimeframeUI();
          updateStickyTimeframeUI();
          updateRangeChip();
          updateTimeframePopover();
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
          stickyPickedLink.textContent = pickCount > 0 ? `List ${pickCount}` : "List";
        }

        function updateIndexResultCount({ matchedCount = 0, displayedCount = 0, loading = false } = {}) {
          if (!resultCount) {
            return;
          }
          resultCount.hidden = false;
          if (loading) {
            resultCount.textContent = `${scannerSortLabel(state.sort)} 読込中`;
            return;
          }
          const matchedLabel = isCustomCodeMode()
            ? "指定"
            : isListMode()
              ? "List"
              : scannerSortLabel(state.sort);
          const totalText = `${matchedLabel} ${formatNumber(matchedCount, 0)}件`;
          const displayText = Number(displayedCount) === Number(matchedCount)
            ? ""
            : ` / 表示 ${formatNumber(displayedCount, 0)}件`;
          resultCount.textContent = `${totalText}${displayText}`;
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
          if (!picksMenu || !picksMenuToggle) {
            return;
          }
          picksMenu.hidden = !isOpen;
          picksMenu.classList.toggle("is-open", isOpen);
          picksMenuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
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
          pickedLink.removeAttribute("href");
        }
        if (stickyPickedLink) {
          stickyPickedLink.removeAttribute("href");
        }
      
        async function handleHeaderControlChange(control) {
            const activeSortControl = stickySortSelect?.matches(":focus") ? stickySortSelect : sortSelect;
            if (control === rankingSelect) {
              if (isDailyOnlySort()) {
                state.highPullbackDropPct = DEFAULT_HIGH_PULLBACK_DROP_PCT;
              }
              state.sort = readRankingControlValue(rankingSelect);
            } else if (control === sortSelect || control === stickySortSelect) {
              state.sort = readStrategyControlValue(activeSortControl);
              state.highPullbackDropPct = highPullbackDropPct();
            }
            enforceDailyOnlySortTimeframe();
            state.tag = stickyTagSelect?.matches(":focus") ? stickyTagSelect.value : tagSelect.value;
            state.theme = stickyThemeSelect?.matches(":focus") ? stickyThemeSelect.value : themeSelect.value;
            state.turnover = Number(stickyTurnoverSelect?.matches(":focus") ? stickyTurnoverSelect.value : turnoverSelect.value);
            state.limit = readLimitControlValue(stickyLimitSelect?.matches(":focus") ? stickyLimitSelect : limitSelect);
            if (sortSelect) sortSelect.value = strategyControlValue();
            renderRankingOptions(rankingSelect);
            renderCustomDropdownOptions(customDropdowns()[1]);
            if (rankingSelect) rankingSelect.value = rankingControlValue();
            updateDailyOnlySortUi();
            updateSortPriorityUi();
            if (stickySortSelect) stickySortSelect.value = strategyControlValue();
            if (tagSelect) tagSelect.value = state.tag;
            if (stickyTagSelect) stickyTagSelect.value = state.tag;
            if (themeSelect) themeSelect.value = state.theme;
            if (stickyThemeSelect) stickyThemeSelect.value = state.theme;
            if (turnoverSelect) turnoverSelect.value = String(effectiveTurnoverFilter());
            if (stickyTurnoverSelect) stickyTurnoverSelect.value = String(effectiveTurnoverFilter());
            if (limitSelect) limitSelect.value = limitControlValue();
            if (stickyLimitSelect) stickyLimitSelect.value = limitControlValue();
            syncHeaderDropdownsUi();
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
        }

        [...new Set([sortSelect, rankingSelect, tagSelect, themeSelect, turnoverSelect, limitSelect, stickySortSelect, stickyTagSelect, stickyThemeSelect, stickyTurnoverSelect, stickyLimitSelect].filter(Boolean))]
          .forEach((control) => {
          control.addEventListener("change", async () => {
            await handleHeaderControlChange(control);
          });
        });

        customDropdowns().forEach((control) => {
          control.button?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!control.menu || !control.button) {
              return;
            }
            const willOpen = control.menu.hidden;
            closeAllHeaderDropdowns(control);
            control.menu.hidden = !willOpen;
            control.button.setAttribute("aria-expanded", willOpen ? "true" : "false");
            syncCustomDropdownUi(control);
          });
          control.menu?.addEventListener("click", async (event) => {
            const option = event.target?.closest?.(`[${control.optionAttribute}]`);
            if (!option || !control.select) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            control.select.value = option.getAttribute(control.optionAttribute) || "";
            closeCustomDropdown(control);
            await handleHeaderControlChange(control.select);
          });
        });

        document.addEventListener("click", (event) => {
          if (!customDropdowns().some((control) => control.root?.contains(event.target))) {
            closeAllHeaderDropdowns();
          }
        });

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            closeAllHeaderDropdowns();
          }
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
          if (event.target.closest("button, a")) {
            setPicksMenuOpen(false);
          }
        });

        pickedLink?.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setPicksMenuOpen(Boolean(picksMenu?.hidden));
          state.stickyDateOpen = false;
          state.stickyFiltersOpen = false;
          updateStickyDateUi();
          updateStickyFiltersUi();
        });
      
        document.addEventListener("click", (event) => {
          if (picksMenu && !picksMenu.hidden) {
            if (!picksMenu.contains(event.target) && !picksMenuToggle?.contains(event.target)) {
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
            closeListSaveModal();
            closeListSetsModal();
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
              if (btn.disabled || (isDailyOnlySort() && nextTimeframe !== "daily")) {
                return;
              }
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
            exitListMode();
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

        addCodesButton?.addEventListener("click", () => {
          setPicksMenuOpen(false);
          openCustomCodeModal();
        });
        exportTradingViewButton?.addEventListener("click", () => {
          setPicksMenuOpen(false);
          triggerExportDownloads([buildTradingViewExportEntry(currentListPicks())]);
        });
        exportHyperButton?.addEventListener("click", () => {
          setPicksMenuOpen(false);
          triggerExportDownloads(buildHyperExportEntries(currentListPicks()));
        });
        saveListButton?.addEventListener("click", () => {
          setPicksMenuOpen(false);
          openListSaveModal();
        });
        viewListButton?.addEventListener("click", async () => {
          setPicksMenuOpen(false);
          viewCurrentPickList();
          await render();
        });
        openListButton?.addEventListener("click", () => {
          setPicksMenuOpen(false);
          openListSetsModal();
        });
        exitListButton?.addEventListener("click", async () => {
          setPicksMenuOpen(false);
          exitListMode();
          await render();
        });

        customCodeInput?.addEventListener("input", updateCustomCodeMeta);
        customCodeApplyButton?.addEventListener("click", async () => {
          const nextCodes = normalizeCustomCodeInput(customCodeInput?.value || "");
          addCodesToList(nextCodes);
          if (customCodeInput) {
            customCodeInput.value = state.customCodeText;
          }
          closeCustomCodeModal();
          if (rankingSelect) rankingSelect.value = rankingControlValue();
          if (sortSelect) sortSelect.value = strategyControlValue();
          if (stickySortSelect) stickySortSelect.value = strategyControlValue();
          syncHeaderDropdownsUi();
          await render();
        });
        customCodeClearButton?.addEventListener("click", () => {
          if (customCodeInput) {
            customCodeInput.value = "";
          }
          updateCustomCodeMeta();
        });
        customCodeExitButton?.addEventListener("click", async () => {
          exitListMode();
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

        listSaveOkButton?.addEventListener("click", () => {
          try {
            const saved = registerAllPicks(currentListPicks(), listSaveInput?.value || "");
            state.activeListName = saved?.name || state.activeListName;
            if (listSaveError) {
              listSaveError.hidden = true;
              listSaveError.textContent = "";
            }
            closeListSaveModal();
          } catch (error) {
            if (listSaveError) {
              listSaveError.textContent = error?.message || "保存できませんでした。";
              listSaveError.hidden = false;
            }
          }
        });
        listSaveCancelButton?.addEventListener("click", closeListSaveModal);
        listSaveInput?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            listSaveOkButton?.click();
          }
        });
        listSetsCloseButton?.addEventListener("click", closeListSetsModal);
        listSetsModal?.addEventListener("click", (event) => {
          if (event.target === listSetsModal) {
            closeListSetsModal();
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
            resetChartCaches();
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
          if (isDailyOnlySort()) {
            updateDailyOnlySortUi();
            syncCurrentIndexScannerUrl();
          }
          await render();
          startManifestPolling();
        } catch (error) {
          showError(errorBox, error.message);
        }
      
        async function loadDate(requestedDate) {
          state.selectedDate = resolveOverviewDateForTimeframe(requestedDate, state.timeframe);
          state.overview = await loadOverview(state.selectedDate, state.timeframe);
          state.updateHealth = await loadUpdateHealth();
          state.ohlcvQualitySummary = await loadOhlcvQualitySummary();
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
          pickedLink.textContent = pickCount > 0 ? `List ${pickCount}` : "List";
          if (stickyPickedLink) {
            stickyPickedLink.textContent = pickCount > 0 ? `List ${pickCount}` : "List";
          }
          const hasPicks = pickCount > 0;
          [exportTradingViewButton, exportHyperButton, saveListButton, resetPicksButton].filter(Boolean).forEach((button) => {
            button.disabled = !hasPicks;
          });
          if (exitListButton) {
            exitListButton.disabled = !isListMode();
          }
        }

        function setCardPickedState(card, picked) {
          if (!card) {
            return;
          }
          card.classList.toggle("scanner-item-picked", picked);
          card.classList.remove("scanner-item-pick-flash");
          if (picked) {
            void card.offsetWidth;
            card.classList.add("scanner-item-pick-flash");
            window.setTimeout(() => {
              card.classList.remove("scanner-item-pick-flash");
            }, 520);
          }
        }

        function renderSavedListSets() {
          if (!listSetsBody) {
            return;
          }
          const sets = loadRegisteredPicks();
          if (!sets.length) {
            listSetsBody.innerHTML = '<div class="empty-cell">保存されたListはありません。</div>';
            return;
          }
          listSetsBody.innerHTML = sets
            .map((entry) => {
              const id = escapeHtml(String(entry?.id || ""));
              return `
                <div class="index-list-set-row">
                  <div>
                    <div class="picked-register-name">${escapeHtml(entry?.name || "Untitled")}</div>
                    <div class="picked-register-meta">${escapeHtml(formatPickedDateTime(entry?.registeredAt))} / ${formatNumber(Number(entry?.count || 0), 0)}件</div>
                  </div>
                  <div class="picked-register-item-actions">
                    <button type="button" class="row-button" data-open-index-list-set="${id}">開く</button>
                    <button type="button" class="row-button picked-remove-button" data-delete-index-list-set="${id}">削除</button>
                  </div>
                </div>
              `;
            })
            .join("");
          listSetsBody.querySelectorAll("[data-open-index-list-set]").forEach((button) => {
            button.addEventListener("click", async () => {
              const entry = getRegisteredSetById(button.getAttribute("data-open-index-list-set"));
              if (!entry) {
                renderSavedListSets();
                return;
              }
              setActiveListFromPicks(entry.items || [], entry.name || "保存List");
              closeListSetsModal();
              await render();
            });
          });
          listSetsBody.querySelectorAll("[data-delete-index-list-set]").forEach((button) => {
            button.addEventListener("click", () => {
              removeRegisteredSetById(button.getAttribute("data-delete-index-list-set"));
              renderSavedListSets();
            });
          });
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

        function resetChartCaches() {
          state.chartRenderedCodes = new Set();
          state.chartPayloadCache.clear();
          state.chartRequestCache.clear();
          state.chartBaselineShape = null;
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
          if (isListMode()) {
            dataQualitySummaryBox.hidden = false;
            dataQualitySummaryBox.innerHTML = `
              <span class="index-data-quality-chip">List表示 <strong>${escapeHtml(state.activeListName || "List")}</strong></span>
              <span class="index-data-quality-chip">値上がり率順</span>
              <span class="index-data-quality-chip">対象 <strong>${formatNumber(state.activeListCodes.length, 0)}</strong></span>
              ${state.activeListMissing.length ? `<span class="index-data-quality-chip">未検出 <strong>${formatNumber(state.activeListMissing.length, 0)}</strong></span>` : ""}
            `;
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
          const ohlcvQualityHtml = renderOhlcvQualitySummaryChip(state.ohlcvQualitySummary);
          dataQualitySummaryBox.hidden = false;
          dataQualitySummaryBox.innerHTML = `
            <span class="index-data-quality-chip">最新一致 <strong>${formatNumber(summary.matchedCount, 0)}</strong></span>
            <span class="index-data-quality-chip">遅延 <strong>${formatNumber(summary.staleCount, 0)}</strong></span>
            <span class="index-data-quality-chip">空データ <strong>${formatNumber(summary.emptyCount, 0)}</strong></span>
            ${ohlcvQualityHtml}
          `;
        }

        function formatQualitySummaryGeneratedAt(value) {
          const text = String(value || "").trim();
          if (!text) {
            return "";
          }
          const date = new Date(text);
          if (Number.isNaN(date.getTime())) {
            return text;
          }
          const pad = (number) => String(number).padStart(2, "0");
          return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        }

        function qualityIssueLabel(item) {
          const code = String(item?.code || "").trim();
          const source = String(item?.source || "").trim();
          const kind = String(item?.kind || "").trim();
          const date = String(item?.date || "").trim();
          return [code, source, kind, date].filter(Boolean).join(" ");
        }

        function renderOhlcvQualitySummaryChip(summary) {
          if (!summary || typeof summary !== "object") {
            return "";
          }
          const actionableCount = Number(summary.actionableCount || 0);
          const criticalCount = Number(summary.criticalCount || 0);
          const generatedAt = formatQualitySummaryGeneratedAt(summary.generatedAt);
          const samples = Array.isArray(summary.samples) ? summary.samples : [];
          const toneClass = actionableCount > 0 || criticalCount > 0 ? " index-data-quality-chip--warn" : " index-data-quality-chip--ok";
          if (actionableCount <= 0 && criticalCount <= 0) {
            const title = generatedAt ? `OHLCV重大異常 0件 / 品質チェック ${generatedAt}` : "OHLCV重大異常 0件";
            return `<span class="index-data-quality-chip index-data-quality-chip--quiet${toneClass}" title="${escapeHtml(title)}">OHLCV <strong>0</strong></span>`;
          }
          const byKind = summary.byKind && typeof summary.byKind === "object" ? summary.byKind : {};
          const kindSummary = Object.entries(byKind)
            .map(([kind, count]) => `${kind}: ${formatNumber(count, 0)}`)
            .join(" / ");
          const title = [
            `OHLCV品質チェック 要確認 ${formatNumber(actionableCount || criticalCount, 0)}件`,
            generatedAt ? `生成 ${generatedAt}` : "",
            kindSummary,
          ].filter(Boolean).join(" / ");
          const sampleItems = samples.slice(0, 12).map((item) => {
            const label = qualityIssueLabel(item);
            const message = String(item?.message || "").trim();
            return `<li><span>${escapeHtml(label || "-")}</span>${message ? `<small>${escapeHtml(message)}</small>` : ""}</li>`;
          }).join("");
          return `
            <details class="index-data-quality-details">
              <summary class="index-data-quality-chip${toneClass}" title="${escapeHtml(title)}">OHLCV要確認 <strong>${formatNumber(actionableCount || criticalCount, 0)}</strong></summary>
              <div class="index-data-quality-popover">
                <div class="index-data-quality-popover-title">OHLCV品質チェック${generatedAt ? ` ${escapeHtml(generatedAt)}` : ""}</div>
                <div class="index-data-quality-popover-meta">更新は停止していません。価格データは自動修復せず、確認対象だけ表示しています。</div>
                <ul>${sampleItems || "<li><span>詳細なし</span></li>"}</ul>
              </div>
            </details>
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
          const cacheKey = String(code);
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

        async function loadHighPullbackRecentRows(code) {
          const cacheKey = String(code);
          const cached = state.highPullbackRecentPayloadCache.get(cacheKey);
          if (cached) {
            return cached;
          }
          if (!state.highPullbackRecentRequestCache.has(cacheKey)) {
            state.highPullbackRecentRequestCache.set(
              cacheKey,
              loadRecentTickerForChart(code, {
                selectedDate: state.selectedDate,
                allowStaleSelectedDate: true,
              })
                .then((inspected) => {
                  const rows = inspected.payload?.ohlcv || [];
                  state.highPullbackRecentPayloadCache.set(cacheKey, rows);
                  return rows;
                })
                .finally(() => {
                  state.highPullbackRecentRequestCache.delete(cacheKey);
                })
            );
          }
          return state.highPullbackRecentRequestCache.get(cacheKey);
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
          const forcedDailyOnlyTimeframe = enforceDailyOnlySortTimeframe();
          if (forcedDailyOnlyTimeframe && state.selectedDate) {
            await loadDate(state.selectedDate);
          }
          if (isDailyOnlySort()) {
            updateDailyOnlySortUi();
            syncCurrentIndexScannerUrl();
          }
          disconnectChartObserver();
          list.innerHTML = '<div class="empty-cell">読み込み中...</div>';
          updateIndexResultCount({ loading: true });
          state.picks = loadScannerPicks();
          state.chartRenderedCodes = new Set();
          state.chartBaselineShape = null;
          updateIndexHeaderActions();
          renderTagOptions();
          renderThemeOptions();
          let filtered = [];
          let matchedCount = 0;
          if (isListMode()) {
            const recordsByCode = new Map((state.overview.records || []).map((record) => [String(record.code || "").toUpperCase(), record]));
            state.activeListMissing = [];
            const listRecords = state.activeListCodes
              .map((code) => {
                const record = recordsByCode.get(String(code).toUpperCase());
                if (!record) {
                  state.activeListMissing.push(code);
                }
                return record;
              })
              .filter(Boolean);
            filtered = sortScannerRecords(listRecords, DEFAULT_INDEX_SORT);
            matchedCount = filtered.length;
          } else if (isCustomCodeMode()) {
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
            matchedCount = filtered.length;
          } else {
            state.activeListMissing = [];
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
            } else if (state.sort === "strategy_high_pullback_30") {
              list.innerHTML = '<div class="empty-cell">高値調整を判定中...</div>';
              updateIndexResultCount({ loading: true });
              scannerBase = await filterHighPullback30Records(scannerBase);
            } else if (state.sort === "strategy_strong_trend_pullback_rebound") {
              const prefilteredScannerBase = scannerBase.filter(isStrongTrendPullbackReboundPrefilterCandidate);
              list.innerHTML = `<div class="empty-cell">強トレンド押し目を判定中... (${formatNumber(prefilteredScannerBase.length, 0)} / ${formatNumber(scannerBase.length, 0)})</div>`;
              updateIndexResultCount({ loading: true });
              scannerBase = await filterStrongTrendPullbackReboundRecords(prefilteredScannerBase);
            }
            matchedCount = scannerBase.length;
            filtered = sortScannerRecords(scannerBase, state.sort).slice(0, state.limit);
          }
          state.visibleRecords = filtered;
          updateIndexResultCount({ matchedCount, displayedCount: filtered.length });
          syncCurrentIndexScannerUrl();
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
          syncHeaderDropdownsUi();
          updateDailyOnlySortUi();
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
              : isListMode()
                ? state.activeListCodes.length
                  ? `${state.activeListMissing.length ? `<div class="index-custom-code-notice">見つからないコード: ${escapeHtml(state.activeListMissing.join(", "))}</div>` : ""}<div class="empty-cell">表示できるList銘柄がありません。</div>`
                  : '<div class="empty-cell">Listが空です。</div>'
              : '<div class="empty-cell">該当する銘柄がありません。</div>';
            return;
          }
          if (selectAllPicksButton) {
            selectAllPicksButton.disabled = false;
          }
          if (stickySelectAllPicksButton) {
            stickySelectAllPicksButton.disabled = false;
          }
      
          const missingNotice = isListMode() && state.activeListMissing.length
            ? `<div class="index-custom-code-notice">List内で見つからないコード: ${escapeHtml(state.activeListMissing.join(", "))}</div>`
            : isCustomCodeMode() && state.customCodeMissing.length
              ? `<div class="index-custom-code-notice">見つからないコード: ${escapeHtml(state.customCodeMissing.join(", "))}</div>`
              : "";
          list.innerHTML = missingNotice + filtered
            .map((record, index) => renderScannerItem(record, index, state))
            .join("");
      
          filtered.forEach((record) => {
            const checkbox = list.querySelector(`input[data-pick-code="${record.code}"]`);
            const card = list.querySelector(`[data-scanner-card-code="${record.code}"]`);
            const chartWrap = list.querySelector(`[data-pick-chart-code="${record.code}"]`);
            if (!checkbox) {
              return;
            }
            checkbox.addEventListener("change", async () => {
              toggleScannerPick(record, checkbox.checked, state);
              setCardPickedState(card, checkbox.checked);
              if (isListMode() && !checkbox.checked) {
                state.activeListCodes = state.activeListCodes.filter((code) => String(code) !== String(record.code));
                if (!state.activeListCodes.length) {
                  exitListMode();
                }
                await render();
                return;
              }
              updateIndexHeaderActions();
            });
            chartWrap?.addEventListener("dblclick", async (event) => {
              event.preventDefault();
              const nextChecked = !Boolean(state.picks?.[record.code]);
              checkbox.checked = nextChecked;
              toggleScannerPick(record, nextChecked, state);
              setCardPickedState(card, nextChecked);
              if (isListMode() && !nextChecked) {
                state.activeListCodes = state.activeListCodes.filter((code) => String(code) !== String(record.code));
                if (!state.activeListCodes.length) {
                  exitListMode();
                }
                await render();
                return;
              }
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

        window.addEventListener("pageshow", () => {
          if (!isDailyOnlySort()) {
            return;
          }
          enforceDailyOnlySortTimeframe();
          updateDailyOnlySortUi();
          renderDateControls();
          renderCalendar();
          syncCurrentIndexScannerUrl();
        });
      }
      
  }

  window.KabuPageIndexScanner = Object.freeze({ initIndexScannerPage });
})();
