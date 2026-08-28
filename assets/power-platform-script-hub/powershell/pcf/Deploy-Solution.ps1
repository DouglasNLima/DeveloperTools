[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SolutionZipPath,

    [Parameter(Mandatory = $true)]
    [string]$EnvironmentUrl,

    [Parameter()]
    [bool]$PublishChanges = $true,

    [Parameter()]
    [bool]$Async = $true,

    [Parameter()]
    [ValidateRange(1, 720)]
    [int]$MaxAsyncWaitMinutes = 60,

    [Parameter()]
    [switch]$ForceOverwriteUnmanagedCustomisations,

    [Parameter()]
    [switch]$StageAndUpgrade,

    [Parameter()]
    [switch]$SkipLowerVersion,

    [Parameter()]
    [switch]$ActivatePlugins,

    [Parameter()]
    [string]$SettingsFile,

    [Parameter()]
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1')

$resolvedZip = (Resolve-Path -LiteralPath $SolutionZipPath -ErrorAction Stop).Path
if (-not $EnvironmentUrl.StartsWith('https://', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "EnvironmentUrl must be an absolute HTTPS Dataverse URL. Received '$EnvironmentUrl'."
}

if ($SettingsFile) {
    $SettingsFile = (Resolve-Path -LiteralPath $SettingsFile -ErrorAction Stop).Path
}

$pac = Resolve-NativeCommandPath -Name 'pac'
$normalisedEnvironment = $EnvironmentUrl.TrimEnd('/')

Write-Host '=== Dataverse Solution Deployment ===' -ForegroundColor Cyan
Write-Host "Solution       : $resolvedZip"
Write-Host "SHA-256        : $(Get-FileSha256 -Path $resolvedZip)"
Write-Host "Environment    : $normalisedEnvironment"
Write-Host "Publish changes: $PublishChanges"
Write-Host "Async import   : $Async"
Write-Host "Stage upgrade  : $StageAndUpgrade"

Write-Host "`n--- Ensuring PAC authentication context ---" -ForegroundColor Green
Ensure-PacAuthentication -PacCommand $pac -EnvironmentUrl $normalisedEnvironment | Out-Null

if (-not $Force) {
    $confirmation = Read-Host "`nImport this solution into '$normalisedEnvironment'? (y/n)"
    if ($confirmation -notin @('y', 'Y')) {
        throw 'Deployment cancelled by user.'
    }
}

$arguments = New-Object System.Collections.Generic.List[string]
$arguments.Add('solution')
$arguments.Add('import')
$arguments.Add('--path')
$arguments.Add($resolvedZip)
$arguments.Add('--environment')
$arguments.Add($normalisedEnvironment)

if ($PublishChanges) {
    $arguments.Add('--publish-changes')
}
if ($Async) {
    $arguments.Add('--async')
    $arguments.Add('--max-async-wait-time')
    $arguments.Add($MaxAsyncWaitMinutes.ToString())
}
if ($ForceOverwriteUnmanagedCustomisations) {
    $arguments.Add('--force-overwrite')
}
if ($StageAndUpgrade) {
    $arguments.Add('--stage-and-upgrade')
}
if ($SkipLowerVersion) {
    $arguments.Add('--skip-lower-version')
}
if ($ActivatePlugins) {
    $arguments.Add('--activate-plugins')
}
if ($SettingsFile) {
    $arguments.Add('--settings-file')
    $arguments.Add($SettingsFile)
}

Write-Host "`n--- Importing solution ---" -ForegroundColor Green
$import = Invoke-NativeCommand -Command $pac -Arguments $arguments.ToArray() -WriteOutput
Assert-NativeCommandSucceeded -Result $import -Description 'pac solution import'

if ($import.Text -match '(?im)^\s*Error\s*:|Solution\s+Import\s+failed|Import\s+failed') {
    throw "PAC returned exit code 0, but the import output contains a failure indicator. Review the import output above."
}

Write-Host "`nSolution imported successfully." -ForegroundColor Green

[PSCustomObject]@{
    SolutionZipPath = $resolvedZip
    SolutionSha256  = Get-FileSha256 -Path $resolvedZip
    EnvironmentUrl  = $normalisedEnvironment
    ExitCode        = $import.ExitCode
}
