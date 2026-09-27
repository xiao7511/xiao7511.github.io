export async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`请求失败 (${response.status})`);
    return await response.json() as unknown;
  } finally {
    window.clearTimeout(timeout);
  }
}
