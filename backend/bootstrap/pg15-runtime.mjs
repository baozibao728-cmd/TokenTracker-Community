// Local isolated PostgreSQL 15 only. No connection URL/env credentials accepted.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function command(file, args) {
  return run(file, args, { windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
}
export async function createPg15Database() {
  let cleanRuntime = async () => {};
  let client;
  const additionalClients = new Set();
  try {
    const bin = path.join(here, 'node_modules/.cache/postgresql-15.18/pgsql/bin');
    const native = process.platform === 'win32' && await fs.access(path.join(bin,'postgres.exe')).then(()=>true,()=>false);
    let port;
    if (native) {
      const version = (await command(path.join(bin,'postgres.exe'),['--version'])).stdout;
      if (!/PostgreSQL\) 15\.18\b/.test(version)) throw new Error('Expected portable PostgreSQL 15.18');
      const data = await fs.mkdtemp(path.join(os.tmpdir(),'tokentracker-pg15-'));
      const server = net.createServer();
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
      port = server.address().port;
      await new Promise(resolve=>server.close(resolve));
      let child;
      let exitPromise;
      cleanRuntime = async () => {
        if (child && child.exitCode === null) {
          await command(path.join(bin,'pg_ctl.exe'),['-D',data,'stop','-m','fast','-w']);
          await exitPromise;
        }
        // Only this invocation's mkdtemp directory, checked before recursive cleanup.
        if (path.dirname(data)!==os.tmpdir() || !path.basename(data).startsWith('tokentracker-pg15-')) throw new Error('Unsafe PG test directory');
        await fs.rm(data,{recursive:true,force:true});
      };
      await command(path.join(bin,'initdb.exe'),['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
      // Temporary cluster, trust auth bound strictly to loopback; never a system service.
      child=spawn(path.join(bin,'postgres.exe'),['-D',data,'-h','127.0.0.1','-p',String(port),'-c','timezone=GMT'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
      let errorText='';
      child.stderr.on('data',data=>{errorText=(errorText+data.toString()).slice(-4000);});
      exitPromise = new Promise(resolve=>child.once('exit',resolve));
      child.once('error',error=>{errorText=error.message;});
      for(let i=0;i<100;i++) {
        if(child.exitCode!==null) throw new Error(`Local PG15 start failed: ${errorText}`);
        const ready=await command(path.join(bin,'pg_isready.exe'),['-h','127.0.0.1','-p',String(port)]).then(()=>true,()=>false);
        if(ready) break;
        if(i===99) throw new Error('Local PG15 readiness timeout');
        await pause(100);
      }
    } else {
      const context=JSON.parse((await command('docker',['context','inspect'])).stdout)[0];
      if(!/^(?:npipe:\/\/|unix:\/\/)/.test(context.Endpoints.docker.Host)) throw new Error('PG15 test requires a local Docker daemon');
      const name=`tokentracker-pg15-${randomUUID()}`;
      let started=false;
      cleanRuntime=async()=>{if(started) await command('docker',['rm','--force','--volumes',name]);};
      const password=randomUUID();
      await command('docker',['run','--detach','--name',name,'--publish','127.0.0.1::5432',
        '--env',`POSTGRES_PASSWORD=${password}`,'postgres:15.18-bookworm','-c','timezone=GMT']);
      started=true;
      const mapping=JSON.parse((await command('docker',['inspect',name])).stdout)[0].NetworkSettings.Ports['5432/tcp'][0];
      if(mapping.HostIp!=='127.0.0.1') throw new Error('PG15 test port must be loopback only');
      port=Number(mapping.HostPort);
      for(let i=0;i<100;i++) {
        const ready=await command('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).then(()=>true,()=>false);
        if(ready) break;
        if(i===99) throw new Error('Docker PG15 readiness timeout');
        await pause(200);
      }
      client=new pg.Client({host:'127.0.0.1',port,user:'postgres',password,database:'postgres',ssl:false,connectionTimeoutMillis:5000});
    }
    client ??= new pg.Client({host:'127.0.0.1',port,user:'postgres',database:'postgres',password:'',ssl:false,connectionTimeoutMillis:5000});
    await client.connect();
    const version=(await client.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version;
    if(version!==150018) throw new Error(`Expected PostgreSQL 15.18, got server_version_num=${version}`);
    return {query:(sql,args=[])=>client.query(sql,args),exec:sql=>client.query(sql),
      // Test-only additional connections to THIS ephemeral cluster. Never accepts
      // external URLs; credentials remain in memory, including the Docker case.
      createConnection:async()=>{
        const extra=new pg.Client({...client.connectionParameters,ssl:false});
        additionalClients.add(extra);
        await extra.connect();
        return extra;
      },
      close:async()=>{try {
        await Promise.all([...additionalClients].map(c=>c.end()));
        await client.end();
      } finally {await cleanRuntime();}}};
  } catch(error) {
    try {if(client) await client.end();} finally {await cleanRuntime();}
    throw new Error(`Real PG15 validation unavailable or failed (never skipped): ${error.message}`,{cause:error});
  }
}
