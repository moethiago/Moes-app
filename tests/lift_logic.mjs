// Lift logic grid — runs the coach, migration, schedule and body math straight out of lift/index.html.
// Usage: node tests/lift_logic.mjs [path/to/lift/index.html]   (zero cost, no network)
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
const file = process.argv[2] || path.join(process.cwd(), "lift/index.html");
const html = fs.readFileSync(file, "utf8");
const src = html.slice(html.indexOf("/*LOGIC-START*/"), html.indexOf("/*LOGIC-END*/"));
const L = {}; vm.createContext(L); vm.runInContext(src, L);
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL " + n + (x !== undefined ? "  — " + JSON.stringify(x) : "")); } };
const D = 864e5, NOW = new Date("2026-10-13T15:00:00+03:00").getTime();
const mk = (id, w, daysAgo, sets) => ({ id, w, wn: w, c: 0, start: NOW - daysAgo * D, end: NOW - daysAgo * D + 3e6, sets: sets.map(([e, k, r, f], n) => ({ i: id + n, e, k, r, f: f || 2, t: NOW - daysAgo * D + n })) });
const st0 = () => L.seedState();
const it = (e, s = 3, lo = 10, hi = 12, step = 2.5, kind = "w") => ({ e, n: e, kind, step, s, lo, hi, rest: 90 });
const P = "Leverage_Chest_Press";

// ---- seed + program
const s0 = st0();
ok("seed: 4 workouts, rotation starts at Upper A", s0.program.length === 4 && s0.program[0].n === "Upper A" && s0.next === 0);
ok("seed: every program exercise has curated how-to", s0.program.every(w => w.x.every(x => L.CUR[x.e] && L.CUR[x.e].c.length === 3)));
ok("seed: every workout ends with the incline walk", s0.program.every(w => w.x[w.x.length - 1].kind === "c"));

// ---- coach: full grid over reps × feel × sets
const cases = [];
for (const r1 of [8, 9, 10, 11, 12, 13, 15]) for (const r2 of [8, 10, 12, 14]) for (const f of [1, 2, 3]) cases.push([r1, r2, f]);
let gridBad = [];
for (const [r1, r2, f] of cases) {
  const st = st0(); st.sessions.push(mk("a", "ua", 3, [[P, 40, r1, f], [P, 40, r2, f]]));
  const c = L.coach(st, it(P, 2)), allTop = r1 >= 12 && r2 >= 12, low = r1 < 10 || r2 < 10;
  const want = allTop ? (f === 1 ? 45 : 42.5) : 40;
  if (c.k !== want) gridBad.push({ r1, r2, f, got: c.k, want });
  if (allTop && c.r !== 10) gridBad.push({ r1, r2, f, reps: c.r });
  if (!c.msg || c.msg.length < 10) gridBad.push({ r1, r2, f, msg: c.msg });
}
ok(`coach grid: ${cases.length} reps×feel combos give the right next weight`, !gridBad.length, gridBad.slice(0, 4));
{ const st = st0(); ok("coach: first time → test set, no weight", L.coach(st, it(P)).k === null && L.coach(st, it(P)).tag === "new"); }
{ const st = st0(); st.sessions.push(mk("a", "ua", 3, [[P, 40, 12], [P, 40, 12]])); ok("coach: 2 sets at 12 but program wants 3 → no increase", L.coach(st, it(P, 3)).k === 40); }
{ const st = st0(); st.sessions.push(mk("a", "ua", 6, [[P, 40, 9], [P, 40, 8]])); st.sessions.push(mk("b", "ua", 2, [[P, 40, 9], [P, 40, 8]]));
  const c = L.coach(st, it(P, 2)); ok("coach: two sessions below range → deload ~10% (37.5)", c.k === 37.5 && c.tag === "down", c); }
{ const st = st0(); st.sessions.push(mk("a", "ua", 6, [[P, 40, 9], [P, 40, 8]])); st.sessions.push(mk("b", "ua", 2, [[P, 42.5, 9], [P, 42.5, 8]]));
  ok("coach: below range at a NEW weight → hold, no deload", L.coach(st, it(P, 2)).k === 42.5); }
{ const st = st0(); st.sessions.push(mk("a", "ua", 2, [[P, 5, 9], [P, 5, 8]])); st.sessions.push(mk("b", "ua", 1, [[P, 5, 9], [P, 5, 8]]));
  const c = L.coach(st, it(P, 2)); ok("coach: deload never goes below 0 and always drops", c.k < 5 && c.k >= 0, c); }
{ const st = st0(); st.sessions.push(mk("a", "ua", 2, [[P, 40, 12], [P, 40, 12], [P, 35, 15]]));
  ok("coach: uses the main working weight, not a back-off set", L.coach(st, it(P, 2)).k === 42.5); }
{ const st = st0(); st.sessions.push(mk("a", "ua", 2, [[P, 40, 12, 2], [P, 40, 12, 2]])); st.sessions[0].sets.unshift({ i: "w", e: P, k: 20, r: 10, f: 2, wu: 1, t: 0 });
  ok("coach: warm-up sets ignored", L.coach(st, it(P, 2)).k === 42.5); }
{ const B = "Hyperextensions_Back_Extensions", st = st0(); st.sessions.push(mk("a", "lb", 2, [[B, 0, 15], [B, 0, 15]]));
  const c = L.coach(st, it(B, 2, 10, 15, 2.5, "b")); ok("coach: bodyweight maxed → hold a 2.5 kg plate", c.k === 2.5 && /plate/.test(c.msg), c); }
{ const Wk = "Walking_Treadmill", st = st0(); st.sessions.push(mk("a", "ua", 2, [[Wk, 0, 15]]));
  const c = L.coach(st, it(Wk, 1, 15, 20, 0, "c")); ok("coach: walk 15 → 17 min next", c.r === 17, c); }
{ const Wk = "Walking_Treadmill", st = st0(); st.sessions.push(mk("a", "ua", 2, [[Wk, 0, 20, 2]]));
  ok("coach: walk at 20 min → steeper, not longer", /steeper/.test(L.coach(st, it(Wk, 1, 15, 20, 0, "c")).msg)); }
{ const st = st0(); st.sessions.push(mk("a", "ua", 2, [["Side_Lateral_Raise", 4, 15], ["Side_Lateral_Raise", 4, 15]]));
  ok("coach: dumbbell step 1 kg (4 → 5)", L.coach(st, it("Side_Lateral_Raise", 2, 12, 15, 1)).k === 5); }

// ---- in-workout adjustment after each set
const A = (r, f, first) => L.adjustNext(it(P, 3), { k: 40, r, f }, first);
ok("adjust: 16 reps → too light, +2.5", A(16, 2).k === 42.5);
ok("adjust: easy at 12 → +2.5", A(12, 1).k === 42.5);
ok("adjust: first time, easy at 12 → +5 (calibrating)", A(12, 1, true).k === 45);
ok("adjust: first time, easy at 10 → +2.5", A(10, 1, true).k === 42.5);
ok("adjust: hard and under range → −2.5", A(8, 3).k === 37.5);
ok("adjust: good at 11 → same weight", A(11, 2).k === 40 && A(11, 2).r === 11);
ok("adjust: hard at 10 → same weight", A(10, 3).k === 40);
ok("adjust: never negative", L.adjustNext(it(P), { k: 0, r: 5, f: 3 }).k === 0);
let adjBad = []; for (let r = 1; r <= 25; r++) for (const f of [1, 2, 3]) for (const first of [true, false]) { const a = L.adjustNext(it(P), { k: 40, r, f }, first); if (!(a.k >= 0 && a.k <= 45 && a.r >= 1)) adjBad.push({ r, f, first, a }); }
ok("adjust grid: 150 combos stay sane (0 ≤ kg ≤ +2 steps)", !adjBad.length, adjBad[0]);

// ---- warm-ups
ok("warm-ups: 40 kg → 20×10, 30×5", JSON.stringify(L.warmups(it(P), 40)) === JSON.stringify([{ k: 20, r: 10 }, { k: 30, r: 5 }]));
ok("warm-ups: none for light weights", L.warmups(it(P), 7.5).length === 0);
ok("warm-ups: none for cardio or bodyweight", L.warmups(it("x", 1, 1, 1, 0, "c"), 50).length === 0 && L.warmups(it("x", 1, 1, 1, 2.5, "b"), 50).length === 0);

// ---- PRs
{ const st = st0(); ok("PR: nothing on first ever set", L.prFor(st, it(P), 40, 12) === null);
  st.sessions.push(mk("a", "ua", 2, [[P, 40, 12], [P, 40, 10]]));
  ok("PR: heavier → weight PR", L.prFor(st, it(P), 42.5, 6).type === "weight");
  ok("PR: same kg more reps → best set", L.prFor(st, it(P), 40, 13).type === "set");
  ok("PR: weaker set → none", L.prFor(st, it(P), 40, 11) === null);
  st.active = { id: "x", sets: [{ i: "1", e: P, k: 45, r: 8, f: 2 }] };
  ok("PR: compares against sets earlier in this workout", L.prFor(st, it(P), 42.5, 8) === null && L.prFor(st, it(P), 47.5, 5).type === "weight");
  st.active = null; st.sessions[0].sets.push({ i: "w", e: P, k: 100, r: 10, f: 2, wu: 1 });
  ok("PR: warm-up sets never count", L.prFor(st, it(P), 42.5, 6).type === "weight"); }
{ const st = st0(); st.sessions.push(mk("a", "ua", 5, [[P, 40, 12]])); const s2 = mk("b", "ua", 1, [[P, 42.5, 10], [P, 40, 13], [P, 40, 5]]); st.sessions.push(s2);
  ok("session PRs counted", L.sessionPRs(st, s2, () => "w").length === 2); }

// ---- ops: idempotent under 409 replay
{ const st = st0(); const ops = [
    { t: "start", p: { id: "S", w: "ua" }, ts: NOW }, { t: "set", p: { sid: "S", i: "1", e: P, k: 40, r: 12, f: 2 }, ts: NOW + 1 },
    { t: "feel", p: { sid: "S", i: "1", f: 1 }, ts: NOW + 2 }, { t: "set", p: { sid: "S", i: "w", e: P, k: 20, r: 10, wu: 1 }, ts: NOW + 3 },
    { t: "swap", p: { sid: "S", from: "Wide-Grip_Lat_Pulldown", item: { e: "Close-Grip_Front_Lat_Pulldown", n: "Close-grip pulldown", kind: "w", step: 2.5 } }, ts: NOW + 4 },
    { t: "finish", p: { sid: "S" }, ts: NOW + 5 }];
  ops.forEach(o => L.applyOp(st, o)); const once = JSON.stringify(st); ops.forEach(o => L.applyOp(st, o));
  ok("ops: replaying the same batch twice changes nothing", JSON.stringify(st) === once);
  ok("ops: finish stores session, rotates to Lower A", st.sessions.length === 1 && st.next === 1 && st.active === null);
  ok("ops: feel updated on the set", st.sessions[0].sets[0].f === 1);
  ok("ops: warm-up flagged", st.sessions[0].sets[1].wu === 1); }
{ const st = st0(); L.applyOp(st, { t: "start", p: { id: "S", w: "la" }, ts: 1 }); L.applyOp(st, { t: "set", p: { sid: "S", i: "w", e: "Leg_Press", k: 40, r: 10, wu: 1 }, ts: 2 }); L.applyOp(st, { t: "finish", p: { sid: "S" }, ts: 3 });
  ok("ops: a workout with only warm-ups isn't saved", st.sessions.length === 0 && st.active === null); }
{ const st = st0(); L.applyOp(st, { t: "start", p: { id: "S", w: "ua" }, ts: 1 }); L.applyOp(st, { t: "swap", p: { sid: "S", from: P, item: { e: "Machine_Bench_Press", n: "Machine bench", kind: "w", step: 2.5, s: 9, lo: 1, hi: 2 } }, ts: 2 });
  const x = st.active.x[0]; ok("ops: swap keeps the program's sets/reps/rest", x.e === "Machine_Bench_Press" && x.s === 3 && x.lo === 10 && x.hi === 12);
  ok("ops: swap is this workout only", st.program[0].x[0].e === P);
  L.applyOp(st, { t: "set", p: { sid: "S", i: "a", e: "Machine_Bench_Press", k: 30, r: 10 }, ts: 3 });
  L.applyOp(st, { t: "rmex", p: { sid: "S", e: "Machine_Bench_Press" }, ts: 4 }); ok("ops: can't remove an exercise that has sets", st.active.x[0].e === "Machine_Bench_Press");
  L.applyOp(st, { t: "set", p: { sid: "OTHER", i: "b", e: P, k: 30, r: 10 }, ts: 5 }); ok("ops: set for a different workout id ignored", st.active.sets.length === 1); }
{ const st = st0(); const p = JSON.parse(JSON.stringify(st.program)); p.splice(0, 1); st.next = 2; L.applyOp(st, { t: "prog", p: { program: p }, ts: 1 });
  ok("ops: editing the program keeps 'next' pointing at the same workout", st.program[st.next].id === "ub"); }
{ const st = st0(); st.next = 3; const p = JSON.parse(JSON.stringify(st.program)).slice(0, 2); L.applyOp(st, { t: "prog", p: { program: p }, ts: 1 });
  ok("ops: deleting the next workout falls back safely", st.next === 0); }

// ---- migration from v1
const v1 = { items: [], log: [], days: [0, 1, 3, 5], next: 2, sessions: [{ id: "s1", w: "ua", start: NOW - 2 * D, end: NOW - 2 * D + 3e6, sets: [{ i: "a", e: "chest_press", k: 40, r: 12, t: 1 }, { i: "b", e: "walk", k: 0, r: 15, t: 2 }] }], active: { id: "x", w: "la", start: NOW, sets: [{ i: "c", e: "leg_press", k: 80, r: 10, t: 3 }] } };
{ const m = L.migrate(v1); ok("migrate: keeps days + rotation", JSON.stringify(m.days) === "[0,1,3,5]" && m.next === 2);
  ok("migrate: sessions keep every set, renamed to library ids", m.sessions[0].sets[0].e === P && m.sessions[0].sets[1].e === "Walking_Treadmill" && m.sessions[0].wn === "Upper A");
  ok("migrate: in-progress workout survives", m.active && m.active.x.length === 6 && m.active.sets[0].e === "Leg_Press");
  ok("migrate: coach reads v1 history", L.coach(m, it(P, 1)).k === 42.5);
  ok("migrate: v2 state passes through unchanged", JSON.stringify(L.migrate(m)) === JSON.stringify(m)); }
ok("migrate: null → fresh seed", L.migrate(null).program.length === 4);
{ const m = L.migrate({ ver: 2, program: [], next: 9 }); ok("migrate: repairs empty program and bad next", m.program.length === 4 && m.next >= 0 && m.next < 4 && Array.isArray(m.body)); }

// ---- schedule (fixed clock: Tue 13 Oct 2026)
{ const st = st0(); const w = L.weekPlan(st, NOW);
  ok("week: Sun→Sat, today Tue", w.length === 7 && w[0].dow === 0 && w[2].today);
  ok("week: Sun missed, Tue/Wed/Sat planned in rotation order", w[0].miss && w[2].plan.id === "ua" && w[3].plan.id === "la" && w[6].plan.id === "ub" && !w[4].plan); }
{ const st = st0(); st.sessions.push(mk("t", "ua", 0, [[P, 40, 12]])); st.sessions[0].wn = "Upper A"; st.next = 1; const w = L.weekPlan(st, NOW);
  ok("week: done today shows done, rotation continues tomorrow", w[2].done && !w[2].plan && w[3].plan.id === "la"); }
{ const st = st0(); st.days = []; ok("week: no gym days → nothing planned, no crash", L.weekPlan(st, NOW).every(d => !d.plan)); }

// ---- body
const body = (pts, goal) => { const st = st0(); pts.forEach(([d, kg], i) => st.body.push({ id: "b" + i, t: NOW - d * D, kg })); if (goal) st.goal = { kg: goal }; return st; };
{ const p = L.projection(body([[28, 110], [21, 109.2], [14, 108.6], [7, 107.9], [0, 107.1]], 95), NOW);
  ok("body: ~0.75 kg/week loss detected", p.perWeek < -0.6 && p.perWeek > -0.9, p);
  ok("body: goal date projected (~16 weeks)", p.state === "ontrack" && p.days > 100 && p.days < 130, p); }
ok("body: no goal → asks for one", L.projection(body([[7, 100], [0, 99]]), NOW).state === "nogoal");
ok("body: one weigh-in → needs more data", L.projection(body([[0, 100]], 90), NOW).state === "needdata");
ok("body: gaining while goal is lower → honest 'away'", L.projection(body([[14, 100], [7, 101], [0, 102]], 90), NOW).state === "away");
ok("body: goal reached", L.projection(body([[7, 91], [0, 90.1]], 90), NOW).state === "reached");
ok("body: empty", L.projection(st0(), NOW).state === "empty");
ok("body: weigh-ins older than 6 weeks ignored for pace", L.projection(body([[100, 130], [99, 129], [7, 100], [0, 99.5]], 90), NOW).perWeek > -1);

// ---- numbers
ok("round: 41.3 → 42.5 on 2.5 steps? no: nearest is 42.5", L.roundTo(41.3, 2.5) === 42.5 && L.roundTo(41.2, 2.5) === 40);
ok("format: 42.50 → '42.5', 40 → '40'", L.kgs(42.5) === "42.5" && L.kgs(40) === "40");

console.log(`\nLOGIC lift: PASS ${pass}  FAIL ${fail}`); process.exit(fail ? 1 : 0);
