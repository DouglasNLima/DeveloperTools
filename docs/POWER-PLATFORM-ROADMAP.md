# Power Platform Roadmap

This roadmap covers Power Platform tools beyond the first Power Pages mini-roadmap. Every tool remains static, local-first and browser-only. The app can help compose snippets, commands and review artefacts, but it must not connect to Dataverse, call a tenant API, authenticate a user or run Power Platform CLI commands.

## References

- [Use OData to query data with the Dataverse Web API](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api)
- [Power Platform CLI introduction](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction)
- [Power Platform CLI auth command group](https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/auth)
- [Power Platform CLI solution command group](https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/solution)
- [Power Platform CLI support for Power Pages](https://learn.microsoft.com/en-us/power-pages/configure/power-platform-cli)
- [Workflow expression functions for Azure Logic Apps and Power Automate](https://learn.microsoft.com/en-us/azure/logic-apps/expression-functions-reference)
- [Use expressions in conditions in Power Automate](https://learn.microsoft.com/en-us/power-automate/use-expressions-in-conditions)
- [Power Fx formula reference overview](https://learn.microsoft.com/en-us/power-platform/power-fx/formula-reference-cards)
- [Power Fx operators and identifiers](https://learn.microsoft.com/en-us/power-platform/power-fx/reference/operators)
- [Export cloud flows to solutions](https://learn.microsoft.com/en-us/power-automate/export-flow-solution)
- [Manage flows with code](https://learn.microsoft.com/en-us/power-automate/manage-flows-with-code)
- [SolutionPackager tool](https://learn.microsoft.com/en-us/power-platform/alm/solution-packager-tool)

## Phase 1: Dataverse OData Query Builder

- Build Dataverse Web API endpoints using EntitySetName and `/api/data/v9.2/...`.
- Build Power Pages Web API-style endpoints using `/_api/...`.
- Support `$select`, `$filter`, `$orderby`, `$expand`, `$top`, `$count`, formatted value annotations and max page size headers.
- Warn when queries retrieve too much data, use wildcard selects, include broad expansions or count records without limiting the result set.
- Include endpoint presets and guided `$expand` composition for common Dataverse and Power Pages query shapes.
- Generate a local Markdown report and a copyable `fetch` snippet.
- Status: implemented with advanced query mode, unit coverage and browser coverage.

## Phase 2: Power Platform CLI Command Builder

- Compose common `pac auth`, `pac solution` and `pac pages` commands.
- Cover authentication profile creation/listing, solution export/import/pack/unpack/check and Power Pages upload/download.
- Prefer `pac pages`; older `powerpages` and `paportal` aliases can appear in legacy documentation.
- Quote command arguments safely for paths and names with spaces.
- Include local checklists and risk warnings for managed exports, force overwrite imports, checker reports and active authentication context.
- Status: implemented with unit and browser coverage.

## Phase 3: Power Automate Expression Formatter

- Format Workflow Definition Language expressions used by cloud flows.
- Normalise leading `@` and `@{ }` wrappers for easier editing.
- Validate practical syntax balance for parentheses, brackets, braces and strings.
- Extract function names and common action/variable references.
- Warn when unknown function names appear.
- Status: implemented with unit and browser coverage.

## Phase 4: Power Fx Snippet Formatter

- Format Power Fx formulas into readable, indented snippets.
- Validate common delimiter and quoted identifier balance.
- Extract function names and report unknown names.
- Warn about `!`, semicolon chaining and `Patch(...)` snippets that should be checked for create/update intent.
- Status: implemented with unit and browser coverage.

## Phase 5: Power Platform Solution Mermaid Generator

- Read exported solution ZIP files locally in the browser.
- Detect cloud flows, business process flows, business rules and classic workflows from solution metadata and `Workflows/*.json` files.
- Generate semantic Mermaid diagrams with metadata fallback warnings when exported process detail is limited.
- Produce a Markdown inventory and hand selected diagrams to the Mermaid editor/exporter.
- Status: implemented with unit and browser coverage.

## Candidate Next Tools

- Dataverse FetchXML to OData helper.
- Environment variable and connection reference checklist.
- Solution settings file helper.
- Power Automate trigger condition builder.
- Power Fx delegation risk checklist.
- Power Pages deployment profile helper.
- ALM pull request checklist for solutions and sites.

## Delivery Rules

- Tools must produce local artefacts only: text, Markdown, snippets, checklists or downloadable files.
- Microsoft Learn links can appear in documentation, but app runtime must remain offline-capable.
- Unit tests must cover parsing, formatting, generation and warnings.
- Browser tests must cover menu discovery, successful output and at least one important validation or warning state.
