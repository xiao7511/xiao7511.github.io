import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { createAasa } from '../scripts/generate-aasa.mjs';
import {
  applyWorkerCors,
  handleWorkerPreflight,
  isAllowedWorkerOrigin,
  WORKER_ALLOWED_ORIGINS
} from '../scripts/worker-cors.mjs';

describe('external Worker CORS deployment helper', () => {
  test('allows only the reviewed production and Capacitor origins', () => {
    expect(WORKER_ALLOWED_ORIGINS).toHaveLength(5);
    expect(isAllowedWorkerOrigin('capacitor://localhost')).toBe(true);
    expect(isAllowedWorkerOrigin('https://evil.example')).toBe(false);
  });

  test('rejects an evil preflight without credentials or allow-origin', async () => {
    const response = handleWorkerPreflight(
      new Request('https://api.nobistudio.com/api/recommend', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' }
      })
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
    expect(response.headers.get('vary')).toBe('Origin');
  });

  test('adds exact-origin CORS headers to an allowed response', async () => {
    const request = new Request('https://api.nobistudio.com/api/recommend', {
      headers: { Origin: 'https://www.nobistudio.com' }
    });
    const response = applyWorkerCors(
      request,
      new Response('{}', { headers: { 'Content-Type': 'application/json', Vary: 'Accept-Encoding' } })
    );
    expect(response.headers.get('access-control-allow-origin')).toBe('https://www.nobistudio.com');
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
    expect(response.headers.get('vary')).toBe('Accept-Encoding, Origin');
    expect(await response.text()).toBe('{}');
  });
});

describe('AASA preparation', () => {
  test('requires a real Apple Team ID and emits only supported routes', () => {
    expect(() => createAasa('TEAM_ID')).toThrow('APPLE_TEAM_ID');
    expect(createAasa('A1B2C3D4E5')).toEqual({
      applinks: {
        details: [
          {
            appIDs: ['A1B2C3D4E5.com.nobistudio.app'],
            components: [
              { '/': '/anime/????????-????-????-????-????????????' },
              { '/': '/manga/????????-????-????-????-????????????' },
              { '/': '/community/?*' }
            ]
          }
        ]
      }
    });
  });

  test('wires only the NOBI Universal Links domain into both Xcode configurations', async () => {
    const project = await readFile(new URL('../mobile/ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
    const entitlements = await readFile(new URL('../mobile/ios/App/App/App.entitlements', import.meta.url), 'utf8');
    expect(project.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g)).toHaveLength(2);
    expect(entitlements).toContain('<key>com.apple.developer.associated-domains</key>');
    expect(entitlements).toContain('<string>applinks:www.nobistudio.com</string>');
    expect(entitlements).not.toContain('push');
    expect(entitlements).not.toContain('icloud');
  });
});

describe('Phase 4 trust and safety SQL', () => {
  const migrationUrl = new URL('../supabase/migrations/202609270001_phase4_trust_safety.sql', import.meta.url);
  const verificationUrl = new URL('../supabase/verify_phase4_trust_safety.sql', import.meta.url);

  test('uses RLS, authenticated RPCs and admin-only moderation', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('alter table public.post_reports enable row level security');
    expect(sql).toContain('function public.report_post');
    expect(sql).toContain('function public.set_user_block');
    expect(sql).toContain('function public.request_account_deletion');
    expect(sql).toContain('moderator is null or not public.is_admin()');
    expect(sql).toContain("moderation_status = 'visible'");
    expect(sql).not.toMatch(/grant\s+(?:all|insert|update|delete).*\b(?:anon|authenticated)\b.*post_reports/i);
  });

  test('keeps the post-deployment verification script read-only', async () => {
    const sql = await readFile(verificationUrl, 'utf8');
    const executable = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(executable).not.toMatch(/^\s*(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/im);
    expect(sql).toContain('pg_class.relrowsecurity');
  });
});
