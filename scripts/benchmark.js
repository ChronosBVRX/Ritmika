#!/usr/bin/env node
/**
 * Benchmark Rítmika — mide arranque, uso recursos y latencia
 */
const { spawn } = require('child_process');
const fs = require('fs');

async function measureLocalStartup() {
  console.log('=== Benchmark Local ===');
  const start = Date.now();
  const proc = spawn('node', ['server/local/index.js'], {
    env: { ...process.env, PORT: '34572' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let ready = false;
  proc.stdout.on('data', d => { if (d.toString().includes('RÍTMIKA SERVER')) ready = true; });
  for (let i=0;i<30;i++) {
    await new Promise(r=>setTimeout(r,200));
    try {
      const r = await fetch('http://127.0.0.1:34572/api/health').then(r=>r.json());
      if (r.server) {
        const elapsed = Date.now() - start;
        console.log(`Arranque local: ${elapsed} ms`);
        // Medir /api/songs
        const t0 = Date.now();
        await fetch('http://127.0.0.1:34572/api/songs?limit=1').then(r=>r.json());
        console.log(`Carga catálogo (1 canción): ${Date.now()-t0} ms`);
        // Medir uso memoria (aprox)
        const mem = process.memoryUsage();
        console.log(`Memoria Node (benchmark proceso): ${(mem.heapUsed/1024/1024).toFixed(1)} MB`);
        proc.kill();
        return elapsed;
      }
    } catch {}
  }
  proc.kill();
  console.log('Timeout arranque local');
  return null;
}

async function measureRelayStartup() {
  console.log('\n=== Benchmark Relay ===');
  const start = Date.now();
  const proc = spawn('node', ['server/relay/index.js'], {
    env: { ...process.env, RELAY_PORT: '34573' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  for (let i=0;i<20;i++) {
    await new Promise(r=>setTimeout(r,200));
    try {
      const r = await fetch('http://127.0.0.1:34573/api/relay-health').then(r=>r.json());
      if (r.relay) {
        const elapsed = Date.now() - start;
        console.log(`Arranque relay: ${elapsed} ms`);
        proc.kill();
        return elapsed;
      }
    } catch {}
  }
  proc.kill();
  console.log('Timeout relay');
  return null;
}

async function measureLatency() {
  console.log('\n=== Latencia Socket.IO (relay) ===');
  const { io } = require('../node_modules/socket.io-client');
  const proc = spawn('node', ['server/relay/index.js'], {
    env: { ...process.env, RELAY_PORT: '34574' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise(r=>setTimeout(r,1500));
  const url='http://127.0.0.1:34574';
  const tv=io(url,{transports:['websocket']});
  await new Promise(res=>tv.once('connect',res));
  const t0=Date.now();
  tv.emit('tv:create_room',{}); 
  const data=await new Promise(res=>tv.once('tv:room_created',res));
  const lat1=Date.now()-t0;
  console.log(`Crear sala: ${lat1} ms`);
  const p=io(url,{transports:['websocket']});
  await new Promise(res=>p.once('connect',res));
  const t1=Date.now();
  p.emit('player:join',{roomCode:data.roomCode, name:'Bench', avatarId:0});
  await new Promise(res=>p.once('player:join_ack',res));
  const lat2=Date.now()-t1;
  console.log(`Join jugador: ${lat2} ms`);
  // Broadcast
  const t2=Date.now();
  const got=new Promise(res=>p.once('game:update',res));
  tv.emit('tv:broadcast',{roomCode:data.roomCode, event:'PING', data:{}, hostToken:data.hostToken});
  await got;
  console.log(`Broadcast TV->móvil: ${Date.now()-t2} ms`);
  // Tomatazo
  const t3=Date.now();
  const tvGot=new Promise(res=>tv.once('tv:tomatazo',res));
  p.emit('player:tomatazo',{roomCode:data.roomCode, targetName:'X'});
  await tvGot;
  console.log(`Tomatazo móvil->TV: ${Date.now()-t3} ms`);
  tv.disconnect(); p.disconnect();
  proc.kill();
}

(async()=>{
  await measureLocalStartup();
  await measureRelayStartup();
  await measureLatency();
  console.log('\n=== Notas ===');
  console.log('- WebView2 GPU: verificar en GameWindow.cs flags --enable-gpu-rasterization etc.');
  console.log('- Si relay en Render, latencia típica 30-80ms TV↔relay↔móvil (medir con datos móviles).');
  console.log('- Cache vídeo: primera reproducción descarga ~5-30MB, siguientes desde %LOCALAPPDATA%/Ritmika/cache/videos');
})();
