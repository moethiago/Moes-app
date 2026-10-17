#!/usr/bin/env python3
"""Lift: Arabic mode, the admin Users page, and two people on one phone — real Chromium at iPhone size, backend mocked.
Usage: python3 tests/lift_ar_e2e.py [path-to-lift-folder]"""
import json, threading, http.server, socketserver, sys, os, re, copy
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "lift")
PORT = int(os.environ.get("PORT", "8171"))
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Q); threading.Thread(target=srv.serve_forever, daemon=True).start()

ADMIN_PIN = "2026"
PROG = [{"id": "r1", "n": "Push day", "c": 0, "x": [{"e": "rR0LJzx", "n": "Dumbbell romanian deadlift", "kind": "w", "step": 2.5, "s": 2, "lo": 8, "hi": 12, "rest": 90},
                                               {"e": "znQUdHY", "n": "Dumbbell seated shoulder press", "kind": "w", "step": 2, "s": 2, "lo": 8, "hi": 12, "rest": 90}]}]
DB = {ADMIN_PIN: {"v": 3, "state": {"ver": 4, "days": [0, 1, 3, 4, 6], "next": 0, "active": None, "sessions": [], "notes": {}, "body": [], "goal": {}, "custom": {}, "program": PROG}}}
USERS = []
saves = []
def api(route):
    b = json.loads(route.request.post_data or "{}"); pin = b.get("pin"); a = b.get("action")
    j = lambda code, o: route.fulfill(status=code, body=json.dumps(o), content_type="application/json")
    u = next((x for x in USERS if x["code"] == pin), None)
    if pin != ADMIN_PIN and not u: return j(401, {"error": "pin"})
    key = pin
    if a in ("users", "adduser", "deluser"):
        if pin != ADMIN_PIN: return j(403, {"error": "admin"})
        if a == "adduser":
            nu = {"id": "u%d" % (len(USERS) + 1), "name": b.get("name") or "Friend %d" % (len(USERS) + 1), "code": str(482910 + len(USERS)), "created": 1760000000000}
            USERS.append(nu); DB[nu["code"]] = {"v": 0, "state": None}; return j(200, {"ok": True, "user": nu, "users": USERS})
        if a == "deluser":
            USERS[:] = [x for x in USERS if x["id"] != b.get("id")]; return j(200, {"ok": True, "users": USERS})
        return j(200, {"users": USERS})
    d = DB.setdefault(key, {"v": 0, "state": None})
    if a == "state": return j(200, {**d, "role": "full", "admin": pin == ADMIN_PIN, **({"user": {"name": u["name"]}} if u else {})})
    if a == "save":
        saves.append((pin, b.get("state")))
        if b.get("v") != d["v"]: return j(409, {"conflict": True, **d})
        d["v"] += 1; d["state"] = b["state"]; return j(200, {"v": d["v"]})
    j(400, {"error": "unknown"})
GIF1 = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
res = []
def ok(n, c, extra=""):
    res.append((n, bool(c))); print(("PASS " if c else "FAIL ") + n + ("" if c else "  — " + str(extra)[:300]))
MISS = set()
ARABIC = re.compile(r"[؀-ۿ]")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="en-GB", service_workers="block")
    ctx.expose_function("__trMiss", lambda k: MISS.add(k))
    pg = ctx.new_page(); pg.route("**/api/health-check**", api)
    pg.route("**/static.exercisedb.dev/**", lambda r: r.fulfill(status=200, body=GIF1, content_type="image/gif"))
    pg.route("**/oss.exercisedb.dev/**", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps({"data": {"instructions": ["Step:1 Stand tall with the dumbbells.", "Step:2 Hinge at the hips."]}})))
    pg.route("**fonts.g*/**", lambda r: r.fulfill(status=200, body=b"", content_type="text/css"))
    def tap(sel, ms=500): pg.click(sel); pg.wait_for_timeout(ms)
    def go(page, extra="", ms=900):
        pg.evaluate("([p,e])=>{var b=document.createElement('button');b.setAttribute('data-a','go');b.setAttribute('data-p',p);if(e)b.setAttribute('data-e',e);document.body.appendChild(b);b.click();b.remove();}", [page, extra]); pg.wait_for_timeout(ms)
    def tab(t, ms=700):
        pg.evaluate("t=>{STACK=[];TAB=t;render();}", t); pg.wait_for_timeout(ms)
    def view(): return pg.inner_text("#view")
    def shot(n):
        if os.environ.get("SHOTS"): pg.screenshot(path=os.path.join(os.environ["SHOTS"], n + ".png"), full_page=True)
    def noscroll(): return pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1")

    # ---------- the gate offers the language before logging in ----------
    pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(700)
    ok("gate (English) has the language switch", pg.locator("#glang").count() == 1 and "العربية" in pg.inner_text("#glang"))
    tap("#glang", 1200)
    ok("gate switches to Arabic, right-to-left", pg.evaluate("document.documentElement.dir") == "rtl" and pg.evaluate("document.documentElement.lang") == "ar" and "أدخل رمزك" in pg.inner_text("#gate") and "افتح Lift" in pg.inner_text("#pinGo"))
    pg.fill("#pin", "999999"); tap("#pinGo", 900)
    ok("wrong code message in Arabic", "الرمز غير صحيح" in pg.inner_text("#pinErr"), pg.inner_text("#pinErr"))
    pg.fill("#pin", ADMIN_PIN); tap("#pinGo", 1600)
    pg.evaluate("loadLib()"); pg.wait_for_timeout(800)

    # ---------- every page in Arabic, nothing left in English except names ----------
    MISS.clear()
    ok("Today in Arabic", "ابدأ التمرين" in view() or "التالي" in view(), view()[:200])
    rn = pg.evaluate("S.program[0].n")
    ok("routine name stays as it is (not translated)", rn in view(), rn)
    for t in ["routines", "log", "body", "today"]:
        tab(t); shot("ar_tab_" + t); ok(f"tab '{t}': fits the phone width in Arabic", noscroll())
    tab("routines")
    shot("ar_routines"); ok("Routines: Arabic headings", "أيام النادي" in view() and "روتيناتك" in view() and "مكتبة التمارين" in view())
    ok("Routines: Users row for the admin", "المستخدمون" in view())
    ok("Routines: language row shows العربية", "اللغة" in view() and "العربية" in view())
    ok("day chips are Arabic letters", pg.locator(".days .chip").first.inner_text() == "ح")
    go("library", ms=1200); shot("ar_library")
    names = pg.evaluate("Array.from(document.querySelectorAll('#view .row .t, #view .lrow .t')).slice(0,15).map(e=>e.textContent)")
    lib = set(pg.evaluate("LIB.map(r=>r[1])"))
    ok("library: exercise names stay in English, exactly as in the library", len(names) >= 5 and all(n in lib for n in names) and not any(ARABIC.search(n) for n in names), names[:5])
    ok("library: search box in Arabic, tells you to search in English", "بالإنجليزية" in (pg.get_attribute("#view input", "placeholder") or ""))
    go("exercise", "rR0LJzx", 1500)
    ok("exercise page: name in English, labels in Arabic", "Dumbbell romanian deadlift" in view() and "العضلة الأساسية" in view() and "الأداة" in view())
    ok("exercise page: muscles translated", "المؤخرة" in view())
    ok("exercise page: video button in Arabic", "شاهد الطريقة الصحيحة" in pg.inner_text("a.ytb"))
    ok("exercise page: how-to steps stay in English", "Stand tall with the dumbbells." in view() and pg.get_attribute(".how ol", "translate") == "no")
    ok("exercise page fits the phone", noscroll())
    tab("today"); tap("[data-a='start']", 1500)
    bt = pg.inner_text("body"); ex0 = pg.evaluate("S.active&&S.active.x&&S.active.x[0].n||''")
    ok("workout: Arabic controls, English exercise name", ex0 and ex0 in bt and "سهل" in bt and "المجموعة" in bt, (ex0, bt[:200]))
    ok("workout fits the phone", noscroll())
    tap("[data-a='how']", 900)
    ok("workout: how-to opens with Arabic video button", pg.locator("a.ytb").count() == 1 and "شاهد" in pg.inner_text("a.ytb"))
    real_miss = sorted(k for k in MISS if not re.fullmatch(r"(Push day|Dumbbell .*)", k))
    ok("no English left anywhere on these pages (except names)", not real_miss, real_miss)

    # ---------- Users: only for the admin ----------
    tab("routines"); go("users", ms=1000)
    ok("Users page in Arabic, empty to start", "لا يوجد أصدقاء بعد" in view())
    pg.fill("#uname", "Saad"); tap("[data-a='adduser']", 1000)
    shot("ar_users"); ok("New user → a code to send", "482910" in view() and "Saad" in view() and "المستخدم الجديد جاهز" in view())
    tap("[data-a='adduser']", 1000)
    ok("second user, default name", "Friend 2" in view() and "482911" in view())
    ok("friend's name shows as typed (not translated)", pg.locator(".urow .t").first.get_attribute("translate") == "no")
    pg.evaluate("Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:(t)=>{window.__clip=t;return Promise.resolve();}},configurable:true})")
    tap(".urow [data-a='shareinv'] >> nth=1", 600)
    clip = pg.evaluate("window.__clip||''")
    ok("send: link + that friend's code", "482910" in clip and "127.0.0.1" in clip and "Saad" not in clip, clip.replace("\n", " | "))
    tap(".urow [data-a='deluser'] >> nth=0", 300)
    ok("remove asks twice", len(USERS) == 2)
    tap(".urow [data-a='deluser'] >> nth=0", 900)
    ok("remove works", len(USERS) == 1 and USERS[0]["code"] == "482910")
    ok("Users page fits the phone", noscroll())

    # ---------- a friend's code on the same phone opens their own clean Lift ----------
    pg.wait_for_timeout(1500); my_v = DB[ADMIN_PIN]["v"]; n_saves = len(saves)
    pg.evaluate("localStorage.setItem('lift_pending', JSON.stringify([{t:'op',k:'day',p:{d:2},id:'zz'}]))")  # an unsent change of Moaath's
    pg.evaluate("localStorage.removeItem('lift_pin')"); pg.reload(); pg.wait_for_timeout(900)
    pg.fill("#pin", "482910"); tap("#pinGo", 1800)
    st = pg.evaluate("S")
    ok("friend sees a clean Lift (no history, no workout of Moaath's)", st and not st.get("sessions") and not st.get("active") and pg.evaluate("pending.length") == 0, st and (st.get("days"), bool(st.get("active"))))
    ok("friend's Lift has no Users row", "المستخدمون" not in (tab("routines") or view()))
    ok("nothing of Moaath's was saved into the friend's data", all(pin == ADMIN_PIN or not (s or {}).get("active") for pin, s in saves))
    ok("Moaath's data untouched while the friend uses the phone", DB[ADMIN_PIN]["v"] == my_v and not [x for x in saves[n_saves:] if x[0] == ADMIN_PIN], [x[0] for x in saves[n_saves:]])
    ok("Arabic stays on after switching person", pg.evaluate("document.documentElement.dir") == "rtl")

    # ---------- language back to English ----------
    tap("[data-a='lang']", 1500); tab("routines")
    ok("language row switches back to English", pg.evaluate("document.documentElement.dir") != "rtl" and "Gym days" in view())
    br.close()
srv.shutdown()
f = [n for n, c in res if not c]; print(f"\nE2E lift Arabic+users: PASS {len(res)-len(f)}  FAIL {len(f)}"); sys.exit(1 if f else 0)
