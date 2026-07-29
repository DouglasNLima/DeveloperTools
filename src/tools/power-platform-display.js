const GUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MERMAID_GUID_SOURCE = '[0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12}';
const EXACT_GUID = new RegExp(`^\\{?(?:${GUID_SOURCE}|${MERMAID_GUID_SOURCE})\\}?$`, 'i');
const ANY_GUID = new RegExp(`\\{?(?:${GUID_SOURCE}|${MERMAID_GUID_SOURCE})\\}?`, 'gi');

export function isPowerPlatformGuid(value) {
  return EXACT_GUID.test(String(value ?? '').trim());
}

export function formatPowerPlatformDisplayName(value, fallback = '') {
  const original = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (!original) {
    return fallback;
  }

  const withoutGuids = original
    .replace(ANY_GUID, ' ')
    .replace(/-{2,}/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*([\-–—:|])\s*(?:[\-–—:|]\s*)+/g, '$1')
    .replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim();

  return withoutGuids || fallback;
}
