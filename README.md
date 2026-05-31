# Developer Tools

A local-first suite of small developer utilities for day-to-day technical work. The app is designed to run entirely in the browser, with no backend, no CDN and no external runtime services.

## Available Tools

The catalogue currently exposes these available tools in the app menu:

- Base64 & File Converter
- Image Converter & Optimiser
- Image OCR
- Mermaid Studio
- Power Pages Workbench
- Dataverse OData Query Builder
- Power Platform CLI Command Builder
- Solution Package Inspector
- Power Automate Expression Formatter
- Power Fx Snippet Formatter
- Model-driven JavaScript Workbench
- Model-driven Solution Inspector
- URL & query string helper
- Hashes/checksums
- JSON & Data Workbench
- PDF Template Field Explorer
- CSV/TSV helper
- Web/API Workbench
- Text Utilities Workbench
- Markdown Workbench
- HTML cleaner/converter

The implemented platform capabilities around those tools include:

- A scalable tool menu with roadmap previews
- Session-based handovers between compatible tools
- Unit and browser test scaffolding for future tools

## Local Usage

Open `index.html` directly in a browser, or serve the folder with any static file server.

When served from GitHub Pages, localhost or another HTTPS origin, Microsoft Edge can install the app on Windows using its native app install option. After the first online load, the service worker caches the static app shell and vendored assets so the installed app can reopen and run offline. Opening `index.html` directly with `file://` still works for normal local use, but browsers do not allow service worker registration from that origin.

The home page includes a transparency section that explains the local-first philosophy and names runtime and testing libraries. Runtime libraries are bundled locally for the published app; testing-only libraries support development and are not loaded by the published app.

Image OCR loads its vendored Tesseract.js worker, WASM core and English language data only when OCR runs. Those assets are served from the same static origin and are cached by the service worker after first use, so OCR can run offline after it has been opened once online from GitHub Pages, localhost or another HTTPS origin.

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

## Handovers And Routes

Tools that produce compatible JSON, XML, Mermaid, Markdown, text, CSV or Base64 outputs can hand populated output to another local tool during the same browser session. The main handover paths are:

- JSON, schema, XML, PDF field mappings and data reports into JSON & Data Workbench, CSV/TSV helper, Mermaid Studio or text comparison tools.
- Request snippets and endpoint reports from Web/API, Dataverse, Power Pages and model-driven JavaScript tools into request conversion, URL inspection, sanitising or Mermaid workflows.
- Mermaid and Markdown reports into Mermaid Studio, Markdown Workbench, CSV/TSV helper and Text Utilities Workbench.
- Sanitised text, cleaned HTML, converted case output and generated API or Power Platform snippets into compatible text tools.
- Base64 output into the Base64 & File Converter file creator mode.

Handover history is kept in `sessionStorage`, so breadcrumbs can return to earlier tools with their filled fields restored without adding payloads to the URL.

The catalogue currently has 21 visible tools and 38 hidden legacy alias entries. Legacy hash links resolve to the current workbench and mode, but those aliases are compatibility routes rather than separate menu items.

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
  app-transparency.js
  app.js
  pwa.js
  styles.css
  tools/
    base64.js
    base64-workbench.ui.js
    base64.ui.js
    catalog.js
    cron-rrule-builder.js
    cron-rrule-builder.ui.js
    csv-tsv-helper.js
    csv-tsv-helper.ui.js
    file-preview-modal.js
    hash-checksums.js
    hash-checksums.ui.js
    image-converter.js
    image-converter.ui.js
    image-workbench.ui.js
    image-resizer.js
    image-resizer.ui.js
    image-ocr.js
    image-ocr.ui.js
    integration-contracts.js
    json-diff.js
    json-data-workbench.ui.js
    json-diff.ui.js
    json-formatter.js
    json-formatter.ui.js
    json-schema-validator.js
    json-schema-validator.ui.js
    jwt-decoder.js
    jwt-decoder.ui.js
    mermaid.js
    mermaid-api.ui.js
    mermaid-data.ui.js
    mermaid-editor.ui.js
    mermaid-runtime.js
    mermaid-studio.ui.js
    mermaid-template-builder.ui.js
    model-driven-javascript.js
    model-driven-javascript-workbench.ui.js
    model-driven-javascript.ui.js
    model-driven-solution-inspector.ui.js
    model-driven-solution-javascript.js
    model-driven-solution-javascript.ui.js
    markdown.js
    markdown-workbench.ui.js
    markdown-preview.ui.js
    markdown-table.js
    markdown-table.ui.js
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
    power-platform-solution-import-preflight.js
    power-platform-solution-import-preflight.ui.js
    power-platform-solution.js
    power-platform-solution-docs.js
    power-platform-solution-docs.ui.js
    power-platform-solution-mermaid.js
    power-platform-solution-mermaid.ui.js
    power-pages.js
    power-pages-site-settings.js
    power-pages-site-settings.ui.js
    power-pages-table-permissions.js
    power-pages-table-permissions.ui.js
    power-pages-workbench.ui.js
    power-pages.ui.js
    power-pages-webapi.js
    power-pages-webapi.ui.js
    regex-tester.js
    regex-tester.ui.js
    sql-formatter.js
    sql-formatter.ui.js
    solution-package-inspector.ui.js
    support-pack-sanitiser.js
    support-pack-sanitiser.ui.js
    syntax-highlight.js
    tool-handover.js
    text-utilities-workbench.ui.js
    workbench.js
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
    web-api-workbench.ui.js
  vendor/
    mermaid/
    pdfjs/
    tesseract/
tests/
  browser/
  support/
  unit/
docs/
  ROADMAP.md
  EXPANSION-ROADMAP.md
  POWER-PAGES-ROADMAP.md
  POWER-PLATFORM-ROADMAP.md
AGENTS.md
```

## Contribution Notes

- Use British English for all visible copy and documentation.
- Keep tools local-first and safe for offline browser use.
- Add unit coverage for reusable logic and browser coverage for user flows.
- Keep planned tools in the catalogue as roadmap previews until they are implemented and tested.

See [docs/ROADMAP.md](./docs/ROADMAP.md), [docs/POWER-PAGES-ROADMAP.md](./docs/POWER-PAGES-ROADMAP.md) and [docs/POWER-PLATFORM-ROADMAP.md](./docs/POWER-PLATFORM-ROADMAP.md) for the current roadmap.
