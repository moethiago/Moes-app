#!/usr/bin/env python3
"""Lift e2e — real Chromium at iPhone size, backend mocked in-process (same contract as api/health-check?app=lift).
Usage: python3 tests/lift_e2e.py [path-to-lift-folder]   (needs: python3 -m playwright install chromium)"""
import json, threading, http.server, socketserver, sys, os, time
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "lift")
PORT = int(os.environ.get("PORT", "8141"))
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Q); threading.Thread(target=srv.serve_forever, daemon=True).start()
db = {"v": 0, "state": None}
def api(route):
    b = json.loads(route.request.post_data or "{}")
    if b.get("pin") != "2026": return route.fulfill(status=401, body='{"error":"pin"}', content_type="application/json")
    if b["action"] == "state": return route.fulfill(status=200, body=json.dumps({**db, "role": "full"}), content_type="application/json")
    if b["action"] == "save":
        if b.get("v") != db["v"]: return route.fulfill(status=409, body=json.dumps({"conflict": True, **db}), content_type="application/json")
        db["v"] += 1; db["state"] = b["state"]; return route.fulfill(status=200, body=json.dumps({"v": db["v"]}), content_type="application/json")
    route.fulfill(status=400, body='{"error":"unknown"}', content_type="application/json")
res = []
def ok(n, c, extra=""):
    res.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n + ("" if c or not extra else "  — " + str(extra)))
DAY = 864e5
def sess(id, w, days_ago, sets):
    t = int(time.time() * 1000 - days_ago * DAY)
    return {"id": id, "w": w, "start": t, "end": t + 50 * 60000, "sets": [{"i": id + str(n), "e": e, "k": k, "r": r, "t": t + n} for n, (e, k, r) in enumerate(sets)]}
A = lambda: db["state"]["active"]

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, locale="en-GB")
    pg = ctx.new_page(); pg.route("**/api/health-check**", api)
    pg.route("**cdn.jsdelivr.net/**", lambda r: r.fulfill(status=200, body=b"", content_type="image/jpeg"))
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    W = lambda ms=500: pg.wait_for_timeout(ms)

    # --- gate ---
    pg.goto(f"http://127.0.0.1:{PORT}/index.html"); W(600)
    ok("gate shown on cold open", pg.is_visible("#gate"))
    pg.fill("#pin", "0000"); pg.click("#pinGo"); W()
    ok("wrong code rejected", "Wrong" in pg.inner_text("#pinErr"))
    pg.fill("#pin", "2026"); pg.click("#pinGo"); W(800)
    ok("app opens with 2026", pg.is_visible("#app") and not pg.is_visible("#gate"))
    st = db["state"] or {}
    ok("first open saves the default plan (days Sun/Tue/Wed/Sat, next = Upper A)", db["v"] == 1 and st.get("days") == [0, 2, 3, 6] and st.get("next") == 0)
    ok("Today: start button names the next workout", pg.inner_text("#go").strip() == "Start Upper A")
    ok("Today: 7-day week strip", pg.locator(".day").count() == 7)
    ok("Today: start-up phase explained", "Start-up phase" in pg.inner_text("#view"))
    ok("Today: first-time exercises say 'find weight'", pg.locator("text=find weight").count() >= 5)

    # --- workout ---
    pg.click("#go"); W(700)
    ok("starting creates an active workout on the server", A() and A()["w"] == "ua")
    ok("workout screen shows Upper A + Finish button", pg.inner_text("#htitle") == "Upper A" and pg.inner_text("#go").strip() == "Finish workout")
    imgs = pg.eval_on_selector_all(".pics img", "els=>els.map(e=>e.getAttribute('src'))")
    ok("first exercise open with start + finish pictures", len(imgs) == 2 and imgs[0].endswith("Leverage_Chest_Press/0.jpg") and imgs[1].endswith("/1.jpg"))
    ok("how-to steps shown", pg.locator(".cues li").count() == 3)
    ok("first-time guidance shown", "First time" in pg.inner_text(".tip"))
    ok("start-up phase: chest press has 2 set rows", pg.locator(".set").count() == 2)
    rows = pg.locator(".set")
    rows.nth(0).locator("input.k").fill("40"); rows.nth(0).locator("input.r").fill("12")
    rows.nth(0).locator(".tick").click(); W(700)
    ok("set 1 saved to server (40 kg × 12)", len(A()["sets"]) == 1 and A()["sets"][0]["k"] == 40 and A()["sets"][0]["r"] == 12)
    ok("rest timer appears", pg.is_visible("#rest") and ":" in pg.inner_text("#restT"))
    ok("set 2 pre-filled from set 1", pg.locator(".set").nth(1).locator("input.k").input_value() == "40")
    pg.locator(".set").nth(1).locator("[data-d='k+']").click()
    ok("+ steps chest press by 2.5 kg", pg.locator(".set").nth(1).locator("input.k").input_value() == "42.5")
    pg.locator(".set").nth(1).locator("[data-d='k-']").click()
    pg.locator(".set").nth(1).locator(".tick").click(); W(700)
    ok("exercise complete → ✓ 2/2 and next exercise opens", "✓ 2/2" in pg.inner_text(".ex >> nth=0") and pg.locator(".pics img").first.get_attribute("src").endswith("Wide-Grip_Lat_Pulldown/0.jpg"))
    # remove a logged set
    pg.click(".exh >> nth=0"); W(300)
    pg.locator(".set.logged .tick").nth(1).click(); W(700)
    ok("tapping a logged set removes it", len(A()["sets"]) == 1)
    pg.locator(".set").nth(1).locator(".tick").click(); W(700)
    ok("set re-logged", len(A()["sets"]) == 2)
    # extra set
    pg.click(".exh >> nth=0"); W(300)
    pg.click("[data-add='chest_press']"); W(300)
    ok("+ extra set adds a third row", pg.locator(".set").count() == 3)
    pg.locator(".set").nth(2).locator(".tick").click(); W(700)
    ok("extra set saved", len([s for s in A()["sets"] if s["e"] == "chest_press"]) == 3)

    # --- another device saves mid-workout → 409 → merge ---
    other = json.loads(json.dumps(db["state"])); other["days"] = [0, 2, 4, 6]
    db["v"] += 5; db["state"] = other
    if pg.locator(".pics img").first.get_attribute("src").find("Wide-Grip_Lat_Pulldown") < 0: pg.click(".exh >> nth=1"); W(300)
    r = pg.locator(".set").nth(0); r.locator("input.k").fill("30"); r.locator("input.r").fill("11"); r.locator(".tick").click(); W(1500)
    ok("409 merged: other phone's change kept AND my set kept", db["state"]["days"] == [0, 2, 4, 6] and any(s["e"] == "lat_pulldown" for s in A()["sets"]))
    ok("nothing left pending after merge", pg.evaluate("pending.length") == 0)

    # --- offline at the gym ---
    ctx.set_offline(True); pg.evaluate("window.dispatchEvent(new Event('offline'))"); W(100)
    pg.locator(".set").nth(1).locator(".tick").click(); W(400)
    ok("offline: set queued on the phone, badge shows", pg.evaluate("pending.length") == 1 and "offline" in pg.inner_text("#net"))
    n_before = len(A()["sets"])
    ctx.set_offline(False)
    pg.evaluate("pull()"); W(600)   # what reopening the app does, before the queue flushes
    ok("re-sync from server does not lose the queued set", any(s["e"] == "lat_pulldown" and s["r"] == 11 for s in pg.evaluate("S.active.sets")) and len(pg.evaluate("S.active.sets")) == n_before + 1)
    pg.evaluate("window.dispatchEvent(new Event('online'))"); W(1200)
    ok("back online: queued set reaches the server", pg.evaluate("pending.length") == 0 and len(A()["sets"]) == n_before + 1)

    # --- reload mid-workout ---
    pg.reload(); W(1000)
    ok("closing/reopening keeps the workout in progress", pg.inner_text("#htitle") == "Upper A" and pg.inner_text("#go").strip() == "Finish workout")

    # --- finish ---
    pg.click("#go"); W(800)
    st = db["state"]
    ok("finish saves the session and clears active", st["active"] is None and len(st["sessions"]) == 1)
    ok("rotation moves to Lower A", st["next"] == 1)
    ok("summary sheet shown", "Workout done" in pg.inner_text(".sheet"))
    pg.click(".sheet [data-x]"); W(300)
    ok("start button now says Lower A", pg.inner_text("#go").strip() == "Start Lower A")
    ok("today marked done in week strip", pg.locator(".day.done.today").count() == 1)

    # --- progression rules (history injected) ---
    db["state"] = {"days": [0, 2, 3, 6], "next": 0, "active": None, "sessions": [
        sess("s1", "ua", 9, [("chest_press", 40, 10), ("chest_press", 40, 9), ("shoulder_press", 20, 8), ("shoulder_press", 20, 7)]),
        sess("s2", "ua", 4, [("chest_press", 40, 12), ("chest_press", 40, 12), ("lat_pulldown", 30, 11), ("lat_pulldown", 30, 10), ("shoulder_press", 20, 8), ("shoulder_press", 20, 7), ("walk", 0, 15)]),
    ]}
    db["v"] += 1; pg.evaluate("localStorage.removeItem('lift_state')"); pg.reload(); W(1000)
    rows = {r.split("\n")[0]: r for r in pg.locator("#view .card >> nth=-1").locator(".row").all_inner_texts()}
    ok("all sets hit 12 → chest press goes up to 42.5", "42.5 kg" in rows.get("Chest press machine", ""), rows.get("Chest press machine"))
    ok("missed the top → lat pulldown stays 30", "30 kg" in rows.get("Lat pulldown", ""), rows.get("Lat pulldown"))
    ok("two tough sessions → shoulder press drops to 17.5", "17.5 kg" in rows.get("Shoulder press machine", ""), rows.get("Shoulder press machine"))
    pg.click("#go"); W(700)
    ok("in-workout tip explains the increase", "Up to 42.5 kg" in pg.inner_text(".tip"))
    ok("weight box pre-filled with 42.5", pg.locator(".set").nth(0).locator("input.k").input_value() == "42.5")
    r = pg.locator(".set").nth(0); r.locator("input.r").fill("10"); r.locator(".tick").click(); W(400)
    ok("heavier than ever → 🏆 PR toast", "Heaviest ever" in pg.inner_text("#toast"))
    pg.evaluate("$('toast').classList.add('hidden')")
    r = pg.locator(".set").nth(1); r.locator("input.k").fill("40"); r.locator("input.r").fill("8"); r.locator(".tick").click(); W(400)
    ok("weaker set → no PR toast", pg.is_hidden("#toast"))
    pg.click("#go"); W(800); pg.click(".sheet [data-x]"); W(300)
    ok("partial workout can still be finished", len(db["state"]["sessions"]) == 3 and db["state"]["active"] is None)

    # --- progress tab ---
    pg.click("nav [data-tab='progress']"); W(400)
    t = pg.inner_text("#view")
    ok("progress: PR board shows chest press 42.5 kg × 10", "42.5 kg × 10" in t)
    ok("progress: cardio PR in minutes", "15 min" in t)
    ok("progress: workout count", "3" in pg.inner_text("#view .card >> nth=0"))
    pg.click("[data-ex='chest_press']"); W(300)
    ok("exercise history chart drawn", pg.locator(".sheet svg path").count() == 1 and pg.locator(".sheet .row").count() == 3)
    pg.click(".sheet [data-x]"); W(200)
    pg.locator("[data-s]").first.click(); W(300)
    pg.click(".sheet [data-del]"); W(700)
    ok("delete a workout from history", len(db["state"]["sessions"]) == 2)

    # --- plan tab ---
    pg.click("nav [data-tab='plan']"); W(400)
    pg.click("[data-day='1']"); W(600)
    ok("plan: tapping Mon adds it as a gym day", 1 in db["state"]["days"])
    pg.click("[data-w='3']"); W(600)
    ok("plan: choose Lower B as next", db["state"]["next"] == 3)
    pg.click("nav [data-tab='today']"); W(300)
    ok("today follows the choice", pg.inner_text("#go").strip() == "Start Lower B")

    # --- cardio + bodyweight rows ---
    pg.click("#go"); W(600)
    pg.click("[data-open='back_ext']"); W(300)
    r = pg.locator(".set").nth(0); r.locator("input.k").fill("0"); r.locator("input.r").fill("12"); r.locator(".tick").click(); W(500)
    ok("bodyweight set (0 kg) accepted", any(s["e"] == "back_ext" and s["k"] == 0 for s in A()["sets"]))
    pg.click("[data-open='walk']"); W(300)
    ok("walk row asks for minutes, not kg", pg.locator(".set").count() == 1 and pg.locator(".set input.k").count() == 0 and "min" in pg.inner_text(".set"))
    pg.locator(".set .tick").click(); W(500)
    ok("walk logged in minutes", any(s["e"] == "walk" and s["r"] == 15 for s in A()["sets"]))
    pg.click("#discard"); W(600)
    ok("cancel workout discards it", db["state"]["active"] is None and len(db["state"]["sessions"]) == 2)

    # --- reload + phone width ---
    pg.reload(); W(900)
    ok("code remembered on reload", pg.is_visible("#app"))
    ok("no horizontal scroll at iPhone width", pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"))
    ok("no page errors", not errs, errs[:3])
    pg.screenshot(path="/tmp/lift_today.png", full_page=True)
    pg.click("#go"); W(600); pg.screenshot(path="/tmp/lift_workout.png", full_page=True)
    br.close()
srv.shutdown()
f = [n for n, c in res if not c]; print(f"\nE2E lift: PASS {len(res)-len(f)}  FAIL {len(f)}"); sys.exit(1 if f else 0)
