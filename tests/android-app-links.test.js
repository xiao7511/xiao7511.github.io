import { describe, expect, test } from 'vitest';
import { createAssetLinks } from '../scripts/generate-assetlinks.mjs';

describe('Android App Links release preparation', () => {
  test('creates an association for NOBI using only the supplied certificate fingerprint', () => {
    const fingerprint =
      '01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF';
    expect(createAssetLinks(fingerprint)).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.nobistudio.app',
          sha256_cert_fingerprints: [fingerprint]
        }
      }
    ]);
  });

  test('rejects missing, malformed, or placeholder certificate fingerprints', () => {
    for (const fingerprint of ['', undefined, '<actual fingerprint>', '01:23:45']) {
      expect(() => createAssetLinks(fingerprint)).toThrow(/ANDROID_SHA256_CERT_FINGERPRINT/);
    }
  });
});
