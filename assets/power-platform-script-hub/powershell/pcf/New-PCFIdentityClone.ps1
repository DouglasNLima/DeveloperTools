<#
.SYNOPSIS
    Creates a new PCF identity by cloning an existing PCF project without carrying build outputs or Dataverse runtime state.

.DESCRIPTION
    Clones a dedicated PCF project into a new control identity (for example, ExampleControlPCFV2 -> ExampleControlPCFV3),
    resets control/solution versions, generates new MSBuild project GUIDs, preserves the functional source code, enforces
    production/release defaults, validates that the previous identity is not left in runtime/configuration files, and can
    optionally build and deploy the new control unmanaged to a DEV environment using the release-safe PCF tooling package.

    The source project is never modified. The target directory must not already exist.

.EXAMPLE
    .\New-PCFIdentityClone.ps1 `
      -SourceProjectRoot "C:\Projects\PCF\ExampleControlPCFV2" `
      -NextGeneration

.EXAMPLE
    .\New-PCFIdentityClone.ps1 `
      -SourceProjectRoot "C:\Projects\PCF\ExampleControlPCFV2" `
      -TargetControlName "ExampleControlPCFV3" `
      -Build `
      -DeployToDev `
      -EnvironmentUrl "https://hsi-dev.crm4.dynamics.com/"
#>
[CmdletBinding(
    SupportsShouldProcess = $true,
    ConfirmImpact = 'Medium',
    DefaultParameterSetName = 'Explicit'
)]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceProjectRoot,

    [Parameter(Mandatory = $true, ParameterSetName = 'Explicit')]
    [ValidatePattern('^[A-Za-z][A-Za-z0-9]*$')]
    [string]$TargetControlName,

    [Parameter(Mandatory = $true, ParameterSetName = 'NextGeneration')]
    [switch]$NextGeneration,

    [Parameter()]
    [string]$TargetProjectRoot,

    [Parameter()]
    [ValidatePattern('^[A-Za-z_][A-Za-z0-9_]*$')]
    [string]$TargetSolutionUniqueName,

    [Parameter()]
    [ValidatePattern('^[A-Za-z_][A-Za-z0-9_.]*$')]
    [string]$TargetNamespace,

    [Parameter()]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$InitialControlVersion = '1.0.0',

    [Parameter()]
    [ValidatePattern('^\d+\.\d+\.\d+\.\d+$')]
    [string]$InitialSolutionVersion = '1.0.0.0',

    [Parameter()]
    [string]$TargetDisplayName,

    [Parameter()]
    [string]$TargetControlDescription,

    [Parameter()]
    [string]$TargetSolutionDescription,

    [Parameter()]
    [string]$Reason = 'Managed PCF WebResource identity reset',

    [Parameter()]
    [switch]$Build,

    [Parameter()]
    [switch]$DeployToDev,

    [Parameter()]
    [string]$EnvironmentUrl,

    [Parameter()]
    [switch]$RunSolutionChecker,

    [Parameter()]
    [string]$SolutionCheckerGeo = 'Europe',

    [Parameter()]
    [switch]$KeepTargetOnFailure,

    [Parameter()]
    [switch]$SkipToolingValidation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptVersion = '1.0.6'
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$targetCreated = $false
$targetRoot = $null

$commonPath = Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1'
if (-not (Test-Path -LiteralPath $commonPath -PathType Leaf)) {
    throw "PCF.Common.ps1 was not found beside this script at '$commonPath'. Place New-PCFIdentityClone.ps1 in the release-safe 'PS Scripts' folder."
}
. $commonPath

function Get-FullPathNormalized {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
}

function Test-PathIsDescendantOf {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Candidate,

        [Parameter(Mandatory = $true)]
        [string]$Parent
    )

    $candidateFull = Get-FullPathNormalized -Path $Candidate
    $parentFull = Get-FullPathNormalized -Path $Parent
    $prefix = $parentFull + [System.IO.Path]::DirectorySeparatorChar

    return $candidateFull.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-GenerationInfo {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $match = [regex]::Match($Name, '^(?<Base>.+)V(?<Generation>\d+)$', [System.Text.RegularExpressions.RegexOptions]::CultureInvariant)
    if (-not $match.Success) {
        return $null
    }

    [PSCustomObject]@{
        Base       = $match.Groups['Base'].Value
        Generation = [int]$match.Groups['Generation'].Value
        Token      = 'V' + $match.Groups['Generation'].Value
    }
}

function Convert-IdentityText {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [string]$SourceConstructor,

        [Parameter(Mandatory = $true)]
        [string]$TargetConstructor,

        [AllowNull()]
        [psobject]$SourceGeneration,

        [AllowNull()]
        [psobject]$TargetGeneration
    )

    if ($null -eq $Text) {
        return $null
    }

    $result = $Text.Replace($SourceConstructor, $TargetConstructor)

    if ($SourceGeneration -and $TargetGeneration -and $SourceGeneration.Token -ne $TargetGeneration.Token) {
        $pattern = '(?<![A-Za-z0-9])' + [regex]::Escape([string]$SourceGeneration.Token) + '(?![A-Za-z0-9])'
        # The replacement token is always V<number>. Use -creplace instead of a
        # replacement string with capture groups so values such as V3 cannot be
        # interpreted as a regex back-reference.
        $result = $result -creplace $pattern, [string]$TargetGeneration.Token
    }

    return $result
}

function Write-TextUtf8NoBom {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Content
    )

    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Copy-ProjectTreeFiltered {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,

        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    $excludedDirectories = @(
        '.git',
        '.vs',
        '.idea',
        'node_modules',
        'bin',
        'obj',
        'out',
        'artifacts',
        'coverage',
        'TestResults',
        'PS Scripts OLD'
    )

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null

    foreach ($item in Get-ChildItem -LiteralPath $Source -Force -ErrorAction Stop) {
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            Write-Verbose "Skipping reparse point '$($item.FullName)'."
            continue
        }

        if ($item.PSIsContainer) {
            if ($excludedDirectories -contains $item.Name) {
                Write-Verbose "Skipping generated/tooling directory '$($item.FullName)'."
                continue
            }

            Copy-ProjectTreeFiltered -Source $item.FullName -Destination (Join-Path -Path $Destination -ChildPath $item.Name)
            continue
        }

        $skipFile =
            $item.Name -eq 'SHA256SUMS.txt' -or
            $item.Name -eq 'package-manifest.json' -or
            $item.Name -eq 'PCF-IDENTITY-MIGRATION.json' -or
            $item.Name -like 'MIGRATION-*.md'

        if ($skipFile) {
            Write-Verbose "Skipping stale/generated tooling metadata '$($item.FullName)'."
            continue
        }

        Copy-Item -LiteralPath $item.FullName -Destination (Join-Path -Path $Destination -ChildPath $item.Name) -Force
    }
}

function Get-MsBuildXmlContext {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectFile
    )

    [xml]$xml = Get-Content -LiteralPath $ProjectFile -Raw
    $namespaceManager = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
    $namespaceManager.AddNamespace('msb', $xml.DocumentElement.NamespaceURI)

    [PSCustomObject]@{
        Xml              = $xml
        NamespaceManager = $namespaceManager
    }
}

function Set-MsBuildProperty {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Xml.XmlDocument]$Xml,

        [Parameter(Mandatory = $true)]
        [System.Xml.XmlNamespaceManager]$NamespaceManager,

        [Parameter(Mandatory = $true)]
        [string]$PropertyName,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $node = $Xml.SelectSingleNode("//msb:$PropertyName", $NamespaceManager)
    if (-not $node) {
        $propertyGroup = $Xml.SelectSingleNode('//msb:PropertyGroup', $NamespaceManager)
        if (-not $propertyGroup) {
            throw "MSBuild project does not contain a PropertyGroup. Cannot set '$PropertyName'."
        }

        $node = $Xml.CreateElement($PropertyName, $Xml.DocumentElement.NamespaceURI)
        $propertyGroup.AppendChild($node) | Out-Null
    }

    $node.InnerText = $Value
}

function Replace-IdentityReferencesInTextFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [hashtable]$Replacements
    )

    $textExtensions = @(
        '.ps1', '.psm1', '.psd1',
        '.ts', '.tsx', '.js', '.jsx',
        '.json', '.xml', '.pcfproj', '.cdsproj', '.csproj', '.sln', '.props', '.targets',
        '.md', '.txt', '.html', '.htm', '.yml', '.yaml', '.config'
    )

    $files = @(
        Get-ChildItem -LiteralPath $Root -File -Recurse -Force -ErrorAction Stop |
            Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() }
    )

    foreach ($file in $files) {
        $content = [System.IO.File]::ReadAllText($file.FullName)
        $updated = $content

        foreach ($key in $Replacements.Keys) {
            if ([string]::IsNullOrWhiteSpace([string]$key)) {
                continue
            }

            $replacement = [string]$Replacements[$key]
            if ([string]$key -eq $replacement) {
                continue
            }

            $updated = $updated.Replace([string]$key, $replacement)
        }

        if ($updated -cne $content) {
            Write-TextUtf8NoBom -Path $file.FullName -Content $updated
        }
    }
}

function Rename-IdentityPathsInTree {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [hashtable]$Replacements
    )

    # A PCF project normally contains both the project folder and a nested control
    # source folder named after the constructor. Text replacement alone does not
    # rename those filesystem paths. Rename deepest items first so parent directory
    # moves cannot invalidate descendants that still need processing.
    $replacementKeys = @(
        $Replacements.Keys |
            ForEach-Object { [string]$_ } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Select-Object -Unique |
            Sort-Object { $_.Length } -Descending
    )

    if ($replacementKeys.Count -eq 0) {
        return
    }

    $items = @(
        Get-ChildItem -LiteralPath $Root -Recurse -Force -ErrorAction Stop |
            Sort-Object @{ Expression = { $_.FullName.Length }; Descending = $true }
    )

    foreach ($item in $items) {
        # An ancestor may have been renamed after this item was captured. Because
        # processing is deepest-first, such stale entries should only occur for
        # descendants already handled; skip them defensively.
        if (-not (Test-Path -LiteralPath $item.FullName)) {
            continue
        }

        $newName = [string]$item.Name
        foreach ($key in $replacementKeys) {
            $replacement = [string]$Replacements[$key]
            if ($key -eq $replacement) {
                continue
            }
            $newName = $newName.Replace($key, $replacement)
        }

        if ($newName -ceq $item.Name) {
            continue
        }
        if ([string]::IsNullOrWhiteSpace($newName)) {
            throw "Identity path rewrite would produce an empty name for '$($item.FullName)'."
        }

        $parent = Split-Path -Path $item.FullName -Parent
        $destination = Join-Path -Path $parent -ChildPath $newName

        if (Test-Path -LiteralPath $destination) {
            throw "Cannot rename '$($item.FullName)' to '$destination' because the destination already exists."
        }

        Move-Item -LiteralPath $item.FullName -Destination $destination
    }
}

function Replace-GuidReferencesInTextFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [AllowNull()]
        [string]$SourceGuid,

        [Parameter(Mandatory = $true)]
        [string]$TargetGuid
    )

    if ([string]::IsNullOrWhiteSpace($SourceGuid)) {
        return
    }

    $sourceGuidValue = $SourceGuid.Trim().Trim('{', '}')
    $targetGuidValue = $TargetGuid.Trim().Trim('{', '}')
    $pattern = '(?i)(?<Open>\{?)' + [regex]::Escape($sourceGuidValue) + '(?<Close>\}?)'

    $textExtensions = @('.sln', '.csproj', '.pcfproj', '.cdsproj', '.props', '.targets', '.xml', '.json')
    foreach ($file in Get-ChildItem -LiteralPath $Root -File -Recurse -Force -ErrorAction Stop | Where-Object {
        $textExtensions -contains $_.Extension.ToLowerInvariant()
    }) {
        $content = [System.IO.File]::ReadAllText($file.FullName)
        $updated = [regex]::Replace(
            $content,
            $pattern,
            {
                param($match)
                if ($match.Groups['Open'].Value -eq '{' -and $match.Groups['Close'].Value -eq '}') {
                    return '{' + $targetGuidValue + '}'
                }
                return $targetGuidValue
            }
        )

        if ($updated -cne $content) {
            Write-TextUtf8NoBom -Path $file.FullName -Content $updated
        }
    }
}

function Get-ControlIndexFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ManifestPath
    )

    $resolvedManifest = (Resolve-Path -LiteralPath $ManifestPath -ErrorAction Stop).Path
    $manifestDirectory = Split-Path -Path $resolvedManifest -Parent
    $indexPath = Join-Path -Path $manifestDirectory -ChildPath 'index.ts'

    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
        throw "Expected the PCF entry point 'index.ts' beside manifest '$resolvedManifest', but '$indexPath' was not found."
    }

    return Get-Item -LiteralPath $indexPath
}

function Set-ManifestVersionLiteral {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$IndexPath,

        [Parameter(Mandatory = $true)]
        [string]$Version
    )

    $resolvedIndex = (Resolve-Path -LiteralPath $IndexPath -ErrorAction Stop).Path
    $pattern = '(?m)(\b_manifestVersion\s*=\s*["''])(\d+\.\d+\.\d+)(["''])'
    # ${1}/${3} are deliberately braced. Without braces, a value such as 1.0.0
    # would turn "$1" + "1.0.0" into "$11.0.0", which .NET interprets as a
    # different back-reference and can corrupt the TypeScript declaration.
    $replacement = '${1}' + $Version + '${3}'

    $content = [System.IO.File]::ReadAllText($resolvedIndex)
    $matches = [regex]::Matches($content, $pattern)
    if ($matches.Count -eq 0) {
        return 0
    }

    $updated = [regex]::Replace($content, $pattern, $replacement)
    if ($updated -cne $content) {
        Write-TextUtf8NoBom -Path $resolvedIndex -Content $updated
    }

    return $matches.Count
}

function Assert-TypeScriptCloneIdentity {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceManifestPath,

        [Parameter(Mandatory = $true)]
        [string]$TargetManifestPath,

        [Parameter(Mandatory = $true)]
        [string]$SourceConstructor,

        [Parameter(Mandatory = $true)]
        [string]$TargetConstructor,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedVersion
    )

    # Resolve the control entry point from the manifest directory instead of
    # recursively searching the entire PCF project folder. A restored npm tree
    # can contain many dependency index.ts files under node_modules.
    $sourceIndex = Get-ControlIndexFile -ManifestPath $SourceManifestPath
    $targetIndex = Get-ControlIndexFile -ManifestPath $TargetManifestPath

    $sourceText = [System.IO.File]::ReadAllText($sourceIndex.FullName)
    $targetText = [System.IO.File]::ReadAllText($targetIndex.FullName)

    $sourceClassPattern = '(?m)\bexport\s+class\s+' + [regex]::Escape($SourceConstructor) + '\b'
    if ([regex]::IsMatch($sourceText, $sourceClassPattern)) {
        $targetClassPattern = '(?m)\bexport\s+class\s+' + [regex]::Escape($TargetConstructor) + '\b'
        if (-not [regex]::IsMatch($targetText, $targetClassPattern)) {
            throw "Target index.ts does not export class '$TargetConstructor' even though the source exported '$SourceConstructor'."
        }
    }

    $versionPattern = '(?m)(\b_manifestVersion\s*=\s*["''])(?<Version>\d+\.\d+\.\d+)(["''])'
    $sourceVersionMatches = [regex]::Matches($sourceText, $versionPattern)
    $targetVersionMatches = [regex]::Matches($targetText, $versionPattern)

    if ($sourceVersionMatches.Count -gt 0) {
        if ($targetVersionMatches.Count -ne $sourceVersionMatches.Count) {
            throw "Target index.ts has $($targetVersionMatches.Count) valid _manifestVersion declaration(s); expected $($sourceVersionMatches.Count) based on the source."
        }

        foreach ($match in $targetVersionMatches) {
            if ($match.Groups['Version'].Value -ne $ExpectedVersion) {
                throw "Target index.ts contains _manifestVersion '$($match.Groups['Version'].Value)' but expected '$ExpectedVersion'."
            }
        }
    }

    if ($targetText.Contains('this._manifestVersion') -and $targetVersionMatches.Count -eq 0) {
        throw "Target index.ts references this._manifestVersion but contains no valid _manifestVersion declaration."
    }

    # Catch the exact corruption pattern that motivated this guard as well as
    # similar malformed readonly declarations produced by an unsafe replacement.
    if ($targetText -match '(?m)^\s*private\s+readonly\s+\$\d') {
        throw 'Target index.ts contains a malformed readonly declaration beginning with a regex back-reference token.'
    }
}
function Update-ClonedToolingReadme {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetRoot,

        [Parameter(Mandatory = $true)]
        [string]$CurrentControlName,

        [AllowNull()]
        [psobject]$CurrentGeneration
    )

    $readmePath = Join-Path -Path $TargetRoot -ChildPath 'PS Scripts\README.md'
    if (-not (Test-Path -LiteralPath $readmePath -PathType Leaf)) {
        return
    }

    $content = [System.IO.File]::ReadAllText($readmePath)
    $marker = [regex]::Match($content, '(?m)^# PCF Identity Clone Tooling\s*$')
    if (-not $marker.Success) {
        return
    }

    $nextControlName = if ($CurrentGeneration) {
        '{0}V{1}' -f $CurrentGeneration.Base, ($CurrentGeneration.Generation + 1)
    }
    else {
        '<NextControlName>'
    }

    $sectionLines = @(
        '# PCF Identity Clone Tooling',
        '',
        '## Validate tooling',
        '',
        '```powershell',
        ('cd "{0}\PS Scripts"' -f $TargetRoot),
        '.\Test-PCFToolingPackage.ps1',
        '```',
        '',
        '## Preview the next identity clone',
        '',
        ('Current control: `{0}`. Planned next control: `{1}`.' -f $CurrentControlName, $nextControlName),
        '',
        '```powershell',
        '.\New-PCFIdentityClone.ps1 `',
        ('  -SourceProjectRoot "{0}" `' -f $TargetRoot),
        '  -NextGeneration `',
        '  -WhatIf',
        '```',
        '',
        '## Create the next identity without building/deploying',
        '',
        '```powershell',
        '.\New-PCFIdentityClone.ps1 `',
        ('  -SourceProjectRoot "{0}" `' -f $TargetRoot),
        '  -NextGeneration',
        '```',
        '',
        '## Create, build and deploy the next identity unmanaged to DEV',
        '',
        '```powershell',
        '.\New-PCFIdentityClone.ps1 `',
        ('  -SourceProjectRoot "{0}" `' -f $TargetRoot),
        '  -NextGeneration `',
        '  -Build `',
        '  -DeployToDev `',
        '  -EnvironmentUrl "https://hsi-dev.crm4.dynamics.com/"',
        '```',
        '',
        'The deployment intentionally does not pass `-DeployManaged`. The source project is never modified. The target path must not already exist. On failure, an incomplete target is removed unless `-KeepTargetOnFailure` is supplied.'
    )

    $prefix = $content.Substring(0, $marker.Index).TrimEnd()
    $updatedReadme = $prefix + [Environment]::NewLine + [Environment]::NewLine + ($sectionLines -join [Environment]::NewLine) + [Environment]::NewLine
    Write-TextUtf8NoBom -Path $readmePath -Content $updatedReadme
}

function Get-GitSnapshot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $git = Get-Command git -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $git) {
        return [PSCustomObject]@{
            Commit = $null
            Dirty  = $null
        }
    }

    $commitResult = Invoke-NativeCommand -Command $git.Source -Arguments @('-C', $Path, 'rev-parse', 'HEAD')
    $statusResult = Invoke-NativeCommand -Command $git.Source -Arguments @('-C', $Path, 'status', '--porcelain')

    [PSCustomObject]@{
        Commit = if ($commitResult.ExitCode -eq 0) { $commitResult.Text.Trim() } else { $null }
        Dirty  = if ($statusResult.ExitCode -eq 0) { -not [string]::IsNullOrWhiteSpace($statusResult.Text) } else { $null }
    }
}

function Get-ExpectedDataverseControlName {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [string]$PublisherPrefix,

        [Parameter(Mandatory = $true)]
        [string]$Namespace,

        [Parameter(Mandatory = $true)]
        [string]$Constructor
    )

    if ([string]::IsNullOrWhiteSpace($PublisherPrefix)) {
        return "$Namespace.$Constructor"
    }

    return "${PublisherPrefix}_${Namespace}.${Constructor}"
}

function Assert-NoResidualIdentity {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [string[]]$ForbiddenValues
    )

    $runtimeExtensions = @(
        '.ps1', '.psm1', '.psd1',
        '.ts', '.tsx', '.js', '.jsx',
        '.json', '.xml', '.pcfproj', '.cdsproj', '.csproj', '.sln', '.props', '.targets',
        '.yml', '.yaml', '.config'
    )

    $violations = [System.Collections.Generic.List[string]]::new()

    foreach ($file in Get-ChildItem -LiteralPath $Root -File -Recurse -Force -ErrorAction Stop) {
        if ($file.Name -eq 'PCF-IDENTITY-MIGRATION.json') {
            continue
        }
        if ($runtimeExtensions -notcontains $file.Extension.ToLowerInvariant()) {
            continue
        }

        $content = [System.IO.File]::ReadAllText($file.FullName)
        foreach ($value in $ForbiddenValues | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique) {
            if ($content.Contains($value)) {
                $relative = [System.IO.Path]::GetRelativePath($Root, $file.FullName)
                $violations.Add("$relative contains '$value'")
            }
        }
    }

    foreach ($item in Get-ChildItem -LiteralPath $Root -Recurse -Force -ErrorAction Stop) {
        if ($item.Name -eq 'PCF-IDENTITY-MIGRATION.json') {
            continue
        }

        foreach ($value in $ForbiddenValues | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique) {
            if ($item.Name.Contains($value)) {
                $relative = [System.IO.Path]::GetRelativePath($Root, $item.FullName)
                $violations.Add("path '$relative' contains '$value'")
            }
        }
    }

    if ($violations.Count -gt 0) {
        $details = ($violations | Select-Object -Unique | Sort-Object) -join [Environment]::NewLine
        throw "Residual source identity references remain in the cloned project:`n$details"
    }
}

try {
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        throw 'PowerShell 7 or later is required.'
    }

    if ($DeployToDev) {
        $Build = $true
        if ([string]::IsNullOrWhiteSpace($EnvironmentUrl)) {
            throw '-EnvironmentUrl is required when -DeployToDev is specified.'
        }
    }

    $sourceRoot = (Resolve-Path -LiteralPath $SourceProjectRoot -ErrorAction Stop).Path
    $sourceContext = Get-PcfProjectContext -ProjectRoot $sourceRoot

    [xml]$sourceManifestXml = Get-Content -LiteralPath $sourceContext.ManifestFile.FullName -Raw
    [xml]$sourceSolutionXml = Get-Content -LiteralPath $sourceContext.SolutionXmlFile.FullName -Raw

    $sourceConstructor = [string]$sourceManifestXml.manifest.control.constructor
    $sourceNamespace = [string]$sourceManifestXml.manifest.control.namespace
    $sourceControlVersion = [string]$sourceManifestXml.manifest.control.version
    $sourceSolutionUniqueName = [string]$sourceSolutionXml.ImportExportXml.SolutionManifest.UniqueName
    $sourceSolutionVersion = [string]$sourceSolutionXml.ImportExportXml.SolutionManifest.Version
    $publisherPrefix = [string]$sourceSolutionXml.ImportExportXml.SolutionManifest.Publisher.CustomizationPrefix

    if ([string]::IsNullOrWhiteSpace($sourceConstructor)) {
        throw 'The source ControlManifest.Input.xml does not define a control constructor.'
    }
    if ([string]::IsNullOrWhiteSpace($sourceNamespace)) {
        throw 'The source ControlManifest.Input.xml does not define a control namespace.'
    }

    $sourcePcfProjectName = Get-MsBuildPropertyValue -ProjectFile $sourceContext.PcfProject.FullName -PropertyName 'Name'
    $sourcePcfProjectGuid = Get-MsBuildPropertyValue -ProjectFile $sourceContext.PcfProject.FullName -PropertyName 'ProjectGuid'
    $sourceSolutionProjectGuid = Get-MsBuildPropertyValue -ProjectFile $sourceContext.CdsProject.FullName -PropertyName 'ProjectGuid'

    if ($PSCmdlet.ParameterSetName -eq 'NextGeneration') {
        $sourceGeneration = Get-GenerationInfo -Name $sourceConstructor
        if (-not $sourceGeneration) {
            throw "-NextGeneration requires the source constructor '$sourceConstructor' to end in V<number>. Specify -TargetControlName explicitly instead."
        }

        $TargetControlName = '{0}V{1}' -f $sourceGeneration.Base, ($sourceGeneration.Generation + 1)
    }
    else {
        $sourceGeneration = Get-GenerationInfo -Name $sourceConstructor
    }

    if ($TargetControlName -eq $sourceConstructor) {
        throw 'The target control name must be different from the source constructor.'
    }

    $targetGeneration = Get-GenerationInfo -Name $TargetControlName

    if ([string]::IsNullOrWhiteSpace($TargetNamespace)) {
        $TargetNamespace = $sourceNamespace
    }
    if ([string]::IsNullOrWhiteSpace($TargetSolutionUniqueName)) {
        $TargetSolutionUniqueName = $TargetControlName
    }

    if ([string]::IsNullOrWhiteSpace($TargetProjectRoot)) {
        $sourceParent = Split-Path -Path $sourceRoot -Parent
        $TargetProjectRoot = Join-Path -Path $sourceParent -ChildPath $TargetControlName
    }

    $targetRoot = Get-FullPathNormalized -Path $TargetProjectRoot

    if ($targetRoot.Equals((Get-FullPathNormalized -Path $sourceRoot), [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'SourceProjectRoot and TargetProjectRoot cannot be the same directory.'
    }
    if (Test-PathIsDescendantOf -Candidate $targetRoot -Parent $sourceRoot) {
        throw "TargetProjectRoot '$targetRoot' cannot be inside SourceProjectRoot '$sourceRoot'."
    }
    if (Test-Path -LiteralPath $targetRoot) {
        throw "TargetProjectRoot '$targetRoot' already exists. The identity clone is intentionally create-only; choose a new target path."
    }

    $targetParent = Split-Path -Path $targetRoot -Parent
    if ([string]::IsNullOrWhiteSpace($targetParent)) {
        throw "Could not resolve the parent directory for '$targetRoot'."
    }

    $gitSnapshot = Get-GitSnapshot -Path $sourceRoot
    if ($gitSnapshot.Dirty -eq $true) {
        Write-Warning "Source Git working tree is dirty. The clone will faithfully copy the current filesystem state, not only commit '$($gitSnapshot.Commit)'. Review the generated migration manifest before promotion."
    }

    $sourcePcfRelative = [System.IO.Path]::GetRelativePath($sourceRoot, $sourceContext.PcfProject.FullName)
    $sourceCdsRelative = [System.IO.Path]::GetRelativePath($sourceRoot, $sourceContext.CdsProject.FullName)
    $sourceControlFolderRelative = [System.IO.Path]::GetDirectoryName($sourcePcfRelative)

    if ([string]::IsNullOrWhiteSpace($sourceControlFolderRelative)) {
        throw 'This script expects the PCF project to be inside a dedicated control subfolder below SourceProjectRoot.'
    }

    $sourceControlFolderLeaf = Split-Path -Path $sourceControlFolderRelative -Leaf
    $controlFolderParentRelative = [System.IO.Path]::GetDirectoryName($sourceControlFolderRelative)
    $renameControlFolder =
        $sourceControlFolderLeaf.Equals($sourceConstructor, [System.StringComparison]::OrdinalIgnoreCase) -or
        (-not [string]::IsNullOrWhiteSpace($sourcePcfProjectName) -and $sourceControlFolderLeaf.Equals($sourcePcfProjectName, [System.StringComparison]::OrdinalIgnoreCase))

    if ($renameControlFolder) {
        $targetControlFolderRelative = if ([string]::IsNullOrWhiteSpace($controlFolderParentRelative)) {
            $TargetControlName
        }
        else {
            Join-Path -Path $controlFolderParentRelative -ChildPath $TargetControlName
        }
    }
    else {
        $targetControlFolderRelative = $sourceControlFolderRelative
    }

    $targetPcfRelative = Join-Path -Path $targetControlFolderRelative -ChildPath ($TargetControlName + '.pcfproj')
    $targetCdsRelative = $sourceCdsRelative

    $sourceExpectedDataverseName = Get-ExpectedDataverseControlName -PublisherPrefix $publisherPrefix -Namespace $sourceNamespace -Constructor $sourceConstructor
    $targetExpectedDataverseName = Get-ExpectedDataverseControlName -PublisherPrefix $publisherPrefix -Namespace $TargetNamespace -Constructor $TargetControlName

    Write-Host '=== PCF Identity Clone Plan ===' -ForegroundColor Cyan
    Write-Host "Script version              : $ScriptVersion"
    Write-Host "Source root                 : $sourceRoot"
    Write-Host "Source control              : $sourceExpectedDataverseName"
    Write-Host "Source control version      : $sourceControlVersion"
    Write-Host "Source solution             : $sourceSolutionUniqueName $sourceSolutionVersion"
    Write-Host "Target root                 : $targetRoot"
    Write-Host "Target control              : $targetExpectedDataverseName"
    Write-Host "Target control version      : $InitialControlVersion"
    Write-Host "Target solution             : $TargetSolutionUniqueName $InitialSolutionVersion"
    Write-Host "Build                       : $Build"
    Write-Host "Deploy unmanaged to DEV     : $DeployToDev"
    if ($DeployToDev) {
        Write-Host "DEV environment             : $EnvironmentUrl"
    }

    if ($WhatIfPreference) {
        return [PSCustomObject]@{
            SourceProjectRoot = $sourceRoot
            TargetProjectRoot = $targetRoot
            SourceControl     = $sourceExpectedDataverseName
            TargetControl     = $targetExpectedDataverseName
            Planned           = $true
        }
    }

    if (-not $PSCmdlet.ShouldProcess($targetRoot, "Create PCF identity clone '$sourceConstructor' -> '$TargetControlName'")) {
        return
    }

    if (-not (Test-Path -LiteralPath $targetParent -PathType Container)) {
        New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
    }

    Write-Host "`n--- Copying source project without generated/runtime artifacts ---" -ForegroundColor Green
    Copy-ProjectTreeFiltered -Source $sourceRoot -Destination $targetRoot
    $targetCreated = $true

    $oldTargetControlFolder = Join-Path -Path $targetRoot -ChildPath $sourceControlFolderRelative
    $newTargetControlFolder = Join-Path -Path $targetRoot -ChildPath $targetControlFolderRelative

    if (-not (Test-Path -LiteralPath $oldTargetControlFolder -PathType Container)) {
        throw "Expected cloned control folder '$oldTargetControlFolder' was not found."
    }

    if (-not $oldTargetControlFolder.Equals($newTargetControlFolder, [System.StringComparison]::OrdinalIgnoreCase)) {
        $newParent = Split-Path -Path $newTargetControlFolder -Parent
        if (-not (Test-Path -LiteralPath $newParent -PathType Container)) {
            New-Item -ItemType Directory -Path $newParent -Force | Out-Null
        }
        if (Test-Path -LiteralPath $newTargetControlFolder) {
            throw "Target control folder '$newTargetControlFolder' unexpectedly already exists."
        }
        Move-Item -LiteralPath $oldTargetControlFolder -Destination $newTargetControlFolder
    }

    $sourcePcfLeaf = Split-Path -Path $sourceContext.PcfProject.FullName -Leaf
    $clonedPcfPath = Join-Path -Path $newTargetControlFolder -ChildPath $sourcePcfLeaf
    $targetPcfPath = Join-Path -Path $newTargetControlFolder -ChildPath ($TargetControlName + '.pcfproj')

    if (-not (Test-Path -LiteralPath $clonedPcfPath -PathType Leaf)) {
        throw "Expected cloned PCF project '$clonedPcfPath' was not found."
    }
    if (-not $clonedPcfPath.Equals($targetPcfPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        if (Test-Path -LiteralPath $targetPcfPath) {
            throw "Target PCF project '$targetPcfPath' unexpectedly already exists."
        }
        Move-Item -LiteralPath $clonedPcfPath -Destination $targetPcfPath
    }

    $targetCdsPath = Join-Path -Path $targetRoot -ChildPath $targetCdsRelative
    if (-not (Test-Path -LiteralPath $targetCdsPath -PathType Leaf)) {
        throw "Expected cloned Dataverse solution project '$targetCdsPath' was not found."
    }

    $newPcfProjectGuid = ([guid]::NewGuid()).ToString()
    $newSolutionProjectGuid = ([guid]::NewGuid()).ToString()

    $replacementMap = @{}
    $replacementMap[$sourceConstructor] = $TargetControlName

    if (-not [string]::IsNullOrWhiteSpace($sourcePcfProjectName) -and $sourcePcfProjectName -ne $sourceConstructor) {
        $replacementMap[$sourcePcfProjectName] = $TargetControlName
    }
    if (-not [string]::IsNullOrWhiteSpace($sourceSolutionUniqueName) -and $sourceSolutionUniqueName -ne $sourceConstructor) {
        $replacementMap[$sourceSolutionUniqueName] = $TargetSolutionUniqueName
    }

    $sourceRootLeaf = Split-Path -Path $sourceRoot -Leaf
    if (-not [string]::IsNullOrWhiteSpace($sourceRootLeaf) -and $sourceRootLeaf -ne $sourceConstructor -and $sourceRootLeaf -ne $sourceSolutionUniqueName) {
        $replacementMap[$sourceRootLeaf] = $TargetControlName
    }

    Write-Host "`n--- Rewriting control/solution identity references ---" -ForegroundColor Green
    Replace-IdentityReferencesInTextFiles -Root $targetRoot -Replacements $replacementMap
    Rename-IdentityPathsInTree -Root $targetRoot -Replacements $replacementMap

    Replace-GuidReferencesInTextFiles -Root $targetRoot -SourceGuid $sourcePcfProjectGuid -TargetGuid $newPcfProjectGuid
    Replace-GuidReferencesInTextFiles -Root $targetRoot -SourceGuid $sourceSolutionProjectGuid -TargetGuid $newSolutionProjectGuid

    $pcfMsBuild = Get-MsBuildXmlContext -ProjectFile $targetPcfPath
    Set-MsBuildProperty -Xml $pcfMsBuild.Xml -NamespaceManager $pcfMsBuild.NamespaceManager -PropertyName 'Name' -Value $TargetControlName
    Set-MsBuildProperty -Xml $pcfMsBuild.Xml -NamespaceManager $pcfMsBuild.NamespaceManager -PropertyName 'ProjectGuid' -Value $newPcfProjectGuid
    Set-MsBuildProperty -Xml $pcfMsBuild.Xml -NamespaceManager $pcfMsBuild.NamespaceManager -PropertyName 'PcfBuildMode' -Value 'production'
    Write-XmlUtf8NoBom -Xml $pcfMsBuild.Xml -Path $targetPcfPath

    $cdsMsBuild = Get-MsBuildXmlContext -ProjectFile $targetCdsPath
    Set-MsBuildProperty -Xml $cdsMsBuild.Xml -NamespaceManager $cdsMsBuild.NamespaceManager -PropertyName 'ProjectGuid' -Value $newSolutionProjectGuid
    Set-MsBuildProperty -Xml $cdsMsBuild.Xml -NamespaceManager $cdsMsBuild.NamespaceManager -PropertyName 'SolutionPackageType' -Value 'Both'

    $pcfReferences = @($cdsMsBuild.Xml.SelectNodes('//msb:ProjectReference', $cdsMsBuild.NamespaceManager) | Where-Object {
        [string]$_.GetAttribute('Include') -match '\.pcfproj$'
    })
    if ($pcfReferences.Count -ne 1) {
        throw "Expected exactly one PCF ProjectReference in '$targetCdsPath', but found $($pcfReferences.Count). The clone script intentionally fails on ambiguous multi-PCF solution projects."
    }

    $targetPcfRelativeToSolution = [System.IO.Path]::GetRelativePath((Split-Path -Path $targetCdsPath -Parent), $targetPcfPath).Replace('/', '\')
    $pcfReferences[0].SetAttribute('Include', $targetPcfRelativeToSolution)
    Write-XmlUtf8NoBom -Xml $cdsMsBuild.Xml -Path $targetCdsPath

    $targetManifestPath = Join-Path -Path $newTargetControlFolder -ChildPath 'ControlManifest.Input.xml'
    if (-not (Test-Path -LiteralPath $targetManifestPath -PathType Leaf)) {
        $manifestMatches = @(Get-ChildItem -LiteralPath $newTargetControlFolder -Filter 'ControlManifest.Input.xml' -File -Recurse)
        if ($manifestMatches.Count -ne 1) {
            throw "Expected exactly one ControlManifest.Input.xml below '$newTargetControlFolder', but found $($manifestMatches.Count)."
        }
        $targetManifestPath = $manifestMatches[0].FullName
    }

    [xml]$targetManifestXml = Get-Content -LiteralPath $targetManifestPath -Raw
    $controlNode = $targetManifestXml.manifest.control
    $controlNode.SetAttribute('namespace', $TargetNamespace)
    $controlNode.SetAttribute('constructor', $TargetControlName)
    $controlNode.SetAttribute('version', $InitialControlVersion)

    if (-not [string]::IsNullOrWhiteSpace($TargetDisplayName)) {
        $controlNode.SetAttribute('display-name-key', $TargetDisplayName)
    }
    elseif ($controlNode.HasAttribute('display-name-key')) {
        $controlNode.SetAttribute(
            'display-name-key',
            (Convert-IdentityText -Text $controlNode.GetAttribute('display-name-key') -SourceConstructor $sourceConstructor -TargetConstructor $TargetControlName -SourceGeneration $sourceGeneration -TargetGeneration $targetGeneration)
        )
    }

    if (-not [string]::IsNullOrWhiteSpace($TargetControlDescription)) {
        $controlNode.SetAttribute('description-key', $TargetControlDescription)
    }
    elseif ($controlNode.HasAttribute('description-key')) {
        $controlNode.SetAttribute(
            'description-key',
            (Convert-IdentityText -Text $controlNode.GetAttribute('description-key') -SourceConstructor $sourceConstructor -TargetConstructor $TargetControlName -SourceGeneration $sourceGeneration -TargetGeneration $targetGeneration)
        )
    }
    Write-XmlUtf8NoBom -Xml $targetManifestXml -Path $targetManifestPath

    $targetSolutionXmlPath = Join-Path -Path $targetRoot -ChildPath 'Solution\src\Other\Solution.xml'
    if (-not (Test-Path -LiteralPath $targetSolutionXmlPath -PathType Leaf)) {
        throw "Target Solution.xml was not found at '$targetSolutionXmlPath'."
    }

    [xml]$targetSolutionXml = Get-Content -LiteralPath $targetSolutionXmlPath -Raw
    $solutionManifest = $targetSolutionXml.ImportExportXml.SolutionManifest
    $solutionManifest.UniqueName = $TargetSolutionUniqueName
    $solutionManifest.Version = $InitialSolutionVersion

    if ($solutionManifest.Managed) {
        $solutionManifest.Managed = '2'
    }

    # Use XPath for optional child elements. Under StrictMode, PowerShell's XML
    # property adapter throws when an element exists but an optional child does not
    # (for example <Descriptions /> has no .Description property).
    $localizedNameNodes = @($solutionManifest.SelectNodes('./LocalizedNames/LocalizedName'))
    foreach ($localizedName in $localizedNameNodes) {
        if ($localizedName -and $localizedName.HasAttribute('description')) {
            $localizedName.SetAttribute(
                'description',
                (Convert-IdentityText -Text $localizedName.GetAttribute('description') -SourceConstructor $sourceConstructor -TargetConstructor $TargetControlName -SourceGeneration $sourceGeneration -TargetGeneration $targetGeneration).Replace($sourceSolutionUniqueName, $TargetSolutionUniqueName)
            )
        }
    }

    # Solution.xml can contain more than one direct <Descriptions> container under
    # <SolutionManifest>. PAC-generated projects may keep an empty container near
    # LocalizedNames and another populated container later in the manifest. Never use
    # SelectSingleNode here, otherwise a populated later container can retain the old
    # V-generation text unnoticed.
    $descriptionsNodes = @($solutionManifest.SelectNodes('./Descriptions'))
    if ($descriptionsNodes.Count -eq 0 -and -not [string]::IsNullOrWhiteSpace($TargetSolutionDescription)) {
        $newDescriptionsNode = $targetSolutionXml.CreateElement('Descriptions')
        $solutionManifest.AppendChild($newDescriptionsNode) | Out-Null
        $descriptionsNodes = @($newDescriptionsNode)
    }

    if ($descriptionsNodes.Count -gt 0) {
        $descriptionNodes = @($solutionManifest.SelectNodes('./Descriptions/Description'))

        if (-not [string]::IsNullOrWhiteSpace($TargetSolutionDescription)) {
            $englishDescriptions = @(
                $descriptionNodes |
                    Where-Object { $_ -and $_.GetAttribute('languagecode') -eq '1033' }
            )

            if ($englishDescriptions.Count -eq 0) {
                $newDescription = $targetSolutionXml.CreateElement('Description')
                $newDescription.SetAttribute('languagecode', '1033')
                $newDescription.SetAttribute('description', $TargetSolutionDescription)
                $descriptionsNodes[0].AppendChild($newDescription) | Out-Null
                $descriptionNodes = @($solutionManifest.SelectNodes('./Descriptions/Description'))
            }
        }

        foreach ($descriptionNode in $descriptionNodes) {
            if (-not $descriptionNode -or -not $descriptionNode.HasAttribute('description')) {
                continue
            }

            if (-not [string]::IsNullOrWhiteSpace($TargetSolutionDescription) -and $descriptionNode.GetAttribute('languagecode') -eq '1033') {
                $descriptionNode.SetAttribute('description', $TargetSolutionDescription)
                continue
            }

            $rewrittenDescription = Convert-IdentityText `
                -Text $descriptionNode.GetAttribute('description') `
                -SourceConstructor $sourceConstructor `
                -TargetConstructor $TargetControlName `
                -SourceGeneration $sourceGeneration `
                -TargetGeneration $targetGeneration

            $rewrittenDescription = $rewrittenDescription.Replace($sourceSolutionUniqueName, $TargetSolutionUniqueName)
            $descriptionNode.SetAttribute('description', $rewrittenDescription)
        }
    }

    Write-XmlUtf8NoBom -Xml $targetSolutionXml -Path $targetSolutionXmlPath

    $targetIndexForVersion = Get-ControlIndexFile -ManifestPath $targetManifestPath
    $manifestVersionLiteralCount = Set-ManifestVersionLiteral -IndexPath $targetIndexForVersion.FullName -Version $InitialControlVersion
    Update-ClonedToolingReadme -TargetRoot $targetRoot -CurrentControlName $TargetControlName -CurrentGeneration $targetGeneration

    Write-Host "`n--- Validating cloned identity ---" -ForegroundColor Green
    $targetContext = Get-PcfProjectContext -ProjectRoot $targetRoot

    if ($targetContext.ControlConstructor -ne $TargetControlName) {
        throw "Target manifest constructor '$($targetContext.ControlConstructor)' does not match '$TargetControlName'."
    }
    if ($targetContext.ControlNamespace -ne $TargetNamespace) {
        throw "Target manifest namespace '$($targetContext.ControlNamespace)' does not match '$TargetNamespace'."
    }
    if ($targetContext.ControlVersion -ne $InitialControlVersion) {
        throw "Target control version '$($targetContext.ControlVersion)' does not match '$InitialControlVersion'."
    }
    if ($targetContext.SolutionUniqueName -ne $TargetSolutionUniqueName) {
        throw "Target solution unique name '$($targetContext.SolutionUniqueName)' does not match '$TargetSolutionUniqueName'."
    }
    if ($targetContext.SolutionVersion -ne $InitialSolutionVersion) {
        throw "Target solution version '$($targetContext.SolutionVersion)' does not match '$InitialSolutionVersion'."
    }

    Assert-TypeScriptCloneIdentity `
        -SourceManifestPath $sourceContext.ManifestFile.FullName `
        -TargetManifestPath $targetContext.ManifestFile.FullName `
        -SourceConstructor $sourceConstructor `
        -TargetConstructor $TargetControlName `
        -ExpectedVersion $InitialControlVersion

    # If the source had an explicit _manifestVersion literal, the rewrite must
    # have found and updated at least one literal in the target.
    $sourceIndexForVersion = Get-ControlIndexFile -ManifestPath $sourceContext.ManifestFile.FullName
    $sourceIndexTextForVersion = [System.IO.File]::ReadAllText($sourceIndexForVersion.FullName)
    if ($sourceIndexTextForVersion -match '\b_manifestVersion\s*=\s*["'']\d+\.\d+\.\d+["'']' -and $manifestVersionLiteralCount -lt 1) {
        throw 'The source uses _manifestVersion, but no target _manifestVersion literal was rewritten.'
    }

    [xml]$validatedSolutionXml = Get-Content -LiteralPath $targetContext.SolutionXmlFile.FullName -Raw
    $validatedSolutionManifest = $validatedSolutionXml.ImportExportXml.SolutionManifest
    foreach ($descriptionNode in @($validatedSolutionManifest.SelectNodes('./Descriptions/Description'))) {
        if (-not $descriptionNode -or -not $descriptionNode.HasAttribute('description')) {
            continue
        }

        $descriptionText = $descriptionNode.GetAttribute('description')
        if (-not [string]::IsNullOrWhiteSpace($sourceConstructor) -and $descriptionText.Contains($sourceConstructor)) {
            throw "Target Solution.xml description still contains source constructor '$sourceConstructor'."
        }
        if (-not [string]::IsNullOrWhiteSpace($sourceSolutionUniqueName) -and $sourceSolutionUniqueName -ne $TargetSolutionUniqueName -and $descriptionText.Contains($sourceSolutionUniqueName)) {
            throw "Target Solution.xml description still contains source solution name '$sourceSolutionUniqueName'."
        }
        if ($sourceGeneration -and $targetGeneration -and $sourceGeneration.Token -ne $targetGeneration.Token) {
            $oldGenerationPattern = '(?<![A-Za-z0-9])' + [regex]::Escape([string]$sourceGeneration.Token) + '(?![A-Za-z0-9])'
            if ([regex]::IsMatch($descriptionText, $oldGenerationPattern)) {
                throw "Target Solution.xml description still contains source generation token '$($sourceGeneration.Token)'."
            }
        }
    }

    $actualPcfGuid = Get-MsBuildPropertyValue -ProjectFile $targetContext.PcfProject.FullName -PropertyName 'ProjectGuid'
    $actualSolutionGuid = Get-MsBuildPropertyValue -ProjectFile $targetContext.CdsProject.FullName -PropertyName 'ProjectGuid'
    if ([string]::IsNullOrWhiteSpace($actualPcfGuid) -or $actualPcfGuid -eq $sourcePcfProjectGuid) {
        throw 'The cloned PCF ProjectGuid was not reset successfully.'
    }
    if ([string]::IsNullOrWhiteSpace($actualSolutionGuid) -or $actualSolutionGuid -eq $sourceSolutionProjectGuid) {
        throw 'The cloned solution ProjectGuid was not reset successfully.'
    }

    if ((Get-MsBuildPropertyValue -ProjectFile $targetContext.PcfProject.FullName -PropertyName 'PcfBuildMode') -ne 'production') {
        throw 'The cloned PCF project is not configured with PcfBuildMode=production.'
    }
    if ((Get-MsBuildPropertyValue -ProjectFile $targetContext.CdsProject.FullName -PropertyName 'SolutionPackageType') -ne 'Both') {
        throw 'The cloned solution project is not configured with SolutionPackageType=Both.'
    }

    $packageLockPath = Join-Path -Path $targetContext.ControlFolder -ChildPath 'package-lock.json'
    if (-not (Test-Path -LiteralPath $packageLockPath -PathType Leaf)) {
        throw "package-lock.json was not copied to '$($targetContext.ControlFolder)'. The clone is not release-deterministic."
    }

    $forbiddenIdentityValues = @($sourceConstructor)
    if (-not [string]::IsNullOrWhiteSpace($sourcePcfProjectName) -and $sourcePcfProjectName -ne $sourceConstructor) {
        $forbiddenIdentityValues += $sourcePcfProjectName
    }
    if (-not [string]::IsNullOrWhiteSpace($sourceSolutionUniqueName) -and $sourceSolutionUniqueName -ne $TargetSolutionUniqueName) {
        $forbiddenIdentityValues += $sourceSolutionUniqueName
    }

    Assert-NoResidualIdentity -Root $targetRoot -ForbiddenValues $forbiddenIdentityValues

    $migrationManifestPath = Join-Path -Path $targetRoot -ChildPath 'PCF-IDENTITY-MIGRATION.json'
    $migrationManifest = [ordered]@{
        schemaVersion                   = 1
        script                          = 'New-PCFIdentityClone.ps1'
        scriptVersion                   = $ScriptVersion
        createdUtc                      = [DateTimeOffset]::UtcNow.ToString('o')
        reason                          = $Reason
        sourceProjectRoot               = $sourceRoot
        targetProjectRoot               = $targetRoot
        sourceGitCommit                 = $gitSnapshot.Commit
        sourceGitDirty                  = $gitSnapshot.Dirty
        publisherPrefix                 = $publisherPrefix
        source = [ordered]@{
            namespace                   = $sourceNamespace
            constructor                 = $sourceConstructor
            expectedDataverseName       = $sourceExpectedDataverseName
            controlVersion              = $sourceControlVersion
            solutionUniqueName          = $sourceSolutionUniqueName
            solutionVersion             = $sourceSolutionVersion
            pcfProjectGuid              = $sourcePcfProjectGuid
            solutionProjectGuid         = $sourceSolutionProjectGuid
            manifestSha256              = Get-FileSha256 -Path $sourceContext.ManifestFile.FullName
            pcfProjectSha256            = Get-FileSha256 -Path $sourceContext.PcfProject.FullName
            solutionProjectSha256       = Get-FileSha256 -Path $sourceContext.CdsProject.FullName
            solutionXmlSha256           = Get-FileSha256 -Path $sourceContext.SolutionXmlFile.FullName
        }
        target = [ordered]@{
            namespace                   = $TargetNamespace
            constructor                 = $TargetControlName
            expectedDataverseName       = $targetExpectedDataverseName
            controlVersion              = $InitialControlVersion
            solutionUniqueName          = $TargetSolutionUniqueName
            solutionVersion             = $InitialSolutionVersion
            pcfProjectGuid              = $actualPcfGuid
            solutionProjectGuid         = $actualSolutionGuid
            manifestSha256              = Get-FileSha256 -Path $targetContext.ManifestFile.FullName
            pcfProjectSha256            = Get-FileSha256 -Path $targetContext.PcfProject.FullName
            solutionProjectSha256       = Get-FileSha256 -Path $targetContext.CdsProject.FullName
            solutionXmlSha256           = Get-FileSha256 -Path $targetContext.SolutionXmlFile.FullName
        }
    }
    Write-TextUtf8NoBom -Path $migrationManifestPath -Content ($migrationManifest | ConvertTo-Json -Depth 8)

    $targetScriptsDirectory = Join-Path -Path $targetRoot -ChildPath 'PS Scripts'
    $validationScript = Join-Path -Path $targetScriptsDirectory -ChildPath 'Test-PCFProjectConfiguration.ps1'
    $toolingScript = Join-Path -Path $targetScriptsDirectory -ChildPath 'Test-PCFToolingPackage.ps1'

    if (-not $SkipToolingValidation) {
        if (-not (Test-Path -LiteralPath $validationScript -PathType Leaf)) {
            throw "The cloned project does not contain '$validationScript'. Copy/use the release-safe PCF tooling package before proceeding."
        }

        Write-Host "`n--- Running release-safe project validation ---" -ForegroundColor Green
        & $validationScript -ProjectRoot $targetRoot | Out-Null

        if (Test-Path -LiteralPath $toolingScript -PathType Leaf) {
            Write-Host "`n--- Validating copied PowerShell tooling ---" -ForegroundColor Green
            & $toolingScript -ScriptsDirectory $targetScriptsDirectory | Out-Host
        }
    }

    $artifactSummary = $null
    if ($Build) {
        $buildScript = Join-Path -Path $targetScriptsDirectory -ChildPath 'Build-And-Deploy-PCF.ps1'
        if (-not (Test-Path -LiteralPath $buildScript -PathType Leaf)) {
            throw "Build requested, but '$buildScript' was not found."
        }

        Write-Host "`n--- Building cloned PCF as version $InitialControlVersion ---" -ForegroundColor Green
        $buildParams = @{
            ProjectRoot = $targetRoot
        }
        if ($RunSolutionChecker) {
            $buildParams['RunSolutionChecker'] = $true
            $buildParams['SolutionCheckerGeo'] = $SolutionCheckerGeo
        }
        if ($DeployToDev) {
            $buildParams['Deploy'] = $true
            $buildParams['EnvironmentUrl'] = $EnvironmentUrl
        }

        # Deliberately do NOT pass -IncrementVersion or -DeployManaged.
        # The first V-next release remains 1.0.0/1.0.0.0 and DEV deployment remains unmanaged.
        $artifactSummary = & $buildScript @buildParams
    }

    $result = [PSCustomObject]@{
        SourceProjectRoot          = $sourceRoot
        TargetProjectRoot          = $targetRoot
        SourceControl              = $sourceExpectedDataverseName
        TargetControl              = $targetExpectedDataverseName
        SourceControlVersion       = $sourceControlVersion
        TargetControlVersion       = $InitialControlVersion
        SourceSolutionUniqueName   = $sourceSolutionUniqueName
        TargetSolutionUniqueName   = $TargetSolutionUniqueName
        TargetSolutionVersion      = $InitialSolutionVersion
        SourcePcfProjectGuid       = $sourcePcfProjectGuid
        TargetPcfProjectGuid       = $actualPcfGuid
        SourceSolutionProjectGuid  = $sourceSolutionProjectGuid
        TargetSolutionProjectGuid  = $actualSolutionGuid
        MigrationManifestPath      = $migrationManifestPath
        Built                      = [bool]$Build
        DeployedUnmanagedToDev     = [bool]$DeployToDev
        EnvironmentUrl             = if ($DeployToDev) { $EnvironmentUrl } else { $null }
        ArtifactSummary            = $artifactSummary
    }

    Write-Host "`nPCF identity clone completed successfully." -ForegroundColor Green
    Write-Host "Target project : $targetRoot"
    Write-Host "Target control : $targetExpectedDataverseName"
    Write-Host "Version        : $InitialControlVersion"
    Write-Host "Migration log  : $migrationManifestPath"

    return $result
}
catch {
    if ($targetCreated -and -not $KeepTargetOnFailure -and -not [string]::IsNullOrWhiteSpace($targetRoot) -and (Test-Path -LiteralPath $targetRoot)) {
        Write-Host "`n--- Clone failed; removing incomplete target project ---" -ForegroundColor Yellow
        try {
            Remove-Item -LiteralPath $targetRoot -Recurse -Force
        }
        catch {
            Write-Warning "Failed to remove incomplete target '$targetRoot': $($_.Exception.Message)"
        }
    }

    throw
}
