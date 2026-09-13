// Scenario grid for Maham's Day view. Pure logic pulled from the real maham/index.html.
// No network, no AI, no cost.
import fs from 'node:fs';
const src = fs.readFileSync('maham/index.html', 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b); if (i < 0 || j < 0) throw new Error('anchor missing: ' + a.slice(0, 40)); return src.slice(i, j); };
const code = 'var DAY=86400000;var S=null;var DAYS1=["S","M","T","W","T","F","S"];var DAYSF=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];\n'
  + cut('var MDAY=(function(){', '/* ================= intelligence ================= */')
  + '\n' + cut('function apply(st,op){', '\nfunction cacheLocal')
  + '\n' + cut('/* ---- what it notices ---- */', 'function durOpts(')
  + '\nfunction tintOf(t){return (t&&t.cat)||"other";}'
  + '\nfunction dayStart(ts){var d=new Date(ts||Date.now());d.setHours(0,0,0,0);return d.getTime();}'
  + '\nfunction esc(x){return String(x);}function uid(){return "u";}function toast(){}function op(){}'
  + '\nreturn {MDAY:MDAY,dayInit:dayInit,dayBlocks:dayBlocks,defTpl:defTpl,apply:apply,doneBlocks:doneBlocks,layout:layout,dayAll:dayAll,taskDur:taskDur,statusLine:statusLine,dayWord:dayWord,MONTHS:MONTHS,insight:insight,pushPattern:pushPattern,setS:function(x){S=x;},setSel:function(n){daySel=n;}};';
const { MDAY, dayInit, dayBlocks, defTpl, apply, doneBlocks, layout, dayAll, taskDur, statusLine, dayWord, MONTHS, insight, pushPattern, setS, setSel } = new Function(code)();

let pass = 0, fail = 0; const F = [];
const ck = (n, c, x) => { if (c) pass++; else { fail++; F.push(n + (x ? ' — ' + x : '')); } };
const st0 = () => dayInit({ tasks: {}, lanes: { today: [], week: [], later: [] }, log: [] });

// 1. no prayer anything, anywhere in the app
const page = fs.readFileSync('maham/index.html', 'utf8');
// the only surviving mention is the capture parser, which listens for "after maghrib" if he says it — it never displays anything
const dayView = page.slice(page.indexOf('/* ---- day ---- */'), page.indexOf('function durOpts('));
ck('no prayer names anywhere in the day view', !/fajr|dhuhr|asr|maghrib|isha|shuruq/i.test(dayView));
ck('prayers only survive in the capture parser', (page.match(/maghrib/gi) || []).length === 2);
ck('no prayer maths left behind', !/prayers\(|asrTime|sunPos|LAT=/.test(page));
ck('no prayer styles left behind', !/\.pray/.test(page));

// 3. gaps / free / fit
const bl = [{ id: 'a', title: 'Work', s: 480, d: 540 }, { id: 'b', title: 'Fam', s: 1170, d: 90 }];
ck('gaps found', JSON.stringify(MDAY.gaps(bl, 360, 1380)) === '[{"s":360,"d":120},{"s":1020,"d":150},{"s":1260,"d":120}]');
ck('gaps ignore slivers', MDAY.gaps([{ id: 'x', s: 370, d: 10 }], 360, 1380, 15).length === 1);
ck('free after now', MDAY.freeAfter(bl, 360, 1380, 1040) === 250);
ck('free after bedtime is 0', MDAY.freeAfter(bl, 360, 1380, 1380) === 0);
ck('firstFit respects from', MDAY.firstFit(bl, 360, 1380, 45, 1040) === 1040);
ck('firstFit rejects too big', MDAY.firstFit(bl, 360, 1380, 600, 360) === null);
ck('firstFit early gap when free', MDAY.firstFit(bl, 360, 1380, 60, 360) === 360);
// 4. fill never overlaps, never runs past bedtime
const items = [{ id: 't|1', title: 'CV', d: 45, task: '1' }, { id: 't|2', title: 'Call', d: 15, task: '2' }, { id: 't|3', title: 'Huge', d: 900, task: '3' }];
const f = MDAY.fill(bl, 360, 1380, items, 1040);
ck('fill placed what fits', f.placed.length === 2, JSON.stringify(f.placed.map(b => b.title)));
ck('fill skipped the oversized one', !f.placed.some(b => b.title === 'Huge'));
const ov = (l) => { for (let i = 1; i < l.length; i++) if (l[i].s < l[i - 1].s + l[i - 1].d) return true; return false; };
ck('fill produced no overlap', !ov(f.blocks));
ck('fill stayed inside the day', f.blocks.every(b => b.s >= 360 && b.s + b.d <= 1380));
// 5. place() pushes the rest down instead of double-booking
const moved = MDAY.place(bl, { id: 'a', title: 'Work', s: 1100, d: 540 });
ck('place pushes later blocks', !ov(moved), JSON.stringify(moved));
const moved2 = MDAY.place(bl, { id: 'c', title: 'New', s: 480, d: 30 });
ck('place keeps every block', moved2.length === 3);
// 6. template / override behaviour across weekdays
const st = st0();
const sun = new Date('2026-09-13T09:00:00+03:00').getTime(); // Sunday
const fri = new Date('2026-09-18T09:00:00+03:00').getTime(); // Friday
ck('no placeholder routine on a weekday', dayBlocks(st, sun).length === 0);
ck('friday starts empty', dayBlocks(st, fri).length === 0);
apply(st, { t: 'day.set', p: { date: MDAY.dkey(sun), blocks: [{ id: 'z', title: 'Gym', s: 1080, d: 60 }] }, ts: Date.now() });
ck('override wins for that date', dayBlocks(st, sun).length === 1 && dayBlocks(st, sun)[0].title === 'Gym');
ck('override does not leak to next week', dayBlocks(st, sun + 7 * 86400000).length === 0);
apply(st, { t: 'day.tpl', p: { w: '5', blocks: [{ id: 'q', title: 'Farm', s: 420, d: 180 }] }, ts: Date.now() });
ck('template applies to every friday', dayBlocks(st, fri)[0].title === 'Farm' && dayBlocks(st, fri + 7 * 86400000)[0].title === 'Farm');
apply(st, { t: 'day.hours', p: { wake: 300, sleep: 1400 }, ts: Date.now() });
ck('day hours saved', st.day.wake === 300 && st.day.sleep === 1400);
// 7. replaying the same op twice is safe (offline queue / 409 retry)
const before = JSON.stringify(st.day.ov);
apply(st, { t: 'day.set', p: { date: MDAY.dkey(sun), blocks: [{ id: 'z', title: 'Gym', s: 1080, d: 60 }] }, ts: Date.now() });
apply(st, { t: 'day.set', p: { date: MDAY.dkey(sun), blocks: [{ id: 'z', title: 'Gym', s: 1080, d: 60 }] }, ts: Date.now() });
ck('day.set is idempotent on replay', JSON.stringify(st.day.ov) === before);
// 8. old overrides get pruned, existing state is never clobbered
const st2 = { tasks: { a: { id: 'a' } }, lanes: { today: ['a'], week: [], later: [] }, log: [], day: { tpl: defTpl(), ov: { '2020-01-01': [{ id: 'old' }], [MDAY.dkey(Date.now())]: [{ id: 'new' }] }, wake: 360, sleep: 1380 } };
dayInit(st2);
ck('stale overrides pruned', !st2.day.ov['2020-01-01']);
ck("today's override kept", !!st2.day.ov[MDAY.dkey(Date.now())]);
ck('tasks untouched by dayInit', !!st2.tasks.a && st2.lanes.today[0] === 'a');
// 9. dayInit on a state that has never seen the Day view
const st3 = dayInit({ tasks: {}, lanes: { today: [], week: [], later: [] }, log: [], catalogV: 4 });
ck('day defaults created', st3.day.wake === 360 && st3.day.sleep === 1380 && Object.keys(st3.day.tpl).length === 7);
// 10. formatting
ck('hm pads', MDAY.hm(65) === '01:05' && MDAY.hm(0) === '00:00');
ck('dur reads naturally', MDAY.dur(90) === '1h 30m' && MDAY.dur(60) === '1h' && MDAY.dur(15) === '15m');

// 11. the block you move keeps the time you gave it; everything else yields
const base = [{ id: 'cm', title: 'Drive', s: 440, d: 40 }, { id: 'wk', title: 'Work', s: 480, d: 540 }, { id: 'fm', title: 'Fam', s: 1170, d: 90 }];
const p1 = MDAY.place(base.map(b => ({ ...b })), { id: 'cm', title: 'Drive', s: 585, d: 40 });
const drive = p1.find(b => b.id === 'cm');
ck('moved block keeps its exact time', drive.s === 585, 'landed at ' + MDAY.hm(drive.s));
ck('no overlap after the move', !ov(p1), JSON.stringify(p1.map(b => b.title + '@' + MDAY.hm(b.s))));
ck('the colliding block is what moved', p1.find(b => b.id === 'wk').s === 625);
ck('moved list reported to the user', (p1.moved || []).length === 1 && p1.moved[0].id === 'wk');
const p2 = MDAY.place(base.map(b => ({ ...b })), { id: 'nw', title: 'Gym', s: 1080, d: 60 });
ck('new block in a free gap moves nothing', (p2.moved || []).length === 0 && p2.length === 4);
const p3 = MDAY.place(base.map(b => ({ ...b })), { id: 'cm', title: 'Drive', s: 480, d: 40 });
ck('cascade keeps every block and order', p3.length === 3 && !ov(p3), JSON.stringify(p3.map(b => b.title + '@' + MDAY.hm(b.s))));
ck('cascade never drops the last block', p3.some(b => b.id === 'fm'));

console.log('');

// 12. the fixtures file: F1 sessions + Bayern games, converted to Riyadh time
const FX = JSON.parse(fs.readFileSync('maham/fixtures.json', 'utf8'));
ck('fixtures file has items', Array.isArray(FX.items) && FX.items.length > 40, FX.items.length + ' items');
ck('fixtures are stamped Riyadh', FX.tz === 'Asia/Riyadh');
const shape = FX.items.filter(x => !/^\d{4}-\d{2}-\d{2}$/.test(x.d) || typeof x.s !== 'number' || x.s < 0 || x.s > 1439 || !x.dur || x.dur < 30 || x.dur > 180 || !x.t || !x.k);
ck('every fixture has a valid date, time and length', shape.length === 0, JSON.stringify(shape.slice(0, 2)));
ck('no fixture is in the past', FX.items.every(x => x.d >= '2026-09-13'), FX.items.filter(x => x.d < '2026-09-13').length + ' stale');
const sorted = FX.items.slice().sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.s - b.s);
ck('fixtures are in order', JSON.stringify(sorted) === JSON.stringify(FX.items));
const dup = new Set(); let dups = 0;
FX.items.forEach(x => { const k = x.d + x.s + x.t; if (dup.has(k)) dups++; dup.add(k); });
ck('no duplicate fixtures', dups === 0, dups);
// conversions checked against the source UTC times
const at = (d, t) => FX.items.some(x => x.d === d && MDAY.hm(x.s) === MDAY.hm(t));
ck('Baku race 11:00Z lands 14:00 Riyadh', at('2026-09-26', 840));
ck('Sepang race 07:00Z lands 10:00 Riyadh', at('2026-10-04', 600));
ck('Singapore sprint 09:00Z lands 12:00 Riyadh', at('2026-10-10', 720));
ck('Vegas race 04:00Z lands 07:00 Riyadh', at('2026-11-22', 420));
ck('Bayern v Union 18:30Z lands 21:30 Riyadh', at('2026-09-18', 1290));
// every remaining GP has a race and a qualifying; the sprint weekend has all four
const f1 = FX.items.filter(x => x.k === 'f1');
const gps = [...new Set(f1.map(x => x.t.replace(/ — .*/, '')))];
ck('10 grands prix remain', gps.length === 10, gps.length + ': ' + gps.join(', '));
ck('every GP has a race', gps.every(g => f1.some(x => x.t === g + ' — race')));
// the Spanish GP weekend is already underway — its qualifying was yesterday, so only future weekends carry one
const future = gps.filter(g => { const r = f1.find(x => x.t === g + ' — race'); return r && r.d > '2026-09-13'; });
ck('every GP still to come has a qualifying', future.every(g => f1.some(x => x.t === g + ' — qualifying')), future.filter(g => !f1.some(x => x.t === g + ' — qualifying')).join(','));
ck('only the in-progress weekend lacks one', gps.length - future.length === 1);
const sprintGps = gps.filter(g => f1.some(x => x.t === g + ' — sprint'));
ck('the one sprint weekend left is Singapore', sprintGps.length === 1 && /Singapore/.test(sprintGps[0]), sprintGps.join(','));
ck('the sprint weekend has a sprint qualifying too', f1.some(x => x.t === sprintGps[0] + ' — sprint qualifying'));
ck('sprint sessions come before the race', f1.filter(x => /Singapore/.test(x.t)).map(x => x.t.split('— ')[1]).join('|') === 'sprint qualifying|sprint|qualifying|race');
// Bayern
const by = FX.items.filter(x => x.k === 'bayern');
ck('a full Bayern league season is loaded', by.length >= 30, by.length + ' games');
ck('every Bayern game names an opponent', by.every(x => /^Bayern (v|away to) \S/.test(x.t)), by.filter(x => !/^Bayern (v|away to) \S/.test(x.t)).map(x => x.t).join(','));
ck('no Bayern game is 2 hours off a half hour', by.every(x => x.s % 15 === 0));
// 13. auto-fill never schedules over a fixture
const race = { id: 'fx|r', title: 'F1 race', s: 960, d: 120, fx: 'f1' };
const own = [{ id: 'wk', title: 'Work', s: 480, d: 300 }];
const r2 = MDAY.fill(own.concat([race]), 360, 1380, [{ id: 't|a', title: 'Errand', d: 90, task: 'a' }], 780);
ck('a task placed around the race', r2.placed.length === 1);
ck('the task does not overlap the race', !r2.placed.some(b => b.s < race.s + race.d && race.s < b.s + b.d), JSON.stringify(r2.placed));
ck('fixtures are never written back to state', r2.blocks.filter(b => !b.fx).every(b => b.id !== 'fx|r'));
ck('free time counts a fixture as busy', MDAY.freeAfter(own.concat([race]), 360, 1380, 780) < MDAY.freeAfter(own, 360, 1380, 780));

console.log('');

// 14. nothing is invented: the calendar starts empty
const t0 = defTpl();
ck('every weekday template starts empty', Object.keys(t0).length === 7 && Object.values(t0).every(v => v.length === 0));
const dirty = { tasks: {}, lanes: { today: [], week: [], later: [] }, log: [], day: {
  tpl: { '0': [{ id: '0|w:wk', title: 'Work', s: 480, d: 540 }, { id: 'mine', title: 'Gym', s: 1080, d: 60 }], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] },
  ov: { [MDAY.dkey(Date.now() + 86400000)]: [{ id: '1|w:cm', title: 'Drive to office', s: 440, d: 40 }, { id: 'k', title: 'Dentist', s: 600, d: 60 }] }, wake: 360, sleep: 1380 } };
dayInit(dirty);
ck('old placeholders are swept out of the template', dirty.day.tpl['0'].length === 1 && dirty.day.tpl['0'][0].id === 'mine');
ck('old placeholders are swept out of saved days', dirty.day.ov[MDAY.dkey(Date.now() + 86400000)].length === 1);
ck('his own blocks survive the sweep', dirty.day.ov[MDAY.dkey(Date.now() + 86400000)][0].title === 'Dentist');
const oldKey = MDAY.dkey(Date.now() - 30 * 86400000);
const keeper = { tasks: {}, lanes: { today: [], week: [], later: [] }, log: [], day: { tpl: defTpl(), ov: { [oldKey]: [{ id: 'x', title: 'Trip', s: 600, d: 120 }] }, wake: 360, sleep: 1380 } };
dayInit(keeper);
ck('a day from last month is still there to look at', !!keeper.day.ov[oldKey]);

// 15. tapping done writes itself onto the day it happened
const now = Date.now();
const yest = now - 86400000;
const withLog = dayInit({
  tasks: { a: { id: 'a', title: 'Call bank', cat: 'money', dur: 45 }, b: { id: 'b', title: 'Farm water', cat: 'farm' } },
  lanes: { today: [], week: [], later: [] },
  log: [{ lid: 'l1', id: 'a', title: 'Call bank', ts: new Date(new Date(yest).setHours(14, 30, 0, 0)).getTime() },
        { lid: 'l2', id: 'b', title: 'Farm water', ts: new Date(new Date(yest).setHours(9, 0, 0, 0)).getTime() },
        { lid: 'l3', id: 'a', title: 'Call bank', ts: new Date(new Date(now).setHours(11, 0, 0, 0)).getTime() }] });
setS(withLog);
const dbY = doneBlocks(yest);
ck("yesterday shows what was finished then", dbY.length === 2, JSON.stringify(dbY.map(b => b.title)));
ck('a done block ends at the moment it was ticked', dbY.find(b => b.title === 'Call bank').at === 870);
ck('a done block is as long as the task takes', dbY.find(b => b.title === 'Call bank').d === 45);
ck('a task with no length gets the default', dbY.find(b => b.title === 'Farm water').d === 30);
ck('a done block starts before it ends', dbY.every(b => b.s === b.at - b.d));
ck('done blocks are flagged as done', dbY.every(b => b.done === true));
ck("today's completion does not appear on yesterday", !dbY.some(b => b.at === 660));
ck('today shows its own completion', doneBlocks(now).length === 1 && doneBlocks(now)[0].at === 660);
ck('a day with nothing finished shows nothing', doneBlocks(now - 9 * 86400000).length === 0);
// history is readable even when the day had no plan saved
setSel(-1);
const past = dayAll(yest);
ck('a past day is built from the log, not the template', past.all.length === 2 && past.own.length === 0);
setSel(0);

// 16. overlapping blocks sit side by side instead of hiding each other
const lay = layout([{ id: '1', s: 600, d: 120 }, { id: '2', s: 660, d: 60 }, { id: '3', s: 900, d: 30 }]);
ck('overlapping blocks get their own columns', lay.find(b => b.id === '1')._c !== lay.find(b => b.id === '2')._c);
ck('overlapping blocks share the width', lay.find(b => b.id === '1')._n === 2);
ck('a block on its own takes the full width', lay.find(b => b.id === '3')._n === 1);
ck('layout keeps every block', lay.length === 3);
const lay2 = layout([{ id: 'a', s: 600, d: 60 }, { id: 'b', s: 660, d: 60 }]);
ck('touching blocks are not treated as overlapping', lay2.every(b => b._n === 1));

console.log('');

// 17. the line at the top of the day, in plain words
const dayOf = h => { const x = new Date(); x.setHours(h, 0, 0, 0); return x.getTime(); };
const stS = dayInit({ tasks: { a: { id: 'a', title: 'Call bank', dur: 30 } }, lanes: { today: [], week: [], later: [] }, log: [] });
setS(stS); setSel(0);
stS.day.ov[MDAY.dkey(Date.now())] = [{ id: 'b1', title: 'Dentist', s: 1380 - 60, d: 60 }];
const line = statusLine(Date.now(), dayAll(Date.now()).all, []);
ck('the status line leads with free time', /free/.test(line), line);
ck('the status line names what is next', /next: Dentist/.test(line), line);
ck('no prayer wording in the status line', !/Maghrib|Fajr|Isha/.test(line), line);
stS.day.ov[MDAY.dkey(Date.now())] = [];
ck('an empty day says so', /nothing on the day/.test(statusLine(Date.now(), [], [])));
setSel(-3);
ck('a past day reports what was logged', /done/.test(statusLine(Date.now() - 3 * 86400000, [], [{ d: 45 }, { d: 30 }])));
ck('a past day with nothing says nothing logged', /nothing logged/.test(statusLine(Date.now() - 3 * 86400000, [], [])));
setSel(0);
// 18. the words for a day
ck('today is called today', dayWord(Date.now()) === 'Today');
ck('tomorrow is named', dayWord(Date.now() + 86400000) === 'Tomorrow');
ck('yesterday is named', dayWord(Date.now() - 86400000) === 'Yesterday');
ck('any other day has no nickname', dayWord(Date.now() + 5 * 86400000) === '');
ck('months are spelled out', MONTHS.length === 12 && MONTHS[8] === 'September');

console.log('');

// 19. every global the day view reads is actually defined in the page
const daySrc = fs.readFileSync('maham/index.html', 'utf8');
['DAYSF', 'MONTHS', 'DAYS1'].forEach(g => ck('the page defines ' + g, new RegExp('var ' + g + '\\s*=').test(daySrc)));
const view = daySrc.slice(daySrc.indexOf('/* ---- day ---- */'), daySrc.indexOf('function durOpts('));
const used = [...new Set((view.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || []))];
const undef = used.filter(g => !new RegExp('(var|function)\\s+' + g + '\\b').test(daySrc) && !/^(DAY|PXM|SVGC|MDAY|GET|SET|POST|JSON)$/.test(g) && !/^[A-Z]\d/.test(g));
ck('no undefined constants in the day view', undef.length === 0, undef.join(','));

// 20. the daily observation — it only speaks when it has evidence
const NOW = new Date('2026-09-13T17:00:00+03:00').getTime();
const mkLog = (specs) => specs.map((x, i) => ({ lid: 'l' + i, id: 't' + i, title: x.t || 'Thing', ts: x.ts }));
const ago = (daysAgo, h, m) => { const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(h, m || 0, 0, 0); return d.getTime(); };
const stateWith = log => dayInit({ tasks: {}, lanes: { today: [], week: [], later: [] }, log });

const empty = insight(stateWith([]), NOW);
ck('with no history it admits it', empty.soft === true && /more days/.test(empty.text), empty.text);
ck('it never invents a number from nothing', /0 completions/.test(empty.why), empty.why);
const thin = insight(stateWith(mkLog([{ ts: ago(0, 10) }, { ts: ago(1, 11) }])), NOW);
ck('two completions is still not enough', thin.soft === true);

const streak = [];
for (let i = 0; i < 5; i++) streak.push({ ts: ago(i, 10) });
const sIns = insight(stateWith(mkLog(streak)), NOW);
ck('it spots a streak', /days in a row/.test(sIns.text), sIns.text);
ck('every observation carries its evidence', !!sIns.why && sIns.why.length > 5, sIns.why);

const early = [];
for (let i = 0; i < 16; i++) early.push({ ts: ago(i % 9, 9 + (i % 6)) });
const eIns = insight(stateWith(mkLog(early)), NOW);
ck('it finds a real pattern in 16 completions', !eIns.soft, eIns.text);
ck('the pattern is one of the ones it knows', /row|after|between|heaviest|usually|already|pushing/.test(eIns.text), eIns.text);

const lateTest = [];
for (let i = 0; i < 14; i++) lateTest.push({ ts: ago(i, 8 + (i % 5)) });
const lIns = insight(stateWith(mkLog(lateTest)), NOW);
ck('the late-finish line only claims what the data shows', !/after/.test(lIns.text) || /never finished anything after 1[0-9]:/.test(lIns.text), lIns.text);

const hourHeavy = [];
for (let i = 0; i < 20; i++) hourHeavy.push({ ts: ago(i % 8, i < 14 ? 10 : 15, 20) });
const hAll = [];
for (let d = 0; d < 400; d++) { const o = insight(stateWith(mkLog(hourHeavy)), NOW + d * 86400000); if (o.kind === 'hour') hAll.push(o.text); }
ck('the busy-hour line names the right hour', hAll.length > 0 && /10:00 and 11:00/.test(hAll[0]), hAll[0]);

ck('the same day always gives the same sentence',
  insight(stateWith(mkLog(early)), NOW).text === insight(stateWith(mkLog(early)), NOW + 3600000).text);
const d1 = insight(stateWith(mkLog(hourHeavy)), NOW).text;
let differs = false;
for (let k = 1; k < 8; k++) if (insight(stateWith(mkLog(hourHeavy)), NOW + k * 86400000).text !== d1) differs = true;
ck('but it rotates across days', differs);

// pushing a block later, week after week
const pushState = dayInit({ tasks: {}, lanes: { today: [], week: [], later: [] }, log: [] });
pushState.day.tpl['0'] = [{ id: 'gym', title: 'Gym', s: 1080, d: 60 }];
[7, 14, 21].forEach(k => { const dd = new Date(NOW - k * 86400000); pushState.day.ov[MDAY.dkey(dd.getTime())] = [{ id: 'gym', title: 'Gym', s: 1080 + 45, d: 60 }]; });
const pp = pushPattern(pushState, NOW);
ck('it notices a block being pushed later every week', !!pp && /pushing Gym later on Sundays/.test(pp.text), pp && pp.text);
ck('it says how much later', pp && /45m later/.test(pp.text), pp && pp.text);
ck('it counts the weeks as evidence', pp && /3 Sundays/.test(pp.why), pp && pp.why);
pushState.day.ov[MDAY.dkey(NOW - 28 * 86400000)] = [{ id: 'gym', title: 'Gym', s: 1080 - 30, d: 60 }];
ck('one week in the other direction kills the claim', pushPattern(pushState, NOW) === null);
const twoOnly = dayInit({ tasks: {}, lanes: { today: [], week: [], later: [] }, log: [] });
twoOnly.day.tpl['0'] = [{ id: 'gym', title: 'Gym', s: 1080, d: 60 }];
[7, 14].forEach(k => { twoOnly.day.ov[MDAY.dkey(NOW - k * 86400000)] = [{ id: 'gym', title: 'Gym', s: 1140, d: 60 }]; });
ck('two weeks is not a pattern', pushPattern(twoOnly, NOW) === null);
ck('future days are not counted as evidence', (() => {
  const f = dayInit({ tasks: {}, lanes: { today: [], week: [], later: [] }, log: [] });
  f.day.tpl['0'] = [{ id: 'gym', title: 'Gym', s: 1080, d: 60 }];
  [7, 14].forEach(k => { f.day.ov[MDAY.dkey(NOW - k * 86400000)] = [{ id: 'gym', title: 'Gym', s: 1140, d: 60 }]; });
  f.day.ov[MDAY.dkey(NOW + 7 * 86400000)] = [{ id: 'gym', title: 'Gym', s: 1140, d: 60 }];
  return pushPattern(f, NOW) === null;
})());

// 21. motion is declared, and it yields to the accessibility setting
const src2 = fs.readFileSync('maham/index.html', 'utf8');
['cbIn', 'obsIn', 'slideInL', 'slideInR', 'pulse'].forEach(a => ck('animation ' + a + ' exists', src2.includes('@keyframes ' + a)));
ck('reduced motion is respected', /prefers-reduced-motion[\s\S]{0,80}animation:none/.test(src2));
ck('the day slide checks the reduced-motion setting too', src2.includes('prefers-reduced-motion: reduce'));
ck('it survives a browser with no matchMedia', src2.includes('window.matchMedia&&window.matchMedia'));

console.log('');

// 22. block geometry — nothing clipped, nothing off the canvas (the 13 Sep screenshot)
const geo = (blocks, wake = 360, sleep = 1380, PX = 0.95) => {
  const H = Math.round((sleep - wake) * PX);
  return layout(blocks).map(b => {
    let top = Math.round((Math.max(b.s, wake) - wake) * PX);
    let hh = Math.max(30, Math.round(Math.min(b.d, Math.max(15, sleep - Math.max(b.s, wake))) * PX) - 4);
    if (top + hh > H) hh = Math.max(30, H - top);
    if (top > H - 30) top = H - 30;
    return { id: b.id, top, hh, bottom: top + hh, cols: b._n, col: b._c, H };
  });
};
const lateBarber = [{ id: 'barber', title: 'Barber', s: 1399, d: 30, done: true }, { id: 'race', title: 'Race', s: 960, d: 120 }];
const g1 = geo(lateBarber);
ck('a block finished after bedtime stays on the canvas', g1.every(b => b.bottom <= b.H), JSON.stringify(g1));
ck('and is still tall enough to read', g1.every(b => b.hh >= 30));
const tiny = geo([{ id: 'p', title: 'Pharmacy', s: 800, d: 30, done: true }]);
ck('a 30-minute item is at least 30px tall', tiny[0].hh >= 30, tiny[0].hh);
ck('short blocks are marked compact so the text is not clipped',
  fs.readFileSync('maham/index.html', 'utf8').includes('(hh<46?" sm":"")') && fs.readFileSync('maham/index.html', 'utf8').includes('.cb.sm'));
const two = geo([{ id: 'a', s: 960, d: 120 }, { id: 'b', s: 1000, d: 60 }]);
ck('two overlapping blocks split the row', two.every(b => b.cols === 2) && two[0].col !== two[1].col);
const pageSrc = fs.readFileSync('maham/index.html', 'utf8');
ck('column widths are computed from the inner width, not the full width',
  pageSrc.includes('width:calc((100% - 68px)/') && pageSrc.includes('left:calc(56px + (100% - 68px)*'));

// 23. what is finished does not eat the day
const busyState = dayInit({ tasks: { a: { id: 'a', title: 'Pharmacy' } }, lanes: { today: [], week: [], later: [] },
  log: [{ lid: 'x', id: 'a', title: 'Pharmacy', ts: (() => { const d = new Date(); d.setHours(13, 44, 0, 0); return d.getTime(); })() }] });
busyState.day.ov[MDAY.dkey(Date.now())] = [{ id: 'w', title: 'Work', s: 480, d: 120 }];
setS(busyState); setSel(0);
const DA = dayAll(Date.now());
ck('finished items still show on the day', DA.all.some(b => b.done));
ck('but they are not counted as busy', !DA.busy.some(b => b.done), JSON.stringify(DA.busy.map(b => b.title)));
ck('free time ignores what is already done',
  MDAY.freeAfter(DA.busy, 360, 1380, 700) > MDAY.freeAfter(DA.all, 360, 1380, 700));
ck('auto-fill measures against busy, not done', pageSrc.includes('MDAY.fill(D.busy,') && pageSrc.includes('MDAY.firstFit(D.busy,'));

// 24. the end of the day reads like a sentence, not "0m free left"
const nightState = dayInit({ tasks: {}, lanes: { today: [], week: [], later: [] }, log: [] });
setS(nightState);
const realNow = Date.now();
ck('after bedtime it says the day is done, not 0m free',
  pageSrc.includes('nowMin()>=S.day.sleep') && pageSrc.includes('that is the day'));

console.log('');

console.log(`\nPASS ${pass}  FAIL ${fail}`);
if (F.length) { console.log('\nFAILURES:'); F.forEach(x => console.log(' - ' + x)); }
process.exit(fail ? 1 : 0);
