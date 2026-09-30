# Download the official EDB portable runtime; no installer or Windows service.
$ErrorActionPreference = 'Stop'
$taskCache = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'node_modules/.cache/postgresql-15.18'))
$taskArchive = Join-Path $taskCache 'runtime.zip'
$taskUrl = 'https://get.enterprisedb.com/postgresql/postgresql-15.18-1-windows-x64-binaries.zip'
if (Test-Path -LiteralPath (Join-Path $taskCache 'pgsql/bin/postgres.exe')) {
    & (Join-Path $taskCache 'pgsql/bin/postgres.exe') --version
    exit $LASTEXITCODE
}
New-Item -ItemType Directory -Path $taskCache -Force | Out-Null
& curl.exe --fail --location --proto '=https' --retry 2 --output $taskArchive $taskUrl
if ($LASTEXITCODE -ne 0) { throw 'Official PG15 runtime download failed' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip = [IO.Compression.ZipFile]::OpenRead($taskArchive)
try {
    foreach ($taskEntry in $taskZip.Entries) {
        if ($taskEntry.FullName -notmatch '^pgsql/(bin|lib|share)/' -or $taskEntry.FullName.EndsWith('/')) { continue }
        $taskTarget = [IO.Path]::GetFullPath((Join-Path $taskCache $taskEntry.FullName))
        if (-not $taskTarget.StartsWith($taskCache + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escaped runtime cache' }
        New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($taskTarget)) -Force | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($taskEntry, $taskTarget, $true)
    }
} finally { $taskZip.Dispose() }
Remove-Item -LiteralPath $taskArchive
& (Join-Path $taskCache 'pgsql/bin/postgres.exe') --version
if ($LASTEXITCODE -ne 0) { throw 'PG15 runtime cannot start' }
