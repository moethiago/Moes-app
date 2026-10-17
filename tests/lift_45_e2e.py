#!/usr/bin/env python3
"""Lift 4.5 e2e — Muscles tab (weekly muscle log + heat map), train-one-muscle pages, library by muscle, my gym's
equipment, fixed days, first-time setup, gap coach, reports to the admin — in English, then the same pages in Arabic
with zero untranslated words. Real Chromium at iPhone size; backend mocked in-process (same contract as api/health-check?app=lift).
Usage: python3 tests/lift_45_e2e.py [path-to-lift-folder] [screenshot-dir]"""
import json, threading, http.server, socketserver, sys, os, re, time, datetime
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "lift")
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ""
PORT = int(os.environ.get("PORT", "8185"))
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Q); threading.Thread(target=srv.serve_forever, daemon=True).start()

D = 864e5
# a fixed clock: Wednesday 14 Oct 2026, 15:00 Riyadh — the week is Sun 11 – Sat 17
FIXED = datetime.datetime(2026, 10, 14, 15, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=3))).timestamp() * 1000
WS = datetime.datetime(2026, 10, 11, 0, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=3))).timestamp() * 1000
NOW = lambda: FIXED
ADMIN, FRIEND = "2026", "482910"
db = {ADMIN: {"v": 1, "state": None}, FRIEND: {"v": 1, "state": None}}
REPORTS = []; FIX = {"hv": {}}; calls = []
def api(route):
    b = json.loads(route.request.post_data or "{}"); pin = b.get("pin"); a = b.get("action"); calls.append(a)
    j = lambda code, o: route.fulfill(status=code, body=json.dumps(o), content_type="application/json")
    if pin not in db: return j(401, {"error": "pin"})
    adm = pin == ADMIN
    if a == "state": return j(200, {**db[pin], "role": "full", "admin": adm, "fix": FIX})
    if a == "save":
        if b.get("v") != db[pin]["v"]: return j(409, {"conflict": True, **db[pin]})
        db[pin]["v"] += 1; db[pin]["state"] = b["state"]; return j(200, {"v": db[pin]["v"]})
    if a == "report":
        if b.get("kind") not in ("video", "picture", "muscles", "steps", "name", "other", "missing"): return j(400, {"error": "kind"})
        REPORTS.append({"id": "r%d" % len(REPORTS), "t": NOW(), "kind": b["kind"], "e": b.get("e", ""), "n": b.get("n", ""), "q": b.get("q", ""), "note": b.get("note", ""), "who": "Moaath" if adm else "Saad"}); return j(200, {"ok": True})
    if a in ("reports", "delreport", "fixvid"):
        if not adm: return j(403, {"error": "admin"})
        if a == "fixvid":
            if b.get("hide"): FIX["hv"][b["e"]] = 1
            else: FIX["hv"].pop(b["e"], None)
            return j(200, {"ok": True, "fix": FIX})
        if a == "delreport": REPORTS[:] = [r for r in REPORTS if r["id"] != b.get("id")]
        return j(200, {"items": REPORTS})
    if a in ("users",): return j(200, {"users": []})
    j(400, {"error": "unknown"})
GIF1 = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
res = []
def ok(n, c, extra=""):
    res.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n + ("" if c or extra == "" else "  — " + str(extra)[:300]))
def day_start(ms):
    d = datetime.datetime.fromtimestamp(ms / 1000); return datetime.datetime(d.year, d.month, d.day).timestamp() * 1000
def week_start(ms):
    d0 = day_start(ms); dow = (datetime.datetime.fromtimestamp(ms / 1000).weekday() + 1) % 7; return d0 - dow * D
def sess(id, start, sets, w="x", wn="Old"):
    return {"id": id, "w": w, "wn": wn, "c": 0, "start": start, "end": start + 3e6, "sets": [{"i": id + str(n), "e": e, "k": k, "r": r, "f": 2, "t": start + n * 60000} for n, (e, k, r) in enumerate(sets)]}

with sync_playwright() as p:
    br = p.chromium.launch()
    def newpage(lang=None, pin=ADMIN):
        ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="en-GB", service_workers="block", timezone_id="Asia/Riyadh")
        miss = set(); ctx.expose_function("__trMiss", lambda k: miss.add(k))
        init = "localStorage.setItem('lift_pin','%s');localStorage.setItem('lift_who','%s');" % (pin, pin)
        if lang: init += "localStorage.setItem('lift_lang','%s');" % lang
        ctx.add_init_script(init)
        pg = ctx.new_page(); pg.clock.set_fixed_time(FIXED / 1000); pg.route("**/api/health-check**", api)
        pg.route("**/static.exercisedb.dev/**", lambda r: r.fulfill(status=200, body=GIF1, content_type="image/gif"))
        pg.route("**/i.ytimg.com/**", lambda r: r.fulfill(status=200, body=GIF1, content_type="image/gif"))
        pg.route("**/oss.exercisedb.dev/**", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps({"data": {"instructions": ["Step:1 Sit down.", "Step:2 Push."]}})))
        pg.route("**raw.githubusercontent.com/**", lambda r: r.fulfill(status=404, body=b""))
        pg.route("**wger.de/**", lambda r: r.fulfill(status=404, body=b""))
        pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        return ctx, pg, errs, miss
    ctx, pg, errs, _ = newpage()
    W = lambda ms=400: pg.wait_for_timeout(ms)
    def tap(sel, ms=450):
        el = pg.locator(sel).first; el.evaluate("e=>e.scrollIntoView({block:'center'})"); el.click(); W(ms)
    def tap2(sel, ms=600): tap(sel, 150); tap(sel, ms)
    def txt(sel="#view"): return pg.inner_text(sel).replace(" ", " ").replace("\xa0", " ")
    def title(): return pg.inner_text(".hdr .ttl").split("\n")[0] if pg.locator(".hdr").count() else ("ROOT:" + pg.inner_text(".root-top h1"))
    def noscroll(): return pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1")
    ST = lambda: db[ADMIN]["state"]
    def shot(name):
        if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=True)
    def go_page(p_, **a):
        pg.evaluate("([p,a])=>{show(p,a)}", [p_, a]); W(700)
    def tab(name, ms=700):
        pg.evaluate("t=>{TAB=t;STACK=[];saveUI();render();window.scrollTo(0,0)}", name); W(ms)

    pg.goto(f"http://127.0.0.1:{PORT}/index.html"); W(1800)
    ok("app opens with a seeded plan", ST() is not None and len(ST()["program"]) >= 4, ST() and len(ST()["program"]))
    ok("5 tabs incl. Muscles", pg.locator("nav.tabs button").all_inner_texts() == ["Today", "Routines", "Muscles", "Log", "Body"], pg.locator("nav.tabs button").all_inner_texts())

    # ---- this week: bench 3 sets, pulldown 3 sets, leg press 3 sets (2 days ago if that's still this week, else today)
    now = NOW(); ws = WS; t1 = WS + D + 18 * 3600e3  # Monday 18:00
    st = ST(); st["sessions"] = [sess("s1", t1, [("EIeI8Vf", 40, 10)] * 3 + [("eYnzaCm", 35, 10)] * 3 + [("10Z2DXU", 80, 12)] * 3),
                                 sess("s0", ws - 3 * D, [("EIeI8Vf", 40, 10)] * 2)]
    db[ADMIN]["v"] += 1; pg.evaluate("localStorage.removeItem('lift_state')"); pg.reload(); W(1800)
    tab("muscles", 900)
    shot("01_muscles_week")
    t = txt()
    ok("Muscles tab: heat map + legend + summary", pg.locator(".mapcard svg.bmap").count() >= 1 and "On target" in t and "muscles on target" in t)
    def mrow(name):
        r = pg.locator(".mrow", has=pg.locator(".t", has_text=re.compile("^" + name + "$")))
        return r.first.inner_text().replace("\n", " ") if r.count() else ""
    ok("Middle chest = 3 sets (bench)", " 3 sets" in mrow("Middle chest"), mrow("Middle chest"))
    ok("Chest total = 3", " 3 sets" in mrow("Chest"), mrow("Chest"))
    ok("Lats = 3 sets (pulldown)", " 3 sets" in mrow("Lats"), mrow("Lats"))
    ok("Biceps = 1.5 sets (helped in the pulldown — counted as ½)", " 1.5 sets" in mrow("Biceps"), mrow("Biceps"))
    ok("Triceps = 1.5, Front delts = 1.5 (helped in bench)", " 1.5 sets" in mrow("Triceps") and " 1.5 sets" in mrow("Front delts"))
    ok("Quads = 3 sets (leg press), Glutes = 1.5", " 3 sets" in mrow("Quads") and " 1.5 sets" in mrow("Glutes"), (mrow("Quads"), mrow("Glutes")))
    ok("untouched muscle shows Not trained", "Not trained" in mrow("Side delts"), mrow("Side delts"))
    ok("calves get ½ per leg press set (they help) = 1.5", " 1.5 sets" in mrow("Calves"), mrow("Calves"))
    ok("new lifter target shown (quads 6–20)", "target 6–20" in mrow("Quads"), mrow("Quads"))
    ok("Muscles tab fits the phone", noscroll())
    tap("[data-a='mrange'][data-r='last']", 500)
    ok("Last week: only last week's 2 bench sets", " 2 sets" in mrow("Middle chest") and "Not trained" in mrow("Lats"), (mrow("Middle chest"), mrow("Lats")))
    tap("[data-a='mrange'][data-r='avg4']", 500)
    ok("4-week average (last 4 full weeks): 2/4 = 0.5 a week for middle chest", " 0.5 sets" in mrow("Middle chest"), mrow("Middle chest"))
    tap("[data-a='mrange'][data-r='week']", 500)
    tap("[data-a='level'][data-v='some']", 600)
    ok("level 'Under 1 year' → quads target 10–20, saved", "target 10–20" in mrow("Quads") and ST().get("level") == "some")
    tap("[data-a='level'][data-v='new']", 500)

    # ---- one muscle: Lats
    tap(".mrow:has(.t:text-is('Lats'))", 1500)
    t = txt(); shot("02_muscle_lats")
    ok("muscle page: title, this-week number, body figure", title() == "Lats" and pg.locator(".mstat").count() == 1 and pg.locator(".mapcard svg.bmap").count() == 1)
    ok("…shows what you trained it with this week", "This week you trained it with" in t and "Cable bar lateral pulldown" in t)
    ok("…lists the best exercises for it", pg.locator("#mlist .row").count() >= 20 and "pulldown" in txt("#mlist").lower())
    ok("…each exercise says what else it works", "Also:" in txt("#mlist"))
    ok("muscle page fits the phone", noscroll())
    tap(".hdr .back", 500)

    # ---- library: browse by muscle → upper chest
    tab("routines", 600); tap("[data-p='library']", 1500)
    tap("[data-a='lview'][data-v='muscle']", 700); shot("03_library_by_muscle")
    ok("library 'By muscle' shows every group and muscle", pg.locator(".mtile").count() >= 25 and "Upper chest" in txt() and "Rear delts" in txt())
    tap(".mtile[data-id='cu']", 1500); shot("04_upper_chest")
    first = pg.locator("#mlist .row .t").first.inner_text()
    ok("Upper chest page: top exercise is an incline movement", "incline" in first.lower() or "upper chest" in first.lower(), first)
    top10 = pg.locator("#mlist .row .t").all_inner_texts()[:10]
    ok("…top 10 are all upper-chest exercises (incline / low-to-high)", all(re.search(r"incline|upper chest|low fly|decline push|landmine|reverse.grip", x, re.I) for x in top10), top10)
    tap("[data-a='mpick'][data-id='cl']", 900)
    ok("chips switch to lower chest", title() == "Lower chest" and re.search(r"decline|dip|lower chest", pg.locator("#mlist .row .t").first.inner_text(), re.I), pg.locator("#mlist .row .t").first.inner_text())
    tap("#mlist .row >> nth=0", 1200)
    ok("exercise page shows main muscle as a chip", pg.locator(".facts .mpill.m1").count() >= 1)
    mname = pg.locator(".facts .mpill.m1").first.inner_text()
    tap(".facts .mpill.m1 >> nth=0", 1200)
    ok("tapping the muscle chip opens that muscle's page", title() == mname, (title(), mname))
    tap(".hdr .back", 400); tap(".hdr .back", 400); tap(".hdr .back", 400)
    tap("[data-a='lview'][data-v='search']", 500)
    tap("[data-a='lg'][data-g='0']", 600); n_ch = int(txt("#liblist .mute.small").split()[0].replace(",", ""))
    ok("Chest chip shows sub-muscle chips", pg.locator("[data-a='lm']").count() == 4)
    tap("[data-a='lm'][data-m='cu']", 600); n_cu = int(txt("#liblist .mute.small").split()[0].replace(",", ""))
    ok("Upper chest filter narrows the list and every row says Upper chest", 20 < n_cu < n_ch and all("Upper chest" in s for s in pg.locator("#liblist .row .s").all_inner_texts()[:15]), (n_cu, n_ch))
    tap("[data-a='lg'][data-g='']", 400)
    pg.fill("#libq", "upper chest"); W(600)
    ok("typing a muscle name finds its exercises", "incline" in txt("#liblist").lower())
    pg.fill("#libq", ""); W(300)
    ok("library fits the phone", noscroll())

    # ---- my gym: no barbells
    tap(".hdr .back", 500); tap("[data-p='gear']", 700); shot("05_gear")
    ok("gear page lists equipment, all ticked", pg.locator(".gearrow.on").count() == pg.locator(".gearrow").count() >= 10)
    tap(".gearrow[data-k='barbell']", 500)
    ok("unticking barbell saves my gym", isinstance(ST().get("gear"), list) and "barbell" not in ST()["gear"])
    tap(".hdr .back", 400); tap("[data-p='library']", 1300)
    pg.fill("#libq", "barbell bench press"); W(600)
    ok("library hides barbell exercises (My gym on)", "Barbell bench press" not in pg.locator("#liblist .row .t").all_inner_texts() and pg.locator("[data-a='lmine']").count() == 1)
    tap("[data-a='lmine']", 600)
    ok("…'My gym' off shows them again", "Barbell bench press" in pg.locator("#liblist .row .t").all_inner_texts()[:3])
    pg.fill("#libq", ""); W(200)
    tap(".hdr .back", 400); tap("[data-p='gear']", 600); tap("[data-a='gearall']", 500)
    ok("'My gym has everything' clears the list", "gear" not in ST())
    tap(".hdr .back", 400)

    # ---- fixed day: pin routine 2 to today
    dow = 3  # the fixed clock is a Wednesday
    r2 = ST()["program"][1]
    pg.locator(".rcard .rtop").nth(1).click(); W(700); tap("[data-p='editor']", 700); shot("06_editor_days")
    ok("editor has Days: Rotates + 7 days", pg.locator("[data-a='wday']").count() == 8 and pg.locator("[data-a='wday'][data-d='-1'].on").count() == 1)
    tap(f"[data-a='wday'][data-d='{dow}']", 600)
    ok("routine pinned to today, today added to gym days", ST()["program"][1].get("days") == [dow] and dow in ST()["days"], (ST()["program"][1].get("days"), ST()["days"]))
    tap("[data-a='back'] >> nth=-1", 500); tap(".hdr .back", 500)
    tab("today", 700)
    ok("Today shows the pinned routine", r2["n"] in pg.inner_text(".hero"), pg.inner_text(".hero")[:80])
    tab("routines", 600)
    ok("routines header says one is on a fixed day", "on fixed days" in txt(".root-top"))
    pg.locator(".rcard .rtop").nth(1).click(); W(600); tap("[data-p='editor']", 600); tap("[data-a='wday'][data-d='-1']", 500)
    ok("'Rotates' unpins it", "days" not in ST()["program"][1])
    tap("[data-a='back'] >> nth=-1", 400); tap(".hdr .back", 400)
    tap("[data-a='strict']", 500)
    ok("rest-day rule can be switched off", ST().get("strict") is False)
    tap("[data-a='strict']", 400); ok("…and on again", ST().get("strict") is True)

    # ---- report a wrong video, ask for a missing exercise
    go_page("exercise", e="rR0LJzx"); ok("exercise page has the video button", pg.locator("a.ytb").count() == 1)
    tap(".rplink", 600); shot("07_report")
    ok("report page: Send disabled until a reason is picked", pg.locator("[data-a='rpsend'][disabled]").count() == 1)
    tap("[data-a='rpkind'][data-v='video']", 300); pg.fill("#rpnote", "video shows a barbell"); pg.dispatch_event("#rpnote", "input")
    tap("[data-a='rpsend']", 800)
    ok("report sent with exercise, reason and note", REPORTS and REPORTS[-1]["kind"] == "video" and REPORTS[-1]["e"] == "rR0LJzx" and REPORTS[-1]["note"] == "video shows a barbell", REPORTS[-1:] )
    tab("routines", 500); tap("[data-p='library']", 1200)
    pg.fill("#libq", "zzqqx machine"); W(600)
    tap("#liblist [data-p='report']", 700)
    ok("'Ask for it' opens with the name filled in", pg.input_value("#rpq") == "zzqqx machine")
    tap("[data-a='rpsend']", 800)
    ok("missing-exercise request sent", REPORTS[-1]["kind"] == "missing" and REPORTS[-1]["q"] == "zzqqx machine")
    tab("routines", 500); tap("[data-p='reports']", 900); shot("08_reports")
    ok("admin Reports page lists both", pg.locator(".rprow").count() == 2 and "Missing exercise" in txt() and "Wrong video" in txt())
    tap2("[data-a='fixvid']", 900)
    ok("'Hide video for everyone' → server list updated", FIX["hv"].get("rR0LJzx") == 1)
    go_page("exercise", e="rR0LJzx")
    ok("…the video button is gone from that exercise", pg.locator("a.ytb").count() == 0)
    tap(".hdr .back", 400); tap("[data-a='rpdone'] >> nth=0", 800)
    ok("'Done' removes a report", len(REPORTS) == 1 and pg.locator(".rprow").count() == 1)
    tap("[data-a='unfixvid']", 700); ok("'Show video again' restores it", "rR0LJzx" not in FIX["hv"])
    tap(".hdr .back", 400)

    # ---- first-time setup (sessions < 3 → invite on Today)
    tab("today", 600)
    ok("Today invites to set up (new user)", pg.locator("[data-p='setup']").count() == 1)
    tap("[data-p='setup']", 700)
    ok("setup: nothing to use until all four are answered", pg.locator("[data-a='useplan']").count() == 0)
    tap("[data-a='su'][data-k='goal'][data-v='strength']", 250); tap("[data-a='su'][data-k='exp'][data-v='new']", 250)
    tap("[data-a='su'][data-k='days'][data-v='3']", 250); tap("[data-a='su'][data-k='kit'][data-v='basic']", 900); shot("09_setup")
    ok("setup shows the plan: 3 routines, 3 days", pg.locator(".rcard").count() == 3 and pg.locator(".pills .pill").count() == 3)
    ok("…basic gym: no barbell exercise in the plan", "Barbell" not in txt())
    ok("setup page fits the phone", noscroll())
    tap2("[data-a='useplan']", 1000)
    s2 = ST()
    ok("plan used: 3 routines, Sun/Tue/Thu, rest rule off, level new, gear set, setup done", len(s2["program"]) == 3 and s2["days"] == [0, 2, 4] and s2["strict"] is False and s2["level"] == "new" and s2["setup"] == 1 and "barbell" not in s2.get("gear", []), {k: s2.get(k) for k in ("days", "strict", "level", "setup", "gear")})
    lifts = [i for w in s2["program"] for i in w["x"] if i["kind"] != "c"]
    ok("…new lifter: 2 sets; strength: first lifts 6–8 reps", all(i["s"] == 2 for i in lifts) and all(w["x"][0]["hi"] == 8 for w in s2["program"]))
    ok("setup invite gone, Today shows the new plan", pg.locator("#view [data-p='setup']").count() == 0 and pg.locator("div.hero").count() == 1)
    ok("log and records kept", len(s2["sessions"]) == 2)

    # ---- gap coach on Today
    gaps = pg.locator(".gaprow").count()
    ok("Today: 'Behind this week' coach appears when the plan won't reach a target", gaps >= 1, txt()[:200])
    shot("10_today_gap")
    if gaps:
        e_add = pg.locator("[data-a='gapadd']").first.get_attribute("data-e")
        tap("[data-a='gapadd'] >> nth=0", 1200)
        a = ST()["active"]
        ok("'Add' starts today's workout with that exercise (walk stays last)", a and any(x["e"] == e_add for x in a["x"]) and a["x"][-1]["kind"] == "c", a and [x["e"] for x in a["x"]])
        ok("…and jumps to it", title() != "" and pg.locator(".exname").count() == 1)
        # log one set and finish → muscles worked
        if pg.locator("#in_k").count() and not pg.input_value("#in_k"): pg.fill("#in_k", "10"); pg.dispatch_event("#in_k", "input")
        pg.locator("[data-a='log'][data-f='2']").first.click(); W(500)
        tap("[data-a='finish']", 700); tap("[data-a='save']", 1200); shot("11_finish")
        ok("finish page shows 'Muscles worked'", "Muscles worked" in txt() and pg.locator(".mpill").count() >= 1)
        tap("[data-a='home']", 600)
    tab("log", 600); tap(".row[data-p='visit'] >> nth=0", 900)
    ok("each visit shows the muscles it worked", "Muscles worked" in txt())
    ok("no page errors (English)", not errs, errs[:3])
    ctx.close()

    # ================= Arabic: the same pages, nothing left in English =================
    ctx, pg, errs, MISS = newpage("ar")
    W = lambda ms=400: pg.wait_for_timeout(ms)
    def tap(sel, ms=450):
        el = pg.locator(sel).first; el.evaluate("e=>e.scrollIntoView({block:'center'})"); el.click(); W(ms)
    def go_page(p_, **a):
        pg.evaluate("([p,a])=>{show(p,a)}", [p_, a]); W(800)
    pg.goto(f"http://127.0.0.1:{PORT}/index.html"); W(1800)
    ok("Arabic: right-to-left", pg.evaluate("document.documentElement.dir") == "rtl")
    tab("muscles", 1000)
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, "20_ar_muscles.png"), full_page=True)
    ok("Arabic tab label", pg.locator("nav.tabs [data-tab='muscles']").inner_text().strip() != "Muscles")
    for r_ in ("last", "avg4", "week"): tap(f"[data-a='mrange'][data-r='{r_}']", 400)
    tap(".mrow >> nth=0", 1400)
    go_page("muscle", id="cu"); go_page("muscle", id="ch")
    pg.evaluate("TAB='routines';STACK=[];render()"); W(400)
    tap("[data-p='library']", 1300); tap("[data-a='lview'][data-v='muscle']", 700)
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, "21_ar_library_muscle.png"), full_page=True)
    tap("[data-a='lview'][data-v='search']", 500); tap("[data-a='lg'][data-g='1']", 500); tap("[data-a='lm'] >> nth=1", 500)
    pg.fill("#libq", "zzqq"); W(600); pg.fill("#libq", ""); W(300)
    go_page("gear"); pg.locator(".gearrow").first.click(); W(400)
    pg.evaluate("TAB='routines';STACK=[];render()"); W(400)
    go_page("library", mode="")
    pg.evaluate("TAB='routines';STACK=[];render()"); W(400)
    go_page("setup")
    for k, v in (("goal", "fat"), ("exp", "some"), ("days", "5"), ("kit", "home")): tap(f"[data-a='su'][data-k='{k}'][data-v='{v}']", 300)
    W(800)
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, "22_ar_setup.png"), full_page=True)
    go_page("report", e="rR0LJzx"); go_page("report", q="x")
    go_page("reports"); W(500)
    pid = pg.evaluate("S.program[0].id"); go_page("editor", id=pid); tap("[data-a='wday'][data-d='3']", 500)
    go_page("exercise", e="eYnzaCm")
    pg.evaluate("TAB='today';STACK=[];render()"); W(600)
    pg.evaluate("TAB='routines';STACK=[];render()"); W(500)
    go_page("custom", mode="")
    real = sorted(k for k in MISS if not re.fullmatch(r"(Full Body .*|Upper .*|Lower .*|Workout .*|.*[a-z]+ (press|row|curl|raise|fly|squat|pulldown).*)", k, re.I))
    ok("Arabic: no English left on the new pages (names excepted)", not real, real[:40])
    json.dump(real, open("/tmp/w/armiss.json", "w"), ensure_ascii=False, indent=0) if os.path.isdir("/tmp/w") else None
    ok("no page errors (Arabic)", not errs, errs[:3])
    br.close()

n_fail = sum(1 for _, c in res if not c)
print(f"\nE2E lift 4.5: PASS {len(res) - n_fail}  FAIL {n_fail}")
sys.exit(1 if n_fail else 0)
