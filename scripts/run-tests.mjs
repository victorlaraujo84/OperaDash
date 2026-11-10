import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

let failed = 0;
const tests = readdirSync(new URL('.', import.meta.url)).filter(name => /^test-.*\.ts$/.test(name));
for (const test of tests) {
  const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', `scripts/${test}`], { encoding: 'utf8' });
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${test}`);
  if (result.status !== 0) { failed++; console.error(result.stdout + result.stderr); }
}
console.log(`${tests.length - failed}/${tests.length} suites passed`);
process.exitCode = failed ? 1 : 0;
