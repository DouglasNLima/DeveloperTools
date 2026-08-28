<#
.SYNOPSIS
    Compares two locally saved Power Platform environment snapshots.

.DESCRIPTION
    Performs a local-only comparison of JSON files produced by Get-PowerPlatformEnvironmentSnapshot.ps1.
    No network requests are made.

    Execution context: local-only.
    Safety classification: LOCAL_ONLY_READ_ONLY.

.PARAMETER ReferenceSnapshotPath
    Baseline/reference snapshot JSON file.

.PARAMETER DifferenceSnapshotPath
    Snapshot JSON file to compare against the reference.

.PARAMETER JsonOutputPath
    Optional JSON diff output path.

.PARAMETER SummaryOutputPath
    Optional Markdown summary output path.

.EXAMPLE
    .\Compare-PowerPlatformEnvironmentSnapshots.ps1 `
        -ReferenceSnapshotPath '.\qa.json' `
        -DifferenceSnapshotPath '.\prod.json' `
        -JsonOutputPath '.\qa-prod-diff.json' `
        -SummaryOutputPath '.\qa-prod-diff.md'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ReferenceSnapshotPath,

    [Parameter(Mandatory)]
    [string]$DifferenceSnapshotPath,

    [Parameter()]
    [string]$JsonOutputPath,

    [Parameter()]
    [string]$SummaryOutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RequiredFilePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [string]$Description = 'file'
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Description was not found at '$Path'."
    }

    return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
}

function Get-RequiredDirectoryPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [string]$Description = 'directory'
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Description was not found at '$Path'."
    }

    return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
}

function Get-ObjectPropertyValue {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [object]$InputObject,

        [Parameter(Mandatory)]
        [string]$Name
    )

    if ($null -eq $InputObject) {
        return $null
    }

    $property = $InputObject.PSObject.Properties[$Name]
    if ($property) {
        return $property.Value
    }

    return $null
}

function Write-Utf8NoBomText {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string]$Text
    )

    $fullPath = [IO.Path]::GetFullPath($Path)
    $parent = Split-Path -Path $fullPath -Parent
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        throw "Output parent directory does not exist: '$parent'."
    }

    [IO.File]::WriteAllText($fullPath, $Text, [Text.UTF8Encoding]::new($false))
    return $fullPath
}

function Write-ComparisonOutputs {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object]$Report,

        [Parameter(Mandatory)]
        [string]$SummaryText,

        [string]$JsonOutputPath,

        [string]$SummaryOutputPath
    )

    if (-not [string]::IsNullOrWhiteSpace($JsonOutputPath)) {
        [void](Write-Utf8NoBomText -Path $JsonOutputPath -Text (($Report | ConvertTo-Json -Depth 30) + [Environment]::NewLine))
    }
    if (-not [string]::IsNullOrWhiteSpace($SummaryOutputPath)) {
        [void](Write-Utf8NoBomText -Path $SummaryOutputPath -Text ($SummaryText.TrimEnd() + [Environment]::NewLine))
    }

    Write-Host $SummaryText
    return $Report
}

function ConvertTo-CanonicalScalar {
    [CmdletBinding()]
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) {
        return '<null>'
    }
    if ($Value -is [bool]) {
        return $Value.ToString().ToLowerInvariant()
    }
    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        return (@($Value) | ForEach-Object { ConvertTo-CanonicalScalar $_ } | Sort-Object) -join '|'
    }

    return [string]$Value
}


function Read-Snapshot {
    param([Parameter(Mandatory)][string]$Path)

    $resolved = Get-RequiredFilePath -Path $Path -Description 'Snapshot JSON'
    try {
        $snapshot = Get-Content -LiteralPath $resolved -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "Snapshot '$resolved' is not valid JSON: $($_.Exception.Message)"
    }

    $toolName = [string](Get-ObjectPropertyValue (Get-ObjectPropertyValue $snapshot 'tool') 'name')
    if ($toolName -ne 'Get-PowerPlatformEnvironmentSnapshot') {
        throw "Snapshot '$resolved' was created by '$toolName', not Get-PowerPlatformEnvironmentSnapshot."
    }

    $schemaVersion = Get-ObjectPropertyValue $snapshot 'schemaVersion'
    if ($schemaVersion -ne 1) {
        throw "Snapshot '$resolved' has unsupported schemaVersion '$schemaVersion'."
    }

    return [pscustomobject]@{
        Path = $resolved
        Report = $snapshot
        Fingerprint = Get-ObjectPropertyValue $snapshot 'fingerprint'
    }
}

function New-Index {
    param(
        [AllowNull()][object[]]$Items,
        [Parameter(Mandatory)][scriptblock]$KeySelector,
        [Parameter(Mandatory)][string]$Section
    )

    $map = @{}
    $duplicates = [System.Collections.Generic.List[string]]::new()

    foreach ($item in @($Items)) {
        if ($null -eq $item) {
            continue
        }
        $key = [string](& $KeySelector $item)
        if ([string]::IsNullOrWhiteSpace($key)) {
            continue
        }
        if ($map.ContainsKey($key)) {
            $duplicates.Add($key)
            continue
        }
        $map[$key] = $item
    }

    return [pscustomobject]@{
        Section = $Section
        Map = $map
        DuplicateKeys = @($duplicates | Sort-Object -Unique)
    }
}

function Compare-IndexedSection {
    param(
        [Parameter(Mandatory)][string]$Section,
        [AllowNull()][object[]]$ReferenceItems,
        [AllowNull()][object[]]$DifferenceItems,
        [Parameter(Mandatory)][scriptblock]$KeySelector,
        [Parameter(Mandatory)][string[]]$Fields,
        [Parameter(Mandatory)][string]$MissingCode,
        [Parameter(Mandatory)][string]$UnexpectedCode,
        [Parameter(Mandatory)][string]$DriftCode
    )

    $referenceIndex = New-Index -Items $ReferenceItems -KeySelector $KeySelector -Section $Section
    $differenceIndex = New-Index -Items $DifferenceItems -KeySelector $KeySelector -Section $Section
    $findings = [System.Collections.Generic.List[object]]::new()

    foreach ($key in $referenceIndex.DuplicateKeys) {
        $findings.Add([ordered]@{
            code = 'AMBIGUOUS_REFERENCE_KEY'
            severity = 'WARNING'
            section = $Section
            key = $key
            message = "Reference snapshot contains a duplicate comparison key '$key'."
        })
    }
    foreach ($key in $differenceIndex.DuplicateKeys) {
        $findings.Add([ordered]@{
            code = 'AMBIGUOUS_DIFFERENCE_KEY'
            severity = 'WARNING'
            section = $Section
            key = $key
            message = "Difference snapshot contains a duplicate comparison key '$key'."
        })
    }

    foreach ($key in @($referenceIndex.Map.Keys | Sort-Object)) {
        if (-not $differenceIndex.Map.ContainsKey($key)) {
            $findings.Add([ordered]@{
                code = $MissingCode
                severity = 'WARNING'
                section = $Section
                key = $key
                message = "'$key' is present in the reference snapshot but missing from the difference snapshot."
            })
            continue
        }

        $a = $referenceIndex.Map[$key]
        $b = $differenceIndex.Map[$key]
        $changes = [ordered]@{}

        foreach ($field in $Fields) {
            $aValue = Get-ObjectPropertyValue $a $field
            $bValue = Get-ObjectPropertyValue $b $field
            if ((ConvertTo-CanonicalScalar $aValue) -cne (ConvertTo-CanonicalScalar $bValue)) {
                $changes[$field] = [ordered]@{
                    reference = $aValue
                    difference = $bValue
                }
            }
        }

        if ($changes.Count -gt 0) {
            $findings.Add([ordered]@{
                code = $DriftCode
                severity = 'WARNING'
                section = $Section
                key = $key
                changes = $changes
                message = "'$key' differs between snapshots."
            })
        }
    }

    foreach ($key in @($differenceIndex.Map.Keys | Sort-Object)) {
        if (-not $referenceIndex.Map.ContainsKey($key)) {
            $findings.Add([ordered]@{
                code = $UnexpectedCode
                severity = 'WARNING'
                section = $Section
                key = $key
                message = "'$key' is present in the difference snapshot but not the reference snapshot."
            })
        }
    }

    return $findings.ToArray()
}

$reference = Read-Snapshot -Path $ReferenceSnapshotPath
$difference = Read-Snapshot -Path $DifferenceSnapshotPath

$a = $reference.Fingerprint
$b = $difference.Fingerprint
$allFindings = [System.Collections.Generic.List[object]]::new()

$sectionFindings = @(
    Compare-IndexedSection `
        -Section 'solutions' `
        -ReferenceItems @(Get-ObjectPropertyValue $a 'solutions') `
        -DifferenceItems @(Get-ObjectPropertyValue $b 'solutions') `
        -KeySelector { param($x) Get-ObjectPropertyValue $x 'uniqueName' } `
        -Fields @('version','managed','parentSolutionId','solutionType') `
        -MissingCode 'SOLUTION_MISSING' `
        -UnexpectedCode 'SOLUTION_UNEXPECTED' `
        -DriftCode 'SOLUTION_VERSION_OR_STATE_DRIFT'

    Compare-IndexedSection `
        -Section 'pcfs' `
        -ReferenceItems @(Get-ObjectPropertyValue $a 'pcfs') `
        -DifferenceItems @(Get-ObjectPropertyValue $b 'pcfs') `
        -KeySelector { param($x) Get-ObjectPropertyValue $x 'name' } `
        -Fields @('version','managed','componentState') `
        -MissingCode 'PCF_MISSING' `
        -UnexpectedCode 'PCF_UNEXPECTED' `
        -DriftCode 'PCF_DRIFT'

    Compare-IndexedSection `
        -Section 'pluginAssemblies' `
        -ReferenceItems @(Get-ObjectPropertyValue $a 'pluginAssemblies') `
        -DifferenceItems @(Get-ObjectPropertyValue $b 'pluginAssemblies') `
        -KeySelector { param($x) Get-ObjectPropertyValue $x 'name' } `
        -Fields @('version','isolationMode','sourceType','managed') `
        -MissingCode 'PLUGIN_ASSEMBLY_MISSING' `
        -UnexpectedCode 'PLUGIN_ASSEMBLY_UNEXPECTED' `
        -DriftCode 'PLUGIN_ASSEMBLY_DRIFT'

    Compare-IndexedSection `
        -Section 'pluginSteps' `
        -ReferenceItems @(Get-ObjectPropertyValue $a 'pluginSteps') `
        -DifferenceItems @(Get-ObjectPropertyValue $b 'pluginSteps') `
        -KeySelector {
            param($x)
            @(
                Get-ObjectPropertyValue $x 'assemblyName'
                Get-ObjectPropertyValue $x 'pluginTypeName'
                Get-ObjectPropertyValue $x 'message'
                Get-ObjectPropertyValue $x 'primaryEntity'
                Get-ObjectPropertyValue $x 'stepName'
            ) -join '|'
        } `
        -Fields @('stage','mode','rank','stateCode','statusCode','supportedDeployment','filteringAttributes','secureConfigurationPresent','unsecureConfigurationPresent','images') `
        -MissingCode 'PLUGIN_STEP_MISSING' `
        -UnexpectedCode 'PLUGIN_STEP_UNEXPECTED' `
        -DriftCode 'PLUGIN_STEP_DRIFT'

    Compare-IndexedSection `
        -Section 'flows' `
        -ReferenceItems @(Get-ObjectPropertyValue $a 'flows') `
        -DifferenceItems @(Get-ObjectPropertyValue $b 'flows') `
        -KeySelector {
            param($x)
            ([string](Get-ObjectPropertyValue $x 'name')) + '|' + (ConvertTo-CanonicalScalar (Get-ObjectPropertyValue $x 'solutionMembership'))
        } `
        -Fields @('enabledState','stateCode','statusCode','solutionMembership') `
        -MissingCode 'FLOW_MISSING' `
        -UnexpectedCode 'FLOW_UNEXPECTED' `
        -DriftCode 'FLOW_STATE_DRIFT'

    Compare-IndexedSection `
        -Section 'environmentVariables' `
        -ReferenceItems @(Get-ObjectPropertyValue $a 'environmentVariables') `
        -DifferenceItems @(Get-ObjectPropertyValue $b 'environmentVariables') `
        -KeySelector { param($x) Get-ObjectPropertyValue $x 'schemaName' } `
        -Fields @('type','isRequired','defaultValuePresent','currentValuePresent','activeCurrentValueCount','stateCode') `
        -MissingCode 'ENVIRONMENT_VARIABLE_MISSING' `
        -UnexpectedCode 'ENVIRONMENT_VARIABLE_UNEXPECTED' `
        -DriftCode 'ENVIRONMENT_VARIABLE_DRIFT'

    Compare-IndexedSection `
        -Section 'connectionReferences' `
        -ReferenceItems @(Get-ObjectPropertyValue $a 'connectionReferences') `
        -DifferenceItems @(Get-ObjectPropertyValue $b 'connectionReferences') `
        -KeySelector { param($x) Get-ObjectPropertyValue $x 'logicalName' } `
        -Fields @('connectorId','connectionIdPresent','resolutionState','stateCode','statusCode') `
        -MissingCode 'CONNECTION_REFERENCE_MISSING' `
        -UnexpectedCode 'CONNECTION_REFERENCE_UNEXPECTED' `
        -DriftCode 'CONNECTION_REFERENCE_DRIFT'

    Compare-IndexedSection `
        -Section 'componentMetadata' `
        -ReferenceItems @(Get-ObjectPropertyValue $a 'componentMetadata') `
        -DifferenceItems @(Get-ObjectPropertyValue $b 'componentMetadata') `
        -KeySelector {
            param($x)
            @(
                Get-ObjectPropertyValue $x 'solutionUniqueName'
                Get-ObjectPropertyValue $x 'componentType'
                Get-ObjectPropertyValue $x 'objectId'
            ) -join '|'
        } `
        -Fields @('rootComponentBehaviour','isMetadata') `
        -MissingCode 'COMPONENT_MISSING' `
        -UnexpectedCode 'COMPONENT_UNEXPECTED' `
        -DriftCode 'COMPONENT_METADATA_DRIFT'
)

foreach ($finding in $sectionFindings) {
    if ($null -ne $finding) {
        $allFindings.Add($finding)
    }
}

$orderedFindings = @($allFindings | Sort-Object section, code, key)
$bySection = [ordered]@{}
foreach ($section in @('solutions','pcfs','pluginAssemblies','pluginSteps','flows','environmentVariables','connectionReferences','componentMetadata')) {
    $bySection[$section] = @($orderedFindings | Where-Object { $_.section -eq $section }).Count
}

$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{
        name = 'Compare-PowerPlatformEnvironmentSnapshots'
        version = '1.0.0'
        maturity = 'Experimental'
    }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'LOCAL_ONLY'
    safetyClassification = 'LOCAL_ONLY_READ_ONLY'
    reference = [ordered]@{
        path = $reference.Path
        environment = Get-ObjectPropertyValue $reference.Report 'environment'
        fingerprintSha256 = Get-ObjectPropertyValue $reference.Report 'fingerprintSha256'
    }
    difference = [ordered]@{
        path = $difference.Path
        environment = Get-ObjectPropertyValue $difference.Report 'environment'
        fingerprintSha256 = Get-ObjectPropertyValue $difference.Report 'fingerprintSha256'
    }
    findings = $orderedFindings
    summary = [ordered]@{
        totalDifferences = $orderedFindings.Count
        differencesBySection = $bySection
        classification = if ($orderedFindings.Count -eq 0) { 'NO_DRIFT_DETECTED' } else { 'DRIFT_DETECTED' }
    }
    limitations = @(
        'Component object GUID comparison is best effort because some component identities may differ across independently-created environments.',
        'Flow matching uses display name plus solution membership and reports duplicate comparison keys as ambiguous rather than guessing.'
    )
}

$markdown = [System.Text.StringBuilder]::new()
[void]$markdown.AppendLine('# Power Platform Environment Snapshot Comparison')
[void]$markdown.AppendLine()
[void]$markdown.AppendLine("- Classification: **$($report.summary.classification)**")
[void]$markdown.AppendLine("- Total differences: **$($report.summary.totalDifferences)**")
[void]$markdown.AppendLine("- Reference: ``$($reference.Path)``")
[void]$markdown.AppendLine("- Difference: ``$($difference.Path)``")
[void]$markdown.AppendLine()
[void]$markdown.AppendLine('## Differences by section')
[void]$markdown.AppendLine()
foreach ($entry in $bySection.GetEnumerator()) {
    [void]$markdown.AppendLine("- $($entry.Key): $($entry.Value)")
}
[void]$markdown.AppendLine()
[void]$markdown.AppendLine('## Findings')
[void]$markdown.AppendLine()
if ($orderedFindings.Count -eq 0) {
    [void]$markdown.AppendLine('No meaningful drift was detected by this comparison contract.')
}
else {
    foreach ($finding in $orderedFindings) {
        [void]$markdown.AppendLine("- **$($finding.code)** [$($finding.section)] ``$($finding.key)``: $($finding.message)")
    }
}

Write-ComparisonOutputs -Report $report -SummaryText $markdown.ToString() -JsonOutputPath $JsonOutputPath -SummaryOutputPath $SummaryOutputPath
