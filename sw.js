'use strict';

/* Tiene una copia dei file dell'app sul telefono: si apre subito, anche senza internet.

   Come arrivano gli aggiornamenti: a ogni pubblicazione cambia VERSIONE (lo fa pubblica.sh).
   Il telefono, aprendo l'app, vede che questo file è cambiato, scarica in sottofondo tutti
   i file nuovi e poi l'app si ricarica da sola (app.js, mai con la scheda aperta).

   Le giocate NON passano da qui: stanno nella memoria del browser (archivio.js). */

const VERSIONE = '6 nov 2026 · 8';
const CACHE = `registro-${VERSIONE}`;
const FILE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'archivio.js', 'calcoli.js', 'icone.js', 'grafici.js', 'app.js', 'statistiche.js',
  'icone/app-180.png', 'icone/app-192.png', 'icone/app-512.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' = scarica dal sito, non dalla copia del browser (che può essere vecchia di 10 minuti)
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILE.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nomi => Promise.all(nomi.filter(n => n.startsWith('registro-') && n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // L'apertura dell'app (indirizzo della cartella o index.html, anche con ?qualcosa) usa la pagina salvata
  const apertura = e.request.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname);
  const cosa = apertura ? 'index.html' : e.request;
  e.respondWith(
    caches.open(CACHE).then(c => c.match(cosa, { ignoreSearch: true }).then(salvata => {
      if (salvata) return salvata;
      // Un file che non è nella copia (non dovrebbe succedere): si prende dal sito e si conserva
      return fetch(e.request).then(risposta => {
        if (risposta.ok) c.put(e.request, risposta.clone());
        return risposta;
      });
    })),
  );
});
