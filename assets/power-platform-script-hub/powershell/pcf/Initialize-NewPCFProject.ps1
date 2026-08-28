[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z][A-Za-z0-9]*$')]
    [string]$ControlName,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z_][A-Za-z0-9_]*$')]
    [string]$PublisherName,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z][A-Za-z0-9]{1,7}$')]
    [string]$PublisherPrefix,

    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z_][A-Za-z0-9_]*$')]
    [string]$SolutionUniqueName,

    [Parameter()]
    [ValidateSet('field', 'dataset')]
    [string]$ControlTemplate = 'field',

    [Parameter()]
    [ValidateSet('react', 'none')]
    [string]$ControlFramework = 'react',

    [Parameter()]
    [string]$SolutionDescription
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1')

$pac = Resolve-NativeCommandPath -Name 'pac'
Resolve-NativeCommandPath -Name 'npm' | Out-Null

$fullProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
$controlFolder = Join-Path -Path $fullProjectPath -ChildPath $ControlName
$solutionFolder = Join-Path -Path $fullProjectPath -ChildPath 'Solution'

if (Test-Path -LiteralPath $fullProjectPath) {
    $existingItems = @(Get-ChildItem -LiteralPath $fullProjectPath -Force -ErrorAction Stop)
    if ($existingItems.Count -gt 0) {
        throw "Project path '$fullProjectPath' already exists and is not empty."
    }
}
else {
    New-Item -Path $fullProjectPath -ItemType Directory -Force | Out-Null
}

New-Item -Path $controlFolder -ItemType Directory -Force | Out-Null
New-Item -Path $solutionFolder -ItemType Directory -Force | Out-Null

Write-Host "--- Initialising PCF control '$ControlName' ---" -ForegroundColor Green
Push-Location $controlFolder
try {
    $pcfInit = Invoke-NativeCommand -Command $pac -Arguments @(
        'pcf', 'init',
        '--namespace', "$PublisherPrefix.Controls",
        '--name', $ControlName,
        '--template', $ControlTemplate,
        '--framework', $ControlFramework,
        '--run-npm-install'
    ) -WriteOutput
    Assert-NativeCommandSucceeded -Result $pcfInit -Description 'pac pcf init'
}
finally {
    Pop-Location
}

Write-Host "`n--- Initialising Dataverse solution project ---" -ForegroundColor Green
Push-Location $solutionFolder
try {
    $solutionInit = Invoke-NativeCommand -Command $pac -Arguments @(
        'solution', 'init',
        '--publisher-name', $PublisherName,
        '--publisher-prefix', $PublisherPrefix
    ) -WriteOutput
    Assert-NativeCommandSucceeded -Result $solutionInit -Description 'pac solution init'

    $addReference = Invoke-NativeCommand -Command $pac -Arguments @(
        'solution', 'add-reference',
        '--path', $controlFolder
    ) -WriteOutput
    Assert-NativeCommandSucceeded -Result $addReference -Description 'pac solution add-reference'
}
finally {
    Pop-Location
}

$solutionXmlPath = Join-Path -Path $solutionFolder -ChildPath 'src\Other\Solution.xml'
if (-not (Test-Path -LiteralPath $solutionXmlPath -PathType Leaf)) {
    throw "Solution.xml was not generated at '$solutionXmlPath'."
}

[xml]$solutionXml = Get-Content -LiteralPath $solutionXmlPath -Raw
$solutionXml.ImportExportXml.SolutionManifest.UniqueName = $SolutionUniqueName
$localisedName = $solutionXml.ImportExportXml.SolutionManifest.LocalizedNames.LocalizedName | Where-Object { $_.languagecode -eq '1033' } | Select-Object -First 1
if ($localisedName) {
    $localisedName.SetAttribute('description', $SolutionUniqueName)
}

if (-not [string]::IsNullOrWhiteSpace($SolutionDescription)) {
    $descriptions = $solutionXml.ImportExportXml.SolutionManifest.Descriptions
    if (-not $descriptions) {
        $descriptions = $solutionXml.CreateElement('Descriptions')
        $solutionXml.ImportExportXml.SolutionManifest.AppendChild($descriptions) | Out-Null
    }

    $descriptionNode = $descriptions.Description | Where-Object { $_.languagecode -eq '1033' } | Select-Object -First 1
    if (-not $descriptionNode) {
        $descriptionNode = $solutionXml.CreateElement('Description')
        $descriptionNode.SetAttribute('languagecode', '1033')
        $descriptions.AppendChild($descriptionNode) | Out-Null
    }
    $descriptionNode.SetAttribute('description', $SolutionDescription)
}

Write-XmlUtf8NoBom -Xml $solutionXml -Path $solutionXmlPath

Write-Host "`n--- Applying release-safe project defaults ---" -ForegroundColor Green
& (Join-Path $PSScriptRoot 'Set-PCFReleaseDefaults.ps1') -ProjectRoot $fullProjectPath | Out-Host

$packageLockPath = Join-Path -Path $controlFolder -ChildPath 'package-lock.json'
if (-not (Test-Path -LiteralPath $packageLockPath -PathType Leaf)) {
    throw "The project was created, but package-lock.json is missing. The --run-npm-install step should create it; investigate npm output before using this project for release builds."
}

Write-Host "`nPCF project created successfully at '$fullProjectPath'." -ForegroundColor Green

[PSCustomObject]@{
    ProjectRoot        = $fullProjectPath
    ControlFolder      = $controlFolder
    SolutionFolder     = $solutionFolder
    SolutionUniqueName = $SolutionUniqueName
    PcfBuildMode       = 'production'
    SolutionPackageType= 'Both'
    PackageLockPath    = $packageLockPath
}
