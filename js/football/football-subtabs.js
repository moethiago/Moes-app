// ============================================================
// football-subtabs.js — Today / Upcoming / Tables / News switcher.
// No spoiler lock (football is year-round, multi-league).
// ============================================================

var _ftSub = 'today';
var _ftLoaded = { today: false, upcoming: false, tables: false, news: false };

function switchFootballSub(which) {
  _ftSub = which;
  ['today','upcoming','tables','news'].forEach(function(s){
    var panel = document.getElementById('ftsub-' + s);
    var btn = document.getElementById('ftsubbtn-' + s);
    if (panel) panel.style.display = (s === which) ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', s === which);
  });
  if (which === 'today' && !_ftLoaded.today) { _ftLoaded.today = true; try { loadFootballToday(); } catch(e){} }
  if (which === 'upcoming' && !_ftLoaded.upcoming) { _ftLoaded.upcoming = true; try { loadFootballUpcoming(); } catch(e){} }
  if (which === 'tables' && !_ftLoaded.tables) { _ftLoaded.tables = true; try { loadFootballTables(); } catch(e){} }
  if (which === 'news' && !_ftLoaded.news) { _ftLoaded.news = true; try { loadFootballNews(); } catch(e){} }
  var sw = document.getElementById('scroll-wrap');
  if (sw) sw.scrollTop = 0;
}

function initFootballSubtabs() {
  _ftSub = 'today';
  _ftLoaded = { today: false, upcoming: false, tables: false, news: false };
  switchFootballSub('today');
}
