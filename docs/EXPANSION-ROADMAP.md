# Existing Tools Expansion Roadmap

This roadmap expands the current suite before adding many new standalone tools. Each expansion remains static, local-first and browser-only. The app can compose snippets, reports, checklists and downloadable files, but it must not call tenants, authenticate users, run commands or depend on external runtime services.

## Delivery Rules

- Deliver one expansion at a time unless a future release explicitly bundles related work.
- Keep existing tools as the primary navigation items; expansions should appear as modes, presets, helpers or output options inside those tools.
- Use British English for app copy, documentation, statuses and reports.
- Add unit and browser coverage in the same change that implements each expansion.
- Run `npm test` before every commit and wait for GitHub Pages publication to pass.

## Phase 1: Dataverse OData Query Builder

- Add reusable endpoint presets for Dataverse Web API and Power Pages Web API.
- Add guided `$expand` composition with nested `$select`, `$filter` and `$orderby`.
- Warn for broad expands, missing nested `$select` and expensive `$count` combinations.
- Keep output as a Markdown report with endpoint, headers, warnings and a copyable `fetch` snippet.
- Status: implemented.

## Phase 2: Power Platform CLI Command Builder

- Add ALM presets for solution clone, sync, version, checker, export, unpack, pack and import.
- Add Power Pages upload/download profile reminders.
- Add an ALM checklist output mode for pull request and release handover.
- Keep commands copy-only; the app must never execute `pac`.
- Status: planned.

## Phase 3: Power Automate Expression Formatter

- Add templates for null-safe field reads, `coalesce`, `formatDateTime`, `contains`, `equals`, `length` and trigger conditions.
- Add wrapper conversion between raw expressions, `@...` and `@{...}`.
- Improve reference extraction for `triggerOutputs`, `outputs`, `items`, `variables` and `body`.
- Status: planned.

## Phase 4: Power Fx Snippet Formatter

- Add a delegation risk checklist for common functions and operators.
- Add output modes for formatted formula, review report and commented snippet.
- Warn for locale-sensitive separators, chained statements and risky `Patch` or `Collect` patterns.
- Status: planned.

## Phase 5: JSON Formatter/Validator

- Add a schema-light shape summary for objects, arrays, keys and primitive types.
- Add path search for keys and values.
- Add downloadable formatted, minified and summary outputs.
- Status: planned.

## Phase 6: CSV/TSV Helper

- Add column rename mapping.
- Add duplicate header detection and empty-column warnings.
- Add export modes for cleaned CSV, TSV and Markdown table.
- Status: planned.

## Phase 7: PDF Template Field Explorer

- Add field mapping notes and required/optional tagging.
- Add an exportable handover Markdown report.
- Warn for duplicate labels, unnamed fields and suspicious field types.
- Keep all PDF processing local with vendored assets.
- Status: planned.

## Phase 8: Text Utilities Polish Pack

- Add saved local examples and replacement preview to Regex Tester.
- Add whitespace and case-insensitive modes to Text diff.
- Add UUID version/variant filters and batch validation summary export.
- Status: planned.
