const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const COMMUNITY_DIR = ".tokentracker-community";
const LEGACY_DIR = ".tokentracker";

function isPackagedCommunityRuntime() {
  // The release bundle receives this generated file only after the release
  // client configuration guard has passed. A source checkout keeps its old
  // test/development path unless the data root is explicitly overridden.
  return fs.existsSync(path.join(__dirname, "release-client-config.json"));
}

function isIsolatedTrackerRuntime(env = process.env) {
  return Boolean(String(env.TOKENTRACKER_DATA_ROOT || "").trim()) || isPackagedCommunityRuntime();
}

function resolvePathThroughExistingAncestor(candidate) {
  let probe = path.resolve(candidate);
  const missingParts = [];
  while (true) {
    try {
      return path.resolve(fs.realpathSync(probe), ...missingParts.reverse());
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") return path.resolve(candidate);
      const parent = path.dirname(probe);
      if (parent === probe) return path.resolve(candidate);
      missingParts.unshift(path.basename(probe));
      probe = parent;
    }
  }
}

function pathsOverlap(first, second) {
  const relative = path.relative(first, second);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveTrackerRoot({ home = os.homedir(), env = process.env } = {}) {
  const override = String(env.TOKENTRACKER_DATA_ROOT || "").trim();
  if (override) {
    if (!path.isAbsolute(override)) {
      throw new Error("TOKENTRACKER_DATA_ROOT must be an absolute path");
    }
    const resolved = path.resolve(override);
    const upstreamRoot = path.join(home, LEGACY_DIR);
    const relativeToUpstream = path.relative(upstreamRoot, resolved);
    const relativeToOverride = path.relative(resolved, upstreamRoot);
    const overlapsUpstream =
      relativeToUpstream === "" || (!relativeToUpstream.startsWith("..") && !path.isAbsolute(relativeToUpstream))
      || relativeToOverride === "" || (!relativeToOverride.startsWith("..") && !path.isAbsolute(relativeToOverride));
    const realResolved = resolvePathThroughExistingAncestor(resolved);
    const realUpstream = resolvePathThroughExistingAncestor(upstreamRoot);
    const overlapsUpstreamAlias = pathsOverlap(realUpstream, realResolved) || pathsOverlap(realResolved, realUpstream);
    if (overlapsUpstream || overlapsUpstreamAlias || resolved === path.parse(resolved).root) {
      throw new Error("TOKENTRACKER_DATA_ROOT must not overlap the upstream data directory or filesystem root");
    }
    return resolved;
  }
  return path.join(home, isPackagedCommunityRuntime() ? COMMUNITY_DIR : LEGACY_DIR);
}

async function resolveTrackerPaths({ home = os.homedir(), env = process.env } = {}) {
  const rootDir = resolveTrackerRoot({ home, env });
  return {
    rootDir,
    trackerDir: path.join(rootDir, "tracker"),
    binDir: path.join(rootDir, "bin"),
    cacheDir: path.join(rootDir, "cache"),
  };
}

module.exports = {
  COMMUNITY_DIR,
  isPackagedCommunityRuntime,
  isIsolatedTrackerRuntime,
  resolveTrackerRoot,
  resolveTrackerPaths,
};
