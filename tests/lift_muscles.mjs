// Lift 4.5 grid — specific muscles, weekly muscle log, gap coach, fixed days, my-gym equipment, setup plans.
// Runs the pure logic straight out of lift/index.html + the real lift/exercises.json. Zero cost, no network.
// Usage: node tests/lift_muscles.mjs [path/to/lift]
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
const dir = process.argv[2] || path.join(process.cwd(), "lift");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const src = html.slice(html.indexOf("/*LOGIC-START*/"), html.indexOf("/*LOGIC-END*/"));
const L = {}; vm.createContext(L); vm.runInContext(src, L);
const LIB = JSON.parse(fs.readFileSync(path.join(dir, "exercises.json"), "utf8"));
LIB.forEach(x => { L.LIBMAP[x[0]] = [x[1], x[2], x[3], x[4], x[5]]; });
const byName = n => { const x = LIB.find(r => r[1] === n); if (!x) throw new Error("no exercise " + n); return x[0]; };
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL " + n + (x !== undefined ? "  — " + JSON.stringify(x).slice(0, 400) : "")); } };
const D = 864e5, NOW = new Date("2026-10-14T15:00:00+03:00").getTime(); // Wednesday
const st0 = () => L.seedState();
const T = n => L.tagsOf(st0(), byName(n));
const mk = (id, w, daysAgo, sets) => ({ id, w, wn: w, c: 0, start: NOW - daysAgo * D, end: NOW - daysAgo * D + 3e6, sets: sets.map(([e, k, r], n) => ({ i: id + n, e, k, r, f: 2, t: NOW - daysAgo * D + n })) });

// ---- 1. every exercise maps to specific muscles
const codes = new Set(L.MUS.map(m => m[0]));
const untagged = LIB.filter(x => x[4][0] !== "cardio" && !/stretch|smr|foam|roller|yoga|pose/i.test(x[1])).filter(x => !L.tagsOf(st0(), x[0]).p.length);
ok("every non-cardio exercise has at least one main muscle", untagged.length === 0, untagged.slice(0, 10).map(x => x[1]));
ok("every tag is a known muscle", LIB.every(x => { const t = L.tagsOf(st0(), x[0]); return t.p.concat(t.s).every(c => codes.has(c)); }));
ok("a muscle is never both main and helper", LIB.every(x => { const t = L.tagsOf(st0(), x[0]); return t.p.every(c => t.s.indexOf(c) < 0); }));
// spot checks on the movements people actually do
const cases = [
  ["Barbell incline bench press", "cu"], ["Dumbbell incline bench press", "cu"], ["Machine incline chest press", "cu"], ["Cable fly upper chest", "cu"], ["Decline push-up", "cu"], ["Landmine press", "df"],
  ["Barbell bench press", "cm"], ["Machine chest press", "cm"], ["Push-up", "cm"], ["Dumbbell fly", "cm"], ["Machine seated fly", "cm"],
  ["Barbell decline bench press", "cl"], ["Chest dip", "cl"], ["Cable fly lower chest", "cl"],
  ["Dumbbell lateral raise", "ds"], ["Cable lateral raise", "ds"], ["Machine lateral raise", "ds"], ["Barbell upright row", "ds"],
  ["Dumbbell front raise", "df"], ["Machine shoulder press", "df"], ["Dumbbell seated shoulder press", "df"],
  ["Machine seated reverse fly", "dr"], ["Dumbbell reverse fly", "dr"], ["Cable rear delt row (with rope)", "dr"],
  ["Cable bar lateral pulldown", "la"], ["Pull-up", "la"], ["Chin-up", "la"],
  ["Cable seated row", "ub"], ["Dumbbell bent over row", "ub"], ["Barbell bent over row", "ub"], ["Seal row", "ub"],
  ["Barbell shrug", "tr"], ["Hyperextension", "lb"], ["Machine back extension", "lb"],
  ["Barbell curl", "bi"], ["Dumbbell hammer curl", "bi"], ["Bayesian cable curl", "bi"], ["Cable pushdown", "tc"], ["Ez-bar skullcrusher", "tc"],
  ["Barbell wrist curl", "fa"], ["Machine seated crunch", "ab"], ["Plank", "ab"], ["Russian twist", "ob"],
  ["Sled 45° leg press", "qd"], ["Barbell full squat", "qd"], ["Dumbbell goblet squat", "qd"], ["Machine leg extension", "qd"], ["Dumbbell lunge", "qd"],
  ["Machine seated leg curl", "hm"], ["Machine lying leg curl", "hm"], ["Barbell hip thrust", "gl"], ["Hip thrust machine", "gl"],
  ["Machine seated hip abduction", "ox"], ["Machine seated hip adduction", "ad"], ["Machine seated calf raise", "cv"], ["Tibialis raise", "sh"], ["Plate neck curl", "nk"]];
const wrong = cases.filter(([n, c]) => T(n).p[0] !== c).map(([n, c]) => [n, "want " + c, T(n)]);
ok(cases.length + " key exercises: first main muscle is the right one", wrong.length === 0, wrong);
ok("squats work quads AND glutes as main muscles", T("Barbell full squat").p.includes("gl") && T("Dumbbell lunge").p.includes("gl"));
ok("leg press: glutes only help", T("Sled 45° leg press").s.includes("gl") && !T("Sled 45° leg press").p.includes("gl"));
ok("bench press: front delts + triceps help", T("Barbell bench press").s.includes("df") && T("Barbell bench press").s.includes("tc"));
ok("lat pulldown: biceps help (your example: pulldown also trains biceps)", T("Cable bar lateral pulldown").s.includes("bi"));
ok("rows: rear delts help, not front delts", T("Cable seated row").s.includes("dr") && !T("Cable seated row").s.includes("df"));
ok("overhead press also works side delts", T("Machine shoulder press").s.includes("ds"));
ok("calf press on the leg press stays a calf exercise", T("Sled calf press on leg press").p[0] === "cv");
const nUpper = LIB.filter(x => L.tagsOf(st0(), x[0]).p.includes("cu")).length;
ok("upper chest has a real list (>= 25 exercises)", nUpper >= 25, nUpper);
for (const m of L.MUS) { const n = LIB.filter(x => L.tagsOf(st0(), x[0]).p.includes(m[0])).length; ok("muscle '" + m[1] + "' has exercises", n >= (m[0] === "hf" ? 0 : m[0] === "sh" ? 1 : 3), n); }
{ const st = st0(); st.custom.c1 = { n: "My machine", mp: ["cu"], t: ["pectorals"], bp: ["chest"], eq: ["leverage machine"], kind: "w" };
  ok("custom exercise uses the muscle the user picked", L.tagsOf(st, "c1").p[0] === "cu"); }

// ---- 2. counting sets per muscle
const BENCH = byName("Barbell bench press"), PULL = byName("Cable bar lateral pulldown"), WALK = L.OLD2NEW.Walking_Treadmill, LEGP = byName("Sled 45° leg press");
{ const cr = L.setCredit(st0(), [{ e: BENCH, k: 40, r: 10 }, { e: BENCH, k: 40, r: 10 }, { e: BENCH, k: 20, r: 10, wu: 1 }, { e: WALK, k: 0, r: 20 }]);
  ok("2 bench sets → middle chest 2, triceps 1, front delts 1 (helpers ½)", cr.cm === 2 && cr.tc === 1 && cr.df === 1, cr);
  ok("warm-ups and cardio don't count", Object.values(cr).reduce((a, b) => a + b, 0) === 2 + 1 + 1, cr); }
{ const cr = L.setCredit(st0(), [{ e: PULL, k: 40, r: 10 }]); ok("1 pulldown set → lats 1, biceps ½", cr.la === 1 && cr.bi === 0.5, cr); }
{ const u = L.unitById("ch"), cr = { cu: 2, cm: 3, cl: 1 }; ok("chest = upper + middle + lower", L.unitVal(cr, u) === 6); }
ok("targets scale with level", JSON.stringify(L.tgt(L.unitById("qd"), "new")) === "[6,20]" && JSON.stringify(L.tgt(L.unitById("qd"), "some")) === "[10,20]" && JSON.stringify(L.tgt(L.unitById("qd"), "exp")) === "[12,20]");
ok("status bands", L.statusOf(0, [6, 20]) === "none" && L.statusOf(3, [6, 20]) === "low" && L.statusOf(6, [6, 20]) === "ok" && L.statusOf(21, [6, 20]) === "high" && L.statusOf(2, null) === "some");
ok("level defaults to new", L.levelOf(st0()) === "new" && L.levelOf({ level: "exp" }) === "exp");
{ const st = st0(); st.sessions = [mk("a", "x", 1, [[BENCH, 40, 10], [BENCH, 40, 10]]), mk("b", "x", 9, [[BENCH, 40, 10]])];
  const w0 = L.weekStart(NOW), cr = L.creditBetween(st, w0, w0 + 7 * D); ok("this week only counts this week's sessions (Sun–Sat)", cr.cm === 2, cr);
  ok("week starts Sunday", new Date(w0).getDay() === 0 && w0 <= NOW && NOW - w0 < 7 * D); }

// ---- 3. gap coach: projects the rest of the week's plan before nagging
{ const st = st0(); const prog = L.tplProgram(L.tplById("fb5"), st); L.applyOp(st, { t: "useprog", p: { program: prog, days: [0, 1, 3, 4, 6] }, ts: NOW });
  const g = L.weekGaps(st, NOW), ids = g.map(x => x.u.id);
  const big = x => x.u.t[0] >= 6 ? 1 : 0;
  ok("gap list: big muscles first, then worst first", g.every((x, i) => i === 0 || big(x) < big(g[i - 1]) || (big(x) === big(g[i - 1]) && x.need / x.t[0] <= g[i - 1].need / g[i - 1].t[0] + 1e-9)), g.map(x => x.u.id));
  ok("planned sets count: a muscle the plan covers is not a gap", !ids.includes("qd"), g.map(x => [x.u.id, x.proj]));
  st.days = []; st.program.forEach(w => { w.days = []; });
  const g2 = L.weekGaps(st, NOW); ok("nothing planned + nothing done → every target muscle is a gap", g2.length === L.units().filter(u => u.t).length, g2.length);
  st.sessions = [mk("q", "x", 0, Array.from({ length: 6 }, () => [LEGP, 100, 10]))];
  ok("6 leg press sets today → quads reach the new-lifter target (6)", !L.weekGaps(st, NOW).some(x => x.u.id === "qd")); }

// ---- 4. fixed days
{ const st = st0(); const prog = L.tplProgram(L.tplById("beg4"), st); L.applyOp(st, { t: "useprog", p: { program: prog, days: [0, 2, 3, 6] }, ts: NOW });
  const ids = st.program.map(w => w.id); // Upper A, Lower A, Upper B, Lower B
  const P = L.pinDay(JSON.parse(JSON.stringify(st.program)), ids[3], 3); // Lower B always on Wednesday
  L.applyOp(st, { t: "prog", p: { program: P }, ts: NOW });
  const wk = L.weekPlan(st, NOW), wed = wk.find(d => d.dow === 3), sat = wk.find(d => d.dow === 6);
  ok("pinned routine is planned on its day", wed.plan && wed.plan.id === ids[3]);
  ok("today (Wednesday) shows the pinned routine", L.nextUp(st, NOW).w.id === ids[3] && L.nextUp(st, NOW).today);
  ok("other gym days rotate through the unpinned routines only", sat.plan && sat.plan.id !== ids[3]);
  ok("pinning a day moves it off another routine (one routine per day)", (() => { const Q = L.pinDay(JSON.parse(JSON.stringify(P)), ids[0], 3); return Q.find(w => w.id === ids[3]).days === undefined && Q.find(w => w.id === ids[0]).days[0] === 3; })());
  // finishing the pinned routine keeps the rotation where it was
  const next0 = st.next;
  L.applyOp(st, { t: "start", p: { id: "s1", w: ids[3] }, ts: NOW });
  L.applyOp(st, { t: "set", p: { sid: "s1", i: "x1", e: st.program[3].x[0].e, k: 10, r: 10 }, ts: NOW });
  L.applyOp(st, { t: "finish", p: { sid: "s1" }, ts: NOW + 1000 });
  ok("finishing a pinned routine doesn't move the rotation", st.next === next0, st.next);
  ok("after training today, next up is a rotating routine on a later day", (() => { const n = L.nextUp(st, NOW); return !n.today && n.w.id !== ids[3]; })());
  // finishing a rotating routine passes the turn to the next ROTATING routine (skips the pinned one)
  st.next = 2; L.applyOp(st, { t: "start", p: { id: "s2", w: ids[2] }, ts: NOW + 2000 });
  L.applyOp(st, { t: "set", p: { sid: "s2", i: "y1", e: st.program[2].x[0].e, k: 10, r: 10 }, ts: NOW + 2000 });
  L.applyOp(st, { t: "finish", p: { sid: "s2" }, ts: NOW + 3000 });
  ok("rotation skips the pinned routine (Upper B → Upper A, not Lower B)", st.next === 0, st.next);
  ok("no pins = exactly the old behaviour", (() => { const s2 = st0(); const p2 = L.tplProgram(L.tplById("beg4"), s2); L.applyOp(s2, { t: "useprog", p: { program: p2, days: [0, 2, 3, 6] }, ts: NOW }); s2.next = 1; const wk2 = L.weekPlan(s2, NOW); return wk2.find(d => d.dow === 3).plan.id === s2.program[1].id && wk2.find(d => d.dow === 6).plan.id === s2.program[2].id; })()); }
{ const st = st0(); st.sessions = [mk("o", "x", 3, [[BENCH, 40, 10]])]; st.days = [0, 3]; // trained Sunday, rest Mon+Tue
  ok("never-two-rest-days rule on by default", L.ruleToday(st, NOW) === "must");
  L.applyOp(st, { t: "setting", p: { k: "strict", v: false }, ts: NOW }); ok("…and can be switched off (3-day plans)", L.ruleToday(st, NOW) === "gym"); }
{ const st = st0(); L.applyOp(st, { t: "setting", p: { k: "hack", v: 1 }, ts: NOW }); ok("settings op only accepts known keys", st.hack === undefined); }

// ---- 5. my gym's equipment
{ const st = st0(); ok("no equipment list = everything allowed", L.gearOk(st, BENCH));
  st.gear = ["machine", "cable", "dumbbell", "cardio"];
  ok("barbell bench hidden for a machines+dumbbells gym", !L.gearOk(st, BENCH));
  ok("machine chest press allowed", L.gearOk(st, byName("Machine chest press")));
  ok("bodyweight always allowed", L.gearOk(st, byName("Push-up")));
  ok("treadmill walk allowed with cardio machines", L.gearOk(st, WALK));
  st.gear = ["dumbbell"]; ok("no treadmill at a dumbbells-only home gym", !L.gearOk(st, WALK)); }

// ---- 6. first-time setup builds a real plan
const POOL = LIB.filter(x => !/stretch|smr|foam|roller|yoga|pose/i.test(x[1])).map(x => x[0]);
for (const days of [3, 4, 5]) for (const kit of ["full", "basic", "home"]) for (const exp of ["new", "some", "exp"]) for (const goal of ["muscle", "fat", "strength", "fit"]) {
  const st = st0(), P = L.buildPlan(st, { days, kit, exp, goal }, POOL), tag = `${days}d/${kit}/${exp}/${goal}`;
  const tmp = { custom: {}, gear: P.gear };
  const lifts = P.program.flatMap(w => w.x.filter(i => i.kind !== "c"));
  if (!(P.days.length === days && L.restPairs(P.days).length === (days >= 4 ? 0 : L.restPairs(P.days).length))) ok(tag + " days", false, P.days);
  if (!P.program.every(w => w.x.every(i => L.gearOk(tmp, i.e)))) ok(tag + ": every exercise fits the gym", false, P.program.map(w => w.x.filter(i => !L.gearOk(tmp, i.e)).map(i => i.n)));
  if (!P.program.every(w => w.x.filter(i => i.kind !== "c").length >= 4)) ok(tag + ": every routine keeps at least 4 exercises", false, P.program.map(w => w.x.length));
  if (!P.program.every(w => new Set(w.x.map(i => i.e)).size === w.x.length)) ok(tag + ": no exercise twice in a routine", false);
  if (exp === "new" && !lifts.every(i => i.s === 2)) ok(tag + ": new lifters start at 2 sets", false);
  if (goal === "strength" && !P.program.every(w => w.x.filter(i => i.kind === "w").slice(0, 2).every(i => i.hi === 8))) ok(tag + ": strength = 6–8 reps on first lifts", false);
  if (goal === "fat" && !P.program.every(w => w.x.filter(i => i.kind === "c").every(i => i.lo === 20))) ok(tag + ": fat loss = longer walk", false);
  if (P.strict !== (days >= 4)) ok(tag + ": rest rule", false);
  pass++;
}
{ const st = st0(), P = L.buildPlan(st, { days: 5, kit: "full", exp: "new", goal: "muscle" }, POOL); L.applyOp(st, { t: "useplan", p: P, ts: NOW });
  ok("using the plan sets routines, days, level, goal and marks setup done", st.program.length === 5 && JSON.stringify(st.days) === "[0,1,3,4,6]" && st.level === "new" && st.setup === 1 && st.gear === undefined); }
{ const st = st0(), P = L.buildPlan(st, { days: 4, kit: "home", exp: "some", goal: "muscle" }, POOL);
  ok("home plan swaps machines for dumbbell/band/bodyweight moves with the same main muscle", P.program.every(w => w.x.every(i => L.gearOk({ gear: P.gear, custom: {} }, i.e))) && P.program[0].x.length >= 5, P.program[0].x.map(i => i.n)); }
ok("3-day template exists and every exercise has facts", !!L.tplById("fb3") && L.tplById("fb3").w.every(w => w.x.every(r => L.CORE[r[0]])));

// ---- bottom bar (4.6): no JavaScript moves the bar any more; the page itself is made screen-tall on iPhone
// home-screen apps (iOS 26 shortens the viewport by the status-bar height while the page is shorter than the screen).
ok("home-screen apps get a screen-tall page", /@media \(display-mode: standalone\)\{html\{min-height:min\(100lvh,calc\(100% \+ env\(safe-area-inset-top\)\)\)\}\}/.test(html));
ok("…and the same rule by class for iOS versions without display-mode", html.includes("html.standalone{min-height:min(100lvh,calc(100% + env(safe-area-inset-top)))}") && html.includes('classList.add("standalone")'));
ok("no code moves or re-pads the bottom bar", !/navLayout|sbPad|--navshift|nav\.tabs[^{]*\{[^}]*transform/.test(html));
ok("the bar sits on the screen bottom with the home-indicator space inside it", /nav\.tabs\{position:fixed;left:0;right:0;bottom:0;[^}]*padding:6px 6px calc\(6px \+ var\(--sb\)\)/.test(html));
console.log(`\nMUSCLES lift: PASS ${pass}  FAIL ${fail}`); if (fail) process.exit(1);
