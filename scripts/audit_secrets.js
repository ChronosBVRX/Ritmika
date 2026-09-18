#!/usr/bin/env node
/**
 * Auditoría de secretos — verifica que no se distribuyan credenciales en el instalador
 * Falla si encuentra tokens reales en archivos que van al instalador.
 */
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');

const forbiddenPatterns=[
  { pat:/R2_SECRET_ACCESS_KEY\s*=\s*\S{20,}/i, desc:'R2 secret en archivo trackeado' },
  { pat:/GITHUB_TOKEN\s*=\s*ghp_[A-Za-z0-9_]{20,}/i, desc:'GitHub token' },
  { pat:/ELEVENLABS_API_KEY\s*=\s*sk_[A-Za-z0-9]{20,}/i, desc:'ElevenLabs key' },
];

const allowList=[
  'scripts/audit_secrets.js',
  '.env.example',
  'README.md',
  'docs/',
];

function shouldIgnore(file){
  if (file.includes('node_modules')) return true;
  if (file.includes('.git')) return true;
  if (file.includes('songs.db')) return true;
  if (file.includes('runtime/node')) return true;
  if (file.includes('installer/output')) return true;
  return false;
}

function walk(dir, files=[]){
  for(const e of fs.readdirSync(dir, {withFileTypes:true})){
    const p=path.join(dir,e.name);
    const rel=path.relative(root,p).replace(/\\/g,'/');
    if (shouldIgnore(rel)) continue;
    if (allowList.some(a=>rel.startsWith(a) || rel===a)) continue;
    if (e.isDirectory()) walk(p,files);
    else if (/\.(js|ts|json|iss|bat|ps1|html|md|env)$/i.test(e.name)) files.push(p);
  }
  return files;
}

let found=0;
for(const f of walk(root)){
  const content=fs.readFileSync(f,'utf8');
  const rel=path.relative(root,f);
  for(const {pat,desc} of forbiddenPatterns){
    if(pat.test(content)){
      console.error(`[SECRETS] ${desc} en ${rel}: ${content.match(pat)[0].slice(0,60)}...`);
      found++;
    }
  }
  // Buscar .env real trackeado en git
  if (rel==='.env') {
    try {
      const { execSync } = require('child_process');
      const tracked = execSync('git ls-files --error-unmatch .env 2>&1', { cwd: root }).toString();
      if (tracked.trim()) {
        console.error(`[SECRETS] .env del desarrollador está trackeado en git!`);
        found++;
      }
    } catch {}
  }
}

// Verificar que installer.iss no incluye .env
const iss=fs.readFileSync(path.join(root,'installer.iss'),'utf8');
if (iss.includes('.env') && !iss.includes('Excludes') ) {
  console.error('[SECRETS] installer.iss podría incluir .env');
  found++;
}
if (iss.match(/R2_SECRET|GITHUB_TOKEN|ELEVENLABS/)) {
  console.error('[SECRETS] installer.iss contiene secretos');
  found++;
}

// Verificar que runtime/node no está commiteado (solo .gitignore)
if (fs.existsSync(path.join(root,'runtime/node/node.exe'))) {
  console.warn('[INFO] runtime/node/node.exe existe localmente pero está en .gitignore (ok)');
}

if (found>0){
  console.error(`\nAuditoría falló: ${found} secretos encontrados`);
  process.exit(1);
} else {
  console.log('✓ Auditoría de secretos OK — no se encontraron credenciales en instalador');
}
