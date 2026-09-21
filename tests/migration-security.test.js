import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const migrationUrl = new URL('../supabase/migrations/202609210001_nobi_v2_engagement.sql', import.meta.url);
const preflightUrl = new URL('../supabase/production_preflight.sql', import.meta.url);
const verificationUrl = new URL('../supabase/verify_nobi_v2_engagement.sql', import.meta.url);

describe('NOBI engagement migration static security contract', () => {
  test('serializes page-view deduplication and indexes the lookup', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(sql).toContain('page_views_session_path_time_idx');
    expect(sql).toContain('(session_id, page_path, viewed_at desc)');
    expect(sql).toContain("split_part(split_part(btrim(p_page_path), '#', 1), '?', 1)");
    expect(sql).toContain("p_page_path ~ '[[:cntrl:]]'");
  });

  test('uses image keys, actor locks and partial uniqueness', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('public.nobi_storage_image_key');
    expect(sql).toContain('on public.image_likes (image_key, user_id)');
    expect(sql).toContain('on public.image_likes (image_key, anonymous_id)');
    expect(sql).toContain("actor_key || E'\\x1f' || p_image_key");
    expect(sql).toContain('Image target is not part of the current content record');
    expect(sql).toContain('detail.position - 1 = p_image_index');
    expect(sql).toContain('for share');
    expect(sql).toContain('image_likes_content_fk');
    expect(sql).toContain('image_likes_user_fk');
    expect(sql).toContain("constraint_row.confdeltype = 'c'");
  });

  test('caps summaries and never updates an existing features_v2 row', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('cardinality(p_image_keys) > 100');
    expect(sql).toContain("raise exception 'Invalid image key'");
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

  test('depends on the hardened is_admin function without redefining it', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).not.toMatch(/create\s+or\s+replace\s+function\s+public\.is_admin\s*\(/i);
    expect(sql).toContain("admin_function oid := pg_catalog.to_regprocedure('public.is_admin()')");
    expect(sql).toContain("pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'");
    expect(sql).toContain("procedure.proconfig = array['search_path=pg_catalog']");
    expect(sql).toContain("has_function_privilege('anon', 'public.is_admin()', 'EXECUTE')");
    expect(sql).toContain('auth.users and public.users mappings differ');
  });

  test('uses minimal search paths and fail-closed function ACL assertions', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).not.toContain('set search_path = pg_catalog, public');
    expect(sql.match(/set search_path = pg_catalog/g)).toHaveLength(5);
    expect(sql).toContain("('public.record_page_view(uuid,uuid,text)', true, true, true)");
    expect(sql).toContain("('public.get_admin_dashboard_stats()', true, false, true)");
    expect(sql).toContain("('public.nobi_storage_image_key(text)', false, false, false)");
    expect(sql).toContain('A browser role can directly mutate an engagement table');
  });

  test('builds seven continuous Shanghai calendar days including zero-view days', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain("shanghai_today date := (pg_catalog.now() at time zone 'Asia/Shanghai')::date");
    expect(sql).toContain('from pg_catalog.generate_series(0, 6) as series(day_offset)');
    expect(sql).toContain('left join public.page_views on page_views.viewed_on = calendar.day');
    expect(sql).toContain("raise exception 'Administrator access required' using errcode = '42501'");
  });

  test('provides a read-only post-deployment verification contract', async () => {
    const sql = await readFile(verificationUrl, 'utf8');
    const executableSql = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(executableSql).not.toMatch(/^\s*(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/im);
    expect(sql).toContain('can_insert_any_column');
    expect(sql).toContain('get_admin_dashboard_stats');
    expect(sql).toContain('nobi_storage_image_key');
    expect(sql).toContain('pg_catalog.pg_get_constraintdef');
    expect(sql).toContain("where section = 'features_v2'");
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
