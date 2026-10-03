#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("macOS package and callback have independent Community identity", () => {
  const project = read("project.yml");
  const appInfo = read("TokenTrackerBar/Info.plist");
  const widgetInfo = read("TokenTrackerWidget/Info.plist");
  const snapshot = read("Shared/WidgetSnapshot.swift");
  const appEntitlements = read("TokenTrackerBar/TokenTrackerBar.entitlements");
  const widgetEntitlements = read("TokenTrackerWidget/TokenTrackerWidget.entitlements");
  const dmg = read("scripts/create-dmg.sh");

  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER: com\.tokentracker\.community\s/);
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER: com\.tokentracker\.community\.widget\s/);
  assert.match(project, /PRODUCT_NAME: TokenTracker Community\s/);
  assert.match(project, /CFBundleURLName: com\.tokentracker\.community\.auth\s/);
  assert.match(project, /- tokentracker-community\s/);
  assert.match(appInfo, /<string>tokentracker-community<\/string>/);
  assert.match(widgetInfo, /<string>TokenTracker Community Widgets<\/string>/);
  assert.match(snapshot, /group\.com\.tokentracker\.community/);
  assert.match(snapshot, /com\.tokentracker\.community\.widget/);
  assert.match(snapshot, /Application Support\/TokenTrackerCommunity/);
  assert.match(appEntitlements, /group\.com\.tokentracker\.community/);
  assert.match(widgetEntitlements, /group\.com\.tokentracker\.community/);
  assert.match(dmg, /APP_NAME="TokenTracker Community"/);
  assert.match(dmg, /DMG_FILENAME="TokenTrackerCommunity\.dmg"/);
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

test("macOS updater accepts only fork DMG and Community app bundle", () => {
  const updater = read("TokenTrackerBar/Services/UpdateChecker.swift");
  const bundle = read("scripts/bundle-node.sh");

  assert.match(updater, /repo = "baozibao728-cmd\/TokenTracker-Community"/);
  assert.match(updater, /asset\.name == "TokenTrackerCommunity\.dmg"/);
  assert.match(updater, /url\.path\.hasPrefix\("\/baozibao728-cmd\/TokenTracker-Community\/releases\/download\/"\)/);
  assert.match(updater, /let appName = "TokenTracker Community\.app"/);
  assert.match(updater, /sourceBundle\.bundleIdentifier == expectedBundleIdentifier/);
  assert.match(updater, /Bundle\(url: destApp\)\?\.bundleIdentifier == expectedBundleIdentifier/);
  assert.doesNotMatch(updater, /contents\.first\(where:.*\.app|NSWorkspace\.shared\.open\(dmgURL\)/);
  assert.match(bundle, /RELEASE_CLIENT_CONFIG="\$REPO_ROOT\/\.tmp\/release-client-config\.json"/);
  assert.match(bundle, /cp "\$RELEASE_CLIENT_CONFIG" "\$TT_DIR\/src\/lib\/release-client-config\.json"/);
});
