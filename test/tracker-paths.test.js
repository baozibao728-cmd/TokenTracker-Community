"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const {
  COMMUNITY_DIR,
  isIsolatedTrackerRuntime,
  resolveTrackerPaths,
  resolveTrackerRoot,
} = require("../src/lib/tracker-paths");
const { readKiroCreditsSummary } = require("../src/lib/usage-limits");

test("source checkouts keep the legacy runtime path by default", () => {
  const home = path.join(os.tmpdir(), "tokentracker-paths-home");
  assert.equal(resolveTrackerRoot({ home, env: {} }), path.join(home, ".tokentracker"));
  assert.equal(isIsolatedTrackerRuntime({ TOKENTRACKER_DATA_ROOT: "" }), false);
});

test("explicit data root isolates all tracker subdirectories", async () => {
  const home = path.join(os.tmpdir(), "tokentracker-paths-home");
  const rootDir = path.join(os.tmpdir(), "tokentracker-community-data");
  const env = { TOKENTRACKER_DATA_ROOT: rootDir };

  assert.equal(isIsolatedTrackerRuntime(env), true);
  assert.deepEqual(await resolveTrackerPaths({ home, env }), {
    rootDir,
    trackerDir: path.join(rootDir, "tracker"),
    binDir: path.join(rootDir, "bin"),
    cacheDir: path.join(rootDir, "cache"),
  });
});

test("explicit data root must be absolute and disjoint from upstream data", () => {
  const home = path.join(os.tmpdir(), "tokentracker-paths-home");
  assert.throws(
    () => resolveTrackerRoot({ home, env: { TOKENTRACKER_DATA_ROOT: "relative-data" } }),
    /must be an absolute path/,
  );
  for (const root of [
    path.join(home, ".tokentracker"),
    path.join(home, ".tokentracker", "community"),
    home,
    path.parse(home).root,
  ]) {
    assert.throws(
      () => resolveTrackerRoot({ home, env: { TOKENTRACKER_DATA_ROOT: root } }),
      /must not overlap the upstream data directory/,
      `expected ${root} to be rejected`,
    );
  }
});

test("explicit data root cannot alias upstream data through a symlink", async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "tokentracker-paths-symlink-home-"));
  const upstreamRoot = path.join(home, ".tokentracker");
  const aliasRoot = path.join(home, "community-alias");
  try {
    await fs.mkdir(path.join(upstreamRoot, "community"), { recursive: true });
    try {
      await fs.symlink(path.join(upstreamRoot, "community"), aliasRoot, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        t.skip(`directory symlinks unavailable: ${error.code}`);
        return;
      }
      throw error;
    }

    assert.throws(
      () => resolveTrackerRoot({ home, env: { TOKENTRACKER_DATA_ROOT: aliasRoot } }),
      /must not overlap the upstream data directory/,
    );
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("community data directory has a separate default name", () => {
  assert.equal(COMMUNITY_DIR, ".tokentracker-community");
});

test("usage-limit sidecars follow the explicit community data root", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "tokentracker-limits-home-"));
  const rootDir = path.join(home, COMMUNITY_DIR);
  const officialSidecar = path.join(home, ".tokentracker", "tracker", "kiro-credits.json");
  const communitySidecar = path.join(rootDir, "tracker", "kiro-credits.json");
  const previousDataRoot = process.env.TOKENTRACKER_DATA_ROOT;
  try {
    await fs.mkdir(path.dirname(officialSidecar), { recursive: true });
    await fs.mkdir(path.dirname(communitySidecar), { recursive: true });
    await fs.writeFile(officialSidecar, JSON.stringify({
      version: 1, total_credits: 111, record_count: 1, session_count: 1,
    }));
    await fs.writeFile(communitySidecar, JSON.stringify({
      version: 1, total_credits: 222, record_count: 2, session_count: 2,
    }));
    process.env.TOKENTRACKER_DATA_ROOT = rootDir;

    assert.equal(readKiroCreditsSummary({ home }).tracked_credits, 222);
  } finally {
    if (previousDataRoot === undefined) delete process.env.TOKENTRACKER_DATA_ROOT;
    else process.env.TOKENTRACKER_DATA_ROOT = previousDataRoot;
    await fs.rm(home, { recursive: true, force: true });
  }
});
