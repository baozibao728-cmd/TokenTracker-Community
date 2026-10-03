"use strict";
const fs = require("node:fs");
function pickOne(label, files) {
  if (files.length !== 1 || !fs.statSync(files[0]).isFile())
    throw new Error(`Expected exactly one ${label} package file.`);
  return files[0];
}
if (require.main === module) {
  try { process.stdout.write(pickOne(process.argv[2], process.argv.slice(3))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { pickOne };
