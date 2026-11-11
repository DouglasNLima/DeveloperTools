import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  ICONS, ICON_LIBRARY_METADATA, DEFAULT_ICON_SETTINGS,
  buildIconSvg, buildIconZip, filterIcons, getIconById, getIconCategories,
  getIconFilename, isIconCustomised, normaliseIconColour, normaliseIconSettings
} from '../../src/tools/power-platform-icons.js';
import { readZipArchive } from '../../src/tools/power-platform-solution.js';

test('imports all 301 canonical icons with their source hashes, safe geometry and metadata', () => {
  assert.equal(ICONS.length, 301);
  assert.equal(new Set(ICONS.map(icon => icon.id)).size, 301);
  assert.equal(getIconCategories().length, 26);
  assert.equal(ICON_LIBRARY_METADATA.libraryVersion, '1.2.0');
  assert.equal(filterIcons({ collection: 'original' }).length, 49);
  assert.equal(filterIcons({ collection: 'new' }).length, 252);
  for (const icon of ICONS) {
    assert.match(icon.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(Buffer.byteLength(icon.svg), icon.fileSizeBytes, icon.id);
    assert.equal(createHash('sha256').update(icon.svg).digest('hex'), icon.sha256, icon.id);
    assert.match(icon.svg, /width="32" height="32" viewBox="0 0 32 32"/);
    assert.match(icon.svg, /stroke-width="2"/);
    assert.doesNotMatch(icon.svg, /<\s*(?:script|style|foreignObject|image|use|a)\b|\bon\w+\s*=|\bhref\s*=|url\s*\(|<!/i);
    const tags = [...icon.svg.matchAll(/<\/?([a-zA-Z][\w:-]*)\b/g)].map(match => match[1]);
    assert.ok(tags.every(tag => ['svg', 'path', 'circle', 'rect'].includes(tag)), icon.id);
    assert.ok(icon.displayName && icon.description && icon.visualMetaphor && icon.keywords.length, icon.id);
  }
});

test('searches names, purposes, keywords and categories with combined case-insensitive terms', () => {
  assert.equal(filterIcons().length, 301);
  assert.deepEqual(filterIcons({ search: '  ÍNVOICE  ' }), filterIcons({ search: 'invoice' }));
  assert.ok(filterIcons({ search: 'invoice' }).some(icon => icon.id === 'invoice'));
  const matches = filterIcons({ search: 'invoice', category: 'Finance and billing', collection: 'new' });
  assert.ok(matches.some(icon => icon.id === 'invoice'));
  assert.ok(matches.every(icon => icon.category === 'Finance and billing' && icon.collection === 'new'));
  assert.deepEqual(filterIcons({ search: 'invoice non-existent-term' }), []);
  assert.deepEqual(filterIcons({ category: 'Not a category' }), []);
  assert.deepEqual(filterIcons({ search: 'invoice', collection: 'original' }), []);
});

test('keeps default SVG bytes and filenames unchanged, including an unused fixed colour', () => {
  for (const icon of ICONS) {
    assert.equal(buildIconSvg(icon.id), icon.svg);
    assert.equal(buildIconSvg(icon.id, { colour: '#ffffff' }), icon.svg);
    assert.equal(getIconFilename(icon.id), `${icon.id}.svg`);
  }
  assert.equal(isIconCustomised(), false);
  assert.equal(isIconCustomised({ colourMode: 'fixed' }), true);
  assert.equal(getIconFilename('workflow', { exportSize: 64 }), 'workflow-custom.svg');
});

test('normalises hexadecimal colours and numeric control values', () => {
  assert.equal(normaliseIconColour(' AbC '), '#aabbcc');
  assert.equal(normaliseIconColour('#09ABcd'), '#09abcd');
  assert.equal(normaliseIconColour('blue'), null);
  assert.equal(normaliseIconColour('#ffffffff'), null);
  assert.deepEqual(normaliseIconSettings({ exportSize: '64', strokeWidth: '2.25', opacity: '75', rotation: '90', colour: 'ABC' }), {
    ...DEFAULT_ICON_SETTINGS, exportSize: 64, strokeWidth: 2.25, opacity: 75, rotation: 90, colour: '#aabbcc'
  });
});

test('applies colour to strokes and solid accents, dimensions, opacity, rotation and clipping padding', () => {
  const icon = ICONS.find(candidate => candidate.svg.includes('fill="currentColor"'));
  assert.ok(icon, 'The original family includes solid accents.');
  const svg = buildIconSvg(icon.id, { colourMode: 'fixed', colour: '#f80', exportSize: 128, strokeWidth: 3.5, opacity: 65, rotation: 270 });
  assert.match(svg, /width="128" height="128"/);
  assert.match(svg, /stroke="#ff8800"/);
  assert.match(svg, /fill="#ff8800"/);
  assert.match(svg, /stroke-width="3.5"/);
  assert.match(svg, /opacity="0.65"/);
  assert.match(svg, /viewBox="-0.75 -0.75 33.5 33.5"/);
  assert.match(svg, /<g transform="rotate\(270 16 16\)">/);
  assert.doesNotMatch(svg, /currentColor/);
  assert.equal(buildIconSvg(icon.id), icon.svg, 'Customisation does not mutate the original.');
});

test('preserves theme colour and reserves bounds for every icon at maximum stroke in all rotations', () => {
  for (const icon of ICONS) {
    for (const rotation of [0, 90, 180, 270]) {
      const svg = buildIconSvg(icon.id, { strokeWidth: 4, exportSize: 256, opacity: 25, rotation });
      assert.match(svg, /stroke="currentColor"/);
      assert.match(svg, /stroke-width="4"/);
      assert.match(svg, /width="256" height="256"/);
      assert.match(svg, /viewBox="-1 -1 34 34"/);
      assert.match(svg, /opacity="0.25"/);
      assert.equal(svg.includes('<g transform='), rotation !== 0);
    }
  }
  assert.match(buildIconSvg('workflow', { strokeWidth: 1 }), /viewBox="0 0 32 32"/);
});

test('rejects unsupported settings and markup injection before generating an output', () => {
  const invalidSettings = [
    { colourMode: 'external' }, { colour: 'red' }, { colour: '#123456" onload="alert(1)' },
    { exportSize: 0 }, { exportSize: 512 }, { exportSize: '' }, { exportSize: true },
    { strokeWidth: 0.5 }, { strokeWidth: 5 }, { strokeWidth: 2.1 }, { strokeWidth: NaN },
    { opacity: 0 }, { opacity: 101 }, { opacity: 26 }, { opacity: Infinity },
    { rotation: 45 }, { rotation: -90 }, { rotation: null }
  ];
  for (const settings of invalidSettings) {
    assert.throws(() => buildIconSvg('workflow', settings), Error);
    assert.throws(() => buildIconZip(settings), Error);
  }
  assert.throws(() => getIconById('../../outside'), /Choose an icon/);
  assert.throws(() => buildIconSvg('not-an-icon'), /Choose an icon/);
});

test('exports the complete original collection with byte-identical files and a settings record', async () => {
  const archive = await readZipArchive(buildIconZip());
  assert.equal(archive.entries.length, 303);
  for (const icon of ICONS) {
    const bytes = await archive.readBytes(`library/${icon.id}.svg`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), icon.sha256, icon.id);
  }
  const manifest = JSON.parse(await archive.readText('customisation.json'));
  assert.equal(manifest.iconCount, 301);
  assert.deepEqual(manifest.settings, DEFAULT_ICON_SETTINGS);
  assert.equal(manifest.background, 'transparent');
  assert.match(manifest.scope, /filters do not restrict/);
  assert.match(await archive.readText('README.txt'), /Colour: theme adaptive/);
});

test('exports consistent customised settings across all SVG entries without changing semantic ZIP paths', async () => {
  const archive = await readZipArchive(buildIconZip({ colourMode: 'fixed', colour: '#123456', exportSize: 48, strokeWidth: 1.25, opacity: 80, rotation: 180 }));
  for (const icon of ICONS) {
    const svg = await archive.readText(`library/${icon.id}.svg`);
    assert.match(svg, /width="48" height="48"/);
    assert.match(svg, /stroke="#123456"/);
    assert.match(svg, /stroke-width="1.25"/);
    assert.match(svg, /opacity="0.8"/);
    assert.match(svg, /rotate\(180 16 16\)/);
    assert.doesNotMatch(svg, /currentColor/);
  }
  const manifest = JSON.parse(await archive.readText('customisation.json'));
  assert.equal(manifest.settings.exportSize, 48);
  assert.equal(manifest.settings.colour, '#123456');
});

test('includes icon data and modules in the offline app cache', async () => {
  const source = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  for (const path of ['power-platform-icons.data.js', 'power-platform-icons.js', 'power-platform-icons.ui.js']) {
    assert.ok(source.includes(`'./src/tools/${path}'`), path);
  }
});
