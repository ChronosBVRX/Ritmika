/**
 * CORS allowlist tests — unit matrix + relay integration.
 *
 * Verifica que con CORS_ALLOWED_ORIGINS configurado NO exista fallback
 * permisivo: solo orígenes de la lista + localhost/127.0.0.1/::1.
 */
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const { isOriginAllowed, isLocalHostname } = require('../server/shared/cors');

const ROOT = path.join(__dirname, '..');
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function unitTests() {
  const allowed = ['ritmika.example.com'];

  // Matriz del enunciado
  assert.strictEqual(isOriginAllowed('https://ritmika.example.com', allowed), true, 'configured origin');
  assert.strictEqual(isOriginAllowed('http://127.0.0.1:3000', allowed), true, '127.0.0.1');
  assert.strictEqual(isOriginAllowed('http://localhost:3000', allowed), true, 'localhost');
  assert.strictEqual(isOriginAllowed('http://[::1]:3000', allowed), true, '::1');
  assert.strictEqual(isOriginAllowed('https://evil.example.com', allowed), false, 'evil denied');

  // Sin allowlist -> relay público
  assert.strictEqual(isOriginAllowed('https://anything.example.com', []), true, 'public relay');
  assert.strictEqual(isOriginAllowed('https://anything.example.com', undefined), true, 'public relay undefined');

  // No confundir sufijos
  assert.strictEqual(isOriginAllowed('https://ritmika.example.com.evil.com', allowed), false, 'suffix trick denied');
  assert.strictEqual(isOriginAllowed('https://notritmika.example.com', allowed), false, 'prefix trick denied');
  assert.strictEqual(isOriginAllowed('https://evil.com/?x=ritmika.example.com', allowed), false, 'path/query trick denied');
  assert.strictEqual(isOriginAllowed('https://ritmika.example.com', ['example.com']), false, 'different host denied');

  // Entradas con esquema y host:puerto
  assert.strictEqual(isOriginAllowed('https://app.example.com', ['https://app.example.com']), true, 'full origin');
  assert.strictEqual(isOriginAllowed('http://app.example.com', ['https://app.example.com']), false, 'scheme mismatch denied');
  assert.strictEqual(isOriginAllowed('http://localhost:3000', ['localhost:3000']), true, 'host:port entry');

  // Wildcard explícito
  assert.strictEqual(isOriginAllowed('https://a.example.com', ['*.example.com']), true, 'wildcard subdomain');
  assert.strictEqual(isOriginAllowed('https://example.com', ['*.example.com']), true, 'wildcard apex');
  assert.strictEqual(isOriginAllowed('https://a.example.org', ['*.example.com']), false, 'wildcard other domain denied');

  // Origen inválido nunca debe pasar
  assert.strictEqual(isOriginAllowed('not-a-url', allowed), false, 'invalid origin denied');
  assert.strictEqual(isLocalHostname('localhost'), true);
  assert.strictEqual(isLocalHostname('example.com'), false);

  console.log('  ✓ unit: allowlist matrix');
}

async function startRelay(port, envExtra) {
  const env = { ...process.env, RELAY_PORT: String(port), ...envExtra };
  delete env.GITHUB_TOKEN;
  const proc = spawn('node', [path.join(ROOT, 'server/relay/index.js')], { env, stdio: 'pipe' });
  for (let i = 0; i < 25; i++) {
    await wait(300);
    try {
      const h = await fetch(`http://127.0.0.1:${port}/api/relay-health`).then(r => r.json());
      if (h.relay) return proc;
    } catch {}
  }
  throw new Error('relay not up ' + port);
}

async function handshakeOrigin(port, origin) {
  const url = `http://127.0.0.1:${port}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
  const res = await fetch(url, { headers: origin ? { Origin: origin } : {} });
  return res.headers.get('access-control-allow-origin');
}

async function integrationTests() {
  const port = 34590;
  const proc = await startRelay(port, { CORS_ALLOWED_ORIGINS: 'ritmika.example.com' });
  try {
    const good = await handshakeOrigin(port, 'https://ritmika.example.com');
    assert(good, 'configured origin must receive ACAO, got ' + good);
    assert(/ritmika\.example\.com/.test(good), 'ACAO must echo configured origin');

    const local = await handshakeOrigin(port, 'http://127.0.0.1:3000');
    assert(local, '127.0.0.1 must receive ACAO');

    const localhost = await handshakeOrigin(port, 'http://localhost:3000');
    assert(localhost, 'localhost must receive ACAO');

    const evil = await handshakeOrigin(port, 'https://evil.example.com');
    assert.strictEqual(evil, null, 'evil origin must NOT receive ACAO, got ' + evil);

    console.log('  ✓ integration: relay CORS headers');
  } finally {
    proc.kill();
    await wait(400);
    try { proc.kill('SIGKILL'); } catch {}
  }
}

(async () => {
  let failed = 0;
  try { unitTests(); } catch (e) { console.error('  ✗ unit:', e.message); failed++; }
  try { await integrationTests(); } catch (e) { console.error('  ✗ integration:', e.message); failed++; }
  console.log(`\n[CORS RESULT] ${failed === 0 ? 'all passed' : failed + ' failed'}`);
  process.exit(failed ? 1 : 0);
})();
