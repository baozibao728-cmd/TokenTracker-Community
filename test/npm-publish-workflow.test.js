const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const workflowDir = path.join(root, ".github", "workflows");

test("upstream npm publication remains disabled for the Community fork", () => {
  const workflow = fs.readFileSync(path.join(workflowDir, "npm-publish.yml"), "utf8");
  assert.match(workflow, /^name: npm publish \(disabled\)$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /^  disabled:$/m);
  assert.doesNotMatch(workflow, /workflow_run:|run:\s*npm publish|NPM_TOKEN|registry-url:/);
});

test("official leaderboard scheduled workflows are disconnected", () => {
  for (const name of [
    "leaderboard-anticheat.yml",
    "leaderboard-freshness.yml",
    "leaderboard-moderation-audit.yml",
  ]) {
    const workflow = fs.readFileSync(path.join(workflowDir, name), "utf8");
    assert.match(workflow, /\(disabled\)/, `${name} should be labeled disabled`);
    assert.match(workflow, /^  workflow_dispatch:$/m, `${name} should be manual-only`);
    assert.doesNotMatch(workflow, /^  schedule:|cron:/m, `${name} must have no schedule`);
    assert.doesNotMatch(workflow, /insforge\.app|functions\.tokentracker-/);
  }
});
