#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("macOS display names are TokenOrbit while stable package identities remain intact", () => {
  const project = read("project.yml");
  const appInfo = read("TokenTrackerBar/Info.plist");
  const widgetInfo = read("TokenTrackerWidget/Info.plist");
  const snapshot = read("Shared/WidgetSnapshot.swift");
  const appEntitlements = read("TokenTrackerBar/TokenTrackerBar.entitlements");
  const widgetEntitlements = read("TokenTrackerWidget/TokenTrackerWidget.entitlements");
  const dmg = read("scripts/create-dmg.sh");
  const strings = read("TokenTrackerBar/Utilities/Strings.swift");
  const statusBar = read("TokenTrackerBar/Services/StatusBarController.swift");
  const dashboardWindow = read("TokenTrackerBar/Services/DashboardWindowController.swift");
  const island = read("TokenTrackerBar/Views/DynamicIslandView.swift");
  const dmgBackground = read("scripts/generate_dmg_bg.swift");

  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER: com\.tokentracker\.community\s/);
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER: com\.tokentracker\.community\.widget\s/);
  assert.match(project, /PRODUCT_NAME: TokenOrbit\s/);
  assert.match(project, /EXECUTABLE_NAME: TokenTracker Community\s/);
  assert.match(project, /CFBundleDisplayName: TokenOrbit\s/);
  assert.match(project, /CFBundleName: TokenOrbit\s/);
  assert.match(project, /CFBundleURLName: com\.tokentracker\.community\.auth\s/);
  assert.match(project, /- tokentracker-community\s/);
  assert.match(project, /CFBundleDisplayName: TokenOrbit Widgets\s/);
  assert.match(appInfo, /<string>TokenOrbit<\/string>/);
  assert.match(appInfo, /<string>tokentracker-community<\/string>/);
  assert.match(widgetInfo, /<string>TokenOrbit Widgets<\/string>/);
  assert.match(snapshot, /group\.com\.tokentracker\.community/);
  assert.match(snapshot, /com\.tokentracker\.community\.widget/);
  assert.match(snapshot, /Application Support\/TokenTrackerCommunity/);
  assert.match(appEntitlements, /group\.com\.tokentracker\.community/);
  assert.match(widgetEntitlements, /group\.com\.tokentracker\.community/);
  assert.match(strings, /static var appTitle: String \{ "TokenOrbit" \}/);
  assert.doesNotMatch(strings, /"[^"\r\n]*TokenTracker/);
  assert.equal((strings.match(/TokenOrbit Widgets/g) || []).length, 5);
  assert.match(statusBar, /TokenOrbit v\\\(version\)/);
  assert.match(dashboardWindow, /window\.title = Strings\.appTitle/);
  assert.match(island, /Text\(Strings\.appTitle\)/);
  assert.match(dmg, /APP_BUNDLE_NAME="TokenOrbit"/);
  assert.match(dmg, /VOLUME_NAME="TokenOrbit"/);
  assert.match(dmg, /DMG_FILENAME="TokenTrackerCommunity\.dmg"/);
  assert.match(dmgBackground, /TOKENORBIT/);
  const backgroundGeneration = dmg.indexOf('swift "$SCRIPT_DIR/generate_dmg_bg.swift"');
  assert.ok(backgroundGeneration >= 0, "DMG helper must run the current background generator");
  assert.ok(backgroundGeneration < dmg.indexOf('if [[ ! -f "$BG_IMAGE" ]]'));
  assert.ok(backgroundGeneration < dmg.indexOf("hdiutil create"));
});

test("macOS server uses its own port and data without adopting another process", () => {
  const constants = read("TokenTrackerBar/Utilities/Constants.swift");
  const server = read("TokenTrackerBar/Services/ServerManager.swift");

  assert.match(constants, /serverPort = 7682/);
  assert.match(constants, /serverBaseURL = "http:\/\/localhost:7682"/);
  assert.match(constants, /\.tokentracker-community/);
  assert.match(server, /env\["TOKENTRACKER_DATA_ROOT"\] = Constants\.dataRootURL\.path/);
  assert.doesNotMatch(server, /killExistingServerOnPort|kill\(pid|findTokenTrackerBinary|externalProcess/);
  assert.match(server, /guard let embedded = findEmbeddedServer\(\)/);
});

test("macOS updater preserves install-path compatibility for TokenOrbit", () => {
  const project = read("project.yml");
  const updater = read("TokenTrackerBar/Services/UpdateChecker.swift");
  const bundle = read("scripts/bundle-node.sh");
  const destinationPolicy = read("TokenTrackerBar/Models/AppInstallDestinationPolicy.swift");

  assert.match(updater, /repo = "baozibao728-cmd\/TokenTracker-Community"/);
  assert.match(updater, /asset\.name == "TokenTrackerCommunity\.dmg"/);
  assert.match(updater, /url\.path\.hasPrefix\("\/baozibao728-cmd\/TokenTracker-Community\/releases\/download\/"\)/);
  assert.match(updater, /let appName = "TokenOrbit\.app"/);
  assert.match(updater, /AppInstallDestinationPolicy\.resolve\(/);
  assert.match(updater, /legacyBundleName: "TokenTracker Community\.app"/);
  assert.match(project, /- path: TokenTrackerBar\/Models\/AppInstallDestinationPolicy\.swift/);
  assert.match(destinationPolicy, /Bundle\(url: url\)\?\.bundleIdentifier == expectedBundleIdentifier/);
  assert.match(destinationPolicy, /if hasFileSystemEntry\(at: newDestination/);
  assert.match(destinationPolicy, /destinationOfSymbolicLink\(atPath: url\.path\)/);
  assert.match(destinationPolicy, /if isOwnedApplicationBundle\(/);
  assert.match(destinationPolicy, /values\.isSymbolicLink != true/);
  assert.match(destinationPolicy, /ResolutionError\.existingDestinationHasDifferentIdentity/);
  assert.match(updater, /sourceBundle\.bundleIdentifier == expectedBundleIdentifier/);
  assert.doesNotMatch(updater, /contents\.first\(where:.*\.app|NSWorkspace\.shared\.open\(dmgURL\)/);
  assert.match(bundle, /RELEASE_CLIENT_CONFIG="\$REPO_ROOT\/\.tmp\/release-client-config\.json"/);
  assert.match(bundle, /cp "\$RELEASE_CLIENT_CONFIG" "\$TT_DIR\/src\/lib\/release-client-config\.json"/);
});
