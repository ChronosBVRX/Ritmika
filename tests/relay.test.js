/**
 * Relay — Tests para hostToken, playerId, reconexión, TTL, max players
 */
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');

function wait(ms){return new Promise(r=>setTimeout(r,ms));}
async function fetchJSON(url){ const r=await fetch(url); return r.json(); }

async function startRelay(port){
  const env={...process.env, RELAY_PORT:String(port), ROOM_TTL_MS:'60000', MAX_PLAYERS_PER_ROOM:'4'};
  delete env.GITHUB_TOKEN;
  const proc=spawn('node', [path.join(__dirname,'../server/relay/index.js')], {env, stdio:'pipe'});
  proc.stdout.on('data',d=>process.stdout.write('[relay] '+d));
  for(let i=0;i<20;i++){
    await wait(300);
    try{ const h=await fetchJSON('http://127.0.0.1:'+port+'/api/relay-health'); if(h.relay) return proc; }catch{}
  }
  throw new Error('relay not up '+port);
}

function connect(url){
  const { io } = require('socket.io-client');
  return io(url,{transports:['websocket']});
}
function once(s,ev,timeout=3000){ return new Promise((res,rej)=>{ const t=setTimeout(()=>rej(new Error('timeout '+ev)),timeout); s.once(ev,data=>{clearTimeout(t);res(data);}); }); }

async function run(){
  const port=34570;
  const proc=await startRelay(port);
  const url='http://127.0.0.1:'+port;
  let passed=0, failed=0;
  const test=async(name,fn)=>{
    try{ await fn(); console.log('  ✓ '+name); passed++; }catch(e){ console.error('  ✗ '+name+':',e.message); failed++; }
  };

  try{
    await test('tv:create_room devuelve hostToken y no lo ve jugador', async()=>{
      const tv=connect(url); await once(tv,'server_version');
      tv.emit('tv:create_room',{}); const data=await once(tv,'tv:room_created');
      assert(data.hostToken && data.hostToken.length>=32);
      assert(data.roomCode);
      const p=connect(url); await once(p,'server_version');
      p.emit('player:join',{roomCode:data.roomCode, name:'A', avatarId:0});
      const ack=await once(p,'player:join_ack');
      assert(!ack.hostToken, 'jugador no debe recibir hostToken');
      tv.disconnect(); p.disconnect();
    });

    await test('playerId estable: reconexión con mismo playerId no duplica', async()=>{
      const tv=connect(url); await once(tv,'server_version');
      tv.emit('tv:create_room',{}); const {roomCode}=await once(tv,'tv:room_created');
      const pid='stable-123';
      const p1=connect(url); await once(p1,'server_version');
      p1.emit('player:join',{roomCode, name:'Bob', avatarId:1, playerId:pid});
      const ack1=await once(p1,'player:join_ack'); assert(ack1.playerId===pid);
      const token=ack1.resumeToken;
      p1.disconnect(); await wait(400);
      const p2=connect(url); await once(p2,'server_version');
      const tvRejoin=once(tv,'tv:player_joined');
      p2.emit('player:join',{roomCode, name:'Bob', avatarId:1, playerId:pid, resumeToken:token});
      const ack2=await once(p2,'player:join_ack');
      assert(ack2.reconnected===true);
      const tvData=await tvRejoin;
      assert(tvData.player.playerId===pid);
      tv.disconnect(); p2.disconnect();
    });

    await test('hostToken protege tv:broadcast', async()=>{
      const tv=connect(url); await once(tv,'server_version');
      tv.emit('tv:create_room',{}); const {roomCode, hostToken}=await once(tv,'tv:room_created');
      const p=connect(url); await once(p,'server_version');
      p.emit('player:join',{roomCode, name:'P', avatarId:0}); await once(p,'player:join_ack');
      // jugador intenta hacer broadcast como si fuera TV (debe ser ignorado)
      let got=false; p.once('game:update',()=>got=true);
      p.emit('tv:broadcast',{roomCode, event:'ROUND_INFO', data:{round:99}});
      await wait(400);
      assert(got===false, 'jugador no debe poder broadcast');
      // TV con token correcto sí puede
      const pGot=once(p,'game:update');
      tv.emit('tv:broadcast',{roomCode, event:'ROUND_INFO', data:{round:2}, hostToken});
      const upd=await pGot;
      assert(upd.event==='ROUND_INFO' && upd.data.round===2);
      tv.disconnect(); p.disconnect();
    });

    await test('tv:reconnect_host recupera sala', async()=>{
      const tv1=connect(url); await once(tv1,'server_version');
      tv1.emit('tv:create_room',{}); const {roomCode, hostToken}=await once(tv1,'tv:room_created');
      tv1.disconnect(); await wait(200);
      const tv2=connect(url); await once(tv2,'server_version');
      tv2.emit('tv:reconnect_host',{roomCode, hostToken});
      const ack=await once(tv2,'tv:reconnect_ack');
      assert(ack.success===true && ack.roomCode===roomCode);
      tv2.disconnect();
    });

    await test('max players por sala', async()=>{
      const tv=connect(url); await once(tv,'server_version');
      tv.emit('tv:create_room',{}); const {roomCode}=await once(tv,'tv:room_created');
      const conns=[];
      for(let i=0;i<4;i++){
        const p=connect(url); await once(p,'server_version');
        p.emit('player:join',{roomCode, name:'P'+i, avatarId:0}); await once(p,'player:join_ack');
        conns.push(p);
      }
      const p5=connect(url); await once(p5,'server_version');
      p5.emit('player:join',{roomCode, name:'Extra', avatarId:0});
      const ack=await once(p5,'player:join_ack');
      assert(ack.success===false && /llena/.test(ack.error));
      conns.forEach(c=>c.disconnect()); tv.disconnect(); p5.disconnect();
    });

    await test('relay no sirve /api/songs (solo relay ligero)', async()=>{
      const r=await fetch(url+'/api/songs?limit=1');
      assert(r.status===404);
    });

    await test('QR apunta a relay (tv:room_created relayUrl)', async()=>{
      const tv=connect(url); await once(tv,'server_version');
      tv.emit('tv:create_room',{}); const data=await once(tv,'tv:room_created');
      assert(data.relayUrl);
      tv.disconnect();
    });

  } finally {
    proc.kill();
    await wait(500);
    try{ proc.kill('SIGKILL'); }catch{}
  }
  console.log(`\n[RELAY RESULT] ${passed} passed, ${failed} failed`);
  process.exit(failed>0?1:0);
}
run().catch(e=>{console.error(e);process.exit(1);});
