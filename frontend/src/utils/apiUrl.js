export function normalizeApiBase(configuredBase) {
  const configured = configuredBase?.trim().replace(/\/+$/, '');
  if (!configured) return '/api';

  const base = /^https?:\/\//i.test(configured)
    ? configured
    : `/${configured.replace(/^\/+/, '')}`;
  const withoutApiSuffix = base.replace(/(?:\/api)+$/i, '');
  return `${withoutApiSuffix}/api`;
}

export function createApiUrlBuilder(configuredBase) {
  const apiBase = normalizeApiBase(configuredBase);
  return function getApiUrl(endpoint) {
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    const route = `/${endpoint.replace(/^\/+/, '')}`;
    const routeWithoutApiPrefix = route.replace(/^(?:\/api)+(?=\/|$)/i, '') || '/';
    return `${apiBase}${routeWithoutApiPrefix === '/' ? '' : routeWithoutApiPrefix}`;
  };
}
