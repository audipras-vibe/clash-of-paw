const CACHE = 'clash-of-paw-v10';
const FILES = ['./','./index.html','./landing.css','./landing.js','./play.html','./styles.css','./app.js','./manifest.webmanifest','./whitepaper.html','./whitepaper.css','./icon.svg','./brutus-warrior.png','./sage-healer.png','./hex-mage.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
