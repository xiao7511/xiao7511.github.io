import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function validateReleaseEnvironment(env) {
  const errors = [];
  for (const name of ['VITE_API_BASE_URL', 'VITE_WEB_BASE_URL', 'VITE_SUPABASE_URL']) {
    const value = env[name]?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i.test(url.hostname) ||
        url.hostname.endsWith('.local')
      )
        errors.push(`${name}: public HTTPS endpoint required`);
    } catch {
      errors.push(`${name}: invalid URL`);
    }
  }
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (Boolean(url) !== Boolean(key)) errors.push('Supabase override requires both public values');
  if (key) {
    let publicKey = key.startsWith('sb_publishable_');
    if (!publicKey) {
      try {
        publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon';
      } catch {
        publicKey = false;
      }
    }
    if (!publicKey) errors.push('VITE_SUPABASE_ANON_KEY: anon/publishable key required');
  }
  for (const name of Object.keys(env)) {
    if (name.startsWith('VITE_') && /SERVICE.?ROLE|SECRET|PRIVATE|PASSWORD|TOKEN/i.test(name)) {
      errors.push('Private VITE_ variable is forbidden');
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateReleaseEnvironment(process.env);
  const config = readFileSync('mobile/capacitor.config.ts', 'utf8');
  if (!config.includes("appId: 'com.nobistudio.app'") || !config.includes("webDir: 'dist'")) {
    errors.push('Capacitor release identity/webDir mismatch');
  }
  if (/server\s*:/.test(config)) errors.push('Review Capacitor server override before release');
  if (!existsSync('mobile/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme')) {
    errors.push('Shared App scheme missing');
  }
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('iOS release configuration preflight passed (no values logged)');
  }
}
