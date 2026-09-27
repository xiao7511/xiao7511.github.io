export const WORKER_ALLOWED_ORIGINS = Object.freeze([
  'https://www.nobistudio.com',
  'https://nobistudio.com',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost'
]);

const allowedOrigins = new Set(WORKER_ALLOWED_ORIGINS);
const allowedMethods = 'GET, HEAD, OPTIONS';
const allowedHeaders = 'Authorization, Content-Type, apikey, x-client-info';

export function isAllowedWorkerOrigin(origin) {
  return typeof origin === 'string' && allowedOrigins.has(origin);
}

export function workerCorsHeaders(origin) {
  const headers = new Headers({ Vary: 'Origin' });
  if (!isAllowedWorkerOrigin(origin)) return headers;
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', allowedMethods);
  headers.set('Access-Control-Allow-Headers', allowedHeaders);
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

export function handleWorkerPreflight(request) {
  if (request.method !== 'OPTIONS') return null;
  const origin = request.headers.get('Origin');
  if (!isAllowedWorkerOrigin(origin)) {
    return new Response(null, { status: 403, headers: workerCorsHeaders(origin) });
  }
  return new Response(null, { status: 204, headers: workerCorsHeaders(origin) });
}

export function applyWorkerCors(request, response) {
  const headers = new Headers(response.headers);
  const cors = workerCorsHeaders(request.headers.get('Origin'));
  for (const [name, value] of cors) {
    if (name.toLowerCase() === 'vary') {
      const existing = headers.get('Vary');
      const values = new Set(
        `${existing || ''},${value}`
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      );
      headers.set('Vary', [...values].join(', '));
    } else {
      headers.set(name, value);
    }
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
