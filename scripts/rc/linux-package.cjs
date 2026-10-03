"use strict";
// Tauri's deb/rpm package NAME is kebab-case productName, not Cargo's binary
// name. Both formats must retain the independent Community package identity.
function verifyLinuxPackageMetadata(format, name, version, architecture) {
  const expectedArchitecture = { deb: "amd64", rpm: "x86_64" }[format];
  if (!expectedArchitecture) throw new Error("Unknown Linux package format.");
  console.log(`Package metadata ${format}: name=${name}; version=${version}; architecture=${architecture}`);
  if (name !== "token-tracker-community" || version !== require("../../package.json").version || architecture !== expectedArchitecture)
    throw new Error(`Linux ${format} package identity/version/architecture mismatch.`);
}
if (require.main === module) {
  try { verifyLinuxPackageMetadata(...process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { verifyLinuxPackageMetadata };
