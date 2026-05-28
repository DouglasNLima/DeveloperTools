# AGENTS.md

## Project Mission

Developer Tools is a local-first suite of browser utilities for developers and technical users. It must stay compatible with GitHub Pages and must not depend on external runtime services.

## Non-Negotiables

- Use British English for all visible app copy, documentation, status messages and roadmap text.
- Keep the published app static: plain HTML, CSS and JavaScript are preferred.
- Do not add backend services, server-only runtime requirements, CDN dependencies or external API calls.
- Do not require a build step for GitHub Pages publication.
- Every implemented tool must include tests in the same change.

## Implementation Guidance

- Put reusable tool logic in a testable module under `src/tools/`.
- Put DOM wiring and browser-only behaviour in a neighbouring UI module.
- Add new tools to `src/tools/catalog.js` with `status: 'planned'` until they are implemented and tested.
- Keep planned tools visible as roadmap previews, but disabled in the app menu.
- Favour small, focused utilities over broad tools with unclear behaviour.

## Testing Requirements

- Use Node's built-in test runner for pure logic.
- Use Playwright for browser workflows.
- Cover successful usage, important validation errors and navigation state.
- Run `npm test` before considering a change complete.

## Documentation Requirements

- Update `README.md` when setup, scripts, structure or publishing changes.
- Update `docs/ROADMAP.md` when tool priorities or phases change.
- Keep docs concise and operational.
