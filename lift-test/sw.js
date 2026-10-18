var SC=self.registration.scope,P=SC.indexOf("/lift-test/")>=0?"lift-test":SC.indexOf("/lift2/")>=0?"lift2":"lift",C=P+"-v4.12",G=P+"-gif",GMAX=250; /* same file serves lift/ and lift2/ */
var SHELL=["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png","./exercises.json"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(SHELL);}).then(function(){return self.skipWaiting();}));});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k.indexOf(P+"-v")===0&&k!==C;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
/* exercise animations: kept for the gym (they work without signal); only the newest 250 so the phone never fills up */
function trim(c){return c.keys().then(function(ks){if(ks.length>GMAX)return Promise.all(ks.slice(0,ks.length-GMAX).map(function(k){return c.delete(k);}));});}
function gifFetch(req){
  return caches.open(G).then(function(c){return c.match(req).then(function(m){
    if(m){var cp=m.clone();c.delete(req).then(function(){return c.put(req,cp);}).catch(function(){});return m;} /* used again → moves to the newest end */
    return fetch(req).then(function(r){if(r.ok||r.type==="opaque"){var cp=r.clone();c.put(req,cp).then(function(){return trim(c);}).catch(function(){});}return r;});
  });});
}
self.addEventListener("fetch",function(e){
  var u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.pathname.indexOf("/api/")>=0||u.pathname.indexOf("version.json")>=0)return;
  if(u.origin===location.origin){ /* network first for the app, cache when offline */
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(function(r){var cp=r.clone();caches.open(C).then(function(c){c.put(e.request,cp);});return r;}).catch(function(){return caches.match(e.request,{ignoreSearch:true});}));
  }else if(u.hostname==="static.exercisedb.dev"){
    e.respondWith(gifFetch(e.request));
  }else if(u.hostname.indexOf("fonts.g")===0){ /* fonts: cache first */
    e.respondWith(caches.match(e.request).then(function(m){return m||fetch(e.request).then(function(r){if(r.ok||r.type==="opaque"){var cp=r.clone();caches.open(C).then(function(c){c.put(e.request,cp);});}return r;});}));
  } /* anything else (exercise steps) goes straight to the network; the app keeps its own copy */
});

/* reminders: show what the server sends (title + text only), tapping opens Lift */
self.addEventListener("push",function(e){var d={};try{d=e.data?e.data.json():{};}catch(x){d={title:"Lift",body:e.data?e.data.text():""};}
  e.waitUntil(self.registration.showNotification(d.title||"Lift",{body:d.body||"",tag:d.tag||"lift",icon:"icon-192.png",badge:"icon-192.png"}));});
self.addEventListener("notificationclick",function(e){e.notification.close();
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(function(cs){for(var i=0;i<cs.length;i++){if("focus" in cs[i])return cs[i].focus();}return clients.openWindow("./");}));});
