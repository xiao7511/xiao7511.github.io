import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchContent, fetchContentDetail } from './content';
import { readFile } from 'node:fs/promises';

function item(id: string, category: string, slot: number, changes = {}) {
  return { id, category, slot_index: slot, title: `${category} ${id}`, is_active: true, ...changes };
}

describe('content library API normalization', () => {
  afterEach(() => vi.unstubAllGlobals());

  test.each([
    ['recommend', 'anime'],
    ['manga', 'manga']
  ] as const)('%s API returns only canonical deterministic %s records', async (path, category) => {
    const rows = [
      item('z', category, 1),
      item('a', category, 0, { is_active: null }),
      item('a', category, 4),
      item('off', category, 2, { is_active: false }),
      item('wrong', category === 'anime' ? 'manga' : 'anime', 0),
      item('', category, 3)
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    );
    await expect(fetchContent(path)).resolves.toMatchObject([
      { id: 'a', category, slot_index: 0 },
      { id: 'z', category, slot_index: 1 }
    ]);
  });

  test.each([
    ['anime', 4, item('anime-id', 'anime', 4)],
    ['manga', 2, item('manga-id', 'manga', 2)]
  ] as const)('resolves canonical %s detail at the routed slot', async (category, slot, payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ));
    await expect(fetchContentDetail(category, slot)).resolves.toMatchObject({ id: payload.id, category, slot_index: slot });
  });

  test('rejects inactive or malformed detail routes instead of returning another record', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(item('off', 'anime', 0, { is_active: false })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    await expect(fetchContentDetail('anime', 0)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(fetchContentDetail('manga', -1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  test('content detail route watches route identity and ignores stale async results', async () => {
    const source = await readFile(new URL('../views/ContentDetailView.vue', import.meta.url), 'utf8');
    expect(source).toContain('let loadSequence = 0');
    expect(source).toContain('if (sequence !== loadSequence) return');
    expect(source).toContain('watch(() => route.fullPath, load)');
    expect(source).toContain('banner.is_active === false');
    expect(source).toContain('parseRouteInteger(route.params.slot)');
    expect(source).toContain('slot >= WEB_HOME_BANNER_SLOTS');
  });
});
