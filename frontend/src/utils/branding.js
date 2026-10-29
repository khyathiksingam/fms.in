import { normalizeApiBase } from './apiUrl.js';

export const DEFAULT_FALLBACK_LOGO = '/logo.png';

// Retained as a fallback when no custom logo exists, pointing to the safe default logo
export const VNRVJIET_DARK_EMBLEM = DEFAULT_FALLBACK_LOGO;

/**
 * Returns the effective logo URL to display across all pages.
 * Prioritizes the saved custom college_logo or system_logo in both light and dark modes.
 * Only falls back to DEFAULT_FALLBACK_LOGO when no custom logo is configured.
 * Appends a version query parameter from updated_at to prevent stale browser/CDN caching without disabling caching globally.
 */
export function getDisplayedLogo(collegeSettings, isDark = false) {
  const customLogo = collegeSettings?.college_logo || collegeSettings?.system_logo;
  if (customLogo && typeof customLogo === 'string' && customLogo.trim() !== '') {
    let url = customLogo.trim();
    if (url.startsWith('/api/')) {
      const apiBase = normalizeApiBase(import.meta.env?.VITE_API_BASE_URL);
      const routeWithoutApi = url.replace(/^\/api/, '');
      url = `${apiBase}${routeWithoutApi}`;
    }
    if (collegeSettings?.updated_at) {
      const version = Date.parse(collegeSettings.updated_at) || collegeSettings.updated_at;
      url += `${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
    }
    return url;
  }

  // Safe fallback if no custom logo exists
  return DEFAULT_FALLBACK_LOGO;
}

/**
 * Returns the configured college/institution name, with a safe fallback.
 */
export function getCollegeName(collegeSettings, fallback = 'Faculty File Management System') {
  return collegeSettings?.college_name?.trim() || fallback;
}
