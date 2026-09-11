// ============================================================
// brief.js — Daily Brief tab (PDB-style). Reads /api/feed?brief=1.
// Building costs SAR 0 (Groq free tier) but only happens on an explicit tap.
// ============================================================
var BRIEF_URL = 'https://moes-app-two.vercel.app/api/feed?brief=1';
var BRIEF_LS  = 'moes_brief_last';
var briefState = { loading: false };

function briefEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function briefAgo(ts) { var h = Math.max(0, Math.round((Date.now() / 1000 - ts) / 3600)); return h < 1 ? 'now' : h < 24 ? h + 'h' : Math.round(h / 24) + 'd'; }
function briefStamp(ms) { var d = new Date(ms); return d.toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase() + ' AST'; }
function briefDateLine(dateStr) { var d = new Date(dateStr + 'T03:00:00Z'); return d.toLocaleDateString('en-GB', { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }

function loadBrief() {
  var body = document.getElementById('brief-body'); if (!body || briefState.loading) return;
  briefState.loading = true;
  var last = null; try { last = JSON.parse(localStorage.getItem(BRIEF_LS) || 'null'); } catch (e) {}
  if (last) renderBrief(last, { stale: true }); else body.innerHTML = '<div class="brief-empty">Checking for today\'s brief…</div>';
  fetch(BRIEF_URL, { cache: 'no-store' }).then(function(r) { return r.json(); }).then(function(j) {
    briefState.loading = false;
    if (j && j.ok && j.cached && j.brief) { try { localStorage.setItem(BRIEF_LS, JSON.stringify(j.brief)); } catch (e) {} renderBrief(j.brief, {}); }
    else if (j && j.ok && !j.cached) renderBuildPrompt(j.date, last);
    else renderBriefError((j && j.error) || 'Brief unavailable', last);
  }).catch(function() { briefState.loading = false; renderBriefError('Offline — showing last saved brief', last); });
}

function buildBrief(force) {
  var body = document.getElementById('brief-body'); if (!body || briefState.loading) return;
  briefState.loading = true;
  body.innerHTML = '<div class="brief-empty"><div class="brief-spin"></div>Reading 13 sources, ranking for you…<div class="brief-sub">Usually 10–30 seconds · SAR 0</div></div>';
  fetch(BRIEF_URL + '&build=1' + (force ? '&force=1' : ''), { cache: 'no-store' }).then(function(r) { return r.json(); }).then(function(j) {
    briefState.loading = false;
    if (j && j.ok && j.brief) { try { localStorage.setItem(BRIEF_LS, JSON.stringify(j.brief)); } catch (e) {} renderBrief(j.brief, {}); }
    else renderBriefError((j && j.error) || 'Build failed', null, true);
  }).catch(function() { briefState.loading = false; renderBriefError('Network error while building', null, true); });
}

function renderBuildPrompt(date, last) {
  var body = document.getElementById('brief-body');
  body.innerHTML =
    '<div class="brief-hero">' +
      '<div class="brief-kicker">DAILY BRIEF</div>' +
      '<div class="brief-date">' + briefEsc(briefDateLine(date)) + '</div>' +
      '<div class="brief-hero-txt">No brief prepared for today yet.</div>' +
      '<button class="brief-build" onclick="buildBrief(false)">PREPARE TODAY\'S BRIEF<span class="brief-cost">FREE · SAR 0</span></button>' +
    '</div>' +
    (last ? '<div class="brief-lastlink" onclick="renderBrief(JSON.parse(localStorage.getItem(BRIEF_LS)),{stale:true})">Show yesterday\'s brief (' + briefEsc(last.date) + ')</div>' : '');
}

function renderBriefError(msg, last, canRetry) {
  var body = document.getElementById('brief-body');
  var html = '<div class="brief-err">' + briefEsc(msg) + (canRetry ? ' <span class="brief-retry" onclick="buildBrief(true)">Retry</span>' : '') + '</div>';
  if (last) { renderBrief(last, { stale: true }); body.insertAdjacentHTML('afterbegin', html); } else body.innerHTML = html;
}

function renderBrief(b, opts) {
  var body = document.getElementById('brief-body'); if (!body || !b) return;
  var sections = {}; var order = ['Saudi Arabia', 'Gulf & Oil', 'World', 'Markets', 'Tech & AI', 'Motorsport'];
  (b.items || []).forEach(function(it) { (sections[it.section] = sections[it.section] || []).push(it); });
  var html = '<div class="brief-head">' +
    '<div class="brief-kicker">DAILY BRIEF' + (opts.stale ? ' · SAVED COPY' : '') + '</div>' +
    '<div class="brief-date">' + briefEsc(briefDateLine(b.date)) + '</div>' +
    '<div class="brief-meta">PREPARED ' + briefEsc(briefStamp(b.generatedAt)) + ' · ' + briefEsc(b.headlinesSeen || 0) + ' HEADLINES · ' + briefEsc((b.sources && b.sources.ok || []).length) + ' SOURCES</div>' +
    '</div>' +
    '<div class="brief-top"><div class="brief-top-lbl">TOP LINE</div><div class="brief-top-txt">' + briefEsc(b.headline) + '</div></div>';
  order.forEach(function(sec) {
    var list = sections[sec]; if (!list || !list.length) return;
    html += '<div class="brief-sec"><div class="brief-sec-lbl">' + briefEsc(sec.toUpperCase()) + '</div>';
    list.forEach(function(it) {
      html += '<a class="brief-item tier-' + briefEsc(it.tier) + '" href="' + briefEsc(it.url) + '" target="_blank" rel="noopener">' +
        '<div class="brief-item-top"><span class="brief-rank">' + briefEsc(it.rank) + '</span><span class="brief-tier">' + briefEsc(it.tier.toUpperCase()) + '</span><span class="brief-src">' + briefEsc(it.source) + ' · ' + briefAgo(it.publishedAt) + '</span></div>' +
        '<div class="brief-title">' + briefEsc(it.title) + '</div>' +
        '<div class="brief-what">' + briefEsc(it.what) + '</div>' +
        '<div class="brief-why"><span>WHY IT MATTERS</span>' + briefEsc(it.why) + '</div>' +
      '</a>';
    });
    html += '</div>';
  });
  if (b.bottomLine) html += '<div class="brief-bottom"><div class="brief-sec-lbl">BOTTOM LINE · NEXT 24H</div><div class="brief-bottom-txt">' + briefEsc(b.bottomLine) + '</div></div>';
  html += '<div class="brief-foot">' + briefEsc(b.engine || '') + (b.tokens ? ' · ' + briefEsc(b.tokens) + ' tokens' : '') + ' · SAR 0' +
    '<button class="brief-rebuild" onclick="buildBrief(true)">REBUILD · FREE</button></div>';
  body.innerHTML = html;
}
