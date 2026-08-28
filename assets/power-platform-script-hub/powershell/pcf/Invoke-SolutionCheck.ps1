[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SolutionZipPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [Parameter()]
    [ValidateSet('PreviewUnitedStates','UnitedStates','Europe','Asia','Australia','Japan','India','Canada','SouthAmerica','UnitedKingdom','France','SouthAfrica','Germany','UnitedArabEmirates','Switzerland','Norway','Singapore','Korea','Sweden','Italy','Poland','NewZealand','USGovernment','USGovernmentL4','USGovernmentL5DoD','China')]
    [string]$Geo = 'Europe',

    [Parameter()]
    [string]$RuleSet = 'Solution Checker',

    [Parameter()]
    [ValidateSet('error', 'warning', 'note', 'none')]
    [string]$FailOnSarifLevel = 'error',

    [Parameter()]
    [string]$RuleLevelOverrideFile,

    [Parameter()]
    [string]$ExcludedFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1')

$solutionPath = (Resolve-Path -LiteralPath $SolutionZipPath -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -Path $OutputDirectory -ItemType Directory -Force | Out-Null
}
$outputPath = (Resolve-Path -LiteralPath $OutputDirectory).Path

Get-ChildItem -Path $outputPath -Filter '*.sarif' -File -ErrorAction SilentlyContinue | Remove-Item -Force

$pac = Resolve-NativeCommandPath -Name 'pac'
$arguments = New-Object System.Collections.Generic.List[string]
$arguments.Add('solution')
$arguments.Add('check')
$arguments.Add('--path')
$arguments.Add($solutionPath)
$arguments.Add('--outputDirectory')
$arguments.Add($outputPath)
$arguments.Add('--geo')
$arguments.Add($Geo)
$arguments.Add('--ruleSet')
$arguments.Add($RuleSet)

if ($RuleLevelOverrideFile) {
    $overridePath = (Resolve-Path -LiteralPath $RuleLevelOverrideFile -ErrorAction Stop).Path
    $arguments.Add('--ruleLevelOverride')
    $arguments.Add($overridePath)
}
if ($ExcludedFiles) {
    $arguments.Add('--excludedFiles')
    $arguments.Add($ExcludedFiles)
}

Write-Host "Running Power Apps Checker against '$solutionPath'..." -ForegroundColor Cyan
$result = Invoke-NativeCommand -Command $pac -Arguments $arguments.ToArray() -WriteOutput
Assert-NativeCommandSucceeded -Result $result -Description 'pac solution check'

$sarifFile = Get-ChildItem -Path $outputPath -Filter '*.sarif' -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

if (-not $sarifFile) {
    throw "Power Apps Checker completed, but no SARIF result file was found in '$outputPath'."
}

$sarif = Get-Content -LiteralPath $sarifFile.FullName -Raw | ConvertFrom-Json
$allResults = New-Object System.Collections.Generic.List[object]
foreach ($run in @($sarif.runs)) {
    foreach ($finding in @($run.results)) {
        if ($finding) {
            $allResults.Add($finding)
        }
    }
}

$levelRank = @{ 'none' = 0; 'note' = 1; 'warning' = 2; 'error' = 3 }
$counts = @{ 'note' = 0; 'warning' = 0; 'error' = 0 }
foreach ($finding in $allResults) {
    $levelProperty = $finding.PSObject.Properties['level']
    $level = if ($levelProperty) { [string]$levelProperty.Value } else { 'warning' }
    if ([string]::IsNullOrWhiteSpace($level)) {
        $level = 'warning'
    }
    $level = $level.ToLowerInvariant()
    if (-not $counts.ContainsKey($level)) {
        $level = 'warning'
    }
    $counts[$level]++
}

Write-Host "SARIF: $($sarifFile.FullName)"
Write-Host "Findings: error=$($counts['error']), warning=$($counts['warning']), note=$($counts['note'])"

if ($FailOnSarifLevel -ne 'none') {
    $threshold = $levelRank[$FailOnSarifLevel]
    $blocking = 0
    foreach ($level in @('note', 'warning', 'error')) {
        if ($levelRank[$level] -ge $threshold) {
            $blocking += $counts[$level]
        }
    }

    if ($blocking -gt 0) {
        throw "Power Apps Checker found $blocking finding(s) at or above SARIF level '$FailOnSarifLevel'. See '$($sarifFile.FullName)'."
    }
}

Write-Host 'Power Apps Checker gate passed.' -ForegroundColor Green

[PSCustomObject]@{
    SolutionZip = $solutionPath
    SarifPath   = $sarifFile.FullName
    ErrorCount  = $counts['error']
    WarningCount= $counts['warning']
    NoteCount   = $counts['note']
}
