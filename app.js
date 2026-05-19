// ── CORE APP ───────────────────────────────────────────

function switchTab(tab) {
  ['feed','sports','health'].forEach(function(t) {
    var panel = document.getElementById('panel-' + t);
    var btn   = document.getElementById('nav-' + t);
    if (panel) panel.classList.toggle('active', t === tab);
    if (btn) btn.classList.toggle('active',   t === tab);
  });
  document.getElementById('scroll-wrap').scrollTop = 0;
}

function startClock() {
  var el = document.getElementById('clock');
  function tick() {
    var d = new Date();
    if (el) el.textContent =
      String(d.getHours()).padStart(2,'0') + ':' +
      String(d.getMinutes()).padStart(2,'0');
  }
  tick();
  setInterval(tick, 10000);
}

document.addEventListener('DOMContentLoaded', function() {
  startClock();
  loadNewsFeed();
  loadFootballScores();
  loadF1Data();
  renderFood();
  renderSets();
});