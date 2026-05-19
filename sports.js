function loadF1(){

  const panel = document.getElementById("panel-sports");

  panel.innerHTML = F1_DATA.map(d=>`

    <div class="wire-item">

      <div class="wire-headline">${d.name}</div>

      <div class="wire-meta">${d.pts} pts</div>

    </div>

  `).join("");

}