import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const manifestUrl = new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url);
const filePathsUrl = new URL('../../android/app/src/main/res/xml/file_paths.xml', import.meta.url);

describe('Android native security and App Links contract', () => {
  test('declares HTTPS App Link intent filters for the NOBI routes', async () => {
    const manifest = await readFile(manifestUrl, 'utf8');
    const viewFilters = [...manifest.matchAll(/<intent-filter\b([^>]*)>([\s\S]*?)<\/intent-filter>/g)]
      .filter(([, attributes, body]) => attributes.includes('android:autoVerify="true"') && body.includes('android.intent.action.VIEW'));

    expect(viewFilters).toHaveLength(3);
    for (const [, , body] of viewFilters) {
      expect(body).toContain('android.intent.category.DEFAULT');
      expect(body).toContain('android.intent.category.BROWSABLE');
      expect(body).toContain('android:scheme="https"');
      expect(body).toContain('android:host="www.nobistudio.com"');
    }
    expect(viewFilters.map(([, , body]) => body.match(/android:pathPrefix="([^"]+)"/)?.[1])).toEqual([
      '/anime/',
      '/manga/',
      '/community/'
    ]);
    expect(manifest).not.toContain('android:host="nobistudio.com"');
  });

  test('limits FileProvider to app-owned picture files and cache', async () => {
    const paths = await readFile(filePathsUrl, 'utf8');
    const manifest = await readFile(manifestUrl, 'utf8');
    const provider = manifest.match(/<provider\b[^>]*android:name="androidx\.core\.content\.FileProvider"[\s\S]*?<\/provider>/);

    expect(paths).toContain('<external-files-path name="my_images" path="Pictures/" />');
    expect(paths).toContain('<cache-path name="my_cache_images" path="." />');
    expect(paths).not.toContain('<external-path');
    expect(provider?.[0]).toContain('android:exported="false"');
  });

  test('requests only Android Internet permission', async () => {
    const manifest = await readFile(manifestUrl, 'utf8');
    const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"\s*\/>/g)].map(([, name]) => name);

    expect(permissions).toEqual(['android.permission.INTERNET']);
  });

  test('uses NOBI splash resources and branded launcher resources at each density', async () => {
    const resourceRoot = new URL('../../android/app/src/main/res/', import.meta.url);
    const strings = await readFile(new URL('values/strings.xml', resourceRoot), 'utf8');
    const styles = await readFile(new URL('values/styles.xml', resourceRoot), 'utf8');
    expect(strings).toMatch(/<string name="app_name">NOBI[^<]*<\/string>/);
    expect(styles).toContain('<item name="android:background">@drawable/splash</item>');

    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      await expect(readFile(new URL(`mipmap-${density}/ic_launcher.png`, resourceRoot))).resolves.toBeInstanceOf(Buffer);
      await expect(readFile(new URL(`mipmap-${density}/ic_launcher_round.png`, resourceRoot))).resolves.toBeInstanceOf(Buffer);
      await expect(readFile(new URL(`mipmap-${density}/ic_launcher_foreground.png`, resourceRoot))).resolves.toBeInstanceOf(Buffer);
    }
    await expect(readFile(new URL('drawable/splash.png', resourceRoot))).resolves.toBeInstanceOf(Buffer);
  });
});
