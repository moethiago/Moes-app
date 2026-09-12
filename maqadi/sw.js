// مقاضي — service worker: instant open, offline shell. API is never cached.
var C = "maqadi-v26";
var SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.pathname.indexOf("/api/") >= 0 || u.pathname.indexOf("version.json") >= 0) return;
  if (u.origin === location.origin) {
    // network first for our own files so updates land, cache as fallback
    e.respondWith(fetch(e.request, { cache: "no-store" }).then(function (r) { var cp = r.clone(); caches.open(C).then(function (c) { c.put(e.request, cp); }); return r; }).catch(function () { return caches.match(e.request); }));
  } else {
    // fonts: cache first
    e.respondWith(caches.match(e.request).then(function (m) { return m || fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(C).then(function (c) { c.put(e.request, cp); }); return r; }); }));
  }
});
