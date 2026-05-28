const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;
const SECURITY_NOTICE = 'Decode only: signature verification is not performed locally.';

export function decodeJwt(value, options = {}) {
  const input = String(value || '').trim();

  if (!input) {
    throw new Error('Enter a JWT to decode.');
  }

  const normalised = normaliseJwtInput(input);
  const parts = normalised.token.split('.');

  if (parts.length === 5) {
    throw new Error('This looks like an encrypted JWE token; this decoder supports signed JWTs with three sections.');
  }

  if (parts.length !== 3) {
    throw new Error('JWTs must contain header, payload and signature sections.');
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = parseJsonSegment(headerSegment, 'JWT header');
  const payload = parseJsonSegment(payloadSegment, 'JWT payload');
  const warnings = [...normalised.warnings, SECURITY_NOTICE];

  if (!signatureSegment) {
    warnings.push('The signature section is empty.');
  } else if (!BASE64URL_PATTERN.test(signatureSegment)) {
    warnings.push('The signature section contains characters outside Base64URL.');
  }

  if (String(header.alg || '').toLowerCase() === 'none') {
    warnings.push('The token header uses alg none; do not treat this token as trusted.');
  }

  const timing = inspectJwtTiming(payload, options);
  const claims = buildClaimSummary(payload);

  warnings.push(...timing.warnings);

  const result = {
    header,
    payload,
    headerJson: JSON.stringify(header, null, 2),
    payloadJson: JSON.stringify(payload, null, 2),
    claims,
    timing,
    signature: {
      present: Boolean(signatureSegment),
      length: signatureSegment.length
    },
    warnings,
    decodedAtIso: normaliseNow(options.now).toISOString()
  };

  return {
    ...result,
    exportJson: buildJwtExport(result)
  };
}

export function decodeBase64UrlSegment(segment, label = 'JWT section') {
  const value = String(segment || '');

  if (!value) {
    throw new Error(`${label} is empty.`);
  }

  if (!BASE64URL_PATTERN.test(value) || value.length % 4 === 1) {
    throw new Error(`${label} is not valid Base64URL.`);
  }

  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');

  try {
    const bytes = base64ToBytes(base64);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid Base64URL.`);
  }
}

export function inspectJwtTiming(payload, options = {}) {
  const now = normaliseNow(options.now);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const exp = readNumericDate(payload.exp);
  const nbf = readNumericDate(payload.nbf);
  const iat = readNumericDate(payload.iat);
  const warnings = [];

  addInvalidTimestampWarning(warnings, 'exp', exp);
  addInvalidTimestampWarning(warnings, 'nbf', nbf);
  addInvalidTimestampWarning(warnings, 'iat', iat);

  let status = 'missing-dates';
  let label = 'Expiry unknown';

  if (nbf.valid && nowSeconds < nbf.value) {
    status = 'not-yet-valid';
    label = 'Not valid yet';
    warnings.push('The token is not valid yet.');
  } else if (exp.valid && nowSeconds >= exp.value) {
    status = 'expired';
    label = 'Expired';
    warnings.push('The token is expired.');
  } else if (exp.valid) {
    status = 'valid';
    label = 'Valid by time claims';
  } else {
    warnings.push('No exp claim found; expiry cannot be assessed.');
  }

  return {
    status,
    label,
    nowIso: now.toISOString(),
    issuedAtIso: iat.valid ? toIsoDate(iat.value) : null,
    notBeforeIso: nbf.valid ? toIsoDate(nbf.value) : null,
    expiresAtIso: exp.valid ? toIsoDate(exp.value) : null,
    issuedAtLabel: iat.valid ? formatNumericDate(iat.value) : '-',
    notBeforeLabel: nbf.valid ? formatNumericDate(nbf.value) : '-',
    expiresAtLabel: exp.valid ? formatNumericDate(exp.value) : '-',
    warnings
  };
}

export function buildClaimSummary(payload) {
  const audience = normaliseClaimList(payload.aud);
  const scopes = normaliseClaimList(payload.scp ?? payload.scope);
  const roles = normaliseClaimList(payload.roles ?? payload.role);

  return {
    issuer: formatClaimValue(payload.iss),
    subject: formatClaimValue(payload.sub),
    audience,
    audienceLabel: formatListLabel(audience),
    scopes,
    scopesLabel: formatListLabel(scopes),
    roles,
    rolesLabel: formatListLabel(roles),
    jwtId: formatClaimValue(payload.jti)
  };
}

export function normaliseClaimList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [String(value)];
}

export function buildJwtExport(result) {
  return JSON.stringify({
    decodedAt: result.decodedAtIso,
    verification: SECURITY_NOTICE,
    timing: {
      status: result.timing.status,
      label: result.timing.label,
      now: result.timing.nowIso,
      issuedAt: result.timing.issuedAtIso,
      notBefore: result.timing.notBeforeIso,
      expiresAt: result.timing.expiresAtIso
    },
    claims: result.claims,
    header: result.header,
    payload: result.payload,
    signature: result.signature,
    warnings: result.warnings
  }, null, 2);
}

export function formatNumericDate(seconds) {
  return `${new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
    hour12: false
  }).format(new Date(seconds * 1000))} UTC`;
}

function normaliseJwtInput(input) {
  if (/^Bearer\s+/i.test(input)) {
    return {
      token: input.replace(/^Bearer\s+/i, '').trim(),
      warnings: ['Bearer prefix removed before decoding.']
    };
  }

  return {
    token: input,
    warnings: []
  };
}

function parseJsonSegment(segment, label) {
  const text = decodeBase64UrlSegment(segment, label);

  try {
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object.`);
    }

    return parsed;
  } catch (error) {
    if (error.message === `${label} must be a JSON object.`) {
      throw error;
    }

    throw new Error(`${label} must be valid JSON.`);
  }
}

function base64ToBytes(base64) {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

function readNumericDate(value) {
  if (value === undefined || value === null || value === '') {
    return {
      present: false,
      valid: false,
      value: null
    };
  }

  const number = typeof value === 'string' ? Number(value) : value;

  return {
    present: true,
    valid: Number.isFinite(number),
    value: Number.isFinite(number) ? Math.trunc(number) : null
  };
}

function addInvalidTimestampWarning(warnings, claimName, result) {
  if (result.present && !result.valid) {
    warnings.push(`${claimName} claim is not a numeric timestamp.`);
  }
}

function normaliseNow(value) {
  if (!value) {
    return new Date();
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Current time must be a valid date.');
  }

  return date;
}

function toIsoDate(seconds) {
  return new Date(seconds * 1000).toISOString();
}

function formatClaimValue(value) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatListLabel(values) {
  if (values.length === 0) {
    return '-';
  }

  return values.join(', ');
}
