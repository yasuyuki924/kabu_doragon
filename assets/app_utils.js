(function () {
  function shouldUseDesktopPortFallback(path) {
    if (typeof window === "undefined") {
      return false;
    }
    const host = String(window.location?.hostname || "");
    const port = String(window.location?.port || "");
    if (!host || port) {
      return false;
    }
    if (host !== "127.0.0.1" && host !== "localhost") {
      return false;
    }
    const normalizedPath = String(path || "");
    return normalizedPath.startsWith("./") || normalizedPath.startsWith("/");
  }

  function buildDesktopPortFallbackUrl(path) {
    const normalizedPath = String(path || "");
    if (!normalizedPath) {
      return "";
    }
    if (/^https?:\/\//i.test(normalizedPath)) {
      return normalizedPath;
    }
    const trimmed = normalizedPath.startsWith("./") ? normalizedPath.slice(1) : normalizedPath;
    const pathWithSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `http://127.0.0.1:8010${pathWithSlash}`;
  }

  function isPublicHostedSite() {
    if (typeof window === "undefined") {
      return false;
    }
    const params = new URLSearchParams(window.location?.search || "");
    const host = String(window.location?.hostname || "");
    return params.get("publicSite") === "1" || host.endsWith(".github.io");
  }

  async function fetchJson(path) {
    const requestPath = String(path || "");
    try {
      let response = await fetch(requestPath, { cache: "no-store" });
      if (!response.ok && response.status === 404 && shouldUseDesktopPortFallback(requestPath)) {
        const fallbackUrl = buildDesktopPortFallbackUrl(requestPath);
        if (fallbackUrl && fallbackUrl !== requestPath) {
          response = await fetch(fallbackUrl, { cache: "no-store" });
        }
      }
      if (!response.ok) {
        throw new Error(`JSON 読み込み失敗: ${requestPath} (${response.status})`);
      }
      return response.json();
    } catch (error) {
      if (typeof window !== "undefined" && window.location?.protocol === "file:") {
        throw new Error("この画面は file:// では開けません。http://127.0.0.1:8010/index.html で開いてください。");
      }
      if (error instanceof TypeError && String(error.message || "").includes("Failed to fetch")) {
        throw new Error("データ取得に失敗しました。http://127.0.0.1:8010/index.html で開いているか確認してください。");
      }
      throw error;
    }
  }

  function parseDate(value) {
    return new Date(`${value}T00:00:00`);
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addMonths(date, delta) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + delta);
    return next;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addCalendarMonths(date, delta) {
    return startOfMonth(addMonths(date, delta));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatNumber(value, digits = 2) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    const numericValue = Number(value);
    return numericValue.toLocaleString("ja-JP", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  }

  function formatSignedNumber(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatNumber(value)}`;
  }

  function formatSignedPercent(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    const sign = value > 0 ? "+" : "";
    return `${sign}${Number(value).toFixed(2)}%`;
  }

  function formatRatio(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    return `${Number(value).toFixed(2)}x`;
  }

  function formatPercent(value) {
    if (value == null || Number.isNaN(value)) {
      return "-";
    }
    return `${Number(value).toFixed(2)}%`;
  }

  function roundNumber(value, digits = 4) {
    if (value == null || Number.isNaN(value)) {
      return null;
    }
    return Number(value.toFixed(digits));
  }

  window.KabuAppUtils = Object.freeze({
    addCalendarMonths,
    addMonths,
    buildDesktopPortFallbackUrl,
    escapeHtml,
    fetchJson,
    formatDateKey,
    formatNumber,
    formatPercent,
    formatRatio,
    formatSignedNumber,
    formatSignedPercent,
    isPublicHostedSite,
    parseDate,
    roundNumber,
    shouldUseDesktopPortFallback,
    startOfMonth,
  });
})();
