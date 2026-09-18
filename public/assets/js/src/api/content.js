import { getSiteConfig } from './config.js';

export async function fetchApiJson(path, params) {
  const url = new URL(path, `${getSiteConfig().apiOrigin}/`);
  if (params) url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`网关响应异常: ${response.status}`);
  return response.json();
}
