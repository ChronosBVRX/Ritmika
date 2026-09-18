/**
 * Identidad — hijack playerId / resumeToken
 * Pruebas obligatorias:
 *  - A conecta, B conoce playerId de A, B intenta reconectar como A sin token → RECHAZADO
 *  - B intenta con token falso → RECHAZADO
 *  - A reconecta con token correcto y nuevo socket → OK
 *  - Host no secuestrable
 */
const assert=require('assert');
const { spawn } = require('child_process');
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
async function startRelay(port){
  const env={...process.env, RELAY_PORT:String(port)};
  delete env.GITHUB_TOKEN;
  const proc=spawn('node', ['/home/chronos/Ritmika/server/relay/index.js'], {env, stdio:'pipe'});
  for(let i=0;i<20;i++){
    await wait(300);
    try{ const r=await fetch('http://127.0.0.1:'+port+'/api/relay-health').then(r=>r.json()); if(r.relay) return proc; }catch{}
  }
  throw new Error('relay not up');
}
function connect(url){
  const { io } = require('/home/chronos/Ritmika/node_modules/socket.io-client');
  return io(url,{transports:['websocket']});
}
function once(s,ev){return new Promise((res,rej)=>{ const t=setTimeout(()=>rej(new Error('timeout '+ev)),3000); s.once(ev,d=>{clearTimeout(t);res(d)}); });}

async function run(){
  const port=34583;
  const proc=await startRelay(port);
  const url='http://127.0.0.1:'+port;
  let passed=0, failed=0;
  const test=async(name,fn)=>{
    try{ await fn(); console.log('  ✓ '+name); passed++; }catch(e){ console.error('  ✗ '+name+':',e.message); failed++; }
  };
  try{
    await test('A conecta, B intenta hijack sin token → RECHAZADO', async()=>{
      const tv=connect(url); await once(tv,'server_version');
      tv.emit('tv:create_room',{}); const {roomCode}=await once(tv,'tv:room_created');
      const pA=connect(url); await once(pA,'server_version');
      pA.emit('player:join',{roomCode, name:'Alice', avatarId:0});
      const ackA=await once(pA,'player:join_ack');
      const pB=connect(url); await once(pB,'server_version');
      pB.emit('player:join',{roomCode, name:'Bob', avatarId:1});
      await once(pB,'player:join_ack');
      const pEve=connect(url); await once(pEve,'server_version');
      pEve.emit('player:join',{roomCode, name:'Eve', avatarId:2, playerId: ackA.playerId});
      const ack=await once(pEve,'player:join_ack');
      assert(ack.success===false && ack.code==='PLAYERID_TAKEN', JSON.stringify(ack));
      tv.disconnect(); pA.disconnect(); pB.disconnect(); pEve.disconnect();
      await wait(300);
    });

    await test('B intenta con token falso → RECHAZADO', async()=>{
      const tv=connect(url); await once(tv,'server_version');
      tv.emit('tv:create_room',{}); const {roomCode}=await once(tv,'tv:room_created');
      const pA=connect(url); await once(pA,'server_version');
      pA.emit('player:join',{roomCode, name:'Alice', avatarId:0});
      const ackA=await once(pA,'player:join_ack');
      const pEve=connect(url); await once(pEve,'server_version');
      pEve.emit('player:join',{roomCode, name:'Eve', avatarId:2, playerId: ackA.playerId, resumeToken:'0'.repeat(64)});
      const ack=await once(pEve,'player:join_ack');
      assert(ack.success===false, 'debe rechazar token falso');
      tv.disconnect(); pA.disconnect(); pEve.disconnect();
      await wait(300);
    });

    await test('A reconecta con token correcto → OK', async()=>{
      const tv=connect(url); await once(tv,'server_version');
      tv.emit('tv:create_room',{}); const {roomCode}=await once(tv,'tv:room_created');
      const pA=connect(url); await once(pA,'server_version');
      pA.emit('player:join',{roomCode, name:'Alice', avatarId:0});
      const ackA=await once(pA,'player:join_ack');
      pA.disconnect(); await wait(400);
      const pA2=connect(url); await once(pA2,'server_version');
      const tvRe=once(tv,'tv:player_joined');
      pA2.emit('player:join',{roomCode, name:'Alice', avatarId:0, playerId: ackA.playerId, resumeToken: ackA.resumeToken});
      const ack2=await once(pA2,'player:join_ack');
      assert(ack2.success===true && ack2.reconnected===true && ack2.playerId===ackA.playerId);
      const tvData=await tvRe;
      assert(tvData.player.playerId===ackA.playerId);
      // Verificar que getPublicPlayers no expone resumeToken
      const players=ack2.players || [];
      assert(!players.some(p=>p.resumeToken), 'players no debe exponer resumeToken');
      tv.disconnect(); pA2.disconnect();
      await wait(300);
    });

    await test('Host móvil no secuestrable', async()=>{
      const tv=connect(url); await once(tv,'server_version');
      tv.emit('tv:create_room',{}); const {roomCode}=await once(tv,'tv:room_created');
      const pHost=connect(url); await once(pHost,'server_version');
      pHost.emit('player:join',{roomCode, name:'Host', avatarId:0});
      const ackHost=await once(pHost,'player:join_ack');
      assert(ackHost.isHost===true);
      const pGuest=connect(url); await once(pGuest,'server_version');
      pGuest.emit('player:join',{roomCode, name:'Guest', avatarId:1});
      await once(pGuest,'player:join_ack');
      // Guest intenta suplantar host
      const pEve=connect(url); await once(pEve,'server_version');
      pEve.emit('player:join',{roomCode, name:'Eve', avatarId:2, playerId: ackHost.playerId});
      const ackEve=await once(pEve,'player:join_ack');
      assert(ackEve.success===false, 'host hijack debe ser rechazado');
      // Guest no debe poder hacer broadcast host
      let got=false; tv.once('tv:start_game_trigger',()=>got=true);
      pGuest.emit('player:start_game',{roomCode});
      await wait(400);
      assert(got===false, 'guest no debe trigger start_game');
      // Host real reconecta con token (pero Guest ya es host, Host no recupera automáticamente)
      pHost.disconnect(); await wait(400);
      const pHost2=connect(url); await once(pHost2,'server_version');
      pHost2.emit('player:join',{roomCode, name:'Host', avatarId:0, playerId: ackHost.playerId, resumeToken: ackHost.resumeToken});
      const ackHR=await once(pHost2,'player:join_ack');
      assert(ackHR.success && ackHR.reconnected);
      // Host original ya no es host (Guest lo es), no debe poder trigger
      let hostGot=false; tv.once('tv:start_game_trigger',()=>hostGot=true);
      pHost2.emit('player:start_game',{roomCode});
      await wait(400);
      assert(hostGot===false, 'host reconectado no debe ser host');
      // Guest (actual host) sí puede
      const tvGot=once(tv,'tv:start_game_trigger');
      pGuest.emit('player:start_game',{roomCode});
      await tvGot;
      tv.disconnect(); pGuest.disconnect(); pEve.disconnect(); pHost2.disconnect();
    });

  } finally {
    proc.kill(); await wait(500); try{proc.kill('SIGKILL');}catch{}
  }
  console.log(`\n[IDENTITY] ${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
}
run().catch(e=>{console.error(e);process.exit(1);});
