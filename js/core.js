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
    try { if (typeof startF1Status === 'function') startF1Status(); } catch(e) { console.warn('f1:status', e); }
    try { loadF1Data(); } catch(e) { console.warn('f1:data', e); }
    try { if (typeof loadLastRaceResult === 'function') loadLastRaceResult(); } catch(e) {}
    try { if (typeof initSessionSection === 'function') initSessionSection(); } catch(e) { console.warn('f1:session', e); }
    try { if (typeof loadNextRaceCard === 'function') loadNextRaceCard(); } catch(e) { console.warn('f1:racecard', e); }
    try { if (typeof loadF1Analytics === 'function') loadF1Analytics(); } catch(e) { console.warn('f1:analytics', e); }
    try { if (typeof loadF1Story === 'function') loadF1Story(); } catch(e) { console.warn('f1:story', e); }
    try { if (typeof loadF1Recap === 'function') loadF1Recap(); } catch(e) { console.warn('f1:recap', e); }
    try { if (typeof loadF1News === 'function') loadF1News(); } catch(e) { console.warn('f1:news', e); }
    try { if (typeof loadF1Extras === 'function') loadF1Extras(); } catch(e) { console.warn('f1:extras', e); }
    try { if (typeof loadF1Times === 'function') loadF1Times(); } catch(e) { console.warn('f1:times', e); }
    try { if (typeof loadF1Preview === 'function') loadF1Preview(); } catch(e) { console.warn('f1:preview', e); }
}
