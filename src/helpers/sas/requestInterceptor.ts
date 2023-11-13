self.addEventListener('fetch', async (event) => {
  const sas = self.location.search;
  if (
    `${event.request.url}`.includes('/index.html') ||
    `${event.request.url}`.includes('/sasHelper.js') ||
    `${event.request.url}`.includes('/requestInterceptor.js')
  ) {
    return;
  }
  event.respondWith(fetch(`${event.request.url}${sas}`));
});

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
