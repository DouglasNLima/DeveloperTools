<#
.SYNOPSIS
    Inspects Dataverse environment variables and connection references without exposing secrets.

.DESCRIPTION
    Performs read-only inspection of environment-variable definitions/current-value presence and
    connection references. Values and connection IDs are read only as needed to determine presence
    and are never emitted.

    Execution context: read-only remote Dataverse operations, with optional local report-file writes.
    Safety classification: READ_ONLY_REMOTE.

.PARAMETER EnvironmentUrl
    Absolute HTTPS Dataverse environment URL.

.PARAMETER AccessToken
    Dataverse OAuth bearer token as a SecureString.

.EXAMPLE
    $token = Read-Host 'Dataverse access token' -AsSecureString
    .\Test-EnvironmentReferences.ps1 `
        -EnvironmentUrl 'https://contoso.crm.dynamics.com' `
        -AccessToken $token
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$EnvironmentUrl,

    [Parameter(Mandatory)]
    [System.Security.SecureString]$AccessToken,

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

$definitionsResult = Invoke-DataverseRowsSafe `
    -Label 'environment variable definitions' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'environmentvariabledefinitions' -Select @('environmentvariabledefinitionid','schemaname','displayname','type','defaultvalue','isrequired','secretstore','statecode','statuscode','ismanaged','modifiedon') -Top $MaxRows) `
    -MaxRows $MaxRows

$valuesResult = Invoke-DataverseRowsSafe `
    -Label 'environment variable values' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'environmentvariablevalues' -Select @('environmentvariablevalueid','value','statecode','statuscode','modifiedon','_environmentvariabledefinitionid_value') -Top $MaxRows) `
    -MaxRows $MaxRows

$connectionsResult = Invoke-DataverseRowsSafe `
    -Label 'connection references' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'connectionreferences' -Select @('connectionreferenceid','connectionreferencelogicalname','connectionreferencedisplayname','connectorid','connectionid','statecode','statuscode','ismanaged','modifiedon') -Top $MaxRows) `
    -MaxRows $MaxRows

foreach ($result in @($definitionsResult,$valuesResult,$connectionsResult)) {
    if ($result.Error) {
        $errors.Add([ordered]@{ section = $result.Label; error = Protect-OperationalText $result.Error })
    }
}

$valuesByDefinition = @{}
foreach ($value in $valuesResult.Data) {
    $definitionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $value '_environmentvariabledefinitionid_value')
    if (-not $definitionId) {
        continue
    }
    if (-not $valuesByDefinition.ContainsKey($definitionId)) {
        $valuesByDefinition[$definitionId] = [System.Collections.Generic.List[object]]::new()
    }
    $valuesByDefinition[$definitionId].Add($value)
}

$environmentVariables = @(
    foreach ($definition in $definitionsResult.Data) {
        $definitionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $definition 'environmentvariabledefinitionid')
        $values = if ($definitionId -and $valuesByDefinition.ContainsKey($definitionId)) { @($valuesByDefinition[$definitionId]) } else { @() }
        $activeValues = @($values | Where-Object { (Get-ObjectPropertyValue $_ 'statecode') -eq 0 })
        $presentValues = @($activeValues | Where-Object { Test-ValuePresent (Get-ObjectPropertyValue $_ 'value') })

        $defaultPresent = Test-ValuePresent (Get-ObjectPropertyValue $definition 'defaultvalue')
        $currentPresent = $presentValues.Count -gt 0
        $valueState = if ($currentPresent) {
            'PRESENT'
        }
        elseif ($defaultPresent) {
            'PRESENT'
        }
        else {
            'MISSING'
        }

        [ordered]@{
            definitionId = $definitionId
            schemaName = [string](Get-ObjectPropertyValue $definition 'schemaname')
            displayName = [string](Get-ObjectPropertyValue $definition 'displayname')
            definitionState = 'PRESENT'
            type = Get-ObjectPropertyValue $definition 'type'
            isSecretType = ((Get-ObjectPropertyValue $definition 'type') -eq 100000005)
            isRequired = Get-ObjectPropertyValue $definition 'isrequired'
            defaultValueState = if ($defaultPresent) { 'PRESENT' } else { 'MISSING' }
            currentValueState = if ($currentPresent) { 'PRESENT' } else { 'MISSING' }
            effectiveValueState = $valueState
            activeCurrentValueCount = $activeValues.Count
            stateCode = Get-ObjectPropertyValue $definition 'statecode'
            statusCode = Get-ObjectPropertyValue $definition 'statuscode'
            isManaged = Get-ObjectPropertyValue $definition 'ismanaged'
            modifiedOn = Get-ObjectPropertyValue $definition 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object schemaName

$connectionReferences = @(
    foreach ($connection in $connectionsResult.Data) {
        $logicalName = [string](Get-ObjectPropertyValue $connection 'connectionreferencelogicalname')
        $connectionIdPresent = Test-ValuePresent (Get-ObjectPropertyValue $connection 'connectionid')
        $connectorIdPresent = Test-ValuePresent (Get-ObjectPropertyValue $connection 'connectorid')

        [ordered]@{
            connectionReferenceId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $connection 'connectionreferenceid')
            logicalName = $logicalName
            displayName = [string](Get-ObjectPropertyValue $connection 'connectionreferencedisplayname')
            state = 'PRESENT'
            connectorId = [string](Get-ObjectPropertyValue $connection 'connectorid')
            connectorState = if ($connectorIdPresent) { 'PRESENT' } else { 'MISSING' }
            connectionIdState = if ($connectionIdPresent) { 'PRESENT' } else { 'MISSING' }
            resolutionState = if ($connectionIdPresent -and $connectorIdPresent) { 'RESOLVED' } elseif (-not $connectionIdPresent) { 'UNRESOLVED' } else { 'UNKNOWN' }
            stateCode = Get-ObjectPropertyValue $connection 'statecode'
            statusCode = Get-ObjectPropertyValue $connection 'statuscode'
            isManaged = Get-ObjectPropertyValue $connection 'ismanaged'
            modifiedOn = Get-ObjectPropertyValue $connection 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object logicalName

if ($definitionsResult.Error) {
    $environmentVariables = @()
}
if ($connectionsResult.Error) {
    $connectionReferences = @()
}

$classification = if ($errors.Count -gt 0) { 'INSPECTION_COMPLETE_WITH_GAPS' } else { 'INSPECTION_COMPLETE' }

$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{
        name = 'Test-EnvironmentReferences'
        version = '1.0.0'
        maturity = 'Experimental'
    }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'READ_ONLY_REMOTE'
    safetyClassification = 'READ_ONLY_REMOTE'
    environment = $environmentBaseUrl
    environmentVariables = $environmentVariables
    connectionReferences = $connectionReferences
    errors = @($errors)
    limitations = @(
        'Environment-variable values are never emitted. Presence is determined from the value fields in memory only.',
        'Connection IDs are never emitted. Resolution is reported from connection-ID and connector-ID presence only.',
        'A missing environment-variable value is not automatically an error because some variables are intentionally optional.'
    )
    summary = [ordered]@{
        classification = $classification
        environmentVariables = $environmentVariables.Count
        environmentVariablesMissingEffectiveValue = @($environmentVariables | Where-Object { $_.effectiveValueState -eq 'MISSING' }).Count
        connectionReferences = $connectionReferences.Count
        unresolvedConnectionReferences = @($connectionReferences | Where-Object { $_.resolutionState -eq 'UNRESOLVED' }).Count
        nonBlockingErrors = $errors.Count
        secretValuesEmitted = $false
    }
}

$summary = @"
Environment references
Environment: $environmentBaseUrl
Classification: $classification
Environment variables: $($environmentVariables.Count)
Variables without current/default value: $($report.summary.environmentVariablesMissingEffectiveValue)
Connection references: $($connectionReferences.Count)
Unresolved connection references: $($report.summary.unresolvedConnectionReferences)
Non-blocking errors: $($errors.Count)
Secret values emitted: NO
"@

Write-ReportOutputs -Report $report -SummaryText $summary -JsonOutputPath $JsonOutputPath -SummaryOutputPath $SummaryOutputPath
