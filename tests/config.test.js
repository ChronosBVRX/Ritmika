/**
 * Config test — verifica que %LOCALAPPDATA%\Ritmika\.env tiene prioridad
 */
const assert=require('assert');
const { spawn } = require('child_process');
const fs=require('fs');
const path=require('path');
const os=require('os');

function wait(ms){return new Promise(r=>setTimeout(r,ms));}

async function startLocal(port, envExtra={}){
  const env={...process.env, PORT:String(port), ...envExtra};
  delete env.GITHUB_TOKEN;
  const proc=spawn('node', [path.join(__dirname,'../server/local/index.js')], {env, stdio:'pipe'});
  for(let i=0;i<20;i++){
    await wait(300);
    try{
      const r=await fetch('http://127.0.0.1:'+port+'/api/config').then(r=>r.json());
      if(r.localBaseUrl) return {proc, config:r};
    }catch{}
  }
  throw new Error('local not up');
}

async function run(){
  const tmpDir=fs.mkdtempSync(path.join(os.tmpdir(),'ritmika-config-'));
  const appData=path.join(tmpDir,'Ritmika');
  fs.mkdirSync(appData,{recursive:true});
  fs.writeFileSync(path.join(appData,'.env'), 'RELAY_URL=https://localappdata.test.example.com\nCONNECTION_MODE=online\nVIDEO_CACHE_MAX_MB=123\n');
  console.log('Testing with LOCALAPPDATA='+tmpDir);

  let port1=34581;
  let {proc, config}=await startLocal(port1, {LOCALAPPDATA:tmpDir});
  try{
    assert(config.relayUrl==='https://localappdata.test.example.com', 'relayUrl from LOCALAPPDATA '+config.relayUrl);
    assert(config.connectionMode==='online', 'mode online '+config.connectionMode);
    console.log('  ✓ LOCALAPPDATA .env → /api/config');
    // Verificar que /api/health también refleja
    const h=await fetch('http://127.0.0.1:'+port1+'/api/health').then(r=>r.json());
    assert(h.relayUrl==='https://localappdata.test.example.com');
    console.log('  ✓ /api/health refleja relayUrl');
  } finally {
    proc.kill(); await wait(500); try{proc.kill('SIGKILL');}catch{}
  }

  // Test modo LAN (sin RELAY_URL)
  const port2=34582;
  const {proc:proc2, config:cfg2}=await startLocal(port2, {LOCALAPPDATA: path.join(os.tmpdir(),'empty-'+Date.now())});
  try{
    // Si no hay .env, debe ser lan y relayUrl vacío (o lo que haya en repo/.env)
    // En este entorno repo/.env tiene RELAY_URL vacío, así que debe ser lan
    // Pero si repo/.env tiene algo, lo ignoramos — verificamos que sin LOCALAPPDATA no sea online con test url
    if(cfg2.relayUrl==='https://localappdata.test.example.com') throw new Error('no debería tener test url');
    console.log('  ✓ Sin LOCALAPPDATA, no usa test relay (mode='+cfg2.connectionMode+')');
  } finally {
    proc2.kill(); await wait(500); try{proc2.kill('SIGKILL');}catch{}
  }

  fs.rmSync(tmpDir,{recursive:true, force:true});
  console.log('\n[CONFIG] all passed');
}

run().catch(e=>{console.error(e);process.exit(1);});
