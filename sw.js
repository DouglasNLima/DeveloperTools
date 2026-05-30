const CACHE_NAME = 'developer-tools-static-v18';
const OFFLINE_FALLBACK_URL = './index.html';

const PRECACHE_URLS = [
  './',
  './index.html',
  './devtools.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './src/app.js',
  './src/app-metadata.js',
  './src/pwa.js',
  './src/styles.css',
  './src/tools/base64.js',
  './src/tools/base64.ui.js',
  './src/tools/case-converter.js',
  './src/tools/case-converter.ui.js',
  './src/tools/catalog.js',
  './src/tools/cron-rrule-builder.js',
  './src/tools/cron-rrule-builder.ui.js',
  './src/tools/csv-tsv-helper.js',
  './src/tools/csv-tsv-helper.ui.js',
  './src/tools/curl-fetch-converter.js',
  './src/tools/curl-fetch-converter.ui.js',
  './src/tools/data-explorer.js',
  './src/tools/data-explorer.ui.js',
  './src/tools/dataverse-odata.js',
  './src/tools/dataverse-odata.ui.js',
  './src/tools/hash-checksums.js',
  './src/tools/hash-checksums.ui.js',
  './src/tools/file-drop-zone.js',
  './src/tools/file-preview-modal.js',
  './src/tools/html-cleaner.js',
  './src/tools/html-cleaner.ui.js',
  './src/tools/image-converter.js',
  './src/tools/image-converter.ui.js',
  './src/tools/integration-contracts.js',
  './src/tools/json-diff.js',
  './src/tools/json-diff.ui.js',
  './src/tools/json-formatter.js',
  './src/tools/json-formatter.ui.js',
  './src/tools/json-schema-validator.js',
  './src/tools/json-schema-validator.ui.js',
  './src/tools/jwt-decoder.js',
  './src/tools/jwt-decoder.ui.js',
  './src/tools/pdf-template-fields.js',
  './src/tools/pdf-template-fields.ui.js',
  './src/tools/power-automate-expression.js',
  './src/tools/power-automate-expression.ui.js',
  './src/tools/power-fx-formatter.js',
  './src/tools/power-fx-formatter.ui.js',
  './src/tools/power-pages-site-settings.js',
  './src/tools/power-pages-site-settings.ui.js',
  './src/tools/power-pages-table-permissions.js',
  './src/tools/power-pages-table-permissions.ui.js',
  './src/tools/power-pages-webapi.js',
  './src/tools/power-pages-webapi.ui.js',
  './src/tools/power-pages.js',
  './src/tools/power-pages.ui.js',
  './src/tools/power-platform-cli.js',
  './src/tools/power-platform-cli.ui.js',
  './src/tools/regex-tester.js',
  './src/tools/regex-tester.ui.js',
  './src/tools/sql-formatter.js',
  './src/tools/sql-formatter.ui.js',
  './src/tools/support-pack-sanitiser.js',
  './src/tools/support-pack-sanitiser.ui.js',
  './src/tools/syntax-highlight.js',
  './src/tools/tool-handover.js',
  './src/tools/text-diff.js',
  './src/tools/text-diff.ui.js',
  './src/tools/url-codec.js',
  './src/tools/url-codec.ui.js',
  './src/tools/uuid-generator.js',
  './src/tools/uuid-generator.ui.js',
  './src/vendor/pdfjs/pdf.min.mjs',
  './src/vendor/pdfjs/pdf.worker.min.mjs'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME && cacheName.startsWith('developer-tools-static-'))
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, OFFLINE_FALLBACK_URL));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (fallbackUrl) {
      return cache.match(fallbackUrl);
    }

    return new Response('Offline content is not available.', {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8'
      }
    });
  }
}
