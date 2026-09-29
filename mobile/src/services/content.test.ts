import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchContent } from './content';

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
});
