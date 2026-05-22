// ============================================================
// f1-timing.js — session detection, countdown, live banner
// Depends on: f1-data.js
// ============================================================

function getCurrentSession() {
  var now = Date.now();
  for (var r = 0; r < F1_CALENDAR.length; r++) {
    var weekend = F1_CALENDAR[r];
    for (var s = 0; s < weekend.sessions.length; s++) {
      var sess = weekend.sessions[s];
      var start    = Date.parse(sess.time);
      var duration = (SESSION_DURATION[sess.name] || 90) * 60 * 1000;
      if (now >= start && now <= start + duration) return { race: weekend, session: sess };
    }
  }
  return null;
}

function getNextRaceAndSession() {
  var now = Date.now();
  for (var r = 0; r < F1_CALENDAR.length; r++) {
    var weekend = F1_CALENDAR[r];
    for (var s = 0; s < weekend.sessions.length; s++) {
      var sess = weekend.sessions[s];
      if (Date.parse(sess.time) > now) return { race: weekend, session: sess };
    }
  }
  return null;
}

function getCurrentRaceWeekend() {
  var now = Date.now();
  var twoDays = 2 * 24 * 3600 * 1000;
  for (var r = 0; r < F1_CALENDAR.length; r++) {
    var weekend = F1_CALENDAR[r];
    var first   = Date.parse(weekend.sessions[0].time);
    var last    = Date.parse(weekend.sessions[weekend.sessions.length - 1].time);
    var lastEnd = last + (SESSION_DURATION[weekend.sessions[weekend.sessions.length - 1].name] || 90) * 60 * 1000;
    if (now >= first - twoDays && now <= lastEnd) return weekend;
  }
  return null;
}

function startCountdown() {
  var trackEl   = document.getElementById('f1-next-track');
  var sessEl    = document.getElementById('f1-next-session');
  var labelEl   = document.getElementById('f1-session-label');
  var subEl     = document.getElementById('f1-cd-sub');
  var gridEl    = document.getElementById('f1-cd-grid');
  var liveEl    = document.getElementById('f1-live-banner');
  var weekendEl = document.getElementById('f1-weekend-card');
  var lastRenderedWeekend = null;

  function renderPills(raceWeekend) {
    if (!subEl || !raceWeekend) return;
    var now = Date.now();
    subEl.innerHTML = raceWeekend.sessions.map(function(s) {
      var start    = Date.parse(s.time);
      var duration = (SESSION_DURATION[s.name] || 90) * 60 * 1000;
      var isLive   = now >= start && now <= start + duration;
      var isPast   = now > start + duration;
      var cls      = isPast ? ' past' : (isLive ? ' live-now' : '');
      var timeStr  = new Date(start).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Riyadh' });
      return '<span class="session-pill' + cls + '" title="' + timeStr + ' AST">' + (isLive ? '🔴 ' : '') + s.name + '</span>';
    }).join('');
  }

  function tick() {
    try {
      var live       = getCurrentSession();
      var next       = live || getNextRaceAndSession();
      var raceWeekend = getCurrentRaceWeekend();

      if (weekendEl) {
        try {
          if (raceWeekend) {
            if (lastRenderedWeekend !== raceWeekend.race) {
              renderWeekendCard(raceWeekend, weekendEl);
              lastRenderedWeekend = raceWeekend.race;
            }
            weekendEl.style.display = 'block';
          } else {
            weekendEl.style.display = 'none';
          }
        } catch(e) {}
      }

      if (!next) {
        if (trackEl) trackEl.textContent = '2026 Season Complete';
        if (sessEl)  sessEl.textContent  = 'See you in 2027';
        if (labelEl) labelEl.textContent = '';
        if (liveEl)  liveEl.style.display = 'none';
        if (gridEl)  gridEl.style.display = 'none';
        if (subEl)   subEl.innerHTML = '';
        stopLiveTiming();
        return;
      }

      if (trackEl) trackEl.textContent = next.race.flag + ' ' + next.race.race;
      if (sessEl)  sessEl.textContent  = next.race.circuit + ' · ' + next.race.round;

      if (live) {
        if (liveEl) {
          liveEl.style.display = 'flex';
          liveEl.innerHTML = '<span class="pulse"></span><span>🔴 LIVE NOW - ' + live.session.name + '</span>';
        }
        if (gridEl)  gridEl.style.display  = 'none';
        if (labelEl) labelEl.style.display = 'none';
        startLiveTiming();
      } else {
        if (liveEl)  liveEl.style.display  = 'none';
        if (gridEl)  gridEl.style.display  = 'grid';
        if (labelEl) {
          labelEl.style.display = 'block';
          labelEl.textContent   = 'Next: ' + next.session.name;
        }
        stopLiveTiming();
        var diff = Date.parse(next.session.time) - Date.now();
        if (diff <= 0) { tick(); return; }
        var d = document.getElementById('cd-days');
        var h = document.getElementById('cd-hours');
        var m = document.getElementById('cd-mins');
        var s = document.getElementById('cd-secs');
        if (d) d.textContent = String(Math.floor(diff / 86400000)).padStart(2,'0');
        if (h) h.textContent = String(Math.floor(diff % 86400000 / 3600000)).padStart(2,'0');
        if (m) m.textContent = String(Math.floor(diff % 3600000 / 60000)).padStart(2,'0');
        if (s) s.textContent = String(Math.floor(diff % 60000 / 1000)).padStart(2,'0');
      }

      renderPills(next.race);
    } catch(e) { console.error('tick error:', e); }
  }

  tick();
  setInterval(tick, 1000);
}
