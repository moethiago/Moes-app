// ============================================================
// f1-subtabs.js — Up Next / Results / Standings subtabs with a
// spoiler lock. Results & Standings stay covered until revealed.
// Lock is ON by default each visit (resets on reload).
// ============================================================

var _f1Sub = 'upnext';
var _f1Revealed = { results: false, standings: false };

function switchF1Sub(which) {
  _f1Sub = which;
  ['upnext','results','standings'].forEach(function(s){
    var panel = document.getElementById('f1sub-' + s);
    var btn = document.getElementById('f1subbtn-' + s);
    if (panel) panel.style.display = (s === which) ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', s === which);
  });
  // when entering a locked sub that isn't revealed, ensure cover is shown
  if ((which === 'results' || which === 'standings') && !_f1Revealed[which]) {
    showSpoilerCover(which);
  }
  var sw = document.getElementById('scroll-wrap');
  if (sw) sw.scrollTop = 0;
}

function showSpoilerCover(which) {
  var content = document.getElementById('f1sub-' + which + '-content');
  var cover = document.getElementById('f1sub-' + which + '-cover');
  if (content) content.style.display = 'none';
  if (cover) cover.style.display = 'flex';
}

function revealF1(which) {
  _f1Revealed[which] = true;
  var content = document.getElementById('f1sub-' + which + '-content');
  var cover = document.getElementById('f1sub-' + which + '-cover');
  if (cover) cover.style.display = 'none';
  if (content) content.style.display = 'block';
  // lazy-load that section's data on first reveal
  if (which === 'results') {
    try { if (typeof loadF1Recap === 'function') loadF1Recap(); } catch(e){}
    try { if (typeof initSessionSection === 'function') initSessionSection(); } catch(e){}
    try { if (typeof loadF1News === 'function') loadF1News(); } catch(e){}
  }
  if (which === 'standings') {
    try { if (typeof loadF1Data === 'function') loadF1Data(); } catch(e){}
    try { if (typeof loadF1Analytics === 'function') loadF1Analytics(); } catch(e){}
    try { if (typeof loadF1Extras === 'function') loadF1Extras(); } catch(e){}
    try { if (typeof loadF1Story === 'function') loadF1Story(); } catch(e){}
  }
}

function relockF1(which) {
  _f1Revealed[which] = false;
  showSpoilerCover(which);
}

// Called when the F1 tab opens: reset to Up Next, re-lock everything,
// and load only the spoiler-free content.
function initF1Subtabs() {
  _f1Sub = 'upnext';
  _f1Revealed = { results: false, standings: false };
  switchF1Sub('upnext');
  // spoiler-free loaders
  try { if (typeof startF1Status === 'function') startF1Status(); } catch(e){}
  try { if (typeof startCountdown === 'function') startCountdown(); } catch(e){}
  try { if (typeof loadNextRaceCard === 'function') loadNextRaceCard(); } catch(e){}
  try { if (typeof loadF1Times === 'function') loadF1Times(); } catch(e){}
  try { if (typeof loadF1Preview === 'function') loadF1Preview(); } catch(e){}
}
