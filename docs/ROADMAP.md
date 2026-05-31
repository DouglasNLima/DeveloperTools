# Roadmap

This roadmap keeps the suite focused on practical, local developer utilities. Every implemented tool must run fully in the browser and include unit and browser coverage in the same change.

## Phase 1: Foundation

- Modular static app structure with `index.html` as the GitHub Pages entry point.
- Scalable sidebar navigation with search, categories and planned tool previews.
- Installable offline PWA support for Microsoft Edge and other Chromium browsers.
- Base64 & File Converter workbench, preserving Base64-to-file and file-to-Base64 modes from the original prototype.
- Test setup covering pure utility logic and browser-level workflows.
- Project documentation and agent guidance.

## Phase 2: Encoding & Files

- URL encode/decode and query string parse/build helper.
- Hashes/checksums for text and local files.
- Image Converter & Optimiser workbench for converting, resizing and compressing local SVG, PNG, JPEG and WebP files.
- Image OCR for English text extraction from local images.
- File type inspection improvements for common developer artefacts.
- Status: URL & query string helper, hashes/checksums, Image Converter & Optimiser and Image OCR implemented.

## Phase 3: JSON & Data

- JSON & Data Workbench for formatting, comparing, validating and exploring JSON or XML payloads.
- JSON format mode with helpful parse errors, sorting, minification and path search.
- JSON compare mode for structure-aware payload differences.
- CSV/TSV helper for inspecting, cleaning and converting delimited data.
- JSON/XML explore mode for guided JSON queries and local grid review of JSON or XML records.
- JSON shape/schema generation for payload contracts and draft 2020-12 schema output.
- JSON Schema mode with local refs and path-level validation errors.
- Session-based handovers between compatible JSON, XML, text and Base64 tools.
- Status: JSON & Data Workbench, CSV/TSV helper and JSON/XML/text/Base64 handovers implemented, including transformed explorer CSV, PDF field mapping, Dataverse OData, Power Pages Web API and FetchXML/Liquid handovers.

## Phase 4: Charts & Diagrams

- Mermaid Studio workbench for local validation, SVG preview, MMD/SVG/PNG downloads, templates, data conversion and API/workflow diagramming.
- Mermaid templates for common flowchart, sequence, ER, class, state, timeline, Gantt, pie and XY snippets.
- Data to Mermaid mode for JSON, CSV and TSV tree, flowchart, ER-style, pie and XY diagrams.
- API/workflow mode for request snippets, endpoint notes and step lists.
- Mermaid handovers from JSON/data, API, Power Platform and text utilities into charting workflows.
- Status: Mermaid Studio is consolidated with editor, templates, data and API/workflow modes plus vendored Mermaid runtime assets.

## Phase 5: Documents

- PDF Template Field Explorer for local fillable PDF form inspection.
- Future PDF helpers for field mapping review and template handover workflows.
- Status: PDF Template Field Explorer implemented with vendored PDF.js assets and field mapping handovers.

## Phase 6: Web/API

- JWT decoder with claims, expiry and header inspection.
- Query string builder/parser is merged into the URL & query string helper.
- cURL/fetch converter for common request shapes.
- Cron / RRULE Builder for recurring jobs, reminders and timezone-aware handover snippets.
- Status: JWT Decoder & Claims Inspector, URL & query string helper, Cron / RRULE Builder and cURL/fetch converter implemented.

## Phase 7: Power Platform

- Power Pages Workbench for FetchXML/Liquid, Web API snippets, site settings and table permissions.
- FetchXML mode for formatting FetchXML and building Power Pages Liquid fetchxml blocks.
- Web API mode for generating safeAjax snippets and required site setting reminders.
- Site settings mode for common Power Pages configuration keys.
- Table permissions mode for web roles, table access and scope review.
- Dataverse OData Query Builder for `$select`, `$filter`, `$expand`, `$orderby`, `$top`, `$count`, headers and local fetch snippets.
- Power Platform CLI Command Builder for common `pac auth`, `pac solution` and `pac pages` commands.
- Solution Package Inspector for exported solution ZIP diagrams, documentation and import preflight reports.
- Solution Package Inspector diagrams mode for workflow component diagrams and automation dependency maps.
- Solution Package Inspector documentation mode for operational Markdown documentation from exported solution ZIP files.
- Solution Package Inspector preflight mode for local solution ZIP review, dependency metadata and import command checklists.
- Power Automate Expression Formatter for Workflow Definition Language expressions.
- Power Fx Snippet Formatter for readable formula snippets and sharing warnings.
- Model-driven JavaScript Reviewer for local web resource risk reports.
- Client API Migration Helper for `Xrm.Page` to `formContext` guidance.
- Form Event Handler Builder, Xrm.WebApi Snippet Builder, Form Notification & Validation Builder and Command Bar JavaScript Builder for model-driven app client scripting.
- Solution JavaScript Event Inspector and Web Resource Dependency Mapper for exported solution ZIP metadata.
- Status: Power Pages Workbench, Solution Package Inspector, first wider Power Platform utility set, solution-to-Mermaid workflow inspection, automation dependency mapping, solution documentation generation and model-driven JavaScript tools implemented.

See [POWER-PAGES-ROADMAP.md](./POWER-PAGES-ROADMAP.md) and [POWER-PLATFORM-ROADMAP.md](./POWER-PLATFORM-ROADMAP.md) for detailed mini-roadmaps.

## Catalogue Consolidation Track

- Consolidate related tools into workbenches with modes while preserving each existing capability.
- Keep legacy hash links working through catalogue aliases instead of keeping deprecated entries visible in the menu.
- Hide old menu entries only after their replacement workbench is implemented and tested in the same change.
- Status: Base64 & File Converter, Image Converter & Optimiser, Markdown Workbench, Mermaid Studio, JSON & Data Workbench, Power Pages Workbench and Solution Package Inspector are consolidated with hidden legacy entries and preserved hash aliases.

## Expansion Track

- Existing tools will be expanded with advanced modes, presets, review helpers and additional export options before many new standalone tools are added.
- Expansion work is tracked in [EXPANSION-ROADMAP.md](./EXPANSION-ROADMAP.md).
- Status: Dataverse OData advanced query mode, CSV/TSV advanced exports, PDF field handover reports, Power Fx review modes, JSON path search and Regex replacement preview implemented.

## Phase 8: Text Utilities

- Regex tester with match group feedback.
- Markdown Workbench for local preview, heading/reference review, Mermaid block extraction, table normalisation and CSV/TSV conversion.
- SQL query formatter for formatting and linearising common SQL snippets.
- Support Pack Sanitiser for masking sensitive values in shared logs and payloads.
- Text diff with line-level changes.
- HTML cleaner/converter for readable plain text and Markdown output from pasted HTML.
- Case converter for common code naming styles.
- UUID generator, hyphen restorer and validator.
- Status: Regex Tester, Markdown Workbench, SQL query formatter, Support Pack Sanitiser, Text diff, HTML cleaner/converter, Case converter and UUID generator/restorer implemented.

## Test Expectations

- Unit tests cover pure parsing, formatting, conversion, validation and edge cases.
- Browser tests cover navigation, tool interaction, accessibility-critical state and important error states.
- Planned tools do not require tests until they become available tools.
- A tool is not considered complete until `npm test` passes.
