(function () {
  var host = window.location.hostname || "";
  var protocol = window.location.protocol || "";
  var port = window.location.port || "";
  var pathname = window.location.pathname || "/";

  function redirectToLocalServer() {
    var nextPath = pathname === "/" ? "/index.html" : pathname;
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
