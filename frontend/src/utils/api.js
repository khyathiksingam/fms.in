const API_BASE = '/api';

export function getToken() {
  return localStorage.getItem('ffms_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('ffms_token', token);
  } else {
    localStorage.removeItem('ffms_token');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const { auth = true, ...requestOptions } = options;
  const token = auth ? getToken() : null;
  const headers = {
    ...requestOptions.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const activeDepartmentId = token && !endpoint.startsWith('/auth/')
    ? localStorage.getItem('ffms_active_department')
    : null;
  if (activeDepartmentId) {
    headers['X-Active-Department-Id'] = activeDepartmentId;
  }

  // If payload is not FormData, default to application/json
  if (!(requestOptions.body instanceof FormData) && requestOptions.body && typeof requestOptions.body === 'object') {
    headers['Content-Type'] = 'application/json';
    requestOptions.body = JSON.stringify(requestOptions.body);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const response = await fetch(url, {
    ...requestOptions,
    headers
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  let data;
  if (isJson) {
    data = await response.json();
  } else if (response.status === 204) {
    data = null;
  } else {
    data = await response.text();
  }

  if (response.ok && response.status !== 204 && !isJson) {
    const error = new Error('The API endpoint returned a non-JSON response. Check the backend route and development proxy.');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  if (!response.ok) {
    const errorMsg = data && data.error ? data.error : `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function fetchAuthenticatedPdf(endpoint) {
  const token = getToken();
  if (!token) {
    const error = new Error('Your student session expired. Please sign in again.');
    error.status = 401;
    throw error;
  }

  const response = await fetch(`${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();
    const error = new Error(data?.error || data || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (!contentType.toLowerCase().includes('application/pdf')) {
    throw new Error(`The server returned ${contentType || 'an unknown content type'} instead of a PDF.`);
  }

  const blob = await response.blob();
  const header = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  const hasPdfSignature = Array.from(header).some((byte, index) =>
    byte === 0x25 &&
    header[index + 1] === 0x50 &&
    header[index + 2] === 0x44 &&
    header[index + 3] === 0x46 &&
    header[index + 4] === 0x2d
  );
  if (!hasPdfSignature) {
    throw new Error('The server response does not contain a valid PDF file.');
  }
  return blob;
}

function withQueryParams(url, params) {
  if (!params) return url;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url;
}

export const api = {
  get: (url, params) => apiRequest(withQueryParams(url, params), { method: 'GET' }),
  publicGet: (url, params) => apiRequest(withQueryParams(url, params), { method: 'GET', auth: false, cache: 'no-store' }),

  post: (url, body) => apiRequest(url, { method: 'POST', body }),
  put: (url, body) => apiRequest(url, { method: 'PUT', body }),
  patch: (url, body) => apiRequest(url, { method: 'PATCH', body }),
  delete: (url, body) => apiRequest(url, { method: 'DELETE', body })
};
