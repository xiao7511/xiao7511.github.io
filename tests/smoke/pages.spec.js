import { expect, test } from '@playwright/test';

const pages = [
  ['/index.html', 'body'],
  ['/recommend.html', '#dynamic-recommend-container'],
  ['/manga.html', '#dynamic-manga-container'],
  ['/community.html', '#posts-list'],
  ['/detail.html?category=anime&slot=0', '#gallery-stream']
];
for (const [path, selector] of pages) {
  test(`${path} renders its application shell`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator(selector)).toBeVisible();
  });
}
