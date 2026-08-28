[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter()]
    [ValidateSet('Build', 'Revision')]
    [string]$IncrementPart = 'Build',

    [Parameter()]
    [bool]$ResetRevisionOnBuild = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1')

$context = Get-PcfProjectContext -ProjectRoot $ProjectRoot

[xml]$solutionXml = Get-Content -LiteralPath $context.SolutionXmlFile.FullName -Raw
$currentVersionText = [string]$solutionXml.ImportExportXml.SolutionManifest.Version

$parts = @($currentVersionText.Split('.'))
if ($parts.Count -gt 4) {
    throw "Solution version '$currentVersionText' has more than four parts."
}
while ($parts.Count -lt 4) {
    $parts += '0'
}

$numbers = New-Object int[] 4
for ($i = 0; $i -lt 4; $i++) {
    $parsed = 0
    if (-not [int]::TryParse($parts[$i], [ref]$parsed) -or $parsed -lt 0) {
        throw "Solution version '$currentVersionText' contains an invalid numeric part '$($parts[$i])'."
    }
    $numbers[$i] = $parsed
}

switch ($IncrementPart) {
    'Build' {
        $numbers[2]++
        if ($ResetRevisionOnBuild) {
            $numbers[3] = 0
        }
    }
    'Revision' {
        $numbers[3]++
    }
}

$newSolutionVersion = '{0}.{1}.{2}.{3}' -f $numbers[0], $numbers[1], $numbers[2], $numbers[3]
$newControlVersion = '{0}.{1}.{2}' -f $numbers[0], $numbers[1], $numbers[2]

Write-Host "Current solution version : $currentVersionText"
Write-Host "New solution version     : $newSolutionVersion"
Write-Host "New control version      : $newControlVersion"

$solutionXml.ImportExportXml.SolutionManifest.Version = $newSolutionVersion
Write-XmlUtf8NoBom -Xml $solutionXml -Path $context.SolutionXmlFile.FullName

[xml]$manifestXml = Get-Content -LiteralPath $context.ManifestFile.FullName -Raw
$manifestXml.manifest.control.version = $newControlVersion
Write-XmlUtf8NoBom -Xml $manifestXml -Path $context.ManifestFile.FullName

$indexFile = Get-ChildItem -Path $context.ControlFolder -Filter 'index.ts' -File -Recurse | Select-Object -First 1
$indexUpdated = $false
if ($indexFile) {
    $content = [System.IO.File]::ReadAllText($indexFile.FullName)
    $pattern = '(private\s+readonly\s+_manifestVersion\s*=\s*["''])(\d+\.\d+\.\d+)(["''])'
    if ($content -match $pattern) {
        $replacement = '${1}' + $newControlVersion + '${3}'
        $updatedContent = [regex]::Replace($content, $pattern, $replacement, 1)
        [System.IO.File]::WriteAllText($indexFile.FullName, $updatedContent, (New-Object System.Text.UTF8Encoding($false)))
        $indexUpdated = $true
    }
}

if ($IncrementPart -eq 'Revision') {
    Write-Warning "Only the solution revision was incremented. The PCF control version remains '$newControlVersion'. Use IncrementPart=Build when the PCF binary changes."
}

if ($indexFile -and -not $indexUpdated) {
    Write-Warning "index.ts was found, but no '_manifestVersion' constant matching a three-part version was found. The file was not changed."
}

$indexPathValue = if ($indexFile) { $indexFile.FullName } else { $null }

[PSCustomObject]@{
    PreviousSolutionVersion = $currentVersionText
    SolutionVersion         = $newSolutionVersion
    ControlVersion          = $newControlVersion
    SolutionXmlPath         = $context.SolutionXmlFile.FullName
    ManifestPath            = $context.ManifestFile.FullName
    IndexPath               = $indexPathValue
    IndexUpdated            = $indexUpdated
}
