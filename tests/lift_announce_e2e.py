#!/usr/bin/env python3
"""Announcement pop-up (4.14): shows once per announcement, always closes, never mid-workout, Arabic chrome, admin publish/edit/take-down.
Usage: python3 tests/lift_announce_e2e.py <dir containing lift-test/> [folder]   (real Chromium, backend mocked)"""
import json, threading, http.server, socketserver, sys
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1]; FOLDER = sys.argv[2] if len(sys.argv) > 2 else "lift-test"; PORT = 8157
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Q); threading.Thread(target=srv.serve_forever, daemon=True).start()
P, F = 0, 0
def ok(n, c, x=""):
    global P, F
    print(("PASS " if c else "FAIL ") + n + ("" if c else f"  — {x}")); P, F = P + (1 if c else 0), F + (0 if c else 1)
B = {"ann": None, "calls": []}
def api(route):
    b = json.loads(route.request.post_data or "{}"); a = b.get("action", "state"); B["calls"].append(a)
    if b.get("pin") != "2026": return route.fulfill(status=401, body='{"error":"pin"}', content_type="application/json")
    if a == "announceset":
        keep = b.get("keep") and B["ann"]
        B["ann"] = {"id": B["ann"]["id"] if keep else str(1000 + len(B["calls"])), "title": b.get("title", "").strip(), "body": b.get("body", "").strip(), "t": 1760800000000}
        return route.fulfill(status=200, body=json.dumps({"ok": True, "announce": B["ann"]}), content_type="application/json")
    if a == "announceclear":
        B["ann"] = None; return route.fulfill(status=200, body='{"ok":true,"announce":null}', content_type="application/json")
    if a == "state":
        return route.fulfill(status=200, body=json.dumps({"v": 0, "state": None, "role": "full", "admin": False, "announce": B["ann"]}), content_type="application/json")
    return route.fulfill(status=200, body='{"ok":true,"v":1}', content_type="application/json")
URL = f"http://127.0.0.1:{PORT}/{FOLDER}/index.html"
MSG = "Leg day is back.\nNew exercises are in the library — check them out!"
def shown(pg): return pg.locator("#annbg").count() == 1
with sync_playwright() as p:
    br = p.chromium.launch()
    for vw in ({"width": 390, "height": 844}, {"width": 375, "height": 667}):
        tag = f"{vw['width']}x{vw['height']}"
        ctx = br.new_context(viewport=vw, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.route("**/api/health-check**", api); pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        B["ann"] = {"id": "a1", "title": "New in Lift", "body": MSG, "t": 1760800000000}
        pg.goto(URL); pg.wait_for_timeout(900)
        ok(f"{tag}: no pop-up on the login screen", not shown(pg))
        pg.fill("#pin", "2026"); pg.click("#pinGo"); pg.wait_for_timeout(1500)
        ok(f"{tag}: pop-up appears after login", shown(pg))
        txt = pg.inner_text("#annbg") if shown(pg) else ""
        ok(f"{tag}: shows title and message with its line break", "New in Lift" in txt and "Leg day is back.\nNew exercises" in txt, txt)
        box = pg.locator("[data-ann='x']").bounding_box()
        ok(f"{tag}: close button fully on screen", box and box["y"] >= 0 and box["y"] + box["height"] <= vw["height"], box)
        pg.locator("[data-ann='x']").tap(); pg.wait_for_timeout(300)
        ok(f"{tag}: 'Got it' closes it", not shown(pg))
        pg.click("nav.tabs button[data-tab='log']"); pg.wait_for_timeout(300)
        ok(f"{tag}: app is usable right after (nothing stuck on top)", pg.evaluate("TAB") == "log")
        pg.reload(); pg.wait_for_timeout(1500)
        ok(f"{tag}: same announcement never shows twice", not shown(pg))
        pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(600)
        ok(f"{tag}: …not even when coming back to the app", not shown(pg))
        B["ann"] = {"id": "a2", "title": "", "body": "x " * 300, "t": 1760800000000}
        pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(800)
        ok(f"{tag}: a new announcement shows on the next return to the app", shown(pg))
        cb = pg.locator(".anncard").bounding_box(); bb = pg.locator("[data-ann='x']").bounding_box()
        ok(f"{tag}: longest message (600 chars) fits, button still reachable", cb and cb["y"] >= 0 and cb["y"] + cb["height"] <= vw["height"] and bb["y"] + bb["height"] <= vw["height"], (cb, bb))
        ok(f"{tag}: no title → no empty title line", pg.locator(".annt").count() == 0)
        pg.mouse.click(5, 5); pg.wait_for_timeout(300)
        ok(f"{tag}: tapping outside closes it", not shown(pg))
        B["ann"] = {"id": "a3", "title": "T", "body": "Esc test", "t": 1}
        pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(800)
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        ok(f"{tag}: Escape closes it", not shown(pg))
        # never mid-workout
        pg.evaluate("ANN={id:'a4',title:'',body:'mid workout'};S.active={t:Date.now()};annMaybe()"); pg.wait_for_timeout(200)
        ok(f"{tag}: never pops up in the middle of a workout", not shown(pg))
        pg.evaluate("S.active=null;annMaybe()"); pg.wait_for_timeout(200)
        ok(f"{tag}: …shows once the workout is over", shown(pg))
        pg.locator("[data-ann='x']").tap(); pg.wait_for_timeout(200)
        # harmful text stays text
        pg.evaluate("ANN={id:'a5',title:'<img src=x onerror=window.__x=1>',body:'<b>hi</b>'};annMaybe()"); pg.wait_for_timeout(300)
        ok(f"{tag}: message is shown as plain text, never as code", pg.evaluate("!window.__x") and "<b>hi</b>" in pg.inner_text("#annbg"))
        pg.locator("[data-ann='x']").tap()
        ok(f"{tag}: no script errors", not errs, errs)
        ctx.close()
    # Arabic user: chrome in Arabic, message exactly as written
    ctx = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.route("**/api/health-check**", api); pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
    pg.goto(URL); pg.evaluate("localStorage.setItem('lift_lang','ar')"); pg.reload(); pg.wait_for_timeout(700)
    B["ann"] = {"id": "ar1", "title": "Big news", "body": "Train today — مرحبا", "t": 1}
    pg.fill("#pin", "2026"); pg.click("#pinGo"); pg.wait_for_timeout(1600)
    t = pg.inner_text("#annbg") if shown(pg) else ""
    ok("Arabic: button and label in Arabic", "تمام" in t and "إعلان" in t, t)
    ok("Arabic: message not translated (shown as written)", "Big news" in t and "Train today — مرحبا" in t, t)
    pg.locator("[data-ann='x']").tap(); ctx.close()
    # Admin page: write, preview, publish (tap twice), edit keeps it, take down
    ctx = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.route("**/api/health-check**", api); pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
    B["ann"] = None; B["calls"].clear()
    pg.goto(URL); pg.wait_for_timeout(700); pg.fill("#pin", "2026"); pg.click("#pinGo"); pg.wait_for_timeout(1500)
    pg.click("nav.tabs button[data-tab='user']"); pg.wait_for_timeout(300)
    row = pg.locator("[data-p='announce']")
    ok("admin: 'Announcement pop-up' row on the User tab", row.count() == 1)
    row.click(); pg.wait_for_timeout(300)
    ok("admin: Publish disabled until there is a message", pg.locator("[data-a='annpub']").is_disabled())
    pg.fill("#annt", "Hello"); pg.fill("#annb", "First one"); pg.wait_for_timeout(100)
    ok("admin: Publish enabled after typing", not pg.locator("[data-a='annpub']").is_disabled())
    pg.click("[data-a='annprev']"); pg.wait_for_timeout(200)
    ok("admin: preview shows the real pop-up", shown(pg) and "First one" in pg.inner_text("#annbg"))
    pg.locator("[data-ann='x']").tap(); pg.wait_for_timeout(200)
    ok("admin: preview doesn't count as seen", pg.evaluate("annSeen()") == "")
    pg.click("[data-a='annpub']"); pg.wait_for_timeout(200)
    ok("admin: first tap only asks to confirm", "announceset" not in B["calls"])
    pg.click("[data-a='annpub']"); pg.wait_for_timeout(600)
    ok("admin: second tap publishes", B["ann"] and B["ann"]["body"] == "First one" and B["ann"]["title"] == "Hello", B["ann"])
    ok("admin: live card shows it", "live now" in pg.inner_text("#app").lower() and "First one" in pg.inner_text("#app"))
    first = B["ann"]["id"]
    pg.click("[data-a='annedit']"); pg.wait_for_timeout(200)
    ok("admin: edit pre-fills the text", pg.input_value("#annb") == "First one")
    pg.fill("#annb", "First one (fixed)"); pg.click("[data-a='annpub']"); pg.wait_for_timeout(600)
    ok("admin: edit saves in one tap and keeps it the same announcement", B["ann"]["body"] == "First one (fixed)" and B["ann"]["id"] == first, B["ann"])
    pg.click("[data-a='annoff']"); pg.wait_for_timeout(150); pg.click("[data-a='annoff']"); pg.wait_for_timeout(600)
    ok("admin: take down (tap twice) removes it", B["ann"] is None and "live now" not in pg.inner_text("#app").lower())
    ctx.close(); br.close()
print(f"PASS {P}  FAIL {F}"); sys.exit(1 if F else 0)
