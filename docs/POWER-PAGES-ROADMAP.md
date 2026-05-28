# Power Pages Roadmap

This mini-roadmap focuses on Power Pages work that can be supported locally in the browser. The app must not connect to a Power Platform tenant, Dataverse environment or authenticated Microsoft service.

## References

- [Power Pages Liquid template tags](https://learn.microsoft.com/en-us/power-pages/configure/liquid/template-tags)
- [Power Pages Web API overview](https://learn.microsoft.com/en-us/power-pages/configure/web-api-overview)
- [Configure site settings](https://learn.microsoft.com/en-us/power-pages/configure/configure-site-settings)
- [Configure table permissions](https://learn.microsoft.com/en-us/power-pages/security/table-permissions)
- [Create web roles](https://learn.microsoft.com/en-us/power-pages/security/create-web-roles)

## Phase 1: FetchXML Formatter & Liquid Builder

- Format common FetchXML with predictable indentation.
- Check for empty input, a missing `<fetch>` root and unbalanced tags.
- Warn when self-closing tags are present, because Power Pages Liquid FetchXML is safer with explicit closing tags.
- Generate a `{% fetchxml variableName %}` block and matching `{% endfetchxml %}` tag.
- Keep the output copyable and downloadable for quick use in web templates.

## Phase 2: Power Pages Web API Snippet Generator

- Generate local JavaScript request snippets for common `/_api/...` operations.
- Include reminders for table-specific site settings and field allow-lists.
- Provide safe placeholders for table names, columns, IDs and payloads.
- Avoid live calls, token handling or environment-specific requests.

## Phase 3: Site Settings Helper

- Build checklists for Web API enablement, authentication, caching and content configuration.
- Group settings by feature area and risk.
- Provide copyable setting names and expected value shapes.
- Keep values user-entered and local only.

## Phase 4: Table Permissions Checklist

- Help review table, operation, web role, scope and relationship choices.
- Highlight common exposure risks such as anonymous access and overly broad global scope.
- Generate a local review summary for pull requests or deployment notes.
- Avoid claiming to validate live Dataverse permissions.

## Delivery Rules

- Each implemented Power Pages tool needs unit tests for pure logic and Playwright tests for UI flows.
- Planned tools can appear in the menu as disabled roadmap previews.
- Documentation should link to Microsoft Learn for platform-specific behaviour, while the app remains offline and local-first.
