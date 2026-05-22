// ============================================================
// health-data.js — targets and localStorage helpers
// Edit TARGETS to change your daily goals
// ============================================================

var TARGETS = { kcal:2500, prot:180, carb:280, fat:70 };

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
