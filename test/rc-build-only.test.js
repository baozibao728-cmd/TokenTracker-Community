"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { names, record, assemble, verify } = require("../scripts/rc/artifacts.cjs");
const sha = "a".repeat(40);

test("RC workflow is own-repo PR-only, read-only, with explicit head checkout on every runner", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows/rc-build-only.yml"), "utf8");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /contents: read/);
  assert.equal((workflow.match(/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/g) || []).length, 4);
  assert.equal((workflow.match(/head\.repo\.full_name == github\.repository/g) || []).length, 4);
  assert.doesNotMatch(workflow, /contents: write|pull_request_target|workflow_dispatch|workflow_call|release-(?:dmg|windows)\.yml|gh release|git tag|npm publish|continue-on-error/);
  assert.doesNotMatch(workflow, /paths:[\s\S]*?['"](?:\*\*\.md|RELEASE_OWNERSHIP_CUTOVER_REPORT\.md)['"]/);
  assert.match(workflow, /digest-mismatch: error/);
});

async function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "community-rc-artifacts-"));
  try {
    const input = path.join(root, "input");
    const out = path.join(root, "delivery");
    for (const [platform, files] of Object.entries(names)) {
      const dir = path.join(input, `rc-${platform}-${sha}`);
      fs.mkdirSync(dir, { recursive: true });
      for (const file of files) fs.writeFileSync(path.join(dir, file), `synthetic package bytes ${file}`);
      await record(dir, platform, sha);
    }
    await fn({ input, out });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test("RC delivery verifies the actual uploaded bytes of all six packages", async () => {
  await fixture(async ({ input, out }) => {
    await assemble(input, out, sha);
    const data = await verify(out, sha);
    assert.equal(data.packages.length, 6);
    assert.equal(fs.readFileSync(path.join(out, "SHA256SUMS"), "utf8").trim().split("\n").length, 6);
    assert.ok(data.packages.every(p => p.size > 0 && p.sha256.length === 64));
  });
});
test("RC fails closed on changed package bytes after platform upload", async () => {
  await fixture(async ({ input, out }) => {
    fs.appendFileSync(path.join(input, `rc-linux-${sha}`, names.linux[2]), "tampered");
    await assert.rejects(assemble(input, out, sha), /bytes\/checksum mismatch/);
  });
});
test("RC rejects missing format and mismatched candidate SHA", async () => {
  await fixture(async ({ input, out }) => {
    const metadataFile = path.join(input, `rc-linux-${sha}`, "linux.json");
    const data = JSON.parse(fs.readFileSync(metadataFile));
    data.packages.pop();
    fs.writeFileSync(metadataFile, JSON.stringify(data));
    await assert.rejects(assemble(input, out, sha), /inventory mismatch/);
    data.source_sha = "b".repeat(40);
    fs.writeFileSync(metadataFile, JSON.stringify(data));
    await assert.rejects(assemble(input, out, sha), /source\/checkout\/version mismatch/);
  });
});
test("RC rejects altered checksum manifest after final delivery", async () => {
  await fixture(async ({ input, out }) => {
    await assemble(input, out, sha);
    fs.writeFileSync(path.join(out, "SHA256SUMS"), "0".repeat(64));
    await assert.rejects(verify(out, sha), /checksum file mismatch/);
  });
});
