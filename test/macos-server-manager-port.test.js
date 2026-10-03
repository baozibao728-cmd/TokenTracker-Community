const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverManagerPath = path.join(
  __dirname,
  "..",
  "TokenTrackerBar",
  "TokenTrackerBar",
  "Services",
  "ServerManager.swift",
);

function readServerManager() {
  return fs.readFileSync(serverManagerPath, "utf8");
}

test("macOS app launches local CLI on the same fixed port that WKWebView loads", () => {
  const source = readServerManager();

  assert.match(
    source,
    /process\.arguments\s*=\s*\[entryPath,\s*"serve",\s*"--port",\s*"\\\(Constants\.serverPort\)",\s*"--no-sync",\s*"--no-open"\]/,
    "embedded server launch should explicitly bind Constants.serverPort",
  );
  assert.doesNotMatch(
    source,
    /serve --port \\\(Constants\.serverPort\) --no-sync|launchSystemServer|ProcessRunner\.run/,
    "Community must not fall back to another installation's system CLI",
  );
  const constants = fs.readFileSync(path.join(path.dirname(serverManagerPath), "..", "Utilities", "Constants.swift"), "utf8");
  assert.match(constants, /serverPort\s*=\s*7682\b/, "Community must use its independent server port");
  assert.match(constants, /serverBaseURL\s*=\s*"http:\/\/localhost:7682"/,
    "the dashboard URL must use the same independent port");
});
