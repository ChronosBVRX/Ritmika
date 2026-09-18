/**
 * Smoke test — flujo completo: TV crea sala en relay, 2 móviles se unen, TV inicia juego, votan, asignan, etc.
 * Simula el flujo real sin necesidad de navegador.
 */
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');

function wait(ms){return new Promise(r=>setTimeout(r,ms));}
async function fetchJSON(url){ const r=await fetch(url); return r.json(); }

async function startRelay(port){
  const env={...process.env, RELAY_PORT:String(port)};
  delete env.GITHUB_TOKEN;
  const proc=spawn('node', [path.join(__dirname,'../server/relay/index.js')], {env, stdio:'pipe'});
  for(let i=0;i<20;i++){
    await wait(300);
    try{ const h=await fetchJSON('http://127.0.0.1:'+port+'/api/relay-health'); if(h.relay) return proc; }catch{}
  }
  throw new Error('relay not up');
}

function connect(url){
  const { io } = require('socket.io-client');
  return io(url,{transports:['websocket']});
}
function once(s,ev,timeout=4000){ return new Promise((res,rej)=>{ const t=setTimeout(()=>rej(new Error('timeout '+ev)),timeout); s.once(ev,data=>{clearTimeout(t);res(data);}); }); }

async function run(){
  const port=34571;
  const proc=await startRelay(port);
  const url='http://127.0.0.1:'+port;
  console.log('[SMOKE] Relay en',url);
  let ok=true;
  try {
    // TV crea sala
    const tv=connect(url); await once(tv,'server_version');
    tv.emit('tv:create_room',{mode:'clasico'});
    const room=await once(tv,'tv:room_created');
    console.log('[SMOKE] Sala',room.roomCode, 'hostToken', room.hostToken.slice(0,6));
    assert(room.roomCode && room.hostToken);

    // Móvil 1 se une
    const p1=connect(url); await once(p1,'server_version');
    const tvP1=once(tv,'tv:player_joined');
    p1.emit('player:join',{roomCode:room.roomCode, name:'Alice', avatarId:1, playerId:'p1-id-stable'});
    const ack1=await once(p1,'player:join_ack');
    assert(ack1.success && ack1.playerId==='p1-id-stable');
    const p1Token=ack1.resumeToken;
    const tvData1=await tvP1;
    assert(tvData1.player.name==='Alice');

    // Móvil 2 se une
    const p2=connect(url); await once(p2,'server_version');
    const tvP2=once(tv,'tv:player_joined');
    p2.emit('player:join',{roomCode:room.roomCode, name:'Bob', avatarId:2, playerId:'p2-id-stable'});
    const ack2=await once(p2,'player:join_ack');
    assert(ack2.success);
    await tvP2;
    console.log('[SMOKE] 2 jugadores en sala');

    // TV inicia juego (host es p1, pero TV lo inicia directo)
    const p1Started=once(p1,'game:started');
    const p2Started=once(p2,'game:started');
    tv.emit('tv:start_game',{roomCode:room.roomCode, hostToken:room.hostToken});
    await p1Started; await p2Started;
    console.log('[SMOKE] Juego iniciado');

    // Simular: TV hace broadcast de ROULETTE_START
    const p1Roulette=once(p1,'game:update');
    tv.emit('tv:broadcast',{roomCode:room.roomCode, event:'ROULETTE_START', data:{}, hostToken:room.hostToken});
    const upd=await p1Roulette;
    assert(upd.event==='ROULETTE_START');

    // Móvil envía géneros y voto
    p1.emit('player:select_genres',{roomCode:room.roomCode, genres:['pop','rock']});
    const tvGenres=await once(tv,'tv:player_genres');
    assert(tvGenres.genres.includes('pop'));

    // Tomatazo
    const tvTom=once(tv,'tv:tomatazo');
    p2.emit('player:tomatazo',{roomCode:room.roomCode, targetName:'Alice'});
    const tom=await tvTom;
    assert(tom.attackerName==='Bob');

    // Voto
    const tvVote=once(tv,'tv:vote');
    // Necesitamos un performerSocketId válido: usar p1's socket id
    p2.emit('player:vote',{roomCode:room.roomCode, score:100, performerSocketId:p1.id});
    const vote=await tvVote;
    assert(vote.score===100);

    // Asignación Ronda 2
    const tvAssign=once(tv,'tv:song_assigned');
    // p1 asigna canción a p2
    p1.emit('player:assign_song',{roomCode:room.roomCode, targetSocketId:p2.id, songId:'r2_test123'});
    const assign=await tvAssign;
    assert(assign.songId==='r2_test123');

    // Reconexión con mismo playerId y nuevo socket (simula cambio WiFi/4G)
    p1.disconnect(); await wait(400);
    const p1b=connect(url); await once(p1b,'server_version');
    const tvRejoin=once(tv,'tv:player_joined');
    p1b.emit('player:join',{roomCode:room.roomCode, name:'Alice', avatarId:1, playerId:'p1-id-stable', resumeToken:p1Token});
    const ackRe=await once(p1b,'player:join_ack');
    assert(ackRe.reconnected===true, 'reconexión esperada');
    const tvRe=await tvRejoin;
    assert(tvRe.player.playerId==='p1-id-stable');
    console.log('[SMOKE] Reconexión OK');

    // TV reconecta con hostToken tras disconnect
    tv.disconnect(); await wait(200);
    const tv2=connect(url); await once(tv2,'server_version');
    tv2.emit('tv:reconnect_host',{roomCode:room.roomCode, hostToken:room.hostToken});
    const reAck=await once(tv2,'tv:reconnect_ack');
    assert(reAck.success===true);
    console.log('[SMOKE] TV reconexión OK');

    console.log('[SMOKE] Todos los pasos OK');

    p1b.disconnect(); p2.disconnect(); tv2.disconnect();
  } catch(e){
    console.error('[SMOKE] FAIL',e);
    ok=false;
  } finally {
    proc.kill(); await wait(500); try{proc.kill('SIGKILL');}catch{}
  }
  process.exit(ok?0:1);
}
run().catch(e=>{console.error(e);process.exit(1);});
