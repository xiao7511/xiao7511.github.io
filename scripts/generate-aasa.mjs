import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;
const BUNDLE_ID = 'com.nobistudio.app';

export function createAasa(teamId) {
  if (!TEAM_ID_PATTERN.test(teamId || '')) throw new Error('APPLE_TEAM_ID must be 10 uppercase letters or digits');
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${BUNDLE_ID}`],
          components: [
            { '/': '/anime/????????-????-????-????-????????????' },
            { '/': '/manga/????????-????-????-????-????????????' },
            { '/': '/community/?*' }
          ]
        }
      ]
    }
  };
}

async function main() {
  const teamId = process.env.APPLE_TEAM_ID;
  const output = resolve(process.argv[2] || 'public/.well-known/apple-app-site-association');
  const document = createAasa(teamId);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(`Wrote AASA for ${teamId}.${BUNDLE_ID} to ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
