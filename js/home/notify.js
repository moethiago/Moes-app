// ============================================================
// notify.js — lightweight alerts for things you'd hate to miss.
// Uses the browser Notification API (works when the app is open or
// recently backgrounded). Checks on load + every few minutes:
//   - a followed F1 session starting within 30 min
//   - a followed club's match starting within 30 min
// Remembers what it already alerted (per day) so it won't nag.
// ============================================================

var NOTIFY_SEEN_KEY = 'moe_notify_seen_v1';

function notifySeen() {
  try { return JSON.parse(localStorage.getItem(NOTIFY_SEEN_KEY)) || {}; } catch(e) { return {}; }
}
function notifyMark(id) {
  var s = notifySeen(); s[id] = Date.now();
  // prune anything older than 2 days
  Object.keys(s).forEach(function(k){ if (Date.now() - s[k] > 172800000) delete s[k]; });
  try { localStorage.setItem(NOTIFY_SEEN_KEY, JSON.stringify(s)); } catch(e) {}
}

// Ask permission once, triggered by a user tap (required by browsers).
function notifyEnable() {
  if (!('Notification' in window)) { alert('This browser does not support notifications.'); return; }
  Notification.requestPermission().then(function(perm){
    if (perm === 'granted') {
      fireNotification('Alerts on', 'You\u2019ll get a heads-up before your teams play.', 'enabled-' + new Date().toDateString());
      notifyCheck();
    }
  });
}

function notifyPermission() {
  return ('Notification' in window) ? Notification.permission : 'unsupported';
}

function fireNotification(title, body, id) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (id) { var s = notifySeen(); if (s[id]) return; notifyMark(id); }
  try { new Notification(title, { body: body, icon: 'assets/icon.png' }); } catch(e) {}
}

// Main check: imminent followed events.
function notifyCheck() {
  if (notifyPermission() !== 'granted') return;
  var now = Date.now();
  var soon = 30 * 60 * 1000; // 30 min window

  // F1 session
  try {
    if (typeof homeNextF1 === 'function') {
      var f1 = homeNextF1();
      if (f1 && f1.ts - now > 0 && f1.ts - now <= soon) {
        fireNotification('F1 starting soon', f1.label + ' starts in ' + Math.max(1, Math.round((f1.ts-now)/60000)) + ' min', 'f1-' + f1.ts);
      }
    }
  } catch(e) {}

  // Followed club matches (uses football fetch)
  try {
    if (typeof FOOTBALL_LEAGUES !== 'undefined' && typeof fetchLeague === 'function') {
      var p = (typeof loadPrefs === 'function') ? loadPrefs() : {};
      var clubs = p.footballClubs || [];
      if (clubs.length) {
        Promise.all(FOOTBALL_LEAGUES.map(function(l){ return fetchLeague(l.key); })).then(function(results){
          var all = [];
          results.forEach(function(r){ all = all.concat(r.fixtures || [], r.upcoming || []); });
          all.forEach(function(m){
            var hit = clubs.find(function(c){ return (m.home && m.home.indexOf(c)!==-1) || (m.away && m.away.indexOf(c)!==-1); });
            if (!hit || !m.time) return;
            var ts = Date.parse(m.time);
            if (ts - now > 0 && ts - now <= soon) {
              fireNotification(hit + ' kicking off soon', m.home + ' vs ' + m.away, 'fb-' + (m.id || ts));
            }
          });
        });
      }
    }
  } catch(e) {}
}

// Wire periodic checks once the app is up.
function notifyInit() {
  notifyCheck();
  setInterval(notifyCheck, 5 * 60 * 1000); // every 5 min while open
}
