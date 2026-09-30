// Scan text source/release artifacts, not ignored dependencies or local credentials.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const patterns=[
  ['InsForge user key', /\buak_[A-Za-z0-9_-]{16,}/],
  ['GitHub token', /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/],
  ['JWT value', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ['private PEM', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['literal service secret', /(?:API_KEY|SERVICE_ROLE_KEY|JWT_SECRET|USER_API_KEY)\s*[:=]\s*["'][A-Za-z0-9_\/-]{16,}["']/i],
  ['local Windows path', /\b[A-Za-z]:[\\/](?:Users|zhuomian|CodexData|Program Files)[\\/]/i],
  ['local Unix home path', /\/(?:Users|home)\/[^\s"'`]+/],
  ['official production endpoint', /srctyff5\.us-east\.insforge\.app/],
];
let count=0;
const failures=[];
function scan(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(['node_modules','.git','.insforge'].includes(entry.name)) continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) {scan(file);continue;}
    const text=fs.readFileSync(file,'utf8');count++;
    for(const [label,pattern] of patterns) if(pattern.test(text)) failures.push(`${path.relative(backend,file)}: ${label}`);
  }
}
scan(backend);
if(failures.length) throw new Error(`Artifact scan failed (values withheld):\n${failures.join('\n')}`);
console.log(`PASS ${count} backend artifacts: no detected secret values, local user paths or official endpoint`);
