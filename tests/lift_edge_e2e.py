#!/usr/bin/env python3
"""Lift 4.13 "The Edge" — checks the redesign itself (look, hierarchy, accessibility) on top of the functional suites.
Real Chromium at iPhone sizes, backend mocked in-process (same contract as api/health-check?app=lift).
Usage: python3 tests/lift_edge_e2e.py [path-to-lift-folder]   (default: lift-test)"""
import json, threading, http.server, socketserver, sys, os, datetime, copy
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "lift-test")
PORT = int(os.environ.get("PORT", "8189"))
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Q); threading.Thread(target=srv.serve_forever, daemon=True).start()

D = 864e5
FIXED = datetime.datetime(2026, 10, 14, 15, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=3))).timestamp() * 1000  # Wed 14 Oct 2026 15:00 Riyadh
ADMIN = "2026"
db = {"v": 1, "state": None}
SEED = {}
def api(route):
    b = json.loads(route.request.post_data or "{}"); a = b.get("action")
    j = lambda code, o: route.fulfill(status=code, body=json.dumps(o), content_type="application/json")
    if b.get("pin") != ADMIN: return j(401, {"error": "pin"})
    if a == "state": return j(200, {**db, "role": "full", "admin": True, "fix": {"hv": {}}, "reports": 2})
    if a == "save":
        if b.get("v") != db["v"]: return j(409, {"conflict": True, **db})
        db["v"] += 1; db["state"] = b["state"]; return j(200, {"v": db["v"]})
    if a == "pushget": return j(200, {"ok": True, "on": False, "phones": 0, "prefs": {"on": 1, "time": "17:00", "day": 1, "miss": 1, "week": 1, "open": 1}, "log": []})
    return j(200, {"ok": True, "items": [], "users": [], "accounts": [], "people": [], "history": []})
GIF1 = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
res = []
def ok(n, c, extra=""):
    res.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n + ("" if c or extra == "" else "  — " + str(extra)[:500]), flush=True)

# WCAG: 4.5:1 for ordinary text, 3:1 for large text (≥24px, or ≥18.66px bold). Text vs the real composited background.
CONTRAST_JS = r"""()=>{
 const P=c=>{const m=c&&c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
 const L=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
 const B=(t,u)=>({r:t.r*t.a+u.r*(1-t.a),g:t.g*t.a+u.g*(1-t.a),b:t.b*t.a+u.b*(1-t.a),a:1});
 const bg=el=>{const ch=[];for(let e=el;e;e=e.parentElement)ch.push(e);let c={r:255,g:255,b:255,a:1};
   for(let i=ch.length-1;i>=0;i--){const b=P(getComputedStyle(ch[i]).backgroundColor);if(b&&b.a>0)c=B(b,c);}return c;};
 const out=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
 while(n=w.nextNode()){const t=n.nodeValue.trim();if(!t)continue;const el=n.parentElement;if(!el||el.closest("svg,.hidden,script,style,.gif,.media,.herogif .tag"))continue;
   const r=el.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.top>innerHeight*3)continue;
   let op=1,skip=false;for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);op*=+cs.opacity;if(cs.visibility==="hidden"||cs.display==="none"||e.disabled)skip=true;}
   if(skip||op<0.6)continue;
   const cs=getComputedStyle(el),fs=parseFloat(cs.fontSize),fw=parseInt(cs.fontWeight)||400,large=fs>=24||(fs>=18.66&&fw>=700),min=large?3:4.5;
   const b=bg(el);let f=P(cs.color);if(!f)continue;if(f.a<1)f=B(f,b);
   const a=L(f),c=L(b),cr=(Math.max(a,c)+0.05)/(Math.min(a,c)+0.05);
   if(cr<min)out.push(t.slice(0,28)+" ["+cr.toFixed(2)+"<"+min+" "+(el.className||el.tagName)+"]");}
 return out;}"""
# every visible button/control: at least 44 × 44 (inline text links inside sentences excluded)
TOUCH_JS = r"""()=>{const out=[];document.querySelectorAll("button,input,[data-a]").forEach(e=>{
  if(e.closest(".hidden,svg")||e.disabled)return;const r=e.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.top>innerHeight)return;
  const cs=getComputedStyle(e);if(cs.visibility==="hidden"||cs.display==="none")return;if(e.tagName==="INPUT"&&e.type==="hidden")return;
  if(r.height<43.5||r.width<43.5)out.push((e.getAttribute("data-a")||e.tagName)+" "+(e.className||"")+" "+Math.round(r.width)+"x"+Math.round(r.height)+" «"+(e.textContent||"").trim().slice(0,18)+"»");});
  return out;}"""

with sync_playwright() as p:
    br = p.chromium.launch()
    def newpage(lang=None, theme="dark", vw=390, vh=844, motion="no-preference"):
        ctx = br.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="en-GB",
                             service_workers="block", timezone_id="Asia/Riyadh", reduced_motion=motion)
        miss = set(); ctx.expose_function("__trMiss", lambda k: miss.add(k))
        init = "if(!sessionStorage.getItem('te')){sessionStorage.setItem('te','1');localStorage.setItem('lift_pin','%s');localStorage.setItem('lift_who','%s');localStorage.setItem('lift_theme','%s');" % (ADMIN, ADMIN, theme)
        if lang: init += "localStorage.setItem('lift_lang','%s');" % lang
        ctx.add_init_script(init + "}")
        pg = ctx.new_page(); pg.clock.set_fixed_time(FIXED / 1000); pg.route("**/api/health-check**", api)
        pg.route("**/static.exercisedb.dev/**", lambda r: r.fulfill(status=200, body=GIF1, content_type="image/gif"))
        for pat in ("**/i.ytimg.com/**", "**raw.githubusercontent.com/**", "**wger.de/**", "**/oss.exercisedb.dev/**", "**fonts.g*/**"):
            pg.route(pat, lambda r: r.fulfill(status=404, body=b""))
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(1700)
        return ctx, pg, errs, miss
    def H(pg):
        W = lambda ms=400: pg.wait_for_timeout(ms)
        def tap(sel, ms=450):
            el = pg.locator(sel).first; el.evaluate("e=>e.scrollIntoView({block:'center'})"); el.click(); W(ms)
        def go(tab, seg=None, ms=600):
            tap(f"nav.tabs [data-tab='{tab}']", 300)
            if seg: tap(f".tabseg [data-a='seg'][data-v='{seg}']", ms)
            else: W(ms)
            pg.evaluate("window.scrollTo(0,0)")
        css = lambda sel, prop, pseudo=None: pg.evaluate("([s,p,q])=>{const e=document.querySelector(s);return e?getComputedStyle(e,q).getPropertyValue(p):null}", [sel, prop, pseudo])
        return W, tap, go, css
    SCREENS = [("today", None), ("programs", "routines"), ("programs", "exercises"), ("programs", "programs"), ("log", "muscles"), ("log", "workouts"), ("log", "body"), ("user", None)]
    ORANGE, INK, ORANGE_TXT = "rgb(255, 85, 56)", "rgb(11, 17, 21)", "rgb(255, 106, 80)"

    # ================= seed: 3 visits + weigh-ins so every screen has content =================
    ctx, pg, errs, _ = newpage()
    W, tap, go, css = H(pg)
    st = copy.deepcopy(db["state"]); x0 = st["program"][0]["x"]
    st["sessions"] = [{"id": "s%d" % i, "w": st["program"][0]["id"], "wn": st["program"][0]["n"], "c": st["program"][0]["c"], "start": FIXED - (i * 2 + 1) * D, "end": FIXED - (i * 2 + 1) * D + 3e6,
                       "sets": [{"i": "s%d%d" % (i, n), "e": x0[n % 3]["e"], "k": 40 + n, "r": 10, "f": 2, "t": FIXED - (i * 2 + 1) * D + n * 60000} for n in range(9)]} for i in range(3)]
    st["body"] = [{"id": "b%d" % i, "t": FIXED - (20 - i * 7) * D, "kg": 100 - i, "src": "weigh"} for i in range(3)]
    db["state"] = st; db["v"] += 1; SEED.update(copy.deepcopy(st))
    pg.evaluate("localStorage.removeItem('lift_state')"); pg.reload(); W(1700)

    # ================= identity + navigation =================
    ok("this is The Edge build", pg.evaluate("typeof DESIGN!=='undefined'&&DESIGN==='edge'") and pg.evaluate("BUILD_ID") >= "4.13", pg.evaluate("BUILD_ID"))
    ok("bottom bar: Home · Train · Progress · You", [t.strip() for t in pg.locator("nav.tabs button span").all_text_contents()] == ["Home", "Train", "Progress", "You"])
    ok("…same route ids underneath (today / programs / log / user)", pg.eval_on_selector_all("nav.tabs button", "b=>b.map(x=>x.dataset.tab)") == ["today", "programs", "log", "user"])
    ok("…current tab in Edge orange, the others readable grey", css("nav.tabs button.on", "color") == ORANGE_TXT and css("nav.tabs button:not(.on)", "color") == "rgb(154, 166, 173)")
    ok("…the bar is still glued to the bottom and compact", pg.evaluate("(()=>{const r=document.querySelector('nav.tabs').getBoundingClientRect();return Math.abs(r.bottom-innerHeight)<=1&&r.height<=66})()"))
    for tab, seg in SCREENS[1:]:
        go(tab, seg)
        good = pg.locator(f".tabseg [data-v='{seg}'].on").count() == 1 if seg else True
        ok(f"{tab}/{seg or '-'}: reachable, title in capitals" + (", its pill lit orange" if seg else ""),
           good and css(".root-top h1", "text-transform") == "uppercase" and (not seg or css(".tabseg button.on", "background-color") == ORANGE) and pg.locator("nav.tabs").is_visible())
    go("programs", "routines")
    widths = pg.eval_on_selector_all(".tabseg button", "b=>b.map(x=>Math.round(x.getBoundingClientRect().width))")
    ok("Train: three equal sub-tabs Routines · Exercises · Programs", len(widths) == 3 and max(widths) - min(widths) <= 1 and [t.strip() for t in pg.locator(".tabseg button").all_text_contents()] == ["Routines", "Exercises", "Programs"], widths)
    go("log", "muscles")
    ok("Progress: three equal sub-tabs Muscles · Workouts · Body", [t.strip() for t in pg.locator(".tabseg button").all_text_contents()] == ["Muscles", "Workouts", "Body"])

    # ================= Home =================
    go("today")
    ok("Home header: LIFT/ mark (orange slash), date in capitals", pg.locator(".root-top.home h1.lmark").text_content() == "LIFT/" and css(".lmark i", "color") == ORANGE and css(".root-top.home .sub", "text-transform") == "uppercase")
    ok("Home: build number no longer on Home", pg.locator("#view #build").count() == 0 and "b4." not in pg.inner_text(".root-top"))
    ok("Home: online + saved shows no status at all (never a fake 'Synced')", pg.locator("#net.hidden").count() == 1 and "Synced" not in pg.inner_text("body"))
    ctx.set_offline(True); W(300)
    ok("Home: offline shows the real state", "Offline, saved on phone" in pg.inner_text("#net") and "off" in pg.get_attribute("#net", "class"))
    ctx.set_offline(False); W(900)
    ok("Home: back online, status gone again", pg.locator("#net.hidden").count() == 1)
    ok("hero: 'Today' label in orange capitals with the routine's own colour tag", css(".hero .k", "color") == ORANGE_TXT and css(".hero .k", "text-transform") == "uppercase" and css(".hero .k", "background-color", "::before") == "rgb(226, 69, 60)")
    ok("hero: routine name big, condensed, capitals", css(".hero .w", "text-transform") == "uppercase" and float(css(".hero .w", "font-size")[:-2]) >= 28)
    mains = pg.eval_on_selector_all("#view .btn.main", "b=>b.filter(x=>x.getBoundingClientRect().height).length")
    hb = pg.evaluate("(()=>{const b=document.querySelector('.hero .btn.main').getBoundingClientRect();return b.height})()")
    ok("hero: exactly one primary action, orange with ink label, 52–56px", mains == 1 and css(".hero .btn.main", "background-color") == ORANGE and css(".hero .btn.main", "color") == INK and 52 <= hb <= 56, (mains, hb))
    wk = pg.eval_on_selector_all(".week .wk", "w=>w.map(x=>({w:Math.round(x.querySelector('.pl').getBoundingClientRect().width),l:x.getAttribute('aria-label'),c:x.querySelector('.pl').className,t:x.classList.contains('today')}))")
    ok("week strip: 7 equal squares", len(wk) == 7 and max(x["w"] for x in wk) - min(x["w"] for x in wk) <= 1, [x["w"] for x in wk])
    ok("week strip: every day named with its state for VoiceOver", all(x["l"] and any(s in x["l"] for s in ("Done", "Planned", "Missed", "Rest")) for x in wk), [x["l"] for x in wk])
    ok("week strip: today says so", [x["t"] for x in wk].count(True) == 1 and "Today" in [x for x in wk if x["t"]][0]["l"])
    kinds = {x["c"].split()[-1] for x in wk}
    look = pg.evaluate("""(()=>{const g=c=>{const e=document.querySelector('.wk .pl.'+c);if(!e)return null;const s=getComputedStyle(e);return [s.backgroundColor,s.borderStyle,s.boxShadow].join('|')};return {done:g('done'),plan:g('plan'),miss:g('miss'),off:g('off')}})()""")
    present = {k: v for k, v in look.items() if v}
    ok("week strip: done / planned / missed / rest all look different", len(set(present.values())) == len(present) and len(present) >= 3, look)
    ok("week strip: today ringed in orange", css(".wk.today .pl", "outline-color") == ORANGE)
    ok("Home: exercise preview still lists the routine", pg.locator("#view .list .row[data-a='exinfo']").count() >= 5)

    # ================= You =================
    go("user")
    txt = pg.inner_text("#view")
    ok("You: Appearance · Reminders · Training · Help · Admin · About, log out kept", all(h in txt.upper() for h in ("APPEARANCE", "REMINDERS", "TRAINING", "HELP", "ADMIN", "ABOUT")) and pg.locator("[data-a='logout']").count() == 1)
    ok("You › About: Lift build 4.13", "Lift build 4.13" in txt)

    # ================= Train: routine colours + templates =================
    go("programs", "routines")
    ok("routine cards keep their own colour stripe (not Edge orange)", "226, 69, 60" in css(".rcard", "box-shadow") and "inset" in css(".rcard", "box-shadow"))
    go("programs", "programs"); tap("[data-p='template']", 900)
    opts = pg.locator(".tplopt").all_inner_texts()
    ok("template: 'Use' and 'Add' each explain what they do", len(opts) == 2 and "Replaces your routines and gym days" in opts[0] and "Keeps your routines and gym days" in opts[1], opts)
    n0 = len(db["state"]["program"])
    tap("[data-a='usetpl']", 500)
    ok("template: 'Use' still asks for a second tap and changes nothing yet", "Tap again" in pg.text_content("[data-a='usetpl']") and len(db["state"]["program"]) == n0)
    tap("[data-a='back']", 600); go("today")

    # ================= Workout =================
    tap("#go", 1300)
    ok("workout: bar hidden, one-tap prev/next + progress segments", pg.locator("nav.tabs.hidden").count() == 1 and pg.locator(".exbar .nav").count() == 2 and pg.locator(".segs i").count() >= 5)
    order = pg.evaluate("(()=>{const h=document.querySelector('.feelhint'),f=document.querySelector('.feels');return !!(h&&f&&(h.compareDocumentPosition(f)&Node.DOCUMENT_POSITION_FOLLOWING))})()")
    ok("workout: 'Tap how the set felt to save' sits above the three buttons", order)
    fb = pg.eval_on_selector_all(".feels button", "b=>b.map(x=>{const s=getComputedStyle(x),r=x.getBoundingClientRect();return [s.backgroundColor,s.color,Math.round(r.height),Math.round(r.width)]})")
    ok("workout: Easy green · Good light · Hard orange, ink labels", [x[0] for x in fb] == ["rgb(107, 168, 138)", "rgb(244, 244, 241)", ORANGE] and all(x[1] == INK for x in fb), fb)
    ok("workout: feel buttons big enough for gym hands (≥56px tall)", all(x[2] >= 56 and x[3] >= 90 for x in fb), fb)
    ok("workout: kg / reps cards with + and − ≥ 44pt", pg.eval_on_selector_all(".stp .row2 button", "b=>b.every(x=>{const r=x.getBoundingClientRect();return r.width>=44&&r.height>=44})") and pg.locator(".stp").count() == 2)
    ok("workout: seat settings / change exercise are quiet text actions", css(".tools2 button", "background-color") in ("rgba(0, 0, 0, 0)", "transparent"))
    a0 = db["state"]["active"] if db["state"].get("active") else None
    tap(".feels [data-f='2']", 900)
    act = pg.evaluate("S.active")
    ok("Good saves the set exactly as before (1 set, felt=2)", act and len([s for s in act["sets"] if not s.get("wu")]) == 1 and act["sets"][-1]["f"] == 2)
    ok("…recorded sets labelled, progress segment fills orange", pg.locator(".reclab").count() == 1 and pg.locator(".cs").count() == 1 and css(".segs i b", "background-color") == ORANGE)
    ok("…rest band appears, doesn't block the controls", pg.locator("#restB").count() == 1 and pg.locator(".feels button").count() == 3)
    tap(".cs", 500)
    ok("edit a set: framed 'Fix this set' panel, clearly different from logging", pg.locator(".ctl.fix").count() == 1 and css(".ctl.fix", "border-top-style") == "solid" and pg.locator(".feels").count() == 0)
    tap("[data-a='canceledit']", 500)
    ok("…cancel returns to logging", pg.locator(".feels").count() == 1 and pg.locator(".ctl.fix").count() == 0)
    ok("workout header: Finish is a secondary button (not a second orange)", css(".hdr .act button", "background-color") != ORANGE)

    # ================= contrast + touch, dark English =================
    pg.evaluate("STACK=[];render()"); W(500)
    bad, small = {}, {}
    for tab, seg in SCREENS:
        go(tab, seg); W(300)
        c = pg.evaluate(CONTRAST_JS); t = pg.evaluate(TOUCH_JS)
        if c: bad[f"{tab}/{seg}"] = c
        if t: small[f"{tab}/{seg}"] = t
    tap("nav.tabs [data-tab='today']", 500); tap("[data-a='resume']", 1200)
    c = pg.evaluate(CONTRAST_JS); t = pg.evaluate(TOUCH_JS)
    if c: bad["workout"] = c
    if t: small["workout"] = t
    ok("dark: every text ≥ 4.5:1 (large ≥ 3:1) on all main screens + workout", not bad, bad)
    ok("every control ≥ 44 × 44 on all main screens + workout", not small, small)
    tr = pg.evaluate("[getComputedStyle(document.querySelector('.feels button')).transitionDuration,getComputedStyle(document.querySelector('.btn,.exbar .nav')).transitionDuration]")
    ok("motion: transitions short (≤ 220 ms)", all(max(float(v.rstrip("s")) for v in d.split(",")) <= 0.22 for d in tr), tr)
    ok("no script errors (dark)", not errs, errs[:3])
    ctx.close()

    # ================= light =================
    db["state"] = copy.deepcopy(SEED); db["v"] += 1
    ctx, pg, errs, _ = newpage(theme="light")
    W, tap, go, css = H(pg)
    ok("light: Edge canvas + ink text, iOS bar colour matches", pg.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(244, 244, 241)" and pg.evaluate("getComputedStyle(document.body).color") == INK and pg.get_attribute("meta[name='theme-color']", "content") == "#F4F4F1")
    bad = {}
    for tab, seg in SCREENS:
        go(tab, seg); W(300); c = pg.evaluate(CONTRAST_JS)
        if c: bad[f"{tab}/{seg}"] = c
    go("today"); tap("#go", 1300); c = pg.evaluate(CONTRAST_JS)
    if c: bad["workout"] = c
    ok("light: every text ≥ 4.5:1 (large ≥ 3:1) on all main screens + workout", not bad, bad)
    ok("light: Good is a neutral light-grey button with ink text", css(".feels .f2", "background-color") == "rgb(232, 236, 236)" and css(".feels .f2", "color") == INK)
    ok("no script errors (light)", not errs, errs[:3])
    ctx.close()

    # ================= Arabic, dark + light =================
    for theme in ("dark", "light"):
        db["state"] = copy.deepcopy(SEED); db["v"] += 1
        ctx, pg, errs, miss = newpage(lang="ar", theme=theme)
        W, tap, go, css = H(pg)
        ok(f"Arabic ({theme}): right-to-left, bar الرئيسية · التدريب · التقدّم · حسابي", pg.evaluate("document.documentElement.dir") == "rtl" and [t.strip() for t in pg.locator("nav.tabs button span").all_text_contents()] == ["الرئيسية", "التدريب", "التقدّم", "حسابي"])
        ok(f"Arabic ({theme}): LIFT/ mark still reads left-to-right", pg.locator(".lmark").first.text_content() == "LIFT/" and css(".lmark", "direction") == "ltr")
        bad, wide = {}, []
        for tab, seg in SCREENS:
            go(tab, seg); W(300); c = pg.evaluate(CONTRAST_JS)
            if c: bad[f"{tab}/{seg}"] = c
            if not pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"): wide.append(f"{tab}/{seg}")
        go("programs", "programs"); tap("[data-p='template']", 800)
        tpl = pg.inner_text("#view")
        tap("[data-a='back']", 600); go("today"); tap("#go", 1300); tap(".feels [data-f='1']", 900)
        c = pg.evaluate(CONTRAST_JS)
        if c: bad["workout"] = c
        ok(f"Arabic ({theme}): template explains Use / Add in Arabic", "يستبدل روتيناتك" in tpl and "يُبقي روتيناتك" in tpl)
        ok(f"Arabic ({theme}): workout labels in Arabic (المجموعات المسجّلة)", "المجموعات المسجّلة" in pg.inner_text("#view"))
        ok(f"Arabic ({theme}): every text readable, nothing scrolls sideways", not bad and not wide, (bad, wide))
        ok(f"Arabic ({theme}): no English left untranslated", not miss, sorted(miss)[:12])
        ok(f"no script errors (Arabic {theme})", not errs, errs[:3])
        ctx.close()

    # ================= small iPhone (375 × 667) =================
    db["state"] = copy.deepcopy(SEED); db["v"] += 1
    ctx, pg, errs, _ = newpage(vw=375, vh=667)
    W, tap, go, css = H(pg)
    wide = []
    for tab, seg in SCREENS:
        go(tab, seg)
        if not pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"): wide.append(f"{tab}/{seg}")
    ok("375-wide iPhone: no screen scrolls sideways", not wide, wide)
    go("today"); tap("#go", 1300); pg.evaluate("window.scrollTo(0,0)"); W(200)
    fb = pg.evaluate("document.querySelector('.feels').getBoundingClientRect().bottom")
    ok("375 × 667: kg / reps and Easy · Good · Hard reachable within one short scroll", fb <= 667 * 1.35, fb)
    ok("no script errors (small)", not errs, errs[:3])
    ctx.close()

    # ================= reduced motion =================
    db["state"] = copy.deepcopy(SEED); db["v"] += 1
    ctx, pg, errs, _ = newpage(motion="reduce")
    W, tap, go, css = H(pg)
    ok("reduced motion: no transitions or animations", css(".btn", "transition-duration") in ("0s", "0s, 0s, 0s") and css("nav.tabs button", "transition-duration").startswith("0s"))
    ctx.close()
    br.close()
srv.shutdown()
f = [n for n, c in res if not c]
print(f"\nEDGE lift: PASS {len(res) - len(f)}  FAIL {len(f)}")
sys.exit(1 if f else 0)
