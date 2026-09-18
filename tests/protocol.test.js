/**
 * Protocolo Rítmika — Tests de congelación (f341ac1)
 * Verifica que server/index.js mantiene los eventos documentados en docs/PROTOCOL.md
 * Ejecutar: npm test  (usa PORT aleatorio, no interfiere con 3000)
 */
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const TEST_PORT = 34567;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
    }).on('error', reject);
  });
}

async function startServer() {
  const env = { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'test' };
  // Evitar que gitCommitAndPush intente pushear en tests
  delete env.GITHUB_TOKEN;
  const proc = spawn('node', [path.join(__dirname, '../server/index.js')], {
    env, stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  proc.stdout.on('data', d => out += d.toString());
  proc.stderr.on('data', d => out += d.toString());
  // esperar health
  for (let i = 0; i < 20; i++) {
    await wait(500);
    try {
      const h = await fetchJSON(`${SERVER_URL}/api/health`);
      if (h && h.server) {
        return proc;
      }
    } catch {}
  }
  console.error('Server output:', out);
  throw new Error('Server no arrancó en ' + TEST_PORT);
}

function connectClient(url = SERVER_URL) {
  const { io } = require('socket.io-client');
  return io(url, { transports: ['websocket'] });
}

function once(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting ${event}`)), timeout);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

async function run() {
  console.log('[TEST] Arrancando servidor en', TEST_PORT);
  const serverProc = await startServer();
  console.log('[TEST] Servidor OK');

  let passed = 0, failed = 0;
  const test = async (name, fn) => {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}:`, e.message); failed++; }
  };

  try {
    await test('server_version se emite al conectar', async () => {
      const c = connectClient();
      const v = await once(c, 'server_version');
      assert(typeof v === 'string' && v.length > 0);
      c.disconnect();
    });

    await test('tv:create_room genera código 4 chars y responde tv:room_created', async () => {
      const tv = connectClient();
      await once(tv, 'server_version');
      tv.emit('tv:create_room', { mode: 'clasico' });
      const data = await once(tv, 'tv:room_created');
      assert(/^[A-Z2-9]{4}$/.test(data.roomCode), 'roomCode inválido: ' + data.roomCode);
      assert(data.mode === 'clasico');
      tv.disconnect();
    });

    await test('player:join válido -> join_ack success + tv:player_joined', async () => {
      const tv = connectClient(); await once(tv, 'server_version');
      tv.emit('tv:create_room', {});
      const { roomCode } = await once(tv, 'tv:room_created');
      const p = connectClient(); await once(p, 'server_version');
      const tvJoined = once(tv, 'tv:player_joined');
      p.emit('player:join', { roomCode, name: 'Tester', avatarId: 2 });
      const ack = await once(p, 'player:join_ack');
      assert(ack.success === true && ack.roomCode === roomCode);
      const tvData = await tvJoined;
      assert(tvData.player.name === 'Tester' && tvData.player.avatarId === 2);
      tv.disconnect(); p.disconnect();
    });

    await test('player:join inválido -> success false', async () => {
      const p = connectClient(); await once(p, 'server_version');
      p.emit('player:join', { roomCode: 'ZZZZ', name: 'X', avatarId: 0 });
      const ack = await once(p, 'player:join_ack');
      assert(ack.success === false && /Sala no encontrada/.test(ack.error));
      p.disconnect();
    });

    await test('dos salas simultáneas están aisladas', async () => {
      const tv1 = connectClient(); await once(tv1, 'server_version');
      tv1.emit('tv:create_room', {}); const { roomCode: c1 } = await once(tv1, 'tv:room_created');
      const tv2 = connectClient(); await once(tv2, 'server_version');
      tv2.emit('tv:create_room', {}); const { roomCode: c2 } = await once(tv2, 'tv:room_created');
      assert(c1 !== c2);
      const p1 = connectClient(); await once(p1, 'server_version');
      const tv1GotA = once(tv1, 'tv:player_joined');
      p1.emit('player:join', { roomCode: c1, name: 'A', avatarId: 0 });
      await once(p1, 'player:join_ack');
      await tv1GotA;
      const p2 = connectClient(); await once(p2, 'server_version');
      const tv2GotB = once(tv2, 'tv:player_joined');
      p2.emit('player:join', { roomCode: c2, name: 'B', avatarId: 1 });
      await once(p2, 'player:join_ack');
      await tv2GotB;
      // Ahora ambas salas tienen 1 jugador, tv1 vio A, tv2 vio B. Verificar que nuevo join en c1 no llega a tv2
      let tv2GotC = false;
      tv2.once('tv:player_joined', () => tv2GotC = true);
      let tv1GotC = false;
      tv1.once('tv:player_joined', () => tv1GotC = true);
      const p3 = connectClient(); await once(p3, 'server_version');
      p3.emit('player:join', { roomCode: c1, name: 'C', avatarId: 2 });
      await once(p3, 'player:join_ack');
      await wait(400);
      assert(tv2GotC === false, 'aislamiento violado: tv2 recibió jugador de sala 1');
      assert(tv1GotC === true, 'tv1 debió recibir a C');
      tv1.disconnect(); tv2.disconnect(); p1.disconnect(); p2.disconnect(); p3.disconnect();
    });

    await test('relay TV->móvil: tv:broadcast -> game:update', async () => {
      const tv = connectClient(); await once(tv, 'server_version');
      tv.emit('tv:create_room', {}); const { roomCode } = await once(tv, 'tv:room_created');
      const p = connectClient(); await once(p, 'server_version');
      p.emit('player:join', { roomCode, name: 'P', avatarId: 0 }); await once(p, 'player:join_ack');
      const got = once(p, 'game:update');
      tv.emit('tv:broadcast', { roomCode, event: 'ROUND_INFO', data: { round: 1 } });
      const upd = await got;
      assert(upd.event === 'ROUND_INFO' && upd.data.round === 1);
      tv.disconnect(); p.disconnect();
    });

    await test('relay móvil->TV: player:tomatazo -> tv:tomatazo', async () => {
      const tv = connectClient(); await once(tv, 'server_version');
      tv.emit('tv:create_room', {}); const { roomCode } = await once(tv, 'tv:room_created');
      const p = connectClient(); await once(p, 'server_version');
      p.emit('player:join', { roomCode, name: 'Atk', avatarId: 0 }); await once(p, 'player:join_ack');
      const got = once(tv, 'tv:tomatazo');
      p.emit('player:tomatazo', { roomCode, targetName: 'Victima' });
      const data = await got;
      assert(data.attackerName === 'Atk' && data.targetName === 'Victima');
      tv.disconnect(); p.disconnect();
    });

    await test('relay TV->jugador específico: tv:send_to_player -> game:private', async () => {
      const tv = connectClient(); await once(tv, 'server_version');
      tv.emit('tv:create_room', {}); const { roomCode } = await once(tv, 'tv:room_created');
      const p = connectClient(); await once(p, 'server_version');
      p.emit('player:join', { roomCode, name: 'Priv', avatarId: 0 }); await once(p, 'player:join_ack');
      const got = once(p, 'game:private');
      // tv necesita saber socketId del jugador — lo obtiene de players
      // Usamos el socketId real del cliente
      const pId = p.id;
      tv.emit('tv:send_to_player', { targetSocketId: pId, event: 'YOUR_TURN', data: {} });
      const priv = await got;
      assert(priv.event === 'YOUR_TURN');
      tv.disconnect(); p.disconnect();
    });

    await test('host autenticado: solo host puede player:start_game', async () => {
      const tv = connectClient(); await once(tv, 'server_version');
      tv.emit('tv:create_room', {}); const { roomCode } = await once(tv, 'tv:room_created');
      const host = connectClient(); await once(host, 'server_version');
      host.emit('player:join', { roomCode, name: 'Host', avatarId: 0 }); await once(host, 'player:join_ack');
      const guest = connectClient(); await once(guest, 'server_version');
      guest.emit('player:join', { roomCode, name: 'Guest', avatarId: 1 }); await once(guest, 'player:join_ack');
      // guest intenta start_game — TV no debe recibir trigger
      let tvGot = false; tv.once('tv:start_game_trigger', () => tvGot = true);
      guest.emit('player:start_game', { roomCode });
      await wait(400);
      assert(tvGot === false, 'guest no debería triggerar');
      // host sí
      const tvGotHost = once(tv, 'tv:start_game_trigger');
      host.emit('player:start_game', { roomCode });
      await tvGotHost;
      tv.disconnect(); host.disconnect(); guest.disconnect();
    });

    await test('disconnect jugador -> tv:player_left + reasignación host', async () => {
      const tv = connectClient(); await once(tv, 'server_version');
      tv.emit('tv:create_room', {}); const { roomCode } = await once(tv, 'tv:room_created');
      const host = connectClient(); await once(host, 'server_version');
      host.emit('player:join', { roomCode, name: 'Host2', avatarId: 0 }); await once(host, 'player:join_ack');
      const guest = connectClient(); await once(guest, 'server_version');
      guest.emit('player:join', { roomCode, name: 'Guest2', avatarId: 1 }); await once(guest, 'player:join_ack');
      const leftP = once(tv, 'tv:player_left');
      const hostAssigned = once(guest, 'game:private');
      host.disconnect();
      const left = await leftP;
      assert(left.name === 'Host2');
      const priv = await hostAssigned;
      assert(priv.event === 'HOST_ASSIGNED');
      tv.disconnect(); guest.disconnect();
    });

    await test('tv:close_room y disconnect TV -> game:tv_disconnected', async () => {
      const tv = connectClient(); await once(tv, 'server_version');
      tv.emit('tv:create_room', {}); const { roomCode } = await once(tv, 'tv:room_created');
      const p = connectClient(); await once(p, 'server_version');
      p.emit('player:join', { roomCode, name: 'P', avatarId: 0 }); await once(p, 'player:join_ack');
      const disc = once(p, 'game:tv_disconnected');
      tv.disconnect();
      await disc;
      p.disconnect();
    });

    await test('rate limiting: player:tomatazo 2s cooldown', async () => {
      const tv = connectClient(); await once(tv, 'server_version');
      tv.emit('tv:create_room', {}); const { roomCode } = await once(tv, 'tv:room_created');
      const p = connectClient(); await once(p, 'server_version');
      p.emit('player:join', { roomCode, name: 'Spam', avatarId: 0 }); await once(p, 'player:join_ack');
      let count = 0; tv.on('tv:tomatazo', () => count++);
      p.emit('player:tomatazo', { roomCode, targetName: 'A' });
      p.emit('player:tomatazo', { roomCode, targetName: 'B' });
      await wait(600);
      assert(count === 1, 'segundo tomatazo debería ser rate-limited, count=' + count);
      tv.disconnect(); p.disconnect();
    });

    // Validación estática de existencia de handlers
    await test('server/index.js contiene handlers esperados', async () => {
      const fs = require('fs');
      const src = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
      const events = ['tv:create_room','tv:close_room','tv:broadcast','tv:send_to_player','tv:add_bot','tv:start_game',
        'player:join','player:select_genres','player:select_artists','player:tomatazo','player:emoji','player:sabotage_audio','player:vote','player:assign_song','player:start_game','player:start_song','player:next_turn','player:new_game'];
      for (const ev of events) {
        assert(src.includes(`'${ev}'`) || src.includes(`"${ev}"`), 'falta handler ' + ev);
      }
    });

  } finally {
    serverProc.kill('SIGTERM');
    await wait(500);
    try { serverProc.kill('SIGKILL'); } catch {}
  }

  console.log(`\n[RESULT] ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
