import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJwtExport,
  decodeBase64UrlSegment,
  decodeJwt,
  inspectJwtTiming,
  normaliseClaimList
} from '../../src/tools/jwt-decoder.js';

test('decodes JWT header, payload and common claims', () => {
  const token = makeJwt({
    iss: 'https://issuer.example',
    sub: 'user-123',
    aud: ['api://primary', 'api://secondary'],
    exp: 1893456000,
    iat: 1735689600,
    scp: 'read write',
    roles: ['Admin', 'Maker']
  });
  const result = decodeJwt(`Bearer ${token}`, { now: '2026-01-01T00:00:00.000Z' });

  assert.equal(result.header.alg, 'HS256');
  assert.equal(result.payload.sub, 'user-123');
  assert.equal(result.timing.status, 'valid');
  assert.equal(result.timing.expiresAtIso, '2030-01-01T00:00:00.000Z');
  assert.deepEqual(result.claims.audience, ['api://primary', 'api://secondary']);
  assert.deepEqual(result.claims.scopes, ['read', 'write']);
  assert.deepEqual(result.claims.roles, ['Admin', 'Maker']);
  assert.match(result.warnings.join('\n'), /Bearer prefix removed/);
  assert.match(result.warnings.join('\n'), /signature verification is not performed/);
  assert.match(result.exportJson, /"verification"/);
});

test('reports expired, not-yet-valid and missing expiry states', () => {
  const expired = decodeJwt(makeJwt({ exp: 1704067200 }), { now: '2026-01-01T00:00:00.000Z' });
  const future = decodeJwt(makeJwt({ nbf: 1893456000, exp: 1924992000 }), { now: '2026-01-01T00:00:00.000Z' });
  const missing = decodeJwt(makeJwt({ sub: 'no-dates' }), { now: '2026-01-01T00:00:00.000Z' });

  assert.equal(expired.timing.status, 'expired');
  assert.match(expired.warnings.join('\n'), /expired/);
  assert.equal(future.timing.status, 'not-yet-valid');
  assert.match(future.warnings.join('\n'), /not valid yet/);
  assert.equal(missing.timing.status, 'missing-dates');
  assert.match(missing.warnings.join('\n'), /expiry cannot be assessed/);
});

test('normalises claim lists and timestamp inspection', () => {
  assert.deepEqual(normaliseClaimList('alpha beta,gamma'), ['alpha', 'beta', 'gamma']);
  assert.deepEqual(normaliseClaimList([' alpha ', 42]), ['alpha', '42']);

  const timing = inspectJwtTiming(
    {
      exp: 'not-a-date',
      iat: 1735689600
    },
    { now: '2026-01-01T00:00:00.000Z' }
  );

  assert.equal(timing.status, 'missing-dates');
  assert.equal(timing.issuedAtIso, '2025-01-01T00:00:00.000Z');
  assert.match(timing.warnings.join('\n'), /exp claim is not a numeric timestamp/);
});

test('reports invalid JWT structure and unsupported encrypted tokens', () => {
  assert.throws(() => decodeJwt(''), /Enter a JWT/);
  assert.throws(() => decodeJwt('only.two'), /header, payload and signature/);
  assert.throws(() => decodeJwt('a.b.c.d.e'), /encrypted JWE token/);
});

test('reports invalid Base64URL and JSON sections', () => {
  const validPayload = encodeJson({ sub: 'user-123' });
  const invalidJsonHeader = encodeText('not json');

  assert.throws(() => decodeBase64UrlSegment('x', 'JWT header'), /not valid Base64URL/);
  assert.throws(() => decodeJwt(`x.${validPayload}.sig`), /JWT header is not valid Base64URL/);
  assert.throws(() => decodeJwt(`${invalidJsonHeader}.${validPayload}.sig`), /JWT header must be valid JSON/);
  assert.throws(() => decodeJwt(`${encodeJson({ alg: 'HS256' })}.${encodeText('[]')}.sig`), /JWT payload must be a JSON object/);
});

test('emits warnings for alg none and empty signatures', () => {
  const result = decodeJwt(`${encodeJson({ alg: 'none', typ: 'JWT' })}.${encodeJson({ exp: 1893456000 })}.`, {
    now: '2026-01-01T00:00:00.000Z'
  });
  const exportJson = buildJwtExport(result);

  assert.equal(result.signature.present, false);
  assert.match(result.warnings.join('\n'), /signature section is empty/);
  assert.match(result.warnings.join('\n'), /alg none/);
  assert.match(exportJson, /"present": false/);
});

function makeJwt(payload, header = { alg: 'HS256', typ: 'JWT' }, signature = 'signature') {
  return `${encodeJson(header)}.${encodeJson(payload)}.${encodeText(signature)}`;
}

function encodeJson(value) {
  return encodeText(JSON.stringify(value));
}

function encodeText(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}
