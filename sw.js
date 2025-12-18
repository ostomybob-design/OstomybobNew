const CACHE = "ostomyhub-v1";
const assets = [
    "/",
    "/index.html",
    "/images/Community.png",
    "/images/2.png",
    "/images/fpost.png"
];

self.addEventListener("install", e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(assets))
    );
});

self.addEventListener("fetch", e => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});