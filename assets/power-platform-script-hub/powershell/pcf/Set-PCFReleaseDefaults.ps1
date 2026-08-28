[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter()]
    [switch]$GenerateNpmLockFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1')

$context = Get-PcfProjectContext -ProjectRoot $ProjectRoot

function Set-MsBuildProperty {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectFile,

        [Parameter(Mandatory = $true)]
        [string]$PropertyName,

        [Parameter(Mandatory = $true)]
        [string]$PropertyValue,

        [Parameter()]
        [string]$PreferredSibling
    )

    [xml]$xml = Get-Content -LiteralPath $ProjectFile -Raw
    $namespaceUri = $xml.DocumentElement.NamespaceURI
    $namespaceManager = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $namespaceManager.AddNamespace('msb', $namespaceUri)

    $node = $xml.SelectSingleNode("//msb:$PropertyName", $namespaceManager)
    if ($node) {
        if ($node.InnerText -ne $PropertyValue) {
            $node.InnerText = $PropertyValue
            Write-XmlUtf8NoBom -Xml $xml -Path $ProjectFile
            return $true
        }
        return $false
    }

    $propertyGroup = $null
    if ($PreferredSibling) {
        $propertyGroup = $xml.SelectSingleNode("//msb:PropertyGroup[msb:$PreferredSibling]", $namespaceManager)
    }
    if (-not $propertyGroup) {
        $propertyGroup = $xml.SelectSingleNode('//msb:PropertyGroup', $namespaceManager)
    }
    if (-not $propertyGroup) {
        throw "No PropertyGroup was found in '$ProjectFile'."
    }

    $newNode = $xml.CreateElement($PropertyName, $namespaceUri)
    $newNode.InnerText = $PropertyValue
    $propertyGroup.AppendChild($newNode) | Out-Null
    Write-XmlUtf8NoBom -Xml $xml -Path $ProjectFile
    return $true
}

if ($PSCmdlet.ShouldProcess($context.PcfProject.FullName, 'Set PcfBuildMode=production')) {
    $changed = Set-MsBuildProperty -ProjectFile $context.PcfProject.FullName -PropertyName 'PcfBuildMode' -PropertyValue 'production' -PreferredSibling 'OutputPath'
    if ($changed) {
        Write-Host "Set PcfBuildMode=production in '$($context.PcfProject.Name)'." -ForegroundColor Green
    }
    else {
        Write-Host "PcfBuildMode is already production in '$($context.PcfProject.Name)'." -ForegroundColor DarkGreen
    }
}

if ($PSCmdlet.ShouldProcess($context.CdsProject.FullName, 'Set SolutionPackageType=Both')) {
    $changed = Set-MsBuildProperty -ProjectFile $context.CdsProject.FullName -PropertyName 'SolutionPackageType' -PropertyValue 'Both'
    if ($changed) {
        Write-Host "Set SolutionPackageType=Both in '$($context.CdsProject.Name)'." -ForegroundColor Green
    }
    else {
        Write-Host "SolutionPackageType is already Both in '$($context.CdsProject.Name)'." -ForegroundColor DarkGreen
    }
}

$packageJsonPath = Join-Path -Path $context.ControlFolder -ChildPath 'package.json'
$packageLockPath = Join-Path -Path $context.ControlFolder -ChildPath 'package-lock.json'
if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
    throw "package.json was not found at '$packageJsonPath'."
}

if (-not (Test-Path -LiteralPath $packageLockPath -PathType Leaf)) {
    if ($GenerateNpmLockFile) {
        $npm = Resolve-NativeCommandPath -Name 'npm'
        Write-Host "Generating package-lock.json..." -ForegroundColor Cyan
        Push-Location $context.ControlFolder
        try {
            $result = Invoke-NativeCommand -Command $npm -Arguments @('install', '--package-lock-only') -WriteOutput
            Assert-NativeCommandSucceeded -Result $result -Description 'npm install --package-lock-only'
        }
        finally {
            Pop-Location
        }

        if (-not (Test-Path -LiteralPath $packageLockPath -PathType Leaf)) {
            throw "npm completed successfully but package-lock.json was not created."
        }
    }
    else {
        Write-Warning "package-lock.json is missing. Release builds should use a committed lock file and npm ci. Re-run with -GenerateNpmLockFile or create and commit the lock file before the next release build."
    }
}
else {
    Write-Host "package-lock.json is present." -ForegroundColor DarkGreen
}

$pcfBuildMode = Get-MsBuildPropertyValue -ProjectFile $context.PcfProject.FullName -PropertyName 'PcfBuildMode'
$solutionPackageType = Get-MsBuildPropertyValue -ProjectFile $context.CdsProject.FullName -PropertyName 'SolutionPackageType'

[PSCustomObject]@{
    PcfProject          = $context.PcfProject.FullName
    PcfBuildMode        = $pcfBuildMode
    CdsProject          = $context.CdsProject.FullName
    SolutionPackageType = $solutionPackageType
    PackageLockPresent  = (Test-Path -LiteralPath $packageLockPath -PathType Leaf)
}
