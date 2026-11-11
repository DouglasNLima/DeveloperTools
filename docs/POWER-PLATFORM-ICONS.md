# Power Platform Icon Library

Open **Power Platform Icon Library** in the Power Platform category, or use `#power-platform-icon-library`.

## Browse and customise

- Search names, purposes and keywords. Category and collection filters combine with the search; `/` focuses search outside text fields.
- The library contains 301 reusable icons in 26 categories: 49 original and 252 new designs, retaining the supplied collection labels.
- Inspect an icon for its description, visual metaphor, keywords, SVG source and 16/24/32/48 px previews on light and dark backgrounds.
- Set theme-adaptive (`currentColor`) or fixed hexadecimal colour, SVG size (16/24/32/48/64/128/256 px), stroke width (1–4 in quarter-unit steps), opacity (25–100% in five-percentage-point steps) and rotation (0/90/180/270°).
- Catalogue and inspector controls share the same settings. Preview size affects only the grid. Canvas theme does not modify downloaded artwork.
- Invalid colours show an error and disable customised exports until corrected or reset. Reset filters and Reset customisation are independent.
- Settings last while the tool is open; leaving or reloading starts with the original style.

## Local outputs

- **Download SVG** preserves the original bytes with default settings. Customised files use an `-custom.svg` suffix. **Download original** remains available after customisation.
- **Copy SVG** copies export markup, without preview-only accessibility attributes. **Copy filename** copies the matching export name.
- **Download all 301 icons (ZIP)** always includes the entire collection, regardless of filters. It contains `library/<id>.svg`, `customisation.json` and `README.txt`. ZIP entries retain their semantic filenames even when customised.
- Backgrounds remain transparent. Fixed colours also replace solid accents; extra viewBox space prevents thicker strokes from being clipped.
- All processing uses bundled JavaScript and SVG data. No uploads, external runtime requests, additional dependencies or publication build steps are required. The service worker precaches the complete library for use after the app's first online load.

For model-driven apps, add the downloaded SVG as an image web resource in the project's solution, then select it for the relevant custom table or app. Microsoft documents the supported icon types, dimensions and `currentColor` guidance in [Change model-driven app custom table icons](https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/change-custom-entity-icons) (checked 11 November 2026). Review the result in the consuming app; inline SVG and external image elements handle inherited colours differently. The library does not connect to or deploy to Dataverse.

## Source and maintenance

Source: the user-supplied `te.zip`, specifically `te/outputs/consulting-icon-library/`, version 1.2.0. The metadata and SVG artwork are embedded in `src/tools/power-platform-icons.data.js`. Every imported SVG was checked against the supplied byte size and SHA-256 hash. The source guide describes the artwork as original vector geometry; this integration does not add third-party artwork or assert an additional licence.

The package contains 301 reusable SVGs. The 32 dedicated SPC table icons mentioned in its guide are not present in this portable collection and are not counted here. Source HTML scripts and guide instructions are reference material; the integrated implementation uses the Developer Tools module structure and shared local ZIP writer.

Reusable filtering, validation, SVG transformation and ZIP export live in `src/tools/power-platform-icons.js`; browser controls live in the neighbouring `.ui.js` module. To add artwork, use a unique semantic ID, British English metadata and safe path/circle/rectangle geometry on the 32-unit grid. Update the canonical byte size, SHA-256, collection counts, relevant copy and tests together. Keep the original source bytes for existing icons.

Run `npm test`. Coverage includes every canonical hash, parameter bounds, clipping padding, solid accents, original/customised ZIP contents, browser downloads, invalid colours, clipboard success/failure, navigation, narrow layouts and first-use offline access.

## Proposals for review

- Save named style presets and favourite icons locally.
- Select a subset of icons for a project ZIP.
- Generate an encoded SVG expression for Canvas Apps image controls.
- Extend the same visual family with Power Platform concepts such as environment variables, connection references and solution layers after reviewing gaps and designs.

These proposals are not included in the current implementation.
