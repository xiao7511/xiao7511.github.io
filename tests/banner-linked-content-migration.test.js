import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const migration = new URL('../supabase/migrations/202609290002_banner_linked_content.sql', import.meta.url);
const verify = new URL('../supabase/verify_banner_linked_content.sql', import.meta.url);

describe('Banner canonical content association migration', () => {
  test('adds only a nullable self-reference and never duplicates detail image fields', async () => {
    const sql = (await readFile(migration, 'utf8')).toLowerCase();
    expect(sql).toContain('add column if not exists linked_content_id uuid');
    expect(sql).toContain('references public.content_management(id)');
    expect(sql).toContain('on delete set null');
    expect(sql).not.toMatch(/banner_(?:detail_urls|gallery|detail_images)/);
  });

  test('ships read-only verification for the uuid column and self foreign key', async () => {
    const sql = (await readFile(verify, 'utf8')).toLowerCase();
    expect(sql).toContain("column_name = 'linked_content_id'");
    expect(sql).toContain("confrelid = 'public.content_management'::regclass");
    expect(sql).not.toMatch(/\b(?:insert|update|delete|drop|alter|grant|revoke|create)\b\s+(?:on|into|table|policy)/);
  });
});
