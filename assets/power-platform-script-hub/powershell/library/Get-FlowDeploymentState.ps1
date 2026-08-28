<#
.SYNOPSIS
    Generates a read-only Power Automate cloud-flow deployment-state inventory.

.DESCRIPTION
    Reads Dataverse workflow records for cloud flows (category 5), solution membership, owner metadata
    and best-effort connection-reference relationships. Raw flow clientData is never written to output.

    Execution context: read-only remote Dataverse operations, with optional local report-file writes.
    Safety classification: READ_ONLY_REMOTE.

.PARAMETER EnvironmentUrl
    Absolute HTTPS Dataverse environment URL.

.PARAMETER AccessToken
    Dataverse OAuth bearer token as a SecureString.

.PARAMETER SolutionUniqueName
    Optional exact solution unique-name filter.

.PARAMETER NameContains
    Optional case-sensitive Dataverse contains filter for flow display name.

.EXAMPLE
    $token = Read-Host 'Dataverse access token' -AsSecureString
    .\Get-FlowDeploymentState.ps1 `
        -EnvironmentUrl 'https://contoso.crm.dynamics.com' `
        -AccessToken $token `
        -SolutionUniqueName 'contoso_automation'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$EnvironmentUrl,

    [Parameter(Mandatory)]
    [System.Security.SecureString]$AccessToken,

    [Parameter()]
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$SolutionUniqueName,

    [Parameter()]
    [string]$NameContains,

    [Parameter()]
    [ValidateRange(1, 100000)]
    [int]$MaxRows = 5000,

    [Parameter()]
    [ValidatePattern('^v\d+\.\d+$')]
    [string]$ApiVersion = 'v9.2',

    [Parameter()]
    [string]$JsonOutputPath,

    [Parameter()]
    [string]$SummaryOutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-PlainTextFromSecureString {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [System.Security.SecureString]$SecureValue
    )

    $pointer = [IntPtr]::Zero
    try {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        if ($pointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        }
    }
}

function Assert-DataverseEnvironmentUrl {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Url
    )

    $parsed = $null
    if (-not [Uri]::TryCreate($Url, [UriKind]::Absolute, [ref]$parsed)) {
        throw "EnvironmentUrl must be an absolute HTTPS URL. Received '$Url'."
    }
    if ($parsed.Scheme -ne 'https') {
        throw "EnvironmentUrl must use HTTPS. Received '$Url'."
    }
    if ([string]::IsNullOrWhiteSpace($parsed.Host)) {
        throw "EnvironmentUrl does not contain a valid host. Received '$Url'."
    }

    return $parsed.GetLeftPart([UriPartial]::Authority).TrimEnd('/')
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

function Test-ValuePresent {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [object]$Value
    )

    if ($null -eq $Value) {
        return $false
    }
    if ($Value -is [string]) {
        return -not [string]::IsNullOrWhiteSpace($Value)
    }

    return $true
}

function ConvertTo-NormalisedGuid {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [object]$Value
    )

    if ($null -eq $Value) {
        return $null
    }

    $candidate = ([string]$Value).Trim().Trim('{', '}')
    $guid = [Guid]::Empty
    if ([Guid]::TryParse($candidate, [ref]$guid)) {
        return $guid.ToString('D').ToLowerInvariant()
    }

    return $null
}

function New-ODataRelativeUri {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$EntitySet,

        [string[]]$Select,

        [string]$Filter,

        [string]$OrderBy,

        [ValidateRange(1, 5000)]
        [int]$Top = 5000
    )

    if ($EntitySet -notmatch '^[A-Za-z0-9_()]+$') {
        throw "Unsafe or unsupported entity-set expression '$EntitySet'."
    }

    $parts = [System.Collections.Generic.List[string]]::new()

    if ($Select -and $Select.Count -gt 0) {
        $parts.Add('$select=' + (($Select | ForEach-Object { $_.Trim() }) -join ','))
    }
    if (-not [string]::IsNullOrWhiteSpace($Filter)) {
        $parts.Add('$filter=' + [Uri]::EscapeDataString($Filter))
    }
    if (-not [string]::IsNullOrWhiteSpace($OrderBy)) {
        $parts.Add('$orderby=' + [Uri]::EscapeDataString($OrderBy))
    }
    $parts.Add('$top=' + $Top.ToString([Globalization.CultureInfo]::InvariantCulture))

    return $EntitySet + '?' + ($parts -join '&')
}

function Invoke-DataverseGet {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$EnvironmentBaseUrl,

        [Parameter(Mandatory)]
        [string]$ApiVersion,

        [Parameter(Mandatory)]
        [string]$BearerToken,

        [Parameter(Mandatory)]
        [string]$RelativeOrAbsoluteUri
    )

    $baseUri = [Uri]("$EnvironmentBaseUrl/api/data/$ApiVersion/")
    $targetUri = $null

    if ([Uri]::IsWellFormedUriString($RelativeOrAbsoluteUri, [UriKind]::Absolute)) {
        $targetUri = [Uri]$RelativeOrAbsoluteUri
        if ($targetUri.GetLeftPart([UriPartial]::Authority) -ne $baseUri.GetLeftPart([UriPartial]::Authority)) {
            throw "Refusing a cross-origin Dataverse request to '$targetUri'."
        }
    }
    else {
        $targetUri = [Uri]::new($baseUri, $RelativeOrAbsoluteUri.TrimStart('/'))
    }

    $headers = @{
        Authorization = "Bearer $BearerToken"
        Accept        = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
        Prefer = 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
    }

    try {
        return Invoke-RestMethod -Method Get -Uri $targetUri.AbsoluteUri -Headers $headers
    }
    catch {
        $safeMessage = $_.Exception.Message
        $safeMessage = $safeMessage -replace '(?i)Bearer\s+[A-Za-z0-9\-._~+/]+=*', 'Bearer [REDACTED]'
        throw "Dataverse GET failed for '$($targetUri.AbsolutePath)': $safeMessage"
    }
}

function Get-DataverseRows {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$EnvironmentBaseUrl,

        [Parameter(Mandatory)]
        [string]$ApiVersion,

        [Parameter(Mandatory)]
        [string]$BearerToken,

        [Parameter(Mandatory)]
        [string]$RelativeUri,

        [ValidateRange(1, 100000)]
        [int]$MaxRows = 5000
    )

    $rows = [System.Collections.Generic.List[object]]::new()
    $next = $RelativeUri

    while (-not [string]::IsNullOrWhiteSpace($next) -and $rows.Count -lt $MaxRows) {
        $page = Invoke-DataverseGet `
            -EnvironmentBaseUrl $EnvironmentBaseUrl `
            -ApiVersion $ApiVersion `
            -BearerToken $BearerToken `
            -RelativeOrAbsoluteUri $next

        foreach ($item in @((Get-ObjectPropertyValue -InputObject $page -Name 'value'))) {
            if ($null -ne $item) {
                $rows.Add($item)
                if ($rows.Count -ge $MaxRows) {
                    break
                }
            }
        }

        $next = [string](Get-ObjectPropertyValue -InputObject $page -Name '@odata.nextLink')
    }

    return $rows.ToArray()
}

function Invoke-DataverseRowsSafe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Label,

        [Parameter(Mandatory)]
        [string]$EnvironmentBaseUrl,

        [Parameter(Mandatory)]
        [string]$ApiVersion,

        [Parameter(Mandatory)]
        [string]$BearerToken,

        [Parameter(Mandatory)]
        [string]$RelativeUri,

        [ValidateRange(1, 100000)]
        [int]$MaxRows = 5000
    )

    try {
        $data = @(Get-DataverseRows `
            -EnvironmentBaseUrl $EnvironmentBaseUrl `
            -ApiVersion $ApiVersion `
            -BearerToken $BearerToken `
            -RelativeUri $RelativeUri `
            -MaxRows $MaxRows)

        return [pscustomobject]@{
            Label = $Label
            Data = $data
            Error = $null
        }
    }
    catch {
        return [pscustomobject]@{
            Label = $Label
            Data = @()
            Error = $_.Exception.Message
        }
    }
}

function Get-FormattedValue {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [object]$InputObject,

        [Parameter(Mandatory)]
        [string]$AttributeName
    )

    return Get-ObjectPropertyValue `
        -InputObject $InputObject `
        -Name ($AttributeName + '@OData.Community.Display.V1.FormattedValue')
}

function Protect-OperationalText {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [object]$Value
    )

    if ($null -eq $Value) {
        return $null
    }

    $text = [string]$Value
    $patterns = @(
        '(?i)(authorization\s*[:=]\s*bearer\s+)[^\s,;]+',
        '(?i)(bearer\s+)[A-Za-z0-9\-._~+/]+=*',
        '(?i)(client[_-]?secret\s*[:=]\s*)[^\s,;]+',
        '(?i)(password\s*[:=]\s*)[^\s,;]+',
        '(?i)(access[_-]?token\s*[:=]\s*)[^\s,;]+'
    )
    foreach ($pattern in $patterns) {
        $text = [regex]::Replace($text, $pattern, '$1[REDACTED]')
    }

    return $text
}

function Get-TextSha256 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string]$Text
    )

    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash($bytes)
        return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
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
        throw "Output parent directory does not exist: '$parent'. Create it explicitly before running this script."
    }

    [IO.File]::WriteAllText($fullPath, $Text, [Text.UTF8Encoding]::new($false))
    return $fullPath
}

function Write-ReportOutputs {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object]$Report,

        [Parameter(Mandatory)]
        [string]$SummaryText,

        [string]$JsonOutputPath,

        [string]$SummaryOutputPath
    )

    $json = $Report | ConvertTo-Json -Depth 30

    if (-not [string]::IsNullOrWhiteSpace($JsonOutputPath)) {
        [void](Write-Utf8NoBomText -Path $JsonOutputPath -Text ($json + [Environment]::NewLine))
    }
    if (-not [string]::IsNullOrWhiteSpace($SummaryOutputPath)) {
        [void](Write-Utf8NoBomText -Path $SummaryOutputPath -Text ($SummaryText.TrimEnd() + [Environment]::NewLine))
    }

    Write-Host $SummaryText
    return $Report
}


$environmentBaseUrl = Assert-DataverseEnvironmentUrl -Url $EnvironmentUrl
$token = Get-PlainTextFromSecureString -SecureValue $AccessToken
if ([string]::IsNullOrWhiteSpace($token)) {
    throw 'AccessToken resolved to an empty value.'
}

$errors = [System.Collections.Generic.List[object]]::new()
$limitations = [System.Collections.Generic.List[string]]::new()

$solutionsResult = Invoke-DataverseRowsSafe `
    -Label 'solutions' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'solutions' -Select @('solutionid','uniquename','friendlyname') -Filter "uniquename ne 'Active' and uniquename ne 'Default'" -Top $MaxRows) `
    -MaxRows $MaxRows

$componentsFilter = 'componenttype eq 29'
$componentsResult = Invoke-DataverseRowsSafe `
    -Label 'workflow solution components' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'solutioncomponents' -Select @('objectid','componenttype','_solutionid_value') -Filter $componentsFilter -Top $MaxRows) `
    -MaxRows $MaxRows

$connectionsResult = Invoke-DataverseRowsSafe `
    -Label 'connection references' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'connectionreferences' -Select @('connectionreferenceid','connectionreferencelogicalname','connectionreferencedisplayname','connectorid','connectionid','statecode','statuscode') -Top $MaxRows) `
    -MaxRows $MaxRows

$flowFilterParts = [System.Collections.Generic.List[string]]::new()
$flowFilterParts.Add('category eq 5')
if (-not [string]::IsNullOrWhiteSpace($NameContains)) {
    $flowFilterParts.Add("contains(name,'$($NameContains.Replace("'", "''"))')")
}

$flowsResult = Invoke-DataverseRowsSafe `
    -Label 'cloud flows' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'workflows' -Select @('workflowid','name','statecode','statuscode','category','mode','type','createdon','modifiedon','_ownerid_value','clientdata') -Filter ($flowFilterParts -join ' and ') -Top $MaxRows) `
    -MaxRows $MaxRows

foreach ($result in @($solutionsResult,$componentsResult,$connectionsResult,$flowsResult)) {
    if ($result.Error) {
        $errors.Add([ordered]@{ section = $result.Label; error = Protect-OperationalText $result.Error })
    }
}
if ($flowsResult.Error) {
    throw "Cloud-flow inventory could not be read: $($flowsResult.Error)"
}

$solutionById = @{}
foreach ($solution in $solutionsResult.Data) {
    $id = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $solution 'solutionid')
    if ($id) {
        $solutionById[$id] = [string](Get-ObjectPropertyValue $solution 'uniquename')
    }
}

$flowMembership = @{}
foreach ($component in $componentsResult.Data) {
    $flowId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $component 'objectid')
    $solutionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $component '_solutionid_value')
    if (-not $flowId -or -not $solutionId -or -not $solutionById.ContainsKey($solutionId)) {
        continue
    }
    if (-not $flowMembership.ContainsKey($flowId)) {
        $flowMembership[$flowId] = [System.Collections.Generic.List[string]]::new()
    }
    $flowMembership[$flowId].Add($solutionById[$solutionId])
}

$connectionReferences = @(
    foreach ($connection in $connectionsResult.Data) {
        [ordered]@{
            logicalName = [string](Get-ObjectPropertyValue $connection 'connectionreferencelogicalname')
            displayName = [string](Get-ObjectPropertyValue $connection 'connectionreferencedisplayname')
            connectorId = [string](Get-ObjectPropertyValue $connection 'connectorid')
            resolutionState = if ((Test-ValuePresent (Get-ObjectPropertyValue $connection 'connectionid')) -and (Test-ValuePresent (Get-ObjectPropertyValue $connection 'connectorid'))) { 'RESOLVED' } elseif (-not (Test-ValuePresent (Get-ObjectPropertyValue $connection 'connectionid'))) { 'UNRESOLVED' } else { 'UNKNOWN' }
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object logicalName

$connectionNames = @($connectionReferences | ForEach-Object { $_.logicalName } | Where-Object { $_ } | Sort-Object -Unique)

$flows = @(
    foreach ($flow in $flowsResult.Data) {
        $flowId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $flow 'workflowid')
        $memberships = @(
            if ($flowId -and $flowMembership.ContainsKey($flowId)) {
                $flowMembership[$flowId] | Sort-Object -Unique
            }
        )

        if ($SolutionUniqueName -and ($memberships -notcontains $SolutionUniqueName)) {
            continue
        }

        $clientData = [string](Get-ObjectPropertyValue $flow 'clientdata')
        $matchedReferences = [System.Collections.Generic.List[string]]::new()
        if (-not [string]::IsNullOrWhiteSpace($clientData)) {
            foreach ($logicalName in $connectionNames) {
                if ($clientData.IndexOf($logicalName, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                    $matchedReferences.Add($logicalName)
                }
            }
        }

        [ordered]@{
            flowId = $flowId
            displayName = [string](Get-ObjectPropertyValue $flow 'name')
            solutionMembership = $memberships
            stateCode = Get-ObjectPropertyValue $flow 'statecode'
            statusCode = Get-ObjectPropertyValue $flow 'statuscode'
            enabledState = if ((Get-ObjectPropertyValue $flow 'statecode') -eq 1) { 'ENABLED' } else { 'DISABLED' }
            owner = [ordered]@{
                id = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $flow '_ownerid_value')
                displayName = Get-FormattedValue -InputObject $flow -AttributeName '_ownerid_value'
            }
            connectionReferences = @($matchedReferences | Sort-Object -Unique)
            connectionReferenceRelationshipState = if ($connectionsResult.Error) { 'UNKNOWN' } elseif ([string]::IsNullOrWhiteSpace($clientData)) { 'UNKNOWN' } else { 'PRESENT' }
            createdOn = Get-ObjectPropertyValue $flow 'createdon'
            modifiedOn = Get-ObjectPropertyValue $flow 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object displayName, flowId

$limitations.Add('Connection-reference relationships are derived conservatively by matching known connection-reference logical names inside workflow clientData. Raw clientData is never emitted. Absence of a match is not proof that a flow has no connection dependency.')

$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{
        name = 'Get-FlowDeploymentState'
        version = '1.0.0'
        maturity = 'Experimental'
    }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'READ_ONLY_REMOTE'
    safetyClassification = 'READ_ONLY_REMOTE'
    environment = $environmentBaseUrl
    filters = [ordered]@{
        solutionUniqueName = if ($SolutionUniqueName) { $SolutionUniqueName } else { $null }
        nameContains = if ($NameContains) { $NameContains } else { $null }
    }
    flows = $flows
    knownConnectionReferences = $connectionReferences
    limitations = @($limitations)
    errors = @($errors)
    summary = [ordered]@{
        classification = if ($errors.Count -gt 0) { 'INVENTORY_COMPLETE_WITH_GAPS' } else { 'INVENTORY_COMPLETE' }
        flowCount = $flows.Count
        enabled = @($flows | Where-Object { $_.enabledState -eq 'ENABLED' }).Count
        disabled = @($flows | Where-Object { $_.enabledState -eq 'DISABLED' }).Count
        flowsWithDetectedConnectionReferences = @($flows | Where-Object { $_.connectionReferences.Count -gt 0 }).Count
        nonBlockingErrors = $errors.Count
        rawClientDataEmitted = $false
    }
}

$summary = @"
Cloud-flow deployment state
Environment: $environmentBaseUrl
Classification: $($report.summary.classification)
Flows: $($flows.Count)
Enabled: $($report.summary.enabled)
Disabled: $($report.summary.disabled)
Flows with detected connection references: $($report.summary.flowsWithDetectedConnectionReferences)
Non-blocking errors: $($errors.Count)
Raw clientData emitted: NO
"@

Write-ReportOutputs -Report $report -SummaryText $summary -JsonOutputPath $JsonOutputPath -SummaryOutputPath $SummaryOutputPath
