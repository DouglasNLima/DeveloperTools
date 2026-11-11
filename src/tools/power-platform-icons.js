import { ICONS, ICON_LIBRARY_METADATA } from './power-platform-icons.data.js';
import { createStoredZipArchive } from './power-platform-solution.js';

export { ICONS, ICON_LIBRARY_METADATA };

export const ICON_EXPORT_SIZES = Object.freeze([16, 24, 32, 48, 64, 128, 256]);
export const ICON_PREVIEW_SIZES = Object.freeze([16, 24, 32, 48]);
export const DEFAULT_ICON_SETTINGS = Object.freeze({
  colourMode: 'theme',
  colour: '#096d68',
  exportSize: 32,
  strokeWidth: 2,
  opacity: 100,
  rotation: 0
});

const byId = new Map(ICONS.map(icon => [icon.id, icon]));
const normaliseSearch = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const searchIndex = new Map(ICONS.map(icon => [icon.id, normaliseSearch([
  icon.id, icon.displayName, icon.description, icon.category, ...icon.keywords
].join(' '))]));

export function getIconById(id) {
  const icon = byId.get(id);
  if (!icon) throw new Error('Choose an icon from the library.');
  return icon;
}

export function getIconCategories() {
  return [...new Set(ICONS.map(icon => icon.category))].sort((a, b) => a.localeCompare(b, 'en-GB'));
}

export function filterIcons({ search = '', category = '', collection = '' } = {}) {
  const terms = normaliseSearch(search).trim().split(/\s+/).filter(Boolean);
  return ICONS.filter(icon => (!category || icon.category === category)
    && (!collection || icon.collection === collection)
    && terms.every(term => searchIndex.get(icon.id).includes(term)));
}

export function normaliseIconColour(value) {
  let hex = String(value ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = [...hex].map(character => character.repeat(2)).join('');
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}

export function normaliseIconSettings(settings = {}) {
  const result = { ...DEFAULT_ICON_SETTINGS };
  for (const key of Object.keys(result)) {
    if (Object.hasOwn(settings, key)) result[key] = settings[key];
  }
  if (!['theme', 'fixed'].includes(result.colourMode)) throw new Error('Choose theme adaptive or fixed colour.');
  result.colour = normaliseIconColour(result.colour);
  if (!result.colour) throw new Error('Enter a hexadecimal colour such as #096d68 or #abc.');
  for (const key of ['exportSize', 'strokeWidth', 'opacity', 'rotation']) {
    const value = result[key];
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value))) {
      throw new Error('Choose valid numeric icon settings.');
    }
    result[key] = Number(value);
  }
  if (!ICON_EXPORT_SIZES.includes(result.exportSize)) throw new Error('Choose an SVG size from 16 to 256 px.');
  if (result.strokeWidth < 1 || result.strokeWidth > 4 || !Number.isInteger(result.strokeWidth * 4)) {
    throw new Error('Choose a stroke width from 1 to 4 units in quarter-unit steps.');
  }
  if (result.opacity < 25 || result.opacity > 100 || result.opacity % 5 !== 0) {
    throw new Error('Choose an opacity from 25% to 100% in five-percentage-point steps.');
  }
  if (![0, 90, 180, 270].includes(result.rotation)) throw new Error('Choose a rotation of 0, 90, 180 or 270 degrees.');
  return result;
}

export function isIconCustomised(settings = {}) {
  const value = normaliseIconSettings(settings);
  return value.colourMode === 'fixed' || value.exportSize !== 32 || value.strokeWidth !== 2
    || value.opacity !== 100 || value.rotation !== 0;
}

export function getIconFilename(id, settings = {}) {
  return `${getIconById(id).id}${isIconCustomised(settings) ? '-custom' : ''}.svg`;
}

export function buildIconSvg(id, settings = {}) {
  const icon = getIconById(id);
  const value = normaliseIconSettings(settings);
  // Preserve every canonical byte, including the trailing newline, at the original settings.
  if (!isIconCustomised(value)) return icon.svg;
  let svg = icon.svg
    .replace('width="32" height="32"', `width="${value.exportSize}" height="${value.exportSize}"`)
    .replace('stroke-width="2"', `stroke-width="${value.strokeWidth}"`);
  if (value.colourMode === 'fixed') svg = svg.replaceAll('currentColor', value.colour);
  if (value.opacity !== 100) svg = svg.replace('<svg ', `<svg opacity="${value.opacity / 100}" `);
  // Match the supplied HTML: extra space protects thicker strokes at every supported rotation.
  const padding = Math.max(0, (value.strokeWidth - 2) / 2);
  if (padding) svg = svg.replace('viewBox="0 0 32 32"', `viewBox="${-padding} ${-padding} ${32 + 2 * padding} ${32 + 2 * padding}"`);
  if (value.rotation) svg = svg.replace('>', `><g transform="rotate(${value.rotation} 16 16)">`).replace('</svg>', '</g></svg>');
  return svg;
}

export function buildIconZip(settings = {}) {
  const value = normaliseIconSettings(settings);
  const encoder = new TextEncoder();
  const entries = ICONS.map(icon => ({ name: `library/${icon.id}.svg`, bytes: encoder.encode(buildIconSvg(icon.id, value)) }));
  const manifest = {
    library: ICON_LIBRARY_METADATA.libraryName,
    libraryVersion: ICON_LIBRARY_METADATA.libraryVersion,
    iconCount: ICONS.length,
    settings: value,
    background: 'transparent',
    scope: 'All icons; catalogue filters do not restrict this export.'
  };
  const readme = `${ICON_LIBRARY_METADATA.libraryName}\n\n${ICONS.length} SVG icons with the settings recorded in customisation.json.\n`
    + `SVG dimensions: ${value.exportSize} × ${value.exportSize} px.\n`
    + `Colour: ${value.colourMode === 'fixed' ? value.colour : 'theme adaptive (currentColor)'}.\n`
    + `Stroke width: ${value.strokeWidth} units; opacity: ${value.opacity}%; rotation: ${value.rotation} degrees clockwise.\n`
    + 'The background is transparent. Additional space is reserved for thicker strokes.\n\n'
    + 'The library folder includes every icon, regardless of catalogue filters.\n'
    + 'Download original in Developer Tools provides the canonical source asset.\n';
  entries.push({ name: 'customisation.json', bytes: encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`) });
  entries.push({ name: 'README.txt', bytes: encoder.encode(readme) });
  return createStoredZipArchive(entries);
}
