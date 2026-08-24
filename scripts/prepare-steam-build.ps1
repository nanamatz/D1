[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [long]$AppId,

    [Parameter(Mandatory = $true)]
    [long]$WindowsDepotId,

    [Parameter(Mandatory = $true)]
    [long]$MacDepotId,

    [Parameter(Mandatory = $true)]
    [string]$Version,

    [Parameter(Mandatory = $true)]
    [string]$Commit,

    [string]$ContentRoot,

    [switch]$Upload
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$arguments = @(
    (Join-Path $PSScriptRoot 'prepare-steam-build.mjs'),
    '--app-id', $AppId.ToString(),
    '--windows-depot-id', $WindowsDepotId.ToString(),
    '--mac-depot-id', $MacDepotId.ToString(),
    '--version', $Version,
    '--commit', $Commit
)
if (-not [string]::IsNullOrWhiteSpace($ContentRoot)) {
    $arguments += @('--content-root', $ContentRoot)
}
if ($Upload) { $arguments += '--upload' }

& node @arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
