import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const migrationUrl = new URL('../supabase/migrations/202609210001_nobi_v2_engagement.sql', import.meta.url);
const preflightUrl = new URL('../supabase/production_preflight.sql', import.meta.url);

describe('NOBI engagement migration static security contract', () => {
  test('serializes page-view deduplication and indexes the lookup', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(sql).toContain('page_views_session_path_time_idx');
    expect(sql).toContain('(session_id, page_path, viewed_at desc)');
    expect(sql).toContain("split_part(split_part(btrim(p_page_path), '#', 1), '?', 1)");
  });

  test('uses image keys, actor locks and partial uniqueness', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('public.nobi_storage_image_key');
    expect(sql).toContain('on public.image_likes (image_key, user_id)');
    expect(sql).toContain('on public.image_likes (image_key, anonymous_id)');
    expect(sql).toContain("actor_key || E'\\x1f' || p_image_key");
    expect(sql).toContain('Image target is not part of the current content record');
    expect(sql).toContain('detail.position - 1 = p_image_index');
  });

  test('caps summaries and never updates an existing features_v2 row', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('cardinality(p_image_keys) > 100');
    expect(sql).toContain("where config.section = 'features_v2'");
    expect(sql).not.toMatch(/on conflict\s*\(section\)\s*do update/i);
    expect(sql).not.toContain('post_likes_post_id_idx');
  });

  test('fails closed when production authorization or uniqueness prerequisites are missing', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('class.relrowsecurity');
    expect(sql).toContain("has_column_privilege('authenticated', 'public.users', 'is_admin', 'UPDATE')");
    expect(sql).toContain("('public.site_config', 'section')");
    expect(sql).toContain('public.site_config contains duplicate section values');
  });

  test('keeps the production preflight read-only', async () => {
    const sql = await readFile(preflightUrl, 'utf8');
    const executableSql = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(executableSql).not.toMatch(/^\s*(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/im);
    expect(executableSql).toContain("tablename in ('users', 'site_config')");
    expect(executableSql).toContain("table_name = 'site_config'");
    expect(executableSql).toContain('having count(*) > 1');
  });
});
