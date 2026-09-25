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

async function mockRuntime(
  page,
  { posts = [], features = false, socialLinks = false, contentCount = 6, sessionUser = null } = {}
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
    id: `d9428888-122b-4f20-9f6c-25789ab0a12${index}`,
    slot_index: index,
    title: `测试动漫 ${index + 1}`
  }));
  const mangaRecords = Array.from({ length: contentCount }, (_, index) => ({
    ...contentRecord,
    id: `8d99585e-379d-46d0-99c1-0eb2a32a3aa${index}`,
    category: 'manga',
    slot_index: index,
    title: `测试漫画 ${index + 1}`
  }));
  const records = [
    ...animeRecords,
    ...mangaRecords,
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
            site_config: [
              ...(features ? [{ section: 'features_v2', url: '{"analytics":true,"imageLikes":true}' }] : []),
              ...(socialLinks
                ? [
                    {
                      section: 'social_links',
                      url: '{"xiaohongshu":"https://www.xiaohongshu.com/user/profile/nobi","weibo":"https://weibo.com/nobi","twitter":"https://x.com/nobi","instagram":"https://www.instagram.com/nobi"}'
                    }
                  ]
                : [])
            ]
          })};
          const currentSession = ${JSON.stringify(session)};
          let imageLiked = false;
          let postLiked = false;
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

test('home renders all six configured enriched cards per section', async ({ page }) => {
  const messages = [];
  page.on('console', (message) => messages.push(`${message.type()}: ${message.text()}`));
  await mockRuntime(page, { features: true });
  await page.goto('/index.html');
  await expect(page.locator('.logo')).toContainText('NOBI');
  await expect(page.locator('.logo')).toContainText('动漫');
  await expect(page.locator('#anime-container .card').first(), messages.join('\n')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#anime-container .card')).toHaveCount(6);
  await expect(page.locator('#manga-container .card')).toHaveCount(6);
  await expect(page.locator('#anime-container .card__type').first()).toHaveText('动漫');
  await expect(page.locator('#anime-container .card__year').first()).toHaveText('2024');
  await expect(page.locator('#anime-container .card__like-count').first()).toHaveText('4');
  await expect(page.locator('#anime-container .image-like-button--inline').first()).toHaveAttribute(
    'data-image-like-summary-keys',
    JSON.stringify([imageKey, secondDetailImageKey])
  );
  await expect(page.locator('#anime-container .image-like-button--overlay')).toHaveCount(0);
  const inlineLike = page.locator('#anime-container .image-like-button--inline').first();
  await expect(inlineLike).toBeVisible();
  await inlineLike.click();
  await expect(inlineLike).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#anime-container .card__like-count').first()).toHaveText('5');
  const [mediaBounds, likeBounds] = await Promise.all([
    page.locator('#anime-container .card__media').first().boundingBox(),
    inlineLike.boundingBox()
  ]);
  expect(likeBounds.y).toBeGreaterThanOrEqual(mediaBounds.y + mediaBounds.height);
});

test('home keeps six grid positions when fewer than six items are configured', async ({ page }) => {
  await mockRuntime(page, { features: true, contentCount: 4 });
  await page.goto('/index.html');
  await expect(page.locator('#anime-container .card')).toHaveCount(6);
  await expect(page.locator('#anime-container .card:not(.card--empty)')).toHaveCount(4);
  await expect(page.locator('#anime-container .card--empty')).toHaveCount(2);
  await expect(page.locator('#manga-container .card')).toHaveCount(6);
  await expect(page.locator('#manga-container .card:not(.card--empty)')).toHaveCount(4);
  await expect(page.locator('#manga-container .card--empty')).toHaveCount(2);
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

test('home hero aligns with the content rail and configured social icons render in the footer social column', async ({
  page
}) => {
  await mockRuntime(page, { socialLinks: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/index.html');
  const bounds = await page.locator('.hero').evaluate((hero) => {
    const rect = hero.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: document.documentElement.clientWidth };
  });
  expect(bounds.left).toBe(32);
  expect(bounds.right).toBe(1334);
  await page.locator('.hero__control--next').click();
  await expect(page.locator('.hero__slide').nth(1)).toHaveClass(/is-active/);
  await expect(page.locator('.hero__pagination b')).toHaveText('02 / 03');
  const social = page.locator('.footer-social');
  await expect(social.locator('.footer-social__link')).toHaveCount(4);
  await expect(social).toBeVisible();
  await expect(page.locator('.footer-social-slot')).toContainText('社交媒体');
  await expect(page.locator('.footer-social-slot .footer-social')).toHaveCount(1);
  await expect(social.locator('[data-social-platform="xiaohongshu"]')).toHaveCSS('color', 'rgb(255, 36, 66)');
  await expect(social.locator('[data-social-platform="weibo"]')).toHaveCSS('color', 'rgb(230, 22, 45)');
  await expect(social.locator('[data-social-platform="twitter"]')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(social.locator('[data-social-platform="instagram"]')).toHaveCSS('color', 'rgb(225, 48, 108)');
  expect(
    await social
      .locator('[data-social-platform="instagram"] svg path')
      .evaluate((icon) => getComputedStyle(icon).fill.includes('url'))
  ).toBe(true);
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

test('detail images expose persistent overlay likes and still open in the accessible preview', async ({ page }) => {
  await mockRuntime(page, { features: true });
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

for (const viewport of [
  { name: 'desktop-xl', width: 1920, height: 1080, columns: 6, heroMin: 499, heroMax: 501 },
  { name: 'desktop-lg', width: 1440, height: 900, columns: 6, heroMin: 452, heroMax: 455 },
  { name: 'desktop', width: 1366, height: 768, columns: 6, heroMin: 429, heroMax: 432 },
  { name: 'laptop', width: 1024, height: 768, columns: 4, heroMin: 398, heroMax: 401 },
  { name: 'tablet', width: 768, height: 1024, columns: 3, heroMin: 367, heroMax: 369 },
  { name: 'mobile', width: 390, height: 844, columns: 2, heroMin: 359, heroMax: 361 }
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
        headerHeroGap: hero.top - header.bottom,
        homeContentLeft: homeContent.left,
        homeContentRight: homeContent.right,
        columns: getComputedStyle(cards).gridTemplateColumns.split(' ').length,
        cardMediaRatio: media ? media.width / media.height : 0,
        controlsInside: controls.top >= hero.top && controls.bottom <= hero.bottom,
        previousControlNearLeft: previousControl.left - hero.left < 48,
        nextControlNearRight: hero.right - nextControl.right < 48,
        controlsSeparated: nextControl.left - previousControl.right > hero.width * 0.6,
        previousControlClearOfContent:
          document.documentElement.clientWidth <= 768 || previousControl.right <= heroContent.left,
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
    const expectedGutter = viewport.width <= 768 ? 16 : Math.max(32, Math.round((viewport.width - 1320) / 2));
    expect(Math.round(layout.heroLeft)).toBe(expectedGutter);
    expect(Math.round(layout.viewport - layout.heroRight)).toBe(expectedGutter);
    expect(Math.round(layout.headerLeft)).toBe(expectedGutter);
    expect(Math.round(layout.viewport - layout.headerRight)).toBe(expectedGutter);
    expect(Math.round(layout.homeContentLeft)).toBe(expectedGutter);
    expect(Math.round(layout.viewport - layout.homeContentRight)).toBe(expectedGutter);
    expect(layout.heroHeight).toBeGreaterThanOrEqual(viewport.heroMin);
    expect(layout.heroHeight).toBeLessThanOrEqual(viewport.heroMax);
    expect(layout.headerPosition).toBe('relative');
    expect(layout.headerBackground).toBe('rgba(0, 0, 0, 0)');
    expect(layout.headerHeroGap).toBeCloseTo(0, 0);
    expect(layout.columns).toBe(viewport.columns);
    expect(layout.cardMediaRatio).toBeGreaterThan(1.32);
    expect(layout.cardMediaRatio).toBeLessThan(1.35);
    expect(layout.controlsInside).toBe(true);
    expect(layout.previousControlNearLeft).toBe(true);
    expect(layout.nextControlNearRight).toBe(true);
    expect(layout.controlsSeparated).toBe(true);
    expect(layout.previousControlClearOfContent).toBe(true);
    expect(layout.heroBorderTop).toBe('1px');
    expect(layout.heroBorderBottom).toBe('1px');
    expect(layout.heroBorderColor).toBe('rgba(101, 184, 255, 0.06)');
    expect(layout.heroBoxShadow).not.toBe('none');
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
