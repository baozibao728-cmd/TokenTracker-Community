"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { cmdUninstall } = require("../src/commands/uninstall");

test("isolated uninstall purges only its data root and leaves upstream hooks alone", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "tokentracker-isolated-uninstall-"));
  const officialRoot = path.join(tmp, ".tokentracker");
  const communityRoot = path.join(tmp, ".tokentracker-community");
  const claudeSettings = path.join(tmp, ".claude", "settings.json");
  const originalHome = os.homedir;
  const previousDataRoot = process.env.TOKENTRACKER_DATA_ROOT;
  let output = "";
  const originalWrite = process.stdout.write;

  try {
    os.homedir = () => tmp;
    process.env.TOKENTRACKER_DATA_ROOT = communityRoot;
    await Promise.all([
      fs.mkdir(path.join(officialRoot, "tracker"), { recursive: true }),
      fs.mkdir(path.join(communityRoot, "tracker"), { recursive: true }),
      fs.mkdir(path.dirname(claudeSettings), { recursive: true }),
    ]);
    await fs.writeFile(path.join(officialRoot, "tracker", "queue.jsonl"), "official data\n");
    await fs.writeFile(path.join(communityRoot, "tracker", "queue.jsonl"), "community data\n");
    await fs.writeFile(claudeSettings, JSON.stringify({ hooks: { Stop: [{ command: "official-hook" }] } }));
    process.stdout.write = (chunk) => {
      output += String(chunk);
      return true;
    };

    await cmdUninstall(["--purge"]);

    await assert.rejects(fs.stat(communityRoot), { code: "ENOENT" });
    assert.equal(await fs.readFile(path.join(officialRoot, "tracker", "queue.jsonl"), "utf8"), "official data\n");
    assert.deepEqual(JSON.parse(await fs.readFile(claudeSettings, "utf8")), {
      hooks: { Stop: [{ command: "official-hook" }] },
    });
    assert.match(output, /global provider integrations left unchanged/);
  } finally {
    process.stdout.write = originalWrite;
    os.homedir = originalHome;
    if (previousDataRoot === undefined) delete process.env.TOKENTRACKER_DATA_ROOT;
    else process.env.TOKENTRACKER_DATA_ROOT = previousDataRoot;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
