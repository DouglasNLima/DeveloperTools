[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter()]
    [switch]$IncrementVersion,

    [Parameter()]
    [switch]$Deploy,

    [Parameter()]
    [string]$EnvironmentUrl,

    [Parameter()]
    [switch]$DeployManaged,

    [Parameter()]
    [switch]$RunSolutionChecker,

    [Parameter()]
    [ValidateSet('PreviewUnitedStates','UnitedStates','Europe','Asia','Australia','Japan','India','Canada','SouthAmerica','UnitedKingdom','France','SouthAfrica','Germany','UnitedArabEmirates','Switzerland','Norway','Singapore','Korea','Sweden','Italy','Poland','NewZealand','USGovernment','USGovernmentL4','USGovernmentL5DoD','China')]
    [string]$SolutionCheckerGeo = 'Europe',

    [Parameter()]
    [switch]$SkipLint,

    [Parameter()]
    [switch]$AllowUnlockedDependencies,

    [Parameter()]
    [switch]$KeepVersionOnFailure,

    [Parameter()]
    [string]$ArtifactsDirectory,

    [Parameter()]
    [switch]$ForceOverwriteUnmanagedCustomisations,

    [Parameter()]
    [switch]$StageAndUpgrade
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1')

$versionBackups = @{}
$versionChanged = $false

function Backup-VersionFiles {
    param([psobject]$Context)

    $paths = New-Object System.Collections.Generic.List[string]
    $paths.Add($Context.SolutionXmlFile.FullName)
    $paths.Add($Context.ManifestFile.FullName)

    $index = Get-ChildItem -Path $Context.ControlFolder -Filter 'index.ts' -File -Recurse | Select-Object -First 1
    if ($index) {
        $paths.Add($index.FullName)
    }

    foreach ($path in $paths) {
        $script:versionBackups[$path] = [System.IO.File]::ReadAllBytes($path)
    }
}

function Restore-VersionFiles {
    foreach ($path in $script:versionBackups.Keys) {
        [System.IO.File]::WriteAllBytes($path, $script:versionBackups[$path])
        Write-Host "Restored '$path'." -ForegroundColor Yellow
    }
}

function Get-GeneratedSolutionZip {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SolutionFolder,

        [Parameter(Mandatory = $true)]
        [string]$FileName
    )

    $matches = @(
        Get-ChildItem -Path (Join-Path $SolutionFolder 'bin\Release') -Filter $FileName -File -Recurse -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTimeUtc -Descending
    )

    if ($matches.Count -eq 0) {
        throw "Expected build artifact '$FileName' was not found below '$SolutionFolder\bin\Release'."
    }

    if ($matches.Count -gt 1 -and $matches[0].LastWriteTimeUtc -eq $matches[1].LastWriteTimeUtc) {
        throw "Multiple equally recent '$FileName' artifacts were found. Clean the solution output and rebuild."
    }

    return $matches[0]
}

try {
    Write-Host '=== PCF Release Build Workflow ===' -ForegroundColor Cyan
    Write-Host 'This workflow always produces a production PCF bundle inside a Release Dataverse solution.' -ForegroundColor DarkGray

    $context = Get-PcfProjectContext -ProjectRoot $ProjectRoot
    $solutionFolder = $context.CdsProject.Directory.FullName

    $node = Resolve-NativeCommandPath -Name 'node'
    $npm = Resolve-NativeCommandPath -Name 'npm'
    $dotnet = Resolve-NativeCommandPath -Name 'dotnet'
    $pac = $null
    if ($Deploy -or $RunSolutionChecker) {
        $pac = Resolve-NativeCommandPath -Name 'pac'
    }

    Write-Host "`n--- Validating release configuration ---" -ForegroundColor Cyan
    $pcfBuildMode = Get-MsBuildPropertyValue -ProjectFile $context.PcfProject.FullName -PropertyName 'PcfBuildMode'
    if ($pcfBuildMode -ne 'production') {
        throw "The PCF project must define <PcfBuildMode>production</PcfBuildMode>. Run Set-PCFReleaseDefaults.ps1 for this project before building a promotable artifact."
    }

    $solutionPackageType = Get-MsBuildPropertyValue -ProjectFile $context.CdsProject.FullName -PropertyName 'SolutionPackageType'
    if ($solutionPackageType -ne 'Both') {
        throw "The Dataverse solution project must define <SolutionPackageType>Both</SolutionPackageType>. Run Set-PCFReleaseDefaults.ps1 before building."
    }

    $packageJsonPath = Join-Path -Path $context.ControlFolder -ChildPath 'package.json'
    if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
        throw "package.json was not found at '$packageJsonPath'."
    }

    $packageLockPath = Join-Path -Path $context.ControlFolder -ChildPath 'package-lock.json'
    if (-not (Test-Path -LiteralPath $packageLockPath -PathType Leaf) -and -not $AllowUnlockedDependencies) {
        throw "package-lock.json is required for a reproducible release build. Generate and commit it, or use -AllowUnlockedDependencies only for a one-off diagnostic build."
    }

    Write-Host "PCF project       : $($context.PcfProject.FullName)"
    Write-Host "Solution project  : $($context.CdsProject.FullName)"
    Write-Host "Control version   : $($context.ControlVersion)"
    Write-Host "Solution version  : $($context.SolutionVersion)"
    Write-Host "PCF build mode    : $pcfBuildMode"
    Write-Host "Package type      : $solutionPackageType"

    if ($IncrementVersion) {
        Write-Host "`n--- Incrementing versions transactionally ---" -ForegroundColor Green
        Backup-VersionFiles -Context $context
        & (Join-Path $PSScriptRoot 'Update-Version.ps1') -ProjectRoot $context.ProjectRoot -IncrementPart Build | Out-Host
        $versionChanged = $true
        $context = Get-PcfProjectContext -ProjectRoot $context.ProjectRoot
    }

    Write-Host "`n--- Restoring npm dependencies ---" -ForegroundColor Green
    Push-Location $context.ControlFolder
    try {
        if (Test-Path -LiteralPath $packageLockPath -PathType Leaf) {
            $npmRestore = Invoke-NativeCommand -Command $npm -Arguments @('ci') -WriteOutput
            Assert-NativeCommandSucceeded -Result $npmRestore -Description 'npm ci'
        }
        else {
            Write-Warning 'Building with npm install because -AllowUnlockedDependencies was explicitly supplied. This build is not dependency-deterministic.'
            $npmRestore = Invoke-NativeCommand -Command $npm -Arguments @('install') -WriteOutput
            Assert-NativeCommandSucceeded -Result $npmRestore -Description 'npm install'
        }

        if (-not $SkipLint -and (Test-PackageJsonScript -PackageJsonPath $packageJsonPath -ScriptName 'lint')) {
            Write-Host "`n--- Running lint gate ---" -ForegroundColor Green
            $lint = Invoke-NativeCommand -Command $npm -Arguments @('run', 'lint') -WriteOutput
            Assert-NativeCommandSucceeded -Result $lint -Description 'npm run lint'
        }

        if (Test-PackageJsonScript -PackageJsonPath $packageJsonPath -ScriptName 'clean') {
            Write-Host "`n--- Cleaning PCF outputs ---" -ForegroundColor Green
            $clean = Invoke-NativeCommand -Command $npm -Arguments @('run', 'clean') -WriteOutput
            Assert-NativeCommandSucceeded -Result $clean -Description 'npm run clean'
        }

        Write-Host "`n--- Building PCF in production mode ---" -ForegroundColor Green
        $pcfBuild = Invoke-NativeCommand -Command $npm -Arguments @('run', 'build', '--', '--buildMode', 'production') -WriteOutput
        Assert-NativeCommandSucceeded -Result $pcfBuild -Description 'npm run build -- --buildMode production'

        if ($pcfBuild.Text -match '\[build\]\s+Failed:') {
            throw "PCF build output reported '[build] Failed:' even though the native process returned exit code 0."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "`n--- Cleaning Dataverse solution outputs ---" -ForegroundColor Green
    foreach ($folderName in @('bin', 'obj')) {
        $folder = Join-Path -Path $solutionFolder -ChildPath $folderName
        if (Test-Path -LiteralPath $folder) {
            Remove-Item -LiteralPath $folder -Recurse -Force
        }
    }

    Write-Host "`n--- Restoring Dataverse solution dependencies ---" -ForegroundColor Green
    $restore = Invoke-NativeCommand -Command $dotnet -Arguments @('restore', $context.CdsProject.FullName) -WriteOutput
    Assert-NativeCommandSucceeded -Result $restore -Description 'dotnet restore'

    Write-Host "`n--- Building Dataverse solution in Release mode ---" -ForegroundColor Green
    $solutionBuild = Invoke-NativeCommand -Command $dotnet -Arguments @(
        'build',
        $context.CdsProject.FullName,
        '--configuration', 'Release',
        '--no-restore',
        '-p:PcfBuildMode=production',
        '-p:SolutionPackageType=Both'
    ) -WriteOutput
    Assert-NativeCommandSucceeded -Result $solutionBuild -Description 'dotnet build Release'

    $unmanagedSource = Get-GeneratedSolutionZip -SolutionFolder $solutionFolder -FileName 'Solution.zip'
    $managedSource = Get-GeneratedSolutionZip -SolutionFolder $solutionFolder -FileName 'Solution_managed.zip'

    if (-not $ArtifactsDirectory) {
        $ArtifactsDirectory = Join-Path -Path $context.ProjectRoot -ChildPath 'artifacts'
    }
    $versionArtifactFolder = Join-Path -Path $ArtifactsDirectory -ChildPath $context.SolutionVersion
    if (Test-Path -LiteralPath $versionArtifactFolder) {
        Remove-Item -LiteralPath $versionArtifactFolder -Recurse -Force
    }
    New-Item -Path $versionArtifactFolder -ItemType Directory -Force | Out-Null

    $versionToken = $context.SolutionVersion.Replace('.', '_')
    $unmanagedPath = Join-Path $versionArtifactFolder ("{0}_{1}_unmanaged.zip" -f $context.SolutionUniqueName, $versionToken)
    $managedPath = Join-Path $versionArtifactFolder ("{0}_{1}_managed.zip" -f $context.SolutionUniqueName, $versionToken)
    Copy-Item -LiteralPath $unmanagedSource.FullName -Destination $unmanagedPath -Force
    Copy-Item -LiteralPath $managedSource.FullName -Destination $managedPath -Force

    Write-Host "`n--- Validating release artifacts ---" -ForegroundColor Green
    $artifactValidator = Join-Path -Path $PSScriptRoot -ChildPath 'Test-PCFReleaseArtifact.ps1'
    if (-not (Test-Path -LiteralPath $artifactValidator -PathType Leaf)) {
        throw "Required artifact validator was not found at '$artifactValidator'."
    }

    $unmanagedReport = @(& $artifactValidator -SolutionZipPath $unmanagedPath -ExpectedControlVersion $context.ControlVersion -FailOnDevelopmentBundle -Quiet -PassThru)
    $managedReport = @(& $artifactValidator -SolutionZipPath $managedPath -ExpectedControlVersion $context.ControlVersion -FailOnDevelopmentBundle -Quiet -PassThru)

    foreach ($item in $unmanagedReport) {
        $matching = @($managedReport | Where-Object {
            $_.ControlName -eq $item.ControlName -and $_.ResourcePath -eq $item.ResourcePath
        })
        if ($matching.Count -ne 1) {
            throw "Managed/unmanaged parity check failed for '$($item.ControlName)' resource '$($item.ResourcePath)'."
        }
        if ($matching[0].Sha256 -ne $item.Sha256) {
            throw "Managed/unmanaged resource hash mismatch for '$($item.ControlName)' resource '$($item.ResourcePath)'."
        }
    }

    $artifactSummary = [PSCustomObject]@{
        SolutionVersion = $context.SolutionVersion
        ControlVersion  = $context.ControlVersion
        UnmanagedPath   = $unmanagedPath
        UnmanagedSha256 = Get-FileSha256 -Path $unmanagedPath
        ManagedPath     = $managedPath
        ManagedSha256   = Get-FileSha256 -Path $managedPath
    }

    Write-Host "Unmanaged artifact : $unmanagedPath"
    Write-Host "Managed artifact   : $managedPath"
    Write-Host "Unmanaged SHA-256  : $($artifactSummary.UnmanagedSha256)"
    Write-Host "Managed SHA-256    : $($artifactSummary.ManagedSha256)"

    if ($RunSolutionChecker) {
        Write-Host "`n--- Running Power Apps Checker ---" -ForegroundColor Green
        $checkerOutput = Join-Path -Path $versionArtifactFolder -ChildPath 'solution-checker'
        & (Join-Path $PSScriptRoot 'Invoke-SolutionCheck.ps1') `
            -SolutionZipPath $managedPath `
            -OutputDirectory $checkerOutput `
            -Geo $SolutionCheckerGeo `
            -FailOnSarifLevel 'error' | Out-Host
    }

    if ($Deploy) {
        if ([string]::IsNullOrWhiteSpace($EnvironmentUrl)) {
            throw '-EnvironmentUrl is required when -Deploy is specified.'
        }

        $solutionToDeploy = if ($DeployManaged) { $managedPath } else { $unmanagedPath }
        Write-Host "`n--- Deploying release artifact ---" -ForegroundColor Green
        $deployParams = @{
            SolutionZipPath = $solutionToDeploy
            EnvironmentUrl  = $EnvironmentUrl
            PublishChanges  = $true
            Force           = $true
        }
        if ($ForceOverwriteUnmanagedCustomisations) {
            $deployParams['ForceOverwriteUnmanagedCustomisations'] = $true
        }
        if ($StageAndUpgrade) {
            $deployParams['StageAndUpgrade'] = $true
        }

        & (Join-Path $PSScriptRoot 'Deploy-Solution.ps1') @deployParams | Out-Host
    }

    Write-Host "`nPCF release workflow completed successfully." -ForegroundColor Green
    return $artifactSummary
}
catch {
    if ($versionChanged -and -not $KeepVersionOnFailure) {
        Write-Host "`n--- Build failed; restoring version files exactly as they were ---" -ForegroundColor Yellow
        try {
            Restore-VersionFiles
        }
        catch {
            Write-Error "Version rollback failed: $($_.Exception.Message)"
        }
    }

    throw
}
