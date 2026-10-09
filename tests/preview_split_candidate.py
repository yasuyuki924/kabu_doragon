"""Render the unchanged ticker UI against an isolated repaired data candidate."""

from __future__ import annotations

import gzip
import json
import mimetypes
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CANDIDATE = ROOT / ".tmp/split-september-candidate"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        relative = unquote(urlsplit(self.path).path).lstrip("/") or "index.html"
        base = CANDIDATE if relative.startswith("data/") else ROOT
        path = (base / relative).resolve()
        if not path.is_relative_to(base.resolve()):
            self.send_error(403)
            return
        compressed = relative.endswith(".json.gz")
        if compressed:
            path = path.with_suffix("")
        if not path.is_file():
            self.send_error(404)
            return
        data = path.read_bytes()
        if compressed:
            data = gzip.compress(data)
        self.send_response(200)
        self.send_header("Content-Type", "application/gzip" if compressed else mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    results = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="chrome")
            for viewport in ({"width": 1440, "height": 1000}, {"width": 390, "height": 844}):
                for code in ("4667", "278A"):
                    page = browser.new_page(viewport=viewport)
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(f"http://127.0.0.1:{server.server_port}/ticker.html?code={code}&publicSite=1", wait_until="networkidle")
                    page.wait_for_function("document.querySelectorAll('canvas').length >= 2")
                    page.wait_for_function("document.querySelector('#tickerTitle')?.textContent.includes('銘柄詳細') === false")
                    page.screenshot(path=str(CANDIDATE / f"preview-{code}-{viewport['width']}.png"), full_page=True)
                    pixels = page.evaluate("""() => Array.from(document.querySelectorAll('canvas')).map(canvas => {
                        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                        const colors = new Set();
                        for (let i = 0; i < data.length; i += 400) colors.add([data[i],data[i+1],data[i+2],data[i+3]].join(','));
                        return {width:canvas.width,height:canvas.height,colors:colors.size};
                    })""")
                    if errors or not any(value["colors"] > 10 for value in pixels):
                        raise AssertionError({"errors": errors, "pixels": pixels})
                    results.append({"code": code, "viewport": viewport, "title": page.locator("#tickerTitle").inner_text(),
                                    "canvases": pixels, "pageErrors": errors})
                    page.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    (CANDIDATE / "browser_validation.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
