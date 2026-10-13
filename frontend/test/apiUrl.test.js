import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiUrlBuilder, normalizeApiBase } from '../src/utils/apiUrl.js';

test('defaults to the existing same-origin API proxy', () => {
  assert.equal(normalizeApiBase(undefined), '/api');
  assert.equal(normalizeApiBase('  '), '/api');
});

test('normalizes backend origins whether or not they include the API prefix', () => {
  assert.equal(normalizeApiBase('https://backend.example.test'), 'https://backend.example.test/api');
  assert.equal(normalizeApiBase('https://backend.example.test/api/'), 'https://backend.example.test/api');
  assert.equal(normalizeApiBase('https://backend.example.test/api/api'), 'https://backend.example.test/api');
});

test('avoids duplicate API prefixes when building route URLs', () => {
  const fromOrigin = createApiUrlBuilder('https://backend.example.test');
  const fromApiBase = createApiUrlBuilder('https://backend.example.test/api');

  assert.equal(fromOrigin('/public/syllabus'), 'https://backend.example.test/api/public/syllabus');
  assert.equal(fromOrigin('/api/public/syllabus'), 'https://backend.example.test/api/public/syllabus');
  assert.equal(fromApiBase('/api/public/syllabus'), 'https://backend.example.test/api/public/syllabus');
  assert.equal(createApiUrlBuilder()('/auth/student-login'), '/api/auth/student-login');
});

test('preserves absolute URLs and route query strings', () => {
  const getApiUrl = createApiUrlBuilder('https://backend.example.test/api');

  assert.equal(getApiUrl('https://cdn.example.test/resource'), 'https://cdn.example.test/resource');
  assert.equal(getApiUrl('/files/42/download?token=abc'), 'https://backend.example.test/api/files/42/download?token=abc');
});
