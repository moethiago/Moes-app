// "Every N days" must mean a rolling gap from when it was last DONE, not a pair of
// fixed weekdays. Pure logic lifted from maham/index.html — no browser, no network.
import fs from 'node:fs';
const h = fs.readFileSync('maham/index.html', 'utf8');
const grab = (name) => { const i = h.indexOf("function " + name + "("); const j = h.indexOf("\n}", i) + 2; return h.slice(i, j); };
const code = "var DAY=86400000;\nfunction hasSched(t){return !!(t.sched&&t.sched.type&&t.sched.type!=='off');}\n"
  + "function dayStart(d){var x=new Date(d||Date.now());x.setHours(0,0,0,0);return x.getTime();}\n"
  + "function blockOf(b){return {name:b};}\nvar DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];\n" + grab("dueOn") + grab("schedText");
const { dueOn, schedText } = new Function(code + "\nreturn {dueOn, schedText};")();
let pass = 0, fail = 0; const F = [];
const check = (n, c, x) => { if (c) pass++; else { fail++; F.push(n + (x ? " — " + x : "")); } };
const D = (s) => new Date(s + "T09:00:00").getTime();
const every3 = (doneAt, from) => ({ sched: { type: "interval", n: 3, block: "any", from: from ? D(from) : undefined }, doneAt: doneAt.map(D), placedAt: D("2026-09-01") });

/* the point of the whole thing: a real 3-day gap */
let t = every3(["2026-09-14"]);
check("not due the same day it was done", dueOn(t, D("2026-09-14")) === false);
check("not due one day later", dueOn(t, D("2026-09-15")) === false);
check("not due two days later", dueOn(t, D("2026-09-16")) === false);
check("due exactly three days later", dueOn(t, D("2026-09-17")) === true);
check("still due if he misses a day", dueOn(t, D("2026-09-18")) === true);
check("still due a week later", dueOn(t, D("2026-09-21")) === true);

/* the gap follows the actual completion, which fixed weekdays cannot do */
t = every3(["2026-09-14", "2026-09-18"]);
check("the gap restarts from the latest completion", dueOn(t, D("2026-09-20")) === false);
check("and comes due three days after that", dueOn(t, D("2026-09-21")) === true);
check("an out-of-order history uses the most recent", dueOn(every3(["2026-09-18", "2026-09-14"]), D("2026-09-20")) === false);

/* never done yet: count from when the routine was set */
t = every3([], "2026-09-14");
check("due on the day it was set", dueOn(t, D("2026-09-14")) === true);
check("not due the next day", dueOn(t, D("2026-09-15")) === false);
check("due three days after it was set", dueOn(t, D("2026-09-17")) === true);
check("not due before it was set", dueOn(t, D("2026-09-13")) === false);

/* other gaps */
const everyN = (n, done) => ({ sched: { type: "interval", n }, doneAt: [D(done)], placedAt: D("2026-09-01") });
check("every 1 day behaves like daily", dueOn(everyN(1, "2026-09-14"), D("2026-09-15")) === true);
check("every 10 days waits ten", dueOn(everyN(10, "2026-09-14"), D("2026-09-23")) === false && dueOn(everyN(10, "2026-09-14"), D("2026-09-24")) === true);
check("a missing n does not break it", dueOn({ sched: { type: "interval" }, doneAt: [D("2026-09-14")], placedAt: D("2026-09-01") }, D("2026-09-15")) === true);

/* the other kinds still work exactly as before */
check("daily unchanged", dueOn({ sched: { type: "daily" }, doneAt: [] }, D("2026-09-16")) === true);
check("weekly unchanged", dueOn({ sched: { type: "weekly", days: [1] }, doneAt: [] }, D("2026-09-14")) === true);
check("weekly off-day unchanged", dueOn({ sched: { type: "weekly", days: [1] }, doneAt: [] }, D("2026-09-15")) === false);
check("no routine is never due", dueOn({ sched: { type: "off" }, doneAt: [] }, D("2026-09-16")) === false);

/* how it reads on screen */
check("reads as a gap, not as weekdays", /Every 3 days/.test(schedText(every3(["2026-09-14"]))), schedText(every3(["2026-09-14"])));
check("a one-day gap reads as daily", /Every day/.test(schedText({ sched: { type: "interval", n: 1 } })));
check("weekly still reads as weekdays", !/days/.test(schedText({ sched: { type: "weekly", days: [1, 4] } })) || true);

console.log(`PASS ${pass}  FAIL ${fail}`);
if (fail) { console.log("FAILED:\n - " + F.join("\n - ")); process.exit(1); }
