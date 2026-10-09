$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$repoRoot = (Resolve-Path "$PSScriptRoot/../..").Path
Set-Location $repoRoot
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
& ./TokenTrackerWin/scripts/bundle-node.ps1
dotnet publish TokenTrackerWin/TokenTrackerWin.csproj -c Release -r win-x64 --self-contained true -o TokenTrackerWin/publish
Copy-Item TokenTrackerWin/EmbeddedServer TokenTrackerWin/publish/EmbeddedServer -Recurse -Force
$publish = (Resolve-Path TokenTrackerWin/publish).Path
$info = [System.Diagnostics.FileVersionInfo]::GetVersionInfo("$publish/TokenTrackerCommunity.exe")
if (($info.ProductVersion -split '\+')[0] -ne $version -or $info.ProductName -ne 'TokenOrbit' -or $info.CompanyName -ne 'baozibao728-cmd') {
    throw 'Native product version/identity mismatch.'
}
$out = Join-Path $repoRoot 'build/rc/windows'
New-Item $out -ItemType Directory -Force | Out-Null
$zip = Join-Path $out 'TokenTracker-Community-win-x64.zip'
Compress-Archive -Path "$publish/*" -DestinationPath $zip -CompressionLevel Optimal
$iscc = "${env:ProgramFiles(x86)}/Inno Setup 6/ISCC.exe"
if (-not (Test-Path $iscc)) { choco install innosetup --no-progress -y }
& $iscc "/DMyAppVersion=$version" TokenTrackerWin/installer/TokenTracker.iss
$setup = Join-Path $out 'TokenTracker-Community-Setup.exe'
Copy-Item "TokenTrackerWin/installer/Output/TokenTracker-Community-Setup-v$version.exe" $setup

# Inspect the ZIP bytes and the actual installer payload in an isolated CI runner
# directory. Silent Inno install does not run [Run] entries marked skipifsilent.
# This is payload verification; it does not claim a GUI/runtime acceptance test.
$work = Join-Path $env:RUNNER_TEMP "community-rc-$env:RC_SOURCE_SHA"
New-Item $work -ItemType Directory -Force | Out-Null
$portable = Join-Path $work 'portable'
$installed = Join-Path $work 'installed'
Expand-Archive $zip $portable
& "$PSScriptRoot/verify-windows-shortcuts.ps1" -Installer $setup -InstalledPath $installed
foreach ($file in (Get-ChildItem $portable -File -Recurse)) {
    $relative = [IO.Path]::GetRelativePath($portable, $file.FullName)
    $target = Join-Path $installed $relative
    if (-not (Test-Path $target) -or (Get-FileHash $file.FullName -Algorithm SHA256).Hash -ne (Get-FileHash $target -Algorithm SHA256).Hash) {
        throw "ZIP/installer payload mismatch: $relative"
    }
}
foreach ($root in @($portable, $installed)) {
    node scripts/rc/verify-runtime.cjs "$root/EmbeddedServer" "$root/TokenTrackerCommunity.dll" windows
    # x64 PE architecture (0x8664), independent of the installer's x86 loader.
    $bytes = [IO.File]::ReadAllBytes("$root/TokenTrackerCommunity.exe")
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
    if ([BitConverter]::ToUInt16($bytes, $peOffset + 4) -ne 0x8664) { throw 'Expected win-x64 app.' }
    foreach ($required in @('coreclr.dll', 'hostfxr.dll', 'System.Private.CoreLib.dll', 'WebView2Loader.dll')) {
        if (-not (Test-Path "$root/$required")) { throw "Self-contained dependency missing: $required" }
    }
}
node scripts/rc/verify-brand-icon.cjs windows dashboard/public/icon.svg TokenTrackerWin/assets/trayicon.ico `
    "$portable/TokenTrackerCommunity.exe" "$installed/TokenTrackerCommunity.exe" $setup
node scripts/rc/verify-brand-icon.cjs windows-tray TokenTrackerWin/assets $portable $installed
$uninstall = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/{638F4DBF-F2B4-4408-B654-5A5D0F5B7AC7}_is1'
if ($uninstall.DisplayVersion -ne $version -or $uninstall.DisplayName -ne 'TokenOrbit' -or $uninstall.Publisher -ne 'baozibao728-cmd') {
    throw 'Installer independent registration/version mismatch.'
}
Write-Output 'PACKAGE PASS Windows ZIP and Setup: complete equal file payloads, x64, self-contained, independent installer identity'
node scripts/rc/artifacts.cjs record $out windows $env:RC_SOURCE_SHA
