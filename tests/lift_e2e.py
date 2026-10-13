#!/usr/bin/env python3
"""Lift v2 e2e — real Chromium at iPhone size, backend mocked in-process (same contract as api/health-check?app=lift).
Usage: python3 tests/lift_e2e.py [path-to-lift-folder]   (needs: python3 -m playwright install chromium)"""
import json, threading, http.server, socketserver, sys, os, time
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "lift")
PORT = int(os.environ.get("PORT", "8142"))
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
    res.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n + ("" if c or extra == "" else "  — " + str(extra)[:300]))
D = 864e5
NOW = lambda: time.time() * 1000
def sess(id, w, wn, c, days_ago, sets):
    t = NOW() - days_ago * D
    return {"id": id, "w": w, "wn": wn, "c": c, "start": t, "end": t + 50 * 60000, "sets": [{"i": id + str(n), "e": e, "k": k, "r": r, "f": f, "t": t + n} for n, (e, k, r, f) in enumerate(sets)]}
CP, LP, SP = "Leverage_Chest_Press", "Wide-Grip_Lat_Pulldown", "Leverage_Shoulder_Press"
A = lambda: db["state"]["active"]
ST = lambda: db["state"]

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="en-GB")
    pg = ctx.new_page(); pg.route("**/api/health-check**", api)
    pg.route("**cdn.jsdelivr.net/**", lambda r: r.fulfill(status=200, body=b"", content_type="image/jpeg"))
    pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    W = lambda ms=450: pg.wait_for_timeout(ms)
    def tap(sel, ms=450):
        pg.locator(sel).first.evaluate("e=>e.scrollIntoView({block:'center'})"); pg.locator(sel).first.click(); W(ms)
    def confirm(): tap("[data-ok]")
    def noscroll(): return pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1")
    def log(k=None, r=None, ms=500):
        if k is not None: pg.fill("#in_k", str(k))
        if r is not None: pg.fill("#in_r", str(r))
        tap("#logSet", ms)

    # ================= gate + seed =================
    pg.goto(f"http://127.0.0.1:{PORT}/index.html"); W(700)
    ok("gate on first open", pg.is_visible("#gate"))
    pg.fill("#pin", "1111"); pg.click("#pinGo"); W()
    ok("wrong code refused", "wrong" in pg.inner_text("#pinErr"))
    pg.fill("#pin", "2026"); pg.click("#pinGo"); W(900)
    ok("opens with 2026", pg.is_visible("#app"))
    ok("v2 state seeded on server", ST() and ST()["ver"] == 2 and len(ST()["program"]) == 4 and ST()["days"] == [0, 2, 3, 6])
    ok("Today hero = Upper A", "Upper A" in pg.inner_text(".hero .wname"))
    ok("week strip has 7 days", pg.locator(".wk").count() == 7)
    ok("targets list: 7 exercises with pictures", pg.locator("#view .list").first.locator(".li").count() == 7 and pg.locator("#view .list .thumb").count() >= 7)
    ok("first time: weight exercises say 'test set'", pg.locator("text=test set").count() == 6)
    ok("start button", "Start Upper A" in pg.inner_text("#go"))
    ok("Today fits phone width", noscroll())

    # ================= coach player: first-time calibration =================
    tap("#go", 900)
    ok("player opens full screen", pg.is_visible("#player") and A() and A()["w"] == "ua")
    srcs = pg.eval_on_selector_all("#player .media img", "els=>els.map(e=>e.getAttribute('src'))")
    ok("animated start/finish pictures", len(srcs) == 2 and srcs[0].endswith("Leverage_Chest_Press/0.jpg") and srcs[1].endswith("/1.jpg"))
    ok("coach note: first-time test set", "First time" in pg.inner_text(".coachnote"))
    ok("first time: no warm-ups (weight unknown)", pg.locator(".set.wu").count() == 0)
    ok("3 working sets shown", pg.locator("#player .sets > .set").count() == 3)
    ok("player fits phone width", noscroll())
    pg.fill("#in_r", "12"); pg.fill("#in_k", ""); tap("#logSet")
    ok("logging without weight is blocked", "Enter the weight" in (pg.inner_text(".toast") if pg.locator(".toast").count() else "") and len(A()["sets"]) == 0)
    log(30, 12)
    ok("set 1 saved (30 × 12)", len(A()["sets"]) == 1 and A()["sets"][0]["k"] == 30 and A()["sets"][0]["r"] == 12)
    ok("feel question appears", pg.is_visible("#feel"))
    tap("[data-f='1']", 700)
    ok("feel 'Easy' saved on the set", A()["sets"][0]["f"] == 1)
    ok("rest plate opens with countdown", pg.is_visible("#rest") and ":" in pg.inner_text("#restT"))
    ok("rest shows next set: calibrated up to 35 kg", "35 kg" in pg.inner_text("#rest .nx"), pg.inner_text("#rest .nx"))
    t1 = pg.inner_text("#restT"); tap("#rPlus", 300); t2 = pg.inner_text("#restT")
    ok("+15s adds time", int(t2.split(":")[0]) * 60 + int(t2.split(":")[1]) > int(t1.split(":")[0]) * 60 + int(t1.split(":")[1]), (t1, t2))
    tap("#rSkip", 300)
    ok("skip closes rest", pg.is_hidden("#rest"))
    ok("set 2 pre-filled 35 kg", pg.input_value("#in_k") == "35")
    ok("coach note explains the change", "35" in pg.inner_text(".coachnote"))
    pg.locator("[data-st='k+']").click(); ok("+ steps 2.5 kg", pg.input_value("#in_k") == "37.5"); pg.locator("[data-st='k-']").click()
    log(None, 10); tap("[data-f='3']", 500); tap("#rSkip", 300)
    ok("hard but in range → same weight next", pg.input_value("#in_k") == "35")
    # edit + delete
    tap("[data-edit]")
    ok("edit sheet opens", pg.is_visible(".sheet"))
    pg.locator(".sheet #in_r").fill("11"); tap(".sheet #esS", 600)
    ok("edit saved (reps 12 → 11)", A()["sets"][0]["r"] == 11)
    tap("[data-edit] >> nth=1"); tap(".sheet #esD", 600)
    ok("delete set from edit sheet", len(A()["sets"]) == 1)
    log(35, 11); tap("[data-f='2']", 400); tap("#rSkip", 300)
    log(35, 10); tap("[data-f='2']", 800)
    ok("exercise done → rest says next exercise", "Next exercise" in pg.inner_text("#rest .nx") and "Lat pulldown" in pg.inner_text("#rest .nx"))
    tap("#rSkip", 300)
    ok("player moved to Lat pulldown", "Lat pulldown" in pg.inner_text("#player .exname"))
    ok("progress bar segment 1 full", pg.locator(".segs i b").first.get_attribute("style").find("100%") >= 0)
    # how-to, settings
    tap("#pHow"); ok("how-to steps", pg.locator("#player .how li").count() == 3)
    tap("#pNote"); pg.fill("#noteT", "Seat 3, thigh pad 2"); tap("#noteS", 600)
    ok("machine settings saved and shown", ST()["notes"].get(LP) == "Seat 3, thigh pad 2" and "Seat 3" in pg.inner_text("#player .setting"))
    # swap just today
    tap("#pSwap", 1500)
    ok("swap shows alternatives for the same muscles", pg.locator(".sheet [data-pick]").count() >= 5)
    first_alt = pg.locator(".sheet [data-pick]").first.get_attribute("data-pick")
    tap(".sheet [data-pick] >> nth=0", 700)
    ok("swapped for today only", A()["x"][1]["e"] == first_alt and ST()["program"][0]["x"][1]["e"] == LP, first_alt)
    ok("swap keeps sets and reps", A()["x"][1]["s"] == 3 and A()["x"][1]["lo"] == 10)
    # swap every time on the row
    tap("[data-go='2']", 400); tap("#pSwap", 1500); tap(".sheet [data-al='1']", 200)
    alts = [a for a in pg.locator(".sheet [data-pick]").evaluate_all("els=>els.map(e=>e.getAttribute('data-pick'))") if a not in [x["e"] for x in A()["x"]]]
    alt2 = alts[0]; tap(f".sheet [data-pick='{alt2}']", 2200)
    ok("swap 'every time' updates the program", ST()["program"][0]["x"][2]["e"] == alt2 and A()["x"][2]["e"] == alt2, (alt2, ST()["program"][0]["x"][2]["e"], A()["x"][2]["e"], pg.inner_text(".toast") if pg.locator(".toast").count() else ""))
    # add an exercise
    n0 = len(A()["x"]); tap("#player [data-add]", 1200); pg.fill("#pkq", "hip thrust"); W(400)
    ok("library search in picker", pg.locator(".sheet [data-pick]").count() >= 1)
    tap(".sheet [data-pick] >> nth=0", 700)
    ok("exercise added to today", len(A()["x"]) == n0 + 1 and "Hip_Thrust" in A()["x"][-1]["e"], A()["x"][-1]["e"])
    # minimise / resume
    tap("#pmin", 500)
    ok("minimise shows the mini player", pg.is_visible("#mini") and pg.is_hidden("#player"))
    tap("nav [data-tab='history']", 400); ok("tabs usable while minimised", "History" in pg.inner_text("#view h1"))
    tap("#mini", 600); ok("resume returns to the workout", pg.is_visible("#player"))
    # 409 merge
    other = json.loads(json.dumps(ST())); other["days"] = [0, 1, 3, 6]; db["v"] += 4; db["state"] = other
    tap("[data-go='1']", 400); log(30, 12, 1500)
    ok("409: other phone's change kept and my set kept", ST()["days"] == [0, 1, 3, 6] and any(s["e"] == first_alt for s in A()["sets"]))
    if pg.locator("#feel").count(): tap("[data-f='2']", 400)
    if pg.is_visible("#rest"): tap("#rSkip", 300)
    # offline
    ctx.set_offline(True); pg.evaluate("window.dispatchEvent(new Event('offline'))"); W(150)
    nset = len(A()["sets"]); log(30, 11, 500)
    ok("offline: set kept on phone, badge says so", pg.evaluate("pending.length") >= 1 and len(A()["sets"]) == nset)
    ctx.set_offline(False); pg.evaluate("pull()"); W(700)
    ok("re-sync doesn't drop the queued set", len(pg.evaluate("S.active.sets")) == nset + 1)
    pg.evaluate("window.dispatchEvent(new Event('online'))"); W(1300)
    ok("back online: set reaches server", pg.evaluate("pending.length") == 0 and len(A()["sets"]) == nset + 1)
    if pg.locator("#feel").count(): tap("[data-f='2']", 400)
    if pg.is_visible("#rest"): tap("#rSkip", 300)
    # reload mid workout
    pg.reload(); W(1200)
    ok("reopening the app returns to the workout", pg.is_visible("#player") and A() is not None)
    # finish
    tap("#pfin", 500); ok("partial finish asks first", pg.is_visible(".sheet [data-ok]")); confirm(); W(600)
    ok("session saved, rotation → Lower A", A() is None and len(ST()["sessions"]) == 1 and ST()["next"] == 1)
    ok("summary screen", pg.is_visible("#summary") and "Workout complete" in pg.inner_text("#summary"))
    tap("#sumX", 300)
    ok("Today now says Lower A", "Start Lower A" in pg.inner_text("#go"))
    ok("week strip marks today done", pg.locator(".wk.today .pl.done").count() == 1)

    # ================= progression with real history =================
    st = ST()
    st["sessions"] = [sess("h1", "ua", "Upper A", 0, 9, [(CP, 40, 10, 2), (CP, 40, 9, 2), (CP, 40, 9, 2), (SP, 20, 8, 3), (SP, 20, 7, 3)]),
                      sess("h2", "ua", "Upper A", 0, 4, [(CP, 40, 12, 2), (CP, 40, 12, 2), (CP, 40, 12, 1), (LP, 30, 11, 2), (LP, 30, 10, 2), (SP, 20, 8, 3), (SP, 20, 7, 3), ("Walking_Treadmill", 0, 15, 2)])]
    st["next"] = 0; st["program"] = None; db["v"] += 1
    pg.evaluate("localStorage.removeItem('lift_state')"); pg.reload(); W(1200)
    rows = {r.split("\n")[0]: r for r in pg.locator("#view .list").first.locator(".li").all_inner_texts()}
    ok("all sets at 12 → chest press 42.5 (+2.5 kg)", "42.5" in rows.get("Chest press machine", "") and "+2.5" in rows.get("Chest press machine", ""), rows.get("Chest press machine"))
    ok("short of the top → lat pulldown stays 30", "30" in rows.get("Lat pulldown", ""), rows.get("Lat pulldown"))
    ok("two tough sessions → shoulder press eases to 17.5", "17.5" in rows.get("Shoulder press machine", ""), rows.get("Shoulder press machine"))
    ok("walk: 15 → 17 min", "17" in rows.get("Incline walk", ""), rows.get("Incline walk"))
    ok("repaired a missing program on the server", isinstance(ST()["program"], list) and len(ST()["program"]) == 4)
    tap("#go", 900)
    ok("warm-ups planned for the first lift (W1, W2)", pg.locator(".set.wu").count() == 2)
    ok("warm-up 1 is half the working weight", pg.input_value("#in_k") in ("20", "22.5"), pg.input_value("#in_k"))
    log(None, None, 600)
    ok("warm-up logged without the feel question, short rest", pg.locator("#feel").count() == 0 and pg.is_visible("#rest") and A()["sets"][0].get("wu") == 1)
    tap("#rSkip", 300); tap("[data-sel='s0']", 300)
    ok("tapping a set skips the remaining warm-up", pg.input_value("#in_k") == "42.5")
    log(45, 10, 500)
    ok("🏆 heaviest-ever toast", pg.locator(".toast.gold").count() == 1 and "Heaviest ever" in pg.inner_text(".toast.gold"))
    tap("[data-f='2']", 300); tap("#rSkip", 300)
    tap("#pfin", 400); confirm(); W(700)
    ok("summary lists the new record", "New records" in pg.inner_text("#summary"))
    tap("#sumX", 300)

    # ================= history =================
    tap("nav [data-tab='history']", 600)
    ok("history: records + weeks", "Records" in pg.inner_text("#view") and "This week" in pg.inner_text("#view") and pg.locator("#view [data-s]").count() == 3)
    tap("#view [data-ex='Leverage_Chest_Press']", 900)
    ok("exercise page: best set, chart, sessions", "45 kg × 10" in pg.inner_text(".sheet") and pg.locator(".sheet svg.chart").count() == 1)
    tap(".sheet [data-x], .sheet", 200) if False else pg.keyboard.press("Escape")
    pg.evaluate("document.querySelectorAll('.sheet').forEach(s=>s.remove())")
    tap("#view [data-s] >> nth=-1", 500); tap(".sheet #delS", 400); confirm(); W(400)
    ok("delete a workout", len(ST()["sessions"]) == 2)
    ok("history fits width", noscroll())

    # ================= body =================
    tap("nav [data-tab='body']", 500)
    ok("body: empty state with actions", "Log your weight" in pg.inner_text("#view"))
    tap("#bW"); pg.fill("#bkg", "20"); tap("#bsave", 300)
    ok("silly weight refused", len(ST()["body"]) == 0)
    pg.fill("#bkg", "108.4"); tap("#bsave", 600)
    ok("weight saved", len(ST()["body"]) == 1 and ST()["body"][0]["kg"] == 108.4)
    tap("#bS"); pg.fill("#sk", "108"); pg.fill("#ssmm", "34.1"); pg.fill("#sbfm", "38.2"); pg.fill("#svf", "14"); tap("#ssave", 600)
    sc = [b for b in ST()["body"] if b["src"] == "scan"]
    ok("InBody scan saved, body fat % worked out (35.4)", sc and sc[0]["smm"] == 34.1 and sc[0]["bf"] == 35.4, sc)
    st = ST(); st["body"] += [{"id": "o%d" % i, "t": NOW() - (35 - i * 7) * D, "kg": k, "src": "weigh"} for i, k in enumerate([112.0, 111.2, 110.5, 109.8, 109.1])]; db["v"] += 1
    pg.evaluate("localStorage.removeItem('lift_state')"); pg.reload(); W(1000); tap("nav [data-tab='body']", 500)
    tap("#bGoal"); pg.fill("#gkg", "95"); tap("#gsave", 600)
    ok("goal saved", ST()["goal"]["kg"] == 95)
    t = pg.inner_text("#view")
    ok("goal date projected from the trend", "you reach 95 kg around" in t, t[:400])
    ok("chart drawn with goal line", pg.locator("#view svg.chart").count() == 1 and "goal" in pg.inner_html("#view svg.chart"))
    ok("measurement tiles", pg.locator("[data-bm]").count() >= 4)
    tap("[data-bm='smm']", 500); ok("tap a tile → that metric", "Muscle mass" in pg.inner_text("#view .panel"))
    tap("[data-br='1m']", 300); ok("range chips", pg.locator("[data-br='1m'].on").count() == 1)
    n = len(ST()["body"]); tap("#view [data-b] >> nth=0"); confirm(); W(400)
    ok("delete an entry", len(ST()["body"]) == n - 1)
    ok("body fits width", noscroll())

    # ================= library =================
    tap("nav [data-tab='library']", 1500)
    ok("library loads 870+ exercises", "873 exercises" in pg.inner_text("#liblist"))
    pg.fill("#libq", "leg press"); W(400)
    ok("search finds the leg press", pg.locator("#liblist [data-ex='Leg_Press']").count() == 1)
    pg.fill("#libq", ""); W(200); tap("[data-lm='0']", 500); tap("[data-le='0']", 600)
    t = pg.inner_text("#liblist").split("\n")[0]
    ok("chest + machine filter narrows the list", t.endswith("exercises") and 2 <= int(t.split()[0]) <= 20, t)
    pg.fill("#libq", "machine bench"); W(400)
    tap("#liblist [data-ex='Machine_Bench_Press']", 900)
    ok("detail: how-to steps", pg.locator(".sheet .how li").count() >= 2)
    tap(".sheet #exProg", 300); tap(".sheet [data-w='ub']", 600)
    ub = [w for w in ST()["program"] if w["id"] == "ub"][0]
    ok("add to Upper B, placed before the walk", ub["x"][-1]["kind"] == "c" and ub["x"][-2]["kind"] != "c" and len(ub["x"]) == 8)
    ok("library fits width", noscroll())

    # ================= plan + editor =================
    tap("nav [data-tab='plan']", 500)
    tap("[data-day='4']", 500); ok("Thursday added as a gym day", 4 in ST()["days"])
    tap("[data-w='1']", 700); tap(".sheet [data-open='0']", 300)
    tap(".sheet [data-ms='0:s:1']", 200); tap(".sheet [data-ms='0:rest:1']", 200)
    tap(".sheet [data-dn='0']", 200)
    tap(".sheet #edSave", 600)
    la = ST()["program"][1]
    ok("editor: sets 3→4, rest +15 s, moved down", la["x"][1]["e"] == "Leg_Press" and la["x"][1]["s"] == 4 and la["x"][1]["rest"] == 135, la["x"][:2])
    tap("#newW", 600); pg.fill(".sheet #wn", "Arms"); tap(".sheet #edSave", 300)
    ok("new workout needs an exercise", len(ST()["program"]) == 4)
    tap(".sheet #edAdd", 1200); pg.fill("#pkq", "preacher"); W(300); tap(".sheet [data-pick] >> nth=0", 400); tap(".sheet #edSave", 600)
    ok("new workout created in the rotation", len(ST()["program"]) == 5 and ST()["program"][4]["n"] == "Arms")
    tap("[data-w='4']", 600); tap(".sheet #edDel", 300); confirm(); W(400)
    ok("workout deleted", len(ST()["program"]) == 4)
    tap("#resetP", 300); confirm(); W(500)
    ok("reset restores the coach's program, history kept", ST()["program"][0]["x"][2]["e"] == "Seated_Cable_Rows" and len(ST()["sessions"]) == 2)
    ok("plan fits width", noscroll())

    # ================= migration from v1 =================
    db["state"] = {"items": [], "log": [], "days": [0, 2, 3, 6], "next": 1, "active": None,
                   "sessions": [{"id": "v1s", "w": "ua", "start": NOW() - 3 * D, "end": NOW() - 3 * D + 3e6, "sets": [{"i": "a", "e": "chest_press", "k": 40, "r": 12, "t": 1}, {"i": "b", "e": "chest_press", "k": 40, "r": 12, "t": 2}, {"i": "c", "e": "chest_press", "k": 40, "r": 12, "t": 3}]}]}
    db["v"] += 1; pg.evaluate("localStorage.clear()"); pg.reload(); W(500); pg.fill("#pin", "2026"); pg.click("#pinGo"); W(1200)
    ok("v1 data upgraded and saved as v2", ST()["ver"] == 2 and ST()["sessions"][0]["sets"][0]["e"] == CP and ST()["next"] == 1)
    tap("nav [data-tab='history']", 500)
    ok("v1 workouts appear in History", pg.locator("#view [data-s]").count() == 1)

    ok("no page errors", not errs, errs[:3])
    br.close()
srv.shutdown()
f = [n for n, c in res if not c]; print(f"\nE2E lift: PASS {len(res)-len(f)}  FAIL {len(f)}"); sys.exit(1 if f else 0)
