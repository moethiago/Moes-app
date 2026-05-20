// ── HEALTH.JS ─────────────────────────────────────────────
window.foodLog = window.foodLog || [];
window.setLog  = window.setLog  || [];

function validNum(val, min, max) {
  var n = parseFloat(val);
  if (isNaN(n)) return null;
  if (n < min)  return null;
  if (n > max)  return null;
  return n;
}

function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2500);
}

function addFood() {
  var name = document.getElementById('food-name').value.trim();
  var kcal = validNum(document.getElementById('food-kcal').value, 1, 9999);
  var prot = validNum(document.getElementById('food-prot').value, 0, 999) || 0;
  var carb = validNum(document.getElementById('food-carb').value, 0, 999) || 0;
  var fat  = validNum(document.getElementById('food-fat').value,  0, 999) || 0;
  if (!name) { showToast('Enter a food name'); return; }
  if (kcal === null) { showToast('Enter valid kcal (1-9999)'); return; }
  window.foodLog.push({ name:name, kcal:kcal, prot:prot, carb:carb, fat:fat });
  localStorage.setItem('m_food', JSON.stringify(window.foodLog));
  document.getElementById('food-name').value = '';
  document.getElementById('food-kcal').value = '';
  document.getElementById('food-prot').value = '';
  document.getElementById('food-carb').value = '';
  document.getElementById('food-fat').value  = '';
  renderFood();
}

function deleteFood(i) {
  window.foodLog.splice(i, 1);
  localStorage.setItem('m_food', JSON.stringify(window.foodLog));
  renderFood();
}

function renderFood() {
  var log = window.foodLog;
  var totKcal = 0, totProt = 0, totCarb = 0, totFat = 0;
  log.forEach(function(f) {
    totKcal += f.kcal; totProt += f.prot; totCarb += f.carb; totFat += f.fat;
  });
  var pct  = Math.min(totKcal / 2500, 1);
  var ring = document.getElementById('cal-ring');
  if (ring) ring.style.strokeDashoffset = 251 - pct * 251;
  var disp = document.getElementById('cal-display');
  if (disp) disp.textContent = Math.round(totKcal);
  function setMacro(valId, barId, val, max) {
    var el = document.getElementById(valId);
    var br = document.getElementById(barId);
    if (el) el.textContent = Math.round(val) + 'g';
    if (br) br.style.width = Math.min(val / max * 100, 100) + '%';
  }
  setMacro('prot-val','prot-bar', totProt, 180);
  setMacro('carb-val','carb-bar', totCarb, 300);
  setMacro('fat-val', 'fat-bar',  totFat,  80);
  var list = document.getElementById('food-list');
  if (!list) return;
  if (!log.length) { list.innerHTML = ''; return; }
  var html = '';
  log.forEach(function(f, i) {
    html += '<div class="set-row">'
      + '<div class="set-info"><span class="set-name">' + f.name + '</span>'
      + '<span class="set-detail">' + f.kcal + ' kcal - P:' + f.prot + ' C:' + f.carb + ' F:' + f.fat + '</span></div>'
      + '<button class="set-del" onclick="deleteFood(' + i + ')">x</button>'
      + '</div>';
  });
  list.innerHTML = html;
}

function addSet() {
  var exercise = document.getElementById('set-exercise').value.trim();
  var weight   = validNum(document.getElementById('set-weight').value, 0, 9999) || 0;
  var reps     = validNum(document.getElementById('set-reps').value,   1, 9999);
  if (!exercise) { showToast('Enter exercise name'); return; }
  if (reps === null) { showToast('Enter valid reps (1-9999)'); return; }
  window.setLog.push({ exercise:exercise, weight:weight, reps:reps });
  localStorage.setItem('m_sets', JSON.stringify(window.setLog));
  document.getElementById('set-weight').value = '';
  document.getElementById('set-reps').value   = '';
  renderSets();
}

function deleteSet(i) {
  window.setLog.splice(i, 1);
  localStorage.setItem('m_sets', JSON.stringify(window.setLog));
  renderSets();
}

function renderSets() {
  var log = window.setLog;
  var totalVol = 0;
  var exercises = {};
  log.forEach(function(s) {
    totalVol += s.weight * s.reps;
    exercises[s.exercise] = (exercises[s.exercise] || 0) + 1;
  });
  var wkSets = document.getElementById('wk-sets');
  var wkVol  = document.getElementById('wk-vol');
  var wkExs  = document.getElementById('wk-exs');
  var volTot = document.getElementById('vol-total-val');
  if (wkSets) wkSets.textContent = log.length;
  if (wkVol)  wkVol.textContent  = Math.round(totalVol);
  if (wkExs)  wkExs.textContent  = Object.keys(exercises).length;
  if (volTot) volTot.textContent  = Math.round(totalVol) + ' kg';
  var list = document.getElementById('set-list');
  if (!list) return;
  if (!log.length) { list.innerHTML = ''; return; }
  var html = '';
  log.forEach(function(s, i) {
    html += '<div class="set-row">'
      + '<div class="set-info"><span class="set-name">' + s.exercise + '</span>'
      + '<span class="set-detail">' + s.weight + ' kg x ' + s.reps + ' reps</span></div>'
      + '<button class="set-del" onclick="deleteSet(' + i + ')">x</button>'
      + '</div>';
  });
  list.innerHTML = html;
}

// Tab state preservation — save inputs to sessionStorage on every keystroke
var HEALTH_INPUTS = ['food-name','food-kcal','food-prot','food-carb','food-fat','set-exercise','set-weight','set-reps'];

function saveHealthInputState() {
  HEALTH_INPUTS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) sessionStorage.setItem('hi_' + id, el.value);
  });
}

function restoreHealthInputState() {
  HEALTH_INPUTS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      var saved = sessionStorage.getItem('hi_' + id);
      if (saved) el.value = saved;
    }
  });
}

function initHealthInputListeners() {
  HEALTH_INPUTS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', saveHealthInputState);
  });
  restoreHealthInputState();
}
