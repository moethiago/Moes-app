#!/usr/bin/env python3
"""One source, two Lifts: the same files in lift/ and lift2/ must open different data with different codes.
Usage: python3 tests/lift_two_e2e.py <dir containing lift/ and lift2/>   (real Chromium, backend mocked)"""
import json, threading, http.server, socketserver, sys, os
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1]; PORT = 8155
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Q); threading.Thread(target=srv.serve_forever, daemon=True).start()
seen = []; P, F = 0, 0
def ok(n, c, x=""):
    global P, F
    print(("PASS " if c else "FAIL ") + n + ("" if c else f"  — {x}")); P, F = P + (1 if c else 0), F + (0 if c else 1)
def api(route):
    u = route.request.url; b = json.loads(route.request.post_data or "{}"); seen.append((u, b.get("pin")))
    want = "250958" if "u=f" in u else "2026"
    if b.get("pin") != want: return route.fulfill(status=401, body='{"error":"pin"}', content_type="application/json")
    return route.fulfill(status=200, body=json.dumps({"v": 0, "state": None, "role": "full"}), content_type="application/json")
with sync_playwright() as p:
    br = p.chromium.launch()
    for folder, code, other, prefix in (("lift2", "250958", "2026", "liftf_"), ("lift", "2026", "250958", "lift_")):
        ctx = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.route("**/api/health-check**", api); pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
        seen.clear(); pg.goto(f"http://127.0.0.1:{PORT}/{folder}/index.html"); pg.wait_for_timeout(900)
        pg.fill("#pin", other); pg.click("#pinGo"); pg.wait_for_timeout(900)
        ok(f"{folder}: the other person's code is refused", "wrong" in pg.inner_text("#pinErr").lower(), pg.inner_text("#pinErr"))
        pg.fill("#pin", code); pg.click("#pinGo"); pg.wait_for_timeout(1500)
        ok(f"{folder}: own code opens it", pg.is_hidden("#gate"))
        urls = {u for u, _ in seen}
        ok(f"{folder}: talks only to its own data", all(("u=f" in u) == (folder == "lift2") for u in urls), urls)
        keys = pg.evaluate("Object.keys(localStorage)")
        ok(f"{folder}: phone storage kept separate ({prefix}…)", keys and all(k.startswith(prefix) for k in keys if k.startswith("lift")), keys)
        ready = pg.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)"); pg.wait_for_timeout(1200)
        names = pg.evaluate("caches.keys()")
        ok(f"{folder}: offline copy installs under its own name", ready and any(n.startswith(folder + "-v") for n in names), names)
        ctx.close()
    br.close()
print(f"E2E two lifts: PASS {P}  FAIL {F}"); srv.shutdown(); sys.exit(1 if F else 0)
