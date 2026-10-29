import assert from 'node:assert/strict';
import test from 'node:test';
import { getDisplayedLogo, getCollegeName, DEFAULT_FALLBACK_LOGO } from '../src/utils/branding.js';

test('falls back to default fallback logo when no settings provided', () => {
  assert.equal(getDisplayedLogo(null, false), DEFAULT_FALLBACK_LOGO);
  assert.equal(getDisplayedLogo(null, true), DEFAULT_FALLBACK_LOGO);
  assert.equal(getDisplayedLogo({}, false), DEFAULT_FALLBACK_LOGO);
  assert.equal(getDisplayedLogo({}, true), DEFAULT_FALLBACK_LOGO);
});

test('uses custom college_logo in both light and dark mode (no VNRVJIET dark override)', () => {
  const customSettings = {
    college_logo: '/api/public/logo/abc-123.png',
    updated_at: '2026-03-01T12:00:00.000Z'
  };

  const lightLogo = getDisplayedLogo(customSettings, false);
  const darkLogo = getDisplayedLogo(customSettings, true);

  // Both light and dark mode must display the custom logo
  assert.ok(lightLogo.includes('/api/public/logo/abc-123.png'));
  assert.ok(darkLogo.includes('/api/public/logo/abc-123.png'));
  assert.equal(lightLogo, darkLogo, 'Logo URL must match in light and dark mode');

  // Must have cache busting version parameter
  assert.ok(lightLogo.includes('?v=') || lightLogo.includes('&v='));
});

test('uses system_logo if college_logo is missing', () => {
  const customSettings = {
    system_logo: '/api/public/logo/sys-456.png'
  };

  const lightLogo = getDisplayedLogo(customSettings, false);
  const darkLogo = getDisplayedLogo(customSettings, true);

  assert.ok(lightLogo.includes('/api/public/logo/sys-456.png'));
  assert.ok(darkLogo.includes('/api/public/logo/sys-456.png'));
});

test('handles external or absolute custom logo URLs', () => {
  const customSettings = {
    college_logo: 'https://images.example.com/custom-emblem.png'
  };

  const lightLogo = getDisplayedLogo(customSettings, false);
  const darkLogo = getDisplayedLogo(customSettings, true);

  assert.ok(lightLogo.startsWith('https://images.example.com/custom-emblem.png'));
  assert.ok(darkLogo.startsWith('https://images.example.com/custom-emblem.png'));
});

test('retrieves custom college name with fallback', () => {
  assert.equal(getCollegeName({ college_name: 'Apex Institute of Technology' }), 'Apex Institute of Technology');
  assert.equal(getCollegeName({}, 'Default University'), 'Default University');
  assert.equal(getCollegeName(null, 'Default University'), 'Default University');
});
