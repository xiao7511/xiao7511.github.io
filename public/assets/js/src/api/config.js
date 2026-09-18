export function getSiteConfig() {
  const config = window.SiteConfig;
  if (!config?.siteOrigin || !config?.apiOrigin) throw new Error('站点配置未初始化');
  return config;
}

export async function fetchRuntimeConfig() {
  const { apiOrigin } = getSiteConfig();
  const response = await fetch(`${apiOrigin}/`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`配置网关响应异常: ${response.status}`);
  const config = await response.json();
  if (!config.SUPABASE_URL || !config.ANON_KEY) throw new Error('云端载入的通信凭证不完整。');
  return config;
}
