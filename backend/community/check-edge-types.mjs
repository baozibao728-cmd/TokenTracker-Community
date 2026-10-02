import path from 'node:path';
import { createRequire } from 'node:module';
import { dir,root,checkEdges } from './build-edges.mjs';
import { sdkImport } from './edge-spec.mjs';
const require=createRequire(new URL('../bootstrap/package.json',import.meta.url)), ts=require('typescript');
const sdk=path.join(path.dirname(require.resolve('@insforge/sdk')),'index.d.ts');
const program=ts.createProgram([...checkEdges().map(s=>path.join(root,s.source)),path.join(dir,'config.mjs'),
  path.join(root,'backend/edge/runtime-env.d.ts')],{
  noEmit:true,strict:true,allowJs:true,checkJs:true,allowImportingTsExtensions:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],paths:{[sdkImport]:[sdk]},
});
const diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:n=>n,getNewLine:()=> '\n'}));
  process.exitCode=1;
} else console.log('PASS strict Community TypeScript + quota JS checks against SDK 1.4.5');
