// ============================================================
// wc-subtabs.js — Up Next / Groups / Knockout / Results subtabs
// with spoiler lock on Groups, Knockout, Results (they reveal
// scores/standings). Up Next is always spoiler-free.
// Lock resets ON each visit.
// ============================================================

var _wcSub = 'upnext';
var _wcRevealed = { groups: false, bracket: false, results: false };

function switchWCSub(which) {
  _wcSub = which;
  ['upnext','groups','bracket','results'].forEach(function(s){
    var panel = document.getElementById('wcsub-' + s);
    var btn = document.getElementById('wcsubbtn-' + s);
    if (panel) panel.style.display = (s === which) ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', s === which);
  });
  if (which !== 'upnext' && !_wcRevealed[which]) showWCCover(which);
  var sw = document.getElementById('scroll-wrap');
  if (sw) sw.scrollTop = 0;
}

function showWCCover(which) {
  var content = document.getElementById('wcsub-' + which + '-content');
  var cover = document.getElementById('wcsub-' + which + '-cover');
  if (content) content.style.display = 'none';
  if (cover) cover.style.display = 'flex';
}

function revealWC(which) {
  _wcRevealed[which] = true;
  var content = document.getElementById('wcsub-' + which + '-content');
  var cover = document.getElementById('wcsub-' + which + '-cover');
  if (cover) cover.style.display = 'none';
  if (content) content.style.display = 'block';
  if (which === 'groups')  { try { loadWCGroups(); } catch(e){} }
  if (which === 'bracket') { try { loadWCBracket(); } catch(e){} }
  if (which === 'results') { try { loadWCResults(); } catch(e){} }
}

function relockWC(which) {
  _wcRevealed[which] = false;
  showWCCover(which);
}

function initWCSubtabs() {
  _wcSub = 'upnext';
  _wcRevealed = { groups: false, bracket: false, results: false };
  switchWCSub('upnext');
  try { loadWCUpNext(); } catch(e) { console.warn('wc:upnext', e); }
}
