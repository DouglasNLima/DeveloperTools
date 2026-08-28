[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SolutionZipPath,

    [Parameter()]
    [string]$ExpectedControlVersion,

    [Parameter()]
    [switch]$FailOnDevelopmentBundle,

    [Parameter()]
    [switch]$Quiet,

    [Parameter()]
    [switch]$PassThru
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SolutionZipPath -PathType Leaf)) {
    throw "Solution ZIP was not found at '$SolutionZipPath'."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ZipEntryByName {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.Compression.ZipArchive]$Archive,

        [Parameter(Mandatory = $true)]
        [string]$FullName
    )

    return $Archive.Entries | Where-Object { $_.FullName -ieq $FullName } | Select-Object -First 1
}

function Read-ZipEntryText {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.Compression.ZipArchiveEntry]$Entry
    )

    $stream = $Entry.Open()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8, $true)
    try {
        return $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}

function Get-ZipEntrySha256 {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.Compression.ZipArchiveEntry]$Entry
    )

    $stream = $Entry.Open()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash($stream)
        return ([System.BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
        $stream.Dispose()
    }
}

$resolvedZipPath = (Resolve-Path -LiteralPath $SolutionZipPath).Path
$archive = [System.IO.Compression.ZipFile]::OpenRead($resolvedZipPath)
$results = New-Object System.Collections.Generic.List[object]
$errors = New-Object System.Collections.Generic.List[string]

try {
    $manifestEntries = @(
        $archive.Entries |
            Where-Object { $_.FullName -match '^Controls/.+/ControlManifest\.xml$' }
    )

    if ($manifestEntries.Count -eq 0) {
        $errors.Add('No packaged PCF ControlManifest.xml files were found below Controls/.')
    }

    foreach ($manifestEntry in $manifestEntries) {
        $manifestText = Read-ZipEntryText -Entry $manifestEntry
        [xml]$manifestXml = $manifestText
        $controlNode = $manifestXml.manifest.control

        if (-not $controlNode) {
            $errors.Add("Manifest '$($manifestEntry.FullName)' does not contain a control node.")
            continue
        }

        $controlNamespace = [string]$controlNode.namespace
        $controlConstructor = [string]$controlNode.constructor
        $controlVersion = [string]$controlNode.version
        $controlName = "$controlNamespace.$controlConstructor"

        if ($ExpectedControlVersion -and $controlVersion -ne $ExpectedControlVersion) {
            $errors.Add("Control '$controlName' has version '$controlVersion' in the ZIP; expected '$ExpectedControlVersion'.")
        }

        $baseDirectory = $manifestEntry.FullName.Substring(0, $manifestEntry.FullName.LastIndexOf('/') + 1)
        $resourceNodes = @()
        $resourcesNode = $controlNode.SelectSingleNode('resources')
        if ($resourcesNode) {
            $resourceNodes = @($resourcesNode.ChildNodes | Where-Object {
                $_.NodeType -eq [System.Xml.XmlNodeType]::Element -and $_.Attributes['path']
            })
        }

        if ($resourceNodes.Count -eq 0) {
            $errors.Add("Control '$controlName' declares no package resources.")
            continue
        }

        foreach ($resourceNode in $resourceNodes) {
            $resourcePath = ([string]$resourceNode.path).Replace('\\', '/')
            $entryName = $baseDirectory + $resourcePath.TrimStart('/')
            $entry = Get-ZipEntryByName -Archive $archive -FullName $entryName

            if (-not $entry) {
                $errors.Add("Control '$controlName' references '$resourcePath', but '$entryName' is missing from the ZIP.")
                continue
            }

            if ($entry.Length -le 0) {
                $errors.Add("Resource '$entryName' exists but is empty.")
                continue
            }

            $extension = [System.IO.Path]::GetExtension($entry.FullName).ToLowerInvariant()
            $developmentMarkerFound = $false
            $marker = $null

            if ($extension -eq '.js') {
                $javascript = Read-ZipEntryText -Entry $entry
                $markers = @(
                    'ATTENTION: The "eval" devtool has been used',
                    '//# sourceURL=webpack://'
                )

                foreach ($candidate in $markers) {
                    if ($javascript.IndexOf($candidate, [System.StringComparison]::Ordinal) -ge 0) {
                        $developmentMarkerFound = $true
                        $marker = $candidate
                        break
                    }
                }

                if ($FailOnDevelopmentBundle -and $developmentMarkerFound) {
                    $errors.Add("Resource '$entryName' contains a Webpack development-build marker: '$marker'.")
                }
            }

            $results.Add([PSCustomObject]@{
                SolutionZip              = $resolvedZipPath
                ControlName              = $controlName
                ControlVersion           = $controlVersion
                ResourcePath             = $resourcePath
                PackageEntry             = $entry.FullName
                Bytes                    = [long]$entry.Length
                Sha256                   = Get-ZipEntrySha256 -Entry $entry
                DevelopmentMarkerFound   = $developmentMarkerFound
                DevelopmentMarker        = $marker
            })
        }
    }
}
finally {
    $archive.Dispose()
}

if (-not $Quiet) {
    Write-Host "`nPCF release artifact validation: $resolvedZipPath" -ForegroundColor Cyan
    if ($results.Count -gt 0) {
        $results |
            Select-Object ControlName, ControlVersion, ResourcePath, Bytes, DevelopmentMarkerFound, Sha256 |
            Format-Table -AutoSize | Out-Host
    }
}

if ($errors.Count -gt 0) {
    $message = "PCF release artifact validation failed:`n - " + ($errors -join "`n - ")
    throw $message
}

if (-not $Quiet) {
    Write-Host 'PCF release artifact validation passed.' -ForegroundColor Green
}

if ($PassThru) {
    return $results.ToArray()
}
