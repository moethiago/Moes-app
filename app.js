alert("app.js is connected");
function switchTab(tab){

  document.querySelectorAll(".tab-panel")

    .forEach(p=>p.classList.remove("active"));

  document.getElementById("panel-"+tab).classList.add("active");

}

function init(){

  loadStorage();

  loadNewsFeed();

  loadF1();

  renderHealth();

}

document.addEventListener("DOMContentLoaded", init);
