// Lift logic grid (v4) — runs the coach, migration, calories, gym-visit rules and body math straight out of lift/index.html.
// Usage: node tests/lift_logic.mjs [path/to/lift/index.html]   (zero cost, no network)
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
const file = process.argv[2] || path.join(process.cwd(), "lift/index.html");
const html = fs.readFileSync(file, "utf8");
const src = html.slice(html.indexOf("/*LOGIC-START*/"), html.indexOf("/*LOGIC-END*/"));
const L = {}; vm.createContext(L); vm.runInContext(src, L);
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL " + n + (x !== undefined ? "  — " + JSON.stringify(x) : "")); } };
const D = 864e5, NOW = new Date("2026-10-14T15:00:00+03:00").getTime(); // Wednesday
const mk = (id, w, daysAgo, sets, mins = 50) => ({ id, w, wn: w, c: 0, start: NOW - daysAgo * D, end: NOW - daysAgo * D + mins * 60000, sets: sets.map(([e, k, r, f], n) => ({ i: id + n, e, k, r, f: f || 2, t: NOW - daysAgo * D + n })) });
const st0 = () => L.seedState();
const it = (e, s = 3, lo = 10, hi = 12, step = 2.5, kind = "w") => ({ e, n: e, kind, step, s, lo, hi, rest: 90 });
const CP = "DOoWcnA", LP = "eYnzaCm", LEGP = L.OLD2NEW.Leg_Press, WALK = L.OLD2NEW.Walking_Treadmill;

// ---- library facts
ok("core: every program exercise has facts", L.TEMPLATES.every(t => t.w.every(w => w.x.every(r => L.CORE[r[0]]))));
ok("kind: machine → weights", L.kindOfMeta(L.CORE[CP]) === "w");
ok("kind: incline walk → minutes", L.kindOfMeta(L.CORE[WALK]) === "c");
ok("kind: hyperextension (bodyweight) → reps", L.kindOfMeta(L.CORE[L.OLD2NEW.Hyperextensions_Back_Extensions]) === "b");
ok("step: leg press (sled) 5 kg, dumbbells 2 kg, machines 2.5 kg", L.stepOfMeta(L.CORE[LEGP]) === 5 && L.stepOfMeta(L.CORE[L.OLD2NEW.Side_Lateral_Raise]) === 2 && L.stepOfMeta(L.CORE[CP]) === 2.5);
ok("names in sentence case", L.CORE[CP][0] === "Machine chest press" && L.CORE[LP][0] === "Cable bar lateral pulldown");
ok("unknown id falls back to a readable name", L.metaOf(st0(), "Barbell_Hip_Thrust")[0] === "Barbell Hip Thrust");
{ const st = st0(); st.custom.c1 = { n: "Hip thrust machine", t: ["glutes"], bp: ["upper legs"], eq: ["leverage machine"], kind: "w" };
  ok("custom exercise facts", L.metaOf(st, "c1")[0] === "Hip thrust machine" && L.kindOfE(st, "c1") === "w"); }
{ const i = L.itemFor(st0(), CP); ok("new item defaults: 3 × 10–12, 90 s rest", i.s === 3 && i.lo === 10 && i.hi === 12 && i.rest === 90 && i.n === "Machine chest press"); }
{ const i = L.itemFor(st0(), WALK); ok("new cardio item: 15–20 min, no rest", i.kind === "c" && i.lo === 15 && i.hi === 20 && i.rest === 0); }

// ---- templates
const fb5 = L.tplById("fb5"), beg = L.tplById("beg4");
ok("5-day program: 5 routines, gym days Sa Su Mo We Th", fb5.w.length === 5 && JSON.stringify(fb5.days) === "[0,1,3,4,6]");
ok("5-day program never has two rest days in a row", L.restPairs(fb5.days).length === 0);
ok("beginner program: 4 routines", beg.w.length === 4);
ok("every routine ends with the incline walk", fb5.w.concat(beg.w).every(w => w.x[w.x.length - 1][0] === WALK));
{ const p = L.tplProgram(fb5, st0()); ok("template → program items with sets/reps/rest", p.length === 5 && p[0].x[0].s === 3 && p[0].x[0].hi === 12 && p[0].x[0].rest === 90 && p[2].x[6].lo === 20 && p[2].x[6].hi === 30);
  ok("routine ids are unique", new Set(p.map(w => w.id)).size === 5); }

// ---- seed
const s0 = st0();
ok("seed: v3, beginner 4-day", s0.ver === 3 && s0.program.length === 4 && s0.program[0].n === "Upper A");

// ---- migration from his live v2 data
const live = { ver: 2, days: [0, 1, 2, 3, 4, 5, 6], next: 0, active: null, notes: { Leg_Press: "Seat 3" }, body: [], goal: {}, custom: {},
  program: [{ id: "wabc", n: "Arms & Shoulders & Chest & Abs", c: 0, x: [
    { e: "Leg_Press", n: "Leg press", kind: "w", step: 5, s: 3, lo: 10, hi: 12, rest: 120 },
    { e: "Leverage_Chest_Press", n: "Chest press machine", kind: "w", step: 2.5, s: 3, lo: 10, hi: 12, rest: 90 },
    { e: "Wide-Grip_Lat_Pulldown", n: "Lat pulldown", kind: "w", step: 2.5, s: 3, lo: 10, hi: 12, rest: 90 },
    { e: "Seated_Leg_Curl", n: "Seated leg curl", kind: "w", step: 2.5, s: 2, lo: 12, hi: 15, rest: 60 },
    { e: "Seated_Side_Lateral_Raise", n: "Seated Side Lateral Raise", kind: "w", step: 2, s: 2, lo: 12, hi: 15, rest: 60 },
    { e: "Barbell_Hip_Thrust", n: "Barbell Hip Thrust", kind: "w", step: 2.5, s: 3, lo: 10, hi: 12, rest: 90 }]}],
  sessions: [mk("s1", "wabc", 2, [["Leg_Press", 60, 12], ["Leverage_Chest_Press", 30, 10], ["Barbell_Hip_Thrust", 40, 10]])] };
{ const m = L.migrate(live), x = m.program[0].x;
  ok("migrate: version 3, routine and days kept", m.ver === 3 && m.program[0].n === "Arms & Shoulders & Chest & Abs" && m.days.length === 7);
  ok("migrate: exercises moved to the illustrated library", x[0].e === LEGP && x[1].e === CP && x[2].e === LP && x[3].e === L.OLD2NEW.Seated_Leg_Curl && x[4].e === L.OLD2NEW.Seated_Side_Lateral_Raise);
  ok("migrate: new names", x[0].n === "Sled 45° leg press" && x[1].n === "Machine chest press");
  ok("migrate: sets/reps/rest kept", x[3].s === 2 && x[3].lo === 12 && x[3].hi === 15 && x[0].rest === 120);
  ok("migrate: logged sets follow", m.sessions[0].sets[0].e === LEGP && m.sessions[0].sets[1].e === CP);
  ok("migrate: an exercise with no match stays, as your own exercise", x[5].e === "Barbell_Hip_Thrust" && m.custom.Barbell_Hip_Thrust && m.custom.Barbell_Hip_Thrust.n === "Barbell Hip Thrust");
  ok("migrate: machine settings follow", m.notes[LEGP] === "Seat 3" && !m.notes.Leg_Press);
  ok("migrate: coach reads old history (60 kg × 12 → 65 kg on the 5 kg leg press)", L.coach(m, it(LEGP, 1, 10, 12, 5)).k === 65);
  ok("migrate: v3 passes through unchanged", JSON.stringify(L.migrate(m)) === JSON.stringify(m)); }
{ const v1 = { items: [], log: [], days: [0, 1, 3, 5], next: 2, sessions: [{ id: "a", w: "ua", start: NOW - 2 * D, end: NOW - 2 * D + 3e6, sets: [{ i: "1", e: "chest_press", k: 40, r: 12, t: 1 }, { i: "2", e: "walk", k: 0, r: 15, t: 2 }] }], active: null };
  const m = L.migrate(v1);
  ok("migrate v1: days, rotation and sets kept on new ids", JSON.stringify(m.days) === "[0,1,3,5]" && m.next === 2 && m.sessions[0].sets[0].e === CP && m.sessions[0].sets[1].e === WALK && m.sessions[0].wn === "Upper A"); }
ok("migrate: null → seed", L.migrate(null).ver === 3);
{ const m = L.migrate({ ver: 3, program: [], next: 9 }); ok("migrate: repairs empty program/bad next", m.program.length === 4 && m.next >= 0 && m.next < 4 && Array.isArray(m.body)); }

// ---- coach grid (reps × feel)
let gridBad = [], cases = 0;
for (const r1 of [8, 9, 10, 11, 12, 13, 15]) for (const r2 of [8, 10, 12, 14]) for (const f of [1, 2, 3]) {
  cases++; const st = st0(); st.sessions.push(mk("a", "x", 3, [[CP, 40, r1, f], [CP, 40, r2, f]]));
  const c = L.coach(st, it(CP, 2)), allTop = r1 >= 12 && r2 >= 12, want = allTop ? (f === 1 ? 45 : 42.5) : 40;
  if (c.k !== want || (allTop && c.r !== 10) || !c.msg) gridBad.push({ r1, r2, f, got: c.k, want });
}
ok(`coach grid: ${cases} combos give the right next weight`, !gridBad.length, gridBad.slice(0, 3));
ok("coach: first time → test set", L.coach(st0(), it(CP)).k === null);
{ const st = st0(); st.sessions.push(mk("a", "x", 6, [[CP, 40, 9], [CP, 40, 8]])); st.sessions.push(mk("b", "x", 2, [[CP, 40, 9], [CP, 40, 8]]));
  ok("coach: two tough sessions → ease off ~10%", L.coach(st, it(CP, 2)).k === 37.5); }
{ const st = st0(); st.sessions.push(mk("a", "x", 2, [[WALK, 0, 15]])); ok("coach: walk 15 → 17 min", L.coach(st, it(WALK, 1, 15, 20, 0, "c")).r === 17); }
const A = (r, f, first) => L.adjustNext(it(CP, 3), { k: 40, r, f }, first);
ok("adjust: easy at 12 → +2.5", A(12, 1).k === 42.5);
ok("adjust: first time, easy at 12 → +5", A(12, 1, true).k === 45);
ok("adjust: hard and short → −2.5", A(8, 3).k === 37.5);
ok("adjust: good at 11 → same", A(11, 2).k === 40);
ok("warm-ups: 40 kg → 20×10, 30×5", JSON.stringify(L.warmups(it(CP), 40)) === JSON.stringify([{ k: 20, r: 10 }, { k: 30, r: 5 }]));

// ---- PRs
{ const st = st0(); st.sessions.push(mk("a", "x", 2, [[CP, 40, 12], [CP, 40, 10]]));
  ok("PR: heavier → weight PR", L.prFor(st, it(CP), 42.5, 6).type === "weight");
  ok("PR: more reps → best set", L.prFor(st, it(CP), 40, 13).type === "set");
  ok("PR: weaker → none", L.prFor(st, it(CP), 40, 11) === null); }

// ---- ops
{ const st = st0(); const ops = [{ t: "start", p: { id: "S", w: st.program[0].id }, ts: NOW }, { t: "set", p: { sid: "S", i: "1", e: CP, k: 40, r: 12, f: 2 }, ts: NOW + 60000 }, { t: "feel", p: { sid: "S", i: "1", f: 1 }, ts: NOW + 61000 }, { t: "finish", p: { sid: "S" }, ts: NOW + 50 * 60000 }];
  ops.forEach(o => L.applyOp(st, o)); const once = JSON.stringify(st); ops.forEach(o => L.applyOp(st, o));
  ok("ops: replaying a batch changes nothing (409-safe)", JSON.stringify(st) === once);
  ok("ops: finish records start and finish times", st.sessions[0].start === NOW && st.sessions[0].end === NOW + 50 * 60000 && st.next === 1); }
{ const st = st0(); L.applyOp(st, { t: "start", p: { id: "S", w: st.program[0].id }, ts: NOW }); L.applyOp(st, { t: "set", p: { sid: "S", i: "1", e: CP, k: 40, r: 12 }, ts: NOW + 600000 });
  L.applyOp(st, { t: "finish", p: { sid: "S", end: NOW + 900000 }, ts: NOW + 9 * 36e5 });
  ok("ops: forgotten workout saved with the real finish time", st.sessions[0].end === NOW + 900000); }
{ const st = st0(); st.sessions.push(mk("a", "x", 1, [[CP, 40, 12]]));
  L.applyOp(st, { t: "times", p: { id: "a", start: NOW - D + 3600000, end: NOW - D + 7200000 }, ts: NOW });
  ok("ops: edit start/finish time", st.sessions[0].start === NOW - D + 3600000 && st.sessions[0].end === NOW - D + 7200000);
  L.applyOp(st, { t: "times", p: { id: "a", start: NOW, end: NOW - 1 }, ts: NOW }); ok("ops: finish before start is refused", st.sessions[0].start === NOW - D + 3600000); }
{ const st = st0(); const prog = L.tplProgram(fb5, st); L.applyOp(st, { t: "useprog", p: { program: prog, days: fb5.days }, ts: NOW });
  ok("ops: use the 5-day program (routines + days, starts at routine 1)", st.program.length === 5 && st.next === 0 && JSON.stringify(st.days) === "[0,1,3,4,6]"); }

// ---- calories
const withW = (kg) => { const st = st0(); st.body.push({ id: "b", t: NOW - 10 * D, kg }); return st; };
{ const st = withW(108); const s = mk("a", "x", 1, [[CP, 40, 12], [CP, 40, 12], [WALK, 0, 20]], 60);
  const want = Math.round(3.5 * 3.5 * 108 / 200 * 40 + 6 * 3.5 * 108 / 200 * 20);
  ok("calories: 40 min lifting + 20 min incline walk at 108 kg ≈ " + want, L.sessionKcal(st, s) === want, L.sessionKcal(st, s)); }
ok("calories: unknown without a weight", L.sessionKcal(st0(), mk("a", "x", 1, [[CP, 40, 12]])) === null);
{ const st = withW(100); st.body.push({ id: "c", t: NOW - 1 * D, kg: 98 });
  ok("calories: uses the weight from that day", L.weightAt(st, NOW - 5 * D) === 100 && L.weightAt(st, NOW) === 98); }
{ const st = withW(108); const s = mk("a", "x", 1, [[CP, 40, 12]], 900);
  ok("calories: a forgotten 15-hour workout is capped at 3 hours", L.sessionKcal(st, s) === Math.round(3.5 * 3.5 * 108 / 200 * 180)); }
{ const st = withW(108); const e = L.routineEst(st, st.program[0].x, NOW);
  ok("routine estimate: ~minutes and calories", e.min >= 45 && e.min <= 70 && e.kcal > 300 && e.kcal < 700, e);
  ok("routine estimate: no calories without weight", L.routineEst(st0(), st0().program[0].x, NOW).kcal === null); }

// ---- rule: never two rest days in a row
const ruleSt = (agos) => { const st = st0(); agos.forEach((a, i) => st.sessions.push(mk("r" + i, "x", a, [[CP, 40, 12]]))); return st; };
ok("rule: no history → nothing to say", L.ruleToday(st0(), NOW) === null);
ok("rule: trained today → done", L.ruleToday(ruleSt([0, 3]), NOW) === "done");
ok("rule: rested yesterday → must train today", L.ruleToday(ruleSt([2]), NOW) === "must");
ok("rule: trained yesterday, today is a gym day → gym", L.ruleToday(ruleSt([1]), NOW) === "gym");
{ const st = ruleSt([1]); st.days = [0, 1, 2, 4, 6]; ok("rule: trained yesterday, today is a rest day → rest", L.ruleToday(st, NOW) === "rest"); }
ok("rule: first-ever workout yesterday isn't a missed day", L.ruleToday(ruleSt([1]), NOW) !== "must");
ok("plan check: Tue+Wed off → one pair", JSON.stringify(L.restPairs([0, 1, 4, 5, 6])) === "[[2,3]]");
ok("plan check: Fri+Sat off wraps to Sun ok", JSON.stringify(L.restPairs([0, 1, 2, 3, 4])) === "[[5,6]]");
ok("plan check: Sat+Sun off across the week edge", JSON.stringify(L.restPairs([1, 2, 3, 4, 5])) === "[[6,0]]");
ok("plan check: every day → none", L.restPairs([0, 1, 2, 3, 4, 5, 6]).length === 0);

// ---- visit stats
{ const st = withW(108); [0, 1, 3, 9, 20].forEach((a, i) => st.sessions.push(mk("v" + i, "x", a, [[CP, 40, 12]], 40 + i * 5)));
  const g = L.gymStats(st, NOW);
  ok("stats: this week counts days trained (Sun–Sat)", g.week === 3, g);
  ok("stats: this month and average minutes", g.month === 4 && g.avgMin === 50 && g.monthMin === 40 + 45 + 50 + 55, g);
  ok("stats: monthly calories", g.monthKcal > 0); }
{ const st = st0(); L.applyOp(st, { t: "start", p: { id: "S", w: st.program[0].id }, ts: NOW - 6 * 36e5 }); L.applyOp(st, { t: "set", p: { sid: "S", i: "1", e: CP, k: 40, r: 12 }, ts: NOW - 5 * 36e5 });
  const s = L.staleActive(st, NOW); ok("forgot to finish: noticed after 3 h, suggests last set + 5 min", s && s.end === NOW - 5 * 36e5 + 300000);
  ok("active workout not stale while training", L.staleActive(st, NOW - 5 * 36e5 + 600000) === null); }
{ const st = st0(); st.sessions.push(mk("a", "x", 5, [[CP, 40, 12], [CP, 40, 11]])); st.sessions.push(mk("b", "x", 2, [[CP, 42.5, 10]]));
  const l = L.lastTime(st, CP); ok("last time: most recent session's sets", l && l.sets.length === 1 && l.sets[0].k === 42.5); }

// ---- body
const body = (pts, goal) => { const st = st0(); pts.forEach(([d, kg], i) => st.body.push({ id: "b" + i, t: NOW - d * D, kg })); if (goal) st.goal = { kg: goal }; return st; };
{ const p = L.projection(body([[28, 110], [21, 109.2], [14, 108.6], [7, 107.9], [0, 107.1]], 95), NOW);
  ok("body: pace + goal date", p.state === "ontrack" && p.perWeek < -0.6 && p.days > 100 && p.days < 130, p); }
ok("body: gaining while goal lower → away", L.projection(body([[14, 100], [7, 101], [0, 102]], 90), NOW).state === "away");

console.log(`\nLOGIC lift: PASS ${pass}  FAIL ${fail}`); process.exit(fail ? 1 : 0);
