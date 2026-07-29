import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatPowerPlatformDisplayName,
  isPowerPlatformGuid
} from '../../src/tools/power-platform-display.js';

test('removes exported GUID suffixes and step prefixes from display labels', () => {
  assert.equal(
    formatPowerPlatformDisplayName('QA-Helical-SimulateSampleLabStatus-B2E4F3FA-6E87-F111-AB0F-7C1E524E2B9E'),
    'QA-Helical-SimulateSampleLabStatus'
  );
  assert.equal(
    formatPowerPlatformDisplayName('643ea8ee-9c35-4fd7-909c-facf7fb68428 - Request'),
    'Request'
  );
  assert.equal(
    formatPowerPlatformDisplayName('{643ea8ee-9c35-4fd7-909c-facf7fb68428}: Compose'),
    'Compose'
  );
});

test('keeps meaningful names and GUID-only identities intact', () => {
  assert.equal(formatPowerPlatformDisplayName('Account approval'), 'Account approval');
  assert.equal(
    formatPowerPlatformDisplayName('643ea8ee-9c35-4fd7-909c-facf7fb68428'),
    '643ea8ee-9c35-4fd7-909c-facf7fb68428'
  );
  assert.equal(formatPowerPlatformDisplayName('', 'Cloud flow'), 'Cloud flow');
  assert.equal(isPowerPlatformGuid('{643ea8ee-9c35-4fd7-909c-facf7fb68428}'), true);
  assert.equal(isPowerPlatformGuid('Account approval'), false);
});
