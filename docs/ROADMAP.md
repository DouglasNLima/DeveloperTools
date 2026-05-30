# Roadmap

This roadmap keeps the suite focused on practical, local developer utilities. Every implemented tool must run fully in the browser and include unit and browser coverage in the same change.

## Phase 1: Foundation

- Modular static app structure with `index.html` as the GitHub Pages entry point.
- Scalable sidebar navigation with search, categories and planned tool previews.
- Installable offline PWA support for Microsoft Edge and other Chromium browsers.
- Base64 to file and File to Base64 tools preserved from the original prototype.
- Test setup covering pure utility logic and browser-level workflows.
- Project documentation and agent guidance.

## Phase 2: Encoding & Files

- URL encode/decode and query string parse/build helper.
- Hashes/checksums for text and local files.
- Image converter for local SVG, PNG, JPEG and WebP files.
- File type inspection improvements for common developer artefacts.
- Status: URL & query string helper, hashes/checksums and image converter implemented.

## Phase 3: JSON & Data

- JSON formatter/validator with helpful parse errors.
- JSON diff for comparing payloads.
- CSV/TSV helper for inspecting, cleaning and converting delimited data.
- JSON/XML data explorer for guided JSON queries and local grid review of JSON or XML records.
- JSON shape/schema generation for payload contracts and draft 2020-12 schema output.
- JSON Schema validator with local refs and path-level validation errors.
- Session-based handovers between compatible JSON, XML, text and Base64 tools.
- Status: JSON formatter/validator, JSON shape/schema generation, JSON diff, JSON Schema validator, CSV/TSV helper, JSON/XML data explorer and JSON/XML/text/Base64 handovers implemented, including transformed Data Explorer CSV, Dataverse OData and FetchXML/Liquid handovers.

## Phase 4: Documents

- PDF Template Field Explorer for local fillable PDF form inspection.
- Future PDF helpers for field mapping review and template handover workflows.
- Status: PDF Template Field Explorer implemented with vendored PDF.js assets.

## Phase 5: Web/API

- JWT decoder with claims, expiry and header inspection.
- Query string builder/parser is merged into the URL & query string helper.
- cURL/fetch converter for common request shapes.
- Cron / RRULE Builder for recurring jobs, reminders and timezone-aware handover snippets.
- Status: JWT Decoder & Claims Inspector, URL & query string helper, Cron / RRULE Builder and cURL/fetch converter implemented.

## Phase 6: Power Platform

- FetchXML Formatter & Liquid Builder for Power Pages.
- Power Pages Web API Snippet Generator.
- Site Settings Helper for common Power Pages configuration keys.
- Table Permissions Checklist for web roles, table access and scope review.
- Dataverse OData Query Builder for `$select`, `$filter`, `$expand`, `$orderby`, `$top`, `$count`, headers and local fetch snippets.
- Power Platform CLI Command Builder for common `pac auth`, `pac solution` and `pac pages` commands.
- Power Automate Expression Formatter for Workflow Definition Language expressions.
- Power Fx Snippet Formatter for readable formula snippets and sharing warnings.
- Status: initial Power Pages mini-roadmap and first wider Power Platform utility set implemented.

See [POWER-PAGES-ROADMAP.md](./POWER-PAGES-ROADMAP.md) and [POWER-PLATFORM-ROADMAP.md](./POWER-PLATFORM-ROADMAP.md) for detailed mini-roadmaps.

## Expansion Track

- Existing tools will be expanded with advanced modes, presets, review helpers and additional export options before many new standalone tools are added.
- Expansion work is tracked in [EXPANSION-ROADMAP.md](./EXPANSION-ROADMAP.md).
- Status: Dataverse OData Query Builder advanced query mode implemented.

## Phase 7: Text Utilities

- Regex tester with match group feedback.
- SQL query formatter for formatting and linearising common SQL snippets.
- Support Pack Sanitiser for masking sensitive values in shared logs and payloads.
- Text diff with line-level changes.
- HTML cleaner/converter for readable plain text and Markdown output from pasted HTML.
- Case converter for common code naming styles.
- UUID generator, hyphen restorer and validator.
- Status: Regex Tester, SQL query formatter, Support Pack Sanitiser, Text diff, HTML cleaner/converter, Case converter and UUID generator/restorer implemented.

## Test Expectations

- Unit tests cover pure parsing, formatting, conversion, validation and edge cases.
- Browser tests cover navigation, tool interaction, accessibility-critical state and important error states.
- Planned tools do not require tests until they become available tools.
- A tool is not considered complete until `npm test` passes.
