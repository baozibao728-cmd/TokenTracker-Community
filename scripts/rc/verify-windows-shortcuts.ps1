param(
    [Parameter(Mandatory = $true)][string]$Installer,
    [Parameter(Mandatory = $true)][string]$InstalledPath
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or -not $env:RUNNER_TEMP) {
    throw 'Shortcut migration fixtures require an isolated GitHub Actions runner.'
}
$expectedRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\') + '\'
$installed = [IO.Path]::GetFullPath($InstalledPath)
if (-not $installed.StartsWith($expectedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Installer test directory must be within RUNNER_TEMP.'
}
$programs = [Environment]::GetFolderPath('Programs')
$desktop = [Environment]::GetFolderPath('Desktop')
$legacyLinks = @((Join-Path $programs 'TokenTracker Community.lnk'), (Join-Path $desktop 'TokenTracker Community.lnk'))
$currentLinks = @((Join-Path $programs 'TokenOrbit.lnk'), (Join-Path $desktop 'TokenOrbit.lnk'))
$officialControl = Join-Path $desktop 'TokenTracker.lnk'
foreach ($link in @($legacyLinks) + @($currentLinks) + @($officialControl)) {
    if (Test-Path -LiteralPath $link) { throw 'Fresh runner unexpectedly contains a shortcut test name.' }
}
$shell = New-Object -ComObject WScript.Shell
$fixtureDir = Join-Path $installed '..\shortcut-controls'
New-Item -Path $fixtureDir -ItemType Directory -Force | Out-Null
$foreignExe = [IO.Path]::GetFullPath((Join-Path $fixtureDir 'TokenTracker.exe'))
[IO.File]::WriteAllText($foreignExe, 'synthetic official-product protection fixture; never executed')
$nativeExe = Join-Path $installed 'TokenTrackerCommunity.exe'
function New-FixtureLink([string]$File, [string]$Target) {
    $shortcut = $shell.CreateShortcut($File)
    $shortcut.TargetPath = $Target
    $shortcut.Save()
}
function Assert-LinkTarget([string]$File, [string]$Target) {
    if (-not (Test-Path -LiteralPath $File)) { throw 'Expected shortcut is missing.' }
    $actual = [IO.Path]::GetFullPath($shell.CreateShortcut($File).TargetPath)
    if (-not $actual.Equals([IO.Path]::GetFullPath($Target), [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Shortcut target differs from expected product identity.'
    }
}
function Install-Candidate {
    $result = Start-Process -FilePath $Installer -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', '/TASKS=', "/DIR=`"$installed`"") -Wait -PassThru -WindowStyle Hidden
    if ($result.ExitCode -ne 0) { throw 'Installer shortcut test failed.' }
}
New-FixtureLink $officialControl $foreignExe
$controlHash = (Get-FileHash -LiteralPath $officialControl -Algorithm SHA256).Hash
foreach ($link in $legacyLinks) { New-FixtureLink $link $nativeExe }
Install-Candidate
foreach ($link in $legacyLinks) {
    if (Test-Path -LiteralPath $link) { throw 'Owned legacy shortcut was not migrated.' }
}
foreach ($link in $currentLinks) { Assert-LinkTarget $link $nativeExe }
if ((Get-FileHash -LiteralPath $officialControl -Algorithm SHA256).Hash -ne $controlHash) {
    throw 'Protected official-name fixture was modified.'
}
# The migrated desktop link must be in Inno's uninstall log even with TASKS empty.
$uninstall = Start-Process -FilePath (Join-Path $installed 'unins000.exe') -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') -Wait -PassThru -WindowStyle Hidden
if ($uninstall.ExitCode -ne 0) { throw 'Fixture uninstall failed.' }
foreach ($link in $currentLinks) {
    if (Test-Path -LiteralPath $link) { throw 'Migrated shortcut was not tracked for uninstall.' }
}
foreach ($link in $legacyLinks) { New-FixtureLink $link $foreignExe }
$foreignHashes = @($legacyLinks | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash })
Install-Candidate
for ($index = 0; $index -lt $legacyLinks.Count; $index++) {
    Assert-LinkTarget $legacyLinks[$index] $foreignExe
    if ((Get-FileHash -LiteralPath $legacyLinks[$index] -Algorithm SHA256).Hash -ne $foreignHashes[$index]) {
        throw 'An unowned legacy shortcut was modified.'
    }
}
Assert-LinkTarget $currentLinks[0] $nativeExe
if (Test-Path -LiteralPath $currentLinks[1]) { throw 'Desktop shortcut was created despite unchecked task and unowned legacy.' }
if ((Get-FileHash -LiteralPath $officialControl -Algorithm SHA256).Hash -ne $controlHash) {
    throw 'Protected official-name fixture was modified.'
}
Write-Output 'PACKAGE PASS actual Inno shortcut migration: owned start/desktop, uninstall tracking, unowned legacy preserved, official-name fixture untouched'
