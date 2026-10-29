import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLE_CONFIGS } from '../src/components/common/roleConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('shared design system: role configs define distinct, accessible role badges', () => {
  const roles = ['admin', 'hod', 'faculty', 'student'];
  
  for (const role of roles) {
    const config = ROLE_CONFIGS[role];
    assert.ok(config, `ROLE_CONFIGS must include '${role}'`);
    assert.ok(config.label, `'${role}' badge must have a display label`);
    assert.ok(config.iconName, `'${role}' badge must have an associated icon name`);
    assert.ok(config.className, `'${role}' badge must define semantic Tailwind classes`);
    
    // Each role badge must define both light and dark mode classes for accessible contrast
    assert.ok(config.className.includes('dark:'), `'${role}' badge must include dark mode styles`);
  }

  // Check specific role themes
  assert.equal(ROLE_CONFIGS.admin.label, 'Admin');
  assert.ok(ROLE_CONFIGS.admin.className.includes('purple'), 'Admin badge must use purple palette');

  assert.equal(ROLE_CONFIGS.hod.label, 'HOD');
  assert.ok(ROLE_CONFIGS.hod.className.includes('amber'), 'HOD badge must use amber palette');

  assert.equal(ROLE_CONFIGS.faculty.label, 'Faculty');
  assert.ok(ROLE_CONFIGS.faculty.className.includes('blue'), 'Faculty badge must use blue palette');

  assert.equal(ROLE_CONFIGS.student.label, 'Student');
  assert.ok(ROLE_CONFIGS.student.className.includes('emerald'), 'Student badge must use emerald palette');
});

test('shared design system: index.css defines complete design tokens and reusable component classes', () => {
  const indexCssPath = path.join(frontendDir, 'src', 'index.css');
  const css = fs.readFileSync(indexCssPath, 'utf8');

  // Core CSS Variables in :root
  const requiredTokens = [
    '--color-primary',
    '--color-primary-hover',
    '--color-accent',
    '--gradient-brand',
    '--color-bg-app',
    '--color-surface',
    '--color-border',
    '--color-text-main',
    '--color-text-muted',
    '--color-success',
    '--color-warning',
    '--color-danger'
  ];

  for (const token of requiredTokens) {
    assert.ok(css.includes(token), `index.css must define token '${token}'`);
  }

  // Dark mode token overrides in html.dark
  assert.ok(css.includes('html.dark'), 'index.css must define html.dark theme overrides');

  // Core reusable component classes
  const requiredClasses = [
    '.btn-primary',
    '.btn-secondary',
    '.btn-accent',
    '.btn-danger',
    '.app-card',
    '.app-hero',
    '.app-input'
  ];

  for (const cls of requiredClasses) {
    assert.ok(css.includes(cls), `index.css must define component utility class '${cls}'`);
  }
});

test('shared design system: no dark-mode overrides substitute hardcoded old VNRVJIET logo', () => {
  const sidebarPath = path.join(frontendDir, 'src', 'components', 'layout', 'Sidebar.jsx');
  const navbarPath = path.join(frontendDir, 'src', 'components', 'layout', 'Navbar.jsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
  const navbarContent = fs.readFileSync(navbarPath, 'utf8');

  // Must not reference old hardcoded dark emblem
  assert.ok(!sidebarContent.includes('VNRVJIET_DARK_EMBLEM'), 'Sidebar must not reference VNRVJIET_DARK_EMBLEM');
  assert.ok(!sidebarContent.includes('vnrvjiet-emblem-dark'), 'Sidebar must not reference hardcoded vnrvjiet-emblem-dark');
  assert.ok(!navbarContent.includes('VNRVJIET_DARK_EMBLEM'), 'Navbar must not reference VNRVJIET_DARK_EMBLEM');
  assert.ok(!navbarContent.includes('vnrvjiet-emblem-dark'), 'Navbar must not reference hardcoded vnrvjiet-emblem-dark');

  // Must use getDisplayedLogo
  assert.ok(sidebarContent.includes('getDisplayedLogo'), 'Sidebar must use getDisplayedLogo');
  assert.ok(navbarContent.includes('getDisplayedLogo'), 'Navbar must use getDisplayedLogo');
});
