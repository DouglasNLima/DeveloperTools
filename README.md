# Developer Tools

A local-first suite of small developer utilities for day-to-day technical work. The app is designed to run entirely in the browser, with no backend, no CDN and no external runtime services.

The current foundation includes:

- Base64 to file
- File to Base64
- URL & query string helper
- JSON formatter/validator
- JSON diff
- PDF Template Field Explorer
- FetchXML Formatter & Liquid Builder for Power Pages
- Power Pages Web API Snippet Generator
- Site Settings Helper for Power Pages
- Table Permissions Checklist for Power Pages
- A scalable tool menu with roadmap previews
- Unit and browser test scaffolding for future tools

## Local Usage

Open `index.html` directly in a browser, or serve the folder with any static file server.

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

## GitHub Pages

This project is compatible with GitHub Pages as a static site. Publish the repository root, and GitHub Pages will use `index.html` as the entry point.

The included GitHub Actions workflow runs tests on every push to `main`. Deployment is enabled when the repository is public, or when the GitHub account plan supports Pages for private repositories.

Runtime requirements:

- No backend server.
- No CDN-hosted assets.
- No external API calls.
- No build step required for the published app.

`devtools.html` remains as a lightweight redirect for older links.

## Project Structure

```text
index.html
src/
  app.js
  styles.css
  tools/
    base64.js
    base64.ui.js
    catalog.js
    json-diff.js
    json-diff.ui.js
    json-formatter.js
    json-formatter.ui.js
    pdf-template-fields.js
    pdf-template-fields.ui.js
    power-pages.js
    power-pages-site-settings.js
    power-pages-site-settings.ui.js
    power-pages-table-permissions.js
    power-pages-table-permissions.ui.js
    power-pages.ui.js
    power-pages-webapi.js
    power-pages-webapi.ui.js
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

See [docs/ROADMAP.md](./docs/ROADMAP.md) and [docs/POWER-PAGES-ROADMAP.md](./docs/POWER-PAGES-ROADMAP.md) for the current roadmap.
