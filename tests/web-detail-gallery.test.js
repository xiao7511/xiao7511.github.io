import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, test } from 'vitest';
globalThis.location = { hostname: 'nobistudio.com', href: 'https://www.nobistudio.com/detail.html' };
globalThis.window = { location: globalThis.location, SiteConfig: {} };
const { normalizeDetailGallery, resolveDetailRecord } = await import('../public/assets/js/src/pages/detail.js');
const { mapImageLikeSummaries } = await import('../public/assets/js/src/images/likes.js');

function item(id, category, slot, changes = {}) {
  return { id, category, slot_index: slot, title: `Title ${id}`, is_active: true, ...changes };
}

describe('Anime and Manga detail contract', () => {
  afterEach(() => {
    delete globalThis.window;
    delete globalThis.location;
  });

  test.each(['anime', 'manga'])('resolves the same canonical %s library record by category and slot', (category) => {
    const rows = [
      item('z', category, 1),
      item('b', category, 0),
      item('a', category, 0),
      item('inactive', category, 2, { is_active: false }),
      item('wrong', category === 'anime' ? 'manga' : 'anime', 3)
    ];
    expect(resolveDetailRecord(rows, category, 0)?.id).toBe('a');
  });

  test('fails invalid category, route, missing slot, and inactive content safely', () => {
    expect(resolveDetailRecord([item('active', 'anime', 0)], 'banner', 0)).toBeNull();
    expect(resolveDetailRecord([item('active', 'anime', 0)], 'anime', '2x')).toBeNull();
    expect(resolveDetailRecord([item('off', 'anime', 0, { is_active: false })], 'anime', 0)).toBeNull();
    expect(resolveDetailRecord([], 'manga', 0)).toBeNull();
    for (const malformed of [' 1', '01', '+1', '1.0', '1e2', '-1', '1000']) {
      expect(resolveDetailRecord([item('active', 'anime', 1)], 'anime', malformed)).toBeNull();
    }
  });

  test('normalizes malformed per-image like counts and keeps independent liked states', () => {
    const summaries = mapImageLikeSummaries([
      { image_key: 'images/cover.webp', like_count: 8, liked: true },
      { image_key: 'images/gallery.webp', like_count: -4, liked: false },
      { image_key: 'images/bad.webp', like_count: 'NaN', liked: 'true' },
      null
    ]);
    expect(summaries.get('images/cover.webp')).toEqual({ count: 8, liked: true });
    expect(summaries.get('images/gallery.webp')).toEqual({ count: 0, liked: false });
    expect(summaries.get('images/bad.webp')).toEqual({ count: 0, liked: false });
  });

  test('keeps Gallery order, ignores malformed entries, and deduplicates Storage identity including Cover', () => {
    globalThis.location = { hostname: 'nobistudio.com', href: 'https://www.nobistudio.com/detail.html' };
    globalThis.window = { location: globalThis.location, SiteConfig: {} };
    const gallery = normalizeDetailGallery(
      [
        null,
        'https://api.nobistudio.com/storage/v1/object/public/images/cover.webp?v=9',
        'https://api.nobistudio.com/storage/v1/object/public/images/a.webp?x=1',
        'https://api.nobistudio.com/storage/v1/object/public/images/a.webp?x=2',
        'https://api.nobistudio.com/storage/v1/object/public/images/b.webp',
        'javascript:alert(1)',
        'https://untrusted.example/not-image.txt'
      ],
      'https://project.supabase.co/storage/v1/object/public/images/cover.webp'
    );
    expect(gallery).toEqual([
      { url: 'https://api.nobistudio.com/storage/v1/object/public/images/a.webp?x=1', index: 2 },
      { url: 'https://api.nobistudio.com/storage/v1/object/public/images/b.webp', index: 4 }
    ]);
  });

  test('uses the existing canonical like RPC, separate cover/gallery identity, and a fallback without innerHTML', async () => {
    const [page, database, likesMigration, verifier, likeUi] = await Promise.all([
      readFile(new URL('../public/assets/js/src/pages/detail.js', import.meta.url), 'utf8'),
      readFile(
        new URL('../supabase/migrations/202609280002_image_likes_and_content_admin.sql', import.meta.url),
        'utf8'
      ),
      readFile(new URL('../supabase/migrations/202609210001_nobi_v2_engagement.sql', import.meta.url), 'utf8'),
      readFile(new URL('../supabase/verify_image_likes_and_content_admin.sql', import.meta.url), 'utf8'),
      readFile(new URL('../public/assets/js/src/site-v2.js', import.meta.url), 'utf8')
    ]);
    expect(page).toContain("'data-image-kind': 'cover'");
    expect(page).toContain("'data-image-kind': 'detail'");
    expect(page).toContain("'data-image-index': String(index)");
    expect(page).toContain("setImageSource(image, url, 'images/IMG_4893.webp')");
    expect(page).toContain('selectCanonicalContent(rows, category)');
    expect(page).not.toContain('innerHTML');
    expect(database).toContain('public.get_image_like_summary(text[],uuid)');
    expect(database).toContain('public.toggle_image_like(uuid, text, integer, text, uuid)');
    expect(database).toContain('current_user_id is null');
    expect(likesMigration).toContain('image_likes_user_unique_idx');
    expect(verifier).toContain('TOGGLE_RPC_ACL');
    expect(verifier).toContain('IMAGE_LIKES_USER_UNIQUE');
    expect(likeUi).toContain("label.textContent = '点赞失败'");
  });
});
