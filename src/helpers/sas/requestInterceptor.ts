/* eslint no-undef: off */

self.addEventListener(
  'fetch',
  async (event: {
    request: { url: string };
    respondWith: (arg0: Promise<Response>) => void;
  }) => {
    const sas = self.location.search;
    if (
      `${event.request.url}`.includes('/index.html') ||
      `${event.request.url}`.includes('/sasHelper.js') ||
      `${event.request.url}`.includes('/requestInterceptor.js')
    ) {
      return;
    }
    event.respondWith(fetch(`${event.request.url}${sas}`));
  }
);

self.addEventListener(
  'install',
  (event: { waitUntil: (arg0: Promise<void>) => void }) => {
    event.waitUntil(self.skipWaiting());
  }
);

self.addEventListener(
  'activate',
  (event: { waitUntil: (arg0: Promise<void>) => void }) => {
    event.waitUntil(self.clients.claim());
  }
);
