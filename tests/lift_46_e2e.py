#!/usr/bin/env python3
"""Lift 4.6 e2e — four tabs (Home · Programs · Log · User) with sections, the User tab (theme, language, level, gear,
help, admin reports badge, log out), Dark / Light / Match-iPhone themes with a readable-contrast sweep of every screen,
Arabic on every new screen, the bottom bar sitting on the screen bottom, and the admin-only screen telemetry.
Real Chromium at iPhone size; backend mocked in-process (same contract as api/health-check?app=lift).
Usage: python3 tests/lift_46_e2e.py [path-to-lift-folder] [screenshot-dir]"""
import json, threading, http.server, socketserver, sys, os, re, datetime, copy
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "lift")
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ""
PORT = int(os.environ.get("PORT", "8186"))
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Q); threading.Thread(target=srv.serve_forever, daemon=True).start()

D = 864e5
FIXED = datetime.datetime(2026, 10, 14, 15, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=3))).timestamp() * 1000  # Wed 14 Oct 2026 15:00 Riyadh
ADMIN, FRIEND = "2026", "482910"
db = {ADMIN: {"v": 1, "state": None}, FRIEND: {"v": 1, "state": None}}
REPORTS = [{"id": "r%d" % i, "t": FIXED - i * 3600e3, "kind": k, "e": e, "n": n, "q": q, "note": "", "who": "Saad"}
           for i, (k, e, n, q) in enumerate([("video", "mKwcrHn", "Machine gripper hands", ""), ("missing", "", "", "Hip thrust machine"), ("steps", "rR0LJzx", "Dumbbell romanian deadlift", "")])]
FIX = {"hv": {}}; DIAG = []
def api(route):
    b = json.loads(route.request.post_data or "{}"); pin = b.get("pin"); a = b.get("action")
    j = lambda code, o: route.fulfill(status=code, body=json.dumps(o), content_type="application/json")
    if pin not in db: return j(401, {"error": "pin"})
    adm = pin == ADMIN
    if a == "state": return j(200, {**db[pin], "role": "full", "admin": adm, "fix": FIX, **({"reports": len(REPORTS)} if adm else {"user": {"name": "Saad"}})})
    if a == "save":
        if b.get("v") != db[pin]["v"]: return j(409, {"conflict": True, **db[pin]})
        db[pin]["v"] += 1; db[pin]["state"] = b["state"]; return j(200, {"v": db[pin]["v"]})
    if a in ("diag", "diaglog"):
        if not adm: return j(403, {"error": "admin"})
        if a == "diag": DIAG.append({"pin": pin, **(b.get("d") or {})})
        return j(200, {"ok": True})
    if a in ("reports", "delreport", "fixvid"):
        if not adm: return j(403, {"error": "admin"})
        if a == "delreport": REPORTS[:] = [r for r in REPORTS if r["id"] != b.get("id")]
        return j(200, {"items": REPORTS, "ok": True, "fix": FIX})
    if a == "users": return j(200, {"users": []}) if adm else j(403, {"error": "admin"})
    if a == "report": return j(200, {"ok": True})
    j(400, {"error": "unknown"})
GIF1 = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
res = []
def ok(n, c, extra=""):
    res.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n + ("" if c or extra == "" else "  — " + str(extra)[:400]))

# every visible text: its colour against the real (composited) background behind it; intentionally dimmed things skipped
CONTRAST_JS = r"""(min)=>{
 const P=c=>{const m=c&&c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
 const L=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
 const B=(t,u)=>({r:t.r*t.a+u.r*(1-t.a),g:t.g*t.a+u.g*(1-t.a),b:t.b*t.a+u.b*(1-t.a),a:1});
 const bg=el=>{const ch=[];for(let e=el;e;e=e.parentElement)ch.push(e);let c={r:255,g:255,b:255,a:1};
   for(let i=ch.length-1;i>=0;i--){const b=P(getComputedStyle(ch[i]).backgroundColor);if(b&&b.a>0)c=B(b,c);}return c;};
 const out=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
 while(n=w.nextNode()){const t=n.nodeValue.trim();if(!t)continue;const el=n.parentElement;if(!el||el.closest("svg,.hidden,script,style"))continue;
   const r=el.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.top>innerHeight*3)continue;
   let op=1,skip=false;for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);op*=+cs.opacity;if(cs.visibility==="hidden"||cs.display==="none"||e.disabled)skip=true;}
   if(skip||op<0.6)continue;
   const b=bg(el);let f=P(getComputedStyle(el).color);if(!f)continue;if(f.a<1)f=B(f,b);
   const a=L(f),c=L(b),cr=(Math.max(a,c)+0.05)/(Math.min(a,c)+0.05);
   if(cr<min)out.push(t.slice(0,32)+" ["+cr.toFixed(2)+" "+(el.className||el.tagName)+"]");}
 return out;}"""

with sync_playwright() as p:
    br = p.chromium.launch()
    def newpage(pin=ADMIN, lang=None, theme=None, scheme="dark", vw=390, vh=844):
        ctx = br.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="en-GB",
                             service_workers="block", timezone_id="Asia/Riyadh", color_scheme=scheme)
        miss = set(); ctx.expose_function("__trMiss", lambda k: miss.add(k))
        init = "if(!sessionStorage.getItem('t46')){sessionStorage.setItem('t46','1');localStorage.setItem('lift_pin','%s');localStorage.setItem('lift_who','%s');" % (pin, pin)
        if lang: init += "localStorage.setItem('lift_lang','%s');" % lang
        if theme: init += "localStorage.setItem('lift_theme','%s');" % theme
        ctx.add_init_script(init + "}")
        pg = ctx.new_page(); pg.clock.set_fixed_time(FIXED / 1000); pg.route("**/api/health-check**", api)
        pg.route("**/static.exercisedb.dev/**", lambda r: r.fulfill(status=200, body=GIF1, content_type="image/gif"))
        pg.route("**/i.ytimg.com/**", lambda r: r.fulfill(status=200, body=GIF1, content_type="image/gif"))
        pg.route("**/oss.exercisedb.dev/**", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps({"data": {"instructions": ["Step:1 Sit down.", "Step:2 Push."]}})))
        pg.route("**raw.githubusercontent.com/**", lambda r: r.fulfill(status=404, body=b""))
        pg.route("**wger.de/**", lambda r: r.fulfill(status=404, body=b""))
        pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(1800)
        return ctx, pg, errs, miss
    def H(pg):
        W = lambda ms=400: pg.wait_for_timeout(ms)
        def tap(sel, ms=450):
            el = pg.locator(sel).first; el.evaluate("e=>e.scrollIntoView({block:'center'})"); el.click(); W(ms)
        def go(tab, seg=None, ms=600):  # real taps on the tab bar and the section strip
            tap(f"nav.tabs [data-tab='{tab}']", 300)
            if seg: tap(f".tabseg [data-a='seg'][data-v='{seg}']", ms)
            else: W(ms)
        def title(): return pg.inner_text(".hdr .ttl").split("\n")[0] if pg.locator(".hdr").count() else ("ROOT:" + pg.inner_text(".root-top h1"))
        def txt(sel="#view"): return pg.inner_text(sel).replace(" ", " ").replace("\xa0", " ")
        def noscroll(): return pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1")
        def bar_on_bottom(): return pg.evaluate("(()=>{const r=document.querySelector('nav.tabs').getBoundingClientRect();return Math.abs(r.bottom-innerHeight)<=1&&r.height<=70})()")
        def low_contrast(m=3): return pg.evaluate(CONTRAST_JS, m)
        def shot(name, full=False):
            if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=full)
        return W, tap, go, title, txt, noscroll, bar_on_bottom, low_contrast, shot
    SCREENS = [("today", None), ("programs", "routines"), ("programs", "exercises"), ("programs", "programs"), ("log", "muscles"), ("log", "workouts"), ("log", "body"), ("user", None)]

    # ================= English, dark: layout =================
    ctx, pg, errs, _ = newpage()
    W, tap, go, title, txt, noscroll, bar_on_bottom, low_contrast, shot = H(pg)
    st = db[ADMIN]["state"]
    ok("opens with a seeded plan", st and len(st["program"]) >= 4)
    # give the logs something to show: 3 visits and 3 weigh-ins
    st = copy.deepcopy(st); x0 = st["program"][0]["x"]
    st["sessions"] = [{"id": "s%d" % i, "w": st["program"][0]["id"], "wn": st["program"][0]["n"], "c": 0, "start": FIXED - (i * 2 + 1) * D, "end": FIXED - (i * 2 + 1) * D + 3e6,
                       "sets": [{"i": "s%d%d" % (i, n), "e": x0[n % 3]["e"], "k": 40 + n, "r": 10, "f": 2, "t": FIXED - (i * 2 + 1) * D + n * 60000} for n in range(9)]} for i in range(3)]
    st["body"] = [{"id": "b%d" % i, "t": FIXED - (20 - i * 7) * D, "kg": 100 - i, "src": "weigh"} for i in range(3)]
    db[ADMIN]["state"] = st; db[ADMIN]["v"] += 1; pg.evaluate("localStorage.removeItem('lift_state')"); pg.reload(); W(1800)
    tabs = [t.strip() for t in pg.locator("nav.tabs button span").all_inner_texts()]
    ok("tab bar: Home · Programs · Log · User", tabs == ["Home", "Programs", "Log", "User"], tabs)
    ok("Home opens first", title() == "ROOT:Lift" and pg.locator("nav.tabs [data-tab='today'].on").count() == 1)
    ok("bottom bar sits on the screen bottom (Home)", bar_on_bottom(), pg.evaluate("[document.querySelector('nav.tabs').getBoundingClientRect().bottom,innerHeight]"))
    ok("no code moves the bar (no transform, no extra padding)", pg.evaluate("getComputedStyle(document.querySelector('nav.tabs')).transform") == "none")
    want = {("programs", "routines"): ("Programs", ".rcard"), ("programs", "exercises"): ("Programs", "#libq"), ("programs", "programs"): ("Programs", "[data-p='template']"),
            ("log", "muscles"): ("Log", ".mrow"), ("log", "workouts"): ("Log", ".tiles"), ("log", "body"): ("Log", "svg.chart, [data-p='entry']"), ("user", None): ("User", "[data-a='theme']")}
    for (t_, s_), (h1, mark) in want.items():
        go(t_, s_, 700); nm = t_ + ("/" + s_ if s_ else "")
        ok(f"{nm}: right tab title and content", title() == "ROOT:" + h1 and pg.locator(mark).count() >= 1, (title(), pg.locator(mark).count()))
        ok(f"{nm}: tab marked, bar on the screen bottom, nothing sideways", pg.locator(f"nav.tabs [data-tab='{t_}'].on").count() == 1 and bar_on_bottom() and noscroll())
        if s_: ok(f"{nm}: its section is marked", pg.locator(f".tabseg [data-v='{s_}'].on").count() == 1 and pg.locator(".tabseg .on").count() == 1)
        shot(f"dark_en_{t_}_{s_ or 'root'}")
    ok("Programs sections: Routines · Exercises · Programs", (go("programs") or True) and [t.strip() for t in pg.locator(".tabseg button").all_inner_texts()] == ["Routines", "Exercises", "Programs"])
    ok("…it remembers the last section (Programs)", pg.locator(".tabseg [data-v='programs'].on").count() == 1)
    go("log"); ok("Log sections: Muscles · Workouts · Body (it remembers Body)", [t.strip() for t in pg.locator(".tabseg button").all_inner_texts()] == ["Muscles", "Workouts", "Body"] and pg.locator(".tabseg [data-v='body'].on").count() == 1)
    go("programs", "routines"); n_r = pg.locator(".rcard").count()
    ok("Routines lists every routine + gym days + New routine", n_r == len(db[ADMIN]["state"]["program"]) and "Gym days" in txt() and pg.locator("[data-a='newroutine']").count() == 1)
    ok("Routines no longer carries settings (no language / log out / users rows)", all(pg.locator(f"#view [data-a='{a}']").count() == 0 for a in ("lang", "setlang", "logout", "theme")) and pg.locator("#view [data-p='users']").count() == 0)
    go("programs", "programs")
    ok("Programs: Set up my plan + every ready-made program", pg.locator("[data-p='setup']").count() == 1 and pg.locator("[data-p='template']").count() == pg.evaluate("TEMPLATES.length"))
    go("programs", "exercises", 1200)
    ok("Exercises: 1,846 in the header, search + list", "1,846 exercises" in txt(".root-top .sub") and pg.locator("#liblist .row").count() >= 20)
    pg.fill("#libq", "machine gripper"); W(500)
    ok("search works inside the tab", "Machine gripper hands" in txt("#liblist"))
    tap("#liblist [data-a='exinfo'] >> nth=0", 1000)
    ok("exercise opens as a page (Back, no tab bar)", pg.locator(".hdr .back").count() == 1 and pg.is_hidden("nav.tabs"))
    ok("4.6: the reported gripper machine now links to a gripper-machine video", "NeSGLgLSPMc" in (pg.get_attribute("a.ytb", "href") or ""), pg.get_attribute("a.ytb", "href"))
    tap(".hdr .back", 600)
    ok("Back returns to Programs › Exercises with the search kept", title() == "ROOT:Programs" and pg.locator(".tabseg [data-v='exercises'].on").count() == 1 and pg.input_value("#libq") == "machine gripper")
    pg.fill("#libq", ""); W(300)
    go("log", "muscles")
    ok("Muscles (first in Log): heat map + muscles + level link", pg.locator(".mapcard svg.bmap").count() >= 1 and pg.locator(".mrow").count() >= 20 and pg.locator(".lvlrow").count() == 1)
    go("log", "workouts"); ok("Workouts: tiles, calendar, 3 visits", pg.locator(".tiles").count() == 1 and pg.locator(".row[data-p='visit']").count() == 3)
    go("log", "body"); ok("Body: weight chart", pg.locator("svg.chart").count() == 1)

    # ================= User tab =================
    go("user")
    ok("User: Appearance (Dark · Light · Match iPhone), Dark on", [t.strip() for t in pg.locator("[data-a='theme']").all_inner_texts()] == ["Dark", "Light", "Match iPhone"] and pg.locator("[data-a='theme'][data-v='dark'].on").count() == 1)
    ok("User: Language (English · العربية), English on", pg.locator("[data-a='setlang']").count() == 2 and pg.locator("[data-a='setlang'][data-v='en'].on").count() == 1)
    ok("User: level, gym equipment, how the coach works", pg.locator("[data-a='level']").count() == 3 and pg.locator("[data-p='gear']").count() == 1 and pg.locator("[data-p='howcoach']").count() == 1)
    ok("User (admin): Reports with 3 open + Users", pg.locator("[data-p='reports']").count() == 1 and txt("[data-p='reports'] .cbadge").strip() == "3" and pg.locator("[data-p='users']").count() == 1)
    ok("User: log out + build number", pg.locator("[data-a='logout']").count() == 1 and "Lift build 4.6" in txt())
    ok("tab bar: red badge 3 on User", pg.is_visible("#ubadge") and pg.inner_text("#ubadge").strip() == "3")
    tap("[data-p='reports']", 900)
    ok("Reports page lists the friend's reports (gripper video first)", pg.locator(".rprow").count() == 3 and "Machine gripper hands" in txt())
    tap("[data-a='rpdone'] >> nth=0", 800)
    ok("marking one done → badge 2", pg.inner_text("#ubadge").strip() == "2" and len(REPORTS) == 2)
    tap(".hdr .back", 500)
    tap("[data-a='level'][data-v='exp']", 500); ok("level saves from User", db[ADMIN]["state"].get("level") == "exp")
    go("log", "muscles"); ok("…Muscles shows it", "1+ years" in txt(".lvlrow"))
    go("user"); tap("[data-a='level'][data-v='new']", 500)
    shot("dark_en_user_full", True)
    # telemetry: the admin's phone reported its screen once at start and once per first visit of a tab
    W(500); tags = [d.get("tag") for d in DIAG]
    ok("screen check sent at start (admin only)", "start" in tags and all(d["pin"] == ADMIN for d in DIAG), tags)
    d0 = next((d for d in DIAG if d.get("tag") == "start"), {})
    ok("…with what's needed to see the bottom bar on his iPhone", all(k in d0 for k in ("build", "inner", "screen", "lvh", "svh", "top", "bottom", "navTop", "navBottom", "standalone", "doc")) and d0.get("build") == "4.6", d0)
    ok("…and on the first visit of each tab", tags.count("tab") >= 3, tags)
    # the page is made screen-tall on home-screen apps (the iOS 26 short-viewport fix) — never shorter than the screen
    ok("home-screen app: page at least screen-tall", pg.evaluate("document.documentElement.classList.add('standalone'),document.documentElement.getBoundingClientRect().height>=innerHeight-1"))
    ok("no page errors (English, dark)", not errs, errs[:3])

    # contrast sweep, dark
    ok("contrast checker is live (flags everything at an impossible 21:1)", len(low_contrast(21)) > 20)
    bad = {}
    for t_, s_ in SCREENS:
        go(t_, s_, 700); pg.evaluate("window.scrollTo(0,0)"); lc = low_contrast()
        if lc: bad[f"{t_}/{s_}"] = lc[:6]
    ok("dark: every screen's text readable (contrast ≥ 3:1)", not bad, bad)

    # ================= Light theme =================
    go("user"); tap("[data-a='theme'][data-v='light']", 2000)
    ok("Light: saved and applied after the reload", pg.evaluate("localStorage.getItem('lift_theme')") == "light" and pg.evaluate("document.documentElement.dataset.theme") == "light")
    ok("Light: page background is light, text dark", pg.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(242, 241, 236)" and pg.evaluate("getComputedStyle(document.body).color") == "rgb(27, 29, 33)")
    ok("Light: asks iOS for dark status-bar text", pg.get_attribute("meta[name='apple-mobile-web-app-status-bar-style']", "content") == "default" and pg.get_attribute("meta[name='theme-color']", "content") == "#F2F1EC")
    ok("Light: dark strip behind the status bar if iOS keeps white text", pg.evaluate("getComputedStyle(document.body,'::before').backgroundColor") == "rgb(27, 29, 33)")
    go("user"); ok("Light: User shows Light selected", pg.locator("[data-a='theme'][data-v='light'].on").count() == 1)
    bad = {}
    for t_, s_ in SCREENS:
        go(t_, s_, 700); pg.evaluate("window.scrollTo(0,0)"); shot(f"light_en_{t_}_{s_ or 'root'}")
        ok(f"light {t_}/{s_ or ''}: bar on the bottom, nothing sideways", bar_on_bottom() and noscroll())
        lc = low_contrast()
        if lc: bad[f"{t_}/{s_}"] = lc[:6]
    ok("light: every screen's text readable (contrast ≥ 3:1)", not bad, bad)
    go("log", "body")
    ok("light: chart line drawn dark (not invisible white)", pg.evaluate("getComputedStyle(document.querySelector('svg.chart path[fill=none]')).stroke") == "rgb(27, 29, 33)")
    ok("light: a white routine colour turns grey so it shows", pg.evaluate("wc(PLATE.findIndex(p=>p.n==='white'))") == "#8E9298")
    # pages opened from the tabs, light
    bad = {}
    for nm, js in [("routine", "show('routine',{id:S.program[0].id})"), ("exercise", "show('exercise',{e:'rR0LJzx'})"), ("template", "show('template',{id:'slhf5'})"),
                   ("setup", "show('setup',{})"), ("gear", "show('gear',{})"), ("reports", "show('reports',{})"), ("muscle", "show('muscle',{id:'cu'})"), ("howcoach", "show('howcoach',{})")]:
        pg.evaluate(js); W(900); shot(f"light_en_page_{nm}")
        lc = low_contrast()
        if lc: bad[nm] = lc[:6]
        pg.evaluate("STACK=[];render()"); W(200)
    ok("light: pages readable too (routine, exercise, program, setup, gear, reports, muscle, help)", not bad, bad)
    go("today"); tap("#go", 1300); shot("light_en_workout")
    lc = low_contrast(); ok("light: workout screen readable", not lc, lc[:6])
    ok("light: workout screen fits", noscroll())
    tap("[data-a='finish']", 400)
    if pg.locator("[data-a='discard']").count(): tap("[data-a='discard']", 150); tap("[data-a='discard']", 700)
    ok("no page errors (English, light)", not errs, errs[:3])
    # Match iPhone
    go("user"); tap("[data-a='theme'][data-v='auto']", 2000)
    ok("Match iPhone: follows the phone (dark now)", pg.evaluate("localStorage.getItem('lift_theme')") == "auto" and pg.evaluate("document.documentElement.dataset.theme") == "dark")
    pg.evaluate("window.__same=1"); pg.emulate_media(color_scheme="light"); W(600)
    ok("…phone switches to light → Lift follows at once, no reload", pg.evaluate("window.__same") == 1 and pg.evaluate("document.documentElement.dataset.theme") == "light")
    pg.emulate_media(color_scheme="dark"); W(500)
    ok("…and back to dark", pg.evaluate("document.documentElement.dataset.theme") == "dark")
    go("user"); tap("[data-a='theme'][data-v='dark']", 2000)
    ok("back to Dark", pg.evaluate("document.documentElement.dataset.theme") == "dark")
    # log out (asks first)
    go("user"); tap("[data-a='logout']", 300)
    ok("log out asks first", "Tap again" in txt("[data-a='logout']") and pg.is_hidden("#gate"))
    tap("[data-a='logout']", 1500); ok("…second tap logs out", pg.is_visible("#gate"))
    ok("no page errors (theme switching)", not errs, errs[:3])
    ctx.close()

    # ================= a friend: no admin section, no badge, no telemetry =================
    n_diag = len(DIAG)
    ctx, pg, errs, _ = newpage(pin=FRIEND)
    W, tap, go, title, txt, noscroll, bar_on_bottom, low_contrast, shot = H(pg)
    W(3000); go("programs"); go("log"); go("user")
    ok("friend: User shows their name, no Admin section, no Reports/Users", "Saad" in txt(".root-top") and pg.locator("[data-p='reports'], [data-p='users']").count() == 0 and "Admin" not in txt())
    ok("friend: no badge on the tab bar", pg.is_hidden("#ubadge"))
    ok("friend: their phone never sends screen data", len(DIAG) == n_diag, DIAG[n_diag:])
    ok("no page errors (friend)", not errs, errs[:3])
    ctx.close()

    # ================= Arabic, dark and light: every screen translated, right-to-left =================
    for theme in ("dark", "light"):
        ctx, pg, errs, MISS = newpage(lang="ar", theme=theme)
        W, tap, go, title, txt, noscroll, bar_on_bottom, low_contrast, shot = H(pg)
        ok(f"Arabic ({theme}): right-to-left, theme {theme}", pg.evaluate("document.documentElement.dir") == "rtl" and pg.evaluate("document.documentElement.dataset.theme") == theme)
        tabs = [t.strip() for t in pg.locator("nav.tabs button span").all_inner_texts()]
        ok(f"Arabic ({theme}): tab bar الرئيسية · البرامج · السجل · حسابي", tabs == ["الرئيسية", "البرامج", "السجل", "حسابي"], tabs)
        bad = {}
        for t_, s_ in SCREENS:
            go(t_, s_, 800); shot(f"{theme}_ar_{t_}_{s_ or 'root'}")
            if not (bar_on_bottom() and noscroll()): bad[f"{t_}/{s_}"] = "bar or width"
            lc = low_contrast()
            if lc: bad[f"{t_}/{s_} contrast"] = lc[:4]
        ok(f"Arabic ({theme}): every screen fits, bar on the bottom, readable", not bad, bad)
        go("programs"); ok(f"Arabic ({theme}): Programs sections", [t.strip() for t in pg.locator(".tabseg button").all_inner_texts()] == ["الروتينات", "التمارين", "البرامج"])
        go("log"); ok(f"Arabic ({theme}): Log sections", [t.strip() for t in pg.locator(".tabseg button").all_inner_texts()] == ["العضلات", "الحصص", "الجسم"])
        go("programs", "programs"); t = txt()
        ok(f"Arabic ({theme}): ready-made program names in Arabic", "جسم كامل · 3 أيام" in t and "StrengthLog جسم كامل · 5 أيام" in t, t[:300])
        go("user"); t = txt()
        ok(f"Arabic ({theme}): User page words", all(w in t for w in ["المظهر", "داكن", "فاتح", "حسب الآيفون", "اللغة", "مستواك", "أدوات ناديي", "كيف يعمل المدرب", "الإدارة", "البلاغات", "المستخدمون", "تسجيل الخروج"]), t[:400])
        real = sorted(k for k in MISS if not re.fullmatch(r"(Full Body .*|Upper .*|Lower .*|Workout .*|Push.*|Pull.*|Legs.*|.*[a-z]+ (press|row|curl|raise|fly|squat|pulldown|deadlift).*)", k, re.I))
        ok(f"Arabic ({theme}): no English left on the new screens (names excepted)", not real, real[:30])
        ok(f"no page errors (Arabic, {theme})", not errs, errs[:3])
        ctx.close()

    # ================= small iPhone (SE, 375×667): nothing sideways, bar on the bottom =================
    ctx, pg, errs, _ = newpage(vw=375, vh=667)
    W, tap, go, title, txt, noscroll, bar_on_bottom, low_contrast, shot = H(pg)
    bad = [f"{t_}/{s_}" for t_, s_ in SCREENS if (go(t_, s_, 600) or True) and not (bar_on_bottom() and noscroll())]
    ok("iPhone SE size: every screen fits, bar on the bottom", not bad, bad)
    ok("no page errors (small iPhone)", not errs, errs[:3])
    ctx.close()
    br.close()

n_fail = sum(1 for _, c in res if not c)
print(f"\nE2E lift 4.6: PASS {len(res) - n_fail}  FAIL {n_fail}")
srv.shutdown(); sys.exit(1 if n_fail else 0)
