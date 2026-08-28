<#
.SYNOPSIS
    Validates generated managed and/or unmanaged PCF solution packages without importing them.

.DESCRIPTION
    Inspects Dataverse solution ZIP artefacts, packaged PCF manifests and resources. It validates
    solution/control identity and versions, package managed flags, resource presence, SHA-256 hashes,
    development/debug indicators and managed/unmanaged resource parity where both packages are supplied.

    Execution context: local-only.
    Safety classification: LOCAL_ONLY_READ_ONLY.

.PARAMETER ManagedPackagePath
    Optional managed solution ZIP.

.PARAMETER UnmanagedPackagePath
    Optional unmanaged solution ZIP. Supply at least one package path.

.PARAMETER ExpectedControlIdentity
    Optional expected packaged identity. It may match either the type-66 RootComponent schema name
    or the PCF manifest namespace.constructor value.

.PARAMETER ExpectedControlVersion
    Optional expected three-part PCF control version.

.PARAMETER ExpectedSolutionVersion
    Optional expected Dataverse solution version.

.PARAMETER FailOnBlocked
    Throw after writing/printing the report if release validation is BLOCKED.

.EXAMPLE
    .\Test-PCFReleasePackage.ps1 `
        -ManagedPackagePath '.\Sample_managed.zip' `
        -UnmanagedPackagePath '.\Sample.zip' `
        -ExpectedControlVersion '1.2.3'
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string]$ManagedPackagePath,

    [Parameter()]
    [string]$UnmanagedPackagePath,

    [Parameter()]
    [string]$ExpectedControlIdentity,

    [Parameter()]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$ExpectedControlVersion,

    [Parameter()]
    [ValidatePattern('^\d+\.\d+\.\d+(?:\.\d+)?$')]
    [string]$ExpectedSolutionVersion,

    [Parameter()]
    [switch]$FailOnBlocked,

    [Parameter()]
    [string]$JsonOutputPath,

    [Parameter()]
    [string]$SummaryOutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-ZipPath {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Description)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Description was not found at '$Path'."
    }
    $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
    if ([IO.Path]::GetExtension($resolved) -ine '.zip') {
        throw "$Description must be a .zip file. Received '$resolved'."
    }
    return $resolved
}

function Read-ZipEntryText {
    [CmdletBinding()]
    param([Parameter(Mandatory)][System.IO.Compression.ZipArchiveEntry]$Entry)
    $stream = $Entry.Open()
    $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8, $true)
    try { return $reader.ReadToEnd() }
    finally { $reader.Dispose(); $stream.Dispose() }
}

function Get-ZipEntrySha256 {
    [CmdletBinding()]
    param([Parameter(Mandatory)][System.IO.Compression.ZipArchiveEntry]$Entry)
    $stream = $Entry.Open()
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash($stream)
        return ([BitConverter]::ToString($hash)).Replace('-','').ToLowerInvariant()
    }
    finally { $sha.Dispose(); $stream.Dispose() }
}

function Get-ZipEntry {
    [CmdletBinding()]
    param([Parameter(Mandatory)][System.IO.Compression.ZipArchive]$Archive, [Parameter(Mandatory)][string]$Name)
    return $Archive.Entries | Where-Object { $_.FullName -ieq $Name } | Select-Object -First 1
}

function Add-Finding {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][System.Collections.Generic.List[object]]$List,
        [Parameter(Mandatory)][ValidateSet('ERROR','WARNING','INFO','PASS')][string]$Severity,
        [Parameter(Mandatory)][string]$Code,
        [Parameter(Mandatory)][string]$Message,
        [AllowNull()][object]$Details
    )
    $List.Add([ordered]@{ severity=$Severity; code=$Code; message=$Message; details=$Details }) | Out-Null
}

function Write-Utf8NoBomText {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][AllowEmptyString()][string]$Content)
    $full = [IO.Path]::GetFullPath($Path)
    $parent = Split-Path -Path $full -Parent
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        throw "Output parent directory does not exist: '$parent'."
    }
    [IO.File]::WriteAllText($full, $Content, [Text.UTF8Encoding]::new($false))
}

function Get-PackageInspection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][ValidateSet('Managed','Unmanaged')][string]$ExpectedPackageType
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $findings = [System.Collections.Generic.List[object]]::new()
        $solutionEntries = @($archive.Entries | Where-Object { $_.FullName -match '(^|/)solution\.xml$' } | Sort-Object FullName)
        if ($solutionEntries.Count -ne 1) {
            throw "Expected exactly one solution.xml in '$Path', but found $($solutionEntries.Count)."
        }

        [xml]$solutionXml = Read-ZipEntryText -Entry $solutionEntries[0]
        $manifest = $solutionXml.SelectSingleNode("/*[local-name()='ImportExportXml']/*[local-name()='SolutionManifest']")
        if (-not $manifest) { throw "solution.xml in '$Path' has no SolutionManifest." }

        function ChildText([System.Xml.XmlNode]$Parent,[string]$Name) {
            $node = $Parent.SelectSingleNode("*[local-name()='$Name']")
            if ($node) { return [string]$node.InnerText }
            return $null
        }

        $uniqueName = ChildText $manifest 'UniqueName'
        $solutionVersion = ChildText $manifest 'Version'
        $managedRaw = ChildText $manifest 'Managed'
        $managed = switch ($managedRaw) { '1' { $true } '0' { $false } default { $null } }

        $expectedManaged = $ExpectedPackageType -eq 'Managed'
        if ($null -eq $managed) {
            Add-Finding -List $findings -Severity ERROR -Code 'PACKAGE_MANAGED_FLAG_UNKNOWN' -Message "Managed flag '$managedRaw' could not be interpreted." -Details $null
        }
        elseif ($managed -ne $expectedManaged) {
            Add-Finding -List $findings -Severity ERROR -Code 'PACKAGE_MANAGED_FLAG_MISMATCH' -Message "$ExpectedPackageType package has Managed=$managed." -Details @{ expectedManaged=$expectedManaged; actualManaged=$managed }
        }
        else {
            Add-Finding -List $findings -Severity PASS -Code 'PACKAGE_MANAGED_FLAG' -Message "$ExpectedPackageType package managed flag is correct." -Details $null
        }

        if ($ExpectedSolutionVersion -and $solutionVersion -ne $ExpectedSolutionVersion) {
            Add-Finding -List $findings -Severity ERROR -Code 'SOLUTION_VERSION_MISMATCH' -Message "Solution version '$solutionVersion' does not match expected '$ExpectedSolutionVersion'." -Details $null
        }

        $rootComponents = @(
            $manifest.SelectNodes(".//*[local-name()='RootComponents']/*[local-name()='RootComponent']") |
                ForEach-Object {
                    [ordered]@{
                        type = if ($_.Attributes['type']) { [int]$_.Attributes['type'].Value } else { $null }
                        schemaName = if ($_.Attributes['schemaName']) { [string]$_.Attributes['schemaName'].Value } else { $null }
                        id = if ($_.Attributes['id']) { ([string]$_.Attributes['id'].Value).Trim('{','}').ToLowerInvariant() } else { $null }
                    }
                } |
                Sort-Object type, schemaName, id
        )
        $pcfRoots = @($rootComponents | Where-Object { $_.type -eq 66 } | Sort-Object schemaName, id)

        $controlResults = [System.Collections.Generic.List[object]]::new()
        $resourceResults = [System.Collections.Generic.List[object]]::new()
        $manifestEntries = @($archive.Entries | Where-Object { $_.FullName -match '(^|/)Controls/.+/ControlManifest\.xml$' } | Sort-Object FullName)

        if ($manifestEntries.Count -eq 0) {
            Add-Finding -List $findings -Severity ERROR -Code 'NO_PCF_MANIFESTS' -Message 'No packaged PCF ControlManifest.xml entries were found below Controls/.' -Details $null
        }

        foreach ($manifestEntry in $manifestEntries) {
            [xml]$controlXml = Read-ZipEntryText -Entry $manifestEntry
            $control = $controlXml.SelectSingleNode("/*[local-name()='manifest']/*[local-name()='control']")
            if (-not $control) {
                Add-Finding -List $findings -Severity ERROR -Code 'INVALID_PCF_MANIFEST' -Message "Manifest '$($manifestEntry.FullName)' has no control element." -Details $null
                continue
            }

            $namespace = if ($control.Attributes['namespace']) { [string]$control.Attributes['namespace'].Value } else { $null }
            $constructor = if ($control.Attributes['constructor']) { [string]$control.Attributes['constructor'].Value } else { $null }
            $controlVersion = if ($control.Attributes['version']) { [string]$control.Attributes['version'].Value } else { $null }
            $identity = if ($namespace -and $constructor) { "$namespace.$constructor" } else { $null }

            if ($ExpectedControlVersion -and $controlVersion -ne $ExpectedControlVersion) {
                Add-Finding -List $findings -Severity ERROR -Code 'CONTROL_VERSION_MISMATCH' -Message "Control '$identity' has version '$controlVersion'; expected '$ExpectedControlVersion'." -Details @{ manifest=$manifestEntry.FullName }
            }

            $base = $manifestEntry.FullName.Substring(0, $manifestEntry.FullName.LastIndexOf('/') + 1)
            $resourceNodes = @(
                $control.SelectNodes(".//*[local-name()='resources']/*") |
                    Where-Object { $_.Attributes['path'] }
            )
            $controlResourceCount = 0
            $javascriptCount = 0
            $cssCount = 0
            $bundleCount = 0

            foreach ($resourceNode in $resourceNodes) {
                $resourcePath = ([string]$resourceNode.Attributes['path'].Value).Replace('\','/')
                $entryPath = $base + $resourcePath.TrimStart('/')
                $entry = Get-ZipEntry -Archive $archive -Name $entryPath
                $kind = [string]$resourceNode.LocalName
                if (-not $entry) {
                    Add-Finding -List $findings -Severity ERROR -Code 'DECLARED_RESOURCE_MISSING' -Message "Control '$identity' declares '$resourcePath', but '$entryPath' is missing." -Details @{ resourceType=$kind }
                    continue
                }

                $controlResourceCount++
                $extension = [IO.Path]::GetExtension($entry.FullName).ToLowerInvariant()
                if ($extension -eq '.js') { $javascriptCount++ }
                if ($extension -eq '.css') { $cssCount++ }
                if ($entry.Name -ieq 'bundle.js' -or $entry.FullName -match '(?i)(^|/)bundle\.js$') { $bundleCount++ }

                $developmentMarker = $null
                if ($extension -eq '.js' -and $entry.Length -gt 0) {
                    $javascript = Read-ZipEntryText -Entry $entry
                    foreach ($marker in @('ATTENTION: The "eval" devtool has been used','//# sourceURL=webpack://','eval(__webpack_require__')) {
                        if ($javascript.IndexOf($marker, [StringComparison]::Ordinal) -ge 0) {
                            $developmentMarker = $marker
                            break
                        }
                    }
                }

                if ($developmentMarker) {
                    Add-Finding -List $findings -Severity ERROR -Code 'DEVELOPMENT_BUNDLE_MARKER' -Message "Resource '$entryPath' contains a development-build marker." -Details @{ marker=$developmentMarker }
                }
                if ($entry.Length -le 0) {
                    Add-Finding -List $findings -Severity ERROR -Code 'EMPTY_RESOURCE' -Message "Resource '$entryPath' is empty." -Details $null
                }

                $resourceResults.Add([ordered]@{
                    controlIdentity = $identity
                    resourceType = $kind
                    resourcePath = $resourcePath
                    packageEntry = $entry.FullName
                    bytes = [long]$entry.Length
                    sha256 = Get-ZipEntrySha256 -Entry $entry
                    developmentMarker = $developmentMarker
                }) | Out-Null
            }

            if ($bundleCount -eq 0) {
                Add-Finding -List $findings -Severity WARNING -Code 'BUNDLE_JS_NOT_IDENTIFIED' -Message "No declared bundle.js resource was identified for control '$identity'." -Details $null
            } else {
                Add-Finding -List $findings -Severity PASS -Code 'BUNDLE_JS_PRESENT' -Message "Control '$identity' contains bundle.js." -Details @{ count=$bundleCount }
            }
            if ($cssCount -eq 0) {
                Add-Finding -List $findings -Severity INFO -Code 'NO_CSS_RESOURCE' -Message "Control '$identity' declares no CSS resource. This can be valid for controls that do not require CSS." -Details $null
            }
            if ($controlResourceCount -eq 0) {
                Add-Finding -List $findings -Severity ERROR -Code 'NO_DECLARED_RESOURCES' -Message "Control '$identity' has no resolved package resources." -Details $null
            }

            $controlResults.Add([ordered]@{
                namespace = $namespace
                constructor = $constructor
                manifestIdentity = $identity
                version = $controlVersion
                manifestEntry = $manifestEntry.FullName
                resourceCount = $controlResourceCount
                javascriptResources = $javascriptCount
                cssResources = $cssCount
                bundleResources = $bundleCount
            }) | Out-Null
        }

        $developmentArtifacts = @(
            $archive.Entries |
                Where-Object {
                    $_.FullName -match '(?i)(^|/)(node_modules|coverage|TestResults|\.git)(/|$)' -or
                    $_.FullName -match '(?i)\.(pdb|map|ts|tsx)$'
                } |
                ForEach-Object { [ordered]@{ path=$_.FullName; bytes=[long]$_.Length } } |
                Sort-Object path
        )
        if ($developmentArtifacts.Count -gt 0) {
            Add-Finding -List $findings -Severity WARNING -Code 'DEVELOPMENT_ARTEFACTS_PRESENT' -Message "$($developmentArtifacts.Count) development/debug artefact(s) were found in the package." -Details @{ files=@($developmentArtifacts.path) }
        }

        if ($ExpectedControlIdentity) {
            $identities = @(
                @($pcfRoots.schemaName) + @($controlResults.manifestIdentity) |
                    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
                    Sort-Object -Unique
            )
            if (@($identities | Where-Object { $_.Equals($ExpectedControlIdentity, [StringComparison]::OrdinalIgnoreCase) }).Count -eq 0) {
                Add-Finding -List $findings -Severity ERROR -Code 'CONTROL_IDENTITY_MISMATCH' -Message "Expected control identity '$ExpectedControlIdentity' was not found." -Details @{ identities=$identities }
            }
        }

        $allEntries = @(
            $archive.Entries |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_.Name) } |
                ForEach-Object {
                    [ordered]@{
                        path = $_.FullName
                        bytes = [long]$_.Length
                        sha256 = Get-ZipEntrySha256 -Entry $_
                    }
                } |
                Sort-Object path
        )
        $controlEntries = @($allEntries | Where-Object { $_.path -match '^(?i)Controls/' })

        return [ordered]@{
            expectedPackageType = $ExpectedPackageType
            path = $Path
            packageSha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
            packageBytes = (Get-Item -LiteralPath $Path).Length
            solutionUniqueName = $uniqueName
            solutionVersion = $solutionVersion
            managed = $managed
            managedRaw = $managedRaw
            rootComponents = $rootComponents
            pcfRootComponents = $pcfRoots
            controls = @($controlResults | Sort-Object manifestIdentity, manifestEntry)
            resources = @($resourceResults | Sort-Object controlIdentity, resourcePath)
            developmentArtifacts = $developmentArtifacts
            controlEntries = $controlEntries
            entryCount = $allEntries.Count
            findings = @($findings)
        }
    }
    finally {
        $archive.Dispose()
    }
}

if (-not $ManagedPackagePath -and -not $UnmanagedPackagePath) {
    throw 'Supply -ManagedPackagePath, -UnmanagedPackagePath, or both.'
}

$managedPath = if ($ManagedPackagePath) { Resolve-ZipPath -Path $ManagedPackagePath -Description 'Managed package' } else { $null }
$unmanagedPath = if ($UnmanagedPackagePath) { Resolve-ZipPath -Path $UnmanagedPackagePath -Description 'Unmanaged package' } else { $null }

if ($managedPath -and $unmanagedPath -and $managedPath.Equals($unmanagedPath, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'ManagedPackagePath and UnmanagedPackagePath cannot refer to the same file.'
}

$managed = if ($managedPath) { Get-PackageInspection -Path $managedPath -ExpectedPackageType Managed } else { $null }
$unmanaged = if ($unmanagedPath) { Get-PackageInspection -Path $unmanagedPath -ExpectedPackageType Unmanaged } else { $null }

$findings = [System.Collections.Generic.List[object]]::new()
if ($managed) { foreach ($finding in $managed.findings) { $findings.Add([ordered]@{ package='Managed'; severity=$finding.severity; code=$finding.code; message=$finding.message; details=$finding.details }) | Out-Null } }
if ($unmanaged) { foreach ($finding in $unmanaged.findings) { $findings.Add([ordered]@{ package='Unmanaged'; severity=$finding.severity; code=$finding.code; message=$finding.message; details=$finding.details }) | Out-Null } }

$parity = [ordered]@{
    state = if ($managed -and $unmanaged) { 'ASSESSED' } else { 'NOT_APPLICABLE' }
    solutionIdentityMatch = $null
    solutionVersionMatch = $null
    controlEntriesOnlyManaged = @()
    controlEntriesOnlyUnmanaged = @()
    controlEntryHashDrift = @()
}

if ($managed -and $unmanaged) {
    $parity.solutionIdentityMatch = $managed.solutionUniqueName -eq $unmanaged.solutionUniqueName
    $parity.solutionVersionMatch = $managed.solutionVersion -eq $unmanaged.solutionVersion

    if (-not $parity.solutionIdentityMatch) {
        Add-Finding -List $findings -Severity ERROR -Code 'MANAGED_UNMANAGED_SOLUTION_IDENTITY_DRIFT' -Message 'Managed and unmanaged packages have different solution unique names.' -Details @{ managed=$managed.solutionUniqueName; unmanaged=$unmanaged.solutionUniqueName }
    }
    if (-not $parity.solutionVersionMatch) {
        Add-Finding -List $findings -Severity ERROR -Code 'MANAGED_UNMANAGED_SOLUTION_VERSION_DRIFT' -Message 'Managed and unmanaged packages have different solution versions.' -Details @{ managed=$managed.solutionVersion; unmanaged=$unmanaged.solutionVersion }
    }

    $managedMap = @{}
    foreach ($entry in $managed.controlEntries) { $managedMap[$entry.path.ToLowerInvariant()] = $entry }
    $unmanagedMap = @{}
    foreach ($entry in $unmanaged.controlEntries) { $unmanagedMap[$entry.path.ToLowerInvariant()] = $entry }

    $onlyManaged = @($managedMap.Keys | Where-Object { -not $unmanagedMap.ContainsKey($_) } | Sort-Object)
    $onlyUnmanaged = @($unmanagedMap.Keys | Where-Object { -not $managedMap.ContainsKey($_) } | Sort-Object)
    $hashDrift = @(
        foreach ($key in @($managedMap.Keys | Where-Object { $unmanagedMap.ContainsKey($_) } | Sort-Object)) {
            if ($managedMap[$key].sha256 -ne $unmanagedMap[$key].sha256) {
                [ordered]@{
                    path = $managedMap[$key].path
                    managedSha256 = $managedMap[$key].sha256
                    unmanagedSha256 = $unmanagedMap[$key].sha256
                }
            }
        }
    )

    $parity.controlEntriesOnlyManaged = @($onlyManaged | ForEach-Object { $managedMap[$_].path })
    $parity.controlEntriesOnlyUnmanaged = @($onlyUnmanaged | ForEach-Object { $unmanagedMap[$_].path })
    $parity.controlEntryHashDrift = $hashDrift

    if ($onlyManaged.Count -gt 0 -or $onlyUnmanaged.Count -gt 0) {
        Add-Finding -List $findings -Severity ERROR -Code 'MANAGED_UNMANAGED_CONTROL_RESOURCE_SET_DRIFT' -Message 'Managed and unmanaged packages do not contain the same Controls/ entry set.' -Details @{ onlyManaged=$parity.controlEntriesOnlyManaged; onlyUnmanaged=$parity.controlEntriesOnlyUnmanaged }
    }
    if ($hashDrift.Count -gt 0) {
        Add-Finding -List $findings -Severity ERROR -Code 'MANAGED_UNMANAGED_CONTROL_RESOURCE_HASH_DRIFT' -Message "$($hashDrift.Count) Controls/ resource hash difference(s) were detected." -Details @{ differences=$hashDrift }
    }
    if ($onlyManaged.Count -eq 0 -and $onlyUnmanaged.Count -eq 0 -and $hashDrift.Count -eq 0) {
        Add-Finding -List $findings -Severity PASS -Code 'MANAGED_UNMANAGED_CONTROL_PARITY' -Message 'Managed and unmanaged Controls/ entries are byte-identical.' -Details $null
    }
}

$errors = @($findings | Where-Object { $_.severity -eq 'ERROR' })
$warnings = @($findings | Where-Object { $_.severity -eq 'WARNING' })
$classification = if ($errors.Count -gt 0) { 'BLOCKED' } elseif ($warnings.Count -gt 0) { 'RELEASE_WITH_WARNINGS' } else { 'RELEASE_VALIDATED' }

$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{ name='Test-PCFReleasePackage'; version='1.0.0'; maturity='Experimental' }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'LOCAL_ONLY'
    safetyClassification = 'LOCAL_ONLY_READ_ONLY'
    expected = [ordered]@{
        controlIdentity = if ($ExpectedControlIdentity) { $ExpectedControlIdentity } else { $null }
        controlVersion = if ($ExpectedControlVersion) { $ExpectedControlVersion } else { $null }
        solutionVersion = if ($ExpectedSolutionVersion) { $ExpectedSolutionVersion } else { $null }
    }
    managedPackage = $managed
    unmanagedPackage = $unmanaged
    parity = $parity
    findings = @($findings | Sort-Object package, severity, code, message)
    limitations = @(
        'This validator inspects packaged files only and does not import the solution.',
        'Absence of a CSS resource is informational because a PCF can legitimately require no CSS.',
        'Managed/unmanaged parity is restricted to packaged Controls/ entries because solution metadata is expected to differ by package type.',
        'Development-marker detection is conservative and cannot prove that all JavaScript was built with a particular bundler configuration.'
    )
    summary = [ordered]@{
        classification = $classification
        errors = $errors.Count
        warnings = $warnings.Count
        managedPackageAssessed = [bool]$managed
        unmanagedPackageAssessed = [bool]$unmanaged
        parityAssessed = [bool]($managed -and $unmanaged)
    }
}

$json = $report | ConvertTo-Json -Depth 30
$summary = @"
PCF release package validation
Classification: $classification
Errors: $($errors.Count)
Warnings: $($warnings.Count)
Managed package: $(if ($managed) { $managed.path } else { 'NOT SUPPLIED' })
Unmanaged package: $(if ($unmanaged) { $unmanaged.path } else { 'NOT SUPPLIED' })
Managed/unmanaged Controls parity assessed: $([bool]($managed -and $unmanaged))
Import performed: NO
"@

if ($JsonOutputPath) { Write-Utf8NoBomText -Path $JsonOutputPath -Content $json }
if ($SummaryOutputPath) { Write-Utf8NoBomText -Path $SummaryOutputPath -Content $summary }
Write-Host $summary

if ($FailOnBlocked -and $classification -eq 'BLOCKED') {
    throw "PCF release package validation is BLOCKED with $($errors.Count) error(s)."
}

return $report
