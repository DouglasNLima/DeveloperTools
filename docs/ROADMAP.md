# Roadmap

This roadmap keeps the suite focused on practical, local developer utilities. Every implemented tool must run fully in the browser and include unit and browser coverage in the same change.

## Phase 1: Foundation

- Modular static app structure with `index.html` as the GitHub Pages entry point.
- Scalable sidebar navigation with search, categories and planned tool previews.
- Base64 to file and File to Base64 tools preserved from the original prototype.
- Test setup covering pure utility logic and browser-level workflows.
- Project documentation and agent guidance.

## Phase 2: Encoding & Files

- URL encode/decode.
- Hashes/checksums for text and local files.
- File type inspection improvements for common developer artefacts.

## Phase 3: JSON & Data

- JSON formatter/validator with helpful parse errors.
- JSON diff for comparing payloads.
- CSV/TSV helper for inspecting, cleaning and converting delimited data.
- Status: JSON formatter/validator implemented; JSON diff and CSV/TSV helper remain planned.

## Phase 4: Web/API

- JWT decoder with claims, expiry and header inspection.
- Query string builder/parser.
- cURL/fetch converter for common request shapes.

## Phase 5: Power Platform

- FetchXML Formatter & Liquid Builder for Power Pages.
- Power Pages Web API Snippet Generator.
- Site Settings Helper for common Power Pages configuration keys.
- Table Permissions Checklist for web roles, table access and scope review.
- Status: initial Power Pages mini-roadmap implemented; future Power Platform work should build on feedback from these tools.

See [POWER-PAGES-ROADMAP.md](./POWER-PAGES-ROADMAP.md) for the detailed mini-roadmap.

## Phase 6: Text Utilities

- Regex tester with match group feedback.
- Text diff with line-level changes.
- Case converter for common code naming styles.
- UUID generator and validator.

## Test Expectations

- Unit tests cover pure parsing, formatting, conversion, validation and edge cases.
- Browser tests cover navigation, tool interaction, accessibility-critical state and important error states.
- Planned tools do not require tests until they become available tools.
- A tool is not considered complete until `npm test` passes.
