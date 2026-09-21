import { expect, test } from '@playwright/test';

test.describe('live backend integration', () => {
  test.skip(process.env.LIVE_TEST !== '1', 'Run explicitly with LIVE_TEST=1 when network access is available.');

  test('loads real content, community data and image preview without request errors', async ({ page }) => {
    const consoleErrors = [];
    const badResponses = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && /nobistudio\.com|127\.0\.0\.1/.test(response.url())) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/index.html');
    await expect(page.locator('#anime-container .card').first()).toBeVisible({ timeout: 20_000 });
    expect(await page.locator('#anime-container .card').count()).toBeLessThanOrEqual(6);
    expect(await page.locator('#manga-container .card').count()).toBeLessThanOrEqual(6);

    await page.goto('/recommend.html');
    await expect(page.locator('#dynamic-recommend-container .card').first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/manga.html');
    await expect(page.locator('#dynamic-manga-container .manga-item').first()).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() =>
        page
          .locator('#dynamic-manga-container img')
          .evaluateAll((images) =>
            images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
          )
      )
      .toBe(true);

    await page.goto('/community.html');
    await expect(page.locator('#posts-list .post-card').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.like-action-btn').first()).toBeVisible();
    const dialogPromise = page.waitForEvent('dialog');
    const likeClickPromise = page.locator('.like-action-btn').first().click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('请先登录');
    await dialog.dismiss();
    await likeClickPromise;

    await page.goto('/detail.html?category=anime&slot=0');
    const detailImage = page.locator('.gallery-item img').first();
    await expect(detailImage).toBeVisible({ timeout: 20_000 });
    await detailImage.click();
    await expect(page.locator('#image-lightbox')).toBeVisible();

    expect(badResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
