export const APP_PHILOSOPHY = [
  {
    title: 'Local-first',
    summary: 'Tools run in your browser against text and files you provide.'
  },
  {
    title: 'Static by design',
    summary: 'The published app is plain HTML, CSS and JavaScript, with no backend, CDN or external API calls.'
  },
  {
    title: 'Transparent dependencies',
    summary: 'External libraries are listed with their purpose, where they are used and whether they load in the published app.'
  }
];

export const TRANSPARENCY_LIBRARY_ENTRIES = [
  {
    name: 'PDF.js',
    website: 'https://mozilla.github.io/pdf.js/',
    scope: 'Runtime',
    usage: 'Renders local PDF pages and reads field annotations.',
    usedBy: ['PDF Template Field Explorer'],
    loadedByPublishedApp: true,
    note: 'Bundled locally under src/vendor/pdfjs; no CDN request is made.'
  },
  {
    name: 'Playwright',
    website: 'https://playwright.dev/',
    scope: 'Testing only',
    usage: 'Runs browser workflow tests for navigation, offline support and tool behaviour.',
    usedBy: ['Browser test suite'],
    loadedByPublishedApp: false,
    note: 'Development tooling only; not loaded by the published app.'
  },
  {
    name: 'pdf-lib',
    website: 'https://pdf-lib.js.org/',
    scope: 'Testing only',
    usage: 'Creates fillable PDF fixtures for PDF tool tests.',
    usedBy: ['PDF Template Field Explorer tests'],
    loadedByPublishedApp: false,
    note: 'Development tooling only; not loaded by the published app.'
  },
  {
    name: 'Node.js test runner',
    website: 'https://nodejs.org/api/test.html',
    scope: 'Testing only',
    usage: 'Runs unit tests for reusable tool logic.',
    usedBy: ['Unit test suite'],
    loadedByPublishedApp: false,
    note: 'Development tooling only; not loaded by the published app.'
  }
];
