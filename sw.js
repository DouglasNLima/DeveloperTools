const CACHE_NAME = 'developer-tools-static-v25';
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
  './src/app-transparency.js',
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
  './src/tools/image-ocr.js',
  './src/tools/image-ocr.ui.js',
  './src/tools/integration-contracts.js',
  './src/tools/json-diff.js',
  './src/tools/json-diff.ui.js',
  './src/tools/json-formatter.js',
  './src/tools/json-formatter.ui.js',
  './src/tools/json-schema-validator.js',
  './src/tools/json-schema-validator.ui.js',
  './src/tools/jwt-decoder.js',
  './src/tools/jwt-decoder.ui.js',
  './src/tools/markdown.js',
  './src/tools/markdown-preview.ui.js',
  './src/tools/markdown-table.js',
  './src/tools/markdown-table.ui.js',
  './src/tools/mermaid.js',
  './src/tools/mermaid-api.ui.js',
  './src/tools/mermaid-data.ui.js',
  './src/tools/mermaid-editor.ui.js',
  './src/tools/mermaid-runtime.js',
  './src/tools/mermaid-template-builder.ui.js',
  './src/tools/pdf-template-fields.js',
  './src/tools/pdf-template-fields.ui.js',
  './src/tools/power-automate-expression.js',
  './src/tools/power-automate-expression.ui.js',
  './src/tools/power-fx-formatter.js',
  './src/tools/power-fx-formatter.ui.js',
  './src/tools/power-platform-solution.js',
  './src/tools/power-platform-solution-docs.js',
  './src/tools/power-platform-solution-docs.ui.js',
  './src/tools/power-platform-solution-mermaid.js',
  './src/tools/power-platform-solution-mermaid.ui.js',
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
  './src/vendor/mermaid/LICENSE',
  './src/vendor/mermaid/chunks/mermaid.esm.min/architecture-7EHR7CIX-6QZW5X65.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/architectureDiagram-UL44E2DR.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/blockDiagram-7IZFK4PR.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/c4Diagram-Y2BXMSZH.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-2T2R6R2M.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-2UTLFMKG.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-3SSMPTDK.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-4R4BOZG6.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-5IMINLNL.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-5VCL7Z4A.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-6764PJDD.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-67TQ5CYL.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-7FYTHRHK.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-7J6CGLKN.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-7W6UQGC5.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-AQ6EADP3.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-AZZRMDJM.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-C62D2QBJ.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-CEXFNPSA.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-INKRHTLW.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-J5EP6P6S.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-JQRUD6KW.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-KGFNY3KK.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-KGYTTC2M.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-KNLZD3CH.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-KRXBNO2N.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-LCXTWHL2.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-LII3EMHJ.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-LRIF4GLE.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-QA3QBVWF.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-RERM46MO.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-RG4AUYOV.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-RKZBBQEN.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-RLI5ZMPA.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-T2UQINTJ.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-T5OCTHI4.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-UP6H54XL.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-UXSXWOXI.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-UY5QBCOK.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-VU6ZFW4Y.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-W44A43WB.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/chunk-ZXARS5L4.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/classDiagram-KGZ6W3CR.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/classDiagram-v2-72OJOZXJ.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/cose-bilkent-UX7MHV2Q.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/dagre-ND4H6XIP.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/diagram-3NCE3AQN.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/diagram-GF46GFSD.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/diagram-HNR7UZ2L.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/diagram-QXG6HAR7.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/diagram-WEQXMOUZ.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/erDiagram-L5TCEMPS.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/eventmodeling-FCH6USID-MREXMVOE.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/flowDiagram-H6V6AXG4.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/ganttDiagram-JCBTUEKG.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/gitGraph-WXDBUCRP-R675I2BI.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/gitGraphDiagram-S2ZK5IYY.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/info-J43DQDTF-KCYPFFUO.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/infoDiagram-3YFTVSEB.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/ishikawaDiagram-BNXS4ZKH.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/journeyDiagram-M6C3CM3L.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/kanban-definition-75IXJCU3.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/katex-K3KEBU37.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/mindmap-definition-2TDM6QVE.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/packet-YPE3B663-LP52Z2RK.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/pie-LRSECV5Y-TCRJHUBD.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/pieDiagram-CU6KROY3.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/quadrantDiagram-VICAPDV7.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/radar-GUYGQ44K-RDLRG3WG.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/requirementDiagram-JXO7QTGE.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/sankeyDiagram-URQDO5SZ.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/sequenceDiagram-VS2MUI6T.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/stateDiagram-7D4R322I.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/stateDiagram-v2-36443NZ5.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/timeline-definition-O6YCAMPW.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/treemap-LRROVOQU-LLAWBHMP.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/treeView-BLDUP644-QA4HXRO3.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/vennDiagram-MWXL3ELB.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/wardley-L42UT6IY-5TKZOOLJ.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/wardleyDiagram-CUQ6CDDI.mjs',
  './src/vendor/mermaid/chunks/mermaid.esm.min/xychartDiagram-N2JHSOCM.mjs',
  './src/vendor/mermaid/mermaid.esm.min.mjs',
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
