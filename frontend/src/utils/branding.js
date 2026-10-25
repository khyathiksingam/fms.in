import { getApiUrl } from './api';

export const VNRVJIET_DARK_EMBLEM = '/brand/vnrvjiet-mark-transparent.png';

export function getCollegeLogoUrl(logo, fallback = '/logo.png') {
  const logoPath = logo || fallback;
  // Uploaded branding is served by the API; a root-relative URL would incorrectly
  // request it from the Vercel frontend origin in production.
  if (logoPath.startsWith('/api/')) return getApiUrl(logoPath);
  return logoPath;
}

export function handleCollegeLogoError(event, fallback = '/branding/vnrvjiet-emblem.png') {
  const image = event.currentTarget;
  const fallbackUrl = new URL(fallback, window.location.origin).href;
  if (image.src !== fallbackUrl) {
    image.onerror = null;
    image.src = fallbackUrl;
  }
}

