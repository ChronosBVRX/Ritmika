/**
 * Tests HTTP reales para server/local/index.js
 * Verifica que las rutas corregidas desde server/local sirven correctamente.
 */
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');

function wait(ms){return new Promise(r=>setTimeout(r,ms));}

async function startLocal(port){
  const env={...process.env, PORT:String(port)};
  delete env.GITHUB_TOKEN;
  const proc=spawn('node', [path.join(__dirname,'../server/local/index.js')], {env, stdio:'pipe'});
  proc.stdout.on('data',d=>process.stdout.write('[local] '+d));
  proc.stderr.on('data',d=>process.stderr.write('[local err] '+d));
  for(let i=0;i<20;i++){
    await wait(300);
    try{
      const r=await fetch('http://127.0.0.1:'+port+'/api/health').then(r=>r.json());
      if(r.server) return proc;
    }catch{}
  }
  throw new Error('local not up '+port);
}

async function run(){
  const port=34580;
  const proc=await startLocal(port);
  const base='http://127.0.0.1:'+port;
  let passed=0, failed=0;
  const test=async(name,fn)=>{
    try{ await fn(); console.log('  ✓ '+name); passed++; }catch(e){ console.error('  ✗ '+name+':',e.message); failed++; }
  };
  try{
    await test('GET / -> 200 y contiene TV', async()=>{
      const r=await fetch(base+'/');
      assert(r.status===200);
      const t=await r.text();
      assert(t.includes('Ritmika') || t.includes('tv') || t.includes('Tío Axolo'), 'no contiene TV');
    });
    await test('GET /join -> 200 y contiene mobile', async()=>{
      const r=await fetch(base+'/join');
      assert(r.status===200);
      const t=await r.text();
      assert(t.includes('mobile') || t.includes('Únete') || t.includes('Rítmika'), 'no contiene mobile');
    });
    await test('asset real -> 200', async()=>{
      // usar un avatar existente
      const r=await fetch(base+'/assets/avatars/avatar_0_taco_rockero.webp');
      assert(r.status===200, 'asset avatar 404');
      const ct=r.headers.get('content-type')||'';
      assert(ct.includes('webp') || ct.includes('image') || r.ok);
    });
    await test('GET /api/audio-files -> 200 y lista MP3', async()=>{
      const r=await fetch(base+'/api/audio-files');
      assert(r.status===200);
      const j=await r.json();
      assert(Array.isArray(j) && j.length>0 && j.some(f=>f.endsWith('.mp3')));
    });
    await test('GET /api/health -> catalogCount esperado', async()=>{
      const r=await fetch(base+'/api/health').then(r=>r.json());
      assert(r.server===true);
      assert(r.catalogCount===3845 || r.catalogCount>3000, 'catalogCount '+r.catalogCount);
    });
    await test('GET /api/songs?limit=1 -> resultado', async()=>{
      const j=await fetch(base+'/api/songs?limit=1').then(r=>r.json());
      assert(Array.isArray(j) && j.length===1);
      assert(j[0].id && j[0].title);
    });
    await test('GET /api/config -> refleja config', async()=>{
      const j=await fetch(base+'/api/config').then(r=>r.json());
      assert('relayUrl' in j || 'localBaseUrl' in j);
    });
  } finally {
    proc.kill(); await wait(500); try{proc.kill('SIGKILL');}catch{}
  }
  console.log(`\n[LOCAL HTTP] ${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
}

run().catch(e=>{console.error(e);process.exit(1);});
