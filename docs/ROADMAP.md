# Roadmap

This roadmap keeps the suite focused on practical, local developer utilities. Every implemented tool must run fully in the browser and include unit and browser coverage in the same change.

## Phase 1: Foundation

- Modular static app structure with `index.html` as the GitHub Pages entry point.
- Scalable sidebar navigation with search, categories and planned tool previews.
- Base64 to file and File to Base64 tools preserved from the original prototype.
- Test setup covering pure utility logic and browser-level workflows.
- Project documentation and agent guidance.

## Phase 2: Encoding & Files

- URL encode/decode and query string parse/build helper.
- Hashes/checksums for text and local files.
- File type inspection improvements for common developer artefacts.
- Status: URL & query string helper implemented; hashes/checksums remain planned.

## Phase 3: JSON & Data

- JSON formatter/validator with helpful parse errors.
- JSON diff for comparing payloads.
- CSV/TSV helper for inspecting, cleaning and converting delimited data.
- Status: JSON formatter/validator and JSON diff implemented; CSV/TSV helper remains planned.

## Phase 4: Documents

- PDF Template Field Explorer for local fillable PDF form inspection.
- Future PDF helpers for field mapping review and template handover workflows.
- Status: PDF Template Field Explorer implemented with vendored PDF.js assets.

## Phase 5: Web/API

- JWT decoder with claims, expiry and header inspection.
- Query string builder/parser is merged into the URL & query string helper.
- cURL/fetch converter for common request shapes.
- Status: JWT Decoder & Claims Inspector and URL & query string helper implemented; cURL/fetch converter remains planned.

## Phase 6: Power Platform

- FetchXML Formatter & Liquid Builder for Power Pages.
- Power Pages Web API Snippet Generator.
- Site Settings Helper for common Power Pages configuration keys.
- Table Permissions Checklist for web roles, table access and scope review.
- Status: initial Power Pages mini-roadmap implemented; future Power Platform work should build on feedback from these tools.

See [POWER-PAGES-ROADMAP.md](./POWER-PAGES-ROADMAP.md) for the detailed mini-roadmap.

## Phase 7: Text Utilities

- Regex tester with match group feedback.
- Text diff with line-level changes.
- Case converter for common code naming styles.
- UUID generator and validator.

## Test Expectations

- Unit tests cover pure parsing, formatting, conversion, validation and edge cases.
- Browser tests cover navigation, tool interaction, accessibility-critical state and important error states.
- Planned tools do not require tests until they become available tools.
- A tool is not considered complete until `npm test` passes.
