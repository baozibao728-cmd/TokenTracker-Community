"use strict";
const { execFileSync } = require("node:child_process");
const expected = process.env.RC_SOURCE_SHA;
if (!/^[a-f0-9]{40}$/.test(expected || "") ||
    process.env.GITHUB_REPOSITORY !== "baozibao728-cmd/TokenTracker-Community") {
  throw new Error("RC requires a full PR head SHA and the Community repository.");
}
const actual = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (actual !== expected) throw new Error("RC checkout differs from PR head.");
console.log(`checkout_sha=${actual}`);
