import assert from 'node:assert/strict';
import test from 'node:test';

import { canRegisterServiceWorker, isLocalHostname } from '../../src/pwa.js';

test('recognises local hostnames for development service worker support', () => {
  assert.equal(isLocalHostname('localhost'), true);
  assert.equal(isLocalHostname('tools.localhost'), true);
  assert.equal(isLocalHostname('127.0.0.1'), true);
  assert.equal(isLocalHostname('::1'), true);
  assert.equal(isLocalHostname('[::1]'), true);
  assert.equal(isLocalHostname('example.com'), false);
});

test('allows service worker registration on HTTPS when the API is available', () => {
  assert.equal(canRegisterServiceWorker({
    protocol: 'https:',
    hostname: 'example.com',
    serviceWorker: { register() {} }
  }), true);
});

test('allows service worker registration on local HTTP development origins', () => {
  assert.equal(canRegisterServiceWorker({
    protocol: 'http:',
    hostname: '127.0.0.1',
    serviceWorker: { register() {} }
  }), true);
});

test('skips service worker registration for unsupported origins or missing API support', () => {
  assert.equal(canRegisterServiceWorker({
    protocol: 'file:',
    hostname: '',
    serviceWorker: { register() {} }
  }), false);
  assert.equal(canRegisterServiceWorker({
    protocol: 'http:',
    hostname: 'example.com',
    serviceWorker: { register() {} }
  }), false);
  assert.equal(canRegisterServiceWorker({
    protocol: 'https:',
    hostname: 'example.com',
    serviceWorker: undefined
  }), false);
});
