import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const candidates =
  process.platform === 'win32'
    ? ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe']
    : ['bash'];
const shell = candidates.find((candidate) => candidate === 'bash' || existsSync(candidate));
if (!shell) throw new Error('Bash is required to run scripts/build-static.sh');
const result = spawnSync(shell, ['scripts/build-static.sh'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
