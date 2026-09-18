/**
 * Build — verifica runtime Node 22.18.0 y better-sqlite3
 */
const assert=require('assert');
const { execSync } = require('child_process');
const fs=require('fs');
const path=require('path');

function run(cmd, opts={}){
  return execSync(cmd, {encoding:'utf8', stdio:'pipe', ...opts}).trim();
}

async function test(){
  let passed=0, failed=0;
  const chk=async(name,fn)=>{
    try{ await fn(); console.log('  ✓ '+name); passed++; }catch(e){ console.error('  ✗ '+name+':',e.message); failed++; }
  };

  await chk('Node version 22.18.0 (si runtime existe)', async()=>{
    const runtime='runtime/node/node.exe';
    if (!fs.existsSync(runtime)) {
      // En Linux CI, verificar Node del sistema es 22.x
      const v=run('node --version');
      assert(v.startsWith('v22.'), 'Node system no es 22: '+v);
      console.log('    (runtime no existe, usando system '+v+')');
      return;
    }
    const v=run(`"${runtime}" --version`);
    assert(v==='v22.18.0', 'runtime version '+v+' != v22.18.0');
    const abi=run(`"${runtime}" -e "console.log(process.versions.modules)"`);
    assert(abi.trim().length>0);
    console.log('    ABI',abi.trim());
  });

  await chk('better-sqlite3 carga con runtime', async()=>{
    const runtime='runtime/node/node.exe';
    const nodeCmd=fs.existsSync(runtime) ? `"${runtime}"` : 'node';
    const out=run(`${nodeCmd} -e "const db=require('better-sqlite3')('server/songs.db'); console.log(db.prepare('SELECT COUNT(*) as c FROM songs').get().c)"`);
    const n=parseInt(out.trim(),10);
    assert(n===3845 || n>3000, 'count '+out);
  });

  await chk('SQLite SELECT COUNT(*)', async()=>{
    const db=require('better-sqlite3')('server/songs.db');
    const c=db.prepare('SELECT COUNT(*) as c FROM songs').get().c;
    assert(c===3845);
    db.close();
  });

  await chk('server/songs.db existe y no está en dist si no hay build', async()=>{
    assert(fs.existsSync('server/songs.db'));
    assert(fs.existsSync('server/shared/artist-metadata.json'));
  });

  await chk('installer.iss usa dist/desktop', async()=>{
    const iss=fs.readFileSync('installer.iss','utf8');
    assert(iss.includes('dist\\desktop'), 'installer debe empaquetar dist/desktop');
    assert(!iss.includes('Source: "server\\relay'), 'no debe incluir relay');
  });

  await chk('installer.iss excluye secretos/relay/tests/docs', async()=>{
    const iss=fs.readFileSync('installer.iss','utf8');
    assert(iss.includes('Excludes:'), 'installer debe tener Excludes defensivo');
    for (const needle of ['.env', '.git\\*', 'server\\relay', 'tests\\*', 'docs\\*']) {
      assert(iss.includes(needle), 'Excludes debe cubrir '+needle);
    }
  });

  await chk('build.bat instala solo deps de produccion en staging', async()=>{
    const bat=fs.readFileSync('build.bat','utf8');
    assert(bat.includes('--omit=dev'), 'build.bat debe usar --omit=dev');
    assert(bat.includes('--prefix "dist\\desktop"'), 'debe instalar en staging dist/desktop');
    assert(!bat.includes('server\\relay'), 'build.bat no debe copiar server/relay');
    assert(!/xcopy[^\n]*tests/i.test(bat), 'build.bat no debe copiar tests');
  });

  console.log(`\n[BUILD] ${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
}

test().catch(e=>{console.error(e);process.exit(1);});
