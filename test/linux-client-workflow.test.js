const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8').replace(/\r\n/g, '\n');
const release = fs.readFileSync(path.join(root, '.github/workflows/release-dmg.yml'), 'utf8').replace(/\r\n/g, '\n');
const validatorPath = path.join(root, 'TokenTrackerLinux/scripts/validate-package.sh');
const pkgbuild = fs.readFileSync(
  path.join(root, 'TokenTrackerLinux/packaging/arch/tokentracker-linux/PKGBUILD'),
  'utf8',
);

test('PR CI checks the Linux client with Rust tooling only', () => {
  assert.match(ci, /linux-client:/);
  assert.match(ci, /cargo test --locked/);
  assert.match(ci, /cargo clippy --locked --all-targets -- -D warnings/);
  assert.match(ci, /cargo fmt --check/);
  // webkit2gtk is needed to compile the tauri crate at all.
  assert.match(ci, /libwebkit2gtk-4\.1-dev/);
  // Cargo builds are slow enough that caching is not optional.
  assert.match(ci, /Swatinem\/rust-cache/);
});

test('PR CI does not run the heavy packaging path', () => {
  // Building an Arch package (or an AppImage) per PR costs a container, a full
  // pacman sync and the ~100MB embedded Node download for no extra signal --
  // packaging belongs to the release workflow.
  assert.doesNotMatch(ci, /^\s*image:\s*archlinux/m);

  // Compare against the executable content only: YAML comments legitimately
  // mention the tools being excluded, so a naive regex over the whole file
  // would match its own rationale.
  const commands = ci
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

  for (const packagingTool of ['makepkg', 'appimagetool', 'tauri build', 'bundle:node']) {
    assert.ok(
      !commands.includes(packagingTool),
      `PR CI should not invoke ${packagingTool}`,
    );
  }
});

test('release workflow builds Linux in parallel with macOS and Windows', () => {
  assert.match(release, /^name: release \(macOS \+ Windows \+ Linux\)$/m);

  // `needs: create-release` (not `needs: build`) is what makes it parallel.
  assert.match(release, /^ {2}linux:\n {4}needs: create-release$/m);

  // Every builder must check out the immutable version tag, not a branch.
  const linuxJob = release.slice(release.indexOf('\n  linux:'), release.indexOf('\n  publish:'));
  assert.match(linuxJob, /ref: refs\/tags\/v\$\{\{ inputs\.version \}\}/);

  // The runtime must be bundled before `tauri build`, because tauri-build
  // hard-fails on the missing EmbeddedServer resource path.
  const bundleIndex = linuxJob.indexOf('run bundle:node');
  const buildIndex = linuxJob.indexOf('run build');
  assert.notEqual(bundleIndex, -1, 'release must bundle the embedded runtime');
  assert.notEqual(buildIndex, -1, 'release must build the AppImage');
  assert.ok(bundleIndex < buildIndex, 'bundle:node must run before the AppImage build');
});

test('release builds one artifact per Linux format and verifies every payload', () => {
  const linuxJob = release.slice(release.indexOf('\n  linux:'), release.indexOf('\n  publish:'));

  // Guard against a silently empty bundle: a package without the embedded
  // runtime starts and then fails to find tracker.js on every machine. Each
  // format is produced by a separate tauri bundler and can fail on its own, so
  // all three are extracted and checked rather than trusting one as a proxy.
  assert.match(linuxJob, /--appimage-extract/);
  assert.match(linuxJob, /dpkg-deb -x/);
  assert.match(linuxJob, /rpm2cpio/);
  assert.match(
    linuxJob,
    /if ! \(cd "\$workdir\/rpm" && rpm2cpio[\s\S]*?fi\n\s+verify_payload "rpm"/,
    'an rpm extractor status must not bypass the fail-closed payload check',
  );
  assert.match(linuxJob, /verify_payload "AppImage"/);
  assert.match(linuxJob, /verify_payload "deb"/);
  assert.match(linuxJob, /verify_payload "rpm"/);

  assert.match(linuxJob, /EmbeddedServer/);
  assert.match(linuxJob, /tokentracker\/bin\/tracker\.js/);
  assert.match(linuxJob, /dashboard\/dist\/index\.html/);

  // One artifact per format: a second AppImage would mean an ambiguous upload.
  assert.match(linuxJob, /Expected exactly 1 \$label/);

  // rpm2cpio and cpio are not on ubuntu-latest by default; without them the
  // rpm arm cannot be inspected at all.
  assert.match(linuxJob, /^ {12}rpm \\$/m);
  assert.match(linuxJob, /^ {12}cpio$/m);

  for (const ext of ['AppImage', 'deb', 'rpm']) {
    assert.match(
      linuxJob,
      new RegExp(`dist-linux/TokenTracker-Community-linux-x86_64\\.${ext}`),
      `the ${ext} must be staged under its stable asset name`,
    );
  }
  assert.match(linuxJob, /TokenTracker-Community-linux-x86_64\.rpm --clobber/);
});

test('Linux release validates the Community backend configuration before bundling', () => {
  const linuxJob = release.slice(release.indexOf('\n  linux:'), release.indexOf('\n  publish:'));
  const preflight = linuxJob.indexOf('node scripts/prepare-release-client-config.cjs');
  const bundle = linuxJob.indexOf('run bundle:node');
  assert.ok(preflight >= 0, 'Linux release must validate its backend target and credential');
  assert.ok(bundle > preflight, 'client configuration must be checked before bundling');
  assert.match(linuxJob, /vars\.TOKENTRACKER_COMMUNITY_INSFORGE_BASE_URL/);
  assert.match(linuxJob, /secrets\.TOKENTRACKER_COMMUNITY_INSFORGE_ANON_KEY/);
});

test('publish waits for all three platforms and verifies every asset', () => {
  assert.match(release, /^ {4}needs: \[build, windows, linux\]$/m);

  const assetLine = release
    .split('\n')
    .find((line) => line.includes('for asset in'));
  assert.ok(assetLine, 'publish should enumerate the required assets');
  for (const asset of [
    'TokenTrackerCommunity.dmg',
    'TokenTracker-Community-win-x64.zip',
    'TokenTracker-Community-Setup.exe',
    'TokenTracker-Community-linux-x86_64.AppImage',
    'TokenTracker-Community-linux-x86_64.deb',
    'TokenTracker-Community-linux-x86_64.rpm',
  ]) {
    assert.ok(assetLine.includes(asset), `publish must verify ${asset}`);
  }
});

test('release verifies every managed version file via the shared registry', () => {
  // Adding a platform must not require a new hand-written version check.
  assert.match(release, /collectVersionEntries/);
  assert.match(release, /scripts\/version-files\.cjs/);
});

test('no workflow or doc still references the old release workflow name', () => {
  const files = [
    '.github/workflows/release-dmg.yml',
    'CLAUDE.md',
    'docs/opencode-go-limits.md',
  ];
  for (const file of files) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) continue;
    const contents = fs.readFileSync(fullPath, 'utf8');
    assert.doesNotMatch(
      contents,
      /release \(macOS \+ Windows\)(?! \+ Linux)/,
      `${file} still names the workflow "release (macOS + Windows)"`,
    );
  }
});

test('deb and rpm register tokentracker-community:// so the OAuth return reaches the app', () => {
  // Tauri's default desktop template has no %u and no scheme handler, and the
  // runtime xdg-mime registration only runs for the AppImage, so v1.1.0's deb
  // and rpm could never finish a browser sign-in.
  const tauriDir = path.join(root, 'TokenTrackerLinux/src-tauri');
  const conf = JSON.parse(fs.readFileSync(path.join(tauriDir, 'tauri.conf.json'), 'utf8'));
  const debTemplate = conf.bundle?.linux?.deb?.desktopTemplate;
  assert.ok(debTemplate, 'deb needs a custom desktop template');
  assert.equal(conf.bundle?.linux?.rpm?.desktopTemplate, debTemplate, 'rpm must use the same template');

  const template = fs.readFileSync(path.join(tauriDir, debTemplate), 'utf8');
  assert.match(template, /^Exec=\{\{exec\}\} %u$/m);
  assert.match(template, /^MimeType=x-scheme-handler\/tokentracker-community;$/m);

  const linuxJob = release.slice(release.indexOf('\n  linux:'), release.indexOf('\n  publish:'));
  assert.match(linuxJob, /verify_scheme_handler "deb" "\$workdir\/deb"/);
  assert.match(linuxJob, /verify_scheme_handler "rpm" "\$workdir\/rpm"/);
  assert.match(linuxJob, /grep -Fxq 'MimeType=x-scheme-handler\/tokentracker-community;'/);
  assert.match(linuxJob, /tokentracker-community-linux %u/);
});

test('Arch package build disables the unused split debug package', () => {
  assert.match(pkgbuild, /^options=\(!debug\)$/m);
});

test('Arch package validator checks the shipped runtime contract', () => {
  assert.ok(fs.existsSync(validatorPath), 'package validator should exist');
  const validator = fs.readFileSync(validatorPath, 'utf8');

  for (const required of [
    'usr/bin/tokentracker-community-linux',
    'usr/lib/tokentracker-community-linux/node',
    'usr/lib/tokentracker-community-linux/tokentracker/bin/tracker.js',
    'usr/lib/tokentracker-community-linux/tokentracker/src/lib/release-client-config.json',
    'usr/lib/tokentracker-community-linux/tokentracker/dashboard/dist/index.html',
    'usr/share/applications/tokentracker-community-linux.desktop',
    'usr/share/icons/hicolor/512x512/apps/tokentracker-community-linux.png',
    'usr/share/licenses/tokentracker-community-linux/LICENSE',
  ]) {
    assert.match(validator, new RegExp(required.replaceAll('/', '\\/')));
  }

  assert.match(validator, /desktop-file-validate/);
  assert.match(validator, /x-scheme-handler\/tokentracker-community/);
  assert.match(validator, /22\.22\.2/);
  assert.match(validator, /tokentracker-user-status/);
});

test('Linux release identity coexists with the official client', () => {
  const linuxRoot = path.join(root, 'TokenTrackerLinux');
  const tauriDir = path.join(linuxRoot, 'src-tauri');
  const conf = JSON.parse(fs.readFileSync(path.join(tauriDir, 'tauri.conf.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(linuxRoot, 'package.json'), 'utf8'));
  const cargo = fs.readFileSync(path.join(tauriDir, 'Cargo.toml'), 'utf8');
  const desktop = fs.readFileSync(
    path.join(linuxRoot, 'packaging/arch/tokentracker-linux/tokentracker-linux.desktop'),
    'utf8',
  );
  const extensionDir = path.join(linuxRoot, 'gnome-extension/tokentracker@tokentracker.cc');
  const extensionMeta = JSON.parse(fs.readFileSync(path.join(extensionDir, 'metadata.json'), 'utf8'));
  const extensionReadme = fs.readFileSync(path.join(extensionDir, 'README.md'), 'utf8');
  const oauth = fs.readFileSync(path.join(tauriDir, 'src/oauth.rs'), 'utf8');
  const server = fs.readFileSync(path.join(tauriDir, 'src/server.rs'), 'utf8');
  const bundler = fs.readFileSync(path.join(linuxRoot, 'scripts/bundle-node-linux.sh'), 'utf8');
  const readme = fs.readFileSync(path.join(linuxRoot, 'README.md'), 'utf8');

  assert.equal(conf.productName, 'TokenTracker Community');
  assert.equal(conf.identifier, 'io.github.baozibao728cmd.tokentrackercommunity');
  assert.equal(pkg.name, 'tokentracker-community-linux');
  assert.equal(extensionMeta.uuid, 'tokentracker-community@tokentracker.cc');
  assert.equal(extensionMeta.name, 'TokenOrbit');
  assert.match(extensionReadme, /extensions\/tokentracker-community@tokentracker\.cc/);
  assert.match(extensionReadme, /gnome-extensions enable tokentracker-community@tokentracker\.cc/);
  assert.doesNotMatch(extensionReadme, /gnome-extensions enable tokentracker@tokentracker\.cc/);
  assert.match(cargo, /^name = "tokentracker-community-linux"$/m);
  assert.match(cargo, /^\[\[bin\]\][\s\S]*?^name = "tokentracker-community-linux"$/m);
  assert.match(desktop, /^Name=TokenOrbit$/m);
  assert.match(desktop, /^Exec=tokentracker-community-linux %u$/m);
  assert.match(desktop, /^MimeType=x-scheme-handler\/tokentracker-community;$/m);
  assert.match(oauth, /tokentracker-community-appimage\.desktop/);
  assert.match(oauth, /x-scheme-handler\/tokentracker-community/);
  assert.match(server, /const PREFERRED_PORT: u16 = 17681;/);
  assert.match(
    server,
    /command\.env\(\s*"TOKENTRACKER_DATA_ROOT",\s*home\.join\("\.tokentracker-community"\),?\s*\);/,
  );
  assert.doesNotMatch(server, /PREFERRED_PORT: u16 = 17680/);
  assert.match(bundler, /\.tmp\/release-client-config\.json/);
  assert.match(bundler, /src\/lib\/release-client-config\.json/);
  assert.match(readme, /TokenTracker-Community\/releases\/latest/);
  assert.doesNotMatch(readme, /github\.com\/(?:xiufengsun|mm7894215)\/TokenTracker/);
});
