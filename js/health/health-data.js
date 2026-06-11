// ============================================================
// health-data.js — targets and localStorage helpers
// Edit TARGETS to change your daily goals
// ============================================================

var TARGETS = { kcal:2000, prot:140, carb:210, fat:65 };

function loadFoodLog() {
  try { return JSON.parse(localStorage.getItem('foodLog') || '[]'); } catch(e) { return []; }
}
function saveFoodLog(log) {
  try { localStorage.setItem('foodLog', JSON.stringify(log)); } catch(e) {}
}
function loadWorkoutLog() {
  try { return JSON.parse(localStorage.getItem('workoutLog') || '[]'); } catch(e) { return []; }
}
function saveWorkoutLog(log) {
  try { localStorage.setItem('workoutLog', JSON.stringify(log)); } catch(e) {}
}
