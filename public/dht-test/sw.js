/* DHT: dauerhafter Zwischenspeicher ist abgeschaltet (Stand 22.11.2026).
   Diese Fassung ersetzt den früheren Cache-First-Worker. Sie löscht dessen
   Zwischenspeicher, meldet sich selbst ab und lädt offene Fenster einmal neu,
   damit Besucher die aktuelle Fassung aus dem Netz bekommen.
   Ein neuer Worker wird erst nach einer Freigabe wieder eingerichtet. */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const namen = await caches.keys();
      await Promise.all(namen.filter((n) => n.startsWith('dht-public-assets-')).map((n) => caches.delete(n)));
    } catch (e) { /* ohne Zwischenspeicher weiter */ }
    try {
      await self.registration.unregister();
    } catch (e) { /* bereits abgemeldet */ }
    try {
      const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
      await Promise.all(fenster.map((c) => c.navigate(c.url)));
    } catch (e) { /* Neuladen beim nächsten Aufruf */ }
  })());
});
/* Kein fetch-Handler: Anfragen gehen direkt ins Netz. */
