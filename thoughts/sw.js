// Moe's thoughts — service worker: instant open, offline shell. API is never cached.
var C = "thoughts-v1";
var SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.pathname.indexOf("/api/") >= 0) return;
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: "no-store" }).then(function (r) { var cp = r.clone(); caches.open(C).then(function (c) { c.put(e.request, cp); }); return r; }).catch(function () { return caches.match(e.request); }));
});
