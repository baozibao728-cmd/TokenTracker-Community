"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { verifyDisplayNames } = require("../scripts/rc/verify-runtime.cjs");

test("actual packaged page titles must show TokenOrbit, including the standalone share entry", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tokenorbit-name-"));
  try {
    fs.writeFileSync(path.join(directory, "index.html"), "<title>TokenOrbit — Dashboard</title>");
    fs.writeFileSync(path.join(directory, "share.html"), "<title>Share — TokenOrbit</title>");
    assert.doesNotThrow(() => verifyDisplayNames(directory));
    for (const title of ["Token Tracker", "TokenTracker Community", "TokenOrbit / TokenTracker", ""]) {
      fs.writeFileSync(path.join(directory, "share.html"), `<title>${title}</title>`);
      assert.throws(() => verifyDisplayNames(directory), /share\.html.*TokenOrbit/);
    }
    fs.writeFileSync(path.join(directory, "share.html"), "<title>Share — TokenOrbit</title>");
    fs.writeFileSync(path.join(directory, "index.html"), "<title>TokenTracker</title>");
    assert.throws(() => verifyDisplayNames(directory), /index\.html.*TokenOrbit/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
