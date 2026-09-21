import { expect, test } from '@playwright/test';

const contentId = 'd9428888-122b-4f20-9f6c-25789ab0a123';
const contentRecord = {
  id: contentId,
  category: 'anime',
  slot_index: 0,
  title: '测试动漫',
  subtitle: '更新中',
  theme_tags: ['冒险'],
  cover_url: 'http://127.0.0.1:4173/images/IMG_4893.webp',
  detail_urls: ['http://127.0.0.1:4173/images/IMG_4893.webp']
};

async function mockRuntime(page, { posts = [], features = false } = {}) {
  const records = [
    contentRecord,
    { ...contentRecord, id: '8d99585e-379d-46d0-99c1-0eb2a32a3aa7', category: 'manga' },
    { ...contentRecord, id: '5a0f1c6f-3c6e-4e71-a65d-6a5504945b82', category: 'banner' }
  ];
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        (() => {
          const tables = ${JSON.stringify({
            content_management: records,
            posts,
            post_likes: [],
            site_config: features ? [{ section: 'features_v2', url: '{"analytics":true,"imageLikes":true}' }] : []
          })};
          let imageLiked = false;
          function query(table) {
            let rows = [...(tables[table] || [])];
            let head = false;
            const api = {
              select(_columns, options = {}) { head = Boolean(options.head); return api; },
              eq(column, value) { rows = rows.filter((row) => row[column] === value); return api; },
              is(column, value) { rows = rows.filter((row) => row[column] === value); return api; },
              in(column, values) { rows = rows.filter((row) => values.includes(row[column])); return api; },
              order() { return api; },
              range(start, end) { rows = rows.slice(start, end + 1); return api; },
              maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
              insert() { return Promise.resolve({ data: null, error: null }); },
              upsert() { return Promise.resolve({ data: null, error: null }); },
              delete() { return api; },
              update() { return api; },
              then(resolve) { resolve({ data: head ? null : rows, count: rows.length, error: null }); }
            };
            return api;
          }
          window.supabase = {
            createClient() {
              return {
                from: query,
                rpc: async (name) => {
                  if (name === 'get_image_like_summary') {
                    return { data: [{ content_id: '${contentId}', image_kind: 'detail', image_index: 0, like_count: imageLiked ? 1 : 0, liked: imageLiked }], error: null };
                  }
                  if (name === 'toggle_image_like') {
                    imageLiked = !imageLiked;
                    return { data: [{ liked: imageLiked, like_count: imageLiked ? 1 : 0 }], error: null };
                  }
                  return { data: [], error: null };
                },
                auth: {
                  getSession: async () => ({ data: { session: null }, error: null }),
                  getUser: async () => ({ data: { user: null }, error: null }),
                  onAuthStateChange(callback) { queueMicrotask(() => callback('INITIAL_SESSION', null)); return { data: { subscription: { unsubscribe() {} } } }; },
                  signOut: async () => ({ error: null })
                }
              };
            }
          };
        })();`
    })
  );
  await page.route('https://api.nobistudio.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({ json: { SUPABASE_URL: 'https://api.nobistudio.com', ANON_KEY: 'test-anon-key' } });
    }
    if (url.pathname === '/api/detail') return route.fulfill({ json: contentRecord });
    if (url.pathname === '/api/recommend') return route.fulfill({ json: [contentRecord] });
    if (url.pathname === '/api/manga') return route.fulfill({ json: [{ ...contentRecord, category: 'manga' }] });
    if (url.pathname === '/rest/v1/site_config') return route.fulfill({ json: [] });
    if (url.pathname === '/rest/v1/content_management') {
      const category = url.searchParams.get('category');
      const rows = category?.includes('banner')
        ? [{ ...contentRecord, category: 'banner' }]
        : [contentRecord, { ...contentRecord, id: '8d99585e-379d-46d0-99c1-0eb2a32a3aa7', category: 'manga' }];
      return route.fulfill({ json: rows });
    }
    if (url.pathname === '/rest/v1/post_likes') return route.fulfill({ json: [] });
    if (url.pathname === '/rest/v1/posts') {
      const isReplyQuery = url.searchParams.get('parent_id')?.startsWith('in.');
      return route.fulfill({
        status: 200,
        headers: { 'content-range': `0-${Math.max(0, posts.length - 1)}/${posts.length}` },
        json: isReplyQuery ? [] : posts
      });
    }
    return route.fulfill({ json: [] });
  });
}

const pages = [
  ['/', '#main-content'],
  ['/index.html', 'body'],
  ['/recommend.html', '#dynamic-recommend-container'],
  ['/manga.html', '#dynamic-manga-container'],
  ['/community.html', '#posts-list'],
  ['/detail.html?category=anime&slot=0', '#gallery-stream'],
  ['/admin.html', '.admin-shell']
];
for (const [path, selector] of pages) {
  test(`${path} renders its application shell`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator(selector)).toBeVisible();
  });
}

test('home renders the NOBI brand and no more than six real cards per section', async ({ page }) => {
  const messages = [];
  page.on('console', (message) => messages.push(`${message.type()}: ${message.text()}`));
  await mockRuntime(page);
  await page.goto('/index.html');
  await expect(page.locator('.logo')).toContainText('NOBI');
  await expect(page.locator('.logo')).toContainText('动漫');
  await expect(page.locator('#anime-container .card').first(), messages.join('\n')).toBeVisible({ timeout: 15_000 });
  expect(await page.locator('#anime-container .card').count()).toBeLessThanOrEqual(6);
  expect(await page.locator('#manga-container .card').count()).toBeLessThanOrEqual(6);
});

test('community loads posts and persistent post-like controls without console errors', async ({ page }) => {
  await mockRuntime(page, {
    posts: [
      {
        id: 42,
        user_id: '7cc08d1d-7a08-4291-8326-7c07aa9fe56a',
        created_at: '2026-09-21T01:00:00Z',
        content: '使用安全文本节点渲染的社区帖子。',
        nickname: 'NOBI 漫友',
        avatar_url: 'http://127.0.0.1:4173/images/nobi-avatar.svg',
        title: '本周新番讨论',
        category: '新番',
        parent_id: null
      }
    ]
  });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/community.html');
  await expect(page.locator('#posts-list .post-card').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.like-action-btn').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('detail images open in the accessible preview', async ({ page }) => {
  await mockRuntime(page, { features: true });
  await page.goto('/detail.html?category=anime&slot=0');
  const image = page.locator('.gallery-item img').first();
  await expect(image).toBeVisible({ timeout: 15_000 });
  await image.click();
  await expect(page.locator('#image-lightbox')).toBeVisible();
  await expect(page.locator('.image-lightbox__image')).toBeVisible();
  await expect(page.locator('.image-like-button')).toContainText('点赞 0');
  await page.locator('.image-like-button').click();
  await expect(page.locator('.image-like-button')).toContainText('已点赞 1');
});

for (const viewport of [
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 }
]) {
  test(`home has no horizontal overflow on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/index.html');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
