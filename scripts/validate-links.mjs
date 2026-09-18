import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';

const publicRoot = resolve('public');
const htmlFiles = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (extname(entry.name) === '.html') htmlFiles.push(path);
  }
}

walk(publicRoot);
const failures = [];
const attributePattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  for (const match of html.matchAll(attributePattern)) {
    const reference = match[1].trim();
    if (!reference || reference.includes('${') || /^(?:[a-z]+:|\/\/|#)/i.test(reference)) continue;
    const cleanPath = reference.split(/[?#]/, 1)[0];
    if (!cleanPath) continue;
    let target = cleanPath.startsWith('/')
      ? join(publicRoot, cleanPath.slice(1))
      : resolve(dirname(htmlFile), cleanPath);
    if (target.endsWith('/') || !extname(target)) target = join(target, 'index.html');
    target = normalize(target);
    if (!target.startsWith(publicRoot) || !existsSync(target)) failures.push(`${htmlFile}: ${reference}`);
  }
}

if (failures.length) {
  console.error(`Broken local links (${failures.length}):\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Validated local links in ${htmlFiles.length} HTML files.`);
