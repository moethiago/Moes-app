// Scenario grid for Maham's Day view. Pure logic pulled from the real maham/index.html.
// No network, no AI, no cost.
import fs from 'node:fs';
const src = fs.readFileSync('maham/index.html', 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b); if (i < 0 || j < 0) throw new Error('anchor missing: ' + a.slice(0, 40)); return src.slice(i, j); };
const code = 'var DAY=86400000;\n'
  + cut('var LAT=24.7136', '/* ================= intelligence ================= */')
  + '\n' + cut('function apply(st,op){', '\nfunction cacheLocal')
  + '\nreturn {MDAY:MDAY,dayInit:dayInit,dayBlocks:dayBlocks,defTpl:defTpl,apply:apply};';
const { MDAY, dayInit, dayBlocks, defTpl, apply } = new Function(code)();

let pass = 0, fail = 0; const F = [];
const ck = (n, c, x) => { if (c) pass++; else { fail++; F.push(n + (x ? ' — ' + x : '')); } };
const st0 = () => dayInit({ tasks: {}, lanes: { today: [], week: [], later: [] }, log: [] });

// 1. prayer times vs published Umm al-Qura rows for Riyadh
const TRUTH = {
  '2026-06-01': { fajr: '03:34', shuruq: '05:04', dhuhr: '11:51', asr: '15:13', maghrib: '18:38', isha: '20:08' },
  '2026-06-05': { fajr: '03:33', shuruq: '05:04', dhuhr: '11:51', asr: '15:14', maghrib: '18:39', isha: '20:09' },
  '2026-06-08': { fajr: '03:33', shuruq: '05:03', dhuhr: '11:52', asr: '15:14', maghrib: '18:41', isha: '20:11' },
};
for (const [d, t] of Object.entries(TRUTH)) {
  const p = MDAY.prayers(new Date(d + 'T12:00:00+03:00').getTime(), 24.7136, 46.6753, 3);
  for (const k of Object.keys(t)) {
    const got = MDAY.hm(p[k]), a = got.split(':'), b = t[k].split(':');
    const diff = Math.abs((+a[0] * 60 + +a[1]) - (+b[0] * 60 + +b[1]));
    ck(`prayer ${d} ${k}`, diff <= 1, `got ${got} want ${t[k]}`);
  }
}
// 2. prayer times stay sane across the whole year, every day, in order
let bad = 0, isha90 = 0;
for (let i = 0; i < 365; i++) {
  const ts = new Date('2026-01-01T12:00:00+03:00').getTime() + i * 86400000;
  const p = MDAY.prayers(ts, 24.7136, 46.6753, 3);
  const seq = [p.fajr, p.shuruq, p.dhuhr, p.asr, p.maghrib, p.isha];
  if (seq.some(v => v == null || v < 0 || v > 1440 + 90)) bad++;
  for (let k = 1; k < seq.length; k++) if (seq[k] <= seq[k - 1]) bad++;
  if (p.isha - p.maghrib !== 90) isha90++;
}
ck('365 days ordered and in range', bad === 0, bad + ' violations');
ck('365 days isha = maghrib + 90', isha90 === 0, isha90 + ' off');

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
ck('weekday has a starting shape', dayBlocks(st, sun).length > 0);
ck('friday starts empty', dayBlocks(st, fri).length === 0);
apply(st, { t: 'day.set', p: { date: MDAY.dkey(sun), blocks: [{ id: 'z', title: 'Gym', s: 1080, d: 60 }] }, ts: Date.now() });
ck('override wins for that date', dayBlocks(st, sun).length === 1 && dayBlocks(st, sun)[0].title === 'Gym');
ck('override does not leak to next week', dayBlocks(st, sun + 7 * 86400000).length > 1);
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

console.log(`\nPASS ${pass}  FAIL ${fail}`);
if (F.length) { console.log('\nFAILURES:'); F.forEach(x => console.log(' - ' + x)); }
process.exit(fail ? 1 : 0);
