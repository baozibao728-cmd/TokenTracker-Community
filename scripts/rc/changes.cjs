"use strict";
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
function requiresBuild(files) {
  return files.some(file => /^(?:\.github\/workflows\/(?:rc-build-only|ci)\.yml|scripts\/rc\/|scripts\/(?:prepare-release-client-config|validate-versions)\.cjs|package(?:-lock)?\.json|bin\/|src\/|dashboard\/|TokenTracker(?:Win|Bar|Linux)\/)/.test(file));
}
if (require.main === module) {
  const { RC_COMPARE_SHA: before, RC_SOURCE_SHA: head, GITHUB_OUTPUT: output } = process.env;
  if (![before, head].every(sha => /^[a-f0-9]{40}$/.test(sha || ""))) throw new Error("Missing RC comparison SHA.");
  const files = execFileSync("git", ["diff", "--name-only", "-z", before, head], { encoding: "utf8" }).split("\0").filter(Boolean);
  const build = requiresBuild(files);
  fs.appendFileSync(output, `build=${build}\n`);
  console.log(`RC candidate comparison: ${files.length} changed files; build=${build}`);
}
module.exports = { requiresBuild };
