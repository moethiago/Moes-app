// ── CORE.JS ─────────────────────────────────────────────
// Handles: init, clock, tab switching, pull to refresh
// Depends on: nothing
// Safe to edit without affecting feed/sports/health

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

  initPullToRefresh();
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

function initPullToRefresh() {
  var scrollWrap = document.getElementById('scroll-wrap');
  if (!scrollWrap) return;

  // Create indicator
  var indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.innerHTML = '<div class="ptr-spinner"></div>';
  document.getElementById('app').appendChild(indicator);

  var startY   = 0;
  var pulling  = false;
  var THRESHOLD = 60;

  scrollWrap.addEventListener('touchstart', function(e) {
    if (scrollWrap.scrollTop === 0) {
      startY  = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  scrollWrap.addEventListener('touchmove', function(e) {
    if (!pulling) return;
    var dist = e.touches[0].clientY - startY;
    if (dist > 10) {
      indicator.classList.add('visible');
    }
  }, { passive: true });

  scrollWrap.addEventListener('touchend', function(e) {
    if (!pulling) return;
    pulling = false;
    var dist = e.changedTouches[0].clientY - startY;
    if (dist > THRESHOLD) {
      location.reload(true);
    } else {
      indicator.classList.remove('visible');
    }
  }, { passive: true });
}
