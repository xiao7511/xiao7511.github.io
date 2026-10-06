import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateReleaseEnvironment } from '../scripts/ios-cloud-preflight.mjs';

describe('iOS cloud release boundary', () => {
  it('supports the existing Worker fallback without embedded Supabase values', () => {
    expect(validateReleaseEnvironment({})).toEqual([]);
  });
  it('accepts public HTTPS configuration and a publishable key', () => {
    expect(
      validateReleaseEnvironment({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'sb_publishable_example'
      })
    ).toEqual([]);
  });
  it.each([
    'http://example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://192.168.1.2',
    'https://user:password@example.com',
    'not a URL'
  ])('rejects unsafe production endpoint %s without logging its value', (value) => {
    const errors = validateReleaseEnvironment({ VITE_API_BASE_URL: value });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).not.toContain(value);
  });
  it('rejects incomplete public configuration and privileged keys', () => {
    expect(validateReleaseEnvironment({ VITE_SUPABASE_URL: 'https://example.supabase.co' }).length).toBeGreaterThan(0);
    expect(
      validateReleaseEnvironment({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'sb_secret_example'
      }).length
    ).toBeGreaterThan(0);
    expect(validateReleaseEnvironment({ VITE_SERVICE_ROLE_KEY: 'fixture' }).length).toBeGreaterThan(0);
  });
  it('accepts anon JWT configuration and rejects a privileged JWT role', () => {
    const jwt = (role) => `fixture.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.fixture`;
    const env = { VITE_SUPABASE_URL: 'https://example.supabase.co' };
    expect(validateReleaseEnvironment({ ...env, VITE_SUPABASE_ANON_KEY: jwt('anon') })).toEqual([]);
    expect(validateReleaseEnvironment({ ...env, VITE_SUPABASE_ANON_KEY: jwt('service_role') }).length).toBeGreaterThan(
      0
    );
  });
  it('keeps publishing manual, App Store signed, and TestFlight only', () => {
    const yaml = readFileSync('codemagic.yaml', 'utf8');
    expect(yaml).toContain('distribution_type: app_store');
    expect(yaml).toContain('submit_to_testflight: true');
    expect(yaml).toContain('submit_to_app_store: false');
    expect(yaml).not.toMatch(/^\s*triggering:/m);
    expect(yaml).toContain('PROJECT_BUILD_NUMBER');
    expect(yaml).toContain('npm ci');
    expect(yaml).toContain('npx --no-install cap sync ios');
    expect(yaml).toContain('--config Release');
  });
  it('archives the real App target through a shared Release scheme', () => {
    const scheme = readFileSync('mobile/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme', 'utf8');
    const project = readFileSync('mobile/ios/App/App.xcodeproj/project.pbxproj', 'utf8');
    expect(scheme).toContain('BlueprintIdentifier="504EC3031FED79650016851F"');
    expect(project).toContain('504EC3031FED79650016851F /* App */');
    expect(scheme).toContain('ArchiveAction buildConfiguration="Release"');
  });
  it('ships the App target for iPhone only with portrait orientation', () => {
    const project = readFileSync('mobile/ios/App/App.xcodeproj/project.pbxproj', 'utf8');
    const info = readFileSync('mobile/ios/App/App/Info.plist', 'utf8');
    for (const [id, name] of [
      ['504EC3171FED79650016851F', 'Debug'],
      ['504EC3181FED79650016851F', 'Release']
    ]) {
      const target = project.match(new RegExp(`${id} /\\* ${name} \\*/ = \\{[\\s\\S]*?\\n\\s*\\};`))?.[0];
      expect(target).toBeDefined();
      expect(target).toMatch(/TARGETED_DEVICE_FAMILY = 1;/);
      expect(target).not.toMatch(/TARGETED_DEVICE_FAMILY = ["']?1,2/);
      expect(target).toContain('PRODUCT_BUNDLE_IDENTIFIER = com.nobistudio.app;');
    }
    expect(info).toMatch(
      /<key>UISupportedInterfaceOrientations<\/key>\s*<array>\s*<string>UIInterfaceOrientationPortrait<\/string>\s*<\/array>/
    );
    expect(info).not.toContain('UISupportedInterfaceOrientations~ipad');
  });
});
