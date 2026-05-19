let foodLog = [];

let setLog = [];

function loadStorage(){

  foodLog = JSON.parse(localStorage.getItem("m_food") || "[]");

  setLog  = JSON.parse(localStorage.getItem("m_sets") || "[]");

}

function saveFood(){

  localStorage.setItem("m_food", JSON.stringify(foodLog));

}

function saveSets(){

  localStorage.setItem("m_sets", JSON.stringify(setLog));

}