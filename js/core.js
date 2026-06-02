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
    try { loadF1Data(); } catch(e) { console.warn('f1:data', e); }
    try { if (typeof loadLastRaceResult === 'function') loadLastRaceResult(); } catch(e) {}
    try { if (typeof initSessionSection === 'function') initSessionSection(); } catch(e) { console.warn('f1:session', e); }
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
