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

test('keeps meaningful names and replaces GUID-only labels with a fallback', () => {
  assert.equal(formatPowerPlatformDisplayName('Account approval'), 'Account approval');
  assert.equal(
    formatPowerPlatformDisplayName('643ea8ee-9c35-4fd7-909c-facf7fb68428', 'Cloud flow'),
    'Cloud flow'
  );
  assert.equal(formatPowerPlatformDisplayName('', 'Cloud flow'), 'Cloud flow');
  assert.equal(isPowerPlatformGuid('{643ea8ee-9c35-4fd7-909c-facf7fb68428}'), true);
  assert.equal(isPowerPlatformGuid('Account approval'), false);
});

test('removes GUIDs embedded inside Power Platform labels', () => {
  assert.equal(
    formatPowerPlatformDisplayName('Parent-643ea8ee-9c35-4fd7-909c-facf7fb68428-Child', 'Step'),
    'Parent-Child'
  );
  assert.equal(
    formatPowerPlatformDisplayName('component_643ea8ee_9c35_4fd7_909c_facf7fb68428', 'Step'),
    'component'
  );
  assert.equal(isPowerPlatformGuid('643ea8ee_9c35_4fd7_909c_facf7fb68428'), true);
});
