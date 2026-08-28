Set-StrictMode -Version Latest

function Assert-CommandAvailable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) {
        throw "Required command '$Name' was not found in PATH."
    }

    return $command
}

function Invoke-NativeCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,

        [Parameter()]
        [string[]]$Arguments = @(),

        [Parameter()]
        [switch]$WriteOutput
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $nativePreferenceVariable = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $previousNativePreference = $null

    try {
        $ErrorActionPreference = 'Continue'

        if ($nativePreferenceVariable) {
            $previousNativePreference = $PSNativeCommandUseErrorActionPreference
            $PSNativeCommandUseErrorActionPreference = $false
        }

        $rawOutput = & $Command @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference

        if ($nativePreferenceVariable) {
            $PSNativeCommandUseErrorActionPreference = $previousNativePreference
        }
    }

    $outputLines = @($rawOutput | ForEach-Object { $_.ToString() })

    if ($WriteOutput) {
        foreach ($line in $outputLines) {
            Write-Host $line
        }
    }

    [PSCustomObject]@{
        ExitCode = [int]$exitCode
        Output   = $outputLines
        Text     = ($outputLines -join [Environment]::NewLine)
    }
}

function Assert-NativeCommandSucceeded {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Result,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    if ($Result.ExitCode -ne 0) {
        $tail = @($Result.Output | Select-Object -Last 20) -join [Environment]::NewLine
        if ([string]::IsNullOrWhiteSpace($tail)) {
            throw "$Description failed with exit code $($Result.ExitCode)."
        }

        throw "$Description failed with exit code $($Result.ExitCode).`n$tail"
    }
}

function Get-SingleProjectFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [string]$Filter,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $ignoredSegments = '\\(node_modules|bin|obj|out|artifacts|\.git)\\'
    $files = @(
        Get-ChildItem -Path $Root -Filter $Filter -File -Recurse -ErrorAction Stop |
            Where-Object { $_.FullName -notmatch $ignoredSegments }
    )

    if ($files.Count -eq 0) {
        throw "$Description was not found below '$Root'."
    }

    if ($files.Count -gt 1) {
        $list = ($files.FullName -join [Environment]::NewLine)
        throw "Expected exactly one $Description below '$Root', but found $($files.Count):`n$list"
    }

    return $files[0]
}

function Get-ControlManifestFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ControlFolder
    )

    $files = @(Get-ChildItem -Path $ControlFolder -Filter 'ControlManifest.Input.xml' -File -Recurse -ErrorAction Stop)
    if ($files.Count -ne 1) {
        throw "Expected exactly one ControlManifest.Input.xml below '$ControlFolder', but found $($files.Count)."
    }

    return $files[0]
}

function Get-SolutionXmlFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $path = Join-Path -Path $ProjectRoot -ChildPath 'Solution\src\Other\Solution.xml'
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Solution.xml was not found at '$path'."
    }

    return Get-Item -LiteralPath $path
}

function Get-PcfProjectContext {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $resolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop).Path
    $pcfProject = Get-SingleProjectFile -Root $resolvedRoot -Filter '*.pcfproj' -Description 'PCF project (*.pcfproj)'
    $cdsProject = Get-SingleProjectFile -Root $resolvedRoot -Filter '*.cdsproj' -Description 'Dataverse solution project (*.cdsproj)'
    $controlFolder = $pcfProject.Directory.FullName
    $manifestFile = Get-ControlManifestFile -ControlFolder $controlFolder
    $solutionXmlFile = Get-SolutionXmlFile -ProjectRoot $resolvedRoot

    [xml]$manifestXml = Get-Content -LiteralPath $manifestFile.FullName -Raw
    [xml]$solutionXml = Get-Content -LiteralPath $solutionXmlFile.FullName -Raw

    [PSCustomObject]@{
        ProjectRoot          = $resolvedRoot
        PcfProject           = $pcfProject
        CdsProject           = $cdsProject
        ControlFolder        = $controlFolder
        ManifestFile         = $manifestFile
        SolutionXmlFile      = $solutionXmlFile
        ControlNamespace     = [string]$manifestXml.manifest.control.namespace
        ControlConstructor   = [string]$manifestXml.manifest.control.constructor
        ControlVersion       = [string]$manifestXml.manifest.control.version
        SolutionUniqueName   = [string]$solutionXml.ImportExportXml.SolutionManifest.UniqueName
        SolutionVersion      = [string]$solutionXml.ImportExportXml.SolutionManifest.Version
    }
}

function Write-XmlUtf8NoBom {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlDocument]$Xml,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $settings = New-Object System.Xml.XmlWriterSettings
    $settings.Encoding = New-Object System.Text.UTF8Encoding($false)
    $settings.Indent = $true
    $settings.NewLineChars = [Environment]::NewLine
    $settings.NewLineHandling = [System.Xml.NewLineHandling]::Replace

    $writer = [System.Xml.XmlWriter]::Create($Path, $settings)
    try {
        $Xml.Save($writer)
    }
    finally {
        $writer.Dispose()
    }
}

function Get-FileSha256 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-PackageJsonScript {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PackageJsonPath,

        [Parameter(Mandatory = $true)]
        [string]$ScriptName
    )

    if (-not (Test-Path -LiteralPath $PackageJsonPath -PathType Leaf)) {
        return $false
    }

    $package = Get-Content -LiteralPath $PackageJsonPath -Raw | ConvertFrom-Json
    if (-not $package.scripts) {
        return $false
    }

    return $package.scripts.PSObject.Properties.Name -contains $ScriptName
}

function Get-MsBuildPropertyValue {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectFile,

        [Parameter(Mandatory = $true)]
        [string]$PropertyName
    )

    [xml]$xml = Get-Content -LiteralPath $ProjectFile -Raw
    $namespaceManager = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $namespaceManager.AddNamespace('msb', $xml.DocumentElement.NamespaceURI)
    $node = $xml.SelectSingleNode("//msb:$PropertyName", $namespaceManager)
    if ($node) {
        return [string]$node.InnerText
    }

    return $null
}

function Get-PowerShellVersionText {
    return $PSVersionTable.PSVersion.ToString()
}

function Resolve-NativeCommandPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $candidates = @("$Name.cmd", "$Name.exe", $Name)
    foreach ($candidate in $candidates) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) {
            if ($command.Source) {
                return $command.Source
            }
            if ($command.Definition) {
                return $command.Definition
            }
            return $command.Name
        }
    }

    throw "Required command '$Name' was not found in PATH."
}

function Ensure-PacAuthentication {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PacCommand,

        [Parameter(Mandatory = $true)]
        [string]$EnvironmentUrl
    )

    $normalisedEnvironment = $EnvironmentUrl.TrimEnd('/')
    $authList = Invoke-NativeCommand -Command $PacCommand -Arguments @('auth', 'list')
    $profileIndex = $null

    if ($authList.ExitCode -eq 0) {
        $escapedEnvironment = [regex]::Escape($normalisedEnvironment)
        foreach ($line in $authList.Output) {
            if ($line -match $escapedEnvironment -and $line -match '^\s*\[(\d+)\]') {
                $profileIndex = $matches[1]
                break
            }
        }
    }

    if ($profileIndex) {
        $select = Invoke-NativeCommand -Command $PacCommand -Arguments @('auth', 'select', '--index', $profileIndex) -WriteOutput
        Assert-NativeCommandSucceeded -Result $select -Description "pac auth select --index $profileIndex"
        return [PSCustomObject]@{ Created=$false; Index=$profileIndex; Environment=$normalisedEnvironment }
    }

    Write-Host "No PAC auth profile was found for '$normalisedEnvironment'. Starting authentication..." -ForegroundColor Yellow
    $create = Invoke-NativeCommand -Command $PacCommand -Arguments @('auth', 'create', '--environment', $normalisedEnvironment) -WriteOutput
    Assert-NativeCommandSucceeded -Result $create -Description 'pac auth create'
    return [PSCustomObject]@{ Created=$true; Index=$null; Environment=$normalisedEnvironment }
}
