// health.js

import { Storage } from "./storage.js";

export function renderHealth(container){

  const food = Storage.get("food");

  container.innerHTML = `

    <div class="card">Food entries: ${food.length}</div>

  `;

}
