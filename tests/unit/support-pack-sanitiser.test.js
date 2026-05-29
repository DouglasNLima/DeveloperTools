import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findSensitiveValues,
  sanitiseSupportPack
} from '../../src/tools/support-pack-sanitiser.js';

test('sanitises sensitive support pack values with stable placeholders', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature12345';
  const result = sanitiseSupportPack([
    'Email admin@example.com repeated admin@example.com',
    `JWT ${jwt}`,
    'Correlation 11111111-2222-3333-4444-555555555555',
    'Connection Server=db.internal;Database=main;User Id=app;Password=pass123',
    'Stripe cus_1234567890 and sub_abcdefghi',
    'tenantId: contoso-tenant',
    'environmentName: prod-west',
    'Authorization: Bearer plainAccessToken12345',
    'token=plainAccessToken12345',
    'Internal URL https://api.internal.local/private',
    'Local paths C:\\Users\\dougl\\AppData\\trace.log and /home/dougl/project/.env'
  ].join('\n'));

  assert.match(result.output, /## Sanitised Support Pack/);
  assert.match(result.output, /### Detected Sensitive Values/);
  assert.match(result.output, /### Sanitised Payload/);
  assert.equal(countOccurrences(result.sanitisedPayload, '[EMAIL_1]'), 2);
  assert.equal(countOccurrences(result.sanitisedPayload, '[TOKEN_1]'), 2);
  assert.doesNotMatch(result.sanitisedPayload, /admin@example\.com/);
  assert.doesNotMatch(result.sanitisedPayload, /plainAccessToken12345/);
  assert.match(result.sanitisedPayload, /\[CONNECTION_STRING_1\]/);
  assert.match(result.sanitisedPayload, /\[JWT_1\]/);
  assert.match(result.sanitisedPayload, /\[GUID_1\]/);
  assert.match(result.sanitisedPayload, /\[STRIPE_ID_1\]/);
  assert.match(result.sanitisedPayload, /\[STRIPE_ID_2\]/);
  assert.match(result.sanitisedPayload, /\[TENANT_ID_1\]/);
  assert.match(result.sanitisedPayload, /\[ENVIRONMENT_NAME_1\]/);
  assert.match(result.sanitisedPayload, /\[INTERNAL_URL_1\]/);
  assert.match(result.sanitisedPayload, /\[LOCAL_PATH_1\]/);
  assert.match(result.sanitisedPayload, /\[LOCAL_PATH_2\]/);
  assert.equal(result.totalDetected, 14);
});

test('does not mask public URLs as internal URLs', () => {
  const result = sanitiseSupportPack('Public docs live at https://docs.example.com/page and support@example.com is masked.');

  assert.match(result.sanitisedPayload, /https:\/\/docs\.example\.com\/page/);
  assert.match(result.sanitisedPayload, /\[EMAIL_1\]/);
  assert.equal(findSensitiveValues('https://docs.example.com/page').length, 0);
});

test('reports empty sanitiser input', () => {
  assert.throws(() => sanitiseSupportPack('   '), /Enter support pack content to sanitise/);
});

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}
