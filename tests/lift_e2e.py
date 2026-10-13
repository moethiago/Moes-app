#!/usr/bin/env python3
"""Lift v3 e2e — real Chromium at iPhone size, backend mocked in-process (same contract as api/health-check?app=lift).
Usage: python3 tests/lift_e2e.py [path-to-lift-folder]   (needs: python3 -m playwright install chromium)"""
import json, threading, http.server, socketserver, sys, os, time
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "lift")
PORT = int(os.environ.get("PORT", "8143"))
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
    dialogs = []; pg.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    W = lambda ms=400: pg.wait_for_timeout(ms)
    def tap(sel, ms=400):
        el = pg.locator(sel).first; el.evaluate("e=>e.scrollIntoView({block:'center'})"); el.click(); W(ms)
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

    # ================= gate =================
    pg.goto(f"http://127.0.0.1:{PORT}/index.html"); W(700)
    ok("gate on first open", pg.is_visible("#gate"))
    pg.fill("#pin", "1111"); pg.click("#pinGo"); W()
    ok("wrong code refused", "wrong" in pg.inner_text("#pinErr"))
    pg.fill("#pin", "2026"); pg.click("#pinGo"); W(900)
    ok("opens with 2026, seeds v2 data", pg.is_visible("#app") and ST()["ver"] == 2 and len(ST()["program"]) == 4)

    # ================= Today =================
    ok("4 tabs only", pg.locator("nav.tabs button").count() == 4)
    ok("hero: Upper A + one Start button", "Upper A" in pg.inner_text(".hero .w") and pg.locator(".hero [data-a='start']").count() == 1)
    ok("targets list (7 exercises)", pg.locator("[data-a='exinfo']").count() == 7)
    ok("'new' shown instead of a weight", pg.locator(".row .end >> text=new").count() == 6)
    ok("hero shows the muscles today trains", pg.locator(".hero svg.bmap polygon[fill='var(--mc)']").count() >= 4)
    ok("rows say which muscle (e.g. Chest)", "Chest" in pg.locator("[data-a='exinfo']").first.inner_text())
    ok("Today fits iPhone width", noscroll())

    # ================= workout =================
    tap(".hero [data-a='start']", 800)
    ok("workout page opens, tabs hidden", title() == "Upper A" and pg.is_hidden("nav.tabs") and A()["w"] == "ua")
    box = pg.locator("[data-a='log'][data-f='2']").bounding_box()
    ok("Easy/Good/Hard visible without scrolling", box and box["y"] + box["height"] <= 844, box)
    ok("muscle map: chest lit as main muscle", pg.locator(".mapbox polygon[fill='var(--mc)']").count() == 2 and pg.locator(".mapbox polygon[fill='var(--ms)']").count() >= 4)
    ok("muscle names under the exercise", "Chest" in pg.inner_text(".exm .mp") and "Triceps" in pg.inner_text(".exm"))
    ok("short screen: no coach paragraph", pg.locator(".coach").count() == 0 and len(pg.inner_text(".ctl")) < 160, pg.inner_text(".ctl"))
    ok("set controls start empty for a first-time weight", pg.input_value("#in_k") == "")
    log(2, None, 12)
    ok("can't save a set without a weight (message, no pop-up)", len(A()["sets"]) == 0 and "weight" in pg.inner_text(".toast") and not dialogs)
    log(1, 30, 12)
    ok("ONE tap saves the set with its feel (Easy)", len(A()["sets"]) == 1 and A()["sets"][0]["k"] == 30 and A()["sets"][0]["f"] == 1)
    ok("rest timer shows inline (not a pop-up)", pg.is_visible("#restB") and pg.locator(".sheet, .rest").count() == 0)
    ok("coach raises set 2 to 35 kg after an easy first set", pg.input_value("#in_k") == "35")
    ok("rest band says what's next", "35 kg" in pg.inner_text("#restB"))
    tap("#restB", 300); ok("tap the rest band to skip it", pg.locator("#restB").count() == 0)
    tap("[data-a='step'][data-f='k+']", 100); ok("+ adds 2.5 kg", pg.input_value("#in_k") == "37.5"); tap("[data-a='step'][data-f='k-']", 100)
    r0 = int(pg.input_value("#in_r")); tap("[data-a='step'][data-f='r-']", 100); ok("− takes a rep off", pg.input_value("#in_r") == str(r0 - 1))
    log(3, None, 10)
    ok("Hard at 10 → same weight next", len(A()["sets"]) == 2 and A()["sets"][1]["f"] == 3 and pg.input_value("#in_k") == "35")
    # edit + delete inline
    tap("[data-a='editset'] >> nth=0", 300)
    ok("tapping a done set edits it in place", pg.locator("[data-a='saveset']").count() == 1 and pg.locator(".sheet").count() == 0)
    pg.fill("#in_r", "11"); tap("[data-a='saveset']", 500)
    ok("edit saved", A()["sets"][0]["r"] == 11)
    tap("[data-a='editset'] >> nth=1", 300); tap("[data-a='delset']", 200)
    ok("delete asks by changing the button text (no pop-up)", "Tap again" in pg.inner_text("[data-a='delset']") and len(A()["sets"]) == 2)
    tap("[data-a='delset']", 500); ok("second tap deletes", len(A()["sets"]) == 1)
    tap("[data-a='editset'] >> nth=0", 300); tap("[data-a='canceledit']", 300); ok("cancel leaves edit mode", pg.locator("[data-a='log']").count() == 3)
    log(2, 35, 11); log(2, None, 10, 600)
    ok("exercise done → big Next button", "Next: Lat pulldown" in pg.inner_text("[data-a='goex']"))
    tap("[data-a='goex']", 500)
    ok("moved to Lat pulldown", "Lat pulldown" in pg.inner_text(".exname"))
    ok("progress bar shows exercise 1 done", "100%" in pg.locator(".segs i b").first.get_attribute("style"))
    # how-to via picture, machine settings inline
    tap("[data-a='how']", 300); ok("tap the picture → how-to steps", pg.locator(".how li").count() == 3)
    tap("[data-a='how']", 300); ok("tap again hides them", pg.locator(".how").count() == 0)
    tap("[data-a='editnote']", 300); pg.fill("#noteIn", "Seat 3, thigh pad 2"); tap("[data-a='savenote']", 500)
    ok("machine settings saved inline", ST()["notes"].get(LP) == "Seat 3, thigh pad 2" and "Seat 3" in pg.inner_text(".pill2"))
    # swap
    tap("[data-a='swap']", 1500)
    ok("change exercise is a page with Back", title() == "Change exercise" and back_reachable())
    ok("alternatives listed", pg.locator("[data-a='doswap']").count() >= 5)
    alt = pg.locator("[data-a='doswap']").first.get_attribute("data-e"); tap("[data-a='doswap'] >> nth=0", 600)
    ok("swapped for today only, back on the workout", A()["x"][1]["e"] == alt and ST()["program"][0]["x"][1]["e"] == LP and title() == "Upper A")
    tap("[data-a='nextex']", 300); tap("[data-a='swap']", 1500); tap("[data-a='togglealways']", 200)
    ok("'also change in my plan' tick", pg.locator(".check.on").count() == 1)
    alt2 = pg.locator("[data-a='doswap']").first.get_attribute("data-e"); tap("[data-a='doswap'] >> nth=0", 1800)
    ok("swap saved to the plan too", ST()["program"][0]["x"][2]["e"] == alt2 and A()["x"][2]["e"] == alt2)
    # exercise list + add
    tap("[data-a='exlist']", 400)
    ok("exercise list page", title() == "Upper A" and pg.locator("[data-a='goex']").count() == 7)
    tap("[data-a='addtoday']", 1500); pg.fill("#libq", "hip thrust"); W(300)
    tap("#liblist [data-a='addtoday'] >> nth=0", 700)
    ok("added an exercise to today and jumped to it", len(A()["x"]) == 8 and "Hip_Thrust" in A()["x"][-1]["e"] and title() == "Upper A", (len(A()["x"]), A()["x"][-1]["e"], title(), pg.inner_text("#view")[:300]))
    tap("[data-a='exlist']", 300); tap("[data-a='goex'] >> nth=0", 400); ok("jump to exercise 1 from the list", "Chest press" in pg.inner_text(".exname"))
    # leave & come back
    tap(".hdr .back", 400)
    ok("Back leaves the workout running; Today offers Continue", pg.is_visible("[data-a='resume']") and pg.is_visible("nav.tabs"))
    tap("nav [data-tab='plan']", 300); tap("nav [data-tab='today']", 300)
    tap("[data-a='resume']", 400); ok("Continue returns to the workout", title() == "Upper A")
    # 409
    other = json.loads(json.dumps(ST())); other["days"] = [0, 1, 3, 6]; db["v"] += 4; db["state"] = other
    tap("[data-a='goex'][data-x], [data-a='nextex']", 300)
    tap("[data-a='exlist']", 300); tap("[data-a='goex'] >> nth=6", 400)
    log(2, None, 15, 1500)
    ok("409: other phone's change + my walk both kept", ST()["days"] == [0, 1, 3, 6] and any(s["e"] == "Walking_Treadmill" for s in A()["sets"]))
    # offline
    tap("[data-a='exlist']", 300); tap("[data-a='goex'] >> nth=3", 400)
    ctx.set_offline(True); pg.evaluate("window.dispatchEvent(new Event('offline'))"); W(150)
    n = len(A()["sets"]); log(2, 20, 10, 500)
    ok("offline: set kept on the phone", pg.evaluate("pending.length") >= 1 and len(A()["sets"]) == n)
    ctx.set_offline(False); pg.evaluate("pull()"); W(600)
    ok("re-sync keeps the queued set", len(pg.evaluate("S.active.sets")) == n + 1)
    pg.evaluate("window.dispatchEvent(new Event('online'))"); W(1300)
    ok("back online: set reaches the server", pg.evaluate("pending.length") == 0 and len(A()["sets"]) == n + 1)
    pg.reload(); W(1200)
    ok("reopening the app goes straight back into the workout", title() == "Upper A" and A() is not None)
    # finish
    tap("[data-a='finish']", 400)
    ok("finish page, with Back to workout", title() == "Finish workout" and pg.locator("[data-a='back']").count() >= 2)
    tap("[data-a='back'] >> nth=1", 300); ok("Back to workout works", title() == "Upper A")
    tap("[data-a='finish']", 400); tap("[data-a='save']", 700)
    ok("saved: session stored, rotation → Lower A", A() is None and len(ST()["sessions"]) == 1 and ST()["next"] == 1)
    ok("saved screen with Done", "Saved" in pg.inner_text("#view") and pg.locator("[data-a='home']").count() == 1)
    tap("[data-a='home']", 400)
    ok("Done → Today shows Lower A", "Lower A" in pg.inner_text(".hero .w"))

    # ================= coach with history =================
    st = ST()
    st["sessions"] = [sess("h1", "ua", "Upper A", 0, 9, [(CP, 40, 10, 2), (CP, 40, 9, 2), (CP, 40, 9, 2), (SP, 20, 8, 3), (SP, 20, 7, 3)]),
                      sess("h2", "ua", "Upper A", 0, 4, [(CP, 40, 12, 2), (CP, 40, 12, 2), (CP, 40, 12, 1), (LP, 30, 11, 2), (LP, 30, 10, 2), (SP, 20, 8, 3), (SP, 20, 7, 3), ("Walking_Treadmill", 0, 15, 2)])]
    st["next"] = 0; st["program"] = None; db["v"] += 1
    pg.evaluate("localStorage.removeItem('lift_state')"); pg.reload(); W(1200)
    rows = {r.split("\n")[0]: r for r in pg.locator("[data-a='exinfo']").all_inner_texts()}
    ok("chest press goes up to 42.5 (+2.5)", "42.5" in rows.get("Chest press machine", "") and "+2.5" in rows.get("Chest press machine", ""), rows.get("Chest press machine"))
    ok("lat pulldown stays 30", "30" in rows.get("Lat pulldown", ""))
    ok("shoulder press eases to 17.5", "17.5" in rows.get("Shoulder press machine", ""))
    ok("walk 15 → 17 min", "17" in rows.get("Incline walk", ""))
    ok("broken program repaired and saved", isinstance(ST()["program"], list) and len(ST()["program"]) == 4)
    tap(".hero [data-a='start']", 800)
    ok("warm-up shown as a line, nothing extra to tap", "Warm-up" in pg.inner_text(".ctl") and pg.locator(".set.wu").count() == 0)
    ok("set 1 pre-filled at 42.5", pg.input_value("#in_k") == "42.5")
    log(2, 45, 10)
    ok("🏆 heaviest-ever toast", pg.locator(".toast.gold").count() == 1)
    tap("[data-a='finish']", 400); ok("finish page shows the record", "new record" in pg.inner_text("#view"))
    tap("[data-a='save']", 700); ok("saved screen lists New records", "New records" in pg.inner_text("#view")); tap("[data-a='home']", 300)

    # ================= progress =================
    tap("nav [data-tab='progress']", 500)
    ok("records + workouts by week", "Your records" in pg.inner_text("#view") and "This week" in pg.inner_text("#view"))
    tap("[data-a='exinfo'][data-e='Leverage_Chest_Press']", 800)
    ok("exercise page: best set + chart, Back reachable", "45 kg × 10" in pg.inner_text("#view") and pg.locator("svg.chart").count() == 1 and back_reachable())
    tap(".hdr .back", 300)
    tap("[data-p='session'] >> nth=-1", 400)
    ok("workout detail page", pg.locator(".stats").count() == 1 and back_reachable())
    tap("[data-a='delsession']", 200); tap("[data-a='delsession']", 500)
    ok("delete (tap twice), back on Progress", len(ST()["sessions"]) == 2 and title() == "ROOT:Progress")
    ok("progress fits width", noscroll())

    # ================= body =================
    tap("nav [data-tab='body']", 400)
    ok("body empty state with one button", "Add your weight" in pg.inner_text("#view") and pg.locator("[data-p='entry']").count() == 1)
    tap("[data-p='entry']", 400); ok("add weight page with Back", title() == "Add weight" and back_reachable())
    pg.fill("#ekg", "20"); tap("[data-a='saveentry']", 300); ok("silly weight refused", len(ST()["body"]) == 0)
    pg.fill("#ekg", "108"); pg.fill("#esmm", "34.1"); pg.fill("#ebfm", "38.2"); tap("[data-a='saveentry']", 600)
    b0 = ST()["body"][0] if ST()["body"] else {}
    ok("weight + InBody saved in one go, fat % worked out", b0.get("kg") == 108 and b0.get("smm") == 34.1 and b0.get("bf") == 35.4 and b0.get("src") == "scan", b0)
    st = ST(); st["body"] += [{"id": "o%d" % i, "t": NOW() - (35 - i * 7) * D, "kg": k, "src": "weigh"} for i, k in enumerate([112.0, 111.2, 110.5, 109.8, 109.1])]; db["v"] += 1
    pg.evaluate("localStorage.removeItem('lift_state')"); pg.reload(); W(1000); tap("nav [data-tab='body']", 400)
    tap("[data-p='goal']", 400); pg.fill("#gkg", "95"); tap("[data-a='savegoal']", 600)
    ok("goal saved, date projected", ST()["goal"]["kg"] == 95 and "you reach it around" in pg.inner_text("#view"))
    ok("chart with goal line", pg.locator("svg.chart").count() == 1 and "goal" in pg.inner_html("svg.chart"))
    tap("[data-a='metric'][data-m='smm']", 300); ok("switch to muscle", "Muscle" in pg.inner_text(".card .mute")); tap("[data-a='metric'][data-m='kg']", 300)
    tap("[data-a='range'][data-r='1m']", 300); ok("range chips", pg.locator("[data-r='1m'].on").count() == 1)
    n = len(ST()["body"]); tap("[data-p='entryview'] >> nth=0", 400); tap("[data-a='delentry']", 200); tap("[data-a='delentry']", 500)
    ok("delete an entry (tap twice)", len(ST()["body"]) == n - 1 and title() == "ROOT:Body")
    ok("body fits width", noscroll())

    # ================= plan: build a workout =================
    tap("nav [data-tab='plan']", 400)
    tap("[data-a='day'][data-d='4']", 400); ok("Thursday added", 4 in ST()["days"])
    n0 = len(ST()["program"])
    tap("[data-a='newbuild']", 500)
    ok("new workout asks: what do you want to train? (muscle pictures)", pg.locator("[data-a='bg']").count() == 7 and pg.locator("[data-a='bg'] svg.bmap").count() == 7 and back_reachable())
    ok("build button hidden-disabled until a muscle is picked", pg.locator("[data-a='dobuild'][disabled]").count() == 1)
    tap("[data-a='bg'][data-g='0']", 200); tap("[data-a='bg'][data-g='3']", 200)
    ok("two muscles ticked", pg.locator(".mtile.on").count() == 2)
    tap("[data-a='dobuild']", 1800)
    cw = [w for w in ST()["program"] if w["n"] == "Chest & Arms"]
    ok("one tap builds a full workout (3 chest + 3 arms + walk)", len(cw) == 1 and len(cw[0]["x"]) == 7 and cw[0]["x"][-1]["kind"] == "c", [ (w["n"], len(w["x"])) for w in ST()["program"]])
    ok("compound exercise first", cw and cw[0]["x"][0]["e"] in ("Leverage_Chest_Press", "Leverage_Incline_Chest_Press", "Machine_Bench_Press", "Leverage_Decline_Chest_Press", "Smith_Machine_Bench_Press", "Smith_Machine_Decline_Press") , cw and cw[0]["x"][0]["e"])
    ok("lands on the builder with the list", pg.locator("#wname").count() == 1 and pg.locator(".edrow").count() == 7)
    ok("rows are calm: no controls until you open one", pg.locator("[data-a='sets']").count() == 0)
    pg.fill("#wname", "Arms"); W(900)
    arms = lambda: [w for w in ST()["program"] if w["n"] == "Arms"][0]
    ok("rename saves automatically", any(w["n"] == "Arms" for w in ST()["program"]))
    tap("[data-a='edopen'][data-i='0']", 300); ok("open a row → its controls", pg.locator("[data-a='sets']").count() == 2)
    tap("[data-a='sets'][data-i='0'][data-d='1']", 400); ok("+ set", arms()["x"][0]["s"] == 4)
    tap("[data-a='reps'][data-i='0'][data-j='3']", 400); x0 = arms()["x"][0]
    ok("rep range 15–20 (rest set for it)", x0["lo"] == 15 and x0["hi"] == 20 and x0["rest"] == 60)
    tap("[data-a='edopen'][data-i='1']", 300); e1 = arms()["x"][1]["e"]
    tap("[data-a='moveup'][data-i='1']", 400); ok("move up", arms()["x"][0]["e"] == e1)
    tap("[data-a='edopen'][data-i='1']", 300); tap("[data-a='rmex'][data-i='1']", 400); ok("remove", len(arms()["x"]) == 6)
    tap("[data-a='wcolor'][data-c='2']", 400); ok("colour", arms()["c"] == 2)
    tap("[data-p='library'][data-mode='many']", 1500)
    ok("add exercises opens on muscle pictures", "Add to Arms" in title() and pg.locator("#liblist [data-a='lm'] svg.bmap").count() == 7 and back_reachable())
    tap("#liblist [data-a='lm'][data-g='6']", 600)
    ok("tap Abs → abs exercises", pg.locator("#liblist [data-a='pick']").count() >= 10)
    ok("no Add bar until something is picked", pg.locator(".pickbar.hidden").count() == 1)
    tap("#liblist [data-a='pick'] >> nth=0", 100); tap("#liblist [data-a='pick'] >> nth=1", 100); tap("#liblist [data-a='pick'] >> nth=2", 100)
    ok("pick 3 → Add 3 exercises", "Add 3 exercises" in pg.inner_text(".pickbar"))
    tap("#liblist [data-a='pick'] >> nth=2", 100); ok("tap again un-picks", "Add 2 exercises" in pg.inner_text(".pickbar"))
    pg.fill("#libq", "curl"); W(400); ok("search still works", pg.locator("#liblist [data-a='pick']").count() >= 3)
    tap(".pickbar", 700)
    ok("added, walk stays last", len(arms()["x"]) == 8 and arms()["x"][-1]["kind"] == "c")
    tap("[data-a='back'] >> nth=-1", 400); ok("Done → Plan lists Arms", "Arms" in pg.inner_text("#view") and title() == "ROOT:Plan")
    tap("[data-a='newbuild']", 400); tap(".hdr .back", 500)
    ok("leaving New workout without building creates nothing", len(ST()["program"]) == n0 + 1)
    tap("[data-p='editor'] >> nth=4", 500); tap("[data-a='delworkout']", 200); tap("[data-a='delworkout']", 600)
    ok("delete a workout (tap twice)", len(ST()["program"]) == 4)
    tap("[data-p='editor'] >> nth=1", 500); tap("[data-a='edopen'][data-i='0']", 300); tap("[data-a='sets'][data-i='0'][data-d='1']", 400); tap("[data-a='back'] >> nth=-1", 300)
    ok("edit an existing workout", ST()["program"][1]["x"][0]["s"] == 4)
    # library browse + add to a workout
    tap("[data-p='library']", 1500); pg.fill("#libq", "machine bench"); W(300)
    tap("#liblist [data-a='exinfo'][data-e='Machine_Bench_Press']", 800)
    ok("exercise page from library, with muscle map", pg.locator(".how li").count() >= 2 and pg.locator(".mapbox polygon[fill='var(--mc)']").count() >= 1 and back_reachable())
    tap("[data-p='addto']", 400); tap("[data-a='addtoprog'][data-w='ub']", 600)
    ub = [w for w in ST()["program"] if w["id"] == "ub"][0]
    ok("added to Upper B, before the walk", ub["x"][-2]["e"] == "Machine_Bench_Press" and ub["x"][-1]["kind"] == "c")
    tap(".hdr .back", 300); tap(".hdr .back", 300); ok("Back, Back → Plan", title() == "ROOT:Plan")
    tap("[data-a='resetprog']", 200); tap("[data-a='resetprog']", 600)
    ok("reset plan (tap twice), history kept", ST()["program"][0]["x"][2]["e"] == "Seated_Cable_Rows" and len(ST()["sessions"]) == 2)
    tap("[data-p='howcoach']", 300); ok("how the coach works page", "Easy" in pg.inner_text("#view") and back_reachable()); tap(".hdr .back", 300)
    ok("plan fits width", noscroll())

    # ================= never stuck: every page has a working Back =================
    stuck = []
    for path in [["today", "[data-a='exinfo'] >> nth=0"], ["today", "[data-a='pickstart']"], ["plan", "[data-p='editor'] >> nth=0"], ["plan", "[data-p='library']"], ["body", "[data-p='entry']"], ["body", "[data-p='goal']"], ["progress", "[data-p='session'] >> nth=0"]]:
        tap(f"nav [data-tab='{path[0]}']", 300); tap(path[1], 900)
        if not back_reachable(): stuck.append(path)
        tap(".hdr .back", 400)
        if pg.locator(".hdr").count() or pg.is_hidden("nav.tabs"): stuck.append(path + ["no return"])
    ok("every page: Back visible after scrolling and returns to the tab", not stuck, stuck)
    ok("no pop-up windows anywhere", pg.locator(".sheet").count() == 0 and not dialogs)

    # ================= migration =================
    db["state"] = {"items": [], "log": [], "days": [0, 2, 3, 6], "next": 1, "active": None,
                   "sessions": [{"id": "v1s", "w": "ua", "start": NOW() - 3 * D, "end": NOW() - 3 * D + 3e6, "sets": [{"i": "a", "e": "chest_press", "k": 40, "r": 12, "t": 1}]}]}
    db["v"] += 1; pg.evaluate("localStorage.clear()"); pg.reload(); W(500); pg.fill("#pin", "2026"); pg.click("#pinGo"); W(1200)
    ok("v1 data upgraded and saved", ST()["ver"] == 2 and ST()["sessions"][0]["sets"][0]["e"] == CP and ST()["next"] == 1)
    ok("no page errors", not errs, errs[:3])
    br.close()
srv.shutdown()
f = [n for n, c in res if not c]; print(f"\nE2E lift: PASS {len(res)-len(f)}  FAIL {len(f)}"); sys.exit(1 if f else 0)
