[CmdletBinding()]
param(
    [Parameter()]
    [string]$ScriptsDirectory = $PSScriptRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$requiredFiles = @(
    'PCF.Common.ps1',
    'Build-And-Deploy-PCF.ps1',
    'Deploy-Solution.ps1',
    'Get-PCFDevEnvironmentReport.ps1',
    'Initialize-NewPCFProject.ps1',
    'Invoke-SolutionCheck.ps1',
    'New-PCFIdentityClone.ps1',
    'Push-PCFQuickDeploy.ps1',
    'Set-PCFReleaseDefaults.ps1',
    'Start-PCFTestHarness.ps1',
    'Test-PCFProjectConfiguration.ps1',
    'Test-PCFReleaseArtifact.ps1',
    'Update-Version.ps1'
)

$missing = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $ScriptsDirectory $_) -PathType Leaf) })
if ($missing.Count -gt 0) {
    throw "Tooling package is incomplete. Missing: $($missing -join ', ')"
}

$parseFailures = New-Object System.Collections.Generic.List[string]
foreach ($fileName in $requiredFiles) {
    $path = Join-Path -Path $ScriptsDirectory -ChildPath $fileName
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
    foreach ($parseError in @($errors)) {
        $parseFailures.Add("$fileName [$($parseError.Extent.StartLineNumber):$($parseError.Extent.StartColumnNumber)] $($parseError.Message)")
    }
}

if ($parseFailures.Count -gt 0) {
    throw "PowerShell syntax validation failed:`n - " + ($parseFailures -join "`n - ")
}

Write-Host "All $($requiredFiles.Count) PowerShell scripts parsed successfully." -ForegroundColor Green
