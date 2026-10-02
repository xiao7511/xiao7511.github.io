import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

async function source(relative: string): Promise<string> {
  return readFile(new URL(relative, import.meta.url), 'utf8');
}

describe('Phase 4.5.1 integration', () => {
  test('protects every new administrator route with the existing guard metadata', async () => {
    const router = await source('../router/index.ts');
    expect(router).toContain("path: '/admin/content/:category(anime|manga)'");
    expect(router).toContain("path: '/admin/social'");
    expect(router.match(/requiresAdmin: true/g)?.length).toBeGreaterThanOrEqual(6);
  });

  test('uses one shared image-like store in libraries, cards and details', async () => {
    const sources = await Promise.all(
      [
        '../views/AnimeView.vue',
        '../views/MangaView.vue',
        '../views/ContentDetailView.vue'
      ].map(source)
    );
    for (const code of sources) expect(code).toContain('useImageLikesStore');
    expect(await source('../components/ContentCard.vue')).toContain('contentCoverLikeTarget');
  });

  test('keeps Phase 4.2 reply image code untouched by the new feature modules', async () => {
    const detail = await source('../views/PostDetailView.vue');
    expect(detail).toContain('uploadReplyImage');
    expect(detail).toContain('removeReplyImage');
  });
});
