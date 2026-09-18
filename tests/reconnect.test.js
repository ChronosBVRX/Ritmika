/**
 * Reconnect grace tests — ventana real de reconexión de jugador.
 *
 * Cubre:
 *  1. jugador desconecta;
 *  2. token válido dentro de gracia -> reconecta;
 *  3. jugador desconecta de nuevo;
 *  4. expira la gracia;
 *  5. token anterior ya NO restaura la sesión;
 *  6. puede entrar después como nuevo según las reglas normales.
 */
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const RoomManager = require('../server/shared/rooms');

const ROOT = path.join(__dirname, '..');
const GRACE = 1000;
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ': ' + e.message); failed++; }
}
async function testAsync(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ': ' + e.message); failed++; }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeRoom(rm) {
  return rm.createRoom('tv-socket', 'clasico');
}

// --- Config wiring ---------------------------------------------------------
test('PLAYER_RECONNECT_GRACE_MS default = 5 min', () => {
  const env = { ...process.env };
  delete env.PLAYER_RECONNECT_GRACE_MS;
  const out = execFileSync('node', ['-e',
    "console.log(require('./server/shared/config').config.playerReconnectGraceMs)"],
    { cwd: ROOT, env, encoding: 'utf8' });
  assert.strictEqual(out.trim(), String(5 * 60 * 1000));
});

test('PLAYER_RECONNECT_GRACE_MS override respetado', () => {
  const out = execFileSync('node', ['-e',
    "process.env.PLAYER_RECONNECT_GRACE_MS='1234';console.log(require('./server/shared/config').config.playerReconnectGraceMs)"],
    { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(out.trim(), '1234');
});

// --- Grace lifecycle -------------------------------------------------------
const rm = new RoomManager({ autoCleanup: false, playerReconnectGraceMs: GRACE });
const room = makeRoom(rm);

const join = rm.addPlayer(room, 'sock1', { name: 'Bob', avatarId: 1, playerId: 'player-abc', resumeToken: null });
const playerId = join.player.playerId;
const token = join.player.resumeToken;

test('join inicial crea jugador con token', () => {
  assert(room.players.has('sock1'));
  assert(token && token.length >= 32);
  assert.strictEqual(room.playerIdToSocket.get(playerId), 'sock1');
});

test('1) jugador desconecta -> queda en room.disconnected', () => {
  const res = rm.removePlayer(room, 'sock1');
  assert(res && res.removed);
  assert(!room.players.has('sock1'));
  assert(room.disconnected.has(playerId));
});

test('2) token válido dentro de gracia -> reconecta', () => {
  const saved = room.disconnected.get(playerId);
  const notExpired = rm.expireDisconnected(room, saved.disconnectedAt + GRACE - 1);
  assert.deepStrictEqual(notExpired, [], 'no debe expirar antes de la gracia');
  assert(room.disconnected.has(playerId), 'sigue disponible dentro de la gracia');

  const res = rm.addPlayer(room, 'sock2', { name: 'Bob', avatarId: 1, playerId, resumeToken: token });
  assert.strictEqual(res.reconnected, true);
  assert(!room.disconnected.has(playerId));
  assert(room.players.has('sock2'));
  assert.strictEqual(room.playerIdToSocket.get(playerId), 'sock2');
});

test('expireDisconnected no elimina a un jugador reconectado', () => {
  const expired = rm.expireDisconnected(room, Date.now() + GRACE * 10);
  assert.deepStrictEqual(expired, []);
  assert(room.players.has('sock2'));
  assert.strictEqual(room.playerIdToSocket.get(playerId), 'sock2');
});

test('3) jugador vuelve a desconectar', () => {
  rm.removePlayer(room, 'sock2');
  assert(room.disconnected.has(playerId));
});

test('4) expira la gracia -> elimina disconnected y mapping', () => {
  const saved = room.disconnected.get(playerId);
  const expired = rm.expireDisconnected(room, saved.disconnectedAt + GRACE + 1);
  assert(expired.includes(playerId), 'debe reportar el playerId expirado');
  assert(!room.disconnected.has(playerId), 'disconnected limpio');
  assert(!room.playerIdToSocket.has(playerId), 'mapping eliminado');
});

test('5) token anterior ya NO restaura la sesión', () => {
  const res = rm.addPlayer(room, 'sock3', { name: 'Bob', avatarId: 1, playerId, resumeToken: token });
  assert.notStrictEqual(res.reconnected, true, 'no debe considerarse reconexión');
  assert(res.player && res.player.resumeToken !== token, 'debe emitir token nuevo');
  assert.strictEqual(room.playerIdToSocket.get(playerId), 'sock3');
});

test('6) puede entrar después como nuevo según reglas normales', () => {
  // La nueva sesión (token nuevo) sí puede reconectar dentro de su gracia.
  const newToken = room.players.get('sock3').resumeToken;
  rm.removePlayer(room, 'sock3');
  const res = rm.addPlayer(room, 'sock4', { name: 'Bob', avatarId: 1, playerId, resumeToken: newToken });
  assert.strictEqual(res.reconnected, true, 'token nuevo sí restaura');

  // El token viejo sigue sin poder restaurar la sesión vigente.
  rm.removePlayer(room, 'sock4');
  const hijack = rm.addPlayer(room, 'sock5', { name: 'Mallory', avatarId: 2, playerId, resumeToken: token });
  assert.notStrictEqual(hijack.reconnected, true, 'token viejo no restaura');
});

test('token inválido no secuestra playerId conectado', () => {
  const rm2 = new RoomManager({ autoCleanup: false, playerReconnectGraceMs: GRACE });
  const r = makeRoom(rm2);
  const a = rm2.addPlayer(r, 's1', { name: 'Ana', avatarId: 0, playerId: 'pid-x', resumeToken: null });
  const res = rm2.addPlayer(r, 's2', { name: 'Mallory', avatarId: 1, playerId: 'pid-x', resumeToken: 'f'.repeat(64) });
  assert(res.error, 'debe rechazar token inválido');
  assert.strictEqual(res.code, 'PLAYERID_TAKEN');
  assert.strictEqual(r.players.get('s1').name, 'Ana');
});

(async () => {
  // La gracia debe aplicarse en el propio intento de reconexión, sin depender
  // de que el cleanup (cada 60s) haya corrido. Si no, un token expirado sigue
  // restaurando la sesión.
  await testAsync('gracia expira en el intento de reconexión (sin cleanup)', async () => {
    const rm2 = new RoomManager({ autoCleanup: false, playerReconnectGraceMs: 50 });
    const r = makeRoom(rm2);
    const a = rm2.addPlayer(r, 's1', { name: 'Ana', avatarId: 0, playerId: 'pid-grace', resumeToken: null });
    const oldToken = a.player.resumeToken;
    rm2.removePlayer(r, 's1');
    assert(r.disconnected.has('pid-grace'), 'debe quedar desconectado');
    await sleep(120); // supera la gracia; NO se llama expireDisconnected a mano
    const res = rm2.addPlayer(r, 's2', { name: 'Ana', avatarId: 0, playerId: 'pid-grace', resumeToken: oldToken });
    assert.notStrictEqual(res.reconnected, true, 'token viejo no debe restaurar tras expirar la gracia');
    assert(res.player.resumeToken !== oldToken, 'debe emitir token nuevo');
    assert(!r.disconnected.has('pid-grace'), 'disconnected debe limpiarse en el intento');
  });

  console.log(`\n[RECONNECT RESULT] ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
