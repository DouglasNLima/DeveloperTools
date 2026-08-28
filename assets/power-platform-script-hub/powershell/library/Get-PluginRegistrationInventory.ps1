<#
.SYNOPSIS
    Generates a read-only plug-in registration inventory from Dataverse.

.DESCRIPTION
    Captures plug-in assemblies, plug-in types, SDK message processing steps and step images.
    Secure and unsecure configuration content is never exported; only presence flags are reported.

    Execution context: read-only remote Dataverse operations, with optional local report-file writes.
    Safety classification: READ_ONLY_REMOTE.

.PARAMETER EnvironmentUrl
    Absolute HTTPS Dataverse environment URL.

.PARAMETER AccessToken
    Dataverse OAuth bearer token as a SecureString.

.PARAMETER AssemblyName
    Optional exact assembly-name filter. If omitted, all accessible plug-in assemblies are inventoried.

.EXAMPLE
    $token = Read-Host 'Dataverse access token' -AsSecureString
    .\Get-PluginRegistrationInventory.ps1 `
        -EnvironmentUrl 'https://contoso.crm.dynamics.com' `
        -AccessToken $token `
        -AssemblyName 'Contoso.Plugins' `
        -JsonOutputPath '.\plugins.json'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$EnvironmentUrl,

    [Parameter(Mandatory)]
    [System.Security.SecureString]$AccessToken,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$AssemblyName,

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

$assemblyFilter = $null
if (-not [string]::IsNullOrWhiteSpace($AssemblyName)) {
    $assemblyFilter = "name eq '$($AssemblyName.Replace("'", "''"))'"
}

$assembliesResult = Invoke-DataverseRowsSafe `
    -Label 'plug-in assemblies' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'pluginassemblies' -Select @('pluginassemblyid','name','version','isolationmode','sourcetype','ismanaged','modifiedon') -Filter $assemblyFilter -Top $MaxRows) `
    -MaxRows $MaxRows
if ($assembliesResult.Error) {
    throw $assembliesResult.Error
}
if ($AssemblyName -and $assembliesResult.Data.Count -eq 0) {
    throw "Plug-in assembly '$AssemblyName' was not found."
}

$typesResult = Invoke-DataverseRowsSafe `
    -Label 'plug-in types' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'plugintypes' -Select @('plugintypeid','name','typename','friendlyname','_pluginassemblyid_value','modifiedon') -Top $MaxRows) `
    -MaxRows $MaxRows
if ($typesResult.Error) {
    $errors.Add([ordered]@{ section = $typesResult.Label; error = Protect-OperationalText $typesResult.Error })
}

$stepsResult = Invoke-DataverseRowsSafe `
    -Label 'SDK message processing steps' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'sdkmessageprocessingsteps' -Select @('sdkmessageprocessingstepid','name','stage','mode','rank','statecode','statuscode','supporteddeployment','filteringattributes','configuration','modifiedon','_sdkmessageid_value','_sdkmessagefilterid_value','_eventhandler_value','_sdkmessageprocessingstepsecureconfigid_value') -Top $MaxRows) `
    -MaxRows $MaxRows
if ($stepsResult.Error) {
    $errors.Add([ordered]@{ section = $stepsResult.Label; error = Protect-OperationalText $stepsResult.Error })
}

$messagesResult = Invoke-DataverseRowsSafe `
    -Label 'SDK messages' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'sdkmessages' -Select @('sdkmessageid','name') -Top $MaxRows) `
    -MaxRows $MaxRows
if ($messagesResult.Error) {
    $errors.Add([ordered]@{ section = $messagesResult.Label; error = Protect-OperationalText $messagesResult.Error })
}

$filtersResult = Invoke-DataverseRowsSafe `
    -Label 'SDK message filters' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'sdkmessagefilters' -Select @('sdkmessagefilterid','primaryobjecttypecode','secondaryobjecttypecode') -Top $MaxRows) `
    -MaxRows $MaxRows
if ($filtersResult.Error) {
    $errors.Add([ordered]@{ section = $filtersResult.Label; error = Protect-OperationalText $filtersResult.Error })
}

$imagesResult = Invoke-DataverseRowsSafe `
    -Label 'SDK message processing step images' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'sdkmessageprocessingstepimages' -Select @('sdkmessageprocessingstepimageid','name','imagetype','attributes','entityalias','messagepropertyname','_sdkmessageprocessingstepid_value') -Top $MaxRows) `
    -MaxRows $MaxRows
if ($imagesResult.Error) {
    $errors.Add([ordered]@{ section = $imagesResult.Label; error = Protect-OperationalText $imagesResult.Error })
}

$assemblyById = @{}
$assemblyOutput = @(
    foreach ($assembly in $assembliesResult.Data) {
        $id = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $assembly 'pluginassemblyid')
        if ($id) {
            $assemblyById[$id] = [string](Get-ObjectPropertyValue $assembly 'name')
        }
        [ordered]@{
            assemblyId = $id
            assembly = [string](Get-ObjectPropertyValue $assembly 'name')
            assemblyVersion = [string](Get-ObjectPropertyValue $assembly 'version')
            isolationMode = Get-ObjectPropertyValue $assembly 'isolationmode'
            sourceType = Get-ObjectPropertyValue $assembly 'sourcetype'
            managed = Get-ObjectPropertyValue $assembly 'ismanaged'
            modifiedOn = Get-ObjectPropertyValue $assembly 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object assembly

$selectedAssemblyIds = @($assemblyOutput | ForEach-Object { $_.assemblyId } | Where-Object { $_ })

$typeById = @{}
$typeOutput = @(
    foreach ($type in $typesResult.Data) {
        $assemblyId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $type '_pluginassemblyid_value')
        if ($selectedAssemblyIds -notcontains $assemblyId) {
            continue
        }
        $id = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $type 'plugintypeid')
        $assemblyResolvedName = if ($assemblyId -and $assemblyById.ContainsKey($assemblyId)) { $assemblyById[$assemblyId] } else { $null }
        $item = [ordered]@{
            pluginTypeId = $id
            assembly = $assemblyResolvedName
            name = [string](Get-ObjectPropertyValue $type 'name')
            typeName = [string](Get-ObjectPropertyValue $type 'typename')
            friendlyName = [string](Get-ObjectPropertyValue $type 'friendlyname')
            modifiedOn = Get-ObjectPropertyValue $type 'modifiedon'
        }
        if ($id) {
            $typeById[$id] = $item
        }
        $item
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object assembly, typeName

$messageById = @{}
foreach ($message in $messagesResult.Data) {
    $id = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $message 'sdkmessageid')
    if ($id) {
        $messageById[$id] = [string](Get-ObjectPropertyValue $message 'name')
    }
}

$filterById = @{}
foreach ($filter in $filtersResult.Data) {
    $id = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $filter 'sdkmessagefilterid')
    if ($id) {
        $filterById[$id] = [ordered]@{
            primaryEntity = Get-ObjectPropertyValue $filter 'primaryobjecttypecode'
            secondaryEntity = Get-ObjectPropertyValue $filter 'secondaryobjecttypecode'
        }
    }
}

$imagesByStep = @{}
foreach ($image in $imagesResult.Data) {
    $stepId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $image '_sdkmessageprocessingstepid_value')
    if (-not $stepId) {
        continue
    }
    if (-not $imagesByStep.ContainsKey($stepId)) {
        $imagesByStep[$stepId] = [System.Collections.Generic.List[object]]::new()
    }

    $attributes = @(
        ([string](Get-ObjectPropertyValue $image 'attributes')).Split(',', [StringSplitOptions]::RemoveEmptyEntries) |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ } |
            Sort-Object -Unique
    )
    $imageType = Get-ObjectPropertyValue $image 'imagetype'
    $imagesByStep[$stepId].Add([ordered]@{
        imageId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $image 'sdkmessageprocessingstepimageid')
        name = [string](Get-ObjectPropertyValue $image 'name')
        imageType = $imageType
        imageTypeName = switch ($imageType) {
            0 { 'PreImage' }
            1 { 'PostImage' }
            2 { 'Both' }
            default { 'Unknown' }
        }
        entityAlias = [string](Get-ObjectPropertyValue $image 'entityalias')
        messagePropertyName = [string](Get-ObjectPropertyValue $image 'messagepropertyname')
        attributes = $attributes
    })
}

$registrations = @(
    foreach ($step in $stepsResult.Data) {
        $typeId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $step '_eventhandler_value')
        if (-not $typeId -or -not $typeById.ContainsKey($typeId)) {
            continue
        }

        $typeInfo = $typeById[$typeId]
        $stepId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $step 'sdkmessageprocessingstepid')
        $messageId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $step '_sdkmessageid_value')
        $filterId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $step '_sdkmessagefilterid_value')
        $filterInfo = if ($filterId -and $filterById.ContainsKey($filterId)) { $filterById[$filterId] } else { $null }
        $stage = Get-ObjectPropertyValue $step 'stage'
        $mode = Get-ObjectPropertyValue $step 'mode'
        $deployment = Get-ObjectPropertyValue $step 'supporteddeployment'
        $stateCode = Get-ObjectPropertyValue $step 'statecode'

        $filteringAttributes = @(
            ([string](Get-ObjectPropertyValue $step 'filteringattributes')).Split(',', [StringSplitOptions]::RemoveEmptyEntries) |
                ForEach-Object { $_.Trim() } |
                Where-Object { $_ } |
                Sort-Object -Unique
        )

        $matchingAssembly = @($assemblyOutput | Where-Object { $_.assembly -eq $typeInfo.assembly } | Select-Object -First 1)
        $assemblyVersion = if ($matchingAssembly.Count -eq 1) { $matchingAssembly[0].assemblyVersion } else { $null }

        [ordered]@{
            stepId = $stepId
            stepName = [string](Get-ObjectPropertyValue $step 'name')
            assembly = $typeInfo.assembly
            assemblyVersion = $assemblyVersion
            pluginType = $typeInfo.typeName
            message = if ($messageId -and $messageById.ContainsKey($messageId)) { $messageById[$messageId] } else { $null }
            primaryEntity = if ($filterInfo) { $filterInfo.primaryEntity } else { $null }
            secondaryEntity = if ($filterInfo) { $filterInfo.secondaryEntity } else { $null }
            stage = $stage
            stageName = switch ($stage) {
                10 { 'PreValidation' }
                20 { 'PreOperation' }
                40 { 'PostOperation' }
                default { 'Unknown' }
            }
            executionMode = $mode
            executionModeName = switch ($mode) {
                0 { 'Synchronous' }
                1 { 'Asynchronous' }
                default { 'Unknown' }
            }
            rank = Get-ObjectPropertyValue $step 'rank'
            state = if ($stateCode -eq 0) { 'ENABLED' } else { 'DISABLED' }
            stateCode = $stateCode
            statusCode = Get-ObjectPropertyValue $step 'statuscode'
            deployment = $deployment
            deploymentName = switch ($deployment) {
                0 { 'ServerOnly' }
                1 { 'OutlookClientOnly' }
                2 { 'Both' }
                default { 'Unknown' }
            }
            filteringAttributes = $filteringAttributes
            preImages = @(
                if ($stepId -and $imagesByStep.ContainsKey($stepId)) {
                    $imagesByStep[$stepId] | Where-Object { $_.imageType -in @(0,2) } | Sort-Object entityAlias, name
                }
            )
            postImages = @(
                if ($stepId -and $imagesByStep.ContainsKey($stepId)) {
                    $imagesByStep[$stepId] | Where-Object { $_.imageType -in @(1,2) } | Sort-Object entityAlias, name
                }
            )
            secureConfigurationPresent = Test-ValuePresent (Get-ObjectPropertyValue $step '_sdkmessageprocessingstepsecureconfigid_value')
            unsecureConfigurationPresent = Test-ValuePresent (Get-ObjectPropertyValue $step 'configuration')
            modifiedOn = Get-ObjectPropertyValue $step 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object assembly, pluginType, message, primaryEntity, stepName

$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{
        name = 'Get-PluginRegistrationInventory'
        version = '1.0.0'
        maturity = 'Experimental'
    }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'READ_ONLY_REMOTE'
    safetyClassification = 'READ_ONLY_REMOTE'
    environment = $environmentBaseUrl
    filter = [ordered]@{
        assemblyName = if ($AssemblyName) { $AssemblyName } else { $null }
    }
    assemblies = $assemblyOutput
    pluginTypes = $typeOutput
    registrations = $registrations
    errors = @($errors)
    limitations = @(
        'Secure and unsecure configuration values are deliberately not included; only presence is reported.',
        'Message/filter metadata can be unavailable under restricted security roles; unresolved names remain null rather than being guessed.'
    )
    summary = [ordered]@{
        classification = if ($errors.Count -gt 0) { 'INVENTORY_COMPLETE_WITH_GAPS' } else { 'INVENTORY_COMPLETE' }
        assemblies = $assemblyOutput.Count
        pluginTypes = $typeOutput.Count
        steps = $registrations.Count
        disabledSteps = @($registrations | Where-Object { $_.state -eq 'DISABLED' }).Count
        stepsWithSecureConfiguration = @($registrations | Where-Object { $_.secureConfigurationPresent }).Count
        stepsWithUnsecureConfiguration = @($registrations | Where-Object { $_.unsecureConfigurationPresent }).Count
        nonBlockingErrors = $errors.Count
    }
}

$summary = @"
Plug-in registration inventory
Environment: $environmentBaseUrl
Classification: $($report.summary.classification)
Assemblies: $($assemblyOutput.Count)
Plug-in types: $($typeOutput.Count)
Steps: $($registrations.Count)
Disabled steps: $($report.summary.disabledSteps)
Non-blocking query errors: $($errors.Count)
Secret/configuration content emitted: NO
"@

Write-ReportOutputs -Report $report -SummaryText $summary -JsonOutputPath $JsonOutputPath -SummaryOutputPath $SummaryOutputPath
