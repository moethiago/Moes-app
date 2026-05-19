// app.js

import { $, time } from "./utils.js";

import { renderFeed } from "./feed.js";

import { renderSports } from "./sports.js";

import { renderHealth } from "./health.js";

function switchTab(tab){

  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));

  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));

  $("#panel-"+tab).classList.add("active");

  event.target.classList.add("active");

}

window.switchTab = switchTab;

function init(){

  setInterval(()=>$("#clock").textContent=time(),1000);

  renderFeed($("#feed-container"));

  renderSports($("#sports-container"));

  renderHealth($("#health-container"));

}

document.addEventListener("DOMContentLoaded", init);
