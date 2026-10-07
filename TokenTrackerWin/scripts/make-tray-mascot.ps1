# Generate the static notification-area brand glyph from the shared SVG master.
# Legacy ICO filenames remain for existing packaging/runtime consumers.
# White on dark taskbars; black on light taskbars. Actual pet sprites are separate.
param([string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $RepositoryRoot 'TokenTrackerWin\assets' }
& node (Join-Path $RepositoryRoot 'scripts\generate-brand-icons.cjs') --tray-assets-dir ([IO.Path]::GetFullPath($OutputDirectory))
if ($LASTEXITCODE -ne 0) { throw 'Static tray brand generation failed.' }
