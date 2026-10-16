#!/usr/bin/env python3
"""Lift v4 e2e — real Chromium at iPhone size. Backend, exercise animations and exercise steps are mocked in-process
(same contract as api/health-check?app=lift and the ExerciseDB endpoints the app calls).
Usage: python3 tests/lift_e2e.py [path-to-lift-folder]   (needs: python3 -m playwright install chromium)"""
import json, threading, http.server, socketserver, sys, os, time, copy, datetime
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "lift")
PORT = int(os.environ.get("PORT", "8144"))
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Q); threading.Thread(target=srv.serve_forever, daemon=True).start()

D = 864e5
NOW = lambda: time.time() * 1000
# a v2 state shaped exactly like the live one (one routine of old-library ids, every day a gym day)
V2 = {"ver": 2, "days": [0, 1, 2, 3, 4, 5, 6], "next": 0, "active": None, "sessions": [], "notes": {"Leg_Press": "Seat 5"}, "body": [], "goal": {}, "custom": {},
      "program": [{"id": "w3x", "n": "Arms & Shoulders & Chest & Abs", "c": 1, "x": [
          {"e": "Leg_Press", "n": "Leg press", "kind": "w", "step": 5, "s": 3, "lo": 10, "hi": 12, "rest": 90},
          {"e": "Leverage_Chest_Press", "n": "Chest press machine", "kind": "w", "step": 2.5, "s": 3, "lo": 10, "hi": 12, "rest": 90},
          {"e": "Wide-Grip_Lat_Pulldown", "n": "Lat pulldown", "kind": "w", "step": 2.5, "s": 3, "lo": 10, "hi": 12, "rest": 90},
          {"e": "Seated_Leg_Curl", "n": "Seated leg curl", "kind": "w", "step": 2.5, "s": 3, "lo": 10, "hi": 12, "rest": 90},
          {"e": "Seated_Side_Lateral_Raise", "n": "Seated Side Lateral Raise", "kind": "w", "step": 2, "s": 3, "lo": 10, "hi": 12, "rest": 90}]}]}
db = {"v": 54, "state": copy.deepcopy(V2)}
calls = {"steps": 0, "gif": 0, "old": 0}; step_ids = set()
def api(route):
    b = json.loads(route.request.post_data or "{}")
    if b.get("pin") != "2026": return route.fulfill(status=401, body='{"error":"pin"}', content_type="application/json")
    if b["action"] == "state": return route.fulfill(status=200, body=json.dumps({**db, "role": "full"}), content_type="application/json")
    if b["action"] == "save":
        if b.get("v") != db["v"]: return route.fulfill(status=409, body=json.dumps({"conflict": True, **db}), content_type="application/json")
        db["v"] += 1; db["state"] = b["state"]; return route.fulfill(status=200, body=json.dumps({"v": db["v"]}), content_type="application/json")
    route.fulfill(status=400, body='{"error":"unknown"}', content_type="application/json")
GIF1 = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
BROKEN = "oHsrypV"  # this animation "fails to load" → the body-figure fallback must show
def gif(route):
    calls["gif"] += 1
    if BROKEN in route.request.url: return route.fulfill(status=404, body=b"")
    route.fulfill(status=200, body=GIF1, content_type="image/gif")
def steps(route):
    calls["steps"] += 1
    eid = route.request.url.rstrip("/").split("/")[-1]; step_ids.add(eid)
    route.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"},
                  body=json.dumps({"success": True, "data": {"exerciseId": eid, "instructions": ["Step:1 Sit on the machine with your back flat.", "Step:2 Push slowly, then lower under control."]}}))
def old(route):
    calls["old"] += 1; route.fulfill(status=404, body=b"")

res = []
def ok(n, c, extra=""):
    res.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n + ("" if c or extra == "" else "  — " + str(extra)[:300]))
A = lambda: db["state"]["active"]
ST = lambda: db["state"]
def sess(id, w, wn, c, start, sets, mins=50):
    return {"id": id, "w": w, "wn": wn, "c": c, "start": start, "end": start + mins * 60000,
            "sets": [{"i": id + str(n), "e": e, "k": k, "r": r, "f": f, "t": start + n * 120000} for n, (e, k, r, f) in enumerate(sets)]}
def day_start(ms):
    d = datetime.datetime.fromtimestamp(ms / 1000); return datetime.datetime(d.year, d.month, d.day).timestamp() * 1000

with sync_playwright() as p:
    br = p.chromium.launch()
    # service worker off here so every request hits the mocks (the offline worker is tested on its own at the end)
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="en-GB", service_workers="block")
    pg = ctx.new_page(); pg.route("**/api/health-check**", api)
    pg.route("**/static.exercisedb.dev/**", gif)
    pg.route("**/oss.exercisedb.dev/**", steps)
    pg.route("**cdn.jsdelivr.net/**", old); pg.route("**raw.githubusercontent.com/**", old)
    pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    dialogs = []; pg.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    W = lambda ms=400: pg.wait_for_timeout(ms)
    def tap(sel, ms=400):
        el = pg.locator(sel).first; el.evaluate("e=>e.scrollIntoView({block:'center'})"); el.click(); W(ms)
    def tap2(sel, ms=500):  # armed buttons: first tap asks, second tap does it
        tap(sel, 150); tap(sel, ms)
    def txt(sel): return pg.inner_text(sel).replace("\u202f", " ").replace("\xa0", " ")
    def title(): return pg.inner_text(".hdr .ttl").split("\n")[0] if pg.locator(".hdr").count() else ("ROOT:" + pg.inner_text(".root-top h1"))
    def noscroll(): return pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1")
    def back_reachable():
        pg.evaluate("window.scrollTo(0,99999)"); W(100)
        r = pg.locator(".hdr .back").bounding_box()
        top = pg.evaluate("(()=>{const b=document.querySelector('.hdr .back').getBoundingClientRect();const e=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return e&&e.closest('.back')?1:0})()")
        return r and r["y"] >= 0 and r["y"] < 120 and top == 1
    def log(f, k=None, r=None, ms=500):
        if k is not None: pg.fill("#in_k", str(k))
        if r is not None: pg.fill("#in_r", str(r))
        tap(f"[data-a='log'][data-f='{f}']", ms)
    def fresh(state=None, ms=1500):  # server changed elsewhere → reopen the app on it
        if state is not None: db["state"] = state; db["v"] += 1
        pg.evaluate("localStorage.removeItem('lift_state');localStorage.removeItem('lift_ui');localStorage.removeItem('lift_pending')"); pg.reload(); W(ms)
    def prog(name): return [w for w in ST()["program"] if w["n"] == name]
    def visible_in_viewport(sel):
        b = pg.locator(sel).first.bounding_box(); return b and b["y"] >= 0 and b["y"] + b["height"] <= 844

    # ================= gate + his data carried over =================
    pg.goto(f"http://127.0.0.1:{PORT}/index.html"); W(800)
    ok("gate on first open", pg.is_visible("#gate"))
    pg.fill("#pin", "1111"); pg.click("#pinGo"); W()
    ok("wrong code refused", "wrong" in pg.inner_text("#pinErr"))
    pg.fill("#pin", "2026"); pg.click("#pinGo"); W(1800)
    st = ST(); x = st["program"][0]["x"]
    ok("opens with 2026; his v2 data upgraded and saved back", pg.is_visible("#app") and st["ver"] == 3 and db["v"] == 55)
    ok("his routine kept: name, 5 exercises, all 7 days", st["program"][0]["n"] == "Arms & Shoulders & Chest & Abs" and len(x) == 5 and st["days"] == [0, 1, 2, 3, 4, 5, 6])
    ok("every exercise moved to the illustrated library", [i["e"] for i in x] == ["10Z2DXU", "DOoWcnA", "eYnzaCm", "Zg3XY7P", "hrrS0Ed"], [i["e"] for i in x])
    ok("names come from the new library", x[0]["n"] == "Sled 45° leg press" and x[1]["n"] == "Machine chest press", [i["n"] for i in x])
    ok("sets/reps/rest kept", all(i["s"] == 3 and i["lo"] == 10 and i["hi"] == 12 and i["rest"] == 90 for i in x))
    ok("machine notes carried to the new ids", st["notes"].get("10Z2DXU") == "Seat 5", st["notes"])

    # ================= Today =================
    ok("4 tabs: Today, Routines, Log, Body", pg.locator("nav.tabs button").all_inner_texts() == ["Today", "Routines", "Log", "Body"], pg.locator("nav.tabs button").all_inner_texts())
    ok("hero shows his routine + one Start button", "Arms & Shoulders" in pg.inner_text(".hero .w") and pg.locator("#go").count() == 1)
    ok("long routine name gets the smaller size", pg.locator(".hero .w.xs").count() == 1)
    ok("hero body figure lights the muscles", pg.locator(".hero svg.bmap use[fill='#E2453C']").count() >= 5)
    ok("time estimate on the hero", "min" in pg.inner_text(".hero .m"))
    ok("this week: 0 of 7", "0 of 7" in pg.inner_text(".wkline"))
    ok("no 'missed' days before he ever trained", pg.locator(".pl.miss").count() == 0)
    rows = pg.locator(".row[data-a='exinfo']")
    ok("5 exercise rows, each with an animation", rows.count() == 5 and pg.locator(".row[data-a='exinfo'] .gif img[src*='static.exercisedb.dev/media/']").count() == 5)
    ok("rows say 'new' (no history yet)", pg.locator(".row .end >> text=new").count() == 5)
    ok("'Add your weight' row (for calories)", pg.locator("[data-p='entry']").count() == 1)
    ok("no rule banner without history", pg.locator(".banner").count() == 0)
    W(600); ok("animations actually load", pg.evaluate("[...document.querySelectorAll('.row .gif img')].filter(i=>i.complete&&i.naturalWidth>0).length") >= 3)
    ok("Today fits iPhone width", noscroll())

    # ================= search: gym names find the right thing =================
    tap("nav [data-tab='routines']", 500)
    ok("library row shows 1,285 exercises", "1,285 exercises" in pg.inner_text("#view"))
    tap("[data-p='library']", 1500)
    ok("library opens with Back", title() == "Exercise library" and back_reachable())
    ok("browse starts with common machines", "Machine" in pg.locator("#liblist .row .t").first.inner_text() or "Sled" in pg.locator("#liblist .row .t").first.inner_text())
    cases = [("lever seated hip adduction", "Machine seated hip adduction", 1), ("face pull", "Cable rear delt row (with rope)", 2), ("pec deck", "Machine seated fly", 1),
             ("hip thrust", "Barbell glute bridge two-leg on bench", 1), ("rdl", "Barbell romanian deadlift", 1), ("pullups", "Pull-up", 3), ("stairmaster", "Walking on stepmill", 1),
             ("inner thigh", "Machine seated hip adduction", 1), ("bench press", "Barbell bench press", 1), ("lat pull down", "Cable bar lateral pulldown", 1),
             ("45 leg press", "Sled 45° leg press", 1), ("lunges", "Barbell lunge", 3), ("skull crushers", "Barbell lying triceps extension skull crusher", 1),
             ("dips", "Chest dip", 2), ("incline walk", "Walking on incline treadmill", 1), ("battle ropes", "Battling ropes", 1), ("farmers carry", "Farmers walk", 1)]
    bad = []
    for q, want, top in cases:
        got = pg.evaluate("q=>searchLib(q,null,null).full.slice(0,%d).map(r=>r[1])" % top, q)
        if want not in got: bad.append((q, got))
    ok(f"{len(cases)} gym-name searches find the right exercise", not bad, bad)
    close = pg.evaluate("searchLib('cable one arm side triceps pushdown',null,null)")
    ok("near-miss search offers close matches", close["close"] and close["close"][0][1] == "Cable single-arm triceps pushdown", close["close"][:2])
    pg.fill("#libq", "seated hip adduction"); W(500)
    ok("typing searches the list", "Machine seated hip adduction" in pg.locator("#liblist .row .t").first.inner_text())
    pg.fill("#libq", "zzqqx"); W(400)
    ok("no match → 'Can't find it? Create'", pg.locator("#liblist [data-p='custom']").count() == 1 and "zzqqx" in pg.inner_text("#liblist"))
    pg.fill("#libq", ""); W(400)
    tap("[data-a='lg'][data-g='0']", 400); n_chest = int(pg.inner_text("#liblist .mute.small").split()[0].replace(",", ""))
    ok("Chest filter", 100 < n_chest < 400 and "Chest" in pg.locator("#liblist .row .s").first.inner_text(), n_chest)
    tap("[data-a='leq'][data-q='0']", 400); n_cm = int(pg.inner_text("#liblist .mute.small").split()[0].replace(",", ""))
    ok("Chest + Machine filter narrows it", 3 < n_cm < n_chest and "Machine" in pg.locator("#liblist .row .s").first.inner_text(), n_cm)
    tap("[data-a='lg'][data-g='4']", 400)
    ok("Legs includes the leg press", pg.evaluate("searchLib('',4,0).full.some(r=>r[1]==='Sled 45° leg press')"))
    tap("[data-a='lg'][data-g='']", 300); tap("[data-a='leq'][data-q='']", 300)
    n0 = pg.locator("#liblist .row").count(); tap("[data-a='libmore']", 400)
    ok("Show more adds 40", pg.locator("#liblist .row").count() == n0 + 40)
    pg.fill("#libq", "machine seated hip adduction"); W(400)
    tap(f"#liblist [data-a='exinfo'][data-e='{BROKEN}']", 900)
    ok("animation that fails → body figure instead (never a broken image)", pg.locator(".gif.xl.none svg.bmap").count() == 1)
    tap(".hdr .back", 300)
    pg.fill("#libq", "machine chest press"); W(400)
    tap("#liblist [data-a='exinfo'][data-e='DOoWcnA']", 1200)
    ok("exercise page: big animation, muscles, equipment", pg.locator(".gif.xl img").count() == 1 and "Chest" in pg.inner_text(".facts") and "Machine" in pg.inner_text(".facts"))
    ok("exercise page: body figure with Main/Helps legend", pg.locator(".mapcard svg.bmap use[fill='#E2453C']").count() >= 1 and "Helps" in pg.inner_text(".legend"))
    ok("how-to steps loaded, 'Step:1' prefix cleaned", pg.locator(".how li").count() == 2 and "Step:" not in pg.inner_text(".how"), pg.inner_text("#view")[-400:])
    ok("Back reachable on the exercise page", back_reachable())
    tap("[data-p='addto']", 400); ok("'Add to which routine?' page", "Add to which routine" in title())
    ok("routine that already has it is greyed out", pg.locator("[data-a='addtoprog'][disabled]").count() == 1)
    tap(".hdr .back", 300); tap(".hdr .back", 300)
    pg.fill("#libq", "hip abduction"); W(400)
    tap("#liblist [data-a='exinfo'][data-e='CHpahtl']", 900); tap("[data-p='addto']", 400); tap("[data-a='addtoprog'][data-w='w3x']", 700)
    ok("added to his routine (at the end)", ST()["program"][0]["x"][-1]["e"] == "CHpahtl" and len(ST()["program"][0]["x"]) == 6)
    tap(".hdr .back", 300); tap(".hdr .back", 300); ok("Back, Back → Routines", title() == "ROOT:Routines")

    # ================= routine page =================
    tap(".rcard .rtop >> nth=0", 900)
    ok("routine page: minutes, calories, exercises, next day", all(s in pg.inner_text(".stat4") for s in ["Minutes", "Calories", "Exercises", "Next day"]))
    ok("routine page: Start button + exercise list", pg.locator("[data-a='start']").count() == 1 and pg.locator(".row[data-a='exinfo']").count() == 6)
    ok("routine page: 'Muscles worked' figure + names", pg.locator(".mapcard svg.bmap.big").count() == 1 and pg.locator(".mchips .pill").count() >= 4)
    ok("routine page: Back reachable, fits width", back_reachable() and noscroll())
    tap(".hdr .back", 300)

    # ================= build my own routine: only what I pick =================
    n_prog = len(ST()["program"])
    tap("[data-a='newroutine']", 700)
    ok("New routine → straight to its page, name box ready", pg.locator("#wname").count() == 1 and pg.evaluate("document.activeElement&&document.activeElement.id") == "wname")
    pg.fill("#wname", "Push day"); W(900)
    ok("name saves as you type", len(prog("Push day")) == 1 and prog("Push day")[0]["x"] == [])
    tap("[data-p='library'][data-mode='pick']", 1200)
    ok("picker titled 'Add to Push day', nothing pre-picked", "Add to Push day" in title() and pg.locator(".pickbar.hidden").count() == 1 and pg.locator(".lrow.on").count() == 0)
    pg.fill("#libq", "machine chest press"); W(400); tap("#liblist [data-a='pick'][data-e='DOoWcnA']", 150)
    pg.fill("#libq", "cable pushdown rope"); W(400); rope = pg.locator("#liblist [data-a='pick']").first.get_attribute("data-e"); tap("#liblist [data-a='pick'] >> nth=0", 150)
    pg.fill("#libq", "dumbbell lateral raise"); W(400); tap("#liblist [data-a='pick'] >> nth=0", 150)
    ok("3 ticked → 'Add 3 exercises'", "Add 3 exercises" in pg.inner_text(".pickbar") and pg.locator(".lrow.on").count() == 1)
    tap("#liblist [data-a='pick'] >> nth=0", 150); ok("tap again un-ticks", "Add 2 exercises" in pg.inner_text(".pickbar"))
    tap("#liblist .linfo >> nth=0", 900); ok("eye button shows how it's done without un-ticking", title() != "" and pg.locator(".gif.xl").count() == 1)
    tap(".hdr .back", 400); ok("back on the picker, picks kept", "Add 2 exercises" in pg.inner_text(".pickbar"))
    pg.fill("#libq", "hip thrust machine xyz"); W(400)
    tap("#liblist [data-p='custom']", 500)
    ok("create-your-own page, name filled in", title() == "New exercise" and pg.input_value("#cname") == "Hip thrust machine xyz" and back_reachable())
    pg.fill("#cname", "Hip thrust machine"); tap("[data-a='cg'][data-v='5']", 200); tap("[data-a='ceq'][data-v='0']", 200); tap("[data-a='ck'][data-v='w']", 200)
    tap("[data-a='savecustom']", 700)
    cx = [k for k in ST()["custom"] if ST()["custom"][k]["n"] == "Hip thrust machine"]
    ok("custom exercise saved (Glutes, Machine, kg+reps) and ticked", len(cx) == 1 and ST()["custom"][cx[0]]["t"] == ["glutes"] and "Add 3 exercises" in pg.inner_text(".pickbar"), ST()["custom"])
    tap(".pickbar", 800)
    pd = prog("Push day")[0]
    ok("routine has EXACTLY my 3 picks, in order — nothing auto-added", [i["e"] for i in pd["x"]] == ["DOoWcnA", rope, cx[0]], [i["e"] for i in pd["x"]])
    ok("back on the routine page with 3 rows", pg.locator(".edrow").count() == 3 and pg.locator("#wname").count() == 1)
    ok("rows calm until opened", pg.locator("[data-a='edstep']").count() == 0)
    tap("[data-a='edopen'][data-i='0']", 300)
    ok("open a row → Sets / Reps / Rest with labels", pg.locator(".mstp").count() == 3 and "Rest (seconds)" in pg.inner_text(".edctl"))
    tap("[data-a='edstep'][data-i='0'][data-f='s'][data-d='1']", 400); ok("+ set → 4", prog("Push day")[0]["x"][0]["s"] == 4)
    tap("[data-a='edstep'][data-i='0'][data-f='hi'][data-d='1']", 400); x0 = prog("Push day")[0]["x"][0]
    ok("+ rep → 13 (range 11–13)", x0["hi"] == 13 and x0["lo"] == 11, x0)
    tap("[data-a='edstep'][data-i='0'][data-f='rest'][data-d='-1']", 400); ok("− rest → 75 s", prog("Push day")[0]["x"][0]["rest"] == 75)
    for _ in range(4): tap("[data-a='edstep'][data-i='0'][data-f='s'][data-d='-1']", 250)
    ok("sets never go below 1", prog("Push day")[0]["x"][0]["s"] == 1)
    ok("shows on screen too", "1" in pg.locator(".mstp b").first.inner_text())
    tap("[data-a='movedn'][data-i='0']", 400); ok("Down", prog("Push day")[0]["x"][1]["e"] == "DOoWcnA")
    tap("[data-a='moveup'][data-i='1']", 400); ok("Up", prog("Push day")[0]["x"][0]["e"] == "DOoWcnA")
    tap("[data-a='edopen'][data-i='2']", 300); tap("[data-a='rmex'][data-i='2']", 400)
    ok("Remove", len(prog("Push day")[0]["x"]) == 2)
    tap("[data-a='wcolor'][data-c='3']", 400); ok("colour", prog("Push day")[0]["c"] == 3)
    tap("[data-p='library'][data-mode='pick']", 1000); pg.fill("#libq", "treadmill"); W(400); tap("#liblist [data-a='pick'] >> nth=0", 150); tap(".pickbar", 700)
    tap("[data-a='edopen'][data-i='2']", 300)
    ok("cardio row has one Minutes control", pg.locator(".mstp").count() == 1 and "Minutes" in pg.inner_text(".edctl"))
    tap("[data-a='edstep'][data-i='2'][data-f='hi'][data-d='1']", 400); ok("+ minutes → 25", prog("Push day")[0]["x"][2]["hi"] == 25)
    tap("[data-a='back'] >> nth=-1", 500); ok("Done → Routines, 'Push day' listed", title() == "ROOT:Routines" and "Push day" in pg.inner_text("#view"))
    tap("[data-a='newroutine']", 600); tap(".hdr .back", 600)
    ok("leaving an empty new routine creates nothing", len(ST()["program"]) == n_prog + 1)
    tap(".rcard:has-text('Push day') .rtop", 800); tap("[data-p='editor']", 600)
    ok("Edit opens the same builder", pg.input_value("#wname") == "Push day")
    tap2("[data-a='delroutine']", 700)
    ok("delete routine (tap twice)", len(prog("Push day")) == 0 and title() == "ROOT:Routines")

    # ================= ready-made: 5-day full body =================
    tap("[data-p='template'][data-id='fb5']", 900)
    ok("5-day program page: 5 routines, 5 days", pg.locator(".rcard").count() == 5 and pg.locator(".pills .pill").count() == 5 and back_reachable())
    ok("each routine shows its body figure", pg.locator(".rcard svg.bmap").count() == 5)
    tap("[data-a='addtpl']", 700); ok("'Add these to my routines' appends 5", len(ST()["program"]) == 6 and title() == "ROOT:Routines")
    tap("[data-p='template'][data-id='fb5']", 900)
    tap("[data-a='usetpl']", 150); ok("'Use this program' asks first (button text)", "Tap again" in pg.inner_text("[data-a='usetpl']") and len(ST()["program"]) == 6)
    tap("[data-a='usetpl']", 900)
    ok("program replaced: Full Body 1–5", [w["n"] for w in ST()["program"]] == ["Full Body 1", "Full Body 2", "Full Body 3 (light)", "Full Body 4", "Full Body 5"])
    ok("gym days Sun Mon Wed Thu Sat, rotation reset", ST()["days"] == [0, 1, 3, 4, 6] and ST()["next"] == 0)
    ok("Plan check: never two rest days in a row", "never two rest days in a row" in pg.inner_text(".okline"))
    tap("[data-a='day'][data-d='1']", 500)
    ok("drop Monday → warns Mon+Tue are two rest days", "Mon and Tue" in pg.inner_text(".warnline") and ST()["days"] == [0, 3, 4, 6])
    tap("[data-a='day'][data-d='1']", 500); ok("add it back → OK again", pg.locator(".okline").count() == 1 and ST()["days"] == [0, 1, 3, 4, 6])
    ok("Routines fits width", noscroll())

    # ================= workout at the gym =================
    tap("nav [data-tab='today']", 600)
    ok("Today: Full Body 1 is up", "Full Body 1" in pg.inner_text(".hero .w"))
    t0 = NOW(); tap("#go", 1200)
    ok("Start logs the start time", A() is not None and abs(A()["start"] - t0) < 5000 and A()["wn"] == "Full Body 1")
    ok("workout page: tabs hidden, header shows start time + clock", title() == "Full Body 1" and pg.is_hidden("nav.tabs") and "Started" in pg.inner_text(".hdr .ttl .s") and pg.locator("#elapsed").count() == 1)
    ok("big animation on top", pg.locator(".herogif .gif.xl img[src*='10Z2DXU.gif']").count() == 1)
    ok("muscles under the name (Glutes + Quads…)", "Glutes" in pg.inner_text(".exm .mp") and "Quads" in pg.inner_text(".exm"))
    ok("Easy/Good/Hard visible without scrolling", visible_in_viewport("[data-a='log'][data-f='3']"), pg.locator("[data-a='log'][data-f='3']").bounding_box())
    ok("first time: 'go light' tag, weight empty", pg.locator(".tagnew").count() == 1 and pg.input_value("#in_k") == "")
    ok("machine note shows on the exercise", "Seat 5" in pg.inner_text(".pill2"))
    log(2, None, 12)
    ok("can't save a set without a weight (message, no pop-up)", len(A()["sets"]) == 0 and "weight" in pg.inner_text(".toast") and not dialogs)
    log(2, 60, 12)
    ok("one tap saves the set with its feel", len(A()["sets"]) == 1 and A()["sets"][0]["k"] == 60 and A()["sets"][0]["f"] == 2 and A()["sets"][0]["t"] >= A()["start"])
    ok("rest band inline with what's next", pg.is_visible("#restB") and "60 kg × 12" in pg.inner_text("#restB"))
    # iPhone freezes or closes a minimized web app: the rest timer is a saved wall-clock end time, so it comes back right
    secs = lambda t: (lambda p: int(p[0]) * 60 + int(p[1]))(t.strip().split(":"))
    r1 = secs(pg.inner_text("#restT")); pg.reload(); pg.wait_for_timeout(1800)
    r2 = secs(pg.inner_text("#restT")) if pg.locator("#restT").count() else -1
    ok("rest timer survives iPhone closing the page", pg.locator("#restB").count() == 1 and r1 - 6 <= r2 <= r1, (r1, r2))
    pg.evaluate("(()=>{var k=Object.keys(localStorage).find(x=>x.endsWith('rest'));var r=JSON.parse(localStorage[k]);r.end=Date.now()-1500;localStorage[k]=JSON.stringify(r);})()"); pg.reload(); pg.wait_for_timeout(1500)
    ok("rest that ended while minimized shows 'Go' on return", pg.locator("#restB").count() == 1 and "Go" in pg.inner_text("#restT") and "next set" in pg.inner_text("#restB"))
    pg.wait_for_timeout(3500); ok("…then clears itself", pg.locator("#restB").count() == 0)
    pg.evaluate("(()=>{var k=Object.keys(localStorage).find(x=>x.endsWith('rest'));localStorage.setItem(k||'lift_rest',JSON.stringify({end:Date.now()+40000,total:90,next:'',beeped:false}));})()"); pg.reload(); pg.wait_for_timeout(1500)
    ok("back after ~50 s away: band shows ~40 s left, not 90", pg.locator("#restT").count() == 1 and 35 <= secs(pg.inner_text("#restT")) <= 41, pg.inner_text("#restT") if pg.locator("#restT").count() else None)
    tap("#restB", 300); ok("tap the band to skip rest", pg.locator("#restB").count() == 0)
    tap("[data-a='step'][data-f='k+']", 150); ok("+ adds 5 kg on a sled machine", pg.input_value("#in_k") == "65")
    log(1, None, 12, 700)
    ok("Easy at the top → coach jumps two steps (75)", len(A()["sets"]) == 2 and pg.input_value("#in_k") == "75")
    ok("heaviest-ever toast", pg.locator(".toast.gold").count() == 1)
    tap("[data-a='editset'] >> nth=0", 300); ok("tap a done set to fix it", pg.locator("[data-a='saveset']").count() == 1)
    pg.fill("#in_r", "11"); tap("[data-a='saveset']", 500); ok("fixed", A()["sets"][0]["r"] == 11)
    tap("[data-a='editset'] >> nth=1", 300); tap2("[data-a='delset']", 500); ok("delete a set (tap twice)", len(A()["sets"]) == 1)
    tap("[data-a='how']", 900); ok("tap the picture → steps", pg.locator(".how li").count() == 2)
    tap("[data-a='how']", 300); ok("tap again hides them", pg.locator(".how").count() == 0)
    tap("[data-a='editnote']", 300); pg.fill("#noteIn", "Seat 4, feet high"); tap("[data-a='savenote']", 500)
    ok("seat settings saved", ST()["notes"].get("10Z2DXU") == "Seat 4, feet high")
    tap("[data-a='exlist']", 400)
    ok("exercise list shows when each one started", "started" in pg.locator("[data-a='goex']").first.inner_text() and pg.locator("[data-a='goex']").count() == 7)
    tap("[data-a='goex'] >> nth=1", 400); ok("jump to exercise 2", "Machine chest press" in pg.inner_text(".exname"))
    tap("[data-a='swap']", 1200)
    ok("Change exercise page with alternatives", title() == "Change exercise" and pg.locator("[data-a='doswap']").count() >= 5 and back_reachable())
    alt = pg.locator("[data-a='doswap']").first.get_attribute("data-e"); tap("[data-a='doswap'] >> nth=0", 700)
    ok("changed for today only", A()["x"][1]["e"] == alt and ST()["program"][0]["x"][1]["e"] == "DOoWcnA" and title() == "Full Body 1")
    tap("[data-a='exlist']", 300); tap("[data-a='addtoday']", 1200); pg.fill("#libq", "hip abduction"); W(500)
    tap("#liblist [data-a='addtoday'] >> nth=0", 800)
    ok("added an exercise to today and jumped to it", A()["x"][-1]["e"] == "CHpahtl" and "hip abduction" in pg.inner_text(".exname").lower(), A()["x"][-1])
    tap(".hdr .back", 500)
    ok("Back leaves it running; Today offers Continue", pg.is_visible("[data-a='resume']") and pg.is_visible("nav.tabs") and "in progress" in pg.inner_text(".hero").lower())
    tap("[data-a='resume']", 500); ok("Continue → same exercise", "hip abduction" in pg.inner_text(".exname").lower())
    other = copy.deepcopy(ST()); other["days"] = [0, 1, 2, 3, 4, 6]; db["v"] += 4; db["state"] = other
    log(2, 30, 15, 1500)
    ok("409: the other phone's change + my set both kept", ST()["days"] == [0, 1, 2, 3, 4, 6] and any(s["e"] == "CHpahtl" for s in A()["sets"]))
    ctx.set_offline(True); pg.evaluate("window.dispatchEvent(new Event('offline'))"); W(150)
    tap("#restB", 200) if pg.locator("#restB").count() else None
    n = len(A()["sets"]); log(2, 30, 14, 500)
    ok("offline: set kept on the phone, not lost", pg.evaluate("pending.length") >= 1 and len(A()["sets"]) == n and pg.evaluate("S.active.sets.length") == n + 1)
    ctx.set_offline(False); pg.evaluate("window.dispatchEvent(new Event('online'))"); W(1500)
    ok("back online: set reaches the server", pg.evaluate("pending.length") == 0 and len(A()["sets"]) == n + 1)
    pg.reload(); W(1500)
    ok("reopening the app goes straight back into the workout", title() == "Full Body 1" and A() is not None)
    tap("[data-a='finish']", 500)
    ok("finish page: Started / Now / Time + sets, kg, kcal", title() == "Finish workout" and all(s in pg.inner_text(".times") for s in ["Started", "Now", "Time"]) and "lifted" in pg.inner_text(".stats"))
    tap("[data-a='back'] >> nth=1", 300); ok("Back to workout works", title() == "Full Body 1")
    tap("[data-a='finish']", 400); t1 = NOW(); tap("[data-a='save']", 900)
    s0 = ST()["sessions"][0] if ST()["sessions"] else {}
    ok("saved with start + finish time, rotation → Full Body 2", A() is None and len(ST()["sessions"]) == 1 and abs(s0.get("end", 0) - t1) < 5000 and s0.get("start") and ST()["next"] == 1)
    ok("saved screen: Started / Finished / Time", "Saved to your log" in pg.inner_text("#view") and "Finished" in pg.inner_text(".times"))
    ok("no weight yet → 'Add your weight to see calories'", pg.locator(".linkb.kh").count() == 1)
    tap("[data-a='home']", 500); ok("Done → Today shows Full Body 2", "Full Body 2" in pg.inner_text(".hero .w"))
    ok("week strip ticks today", pg.locator(".wk.today .pl.done").count() == 1)

    # ================= body weight → calories =================
    tap("nav [data-tab='body']", 400)
    ok("body empty state, one button", "Add your weight" in pg.inner_text("#view") and pg.locator("[data-p='entry']").count() == 1)
    tap("[data-p='entry']", 400); ok("add weight page with Back", title() == "Add weight" and back_reachable())
    pg.fill("#ekg", "20"); tap("[data-a='saveentry']", 300); ok("silly weight refused", len(ST()["body"]) == 0)
    pg.fill("#ekg", "108"); pg.fill("#esmm", "34.1"); pg.fill("#ebfm", "38.2"); tap("[data-a='saveentry']", 700)
    b0 = ST()["body"][0] if ST()["body"] else {}
    ok("weight + InBody saved in one go, fat % worked out", b0.get("kg") == 108 and b0.get("smm") == 34.1 and b0.get("bf") == 35.4 and b0.get("src") == "scan", b0)
    tap("nav [data-tab='today']", 500)
    ok("Today now shows calories for the routine", "kcal" in pg.inner_text(".hero .m") and pg.locator("[data-p='entry']").count() == 0)

    # ================= gym log =================
    tap("nav [data-tab='log']", 600)
    tiles = pg.inner_text(".tiles")
    ok("tiles: this week, this month, average visit, burned", all(s in tiles for s in ["This week", "This month", "Average visit", "Burned this month"]) and "≈" in tiles, tiles)
    ok("calendar marks today", pg.locator(".cday.hit.today").count() == 1)
    ok("visit row: date, start – finish, time, sets, kcal", pg.locator(".row[data-p='visit']").count() == 1 and "–" in pg.inner_text(".row[data-p='visit']") and "kcal" in pg.inner_text(".row[data-p='visit']"))
    ok("Log fits width", noscroll())
    tap("[data-a='calm'][data-d='-1']", 300); ok("calendar: previous month", pg.locator(".cday.hit").count() == 0)
    tap("[data-a='calm'][data-d='1']", 300); ok("calendar: back to this month", pg.locator(".cday.hit").count() == 1)
    tap(".cday.hit", 800)
    sid = ST()["sessions"][0]["id"]; nx = len({s["e"] for s in ST()["sessions"][0]["sets"] if not s.get("wu")})
    ok("tap the day → visit page with times + timeline", title() == "Full Body 1" and pg.locator(".tl .tlr").count() == nx and pg.locator(".tl .tt").first.inner_text().endswith("m"), (pg.locator(".tl .tlr").count(), nx))
    ok("visit page shows kcal now", "≈" in pg.inner_text(".stats"))
    pg.click("details.fix summary"); W(200)
    pg.fill("#tstart", "07:00"); pg.fill("#tend", "08:15"); tap("[data-a='savetimes']", 600)
    s0 = ST()["sessions"][0]; ds = datetime.datetime.fromtimestamp(s0["start"] / 1000); de = datetime.datetime.fromtimestamp(s0["end"] / 1000)
    ok("fix the times: 7:00 → 8:15", (ds.hour, ds.minute, de.hour, de.minute) == (7, 0, 8, 15), (ds, de))
    ok("visit shows 1 h 15 min", "1 h 15 min" in pg.inner_text(".times"))
    pg.click("details.fix summary"); W(200); pg.fill("#tstart", "08:00"); pg.fill("#tend", "07:00"); tap("[data-a='savetimes']", 500)
    ok("impossible times refused", "12 hours" in pg.inner_text(".toast") and ST()["sessions"][0]["start"] == s0["start"])
    tap(".hdr .back", 400); ok("visit row shows the fixed times", "7:00 am – 8:15 am" in txt(".row[data-p='visit']"), txt(".row[data-p='visit']"))
    tap("[data-p='records']", 500); ok("personal records page", pg.locator(".row").count() >= 2 and back_reachable()); tap(".hdr .back", 300)

    # ================= last time + warm-ups =================
    tap("nav [data-tab='today']", 400); tap("[data-p='pickstart']", 500)
    ok("choose a routine page (+ empty workout)", pg.locator("[data-a='start']").count() == 6 and back_reachable())
    tap("[data-a='start'] >> nth=0", 1000)
    ok("'Last time' shows what you did", "Last time" in pg.inner_text(".ctl") and "60×11" in pg.inner_text(".ctl"), pg.inner_text(".ctl"))
    ok("warm-up line from the coach's weight", "Warm-up" in pg.inner_text(".ctl") and pg.input_value("#in_k") == "60")
    tap("[data-a='finish']", 400); ok("finish with no sets → leave without saving", pg.locator("[data-a='discard']").count() == 1)
    tap2("[data-a='discard']", 700); ok("workout deleted, nothing logged", A() is None and len(ST()["sessions"]) == 1 and title() == "ROOT:Lift")
    tap("[data-p='pickstart']", 400); tap("[data-a='start'][data-w='free']", 800)
    ok("empty workout → 'Add an exercise'", title() == "Free workout" and pg.locator("[data-a='addtoday']").count() == 1)
    tap("[data-a='finish']", 300); tap2("[data-a='discard']", 600)

    # ================= rule: never two rest days in a row =================
    now = NOW(); st = copy.deepcopy(ST()); st["days"] = [0, 1, 2, 3, 4, 5, 6]
    st["sessions"] = [sess("r2", st["program"][0]["id"], "Full Body 1", 0, day_start(now) - 2 * D + 18 * 3.6e6, [("10Z2DXU", 60, 12, 2)])]
    fresh(st)
    ok("rested yesterday → 'Train today' banner", "train today" in pg.inner_text(".banner.warn").lower())
    exp_miss = 0 if datetime.datetime.fromtimestamp(now / 1000).isoweekday() % 7 == 0 else 1  # only yesterday (if it is in this week)
    ok("only days after the first visit can be 'missed'", pg.locator(".pl.miss").count() == exp_miss, (pg.locator(".pl.miss").count(), exp_miss))
    dow = (datetime.datetime.fromtimestamp(now / 1000).isoweekday()) % 7
    st = copy.deepcopy(ST()); st["days"] = [d for d in range(7) if d != dow]
    st["sessions"] = [sess("r1", st["program"][0]["id"], "Full Body 1", 0, day_start(now) - D + 18 * 3.6e6, [("10Z2DXU", 60, 12, 2)])]
    fresh(st)
    ok("trained yesterday + today off → 'Rest day'", "rest day" in pg.inner_text(".banner").lower())

    # ================= forgot to press Finish =================
    st = copy.deepcopy(ST()); w = st["program"][0]; last = now - 4.5 * 3.6e6
    st["active"] = {"id": "stale1", "w": w["id"], "wn": w["n"], "c": w["c"], "start": now - 5 * 3.6e6, "x": copy.deepcopy(w["x"]),
                    "sets": [{"i": "z1", "e": w["x"][0]["e"], "k": 60, "r": 12, "f": 2, "t": last}]}
    fresh(st)
    ok("old unfinished workout → 'Did you forget to finish?'", "forget to finish" in pg.inner_text(".hero").lower() and pg.locator("[data-a='savestale']").count() == 1)
    tap("[data-a='savestale']", 900)
    ss = [s for s in ST()["sessions"] if s["id"] == "stale1"]
    ok("saved with finish = last set + 5 min", A() is None and ss and ss[0]["end"] == last + 300000, ss[:1])
    ok("saved screen", "Saved to your log" in pg.inner_text("#view")); tap("[data-a='home']", 400)

    # ================= body: goal + chart =================
    st = copy.deepcopy(ST()); st["body"] += [{"id": "o%d" % i, "t": now - (35 - i * 7) * D, "kg": k, "src": "weigh"} for i, k in enumerate([112.0, 111.2, 110.5, 109.8, 109.1])]
    fresh(st); tap("nav [data-tab='body']", 500)
    tap("[data-p='goal']", 400); pg.fill("#gkg", "95"); tap("[data-a='savegoal']", 600)
    ok("goal saved, date projected", ST()["goal"].get("kg") == 95 and "you reach it around" in pg.inner_text("#view"))
    ok("chart with goal line", pg.locator("svg.chart").count() == 1 and "goal" in pg.inner_html("svg.chart"))
    tap("[data-a='metric'][data-m='smm']", 300); ok("switch to muscle", "Muscle" in pg.inner_text(".card .mute")); tap("[data-a='metric'][data-m='kg']", 300)
    tap("[data-a='range'][data-r='1m']", 300); ok("range chips", pg.locator("[data-r='1m'].on").count() == 1)
    nb = len(ST()["body"]); tap("[data-p='entryview'] >> nth=0", 400); tap2("[data-a='delentry']", 600)
    ok("delete an entry (tap twice)", len(ST()["body"]) == nb - 1 and title() == "ROOT:Body")
    ok("Body fits width", noscroll())

    # ================= delete a visit =================
    tap("nav [data-tab='log']", 400); nv = len(ST()["sessions"])
    tap(".row[data-p='visit'] >> nth=0", 700); tap2("[data-a='delsession']", 700)
    ok("delete a visit (tap twice), back on Log", len(ST()["sessions"]) == nv - 1 and title() == "ROOT:Log")

    # ================= never stuck: every page has a working Back =================
    stuck = []
    for path in [["today", "[data-a='exinfo'] >> nth=0"], ["today", "[data-p='pickstart']"], ["routines", ".rcard .rtop >> nth=0"], ["routines", "[data-p='library']"],
                 ["routines", "[data-p='template'] >> nth=1"], ["routines", "[data-p='howcoach']"], ["body", "[data-p='entry']"], ["body", "[data-p='goal']"],
                 ["log", "[data-p='visit'] >> nth=0"], ["log", "[data-p='records']"]]:
        tap(f"nav [data-tab='{path[0]}']", 300); tap(path[1], 900)
        if not back_reachable(): stuck.append(path)
        if not noscroll(): stuck.append(path + ["scrolls sideways"])
        tap(".hdr .back", 400)
        if pg.locator(".hdr").count() or pg.is_hidden("nav.tabs"): stuck.append(path + ["no return"])
    ok("every page: Back visible after scrolling, returns to the tab, fits width", not stuck, stuck)
    ok("no pop-up windows anywhere", pg.locator(".sheet").count() == 0 and not dialogs)
    ok("no old photo hosts used; animations from ExerciseDB", calls["old"] == 0 and calls["gif"] > 10, calls)
    ok("exercise steps fetched once each, then kept on the phone", calls["steps"] == len(step_ids) and "10Z2DXU" in pg.evaluate("localStorage.getItem('lift_steps')"), (calls, step_ids))

    # ================= narrow iPhone (375) =================
    pg.set_viewport_size({"width": 375, "height": 667})
    wide = []
    for tab in ["today", "routines", "log", "body"]:
        tap(f"nav [data-tab='{tab}']", 400)
        if not noscroll(): wide.append(tab)
    tap("nav [data-tab='today']", 300); tap("#go", 1000)
    if not noscroll(): wide.append("workout")
    ok("375-wide iPhone: nothing scrolls sideways", not wide, wide)
    tap("[data-a='finish']", 300); tap2("[data-a='discard']", 600)
    pg.set_viewport_size({"width": 390, "height": 844})

    # ================= v1 data still upgrades =================
    db["state"] = {"items": [], "log": [], "days": [0, 2, 3, 6], "next": 1, "active": None,
                   "sessions": [{"id": "v1s", "w": "ua", "start": NOW() - 3 * D, "end": NOW() - 3 * D + 3e6, "sets": [{"i": "a", "e": "chest_press", "k": 40, "r": 12, "t": 1}]}]}
    db["v"] += 1; pg.evaluate("localStorage.clear()"); pg.reload(); W(600); pg.fill("#pin", "2026"); pg.click("#pinGo"); W(1500)
    ok("v1 data upgraded and saved", ST()["ver"] == 3 and ST()["sessions"][0]["sets"][0]["e"] == "DOoWcnA" and ST()["next"] == 1 and ST()["days"] == [0, 2, 3, 6])
    ok("no page errors", not errs, errs[:3])

    # ================= works at the gym without signal (service worker) =================
    c2 = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="en-GB")
    p2 = c2.new_page(); p2.route("**/api/health-check**", api); p2.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
    p2.goto(f"http://127.0.0.1:{PORT}/index.html"); p2.wait_for_timeout(800); p2.fill("#pin", "2026"); p2.click("#pinGo"); p2.wait_for_timeout(1500)
    ready = p2.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)"); p2.wait_for_timeout(1500)
    cached = p2.evaluate("caches.open('lift-v4.1').then(c=>c.keys()).then(k=>k.map(r=>new URL(r.url).pathname.split('/').pop()))")
    ok("offline worker installs and keeps the app + exercise list", ready and "index.html" in cached and "exercises.json" in cached, cached)
    c2.set_offline(True); p2.reload(); p2.wait_for_timeout(1500)
    ok("no signal: the app still opens (from the phone)", p2.is_visible("#app") and p2.locator("#go, [data-a='resume']").count() >= 1)
    p2.evaluate("loadLib && 1"); n_lib = p2.evaluate("LIB?LIB.length:0")
    ok("no signal: exercise library still there", n_lib == 1285, n_lib)
    c2.close()
    br.close()
srv.shutdown()
f = [n for n, c in res if not c]; print(f"\nE2E lift: PASS {len(res)-len(f)}  FAIL {len(f)}"); sys.exit(1 if f else 0)
