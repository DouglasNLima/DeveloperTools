<#
.SYNOPSIS
    Exports retained Dataverse solution deployment history.

.DESCRIPTION
    Reads the retained msdyn_solutionhistory evidence surface. The report always states the oldest
    retained history timestamp observed so that retained history cannot be mistaken for complete
    lifetime history.

    Execution context: read-only remote Dataverse operations, with optional local report-file writes.
    Safety classification: READ_ONLY_REMOTE.

.PARAMETER EnvironmentUrl
    Absolute HTTPS Dataverse environment URL.

.PARAMETER AccessToken
    Dataverse OAuth bearer token as a SecureString.

.PARAMETER SolutionUniqueName
    Optional solution unique-name filter.

.PARAMETER LookbackDays
    Optional lookback window in days. Defaults to 90.

.PARAMETER MaximumRecords
    Maximum matching records returned. Defaults to 500.

.EXAMPLE
    $token = Read-Host 'Dataverse access token' -AsSecureString
    .\Get-SolutionDeploymentHistory.ps1 `
        -EnvironmentUrl 'https://contoso.crm.dynamics.com' `
        -AccessToken $token `
        -SolutionUniqueName 'contoso_core' `
        -LookbackDays 30
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
    [ValidateRange(1, 3650)]
    [int]$LookbackDays = 90,

    [Parameter()]
    [ValidateRange(1, 5000)]
    [int]$MaximumRecords = 500,

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

$oldestRetained = $null
try {
    $oldestRows = @(Get-DataverseRows `
        -EnvironmentBaseUrl $environmentBaseUrl `
        -ApiVersion $ApiVersion `
        -BearerToken $token `
        -RelativeUri (New-ODataRelativeUri -EntitySet 'msdyn_solutionhistories' -Select @('msdyn_solutionhistoryid','msdyn_starttime') -OrderBy 'msdyn_starttime asc' -Top 1) `
        -MaxRows 1)
    if ($oldestRows.Count -gt 0) {
        $oldestRetained = Get-ObjectPropertyValue $oldestRows[0] 'msdyn_starttime'
    }
}
catch {
    $errors.Add([ordered]@{ section = 'oldest retained solution history'; error = Protect-OperationalText $_.Exception.Message })
}

$solutionId = $null
if (-not [string]::IsNullOrWhiteSpace($SolutionUniqueName)) {
    $solutionFilter = "uniquename eq '$($SolutionUniqueName.Replace("'", "''"))'"
    $solutionQuery = Invoke-DataverseRowsSafe `
        -Label 'solution resolution' `
        -EnvironmentBaseUrl $environmentBaseUrl `
        -ApiVersion $ApiVersion `
        -BearerToken $token `
        -RelativeUri (New-ODataRelativeUri -EntitySet 'solutions' -Select @('solutionid','uniquename') -Filter $solutionFilter -Top 10) `
        -MaxRows 10

    if ($solutionQuery.Error) {
        $errors.Add([ordered]@{ section = $solutionQuery.Label; error = Protect-OperationalText $solutionQuery.Error })
    }
    elseif ($solutionQuery.Data.Count -eq 1) {
        $solutionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $solutionQuery.Data[0] 'solutionid')
    }
    elseif ($solutionQuery.Data.Count -gt 1) {
        throw "More than one solution row matched unique name '$SolutionUniqueName'. Refusing an ambiguous history query."
    }
}

$fromUtc = [DateTimeOffset]::UtcNow.AddDays(-$LookbackDays).ToString('o')
$filterParts = [System.Collections.Generic.List[string]]::new()
$filterParts.Add("msdyn_starttime ge $fromUtc")
if ($solutionId) {
    $filterParts.Add("msdyn_solutionid eq '$solutionId'")
}
elseif (-not [string]::IsNullOrWhiteSpace($SolutionUniqueName)) {
    $filterParts.Add("contains(msdyn_name,'$($SolutionUniqueName.Replace("'", "''"))')")
    $limitations.Add("Solution '$SolutionUniqueName' could not be resolved to exactly one current solution ID; history filtering fell back to msdyn_name contains matching.")
}

$historySelect = @(
    'msdyn_solutionhistoryid',
    'msdyn_name',
    'msdyn_solutionid',
    'msdyn_solutionversion',
    'msdyn_packageversion',
    'msdyn_packagename',
    'msdyn_publishername',
    'msdyn_ismanaged',
    'msdyn_ispatch',
    'msdyn_isoverwritecustomizations',
    'msdyn_operation',
    'msdyn_suboperation',
    'msdyn_status',
    'msdyn_result',
    'msdyn_starttime',
    'msdyn_endtime',
    'msdyn_totaltime',
    'msdyn_retrycount',
    'msdyn_activityid',
    'msdyn_correlationid',
    'msdyn_errorcode',
    'msdyn_exceptionmessage'
)

$history = @()
$extendedHistoryAvailable = $true
try {
    $history = @(Get-DataverseRows `
        -EnvironmentBaseUrl $environmentBaseUrl `
        -ApiVersion $ApiVersion `
        -BearerToken $token `
        -RelativeUri (New-ODataRelativeUri -EntitySet 'msdyn_solutionhistories' -Select $historySelect -Filter ($filterParts -join ' and ') -OrderBy 'msdyn_starttime desc' -Top $MaximumRecords) `
        -MaxRows $MaximumRecords)
}
catch {
    $extendedHistoryAvailable = $false
    $limitations.Add('One or more extended solution-history columns were unavailable. A reduced Microsoft-documented field set was used.')
    $errors.Add([ordered]@{ section = 'extended solution history'; error = Protect-OperationalText $_.Exception.Message })

    $fallbackSelect = @(
        'msdyn_solutionhistoryid',
        'msdyn_name',
        'msdyn_solutionid',
        'msdyn_solutionversion',
        'msdyn_operation',
        'msdyn_suboperation',
        'msdyn_status',
        'msdyn_result',
        'msdyn_starttime',
        'msdyn_endtime',
        'msdyn_totaltime',
        'msdyn_activityid',
        'msdyn_correlationid',
        'msdyn_errorcode'
    )
    $history = @(Get-DataverseRows `
        -EnvironmentBaseUrl $environmentBaseUrl `
        -ApiVersion $ApiVersion `
        -BearerToken $token `
        -RelativeUri (New-ODataRelativeUri -EntitySet 'msdyn_solutionhistories' -Select $fallbackSelect -Filter ($filterParts -join ' and ') -OrderBy 'msdyn_starttime desc' -Top $MaximumRecords) `
        -MaxRows $MaximumRecords)
}

$records = @(
    foreach ($row in $history) {
        $start = Get-ObjectPropertyValue $row 'msdyn_starttime'
        $end = Get-ObjectPropertyValue $row 'msdyn_endtime'
        $duration = Get-ObjectPropertyValue $row 'msdyn_totaltime'
        if ($null -eq $duration -and $start -and $end) {
            try {
                $duration = [math]::Round(([DateTimeOffset]$end - [DateTimeOffset]$start).TotalSeconds)
            }
            catch {
                $duration = $null
            }
        }

        [ordered]@{
            timestampUtc = $start
            endTimestampUtc = $end
            operation = Get-ObjectPropertyValue $row 'msdyn_operation'
            subOperation = Get-ObjectPropertyValue $row 'msdyn_suboperation'
            solutionName = [string](Get-ObjectPropertyValue $row 'msdyn_name')
            solutionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $row 'msdyn_solutionid')
            version = [string](Get-ObjectPropertyValue $row 'msdyn_solutionversion')
            packageVersion = [string](Get-ObjectPropertyValue $row 'msdyn_packageversion')
            managed = Get-ObjectPropertyValue $row 'msdyn_ismanaged'
            patch = Get-ObjectPropertyValue $row 'msdyn_ispatch'
            overwriteCustomisations = Get-ObjectPropertyValue $row 'msdyn_isoverwritecustomizations'
            result = Get-ObjectPropertyValue $row 'msdyn_result'
            status = Get-ObjectPropertyValue $row 'msdyn_status'
            durationSeconds = $duration
            correlationId = [string](Get-ObjectPropertyValue $row 'msdyn_correlationid')
            activityId = [string](Get-ObjectPropertyValue $row 'msdyn_activityid')
            errorCode = [string](Get-ObjectPropertyValue $row 'msdyn_errorcode')
            exceptionMessage = Protect-OperationalText (Get-ObjectPropertyValue $row 'msdyn_exceptionmessage')
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object @{ Expression = { $_.timestampUtc }; Descending = $true }, solutionName

$classification = if ($errors.Count -gt 0) { 'HISTORY_EXPORTED_WITH_GAPS' } else { 'HISTORY_EXPORTED' }

$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{
        name = 'Get-SolutionDeploymentHistory'
        version = '1.0.0'
        maturity = 'Experimental'
    }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'READ_ONLY_REMOTE'
    safetyClassification = 'READ_ONLY_REMOTE'
    environment = $environmentBaseUrl
    filters = [ordered]@{
        solutionUniqueName = if ($SolutionUniqueName) { $SolutionUniqueName } else { $null }
        resolvedSolutionId = $solutionId
        lookbackDays = $LookbackDays
        maximumRecords = $MaximumRecords
    }
    retention = [ordered]@{
        oldestRetainedHistoryTimestampUtc = $oldestRetained
        warning = 'This timestamp is the oldest row currently retained by the queried history table. The report is not evidence of complete lifetime deployment history.'
    }
    records = $records
    limitations = @($limitations)
    errors = @($errors)
    summary = [ordered]@{
        classification = $classification
        records = $records.Count
        oldestRetainedHistoryTimestampUtc = $oldestRetained
        extendedHistoryColumnsAvailable = $extendedHistoryAvailable
        failures = @($records | Where-Object { $_.result -eq $false }).Count
    }
}

$summary = @"
Solution deployment history
Environment: $environmentBaseUrl
Classification: $classification
Records: $($records.Count)
Oldest retained history timestamp: $oldestRetained
IMPORTANT: retained history is not complete lifetime history.
Failures in returned window: $(@($records | Where-Object { $_.result -eq $false }).Count)
Extended history columns available: $extendedHistoryAvailable
"@

Write-ReportOutputs -Report $report -SummaryText $summary -JsonOutputPath $JsonOutputPath -SummaryOutputPath $SummaryOutputPath
