/**
 * Syntax-check every backend source file (`node --check`), not just the two
 * entrypoints. Keeps the repo's verification gate honest: a syntax error in any
 * route/service/model fails `npm run lint`.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../src', import.meta.url));

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (extname(entry) === '.js') files.push(full);
  }
})(root);

let failed = 0;
for (const file of files) {
  const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) {
    failed += 1;
    process.stderr.write(`\n${file}:\n${res.stderr || 'syntax check failed'}`);
  }
}

console.log(
  `node --check: ${files.length} file(s)${failed ? `, ${failed} failed` : ' — all OK'}`
);
process.exit(failed ? 1 : 0);
