const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const linux = path.join(root, 'TokenTrackerLinux');
const read = relative => fs.readFileSync(path.join(linux, relative), 'utf8');

test('Linux visible names use TokenOrbit while Tauri package identity stays stable', () => {
  const config = JSON.parse(read('src-tauri/tauri.conf.json'));
  const desktopTemplatePath = config.bundle.linux.deb.desktopTemplate;
  const desktopTemplate = read(`src-tauri/${desktopTemplatePath}`);
  const archDesktopPath = 'packaging/arch/tokentracker-linux/tokentracker-linux.desktop';
  const archDesktop = read(archDesktopPath);
  const cargo = read('src-tauri/Cargo.toml');
  const package = JSON.parse(read('package.json'));
  const archBuild = read('packaging/arch/tokentracker-linux/PKGBUILD');
  const paths = read('src-tauri/src/paths.rs');

  assert.equal(config.productName, 'TokenTracker Community');
  assert.equal(config.identifier, 'io.github.baozibao728cmd.tokentrackercommunity');
  assert.deepEqual(config.bundle.targets, ['appimage', 'deb', 'rpm']);
  assert.equal(config.bundle.linux.rpm.desktopTemplate, desktopTemplatePath);
  assert.match(desktopTemplate, /^Name=TokenOrbit$/m);
  assert.match(desktopTemplate, /^Exec={{exec}} %u$/m);
  assert.match(desktopTemplate, /^StartupWMClass={{exec}}$/m);
  assert.match(desktopTemplate, /^MimeType=x-scheme-handler\/tokentracker-community;$/m);

  assert.equal(package.name, 'tokentracker-community-linux');
  assert.match(cargo, /^\[package\][\s\S]*?^name = "tokentracker-community-linux"$/m);
  assert.match(cargo, /^\[\[bin\]\][\s\S]*?^name = "tokentracker-community-linux"$/m);
  assert.match(archBuild, /^pkgname=tokentracker-community-linux$/m);
  assert.match(paths, /const PRODUCT_DIR_NAME: &str = "TokenTracker Community";/);

  assert.equal(path.basename(archDesktopPath), 'tokentracker-linux.desktop');
  assert.match(archDesktop, /^Name=TokenOrbit$/m);
  assert.match(archDesktop, /^Exec=tokentracker-community-linux %u$/m);
  assert.match(archDesktop, /^Icon=tokentracker-community-linux$/m);
  assert.match(archDesktop, /^MimeType=x-scheme-handler\/tokentracker-community;$/m);

  const appimageOAuth = read('src-tauri/src/oauth.rs');
  assert.match(appimageOAuth, /Name=TokenOrbit/);
  assert.match(appimageOAuth, /tokentracker-community-appimage\.desktop/);
  assert.match(appimageOAuth, /x-scheme-handler\/tokentracker-community/);
});

test('Linux window, tray, loading page, and GNOME extension show TokenOrbit', () => {
  const main = read('src-tauri/src/main.rs');
  const tray = read('src-tauri/src/tray.rs');
  const page = read('src/index.html');
  const metadata = JSON.parse(read('gnome-extension/tokentracker@tokentracker.cc/metadata.json'));
  const extension = read('gnome-extension/tokentracker@tokentracker.cc/extension.js');

  assert.match(main, /\.title\("TokenOrbit"\)/);
  assert.match(tray, /"Open TokenOrbit Dashboard"/);
  assert.match(tray, /"Quit TokenOrbit"/);
  assert.match(tray, /\.tooltip\("TokenOrbit"\)/);
  assert.match(page, /<title>TokenOrbit<\/title>/);
  assert.match(page, /Starting TokenOrbit/);
  assert.match(page, /TokenOrbit could not start/);
  assert.equal(metadata.name, 'TokenOrbit');
  assert.equal(metadata.uuid, 'tokentracker-community@tokentracker.cc');
  assert.match(extension, /super\._init\(0\.5, 'TokenOrbit'\)/);
  assert.match(extension, /TokenOrbit isn’t running/);
  assert.match(extension, /Open TokenOrbit Dashboard/);
  assert.match(extension, /tokentracker-community-linux\.desktop/);
});
