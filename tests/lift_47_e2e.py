#!/usr/bin/env python3
"""Lift 4.7 e2e — Moaath's Users page: how often each person opens Lift, logs in, saves changes, active days, and what
they trained (muscles, exercises, workouts, plan). English + Arabic, dark + light. Gate login is reported as a login.
Real Chromium at iPhone size; backend mocked in-process (same contract as api/health-check?app=lift action userstats).
Usage: python3 tests/lift_47_e2e.py [path-to-lift-folder] [screenshot-dir]"""
import json, threading, http.server, socketserver, sys, os, re, datetime
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "lift")
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ""
PORT = int(os.environ.get("PORT", "8187"))
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Q); threading.Thread(target=srv.serve_forever, daemon=True).start()
D = 864e5
FIXED = datetime.datetime(2026, 10, 20, 15, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=3))).timestamp() * 1000  # Tue 20 Oct 2026 15:00 Riyadh
def rday(ms): return datetime.datetime.fromtimestamp(ms / 1000 + 3 * 3600, datetime.timezone.utc).strftime("%Y-%m-%d")
ADMIN = "2026"
db = {ADMIN: {"v": 5, "state": None}}
def sets(pairs, t0): return [{"e": e, "k": k, "r": r, "t": t0 + i * 60000} for i, (e, k, r) in enumerate(pairs)]
t1 = FIXED - 2 * D
SAAD = {"aid": "u1", "name": "Saad", "you": False, "created": FIXED - 3 * D, "v": 36, "ts": FIXED - 3600e3,
        "act": {"opens": 14, "logins": 2, "saves": 30, "first": FIXED - 3 * D, "lastOpen": FIXED - 1800e3, "lastSave": FIXED - 3600e3,
                "days": {rday(FIXED): {"o": 5, "s": 12}, rday(FIXED - D): {"o": 6, "s": 10}, rday(FIXED - 2 * D): {"o": 3, "s": 8}}},
        "st": {"days": [0, 2, 4], "custom": {"c_x1": {"n": "Hip thrust machine", "t": ["glutes"], "mp": ["gl"], "ms": ["hm"], "eq": ["leverage machine"], "kind": "w"}}, "body": 1,
               "program": [{"n": "Push", "x": ["DOoWcnA", "EIeI8Vf"]}, {"n": "Legs", "x": ["10Z2DXU", "c_x1"]}],
               "sessions": [{"wn": "Push", "start": t1, "end": t1 + 50 * 60000, "sets": sets([("DOoWcnA", 40, 10), ("DOoWcnA", 45, 8), ("EIeI8Vf", 30, 10)], t1) + [{"e": "DOoWcnA", "k": 20, "r": 10, "t": t1, "wu": 1}]},
                            {"wn": "Legs", "start": FIXED - D, "end": FIXED - D + 40 * 60000, "sets": sets([("10Z2DXU", 80, 12), ("c_x1", 60, 10), ("c_x1", 70, 8)], FIXED - D)}],
               "active": {"wn": "Push", "start": FIXED - 1800e3, "sets": sets([("DOoWcnA", 50, 6)], FIXED - 1800e3)}}}
NEWBIE = {"aid": "u2", "name": "Abdulaziz", "you": False, "created": FIXED - D, "v": 0, "ts": None, "act": None, "st": None}
ME = {"aid": "admin", "name": "Moaath", "you": True, "created": None, "v": 221, "ts": FIXED - 7200e3,
      "act": {"opens": 3, "logins": 0, "saves": 2, "first": FIXED - D, "lastOpen": FIXED - 600e3, "days": {rday(FIXED): {"o": 3, "s": 2}}},
      "st": {"days": [0, 1, 3, 4, 6], "custom": {}, "body": 2, "program": [{"n": "Workout 1 · Legs + push", "x": ["10Z2DXU"]}], "sessions": [], "active": None}}
L2 = {"aid": "f", "name": "Lift2 friend", "you": False, "created": None, "v": 89, "ts": FIXED - 5 * D, "act": None,
      "st": {"days": [0, 2], "custom": {}, "body": 0, "program": [{"n": "Full body 1", "x": ["DOoWcnA"]}], "sessions": [], "active": None}}
ACCOUNTS = [ME, SAAD, NEWBIE, L2]; CALLS = []
def api(route):
    b = json.loads(route.request.post_data or "{}"); pin = b.get("pin"); a = b.get("action"); CALLS.append(b)
    j = lambda code, o: route.fulfill(status=code, body=json.dumps(o), content_type="application/json")
    if pin != ADMIN: return j(401, {"error": "pin"})
    if a == "state": return j(200, {**db[pin], "role": "full", "admin": True, "fix": {"hv": {}}, "reports": 0})
    if a == "save":
        db[pin]["v"] += 1; db[pin]["state"] = b["state"]; return j(200, {"v": db[pin]["v"]})
    if a == "users": return j(200, {"users": [{"id": "u1", "name": "Saad", "code": "482910", "created": SAAD["created"]}, {"id": "u2", "name": "Abdulaziz", "code": "482911", "created": NEWBIE["created"]}]})
    if a == "userstats": return j(200, {"accounts": ACCOUNTS, "now": FIXED})
    if a in ("diag", "reports"): return j(200, {"ok": True, "items": []})
    j(400, {"error": "unknown"})
GIF1 = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
res = []
def ok(n, c, extra=""):
    res.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n + ("" if c or extra == "" else "  — " + str(extra)[:400]))
from lift_46_e2e_contrast import CONTRAST_JS
with sync_playwright() as p:
    br = p.chromium.launch()
    def newpage(lang=None, theme=None, gate=False):
        ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="en-GB", service_workers="block", timezone_id="Asia/Riyadh")
        miss = set(); ctx.expose_function("__trMiss", lambda k: miss.add(k))
        init = "if(!sessionStorage.getItem('t47')){sessionStorage.setItem('t47','1');" + ("" if gate else "localStorage.setItem('lift_pin','2026');localStorage.setItem('lift_who','2026');")
        if lang: init += "localStorage.setItem('lift_lang','%s');" % lang
        if theme: init += "localStorage.setItem('lift_theme','%s');" % theme
        ctx.add_init_script(init + "}")
        pg = ctx.new_page(); pg.clock.set_fixed_time(FIXED / 1000); pg.route("**/api/health-check**", api)
        pg.route("**/static.exercisedb.dev/**", lambda r: r.fulfill(status=200, body=GIF1, content_type="image/gif"))
        pg.route("**/i.ytimg.com/**", lambda r: r.fulfill(status=200, body=GIF1, content_type="image/gif"))
        pg.route("**/oss.exercisedb.dev/**", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"data":{"instructions":[]}}'))
        pg.route("**raw.githubusercontent.com/**", lambda r: r.fulfill(status=404, body=b"")); pg.route("**wger.de/**", lambda r: r.fulfill(status=404, body=b""))
        pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(1500)
        return ctx, pg, errs, miss
    def tools(pg):
        W = lambda ms=400: pg.wait_for_timeout(ms)
        def tap(sel, ms=500):
            el = pg.locator(sel).first; el.evaluate("e=>e.scrollIntoView({block:'center'})"); el.click(); W(ms)
        def txt(sel="#view"): return pg.inner_text(sel).replace(" ", " ").replace("\xa0", " ")
        def noscroll(): return pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1")
        return W, tap, txt, noscroll

    # ---- logging in with the code on the gate is reported as a login; a normal reopen is not
    ctx, pg, errs, _ = newpage(gate=True)
    W, tap, txt, noscroll = tools(pg)
    pg.fill("#pin", ADMIN); pg.click("#pinGo"); W(1500)
    st_calls = [c for c in CALLS if c.get("action") == "state"]
    ok("code typed on the gate → the server is told it's a login", st_calls and st_calls[-1].get("login") == 1, st_calls[-1:])
    pg.evaluate("pull()"); W(600)
    st_calls = [c for c in CALLS if c.get("action") == "state"]
    ok("coming back to the app later is an open, not a login", not st_calls[-1].get("login"))
    ctx.close()

    for theme in ("dark", "light"):
        ctx, pg, errs, _ = newpage(theme=theme)
        W, tap, txt, noscroll = tools(pg)
        tap("nav.tabs [data-tab='user']", 500)
        ok(f"[{theme}] User › Users row says it shows usage", "how often" in txt("[data-p='users']"))
        tap("[data-p='users']", 1500)
        t = txt()
        ok(f"[{theme}] Users page opens with 'How people use Lift' on top", t.index("How people use Lift") < t.index("Add a friend"), t[:200])
        tiles = pg.locator(".tile .v").all_inner_texts()[:4]
        ok(f"[{theme}] totals: 4 people, 2 active this week, 2 workouts logged, 1 in progress", tiles == ["4", "2", "2", "1"], tiles)
        rows = pg.locator("[data-p='ustat'] .t").all_inner_texts()
        ok(f"[{theme}] everyone listed, most recently seen first", rows == ["You (Moaath)", "Saad", "Lift2 friend", "Abdulaziz"], rows)
        r0 = txt("[data-p='ustat'][data-id='u1']")
        ok(f"[{theme}] row: opens, workouts, in progress, last seen", "Opened 14 times" in r0 and "2 workouts" in r0 and "workout in progress" in r0 and "Today" in r0, r0)
        ok(f"[{theme}] someone who never opened it says so", "Not opened yet" in txt("[data-p='ustat'][data-id='u2']"))
        ok(f"[{theme}] used before counting began → shows its saved changes, not 'not opened'", "89 changes saved" in txt("[data-p='ustat'][data-id='f']"))
        ok(f"[{theme}] codes aren't in the usage list", "482910" not in txt(".list >> nth=0"))
        if SHOTS: pg.screenshot(path=os.path.join(SHOTS, f"47_{theme}_users.png"), full_page=True)
        tap("[data-p='ustat'][data-id='u1']", 1500)
        t = txt()
        tv = pg.locator(".tile .v").all_inner_texts()
        ok(f"[{theme}] Saad: opened 14, logged in 2, changes saved 36, workouts 2", tv[:4] == ["14", "2", "36", "2"], tv)
        ok(f"[{theme}] last opened / last change / active days 3 of 7", "Last opened" in t and "Last change" in t and "3 of last 7" in t, t[:400])
        bars = pg.evaluate("[...document.querySelectorAll('.ub i')].map(i=>parseFloat(i.style.height))")
        ok(f"[{theme}] 14 daily bars, today the tallest, older days empty", len(bars) == 14 and bars[-1] == 100 and bars[0] == 0 and bars[-2] > 0, bars)
        ok(f"[{theme}] workout in progress: Push, 1 set", "Workout in progress" in t and "1 set logged" in t)
        ok(f"[{theme}] what they trained: body map + muscles with set counts", pg.locator(".mapcard svg.bmap").count() >= 1 and "Glutes" in t and "Middle chest" in t, t[:600])
        ex = pg.locator("section:has(h2:text-is('Exercises done')) .row .t").all_inner_texts()
        ok(f"[{theme}] exercises done, most sets first, their own custom exercise by name", ex[:2] == ["Machine chest press", "Hip thrust machine"] or (ex and ex[0] == "Machine chest press" and "Hip thrust machine" in ex), ex)
        ok(f"[{theme}] warm-up sets not counted (chest press = 3 sets, best 50×6)", "3 sets" in txt("section:has(h2:text-is('Exercises done')) .row >> nth=0") and "50×6" in txt("section:has(h2:text-is('Exercises done')) .row >> nth=0"))
        wk = pg.locator("section:has(h2:text-is('Workouts')) .row").all_inner_texts()
        ok(f"[{theme}] workouts newest first with time, length, sets, exercises", len(wk) == 2 and wk[0].startswith("Legs") and "40 min" in wk[0] and "3 sets" in wk[0] and "Hip thrust machine" in wk[0], wk)
        ok(f"[{theme}] their plan + gym days + weigh-ins", "Their plan" in t and "Push" in t and "Sun, Tue, Thu" in t and "1 weigh-in" in t)
        ok(f"[{theme}] page fits the phone", noscroll())
        low = pg.evaluate(CONTRAST_JS, 3); ok(f"[{theme}] all text readable", not low, low[:5])
        if SHOTS: pg.screenshot(path=os.path.join(SHOTS, f"47_{theme}_saad.png"), full_page=True)
        tap(".hdr .back", 500); tap("[data-p='ustat'][data-id='u2']", 900)
        ok(f"[{theme}] never-opened friend: zeros + 'hasn't opened Lift yet'", pg.locator(".tile .v").all_inner_texts()[:4] == ["0", "0", "0", "0"] and "opened Lift yet" in txt())
        ok(f"no page errors ({theme})", not errs, errs[:3])
        ctx.close()

    ctx, pg, errs, MISS = newpage(lang="ar")
    W, tap, txt, noscroll = tools(pg)
    tap("nav.tabs [data-tab='user']", 500); tap("[data-p='users']", 1500)
    ok("Arabic: usage section heading", "كيف يستخدمون Lift" in txt())
    tap("[data-p='ustat'][data-id='u1']", 1500); ok("Arabic: detail page fits", noscroll())
    tap(".hdr .back", 500); tap("[data-p='ustat'][data-id='u2']", 900)
    real = sorted(k for k in MISS if not re.fullmatch(r"(Saad|Abdulaziz|Push|Legs|Workout .*|Full body .*|.*(press|machine|row|curl|squat).*)", k, re.I))
    ok("Arabic: no English left on the usage pages (names excepted)", not real, real[:30])
    ok("no page errors (Arabic)", not errs, errs[:3])
    br.close()
n_fail = sum(1 for _, c in res if not c)
print(f"\nE2E lift 4.7: PASS {len(res) - n_fail}  FAIL {n_fail}")
srv.shutdown(); sys.exit(1 if n_fail else 0)
