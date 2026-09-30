// Local TypeScript check against the real SDK declarations, without Deno/network.
import path from 'node:path';
import { createRequire } from 'node:module';
import { edgeEntries,root } from '../bootstrap/lib.mjs';
const require = createRequire(new URL('../bootstrap/package.json',import.meta.url));
const ts = require('typescript');
const declaration = path.join(root,'backend/edge/runtime-env.d.ts');
const sdk = path.join(path.dirname(require.resolve('@insforge/sdk')),'index.d.ts');
const options = {
  noEmit:true, strict:true, target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext,
  moduleResolution:ts.ModuleResolutionKind.Bundler, types:[],
  paths:{'npm:@insforge/sdk':[sdk]},
};
const files = edgeEntries().map(row=>path.join(root,row.entry));
const program = ts.createProgram([...files,declaration],options);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{
    getCurrentDirectory:()=>root,getCanonicalFileName:n=>n,getNewLine:()=> '\n',
  }));
  process.exitCode = 1;
} else console.log(`PASS strict TypeScript check for all ${files.length} MVP entries against InsForge SDK 1.4.5`);
