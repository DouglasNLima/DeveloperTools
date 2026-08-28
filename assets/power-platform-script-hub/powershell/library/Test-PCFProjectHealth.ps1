<#
.SYNOPSIS
    Inspects a local PCF project for release-health issues without changing it.

.DESCRIPTION
    Validates the relationships between ControlManifest.Input.xml, the PCF project, the Dataverse
    solution project, Solution.xml, package.json and package-lock.json. It also records relevant
    locally installed tooling versions where the commands are available.

    The script is local-only and read-only.

    Execution context: local-only.
    Safety classification: LOCAL_ONLY_READ_ONLY.

.PARAMETER ProjectRoot
    Root folder containing one PCF project and one Dataverse solution project.

.PARAMETER JsonOutputPath
    Optional JSON report path. The parent directory must already exist.

.PARAMETER SummaryOutputPath
    Optional text summary path. The parent directory must already exist.

.EXAMPLE
    .\Test-PCFProjectHealth.ps1 -ProjectRoot 'C:\Projects\SamplePcf'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ProjectRoot,

    [Parameter()]
    [string]$JsonOutputPath,

    [Parameter()]
    [string]$SummaryOutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RequiredDirectory {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "ProjectRoot was not found or is not a directory: '$Path'."
    }
    return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
}

function Get-SingleProjectFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Filter,
        [Parameter(Mandatory)][string]$Description
    )

    $ignored = '[\\/](node_modules|bin|obj|out|artifacts|\.git|coverage|TestResults)[\\/]'
    $files = @(
        Get-ChildItem -LiteralPath $Root -Filter $Filter -File -Recurse -ErrorAction Stop |
            Where-Object { $_.FullName -notmatch $ignored } |
            Sort-Object FullName
    )
    if ($files.Count -ne 1) {
        $paths = if ($files.Count -gt 0) { [Environment]::NewLine + (($files.FullName) -join [Environment]::NewLine) } else { '' }
        throw "Expected exactly one $Description below '$Root', but found $($files.Count).$paths"
    }
    return $files[0]
}

function Get-SingleFileByName {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Description
    )

    $ignored = '[\\/](node_modules|bin|obj|out|artifacts|\.git|coverage|TestResults)[\\/]'
    $files = @(
        Get-ChildItem -LiteralPath $Root -Filter $Name -File -Recurse -ErrorAction Stop |
            Where-Object { $_.FullName -notmatch $ignored } |
            Sort-Object FullName
    )
    if ($files.Count -ne 1) {
        throw "Expected exactly one $Description below '$Root', but found $($files.Count)."
    }
    return $files[0]
}

function Get-XmlNodeText {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][System.Xml.XmlNode]$Parent,
        [Parameter(Mandatory)][string]$LocalName
    )
    $node = $Parent.SelectSingleNode(".//*[local-name()='$LocalName']")
    if ($node) { return [string]$node.InnerText }
    return $null
}

function Get-MsBuildProperty {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ProjectFile,
        [Parameter(Mandatory)][string]$Name
    )

    [xml]$xml = Get-Content -LiteralPath $ProjectFile -Raw
    $node = $xml.SelectSingleNode("//*[local-name()='$Name']")
    if ($node) { return [string]$node.InnerText }
    return $null
}

function Invoke-LocalVersionProbe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string[]]$Arguments
    )

    $command = Get-Command "$Name.cmd", "$Name.exe", $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) {
        return [ordered]@{ name=$Name; state='NOT_FOUND'; version=$null; path=$null }
    }

    $path = if ($command.Source) { $command.Source } elseif ($command.Definition) { $command.Definition } else { $command.Name }
    $previousPreference = $ErrorActionPreference
    $nativePreference = Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $previousNative = $null
    try {
        $ErrorActionPreference = 'Continue'
        if ($nativePreference) {
            $previousNative = $PSNativeCommandUseErrorActionPreference
            $PSNativeCommandUseErrorActionPreference = $false
        }
        $raw = & $path @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
        if ($nativePreference) { $PSNativeCommandUseErrorActionPreference = $previousNative }
    }

    $text = (@($raw) -join ' ').Trim()
    [ordered]@{
        name = $Name
        state = if ($exitCode -eq 0) { 'PRESENT' } else { 'ERROR' }
        version = if ($exitCode -eq 0) { $text.TrimStart('v') } else { $null }
        path = $path
        exitCode = [int]$exitCode
    }
}

function Write-Utf8NoBomText {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][AllowEmptyString()][string]$Content)

    $parent = Split-Path -Path ([IO.Path]::GetFullPath($Path)) -Parent
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        throw "Output parent directory does not exist: '$parent'."
    }
    [IO.File]::WriteAllText([IO.Path]::GetFullPath($Path), $Content, [Text.UTF8Encoding]::new($false))
}

function Add-Finding {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][System.Collections.Generic.List[object]]$List,
        [Parameter(Mandatory)][ValidateSet('PASS','WARNING','ERROR','INFO')][string]$Severity,
        [Parameter(Mandatory)][string]$Check,
        [Parameter(Mandatory)][string]$Message
    )
    $List.Add([ordered]@{ severity=$Severity; check=$Check; message=$Message }) | Out-Null
}

$resolvedRoot = Get-RequiredDirectory -Path $ProjectRoot
$pcfProject = Get-SingleProjectFile -Root $resolvedRoot -Filter '*.pcfproj' -Description 'PCF project (*.pcfproj)'
$cdsProject = Get-SingleProjectFile -Root $resolvedRoot -Filter '*.cdsproj' -Description 'Dataverse solution project (*.cdsproj)'
$manifestFile = Get-SingleFileByName -Root $pcfProject.Directory.FullName -Name 'ControlManifest.Input.xml' -Description 'ControlManifest.Input.xml'

$solutionXmlCandidates = @(
    Get-ChildItem -LiteralPath $resolvedRoot -Filter 'Solution.xml' -File -Recurse -ErrorAction Stop |
        Where-Object { $_.FullName -notmatch '[\\/](bin|obj|out|artifacts|\.git)[\\/]' } |
        Sort-Object FullName
)
if ($solutionXmlCandidates.Count -ne 1) {
    throw "Expected exactly one source Solution.xml below '$resolvedRoot', but found $($solutionXmlCandidates.Count)."
}
$solutionXmlFile = $solutionXmlCandidates[0]

$packageJsonPath = Join-Path $pcfProject.Directory.FullName 'package.json'
$packageLockPath = Join-Path $pcfProject.Directory.FullName 'package-lock.json'
if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
    throw "package.json was not found beside the PCF project at '$packageJsonPath'."
}

[xml]$manifestXml = Get-Content -LiteralPath $manifestFile.FullName -Raw
$control = $manifestXml.SelectSingleNode("/*[local-name()='manifest']/*[local-name()='control']")
if (-not $control) { throw "ControlManifest.Input.xml does not contain a control element." }

$controlNamespace = if ($control.Attributes['namespace']) { [string]$control.Attributes['namespace'].Value } else { $null }
$controlConstructor = if ($control.Attributes['constructor']) { [string]$control.Attributes['constructor'].Value } else { $null }
$controlVersion = if ($control.Attributes['version']) { [string]$control.Attributes['version'].Value } else { $null }
if ([string]::IsNullOrWhiteSpace($controlNamespace) -or [string]::IsNullOrWhiteSpace($controlConstructor) -or [string]::IsNullOrWhiteSpace($controlVersion)) {
    throw 'The PCF control manifest must define namespace, constructor and version.'
}

[xml]$solutionXml = Get-Content -LiteralPath $solutionXmlFile.FullName -Raw
$solutionManifest = $solutionXml.SelectSingleNode("/*[local-name()='ImportExportXml']/*[local-name()='SolutionManifest']")
if (-not $solutionManifest) { throw 'Solution.xml does not contain a SolutionManifest element.' }

$solutionUniqueNameNode = $solutionManifest.SelectSingleNode("*[local-name()='UniqueName']")
$solutionVersionNode = $solutionManifest.SelectSingleNode("*[local-name()='Version']")
$publisherPrefixNode = $solutionManifest.SelectSingleNode("*[local-name()='Publisher']/*[local-name()='CustomizationPrefix']")
$solutionUniqueName = if ($solutionUniqueNameNode) { [string]$solutionUniqueNameNode.InnerText } else { $null }
$solutionVersion = if ($solutionVersionNode) { [string]$solutionVersionNode.InnerText } else { $null }
$publisherPrefix = if ($publisherPrefixNode) { [string]$publisherPrefixNode.InnerText } else { $null }

$pcfBuildMode = Get-MsBuildProperty -ProjectFile $pcfProject.FullName -Name 'PcfBuildMode'
$pcfProjectName = Get-MsBuildProperty -ProjectFile $pcfProject.FullName -Name 'Name'
$pcfProjectGuid = Get-MsBuildProperty -ProjectFile $pcfProject.FullName -Name 'ProjectGuid'
$solutionPackageType = Get-MsBuildProperty -ProjectFile $cdsProject.FullName -Name 'SolutionPackageType'
$solutionProjectGuid = Get-MsBuildProperty -ProjectFile $cdsProject.FullName -Name 'ProjectGuid'

[xml]$cdsXml = Get-Content -LiteralPath $cdsProject.FullName -Raw
$pcfReferences = @(
    $cdsXml.SelectNodes("//*[local-name()='ProjectReference']") |
        Where-Object { ([string]$_.Attributes['Include'].Value) -match '\.pcfproj$' }
)
$referenceDetails = @(
    foreach ($reference in $pcfReferences) {
        $include = [string]$reference.Attributes['Include'].Value
        $full = [IO.Path]::GetFullPath((Join-Path $cdsProject.Directory.FullName $include))
        [ordered]@{
            include = $include
            resolvedPath = $full
            exists = Test-Path -LiteralPath $full -PathType Leaf
            matchesDiscoveredPcf = $full.Equals($pcfProject.FullName, [StringComparison]::OrdinalIgnoreCase)
        }
    }
)

$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$packageLock = if (Test-Path -LiteralPath $packageLockPath -PathType Leaf) { Get-Content -LiteralPath $packageLockPath -Raw | ConvertFrom-Json } else { $null }

$findings = [System.Collections.Generic.List[object]]::new()

if ($pcfBuildMode -eq 'production') {
    Add-Finding -List $findings -Severity PASS -Check 'PcfBuildMode' -Message 'PCF project is configured for production builds.'
} else {
    Add-Finding -List $findings -Severity ERROR -Check 'PcfBuildMode' -Message "Expected PcfBuildMode=production; found '$pcfBuildMode'."
}

if ($solutionPackageType -eq 'Both') {
    Add-Finding -List $findings -Severity PASS -Check 'SolutionPackageType' -Message 'Solution project is configured to build both managed and unmanaged packages.'
} elseif ($solutionPackageType -in @('Managed','Unmanaged')) {
    Add-Finding -List $findings -Severity WARNING -Check 'SolutionPackageType' -Message "SolutionPackageType is '$solutionPackageType', so managed/unmanaged parity cannot be validated from a single build."
} else {
    Add-Finding -List $findings -Severity ERROR -Check 'SolutionPackageType' -Message "SolutionPackageType is missing or unsupported: '$solutionPackageType'."
}

if ($packageLock) {
    Add-Finding -List $findings -Severity PASS -Check 'package-lock.json' -Message 'package-lock.json is present.'
} else {
    Add-Finding -List $findings -Severity ERROR -Check 'package-lock.json' -Message 'package-lock.json is missing; npm restore is not dependency-deterministic.'
}

if ($pcfReferences.Count -eq 1 -and $referenceDetails[0].matchesDiscoveredPcf -and $referenceDetails[0].exists) {
    Add-Finding -List $findings -Severity PASS -Check 'ProjectReference' -Message 'Dataverse solution project references the discovered PCF project.'
} else {
    Add-Finding -List $findings -Severity ERROR -Check 'ProjectReference' -Message "Expected exactly one valid PCF ProjectReference to '$($pcfProject.FullName)'; found $($pcfReferences.Count)."
}

$controlVersionParts = @($controlVersion.Split('.'))
$solutionVersionParts = if ($solutionVersion) { @($solutionVersion.Split('.')) } else { @() }
if ($controlVersionParts.Count -eq 3 -and $solutionVersionParts.Count -ge 3 -and (($controlVersionParts -join '.') -eq (($solutionVersionParts[0..2]) -join '.'))) {
    Add-Finding -List $findings -Severity PASS -Check 'VersionAlignment' -Message 'Control version matches the first three parts of the solution version.'
} else {
    Add-Finding -List $findings -Severity WARNING -Check 'VersionAlignment' -Message "Control version '$controlVersion' and solution version '$solutionVersion' are not aligned on major.minor.build."
}

if ([string]::IsNullOrWhiteSpace($publisherPrefix)) {
    Add-Finding -List $findings -Severity ERROR -Check 'PublisherPrefix' -Message 'Solution publisher customisation prefix is missing.'
} else {
    Add-Finding -List $findings -Severity PASS -Check 'PublisherPrefix' -Message "Solution publisher prefix is '$publisherPrefix'."
}

$npmScripts = @()
if ($packageJson.PSObject.Properties['scripts']) {
    $npmScripts = @($packageJson.scripts.PSObject.Properties.Name | Sort-Object)
}
foreach ($requiredScript in @('build')) {
    if ($npmScripts -contains $requiredScript) {
        Add-Finding -List $findings -Severity PASS -Check "npm:$requiredScript" -Message "package.json defines '$requiredScript'."
    } else {
        Add-Finding -List $findings -Severity ERROR -Check "npm:$requiredScript" -Message "package.json does not define '$requiredScript'."
    }
}
foreach ($recommendedScript in @('clean','lint')) {
    if ($npmScripts -contains $recommendedScript) {
        Add-Finding -List $findings -Severity PASS -Check "npm:$recommendedScript" -Message "package.json defines '$recommendedScript'."
    } else {
        Add-Finding -List $findings -Severity WARNING -Check "npm:$recommendedScript" -Message "package.json does not define the recommended '$recommendedScript' script."
    }
}

$nugetRanges = [System.Collections.Generic.List[object]]::new()
foreach ($project in @($pcfProject, $cdsProject)) {
    [xml]$projectXml = Get-Content -LiteralPath $project.FullName -Raw
    foreach ($reference in @($projectXml.SelectNodes("//*[local-name()='PackageReference']"))) {
        $include = if ($reference.Attributes['Include']) { [string]$reference.Attributes['Include'].Value } else { $null }
        $version = if ($reference.Attributes['Version']) { [string]$reference.Attributes['Version'].Value } else {
            $versionNode = $reference.SelectSingleNode("*[local-name()='Version']")
            if ($versionNode) { [string]$versionNode.InnerText } else { $null }
        }
        if ($version -match '[\*\[\]\(\),]') {
            $nugetRanges.Add([ordered]@{ project=$project.Name; package=$include; version=$version }) | Out-Null
        }
    }
}
if ($nugetRanges.Count -gt 0) {
    Add-Finding -List $findings -Severity WARNING -Check 'NuGetDeterminism' -Message "$($nugetRanges.Count) floating/ranged NuGet reference(s) were detected."
} else {
    Add-Finding -List $findings -Severity PASS -Check 'NuGetDeterminism' -Message 'No floating/ranged NuGet PackageReference versions were detected.'
}

$packageLockVersion = if ($packageLock -and $packageLock.PSObject.Properties['lockfileVersion']) { $packageLock.lockfileVersion } else { $null }
$tooling = @(
    Invoke-LocalVersionProbe -Name 'node' -Arguments @('--version')
    Invoke-LocalVersionProbe -Name 'npm' -Arguments @('--version')
    Invoke-LocalVersionProbe -Name 'dotnet' -Arguments @('--version')
    Invoke-LocalVersionProbe -Name 'pac' -Arguments @('--version')
)

$errors = @($findings | Where-Object { $_.severity -eq 'ERROR' })
$warnings = @($findings | Where-Object { $_.severity -eq 'WARNING' })
$classification = if ($errors.Count -gt 0) { 'BLOCKED' } elseif ($warnings.Count -gt 0) { 'HEALTHY_WITH_WARNINGS' } else { 'HEALTHY' }

$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{ name='Test-PCFProjectHealth'; version='1.0.0'; maturity='Experimental' }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'LOCAL_ONLY'
    safetyClassification = 'LOCAL_ONLY_READ_ONLY'
    project = [ordered]@{
        root = $resolvedRoot
        pcfProject = $pcfProject.FullName
        cdsProject = $cdsProject.FullName
        manifest = $manifestFile.FullName
        solutionXml = $solutionXmlFile.FullName
        packageJson = $packageJsonPath
        packageLock = if ($packageLock) { $packageLockPath } else { $null }
    }
    control = [ordered]@{
        namespace = $controlNamespace
        constructor = $controlConstructor
        identity = "$controlNamespace.$controlConstructor"
        version = $controlVersion
        pcfProjectName = $pcfProjectName
        pcfProjectGuid = $pcfProjectGuid
        buildMode = $pcfBuildMode
    }
    solution = [ordered]@{
        uniqueName = $solutionUniqueName
        version = $solutionVersion
        publisherPrefix = $publisherPrefix
        solutionPackageType = $solutionPackageType
        solutionProjectGuid = $solutionProjectGuid
    }
    projectReferences = $referenceDetails
    package = [ordered]@{
        npmPackageName = if ($packageJson.PSObject.Properties['name']) { [string]$packageJson.name } else { $null }
        npmPackageVersion = if ($packageJson.PSObject.Properties['version']) { [string]$packageJson.version } else { $null }
        npmScripts = $npmScripts
        packageLockPresent = [bool]$packageLock
        packageLockVersion = $packageLockVersion
    }
    tooling = $tooling
    floatingOrRangedNuGetReferences = @($nugetRanges)
    findings = @($findings)
    limitations = @(
        'This script validates local project relationships and configuration; it does not build or package the PCF.',
        'Tool version presence is reported, but compatibility with every future Microsoft tooling release is not inferred.',
        'Publisher-prefix reporting does not assume that a PCF namespace must equal the Dataverse publisher prefix.'
    )
    summary = [ordered]@{
        classification = $classification
        errors = $errors.Count
        warnings = $warnings.Count
        controlIdentity = "$controlNamespace.$controlConstructor"
        controlVersion = $controlVersion
        solutionUniqueName = $solutionUniqueName
        solutionVersion = $solutionVersion
    }
}

$json = $report | ConvertTo-Json -Depth 20
$summary = @"
PCF project health
Project: $resolvedRoot
Control: $controlNamespace.$controlConstructor $controlVersion
Solution: $solutionUniqueName $solutionVersion
Classification: $classification
Errors: $($errors.Count)
Warnings: $($warnings.Count)
Local mutation performed: NO
"@

if ($JsonOutputPath) { Write-Utf8NoBomText -Path $JsonOutputPath -Content $json }
if ($SummaryOutputPath) { Write-Utf8NoBomText -Path $SummaryOutputPath -Content $summary }
Write-Host $summary
return $report
