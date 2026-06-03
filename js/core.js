document.addEventListener('DOMContentLoaded', function() {
  startClock();
  try { startCountdown(); } catch(e) { console.warn('sports:countdown', e); }
  try { renderNewsFeed(); } catch(e) { console.warn('feed:render', e); }

  setTimeout(function() {
    try { loadNewsFeed(); } catch(e) { console.warn('feed:rss', e); }
  }, 300);
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

// Track which sport tabs have already loaded (lazy-load once)
var loaded = { f1:false, football:false, worldcup:false };

function switchTab(tab) {
  if (tab === 'health') return; // Health tab hidden for now

  document.querySelectorAll('.tab-panel').forEach(function(panel) {
    panel.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  var activePanel = document.getElementById('panel-' + tab);
  var activeBtn   = document.getElementById('nav-' + tab);
  if (activePanel) activePanel.classList.add('active');
  if (activeBtn)   activeBtn.classList.add('active');
  var sw = document.getElementById('scroll-wrap');
  if (sw) sw.scrollTop = 0;

  if (tab === 'f1' && !loaded.f1) {
    loaded.f1 = true;
    // Pre-seed driver->team colors so every section is consistent from first paint
    if (typeof seedDriverColors === 'function') {
      seedDriverColors().then(function(){ runF1Loaders(); });
    } else {
      runF1Loaders();
    }
  }

  if (tab === 'football' && !loaded.football) {
    loaded.football = true;
    try { buildFootballSection(); } catch(e) { console.warn('football:scores', e); }
  }

  if (tab === 'worldcup' && !loaded.worldcup) {
    loaded.worldcup = true;
    try { if (typeof loadWorldCup === 'function') loadWorldCup(); } catch(e) { console.warn('worldcup', e); }
  }
}

function runF1Loaders() {
    // Subtab system loads spoiler-free content immediately; Results/Standings
    // load only when revealed. See f1-subtabs.js.
    try { if (typeof initF1Subtabs === 'function') initF1Subtabs(); } catch(e) { console.warn('f1:subtabs', e); }
}
