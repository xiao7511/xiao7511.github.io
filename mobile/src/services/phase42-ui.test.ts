import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { buildHomeData, MOBILE_HOME_SECTION_LIMIT } from './home';

async function source(relative: string): Promise<string> {
  return readFile(new URL(relative, import.meta.url), 'utf8');
}

describe('Phase 4.2 mobile alignment', () => {
  test('limits both home feature grids to four real records and renders session identity', async () => {
    const view = await source('../views/HomeView.vue');
    const rows = ['anime', 'manga'].flatMap((category) =>
      Array.from({ length: 6 }, (_, slot_index) => ({
        id: `${category}-${slot_index}`,
        category,
        slot_index,
        title: `${category} ${slot_index}`
      }))
    );
    const data = buildHomeData([], rows);
    expect(MOBILE_HOME_SECTION_LIMIT).toBe(4);
    expect(data.popular).toHaveLength(4);
    expect(data.recommendations).toHaveLength(4);
    expect(view).toContain("useAuthStore");
    expect(view).toContain("auth.profile?.avatar_url");
    expect(view).toContain("auth.user.email?.split('@')[0]");
  });

  test('uses local SVG social icons with configured links', async () => {
    const [view, icon] = await Promise.all([source('../views/HomeView.vue'), source('../components/SocialIcon.vue')]);
    expect(view).toContain(':href="link.href"');
    expect(view).toContain('<SocialIcon :name="link.key"');
    expect(icon).toContain('<svg');
  });

  test('keeps three-column libraries and iPhone safe-area spacing', async () => {
    const [phase42, ios] = await Promise.all([source('../style-phase42.css'), source('../style-ios.css')]);
    expect(phase42).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(phase42).toContain('aspect-ratio: 3 / 4');
    expect(ios).toContain('env(safe-area-inset-bottom)');
  });
});
