/**
 * Portability guard — los tests no deben contener rutas absolutas de una máquina.
 * Un path /home/... o C:\Users\... rompe CI en otro runner (pasó con relay.test.js).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const testsDir = __dirname;
const offenders = [];

for (const file of fs.readdirSync(testsDir)) {
  if (!file.endsWith('.test.js')) continue;
  if (file === path.basename(__filename)) continue; // el guard contiene los patrones
  const content = fs.readFileSync(path.join(testsDir, file), 'utf8');
  content.split('\n').forEach((line, index) => {
    const bad = line.includes('/home/chronos')
      || line.includes('/Users/')
      || /[A-Za-z]:\\Users\\/.test(line);
    if (bad) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
  });
}

try {
  assert.deepStrictEqual(offenders, [], 'rutas absolutas de máquina en tests:\n' + offenders.join('\n'));
  console.log('  ✓ portability: tests sin rutas absolutas');
  console.log('\n[PORTABILITY RESULT] all passed');
  process.exit(0);
} catch (e) {
  console.error('  ✗ portability: ' + e.message);
  console.log('\n[PORTABILITY RESULT] failed');
  process.exit(1);
}
