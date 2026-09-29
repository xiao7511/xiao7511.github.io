import { readFile } from 'node:fs/promises';
import { describe, expect, test, vi } from 'vitest';
import { updateProvisionedProfile } from '../public/assets/js/src/auth/profile.js';

const migrationUrl = new URL('../supabase/migrations/202609290003_unified_profile_provisioning.sql', import.meta.url);
const verifierUrl = new URL('../supabase/verify_profile_provisioning.sql', import.meta.url);
const phase452Url = new URL('../supabase/migrations/202609290001_profiles_update_rls_corrective.sql', import.meta.url);
const webRegistrationUrl = new URL('../public/assets/js/main.js', import.meta.url);

async function sql(url) {
  return (await readFile(url, 'utf8')).replace(/\r\n?/g, '\n').toLowerCase();
}

describe('Unified public profile provisioning', () => {
  test('preflights required objects, exact profile columns, created_at default and unique id', async () => {
    const migration = await sql(migrationUrl);
    for (const relation of ['auth.users', 'game.profiles', 'public.users', 'public.profiles']) {
      expect(migration).toContain(`to_regclass('${relation}')`);
    }
    for (const column of ['id', 'created_at', 'nickname', 'avatar_url']) expect(migration).toContain(`'${column}'`);
    expect(migration).toContain('column_default is not null');
    expect(migration).toContain('index_row.indisunique');
  });

  test('preserves game.profiles provisioning', async () => {
    expect(await sql(migrationUrl)).toContain('insert into game.profiles (id, email)\n  values (new.id, new.email)');
  });

  test('preserves public.users provisioning and false admin default', async () => {
    expect(await sql(migrationUrl)).toContain(
      'insert into public.users (id, email, is_admin)\n  values (new.id, new.email, false)'
    );
  });

  test('provisions the minimal public.profiles row from NEW.id', async () => {
    expect(await sql(migrationUrl)).toContain('insert into public.profiles (id)\n  values (new.id)');
  });

  test('contains no nonexistent avatar column assumption', async () => {
    expect(await sql(migrationUrl)).not.toMatch(/\bavatar\b/);
  });

  test('contains no public.profiles.is_admin assumption', async () => {
    expect(await sql(migrationUrl)).not.toMatch(/profiles\.is_admin|public\.profiles[^;]*is_admin/);
  });

  test('does not overwrite an existing nickname or avatar_url', async () => {
    const migration = await sql(migrationUrl);
    expect(migration).toContain('on conflict (id) do nothing');
    expect(migration).not.toMatch(/on conflict[^;]+do update/);
    expect(migration).not.toMatch(/update\s+public\.profiles/);
  });

  test('backfills only auth users missing public.profiles', async () => {
    const migration = await sql(migrationUrl);
    expect(migration).toMatch(
      /insert into public\.profiles \(id\)\s+select auth_user\.id\s+from auth\.users as auth_user\s+where not exists/
    );
    expect(migration).toContain('where public_profile.id = auth_user.id');
  });

  test('ships a read-only verifier that detects missing profile rows', async () => {
    const verifier = await sql(verifierUrl);
    expect(verifier).toContain("select 'auth_users_missing_public_profiles'");
    expect(verifier).toContain('where public_profile.id is null');
    expect(verifier).toContain("then 'fail' else 'pass'");
    expect(verifier).not.toMatch(/^\s*(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/im);
  });

  test('normalizes information_schema domains before profile schema comparisons', async () => {
    const verifier = await sql(verifierUrl);
    expect(verifier).toContain('array_agg(columns.column_name::text order by columns.column_name::text) as names');
    expect(verifier).not.toMatch(/array_agg\(columns\.column_name\s+order by columns\.column_name\)/);
    for (const value of ['table_schema', 'table_name', 'column_name', 'data_type', 'is_nullable']) {
      expect(verifier).toContain(`${value}::text`);
    }
    expect(verifier).toContain("is distinct from array['avatar_url', 'created_at', 'id', 'nickname']::text[]");
  });

  test('preserves the complete read-only provisioning verifier contract', async () => {
    const verifier = await sql(verifierUrl);
    for (const finding of [
      'handle_new_user_missing',
      'handle_new_user_security_configuration',
      'handle_new_user_profile_provisioning',
      'auth_user_trigger_missing',
      'auth_user_trigger_wrong_function',
      'profiles_schema_mismatch',
      'profiles_created_at_default_missing',
      'auth_users_missing_public_profiles',
      'handle_new_user_browser_execute'
    ]) {
      expect(verifier).toContain(finding);
    }
    expect(verifier).toContain('prosecdef');
    expect(verifier).toContain("proconfig = array['search_path=pg_catalog']");
    expect(verifier).toContain("trigger_row.tgname = 'on_auth_user_created'");
    expect(verifier).toContain("definition ilike '%after insert%'");
    for (const target of ['game.profiles', 'public.users', 'public.profiles']) {
      expect(verifier).toContain(`insert into ${target}`);
    }
    expect(verifier).toContain('on conflict (id) do nothing');
  });

  test('keeps handle_new_user SECURITY DEFINER with a hardened search_path', async () => {
    const migration = await sql(migrationUrl);
    expect(migration).toContain('security definer\nset search_path = pg_catalog');
    expect(migration).toContain("procedure.proconfig = array['search_path=pg_catalog']");
    expect(migration).toContain('revoke all on function public.handle_new_user() from public, anon, authenticated');
  });

  test('keeps on_auth_user_created as the single canonical trigger instead of creating another', async () => {
    const migration = await sql(migrationUrl);
    expect(migration).toContain("trigger_row.tgname = 'on_auth_user_created'");
    expect(migration).toContain("trigger_row.tgfoid = 'public.handle_new_user()'::regprocedure");
    expect(migration).not.toMatch(/create\s+(?:or replace\s+)?trigger/);
  });

  test('does not alter the deployed Phase 4.5.2 profiles UPDATE boundary', async () => {
    const migration = await sql(migrationUrl);
    const phase452 = await sql(phase452Url);
    expect(migration).not.toMatch(/(?:create|drop)\s+policy|grant\s+update|revoke\s+update/);
    expect(phase452).toContain('grant update (nickname, avatar_url) on table public.profiles to authenticated');
    expect(phase452).toContain('using (auth.uid() = id)\nwith check (auth.uid() = id)');
  });

  test('Web registration updates the database-provisioned row without inserting a duplicate', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ update })) };
    await updateProvisionedProfile(client, 'user-1', { nickname: 'NOBI', avatarUrl: 'https://example.test/a.webp' });
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({ nickname: 'NOBI', avatar_url: 'https://example.test/a.webp' });
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    const source = await readFile(webRegistrationUrl, 'utf8');
    expect(source).toContain('updateProvisionedProfile(window.supabaseClient');
    expect(source).not.toMatch(/\.from\(['"]profiles['"]\)\s*\.insert/);
  });

  test('Web profile metadata update fails closed when database provisioning is missing', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) }))
        }))
      }))
    };
    await expect(updateProvisionedProfile(client, 'user-1', { nickname: 'NOBI', avatarUrl: null })).rejects.toThrow(
      'PROFILE_NOT_PROVISIONED'
    );
  });
});
