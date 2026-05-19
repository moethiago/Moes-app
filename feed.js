let parsedStoriesCache = [];

let currentFilter = "ALL";

async function loadNewsFeed(){

  parsedStoriesCache = [];

  const channels = [

    {name:"BBC F1", url:"https://feeds.bbci.co.uk/sport/formula1/rss.xml", cat:"F1"},

    {name:"BBC Football", url:"https://feeds.bbci.co.uk/sport/football/rss.xml", cat:"FOOTBALL"}

  ];

  for(const ch of channels){

    try{

      const res = await fetch("https://api.rss2json.com/v1/api.json?rss_url="+encodeURIComponent(ch.url));

      const data = await res.json();

      if(data.items){

        data.items.forEach(i=>{

          parsedStoriesCache.push({

            title:i.title,

            link:i.link,

            cat:ch.cat,

            src:ch.name,

            time:Date.parse(i.pubDate)

          });

        });

      }

    }catch(e){}

  }

  renderNews();

}

function renderNews(){

  const panel = document.getElementById("panel-feed");

  const list = currentFilter==="ALL"

    ? parsedStoriesCache

    : parsedStoriesCache.filter(x=>x.cat===currentFilter);

  panel.innerHTML = list.map(n=>`

    <div class="wire-item" onclick="openLink('${n.link}')">

      <div class="wire-headline">${n.title}</div>

      <div class="wire-meta">${n.src}</div>

    </div>

  `).join("");

}

function setFeedFilter(cat){

  currentFilter = cat;

  renderNews();

}