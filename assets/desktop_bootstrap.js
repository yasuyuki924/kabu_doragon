(function () {
  var host = window.location.hostname || "";
  var protocol = window.location.protocol || "";
  var port = window.location.port || "";
  var pathname = window.location.pathname || "/";

  function normalizeAppPath(path) {
    var decoded = "";
    try {
      decoded = decodeURIComponent(path || "");
    } catch (_) {
      decoded = path || "";
    }
    var marker = "/kabu_doragon/";
    var markerIndex = decoded.indexOf(marker);
    if (markerIndex >= 0) {
      return "/" + decoded.slice(markerIndex + marker.length).replace(/^\/+/, "");
    }
    return path === "/" ? "/index.html" : path;
  }

  function redirectToLocalServer() {
    var nextPath = normalizeAppPath(pathname);
    var nextUrl = "http://127.0.0.1:8010" + nextPath + (window.location.search || "") + (window.location.hash || "");
    window.location.replace(nextUrl);
  }

  if (protocol === "file:") {
    redirectToLocalServer();
    return;
  }

  if ((host === "127.0.0.1" || host === "localhost") && port === "") {
    redirectToLocalServer();
  }
})();
