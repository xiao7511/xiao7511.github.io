import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

async function source(relative: string): Promise<string> {
  return readFile(new URL(relative, import.meta.url), 'utf8');
}

describe('Phase 4.5.2 UI integration', () => {
  test('adds previewed image replacement to all three administrator sections', async () => {
    const [banners, content, editor, service] = await Promise.all([
      source('../views/AdminBannersView.vue'),
      source('../views/AdminContentView.vue'),
      source('../components/AdminContentImageEditor.vue'),
      source('./admin-image.ts')
    ]);
    expect(banners).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(banners).toContain('previewUrls');
    for (const view of [banners, content]) expect(view).toContain('AdminContentImageEditor');
    expect(editor).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(editor).toContain('coverPreview');
    expect(editor).toContain('saveAdminContentImage');
    expect(service).toContain('client.storage.from(CONTENT_IMAGE_BUCKET)');
    expect(service).toContain(".from('content_management')");
    expect(service).toContain('await bucket.remove([path])');
    expect(service).toContain('upsert: false');
    expect(service).not.toMatch(/remove\(\[.*previous|oldPath/);
    expect(editor).toContain('saveAdminDetailGallery');
    expect(editor).toContain('galleryDraft');
    expect(service).toContain('.update({ detail_urls: nextUrls');
    expect(service).toContain("contentImageObjectPath(item, extension, 'gallery')");
  });

  test('persists the same detail_urls field that Detail renders and keeps related-card navigation', async () => {
    const [adminService, detail, card] = await Promise.all([
      source('./admin-image.ts'),
      source('../views/ContentDetailView.vue'),
      source('../components/ContentCard.vue')
    ]);
    expect(adminService).toContain('detail_urls: nextUrls');
    expect(detail).toContain('item.value?.detail_urls');
    expect(detail).toContain('<ContentCard v-for="entry in related"');
    expect(card).toContain(':to="`/${item.category}/${item.id}`"');
    expect(detail).toContain('watch(() => route.fullPath, load)');
  });

  test('renders one independent gallery overlay target without replacing image viewing', async () => {
    const [detail, likes, css] = await Promise.all([
      source('../views/ContentDetailView.vue'),
      source('./image-likes.ts'),
      source('../style-phase451.css')
    ]);
    expect(detail).toContain('contentDetailLikeTargets');
    expect(detail).toContain('imageLikes.toggleTarget(target)');
    expect(detail).toContain('@click.stop="toggleGalleryLike(entry.target)"');
    expect(detail).toContain('<ContentImage :src="entry.url"');
    expect(likes).toContain("kind: 'banner' | 'cover' | 'detail'");
    expect(css).toContain('min-width: 44px');
    expect(css).toContain('min-height: 44px');
  });

  test('keeps social config ordering while presenting icon-only safe external links', async () => {
    const [home, data, mobileIcons, webIcons] = await Promise.all([
      source('../views/HomeView.vue'),
      source('./home.ts'),
      source('../components/SocialIcon.vue'),
      source('../../../public/assets/js/src/site-v2.js')
    ]);
    expect(home).toContain('<SocialIcon :name="link.key"');
    expect(home).toContain(':aria-label="link.label"');
    expect(home).toContain('rel="noopener noreferrer"');
    expect(home).not.toContain('<span>{{ link.label }}</span>');
    expect(data).toContain('parseSocialSettings(value)');
    expect(data).toContain('if (!item.enabled || !item.url || !isValidSocialUrl(item.url, item.key)) return []');
    const paths = (value: string) => [...value.matchAll(/<path\s+d="([^"]+)"/g)].map((match) => match[1]);
    expect(paths(mobileIcons)).toEqual(paths(webIcons).slice(0, 4));
    for (const value of ['#ffd600', '#ff7a00', '#ff0169', '#d300c5']) {
      expect(mobileIcons).toContain(value);
      expect(webIcons).toContain(value);
    }
  });
});
