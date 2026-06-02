// ============================================================
// f1-status.js — glanceable weekend status strip
// One always-relevant line at the top of the F1 tab.
// Reuses getCurrentSession / getNextRaceAndSession / getCurrentRaceWeekend.
// Renders into #f1-status.
// ============================================================

var _f1StatusTimer = null;

function startF1Status() {
  var el = document.getElementById('f1-status');
  if (!el) return;
  if (_f1StatusTimer) clearInterval(_f1StatusTimer);
  renderF1Status();
  _f1StatusTimer = setInterval(renderF1Status, 1000);
}

function renderF1Status() {
  var el = document.getElementById('f1-status');
  if (!el) return;
  if (typeof F1_CALENDAR === 'undefined') { el.innerHTML = ''; return; }

  // 1) A session is LIVE right now
  var live = (typeof getCurrentSession === 'function') ? getCurrentSession() : null;
  if (live) {
    el.className = 'f1-status live';
    el.innerHTML = '<span class="f1-status-dot"></span>'
      + '<span class="f1-status-main">' + live.session.name + ' LIVE</span>'
      + '<span class="f1-status-sub">' + live.race.race.replace(' Grand Prix',' GP') + '</span>';
    return;
  }

  // 2) Next upcoming session
  var next = (typeof getNextRaceAndSession === 'function') ? getNextRaceAndSession() : null;
  if (!next) {
    el.className = 'f1-status idle';
    el.innerHTML = '<span class="f1-status-main">Season complete</span>';
    return;
  }

  var ms = Date.parse(next.session.time) - Date.now();
  var mins = Math.floor(ms / 60000);
  var hrs  = Math.floor(mins / 60);
  var days = Math.floor(hrs / 24);

  var raceName = next.race.race.replace(' Grand Prix', ' GP');
  var label, cls, when;

  if (mins < 60) {
    cls = 'soon';
    when = mins + 'm';
  } else if (hrs < 24) {
    cls = 'soon';
    var remMin = mins % 60;
    when = hrs + 'h' + (remMin ? ' ' + remMin + 'm' : '');
  } else {
    cls = 'upcoming';
    var remHrs = hrs % 24;
    when = days + 'd' + (remHrs ? ' ' + remHrs + 'h' : '');
  }

  el.className = 'f1-status ' + cls;
  el.innerHTML = '<span class="f1-status-main">' + next.session.name + ' in ' + when + '</span>'
    + '<span class="f1-status-sub">' + raceName + '</span>';
}
