#!/usr/bin/env python3
"""One source, three Lifts: the same app file in lift/ (Moaath), lift2/ (friend) and lift-test/ (test camp) must open different data.
Usage: python3 tests/lift_two_e2e.py <dir containing lift/, lift2/ and lift-test/>   (real Chromium, backend mocked)"""
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
    want = "250958" if "u=f" in u else "2026"  # the test camp (u=t) opens with Moaath's own code
    if b.get("pin") != want: return route.fulfill(status=401, body='{"error":"pin"}', content_type="application/json")
    return route.fulfill(status=200, body=json.dumps({"v": 0, "state": None, "role": "full"}), content_type="application/json")
with sync_playwright() as p:
    br = p.chromium.launch()
    for folder, code, other, prefix in (("lift2", "250958", "2026", "liftf_"), ("lift", "2026", "250958", "lift_"), ("lift-test", "2026", "250958", "liftt_")):
        if not os.path.isdir(os.path.join(ROOT, folder)): print("skip " + folder); continue
        ctx = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.route("**/api/health-check**", api); pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
        seen.clear(); pg.goto(f"http://127.0.0.1:{PORT}/{folder}/index.html"); pg.wait_for_timeout(900)
        pg.fill("#pin", other); pg.click("#pinGo"); pg.wait_for_timeout(900)
        ok(f"{folder}: the other person's code is refused", "wrong" in pg.inner_text("#pinErr").lower(), pg.inner_text("#pinErr"))
        pg.fill("#pin", code); pg.click("#pinGo"); pg.wait_for_timeout(1500)
        ok(f"{folder}: own code opens it", pg.is_hidden("#gate"))
        urls = {u for u, _ in seen}
        want_u = {"lift2": "u=f", "lift-test": "u=t", "lift": None}[folder]
        ok(f"{folder}: talks only to its own data", all((want_u in u) if want_u else ("u=" not in u) for u in urls), urls)
        camp = pg.evaluate("[document.title, document.documentElement.classList.contains('testcamp'), !!document.querySelector('.tcamp'), document.querySelector('meta[name=apple-mobile-web-app-title]').content]")
        if folder == "lift-test": ok("lift-test: named 'Lift Test' on the Home Screen and marked TEST CAMP", camp == ["Lift Test", True, True, "Lift Test"], camp)
        else: ok(f"{folder}: no test-camp marks", camp[1:3] == [False, False] and camp[3] == "Lift", camp)
        keys = pg.evaluate("Object.keys(localStorage)")
        ok(f"{folder}: phone storage kept separate ({prefix}…)", keys and all(k.startswith(prefix) for k in keys if k.startswith("lift")), keys)
        ready = pg.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)"); pg.wait_for_timeout(1200)
        names = pg.evaluate("caches.keys()")
        ok(f"{folder}: offline copy installs under its own name", ready and any(n.startswith(folder + "-v") for n in names), names)
        ctx.close()
    # all Lifts (and Moaath's other apps) share one website: a Lift updating must never wipe another app's offline copy
    if all(os.path.isdir(os.path.join(ROOT, f)) for f in ("lift", "lift-test")):
        ctx = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.route("**/api/health-check**", api); pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
        pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(300)
        pg.evaluate("caches.open('maqadi-v9').then(c=>c.put('/x',new Response('keep')))")
        for folder in ("lift", "lift-test"):
            pg.goto(f"http://127.0.0.1:{PORT}/{folder}/index.html"); pg.wait_for_timeout(900)
            pg.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)"); pg.wait_for_timeout(1200)
        names = pg.evaluate("caches.keys()")
        ok("the test camp installing keeps Lift's and other apps' offline copies", any(n.startswith("lift-v") for n in names) and any(n.startswith("lift-test-v") for n in names) and "maqadi-v9" in names, names)
        # self-update of the test camp: clears only its own copy, never Lift's or other apps'
        pg.route("**/lift-test/version.json*", lambda r: r.fulfill(status=200, body='{"build":"9.9"}', content_type="application/json"))
        pg.goto(f"http://127.0.0.1:{PORT}/lift-test/index.html"); pg.wait_for_timeout(600)
        pg.evaluate("forceReload('9.9')"); pg.wait_for_timeout(1500)
        names = pg.evaluate("caches.keys()"); regs = pg.evaluate("navigator.serviceWorker.getRegistrations().then(rs=>rs.map(r=>new URL(r.scope).pathname))")
        ok("test camp update refreshes only itself (Lift's offline copy and worker stay)", any(n.startswith("lift-v") for n in names) and "maqadi-v9" in names and any(x.endswith("/lift/") for x in regs), (names, regs))
        ok("…and keeps its own worker registered, so the phone's reminders survive updates", any(x.endswith("/lift-test/") for x in regs), regs)
        ctx.close()
    br.close()
print(f"E2E two lifts: PASS {P}  FAIL {F}"); srv.shutdown(); sys.exit(1 if F else 0)
