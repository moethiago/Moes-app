// ============================================================
// f1-weekend-times.js — local session times + add-to-calendar
// (features 1, 3). Renders into #f1-times.
// ============================================================

function loadF1Times() {
  var root = document.getElementById('f1-times');
  if (!root) return;
  if (typeof F1_CALENDAR === 'undefined') { root.innerHTML = ''; return; }

  // next race weekend
  var now = Date.now();
  var next = null;
  for (var i = 0; i < F1_CALENDAR.length; i++) {
    var last = F1_CALENDAR[i].sessions[F1_CALENDAR[i].sessions.length - 1];
    if (Date.parse(last.time) > now) { next = F1_CALENDAR[i]; break; }
  }
  if (!next) { root.innerHTML = ''; return; }

  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  var html = '<div class="f1a-card"><div class="f1a-h">\u23F1\uFE0F ' + next.race.replace(' Grand Prix',' GP') + ' \u00b7 Your Times</div>'
    + '<div class="f1a-sub">All times shown in your timezone (' + tz + ')</div>';

  next.sessions.forEach(function(s) {
    var d = new Date(s.time);
    var day = d.toLocaleDateString([], { weekday:'short' });
    var time = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    var hr = d.getHours();
    var anti = (hr < 7 || hr >= 23); // antisocial hour flag
    html += '<div class="f1-time-row">'
      + '<span class="f1-time-name">' + s.name + (anti ? ' <span class="f1-time-anti">\u{1F634} odd hour</span>' : '') + '</span>'
      + '<span class="f1-time-when">' + day + ' ' + time + '</span>'
      + '<button class="f1-time-cal" onclick="addF1ToCal(\'' + encodeURIComponent(next.race + ' - ' + s.name) + '\',\'' + s.time + '\')">+ Cal</button>'
      + '</div>';
  });
  html += '</div>';
  root.innerHTML = html;
}

// Generate an .ics file and trigger download (adds to phone calendar)
function addF1ToCal(titleEnc, isoTime) {
  var title = decodeURIComponent(titleEnc);
  var start = new Date(isoTime);
  var end = new Date(start.getTime() + 90 * 60000);
  function fmt(d) {
    return d.getUTCFullYear()
      + String(d.getUTCMonth()+1).padStart(2,'0')
      + String(d.getUTCDate()).padStart(2,'0') + 'T'
      + String(d.getUTCHours()).padStart(2,'0')
      + String(d.getUTCMinutes()).padStart(2,'0') + '00Z';
  }
  var ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MoesApp//F1//EN\nBEGIN:VEVENT\n'
    + 'UID:' + Date.now() + '@moesapp\n'
    + 'DTSTAMP:' + fmt(new Date()) + '\n'
    + 'DTSTART:' + fmt(start) + '\n'
    + 'DTEND:' + fmt(end) + '\n'
    + 'SUMMARY:' + title + '\n'
    + 'BEGIN:VALARM\nTRIGGER:-PT30M\nACTION:DISPLAY\nDESCRIPTION:' + title + '\nEND:VALARM\n'
    + 'END:VEVENT\nEND:VCALENDAR';
  var blob = new Blob([ics], { type: 'text/calendar' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = title.replace(/[^a-z0-9]/gi,'_') + '.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}
