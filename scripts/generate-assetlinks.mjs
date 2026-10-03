import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'com.nobistudio.app';
const FINGERPRINT_PATTERN = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/i;

export function createAssetLinks(fingerprint) {
  if (!FINGERPRINT_PATTERN.test(fingerprint || '')) {
    throw new Error('ANDROID_SHA256_CERT_FINGERPRINT must be a real colon-separated SHA-256 certificate fingerprint');
  }

  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: [fingerprint.toUpperCase()]
      }
    }
  ];
}

async function main() {
  const fingerprint = process.env.ANDROID_SHA256_CERT_FINGERPRINT;
  const output = resolve(process.argv[2] || 'public/.well-known/assetlinks.json');
  const document = createAssetLinks(fingerprint);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(`Wrote Android App Links association for ${PACKAGE_NAME} to ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
