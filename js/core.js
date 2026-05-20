// ── CORE.JS ─────────────────────────────────────────────
// Handles: init, clock, tab switching

document.addEventListener('DOMContentLoaded', function() {
  try { window.foodLog = JSON.parse(localStorage.getItem('m_food') || '[]'); } catch(e) { window.foodLog = []; }
  try { window.setLog  = JSON.parse(localStorage.getItem('m_sets') || '[]'); } catch(e) { window.setLog  = []; }

  startClock();
  try { renderFood();         } catch(e) { console.warn('health:food', e); }
  try { renderSets();         } catch(e) { console.warn('health:sets', e); }
  try { startCountdown();     } catch(e) { console.warn('sports:countdown', e); }
  try { renderNewsFeed();     } catch(e) { console.warn('feed:render', e); }
  try { loadFootballScores(); } catch(e) { console.warn('sports:football', e); }
  try { loadF1Data();         } catch(e) { console.warn('sports:f1', e); }
  setTimeout(function() {
    try { loadNewsFeed(); } catch(e) { console.warn('feed:rss', e); }
  }, 500);
});

function startClock() {
  var el = document.getElementById('clock');
  function tick() {
    var d = new Date();
    if (el) el.textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }
  tick();
  setInterval(tick, 10000);
}

function switchTab(tab) {
  ['feed','sports','health'].forEach(function(t) {
    var panel = document.getElementById('panel-' + t);
    var btn   = document.getElementById('nav-' + t);
    if (panel) panel.classList.toggle('active', t === tab);
    if (btn)   btn.classList.toggle('active',   t === tab);
  });
  document.getElementById('scroll-wrap').scrollTop = 0;
}
