function renderHealth(){

  const panel = document.getElementById("panel-health");

  const kcal = foodLog.reduce((a,b)=>a+b.kcal,0);

  panel.innerHTML = `

    <div class="wire-item">

      <div class="wire-headline">Calories: ${kcal}</div>

    </div>

  `;

}