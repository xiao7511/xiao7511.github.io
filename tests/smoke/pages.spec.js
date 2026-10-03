import { expect, test } from '@playwright/test';

const contentId = 'd9428888-122b-4f20-9f6c-25789ab0a123';
const imageUrl = 'http://127.0.0.1:4173/storage/v1/object/public/images/IMG_4893.webp';
const imageKey = 'images/IMG_4893.webp';
const secondDetailImageUrl = 'http://127.0.0.1:4173/storage/v1/object/public/images/IMG_4873.webp';
const secondDetailImageKey = 'images/IMG_4873.webp';
const contentRecord = {
  id: contentId,
  category: 'anime',
  slot_index: 0,
  title: '测试动漫',
  subtitle: '更新中',
  published_at: '2024-08-18T00:00:00Z',
  theme_tags: ['冒险'],
  cover_url: imageUrl,
  detail_urls: [imageUrl, secondDetailImageUrl]
};

function animeId(index) {
  return `d9428888-122b-4f20-9f6c-25789ab0a12${index}`;
}

function bannerRecord(slot, changes = {}) {
  return {
    ...contentRecord,
    id: `5a0f1c6f-3c6e-4e71-a65d-6a5504945b8${slot}`,
    category: 'banner',
    slot_index: slot,
    title: `Banner ${slot + 1}`,
    is_active: true,
    linked_content_id: animeId(slot),
    ...changes
  };
}

async function mockRuntime(
  page,
  {
    posts = [],
    features = false,
    socialLinks = false,
    contentCount = 6,
    contentChanges = {},
    banners = [bannerRecord(0)],
    sessionUser = null,
    replyInsertError = false,
    postLikeError = false
  } = {}
) {
  const session = sessionUser
    ? {
        user: sessionUser,
        access_token: `test.${Buffer.from(
          JSON.stringify({ sub: sessionUser.id, role: 'authenticated', exp: 4102444800 })
        ).toString('base64url')}.signature`
      }
    : null;
  const animeRecords = Array.from({ length: contentCount }, (_, index) => ({
    ...contentRecord,
    ...contentChanges,
    id: `d9428888-122b-4f20-9f6c-25789ab0a12${index}`,
    slot_index: index,
    title: `测试动漫 ${index + 1}`
  }));
  const mangaRecords = Array.from({ length: contentCount }, (_, index) => ({
    ...contentRecord,
    ...contentChanges,
    id: `8d99585e-379d-46d0-99c1-0eb2a32a3aa${index}`,
    category: 'manga',
    slot_index: index,
    title: `测试漫画 ${index + 1}`
  }));
  const records = [...animeRecords, ...mangaRecords, ...banners];
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        (() => {
          const tables = ${JSON.stringify({
            content_management: records,
            posts,
            post_likes: [],
            site_config: [
              ...(features ? [{ section: 'features_v2', url: '{"analytics":true,"imageLikes":true}' }] : []),
              ...(socialLinks
                ? [
                    {
                      section: 'social_links',
                      url: '{"xiaohongshu":"https://xhslink.cn/o/2ElEjvQMl69","weibo":"http://weibo.com","twitter":"https://x.com","instagram":"https://instagram.com"}'
                    }
                  ]
                : [])
            ]
          })};
          const currentSession = ${JSON.stringify(session)};
          const failReplyInsert = ${JSON.stringify(replyInsertError)};
          const failPostLike = ${JSON.stringify(postLikeError)};
          let imageLiked = false;
          let postLiked = false;
          window.__replyUploads = [];
          window.__replyRemovals = [];
          window.__postInserts = [];
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
              insert(values) {
                if (table === 'posts') {
                  window.__postInserts.push(...values);
                  if (failReplyInsert && values.some((value) => value.parent_id !== null)) {
                    return Promise.resolve({ data: null, error: { message: 'mock reply insert failed' } });
                  }
                }
                return Promise.resolve({ data: null, error: null });
              },
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
                rpc: async (name, args) => {
                  if (name === 'get_image_like_summary') {
                    return {
                      data: [
                        ...(args.p_image_keys.includes('${imageKey}')
                          ? [{ image_key: '${imageKey}', like_count: imageLiked ? 1 : 0, liked: imageLiked }]
                          : []),
                        ...(args.p_image_keys.includes('${secondDetailImageKey}')
                          ? [{ image_key: '${secondDetailImageKey}', like_count: 4, liked: false }]
                          : [])
                      ],
                      error: null
                    };
                  }
                  if (name === 'toggle_image_like') {
                    if (args.p_image_key !== '${imageKey}') return { data: null, error: { message: 'invalid image key' } };
                    imageLiked = !imageLiked;
                    return { data: [{ liked: imageLiked, like_count: imageLiked ? 1 : 0 }], error: null };
                  }
                  if (name === 'toggle_post_like') {
                    if (failPostLike) return { data: null, error: { message: 'private database detail' } };
                    postLiked = !args.p_remove;
                    return { data: [{ liked: postLiked, like_count: postLiked ? 1 : 0 }], error: null };
                  }
                  return { data: [], error: null };
                },
                auth: {
                  getSession: async () => ({ data: { session: currentSession }, error: null }),
                  getUser: async () => ({ data: { user: currentSession?.user || null }, error: null }),
                  refreshSession: async () => ({ data: { session: currentSession }, error: null }),
                  onAuthStateChange(callback) { queueMicrotask(() => callback('INITIAL_SESSION', currentSession)); return { data: { subscription: { unsubscribe() {} } } }; },
                  signOut: async () => ({ error: null })
                },
                storage: {
                  from(bucket) {
                    return {
                      upload: async (path, file) => {
                        window.__replyUploads.push({ bucket, path, type: file.type, size: file.size });
                        return { error: null };
                      },
                      remove: async (paths) => {
                        window.__replyRemovals.push({ bucket, paths });
                        return { error: null };
                      },
                      getPublicUrl: () => ({
                        data: { publicUrl: 'http://127.0.0.1:4173/images/IMG_4893.webp' }
                      })
                    };
                  }
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
    if (url.pathname === '/api/recommend') return route.fulfill({ json: animeRecords });
    if (url.pathname === '/api/manga') return route.fulfill({ json: mangaRecords });
    if (url.pathname === '/rest/v1/site_config') return route.fulfill({ json: [] });
    if (url.pathname === '/rest/v1/content_management') {
      const category = url.searchParams.get('category');
      const rows = category?.includes('banner')
        ? banners
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
  ['/admin.html', '.admin-shell'],
  ['/privacy.html', '#main-content'],
  ['/support.html', '#main-content'],
  ['/moderation.html', '.moderation-shell']
];
for (const [path, selector] of pages) {
  test(`${path} renders its application shell`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator(selector)).toBeVisible();
  });
}

test('home renders all six configured enriched cards per section', async ({ page }) => {
  const messages = [];
  page.on('console', (message) => messages.push(`${message.type()}: ${message.text()}`));
  await mockRuntime(page, {
    features: true,
    sessionUser: { id: '7cc08d1d-7a08-4291-8326-7c07aa9fe56a', email: 'user@nobi.test' }
  });
  await page.goto('/index.html');
  await expect(page.locator('.logo')).toContainText('NOBI');
  await expect(page.locator('.logo')).toContainText('动漫');
  await expect(page.locator('#anime-container .card').first(), messages.join('\n')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#anime-container .card')).toHaveCount(6);
  await expect(page.locator('#manga-container .card')).toHaveCount(6);
  await expect(page.locator('#anime-container .card__type').first()).toHaveText('冒险');
  await expect(page.locator('#anime-container .card__year').first()).toHaveText('2024');
  await expect(page.locator('#anime-container .card__like-count').first()).toHaveText('0');
  await expect(page.locator('#updates-container .update-card')).toHaveCount(6);
  await expect(page.locator('#ranking-container .ranking-item')).toHaveCount(5);
  await expect(page.locator('#ranking-container .ranking-item').first()).toContainText('♡ 0');
  await page.getByRole('tab', { name: '本周' }).click();
  await expect(page.getByRole('tab', { name: '本周' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '本月' }).click();
  await expect(page.getByRole('tab', { name: '本月' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#news-container .news-item')).toHaveCount(4);
  await expect(page.locator('#anime-container .image-like-button--inline').first()).toHaveAttribute(
    'data-image-like-summary-keys',
    JSON.stringify([imageKey])
  );
  await expect(page.locator('#anime-container .image-like-button--overlay')).toHaveCount(0);
  const inlineLike = page.locator('#anime-container .image-like-button--inline').first();
  await expect(inlineLike).toBeVisible();
  await inlineLike.click();
  await expect(inlineLike).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#anime-container .card__like-count').first()).toHaveText('1');
  const [mediaBounds, likeBounds] = await Promise.all([
    page.locator('#anime-container .card__media').first().boundingBox(),
    inlineLike.boundingBox()
  ]);
  expect(likeBounds.y).toBeGreaterThanOrEqual(mediaBounds.y + mediaBounds.height);
});

test('home renders only configured cards when fewer than six items are available', async ({ page }) => {
  await mockRuntime(page, { features: true, contentCount: 4 });
  await page.goto('/index.html');
  await expect(page.locator('#anime-container .card')).toHaveCount(4);
  await expect(page.locator('#anime-container .card--empty')).toHaveCount(0);
  await expect(page.locator('#manga-container .card')).toHaveCount(4);
  await expect(page.locator('#manga-container .card--empty')).toHaveCount(0);
});

test('home renders safe empty states without fake cards', async ({ page }) => {
  await mockRuntime(page, { features: true, contentCount: 0 });
  await page.goto('/index.html');
  await expect(page.locator('#anime-container .card')).toHaveCount(0);
  await expect(page.locator('#manga-container .card')).toHaveCount(0);
  await expect(page.locator('#anime-container .content-state')).toBeVisible();
  await expect(page.locator('#manga-container .content-state')).toBeVisible();
});

test('home replaces a missing cover with the established local fallback', async ({ page }) => {
  await mockRuntime(page, { features: true, contentCount: 1, contentChanges: { cover_url: '' } });
  await page.goto('/index.html');
  await expect(page.locator('#anime-container .card img')).toHaveAttribute(
    'src',
    /\/images\/nobi-anime-placeholder\.svg$/
  );
});

test('home cover opens its matching detail page directly', async ({ page }) => {
  await mockRuntime(page, { features: true });
  await page.goto('/index.html');
  const cover = page.locator('#anime-container .card img').first();
  await expect(cover).toBeVisible({ timeout: 15_000 });
  await cover.click();
  await expect(page).toHaveURL(/detail\.html\?category=anime&slot=0$/);
  await expect(page.locator('#detail-title')).toContainText('测试动漫');
});

test('Anime and Manga libraries render canonical metadata, likes and detail routes', async ({ page }) => {
  await mockRuntime(page, {
    features: true,
    contentCount: 3,
    sessionUser: { id: '7cc08d1d-7a08-4291-8326-7c07aa9fe56a', email: 'user@nobi.test' }
  });

  await page.goto('/recommend.html');
  await expect(page.locator('#dynamic-recommend-container .card')).toHaveCount(3);
  await expect(page.locator('#dynamic-recommend-container .card__year').first()).toHaveText('2024');
  await expect(page.locator('#dynamic-recommend-container .card__type').first()).toHaveText('冒险');
  const animeLike = page.locator('#dynamic-recommend-container .library-like-button').first();
  await expect(animeLike).toContainText('0');
  await animeLike.click();
  await expect(animeLike).toContainText('1');
  await expect(page.locator('#dynamic-recommend-container .card__media').first()).toHaveAttribute(
    'href',
    'detail.html?category=anime&slot=0'
  );

  await page.goto('/manga.html');
  await expect(page.locator('#dynamic-manga-container .manga-item')).toHaveCount(3);
  await expect(page.locator('#dynamic-manga-container .manga-update').first()).toContainText('2024');
  await expect(page.locator('#dynamic-manga-container .manga-update').first()).toContainText('冒险');
  await expect(page.locator('#dynamic-manga-container .manga-cover-box').first()).toHaveAttribute(
    'href',
    'detail.html?category=manga&slot=0'
  );
  const mangaLike = page.locator('#dynamic-manga-container .library-like-button').first();
  await expect(mangaLike).toContainText('0');
  await mangaLike.click();
  await expect(mangaLike).toContainText('1');
});

test('Anime and Manga libraries show empty states and use local cover fallback', async ({ page }) => {
  await mockRuntime(page, { features: true, contentCount: 0 });
  await page.goto('/recommend.html');
  await expect(page.locator('#dynamic-recommend-container .content-state')).toBeVisible();
  await page.goto('/manga.html');
  await expect(page.locator('#dynamic-manga-container .content-state')).toBeVisible();

  await mockRuntime(page, { features: true, contentCount: 1, contentChanges: { cover_url: '' } });
  await page.goto('/recommend.html');
  await expect(page.locator('#dynamic-recommend-container img')).toHaveAttribute('src', /\/images\/IMG_4893\.webp$/);
  await page.goto('/manga.html');
  await expect(page.locator('#dynamic-manga-container img')).toHaveAttribute('src', /\/images\/IMG_4893\.webp$/);
});

test('home hero advances across three active Banners and keeps pagination and CTA aligned', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockRuntime(page, { banners: [bannerRecord(0), bannerRecord(1), bannerRecord(2)] });
  await page.goto('/index.html');

  const visibleSlides = page.locator('.hero__slide:not([hidden])');
  await expect(visibleSlides).toHaveCount(3);
  await expect(page.locator('.hero__pagination span:not([hidden])')).toHaveCount(3);
  await expect(page.locator('.hero__pagination b')).toHaveText('01');
  await expect(visibleSlides.nth(0)).toHaveClass(/is-active/);
  await expect(page.locator('[data-hero-primary]')).toHaveAttribute('href', 'detail.html?category=anime&slot=0');

  await page.locator('.hero__control--next').click();
  await expect(visibleSlides.nth(1)).toHaveClass(/is-active/);
  await expect(visibleSlides.nth(0)).not.toHaveClass(/is-active/);
  await expect(page.locator('.hero__pagination b')).toHaveText('02');
  await expect(page.locator('[data-hero-primary]')).toHaveAttribute('href', 'detail.html?category=anime&slot=1');
});

test('home hero skips a disabled middle Banner instead of navigating a hidden raw slot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const lastActive = bannerRecord(2);
  await mockRuntime(page, {
    banners: [bannerRecord(0), bannerRecord(1, { is_active: false }), lastActive]
  });
  await page.goto('/index.html');

  const visibleSlides = page.locator('.hero__slide:not([hidden])');
  await expect(visibleSlides).toHaveCount(2);
  await expect(page.locator('.hero__pagination span:not([hidden])')).toHaveCount(2);
  await expect(page.locator('.hero__pagination b')).toHaveText('01');
  await page.locator('.hero__control--next').click();
  await expect(visibleSlides.nth(1)).toHaveClass(/is-active/);
  await expect(visibleSlides.nth(1).locator('img')).toHaveAttribute('data-content-id', lastActive.id);
  await expect(page.locator('.hero__slide').nth(2)).toBeHidden();
  await expect(page.locator('.hero__pagination b')).toHaveText('02');
  await expect(page.locator('[data-hero-detail]')).toHaveAttribute('href', 'detail.html?category=anime&slot=2');
});

test('home hero keeps single-Banner navigation safe and reports one visible page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const onlyBanner = bannerRecord(0);
  await mockRuntime(page, { banners: [onlyBanner] });
  await page.goto('/index.html');

  const activeSlide = page.locator('.hero__slide.is-active:not([hidden])');
  await expect(page.locator('.hero__slide:not([hidden])')).toHaveCount(1);
  await expect(page.locator('.hero__pagination span:not([hidden])')).toHaveCount(1);
  await expect(activeSlide.locator('img')).toHaveAttribute('data-content-id', onlyBanner.id);
  await expect(page.locator('.hero__pagination b')).toHaveText('01');
  await page.locator('.hero__control--next').click();
  await expect(activeSlide).toHaveCount(1);
  await expect(activeSlide.locator('img')).toHaveAttribute('data-content-id', onlyBanner.id);
  await expect(page.locator('.hero__pagination b')).toHaveText('01');
});

test('home hero exposes canonical Banner likes and keeps signed-out action safe', async ({ page }) => {
  await mockRuntime(page, { features: true, banners: [bannerRecord(0)] });
  await page.goto('/index.html');
  const like = page.locator('.hero__slide.is-active .hero__like');
  await expect(like).toBeVisible();
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await expect(like.locator('[data-image-like-count]')).toHaveText('0');
  await like.click();
  await expect(page).toHaveURL(/index\.html\?auth=login$/);
});

test('home hero fills the viewport and production social links render visible SVG icons', async ({ page }) => {
  await mockRuntime(page, { socialLinks: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/index.html');
  const bounds = await page.locator('.hero').evaluate((hero) => {
    const rect = hero.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: document.documentElement.clientWidth };
  });
  expect(bounds.left).toBe(0);
  expect(bounds.right).toBe(1366);
  await expect(page.locator('.hero__slide:not([hidden])')).toHaveCount(1);
  await expect(page.locator('.hero__pagination b')).toHaveText('01');
  const social = page.locator('.footer-social');
  await expect(social.locator('.footer-social__link')).toHaveCount(4);
  await expect(social).toBeVisible();
  await expect(page.locator('.footer-social-slot')).toContainText('关注我们');
  await expect(page.locator('.footer-social-slot .footer-social')).toHaveCount(1);
  await expect(social.locator('[data-social-platform="xiaohongshu"]')).toHaveCSS('color', 'rgb(255, 36, 66)');
  await expect(social.locator('[data-social-platform="weibo"]')).toHaveCSS('color', 'rgb(230, 22, 45)');
  await expect(social.locator('[data-social-platform="x"]')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(social.locator('[data-social-platform="instagram"]')).toHaveCSS('color', 'rgb(225, 48, 108)');
  for (const link of await social.locator('.footer-social__link').all()) {
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const iconState = await link.locator('svg').evaluate((svg) => {
      const path = svg.querySelector('path');
      const bounds = path?.getBBox();
      return {
        svgNamespace: svg.namespaceURI,
        pathNamespace: path?.namespaceURI,
        iconVisible: Boolean(bounds && bounds.width > 0 && bounds.height > 0),
        fill: path ? getComputedStyle(path).fill : ''
      };
    });
    expect(iconState.svgNamespace).toBe('http://www.w3.org/2000/svg');
    expect(iconState.pathNamespace).toBe('http://www.w3.org/2000/svg');
    expect(iconState.iconVisible).toBe(true);
    expect(iconState.fill).not.toBe('none');
  }
  expect(await social.locator('[data-social-platform="instagram"] svg path').getAttribute('fill')).toContain(
    'url("#nobi-instagram-gradient")'
  );
  expect(await social.evaluate((node) => getComputedStyle(node).position)).toBe('static');
  expect(await social.evaluate((node) => getComputedStyle(node).flexDirection)).toBe('row');
  expect(
    await page
      .locator('.site-footer__inner')
      .evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)
  ).toBe(3);
  await expect(page.locator('.social-dock')).toHaveCount(0);
});

test('footer omits social icons when no valid URLs are configured', async ({ page }) => {
  await mockRuntime(page);
  await page.goto('/index.html');
  await expect(page.locator('.footer-social')).toHaveCount(0);
  await expect(page.locator('.footer-social-slot')).toBeHidden();
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
  const dialogPromise = page.waitForEvent('dialog');
  const likeClickPromise = page.locator('.like-action-btn').first().click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe('登录状态已失效，请重新登录后再试。');
  await dialog.dismiss();
  await likeClickPromise;
  expect(errors).toEqual([]);
});

test('community like failures show safe feedback instead of backend details', async ({ page }) => {
  await mockRuntime(page, {
    posts: [
      {
        id: 42,
        user_id: '7cc08d1d-7a08-4291-8326-7c07aa9fe56a',
        created_at: '2026-09-21T01:00:00Z',
        content: '点赞失败反馈测试',
        nickname: 'NOBI',
        avatar_url: null,
        parent_id: null
      }
    ],
    sessionUser: { id: 'ad132ad0-10f7-4b05-9737-a6bd6ba76670', email: 'local@example.com' },
    postLikeError: true
  });
  await page.goto('/community.html');
  await expect(page.locator('.like-action-btn').first()).toBeVisible({ timeout: 15_000 });
  const dialogPromise = page.waitForEvent('dialog');
  const clickPromise = page.locator('.like-action-btn').first().click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe('点赞失败，请稍后重试。');
  expect(dialog.message()).not.toContain('private database detail');
  await dialog.dismiss();
  await clickPromise;
});

test('community likes and replies update the current post without rerendering the list', async ({ page }) => {
  const post = {
    id: 42,
    user_id: '7cc08d1d-7a08-4291-8326-7c07aa9fe56a',
    created_at: '2026-09-21T01:00:00Z',
    content: '保持当前页面状态的社区帖子。',
    nickname: 'NOBI 漫友',
    avatar_url: 'http://127.0.0.1:4173/images/nobi-avatar.svg',
    title: '局部更新测试',
    category: '交流',
    parent_id: null
  };
  await mockRuntime(page, {
    posts: [post],
    sessionUser: { id: 'ad132ad0-10f7-4b05-9737-a6bd6ba76670', email: 'local@example.com' }
  });
  await page.goto('/community.html');
  const postCard = page.locator('#posts-list .post-card').first();
  await expect(postCard).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => {
    window.__communityPostCard = document.querySelector('#posts-list .post-card');
  });

  const likeButton = postCard.locator('.like-action-btn');
  await likeButton.click();
  await expect(likeButton).toContainText('已赞（1）');
  expect(
    await page.evaluate(() => window.__communityPostCard === document.querySelector('#posts-list .post-card'))
  ).toBe(true);

  await postCard.locator('.reply-action-btn').click();
  await postCard.locator('.reply-input').fill('这条回复无需刷新页面。');
  await postCard.locator('.reply-submit').click();
  await expect(postCard.locator('.reply-item')).toHaveCount(1);
  await expect(postCard.locator('.reply-content')).toHaveText('这条回复无需刷新页面。');
  await expect(postCard.locator('.reply-action-btn')).toContainText('回复（1）');
  expect(
    await page.evaluate(() => window.__communityPostCard === document.querySelector('#posts-list .post-card'))
  ).toBe(true);
});

test('community previews, uploads and renders an image reply once', async ({ page }) => {
  const post = {
    id: 42,
    user_id: '7cc08d1d-7a08-4291-8326-7c07aa9fe56a',
    created_at: '2026-09-21T01:00:00Z',
    content: '图片回复测试帖子。',
    nickname: 'NOBI 漫友',
    avatar_url: 'http://127.0.0.1:4173/images/nobi-avatar.svg',
    parent_id: null
  };
  await mockRuntime(page, {
    posts: [post],
    sessionUser: { id: 'ad132ad0-10f7-4b05-9737-a6bd6ba76670', email: 'local@example.com' }
  });
  await page.goto('/community.html');
  const postCard = page.locator('#posts-list .post-card').first();
  await expect(postCard).toBeVisible({ timeout: 15_000 });
  await postCard.locator('.reply-action-btn').click();
  const fileInput = postCard.locator('.reply-image-input');
  await fileInput.setInputFiles({
    name: 'reply.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4S0AAAAASUVORK5CYII=',
      'base64'
    )
  });
  await expect(postCard.locator('.reply-image-preview')).toBeVisible();
  await expect(postCard.locator('.reply-image-preview__meta')).toContainText('reply.png');

  await postCard.locator('.reply-image-preview button').click();
  await expect(postCard.locator('.reply-image-preview')).toBeHidden();
  await fileInput.setInputFiles({
    name: 'reply.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4S0AAAAASUVORK5CYII=',
      'base64'
    )
  });
  await postCard.locator('.reply-input').fill('图文回复');
  await postCard.locator('.reply-submit').dblclick();

  await expect(postCard.locator('.reply-item')).toHaveCount(1);
  await expect(postCard.locator('.reply-image')).toBeVisible();
  const state = await page.evaluate(() => ({
    uploads: window.__replyUploads,
    inserts: window.__postInserts
  }));
  expect(state.uploads).toHaveLength(1);
  expect(state.inserts).toHaveLength(1);
  expect(state.inserts[0].image_path).toMatch(
    /^community-replies\/ad132ad0-10f7-4b05-9737-a6bd6ba76670\/[0-9a-f-]+\.png$/
  );
  expect(await postCard.locator('.reply-image').evaluate((image) => getComputedStyle(image).maxWidth)).toBe('320px');

  await fileInput.setInputFiles({
    name: 'image-only.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  });
  await postCard.locator('.reply-submit').click();
  await expect(postCard.locator('.reply-item')).toHaveCount(2);
  const imageOnlyState = await page.evaluate(() => ({
    uploads: window.__replyUploads,
    inserts: window.__postInserts
  }));
  expect(imageOnlyState.uploads).toHaveLength(2);
  expect(imageOnlyState.inserts[1].content).toBe('');
  expect(imageOnlyState.inserts[1].image_path).toMatch(/\.jpg$/);
});

test('community cleans uploaded reply images after an insert failure', async ({ page }) => {
  const post = {
    id: 42,
    user_id: '7cc08d1d-7a08-4291-8326-7c07aa9fe56a',
    created_at: '2026-09-21T01:00:00Z',
    content: '失败清理测试帖子。',
    nickname: 'NOBI 漫友',
    parent_id: null
  };
  await mockRuntime(page, {
    posts: [post],
    sessionUser: { id: 'ad132ad0-10f7-4b05-9737-a6bd6ba76670', email: 'local@example.com' },
    replyInsertError: true
  });
  await page.goto('/community.html');
  const postCard = page.locator('#posts-list .post-card').first();
  await postCard.locator('.reply-action-btn').click();
  await postCard.locator('.reply-image-input').setInputFiles({
    name: 'reply.webp',
    mimeType: 'image/webp',
    buffer: Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==', 'base64')
  });
  const dialogPromise = page.waitForEvent('dialog').then(async (dialog) => {
    const message = dialog.message();
    await dialog.dismiss();
    return message;
  });
  await postCard.locator('.reply-submit').click();
  const message = await dialogPromise;
  expect(message).toBe('回复发布失败，请稍后重试。');
  expect(message).not.toContain('mock reply insert failed');
  await expect.poll(() => page.evaluate(() => window.__replyRemovals.length)).toBe(1);
  expect(await page.evaluate(() => window.__replyUploads[0].path)).toBe(
    await page.evaluate(() => window.__replyRemovals[0].paths[0])
  );
  await expect(postCard.locator('.reply-item')).toHaveCount(0);
});

test('unauthenticated community users cannot upload reply images', async ({ page }) => {
  const post = {
    id: 42,
    user_id: '7cc08d1d-7a08-4291-8326-7c07aa9fe56a',
    created_at: '2026-09-21T01:00:00Z',
    content: '未登录上传测试帖子。',
    nickname: 'NOBI 漫友',
    parent_id: null
  };
  await mockRuntime(page, { posts: [post] });
  await page.goto('/community.html');
  const postCard = page.locator('#posts-list .post-card').first();
  await postCard.locator('.reply-action-btn').click();
  await postCard.locator('.reply-image-input').setInputFiles({
    name: 'reply.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  });
  page.once('dialog', (dialog) => dialog.dismiss());
  await postCard.locator('.reply-submit').click();
  expect(await page.evaluate(() => window.__replyUploads)).toHaveLength(0);
});

test('captures Phase 4.4 reply image UI at desktop and narrow widths', async ({ page }) => {
  const mainPost = {
    id: 42,
    user_id: '7cc08d1d-7a08-4291-8326-7c07aa9fe56a',
    created_at: '2026-09-21T01:00:00Z',
    content: '分享今天刚看完的新番，这一幕真的很美。',
    nickname: 'NOBI 漫友',
    avatar_url: 'http://127.0.0.1:4173/images/nobi-avatar.svg',
    title: '今日新番讨论',
    category: '新番',
    parent_id: null
  };
  const publishedReply = {
    id: 43,
    user_id: 'ad132ad0-10f7-4b05-9737-a6bd6ba76670',
    created_at: '2026-09-21T01:05:00Z',
    content: '同感，这张画面特别适合收藏。',
    nickname: 'local',
    avatar_url: 'http://127.0.0.1:4173/images/nobi-avatar.svg',
    parent_id: 42,
    image_path: 'community-replies/ad132ad0-10f7-4b05-9737-a6bd6ba76670/published.webp'
  };
  await mockRuntime(page, {
    posts: [mainPost, publishedReply],
    sessionUser: { id: 'ad132ad0-10f7-4b05-9737-a6bd6ba76670', email: 'local@example.com' }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/community.html');
  const postCard = page.locator('#posts-list .post-card').first();
  await expect(postCard).toBeVisible({ timeout: 15_000 });
  await postCard.locator('.reply-action-btn').click();
  await postCard.locator('.reply-image-input').setInputFiles('public/images/IMG_4873.webp');
  await expect(postCard.locator('.reply-image-preview')).toBeVisible();
  await expect(postCard.locator('.reply-image')).toBeVisible();
  await postCard.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/phase44-web-desktop-1440x900.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await postCard.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/phase44-web-narrow-390x844.png' });
});

test('detail images expose persistent overlay likes and still open in the accessible preview', async ({ page }) => {
  await mockRuntime(page, {
    features: true,
    sessionUser: { id: '7cc08d1d-7a08-4291-8326-7c07aa9fe56a', email: 'user@nobi.test' }
  });
  await page.goto('/detail.html?category=anime&slot=0');
  const image = page.locator('.gallery-item img').first();
  await expect(image).toBeVisible({ timeout: 15_000 });
  const likeButton = page.locator('.gallery-item .image-like-button--overlay').first();
  await expect(likeButton).toContainText('点赞0');
  await likeButton.click();
  await expect(likeButton).toContainText('已点赞1');
  await image.click({ position: { x: 16, y: 16 } });
  await expect(page.locator('#image-lightbox')).toBeVisible();
  await expect(page.locator('.image-lightbox__image')).toBeVisible();
  await expect(page.locator('.image-lightbox .image-like-button')).toContainText('已点赞 1');
});

test('signed-out image likes open the existing login flow without calling the toggle RPC', async ({ page }) => {
  await mockRuntime(page, { features: true });
  await page.goto('/detail.html?category=anime&slot=0');
  const likeButton = page.locator('.gallery-item .image-like-button--overlay').first();
  await expect(likeButton).toBeVisible({ timeout: 15_000 });
  await likeButton.click();
  await expect(page).toHaveURL(/index\.html\?auth=login$/);
});

for (const viewport of [
  { name: 'desktop-xl', width: 1920, height: 1080, columns: 6 },
  { name: 'desktop-lg', width: 1440, height: 900, columns: 6 },
  { name: 'desktop-compact', width: 1280, height: 800, columns: 6 },
  { name: 'desktop', width: 1366, height: 768, columns: 6 },
  { name: 'laptop', width: 1024, height: 768, columns: 3 },
  { name: 'tablet', width: 768, height: 1024, columns: 3 },
  { name: 'mobile-wide', width: 430, height: 932, columns: 2 },
  { name: 'mobile', width: 390, height: 844, columns: 2 },
  { name: 'mobile-compact', width: 375, height: 812, columns: 2 },
  { name: 'mobile-narrow', width: 320, height: 700, columns: 2 }
]) {
  test(`home rails stay aligned and scrollable without visible scrollbars on ${viewport.name}`, async ({ page }) => {
    await mockRuntime(page, { features: true });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/index.html');
    await expect(page.locator('.card__media').first()).toBeVisible({ timeout: 15_000 });
    const layout = await page.evaluate(() => {
      const heroElement = document.querySelector('.hero');
      const hero = heroElement.getBoundingClientRect();
      const headerElement = document.querySelector('.site-header');
      const header = headerElement.getBoundingClientRect();
      const homeContent = document.querySelector('.home-content').getBoundingClientRect();
      const heroContent = document.querySelector('.hero__content').getBoundingClientRect();
      const controls = document.querySelector('.hero__controls').getBoundingClientRect();
      const previousControl = document.querySelector('.hero__control--prev').getBoundingClientRect();
      const nextControl = document.querySelector('.hero__control--next').getBoundingClientRect();
      const cards = document.querySelector('.cards');
      const media = document.querySelector('.card__media')?.getBoundingClientRect();
      const footer = document.querySelector('.site-footer__inner');
      const footerNav = document.querySelector('.footer-nav');
      const footerNavLinks = document.querySelector('.footer-nav__links');
      const footerBrandTagline = document.querySelector('.footer-brand__tagline');
      const headerBrandTagline = document.querySelector('.logo__tagline');
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        heroLeft: hero.left,
        heroRight: hero.right,
        heroHeight: hero.height,
        viewport: document.documentElement.clientWidth,
        headerLeft: header.left,
        headerRight: header.right,
        headerPosition: getComputedStyle(headerElement).position,
        headerBackground: getComputedStyle(headerElement).backgroundColor,
        headerOverHero: header.top === hero.top && header.bottom > hero.top,
        homeContentLeft: homeContent.left,
        homeContentRight: homeContent.right,
        columns: getComputedStyle(cards).gridTemplateColumns.split(' ').length,
        cardMediaRatio: media ? media.width / media.height : 0,
        controlsInside: controls.top >= hero.top && controls.bottom <= hero.bottom,
        controlsAtBottom: hero.bottom - controls.bottom < 100,
        controlsTogether: nextControl.left - previousControl.right < 24,
        previousControlClearOfContent: controls.top > heroContent.top,
        paginationAtBottom:
          hero.bottom - document.querySelector('.hero__pagination').getBoundingClientRect().bottom < 110,
        heroRadius: getComputedStyle(heroElement).borderTopLeftRadius,
        heroBorderTop: getComputedStyle(heroElement).borderTopWidth,
        heroBorderBottom: getComputedStyle(heroElement).borderBottomWidth,
        heroBorderColor: getComputedStyle(heroElement).borderTopColor,
        heroBoxShadow: getComputedStyle(heroElement).boxShadow,
        footerColumns: getComputedStyle(footer).gridTemplateColumns.split(' ').length,
        footerNavTops: [...document.querySelectorAll('.footer-nav__links a')].map((link) =>
          Math.round(link.getBoundingClientRect().top)
        ),
        footerNavTextAlign: getComputedStyle(footerNav).textAlign,
        footerNavJustifyItems: getComputedStyle(footerNav).justifyItems,
        footerNavLinksJustifyContent: getComputedStyle(footerNavLinks).justifyContent,
        footerBrandTaglineFontSize: getComputedStyle(footerBrandTagline).fontSize,
        headerBrandTaglineFontSize: getComputedStyle(headerBrandTagline).fontSize,
        scrollbarWidth: getComputedStyle(document.documentElement).scrollbarWidth
      };
    });
    expect(layout.overflow).toBeLessThanOrEqual(1);
    const expectedGutter = viewport.width <= 768 ? 16 : Math.max(32, Math.round((viewport.width - 1440) / 2));
    expect(Math.round(layout.heroLeft)).toBe(0);
    expect(Math.round(layout.viewport - layout.heroRight)).toBe(0);
    expect(Math.round(layout.headerLeft)).toBe(0);
    expect(Math.round(layout.viewport - layout.headerRight)).toBe(0);
    expect(Math.round(layout.homeContentLeft)).toBe(expectedGutter);
    expect(Math.round(layout.viewport - layout.homeContentRight)).toBe(expectedGutter);
    const expectedHeroHeight = Math.max(viewport.height, viewport.width <= 768 ? 608 : 640);
    expect(layout.heroHeight).toBeGreaterThanOrEqual(expectedHeroHeight - 2);
    expect(layout.heroHeight).toBeLessThanOrEqual(expectedHeroHeight + 2);
    expect(layout.headerPosition).toBe('absolute');
    expect(layout.headerBackground).toBe('rgba(0, 0, 0, 0)');
    expect(layout.headerOverHero).toBe(true);
    expect(layout.columns).toBe(viewport.columns);
    expect(layout.cardMediaRatio).toBeGreaterThan(0.65);
    expect(layout.cardMediaRatio).toBeLessThan(0.68);
    expect(layout.controlsInside).toBe(true);
    expect(layout.controlsAtBottom).toBe(true);
    expect(layout.controlsTogether).toBe(true);
    expect(layout.previousControlClearOfContent).toBe(true);
    expect(layout.paginationAtBottom).toBe(true);
    expect(layout.heroRadius).toBe('0px');
    expect(layout.heroBorderTop).toBe('0px');
    expect(layout.heroBorderBottom).toBe('0px');
    expect(layout.heroBoxShadow).toBe('none');
    expect(layout.footerColumns).toBe(viewport.width > 1120 ? 2 : 1);
    expect(new Set(layout.footerNavTops).size).toBe(viewport.width > 768 ? 1 : 5);
    expect(layout.footerNavTextAlign).toBe('center');
    expect(layout.footerNavJustifyItems).toBe('center');
    expect(layout.footerNavLinksJustifyContent).toBe('center');
    expect(layout.footerBrandTaglineFontSize).toBe(layout.headerBrandTaglineFontSize);
    expect(layout.scrollbarWidth).toBe('none');
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
}
