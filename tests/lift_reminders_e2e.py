#!/usr/bin/env python3
"""Lift reminders (test camp) e2e — the User tab's Reminders section in real Chromium at iPhone size: explanation outside the
Home Screen app, blocked state, turning on (permission → subscribe with the server's key → saved → test sent), switches,
time, test/preview, turning off — English + Arabic, dark + light. Push itself is checked in tests/lift_push.mjs.
Usage: python3 tests/lift_reminders_e2e.py [path-to-lift-folder]"""
import json, threading, http.server, socketserver, sys, os, re, base64, datetime
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift_46_e2e_contrast import CONTRAST_JS
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "lift-test")
PORT = int(os.environ.get("PORT", "8188"))
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Q); threading.Thread(target=srv.serve_forever, daemon=True).start()
KEY = base64.urlsafe_b64encode(b"\x04" + bytes(range(64))).decode().rstrip("=")
DB = {"v": 1, "state": None}; PUSH = {"on": 0, "phones": 0, "prefs": {"on": 1, "time": "17:00", "day": 1, "miss": 1, "week": 1, "open": 1, "lang": "en"}, "log": []}; CALLS = []
def api(route):
    b = json.loads(route.request.post_data or "{}"); a = b.get("action"); CALLS.append(b)
    j = lambda code, o: route.fulfill(status=code, body=json.dumps(o), content_type="application/json")
    if b.get("pin") != "2026": return j(401, {"error": "pin"})
    if a == "state": return j(200, {**DB, "role": "full", "admin": False, "fix": {"hv": {}}})
    if a == "save": DB["v"] += 1; DB["state"] = b["state"]; return j(200, {"v": DB["v"]})
    if a == "pushkey": return j(200, {"key": KEY})
    if a == "pushsub": PUSH["phones"] = 1; PUSH["on"] = 1; PUSH["prefs"]["lang"] = b.get("lang", "en")
    if a == "pushunsub": PUSH["phones"] = 0
    if a == "pushprefs": PUSH["prefs"].update(b.get("prefs") or {})
    sent = None
    if a in ("pushtest", "pushpreview"):
        sent = 1 if a == "pushtest" else 4; PUSH["log"].append({"t": 1792345678000, "k": "test", "s": 201})
    if a.startswith("push"): return j(200, {"ok": True, "on": bool(PUSH["on"]), "phones": PUSH["phones"], "prefs": PUSH["prefs"], "log": PUSH["log"][-10:], **({"sent": sent} if sent else {})})
    j(400, {"error": "unknown"})
STUB = """
(()=>{ window.__subCalls=[];window.__unsub=0;let SUB=null;
  const mk=(key)=>({endpoint:'https://web.push.apple.com/fake-'+key.length,unsubscribe:()=>{window.__unsub++;SUB=null;return Promise.resolve(true)},toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'BPHONE',auth:'AUTH'}}}});
  if(window.PushManager){PushManager.prototype.subscribe=function(o){window.__subCalls.push(Array.from(new Uint8Array(o.applicationServerKey)));SUB=mk(new Uint8Array(o.applicationServerKey));return Promise.resolve(SUB)};
    PushManager.prototype.getSubscription=function(){return Promise.resolve(SUB)};}
  %s
})();"""
res = []
def ok(n, c, extra=""):
    res.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n + ("" if c or extra == "" else "  — " + str(extra)[:300]))
with sync_playwright() as p:
    br = p.chromium.launch()
    def newpage(standalone=True, perm="default", lang=None, theme=None):
        ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="en-GB", service_workers="allow", timezone_id="Asia/Riyadh")
        miss = set(); ctx.expose_function("__trMiss", lambda k: miss.add(k))
        extra = ""
        if standalone: extra += "document.addEventListener('DOMContentLoaded',()=>document.documentElement.classList.add('standalone'));"
        if perm == "granted-on-ask": extra += "let P='default';Object.defineProperty(Notification,'permission',{get:()=>P});Notification.requestPermission=()=>{P='granted';window.__asked=(window.__asked||0)+1;return Promise.resolve('granted')};"
        if perm == "denied": extra += "Object.defineProperty(Notification,'permission',{get:()=>'denied'});"
        if perm == "refuse": extra += "let P='default';Object.defineProperty(Notification,'permission',{get:()=>P});Notification.requestPermission=()=>{P='default';return Promise.resolve('default')};"
        init = "localStorage.setItem('lift_pin','2026');localStorage.setItem('lift_who','2026');" + ("localStorage.setItem('lift_lang','%s');" % lang if lang else "") + ("localStorage.setItem('lift_theme','%s');" % theme if theme else "")
        ctx.add_init_script(init + STUB % extra)
        pg = ctx.new_page(); pg.route("**/api/health-check**", api)
        for pat in ("**/static.exercisedb.dev/**", "**/i.ytimg.com/**", "**raw.githubusercontent.com/**", "**wger.de/**", "**/oss.exercisedb.dev/**"): pg.route(pat, lambda r: r.fulfill(status=404, body=b""))
        pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(1500)
        return ctx, pg, errs, miss
    def T(pg):
        W = lambda ms=400: pg.wait_for_timeout(ms)
        def tap(sel, ms=600):
            el = pg.locator(sel).first; el.evaluate("e=>e.scrollIntoView({block:'center'})"); el.click(); W(ms)
        def sec(): return pg.inner_text("section:has([data-a^='push']), section:has(h2:text-is('Reminders'))").replace("\xa0", " ") if pg.locator("section:has(h2:text-is('Reminders')), section:has([data-a^='push'])").count() else ""
        return W, tap, sec
    # outside the Home Screen app
    ctx, pg, errs, _ = newpage(standalone=False); W, tap, sec = T(pg)
    tap("nav.tabs [data-tab='user']", 900)
    ok("Safari tab: explains reminders need the Home Screen icon, no button", "Home Screen icon" in sec() and pg.locator("[data-a='pushon']").count() == 0, sec())
    ctx.close()
    # blocked
    ctx, pg, errs, _ = newpage(perm="denied"); W, tap, sec = T(pg)
    tap("nav.tabs [data-tab='user']", 900)
    ok("blocked: says how to allow in iPhone Settings, no button", "blocked" in sec() and "Settings" in sec() and pg.locator("[data-a='pushon']").count() == 0, sec())
    ctx.close()
    # said no to the iPhone question
    ctx, pg, errs, _ = newpage(perm="refuse"); W, tap, sec = T(pg)
    tap("nav.tabs [data-tab='user']", 900); n0 = len(CALLS); tap("[data-a='pushon']", 900)
    ok("tapped Don't Allow: nothing saved, button stays", not any(c["action"] == "pushsub" for c in CALLS[n0:]) and pg.locator("[data-a='pushon']").count() == 1)
    ctx.close()
    for theme in ("dark", "light"):
        PUSH.update({"on": 0, "phones": 0, "log": []}); PUSH["prefs"].update({"time": "17:00", "week": 1})
        ctx, pg, errs, _ = newpage(perm="granted-on-ask", theme=theme); W, tap, sec = T(pg)
        tap("nav.tabs [data-tab='user']", 1000)
        ok(f"[{theme}] User tab: Reminders section with 'Turn on reminders'", pg.locator("[data-a='pushon']").count() == 1 and "no links" in sec())
        n0 = len(CALLS); tap("[data-a='pushon']", 1800)
        acts = [c["action"] for c in CALLS[n0:]]
        ok(f"[{theme}] turning on: asks the iPhone first, then key → subscribe → saved → test sent", pg.evaluate("window.__asked") == 1 and acts[:4] == ["pushkey", "pushsub", "pushtest"][:len(acts[:3])] + acts[3:4] and "pushsub" in acts and "pushtest" in acts, acts)
        key_used = pg.evaluate("window.__subCalls[0]")
        ok(f"[{theme}] subscribed with the server's own key (65 bytes)", key_used and len(key_used) == 65 and key_used[0] == 4 and key_used[1:5] == [0, 1, 2, 3])
        sub = next(c for c in CALLS[n0:] if c["action"] == "pushsub")
        ok(f"[{theme}] phone's address and keys sent, plus language", sub["sub"]["endpoint"].startswith("https://web.push.apple.com/") and sub["sub"]["keys"]["auth"] == "AUTH" and sub["lang"] == "en")
        ok(f"[{theme}] now shows the 4 switches, time, test buttons, last reminder", pg.locator("[data-a='pushtog']").count() == 4 and pg.locator("select[data-in='pushtime'] option").count() == 33 and pg.locator("[data-a='pushtest']").count() == 1 and "delivered to Apple" in sec(), sec())
        n0 = len(CALLS); tap("[data-a='pushtog'][data-k='week']", 700)
        ok(f"[{theme}] switch off 'Weekly numbers' → saved", any(c["action"] == "pushprefs" and c["prefs"] == {"week": 0} for c in CALLS[n0:]) and pg.locator("[data-a='pushtog'][data-k='week'].on").count() == 0)
        n0 = len(CALLS); pg.select_option("select[data-in='pushtime']", "18:30"); W(700)
        ok(f"[{theme}] time 6:30 pm → saved", any(c["action"] == "pushprefs" and c["prefs"] == {"time": "18:30"} for c in CALLS[n0:]))
        n0 = len(CALLS); tap("[data-a='pushtest']", 700); tap("[data-a='pushpreview']", 700)
        ok(f"[{theme}] 'Send me a test' and 'Show me all kinds' reach the server", [c["action"] for c in CALLS[n0:]] == ["pushtest", "pushpreview"])
        ok(f"[{theme}] fits the phone, readable", pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1") and not pg.evaluate(CONTRAST_JS, 3))
        pg.screenshot(path=f"/tmp/w/rem_{theme}.png", full_page=True)
        n0 = len(CALLS); tap("[data-a='pushoff']", 300); ok(f"[{theme}] turn off asks first", "Tap again" in pg.inner_text("[data-a='pushoff']"))
        tap("[data-a='pushoff']", 900)
        ok(f"[{theme}] …then unsubscribes this phone and tells the server", pg.evaluate("window.__unsub") == 1 and any(c["action"] == "pushunsub" for c in CALLS[n0:]) and pg.locator("[data-a='pushon']").count() == 1)
        ok(f"no page errors ({theme})", not errs, errs[:3])
        ctx.close()
    # Arabic
    PUSH.update({"on": 0, "phones": 0, "log": []})
    ctx, pg, errs, MISS = newpage(perm="granted-on-ask", lang="ar"); W, tap, sec = T(pg)
    tap("nav.tabs [data-tab='user']", 1000); tap("[data-a='pushon']", 1800)
    ok("Arabic: reminders section in Arabic, language sent as ar", "التنبيهات" in pg.inner_text("#view") and any(c.get("action") == "pushsub" and c.get("lang") == "ar" for c in CALLS))
    pg.select_option("select[data-in='pushtime']", "19:00"); W(800)
    real = sorted(k for k in MISS if not re.fullmatch(r"(Full Body .*|Upper .*|Lower .*|Workout .*)", k, re.I))
    ok("Arabic: nothing left in English", not real, real[:20])
    ok("no page errors (Arabic)", not errs, errs[:3])
    br.close()
n_fail = sum(1 for _, c in res if not c)
print(f"\nE2E lift reminders: PASS {len(res) - n_fail}  FAIL {n_fail}")
srv.shutdown(); sys.exit(1 if n_fail else 0)
