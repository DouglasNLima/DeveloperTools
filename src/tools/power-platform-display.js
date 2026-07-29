const GUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const EXACT_GUID = new RegExp(`^\\{?${GUID_SOURCE}\\}?$`, 'i');
const LEADING_GUID = new RegExp(`^\\{?${GUID_SOURCE}\\}?\\s*(?:[-–—:|]\\s*)?`, 'i');
const TRAILING_GUID = new RegExp(`\\s*(?:[-–—:|]\\s*)?\\{?${GUID_SOURCE}\\}?$`, 'i');

export function isPowerPlatformGuid(value) {
  return EXACT_GUID.test(String(value ?? '').trim());
}

export function formatPowerPlatformDisplayName(value, fallback = '') {
  const original = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (!original) {
    return fallback;
  }

  const withoutLeadingGuid = original.replace(LEADING_GUID, '').trim();
  const withoutTrailingGuid = withoutLeadingGuid.replace(TRAILING_GUID, '').trim();

  return withoutTrailingGuid || original;
}
