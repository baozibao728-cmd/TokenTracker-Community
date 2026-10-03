const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const extensionDir = path.resolve(
  __dirname,
  "..",
  "TokenTrackerLinux",
  "gnome-extension",
  "tokentracker@tokentracker.cc",
);

test("GNOME extension parses as an ES module", () => {
  // Piped through stdin so Node 20 (no module detection) still checks it as ESM.
  const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    input: fs.readFileSync(path.join(extensionDir, "extension.js")),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});

test("GNOME extension metadata matches the documented installation directory and lists shell versions", () => {
  const metadata = JSON.parse(fs.readFileSync(path.join(extensionDir, "metadata.json"), "utf8"));
  // The historical checkout directory is retained, but GNOME loads the
  // documented symlink destination, whose basename must match the fork UUID.
  assert.equal(metadata.uuid, "tokentracker-community@tokentracker.cc");
  const readme = fs.readFileSync(path.join(extensionDir, "README.md"), "utf8");
  assert.ok(readme.includes(`~/.local/share/gnome-shell/extensions/${metadata.uuid}`));
  assert.ok(readme.includes(`gnome-extensions enable ${metadata.uuid}`));
  assert.ok(readme.includes(`ln -s "$PWD/TokenTrackerLinux/gnome-extension/${path.basename(extensionDir)}"`));
  assert.ok(Array.isArray(metadata["shell-version"]) && metadata["shell-version"].length > 0);
  for (const version of metadata["shell-version"]) {
    assert.match(version, /^\d+$/);
  }
});
