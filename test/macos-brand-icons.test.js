"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { PNG } = require("pngjs");

const repoRoot = path.resolve(__dirname, "..");
const generatorPath = path.join(repoRoot, "scripts", "generate-brand-icons.cjs");
const { generate } = require(generatorPath);

test("macOS icon consumers reference the generated orbit and template menu bar assets", () => {
  const iconRoot = path.join(
    repoRoot,
    "TokenTrackerBar",
    "TokenTrackerBar",
    "AppIcon.icon",
  );
  const icon = JSON.parse(fs.readFileSync(path.join(iconRoot, "icon.json"), "utf8"));
  const layers = icon.groups.flatMap((group) => group.layers);
  for (const imageName of ["01-background.svg", "02-orbit.svg"]) {
    assert.ok(layers.some((layer) => layer["image-name"] === imageName));
    assert.ok(fs.existsSync(path.join(iconRoot, "Assets", imageName)));
  }
  assert.equal(fs.existsSync(path.join(iconRoot, "Assets", "02-bolt.svg")), false);
  assert.equal(icon.groups[0].shadow.opacity, 0);
  assert.equal(icon.groups[0].translucency.enabled, false);
  const background = fs.readFileSync(
    path.join(iconRoot, "Assets", "01-background.svg"),
    "utf8",
  );
  assert.match(background, /M\s*0\s+0\s+L\s*1024\s+0\s+L\s*1024\s+1024\s+L\s*0\s+1024\s+Z/);

  const imageSetRoot = path.join(
    repoRoot,
    "TokenTrackerBar",
    "TokenTrackerBar",
    "Assets.xcassets",
    "MenuBarIcon.imageset",
  );
  const imageSet = JSON.parse(
    fs.readFileSync(path.join(imageSetRoot, "Contents.json"), "utf8"),
  );
  assert.equal(imageSet.properties["template-rendering-intent"], "template");
  assert.ok(imageSet.images.some((image) => image.filename === "menubar_18.png"));
  assert.ok(imageSet.images.some((image) => image.filename === "menubar_36.png"));
  for (const name of ["menubar_18.png", "menubar_36.png"]) {
    assert.ok(fs.existsSync(path.join(imageSetRoot, name)));
  }
  const statusBar = fs.readFileSync(
    path.join(repoRoot, "TokenTrackerBar", "TokenTrackerBar", "Services", "StatusBarController.swift"),
    "utf8",
  );
  assert.match(statusBar, /NSImage\(named: "MenuBarIcon"\)/);
});

test("macOS generator preserves the Swift scripts' targeted output contracts", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tokentracker-macos-icons-"));
  const iconAssetsDir = "icon-assets";
  const menubarAssetsDir = "menubar-assets";

  try {
    generate({ outputRoot: tempRoot, iconAssetsDir });
    generate({ outputRoot: tempRoot, menubarAssetsDir });

    const composerScript = fs.readFileSync(
      path.join(repoRoot, "TokenTrackerBar", "generate_icon_composer_assets.swift"),
      "utf8",
    );
    const menubarScript = fs.readFileSync(
      path.join(repoRoot, "TokenTrackerBar", "generate_menubar_icon.swift"),
      "utf8",
    );
    assert.match(composerScript, /"--output-root"/);
    assert.match(composerScript, /"--icon-assets-dir"/);
    assert.match(menubarScript, /"--output-root"/);
    assert.match(menubarScript, /"--menubar-assets-dir"/);

    const iconOutput = path.join(tempRoot, iconAssetsDir);
    const menubarOutput = path.join(tempRoot, menubarAssetsDir);
    assert.deepEqual(fs.readdirSync(iconOutput).sort(), [
      "01-background.svg",
      "02-orbit.svg",
    ]);
    const background = fs.readFileSync(
      path.join(iconOutput, "01-background.svg"),
      "utf8",
    );
    const orbit = fs.readFileSync(path.join(iconOutput, "02-orbit.svg"), "utf8");
    assert.match(background, /<svg\b/);
    assert.match(background, /fill=["']#000000["']/i);
    assert.match(orbit, /<svg\b/);
    assert.match(orbit, /#ffffff/i);

    for (const [name, expectedSize] of [
      ["menubar_18.png", 18],
      ["menubar_36.png", 36],
    ]) {
      const png = PNG.sync.read(fs.readFileSync(path.join(menubarOutput, name)));
      assert.equal(png.width, expectedSize);
      assert.equal(png.height, expectedSize);
      assert.equal(png.data[3], 0, `${name} must preserve a transparent background`);
      assert.ok(
        png.data.some((alpha, index) => index % 4 === 3 && alpha > 0),
        `${name} must include a visible template mark`,
      );
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
