[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter()]
    [switch]$FailOnWarnings
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1')

$context = Get-PcfProjectContext -ProjectRoot $ProjectRoot
$findings = New-Object System.Collections.Generic.List[object]

function Add-Finding {
    param([string]$Severity, [string]$Check, [string]$Message)
    $script:findings.Add([PSCustomObject]@{ Severity=$Severity; Check=$Check; Message=$Message }) | Out-Null
}

$pcfBuildMode = Get-MsBuildPropertyValue -ProjectFile $context.PcfProject.FullName -PropertyName 'PcfBuildMode'
if ($pcfBuildMode -eq 'production') {
    Add-Finding 'PASS' 'PcfBuildMode' 'PCF project is configured for production builds.'
}
else {
    Add-Finding 'ERROR' 'PcfBuildMode' "Expected production, found '$pcfBuildMode'."
}

$solutionPackageType = Get-MsBuildPropertyValue -ProjectFile $context.CdsProject.FullName -PropertyName 'SolutionPackageType'
if ($solutionPackageType -eq 'Both') {
    Add-Finding 'PASS' 'SolutionPackageType' 'Solution project builds both managed and unmanaged packages.'
}
else {
    Add-Finding 'ERROR' 'SolutionPackageType' "Expected Both, found '$solutionPackageType'."
}

$packageJsonPath = Join-Path -Path $context.ControlFolder -ChildPath 'package.json'
$packageLockPath = Join-Path -Path $context.ControlFolder -ChildPath 'package-lock.json'
if (Test-Path -LiteralPath $packageLockPath -PathType Leaf) {
    Add-Finding 'PASS' 'package-lock.json' 'npm lock file is present.'
}
else {
    Add-Finding 'ERROR' 'package-lock.json' 'npm lock file is missing; release builds are not dependency-deterministic.'
}

foreach ($scriptName in @('build', 'clean', 'lint')) {
    if (Test-PackageJsonScript -PackageJsonPath $packageJsonPath -ScriptName $scriptName) {
        Add-Finding 'PASS' "npm:$scriptName" "package.json defines '$scriptName'."
    }
    else {
        $severity = if ($scriptName -eq 'build') { 'ERROR' } else { 'WARNING' }
        Add-Finding $severity "npm:$scriptName" "package.json does not define '$scriptName'."
    }
}

[xml]$cdsXml = Get-Content -LiteralPath $context.CdsProject.FullName -Raw
$ns = New-Object System.Xml.XmlNamespaceManager($cdsXml.NameTable)
$ns.AddNamespace('msb', $cdsXml.DocumentElement.NamespaceURI)
$references = @($cdsXml.SelectNodes('//msb:ProjectReference', $ns))
$pcfReferenceFound = $false
foreach ($reference in $references) {
    $include = [string]$reference.Include
    if ($include -and $include.EndsWith($context.PcfProject.Name, [System.StringComparison]::OrdinalIgnoreCase)) {
        $pcfReferenceFound = $true
        break
    }
}
if ($pcfReferenceFound) {
    Add-Finding 'PASS' 'ProjectReference' 'Dataverse solution project references the PCF project.'
}
else {
    Add-Finding 'ERROR' 'ProjectReference' 'Dataverse solution project does not reference the discovered PCF project.'
}

foreach ($project in @($context.PcfProject, $context.CdsProject)) {
    [xml]$projectXml = Get-Content -LiteralPath $project.FullName -Raw
    $projectNs = New-Object System.Xml.XmlNamespaceManager($projectXml.NameTable)
    $projectNs.AddNamespace('msb', $projectXml.DocumentElement.NamespaceURI)
    foreach ($packageReference in @($projectXml.SelectNodes('//msb:PackageReference', $projectNs))) {
        $version = [string]$packageReference.Version
        if ($version -match '[\*\[\]\(\),]') {
            Add-Finding 'WARNING' 'NuGetVersion' "'$($project.Name)' uses a floating/ranged PackageReference '$($packageReference.Include)' version '$version'. Prefer a pinned version or a committed NuGet lock file for reproducible CI."
        }
    }
}

if (Test-Path -LiteralPath $packageJsonPath -PathType Leaf) {
    $package = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
    if ($package.dependencies -and $package.devDependencies) {
        $dependencyNames = @($package.dependencies.PSObject.Properties.Name)
        foreach ($name in @($package.devDependencies.PSObject.Properties.Name)) {
            if ($dependencyNames -contains $name) {
                Add-Finding 'WARNING' 'DuplicateNpmDependency' "'$name' is declared in both dependencies and devDependencies."
            }
        }
    }
}

$findings | Format-Table Severity, Check, Message -Wrap -AutoSize | Out-Host

$errors = @($findings | Where-Object { $_.Severity -eq 'ERROR' })
$warnings = @($findings | Where-Object { $_.Severity -eq 'WARNING' })
if ($errors.Count -gt 0) {
    throw "PCF project configuration has $($errors.Count) release-blocking error(s)."
}
if ($FailOnWarnings -and $warnings.Count -gt 0) {
    throw "PCF project configuration has $($warnings.Count) warning(s), and -FailOnWarnings was specified."
}

return $findings.ToArray()
