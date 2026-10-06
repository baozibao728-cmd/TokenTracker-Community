# Generate the exe, window and installer icon from the shared SVG master.
# The tray pets remain in their separate mascot resources.
$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
& node (Join-Path $RepositoryRoot 'scripts\generate-brand-icons.cjs') --windows --output-root $RepositoryRoot
if ($LASTEXITCODE -ne 0) { throw 'Brand icon generation failed.' }
