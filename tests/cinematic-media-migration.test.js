import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

describe('Phase 4.7 optional media schema', () => {
  test('adds only a nullable canonical media field and verifies RLS', async () => {
    const migration = await readFile(
      new URL('../supabase/migrations/202610020001_cinematic_media.sql', import.meta.url),
      'utf8'
    );
    const verifier = await readFile(new URL('../supabase/verify_cinematic_media.sql', import.meta.url), 'utf8');
    expect(migration).toMatch(/alter table public\.content_management/);
    expect(migration).toMatch(/add column if not exists video_url text/);
    expect(migration).not.toMatch(/drop table|drop policy|disable row level security/i);
    expect(verifier).toMatch(/relrowsecurity/);
  });
});
