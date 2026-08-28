<#
.SYNOPSIS
    Compares two locally saved plug-in registration inventories.

.DESCRIPTION
    Performs a local-only comparison of JSON files produced by Get-PluginRegistrationInventory.ps1.
    No network requests are made.

    Execution context: local-only.
    Safety classification: LOCAL_ONLY_READ_ONLY.

.PARAMETER ReferenceInventoryPath
    Baseline/reference inventory JSON.

.PARAMETER DifferenceInventoryPath
    Inventory JSON to compare against the reference.

.EXAMPLE
    .\Compare-PluginRegistration.ps1 `
        -ReferenceInventoryPath '.\qa-plugins.json' `
        -DifferenceInventoryPath '.\prod-plugins.json' `
        -SummaryOutputPath '.\plugin-diff.md'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ReferenceInventoryPath,

    [Parameter(Mandatory)]
    [string]$DifferenceInventoryPath,

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


function Read-Inventory {
    param([Parameter(Mandatory)][string]$Path)

    $resolved = Get-RequiredFilePath -Path $Path -Description 'Plug-in inventory JSON'
    try {
        $report = Get-Content -LiteralPath $resolved -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "Inventory '$resolved' is not valid JSON: $($_.Exception.Message)"
    }

    $toolName = [string](Get-ObjectPropertyValue (Get-ObjectPropertyValue $report 'tool') 'name')
    if ($toolName -ne 'Get-PluginRegistrationInventory') {
        throw "Inventory '$resolved' was created by '$toolName', not Get-PluginRegistrationInventory."
    }
    if ((Get-ObjectPropertyValue $report 'schemaVersion') -ne 1) {
        throw "Inventory '$resolved' has an unsupported schemaVersion."
    }

    return [pscustomobject]@{
        Path = $resolved
        Report = $report
        Assemblies = @(Get-ObjectPropertyValue $report 'assemblies')
        Registrations = @(Get-ObjectPropertyValue $report 'registrations')
    }
}

function Get-StepKey {
    param([Parameter(Mandatory)][object]$Step)

    return @(
        Get-ObjectPropertyValue $Step 'assembly'
        Get-ObjectPropertyValue $Step 'pluginType'
        Get-ObjectPropertyValue $Step 'message'
        Get-ObjectPropertyValue $Step 'primaryEntity'
        Get-ObjectPropertyValue $Step 'stepName'
    ) -join '|'
}

function New-UniqueIndex {
    param(
        [AllowNull()][object[]]$Items,
        [Parameter(Mandatory)][scriptblock]$KeySelector,
        [Parameter(Mandatory)][string]$Description
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

    if ($duplicates.Count -gt 0) {
        throw "$Description contains duplicate comparison key(s): $((@($duplicates | Sort-Object -Unique)) -join ', '). Refusing to guess which registration is authoritative."
    }

    return $map
}

function Get-ImageSignature {
    param([AllowNull()][object]$Step)

    $items = [System.Collections.Generic.List[string]]::new()
    foreach ($kind in @('preImages','postImages')) {
        foreach ($image in @((Get-ObjectPropertyValue $Step $kind))) {
            if ($null -eq $image) {
                continue
            }
            $items.Add(@(
                $kind
                Get-ObjectPropertyValue $image 'name'
                Get-ObjectPropertyValue $image 'entityAlias'
                Get-ObjectPropertyValue $image 'messagePropertyName'
                ConvertTo-CanonicalScalar (Get-ObjectPropertyValue $image 'attributes')
            ) -join '|')
        }
    }

    return (@($items | Sort-Object) -join '||')
}

$reference = Read-Inventory -Path $ReferenceInventoryPath
$difference = Read-Inventory -Path $DifferenceInventoryPath

$referenceSteps = New-UniqueIndex -Items $reference.Registrations -KeySelector { param($x) Get-StepKey $x } -Description 'Reference inventory'
$differenceSteps = New-UniqueIndex -Items $difference.Registrations -KeySelector { param($x) Get-StepKey $x } -Description 'Difference inventory'
$referenceAssemblies = New-UniqueIndex -Items $reference.Assemblies -KeySelector { param($x) Get-ObjectPropertyValue $x 'assembly' } -Description 'Reference assembly inventory'
$differenceAssemblies = New-UniqueIndex -Items $difference.Assemblies -KeySelector { param($x) Get-ObjectPropertyValue $x 'assembly' } -Description 'Difference assembly inventory'

$findings = [System.Collections.Generic.List[object]]::new()

foreach ($key in @($referenceSteps.Keys | Sort-Object)) {
    if (-not $differenceSteps.ContainsKey($key)) {
        $findings.Add([ordered]@{
            code = 'STEP_MISSING'
            severity = 'ERROR'
            key = $key
            message = "Expected plug-in step '$key' is missing from the difference inventory."
        })
        continue
    }

    $a = $referenceSteps[$key]
    $b = $differenceSteps[$key]

    if ([string](Get-ObjectPropertyValue $b 'state') -eq 'DISABLED') {
        $findings.Add([ordered]@{
            code = 'STEP_DISABLED'
            severity = 'ERROR'
            key = $key
            reference = Get-ObjectPropertyValue $a 'state'
            difference = Get-ObjectPropertyValue $b 'state'
            message = "Plug-in step '$key' is disabled in the difference inventory."
        })
    }

    foreach ($comparison in @(
        [pscustomobject]@{ Field='stage'; Code='STAGE_DRIFT' },
        [pscustomobject]@{ Field='executionMode'; Code='MODE_DRIFT' },
        [pscustomobject]@{ Field='rank'; Code='RANK_DRIFT' }
    )) {
        $av = Get-ObjectPropertyValue $a $comparison.Field
        $bv = Get-ObjectPropertyValue $b $comparison.Field
        if ((ConvertTo-CanonicalScalar $av) -cne (ConvertTo-CanonicalScalar $bv)) {
            $findings.Add([ordered]@{
                code = $comparison.Code
                severity = 'ERROR'
                key = $key
                reference = $av
                difference = $bv
                message = "Plug-in step '$key' has drift in '$($comparison.Field)'."
            })
        }
    }

    $referenceFiltering = ConvertTo-CanonicalScalar (Get-ObjectPropertyValue $a 'filteringAttributes')
    $differenceFiltering = ConvertTo-CanonicalScalar (Get-ObjectPropertyValue $b 'filteringAttributes')
    if ($referenceFiltering -cne $differenceFiltering) {
        $findings.Add([ordered]@{
            code = 'FILTERING_ATTRIBUTES_DRIFT'
            severity = 'ERROR'
            key = $key
            reference = @(Get-ObjectPropertyValue $a 'filteringAttributes')
            difference = @(Get-ObjectPropertyValue $b 'filteringAttributes')
            message = "Plug-in step '$key' has filtering-attribute drift."
        })
    }

    $referenceImages = Get-ImageSignature -Step $a
    $differenceImages = Get-ImageSignature -Step $b
    if ($referenceImages -cne $differenceImages) {
        $findings.Add([ordered]@{
            code = 'IMAGE_CONFIGURATION_DRIFT'
            severity = 'ERROR'
            key = $key
            referenceSignature = $referenceImages
            differenceSignature = $differenceImages
            message = "Plug-in step '$key' has pre/post image configuration drift."
        })
    }
}

foreach ($key in @($differenceSteps.Keys | Sort-Object)) {
    if (-not $referenceSteps.ContainsKey($key)) {
        $findings.Add([ordered]@{
            code = 'STEP_UNEXPECTED'
            severity = 'WARNING'
            key = $key
            message = "Unexpected plug-in step '$key' is present in the difference inventory."
        })
    }
}

foreach ($assemblyName in @($referenceAssemblies.Keys | Sort-Object)) {
    if (-not $differenceAssemblies.ContainsKey($assemblyName)) {
        continue
    }

    $aVersion = [string](Get-ObjectPropertyValue $referenceAssemblies[$assemblyName] 'assemblyVersion')
    $bVersion = [string](Get-ObjectPropertyValue $differenceAssemblies[$assemblyName] 'assemblyVersion')
    if ($aVersion -cne $bVersion) {
        $findings.Add([ordered]@{
            code = 'ASSEMBLY_VERSION_DRIFT'
            severity = 'WARNING'
            key = $assemblyName
            reference = $aVersion
            difference = $bVersion
            message = "Plug-in assembly '$assemblyName' has version drift."
        })
    }
}

$orderedFindings = @($findings | Sort-Object code, key)
$errorCount = @($orderedFindings | Where-Object { $_.severity -eq 'ERROR' }).Count
$warningCount = @($orderedFindings | Where-Object { $_.severity -eq 'WARNING' }).Count

$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{
        name = 'Compare-PluginRegistration'
        version = '1.0.0'
        maturity = 'Experimental'
    }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'LOCAL_ONLY'
    safetyClassification = 'LOCAL_ONLY_READ_ONLY'
    referencePath = $reference.Path
    differencePath = $difference.Path
    findings = $orderedFindings
    summary = [ordered]@{
        classification = if ($errorCount -gt 0) { 'DRIFT_DETECTED' } elseif ($warningCount -gt 0) { 'DRIFT_WITH_WARNINGS' } else { 'NO_DRIFT_DETECTED' }
        findings = $orderedFindings.Count
        errors = $errorCount
        warnings = $warningCount
    }
    limitations = @(
        'Step identity is matched using assembly, plug-in type, message, primary entity and step name. Duplicate keys fail closed rather than being guessed.'
    )
}

$markdown = [System.Text.StringBuilder]::new()
[void]$markdown.AppendLine('# Plug-in Registration Comparison')
[void]$markdown.AppendLine()
[void]$markdown.AppendLine("- Classification: **$($report.summary.classification)**")
[void]$markdown.AppendLine("- Errors: **$errorCount**")
[void]$markdown.AppendLine("- Warnings: **$warningCount**")
[void]$markdown.AppendLine()
[void]$markdown.AppendLine('## Findings')
[void]$markdown.AppendLine()
if ($orderedFindings.Count -eq 0) {
    [void]$markdown.AppendLine('No registration drift was detected.')
}
else {
    foreach ($finding in $orderedFindings) {
        [void]$markdown.AppendLine("- **$($finding.code)** ``$($finding.key)``: $($finding.message)")
    }
}

Write-ComparisonOutputs -Report $report -SummaryText $markdown.ToString() -JsonOutputPath $JsonOutputPath -SummaryOutputPath $SummaryOutputPath
