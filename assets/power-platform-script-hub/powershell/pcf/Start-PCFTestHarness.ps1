[CmdletBinding()]
param(
    [Parameter()]
    [string]$ControlFolder = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1')

$resolvedControlFolder = (Resolve-Path -LiteralPath $ControlFolder -ErrorAction Stop).Path
$manifestPath = Join-Path -Path $resolvedControlFolder -ChildPath 'ControlManifest.Input.xml'
$packageJsonPath = Join-Path -Path $resolvedControlFolder -ChildPath 'package.json'
$packageLockPath = Join-Path -Path $resolvedControlFolder -ChildPath 'package-lock.json'
$nodeModulesPath = Join-Path -Path $resolvedControlFolder -ChildPath 'node_modules'

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "ControlManifest.Input.xml was not found in '$resolvedControlFolder'."
}
if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
    throw "package.json was not found in '$resolvedControlFolder'."
}

$npm = Resolve-NativeCommandPath -Name 'npm'

Push-Location $resolvedControlFolder
try {
    if (-not (Test-Path -LiteralPath $nodeModulesPath -PathType Container)) {
        Write-Host 'node_modules is missing; restoring dependencies...' -ForegroundColor Cyan
        if (Test-Path -LiteralPath $packageLockPath -PathType Leaf) {
            $restore = Invoke-NativeCommand -Command $npm -Arguments @('ci') -WriteOutput
            Assert-NativeCommandSucceeded -Result $restore -Description 'npm ci'
        }
        else {
            Write-Warning 'package-lock.json is missing; using npm install for the development harness.'
            $restore = Invoke-NativeCommand -Command $npm -Arguments @('install') -WriteOutput
            Assert-NativeCommandSucceeded -Result $restore -Description 'npm install'
        }
    }

    if (-not (Test-PackageJsonScript -PackageJsonPath $packageJsonPath -ScriptName 'start:watch')) {
        throw "package.json does not define the required 'start:watch' script."
    }

    Write-Host 'Starting the PCF development test harness. Press Ctrl+C to stop.' -ForegroundColor Green
    & $npm @('run', 'start:watch')
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "npm run start:watch exited with code $exitCode."
    }
}
finally {
    Pop-Location
}
