'use strict';

/* Tiene una copia dei file dell'app sul telefono, così si apre anche senza internet.
   Con la rete prende sempre la versione più recente (e aggiorna la copia);
   se la rete manca o è troppo lenta, usa la copia salvata.
   Le giocate NON passano da qui: stanno nella memoria del browser (archivio.js). */

const CACHE = 'registro-v2';
const FILE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'archivio.js', 'calcoli.js', 'icone.js', 'grafici.js', 'app.js', 'statistiche.js',
  'icone/app-180.png', 'icone/app-192.png', 'icone/app-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nomi => Promise.all(nomi.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

function entro(promessa, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('rete lenta')), ms);
    promessa.then(v => { clearTimeout(t); ok(v); }, err => { clearTimeout(t); ko(err); });
  });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // no-cache: chiede sempre al sito se il file è cambiato (risposta rapida se è uguale),
  // così una correzione pubblicata arriva subito invece che dopo 10 minuti
  const dallaRete = fetch(e.request, { cache: 'no-cache' }).then(risposta => {
    if (risposta.ok) {
      const copia = risposta.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
    }
    return risposta;
  });
  e.respondWith(
    entro(dallaRete, 3000).catch(() =>
      caches.match(e.request, { ignoreSearch: true })
        .then(r => r || caches.match('index.html'))
        .then(r => r || dallaRete)),
  );
});
