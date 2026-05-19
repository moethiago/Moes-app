// feed.js

export function renderFeed(container){

  const data = [

    "F1 season heating up",

    "Football weekend results",

    "Saudi sports updates"

  ];

  container.innerHTML = data.map(d=>`<div class="card">${d}</div>`).join("");

}
