# Developer Tools

A local-first suite of small developer utilities for day-to-day technical work. The app is designed to run entirely in the browser, with no backend, no CDN and no external runtime services.

The current foundation includes:

- Base64 to file
- File to Base64
- Hashes/checksums
- URL & query string helper
- JSON formatter/validator
- JSON shape/schema generation
- JSON diff
- JSON/XML data explorer
- CSV/TSV helper
- PDF Template Field Explorer
- JWT Decoder & Claims Inspector
- Cron / RRULE Builder
- cURL/fetch converter
- Regex Tester
- Support Pack Sanitiser
- Text diff
- HTML cleaner/converter
- Case converter
- UUID generator, restorer and validator
- FetchXML Formatter & Liquid Builder for Power Pages
- Power Pages Web API Snippet Generator
- Site Settings Helper for Power Pages
- Table Permissions Checklist for Power Pages
- Dataverse OData Query Builder
- Power Platform CLI Command Builder
- Power Automate Expression Formatter
- Power Fx Snippet Formatter
- A scalable tool menu with roadmap previews
- Unit and browser test scaffolding for future tools

## Local Usage

Open `index.html` directly in a browser, or serve the folder with any static file server.

When served from GitHub Pages, localhost or another HTTPS origin, Microsoft Edge can install the app on Windows using its native app install option. After the first online load, the service worker caches the static app shell and vendored assets so the installed app can reopen and run offline. Opening `index.html` directly with `file://` still works for normal local use, but browsers do not allow service worker registration from that origin.

For the test runner and local development tooling:

```sh
npm install
npm test
```

Available scripts:

```sh
npm run test:unit
npm run test:browser
```

The browser title includes the committed app version and build stamp from `src/app-metadata.js`. Keep `APP_VERSION` aligned with `package.json`, and increment `APP_BUILD` alongside the service worker cache suffix in `sw.js` before each deploy so the running build is visible in the tab title.

## GitHub Pages

This project is compatible with GitHub Pages as a static site. Publish the repository root, and GitHub Pages will use `index.html` as the entry point.

The included GitHub Actions workflow runs tests on every push to `main`. Deployment is enabled when the repository is public, or when the GitHub account plan supports Pages for private repositories.

Runtime requirements:

- No backend server.
- No CDN-hosted assets.
- No external API calls.
- No build step required for the published app.
- Installable offline support is provided by committed static PWA assets: `manifest.webmanifest`, `sw.js` and local icons.

`devtools.html` remains as a lightweight redirect for older links.

## Project Structure

```text
index.html
manifest.webmanifest
sw.js
assets/
  icons/
src/
  app-metadata.js
  app.js
  pwa.js
  styles.css
  tools/
    base64.js
    base64.ui.js
    catalog.js
    cron-rrule-builder.js
    cron-rrule-builder.ui.js
    csv-tsv-helper.js
    csv-tsv-helper.ui.js
    hash-checksums.js
    hash-checksums.ui.js
    json-diff.js
    json-diff.ui.js
    json-formatter.js
    json-formatter.ui.js
    jwt-decoder.js
    jwt-decoder.ui.js
    pdf-template-fields.js
    pdf-template-fields.ui.js
    dataverse-odata.js
    dataverse-odata.ui.js
    power-automate-expression.js
    power-automate-expression.ui.js
    power-fx-formatter.js
    power-fx-formatter.ui.js
    power-platform-cli.js
    power-platform-cli.ui.js
    power-pages.js
    power-pages-site-settings.js
    power-pages-site-settings.ui.js
    power-pages-table-permissions.js
    power-pages-table-permissions.ui.js
    power-pages.ui.js
    power-pages-webapi.js
    power-pages-webapi.ui.js
    regex-tester.js
    regex-tester.ui.js
    support-pack-sanitiser.js
    support-pack-sanitiser.ui.js
    syntax-highlight.js
    text-diff.js
    text-diff.ui.js
    html-cleaner.js
    html-cleaner.ui.js
    case-converter.js
    case-converter.ui.js
    curl-fetch-converter.js
    curl-fetch-converter.ui.js
    data-explorer.js
    data-explorer.ui.js
    file-drop-zone.js
    uuid-generator.js
    uuid-generator.ui.js
    url-codec.js
    url-codec.ui.js
  vendor/
    pdfjs/
tests/
  browser/
  support/
  unit/
docs/
  ROADMAP.md
AGENTS.md
```

## Contribution Notes

- Use British English for all visible copy and documentation.
- Keep tools local-first and safe for offline browser use.
- Add unit coverage for reusable logic and browser coverage for user flows.
- Keep planned tools in the catalogue as roadmap previews until they are implemented and tested.

See [docs/ROADMAP.md](./docs/ROADMAP.md), [docs/POWER-PAGES-ROADMAP.md](./docs/POWER-PAGES-ROADMAP.md) and [docs/POWER-PLATFORM-ROADMAP.md](./docs/POWER-PLATFORM-ROADMAP.md) for the current roadmap.
