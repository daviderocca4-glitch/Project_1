'use strict';

const VERSION = 'dt-v8';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/abv.js',
  './js/store.js',
  './js/api.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.hostname.indexOf('thecocktaildb.com') !== -1) {
    if (req.destination === 'image') {
      event.respondWith(
        caches.match(req).then((cached) => {
          if (cached) {
            fetch(req)
              .then((res) => {
                if (res.ok) {
                  const clone = res.clone();
                  caches.open(VERSION).then((cache) => cache.put(req, clone));
                }
              })
              .catch(() => {});
            return cached;
          }
          return fetch(req).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(VERSION).then((cache) => cache.put(req, clone));
            }
            return res;
          });
        })
      );
      return;
    }
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});
