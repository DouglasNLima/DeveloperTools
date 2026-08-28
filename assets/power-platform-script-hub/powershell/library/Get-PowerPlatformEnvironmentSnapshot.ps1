<#
.SYNOPSIS
    Captures a read-only Power Platform / Dataverse environment snapshot.

.DESCRIPTION
    Reads organisation metadata and selected ALM/runtime configuration from Dataverse and writes a
    deterministic, secret-safe JSON model suitable for later comparison. Environment-variable values,
    connection IDs, plug-in secure configuration and plug-in unsecure configuration content are never
    written to the report.

    Execution context: read-only remote Dataverse operations, with optional local report-file writes.
    Safety classification: READ_ONLY_REMOTE.

.PARAMETER EnvironmentUrl
    Absolute HTTPS Dataverse environment URL.

.PARAMETER AccessToken
    Dataverse OAuth bearer token as a SecureString. The token is used in memory and is never written.

.PARAMETER ApiVersion
    Dataverse Web API version. Defaults to v9.2.

.PARAMETER MaxRows
    Maximum rows collected per evidence surface.

.PARAMETER JsonOutputPath
    Optional existing-directory path for JSON output.

.PARAMETER SummaryOutputPath
    Optional existing-directory path for the text summary.

.EXAMPLE
    $token = Read-Host 'Dataverse access token' -AsSecureString
    .\Get-PowerPlatformEnvironmentSnapshot.ps1 `
        -EnvironmentUrl 'https://contoso.crm.dynamics.com' `
        -AccessToken $token `
        -JsonOutputPath '.\snapshot.json'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$EnvironmentUrl,

    [Parameter(Mandatory)]
    [System.Security.SecureString]$AccessToken,

    [Parameter()]
    [ValidatePattern('^v\d+\.\d+$')]
    [string]$ApiVersion = 'v9.2',

    [Parameter()]
    [ValidateRange(1, 100000)]
    [int]$MaxRows = 5000,

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

function Add-QueryError {
    param([Parameter(Mandatory)][psobject]$Result)
    if (-not [string]::IsNullOrWhiteSpace([string]$Result.Error)) {
        $script:errors.Add([ordered]@{
            section = $Result.Label
            error = Protect-OperationalText $Result.Error
        })
    }
}

$whoAmI = $null
$serverVersion = $null
try {
    $whoAmI = Invoke-DataverseGet -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -BearerToken $token -RelativeOrAbsoluteUri 'WhoAmI'
}
catch {
    $errors.Add([ordered]@{ section = 'WhoAmI'; error = Protect-OperationalText $_.Exception.Message })
}
try {
    $versionResponse = Invoke-DataverseGet -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -BearerToken $token -RelativeOrAbsoluteUri 'RetrieveVersion'
    $serverVersion = [string](Get-ObjectPropertyValue -InputObject $versionResponse -Name 'Version')
}
catch {
    $errors.Add([ordered]@{ section = 'RetrieveVersion'; error = Protect-OperationalText $_.Exception.Message })
}

$organisationResult = Invoke-DataverseRowsSafe `
    -Label 'organisation' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'organizations' -Select @('organizationid','name','friendlyname','uniquename') -Top 10) `
    -MaxRows 10
Add-QueryError $organisationResult

$solutionsResult = Invoke-DataverseRowsSafe `
    -Label 'solutions' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'solutions' -Select @('solutionid','uniquename','friendlyname','version','ismanaged','installedon','solutiontype','_parentsolutionid_value') -Filter "uniquename ne 'Active' and uniquename ne 'Default'" -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $solutionsResult

$pcfResult = Invoke-DataverseRowsSafe `
    -Label 'custom controls' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'customcontrols' -Select @('customcontrolid','name','version','ismanaged','componentstate','modifiedon') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $pcfResult

$assembliesResult = Invoke-DataverseRowsSafe `
    -Label 'plug-in assemblies' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'pluginassemblies' -Select @('pluginassemblyid','name','version','isolationmode','sourcetype','ismanaged','modifiedon') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $assembliesResult

$typesResult = Invoke-DataverseRowsSafe `
    -Label 'plug-in types' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'plugintypes' -Select @('plugintypeid','name','typename','friendlyname','_pluginassemblyid_value','modifiedon') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $typesResult

$stepsResult = Invoke-DataverseRowsSafe `
    -Label 'plug-in steps' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'sdkmessageprocessingsteps' -Select @('sdkmessageprocessingstepid','name','stage','mode','rank','statecode','statuscode','supporteddeployment','filteringattributes','configuration','modifiedon','_sdkmessageid_value','_sdkmessagefilterid_value','_eventhandler_value','_sdkmessageprocessingstepsecureconfigid_value') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $stepsResult

$messagesResult = Invoke-DataverseRowsSafe `
    -Label 'SDK messages' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'sdkmessages' -Select @('sdkmessageid','name') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $messagesResult

$filtersResult = Invoke-DataverseRowsSafe `
    -Label 'SDK message filters' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'sdkmessagefilters' -Select @('sdkmessagefilterid','primaryobjecttypecode','secondaryobjecttypecode','_sdkmessageid_value') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $filtersResult

$imagesResult = Invoke-DataverseRowsSafe `
    -Label 'plug-in step images' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'sdkmessageprocessingstepimages' -Select @('sdkmessageprocessingstepimageid','name','imagetype','attributes','entityalias','messagepropertyname','_sdkmessageprocessingstepid_value') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $imagesResult

$flowsResult = Invoke-DataverseRowsSafe `
    -Label 'cloud flows' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'workflows' -Select @('workflowid','name','statecode','statuscode','category','modifiedon','_ownerid_value') -Filter 'category eq 5' -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $flowsResult

$envDefinitionsResult = Invoke-DataverseRowsSafe `
    -Label 'environment variable definitions' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'environmentvariabledefinitions' -Select @('environmentvariabledefinitionid','schemaname','displayname','type','defaultvalue','isrequired','secretstore','statecode','ismanaged','modifiedon') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $envDefinitionsResult

$envValuesResult = Invoke-DataverseRowsSafe `
    -Label 'environment variable values' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'environmentvariablevalues' -Select @('environmentvariablevalueid','value','statecode','modifiedon','_environmentvariabledefinitionid_value') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $envValuesResult

$connectionResult = Invoke-DataverseRowsSafe `
    -Label 'connection references' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'connectionreferences' -Select @('connectionreferenceid','connectionreferencelogicalname','connectionreferencedisplayname','connectorid','connectionid','statecode','statuscode','ismanaged','modifiedon') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $connectionResult

$componentsResult = Invoke-DataverseRowsSafe `
    -Label 'solution components' `
    -EnvironmentBaseUrl $environmentBaseUrl `
    -ApiVersion $ApiVersion `
    -BearerToken $token `
    -RelativeUri (New-ODataRelativeUri -EntitySet 'solutioncomponents' -Select @('solutioncomponentid','componenttype','objectid','rootsolutioncomponentid','rootcomponentbehavior','ismetadata','_solutionid_value') -Top $MaxRows) `
    -MaxRows $MaxRows
Add-QueryError $componentsResult

if ($componentsResult.Data.Count -ge $MaxRows) {
    $limitations.Add("Solution-component inventory reached MaxRows=$MaxRows and may be truncated.")
}

$solutionById = @{}
foreach ($solution in $solutionsResult.Data) {
    $id = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $solution 'solutionid')
    if ($id) {
        $solutionById[$id] = [string](Get-ObjectPropertyValue $solution 'uniquename')
    }
}

$assemblyById = @{}
foreach ($assembly in $assembliesResult.Data) {
    $id = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $assembly 'pluginassemblyid')
    if ($id) {
        $assemblyById[$id] = [string](Get-ObjectPropertyValue $assembly 'name')
    }
}

$typeById = @{}
foreach ($type in $typesResult.Data) {
    $id = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $type 'plugintypeid')
    if ($id) {
        $assemblyId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $type '_pluginassemblyid_value')
        $typeById[$id] = [ordered]@{
            name = [string](Get-ObjectPropertyValue $type 'name')
            typeName = [string](Get-ObjectPropertyValue $type 'typename')
            assemblyName = if ($assemblyId -and $assemblyById.ContainsKey($assemblyId)) { $assemblyById[$assemblyId] } else { $null }
        }
    }
}

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

    $imagesByStep[$stepId].Add([ordered]@{
        name = [string](Get-ObjectPropertyValue $image 'name')
        imageType = Get-ObjectPropertyValue $image 'imagetype'
        entityAlias = [string](Get-ObjectPropertyValue $image 'entityalias')
        messagePropertyName = [string](Get-ObjectPropertyValue $image 'messagepropertyname')
        attributes = $attributes
    })
}

$pluginSteps = @(
    foreach ($step in $stepsResult.Data) {
        $stepId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $step 'sdkmessageprocessingstepid')
        $typeId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $step '_eventhandler_value')
        $messageId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $step '_sdkmessageid_value')
        $filterId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $step '_sdkmessagefilterid_value')
        $typeInfo = if ($typeId -and $typeById.ContainsKey($typeId)) { $typeById[$typeId] } else { $null }
        $filterInfo = if ($filterId -and $filterById.ContainsKey($filterId)) { $filterById[$filterId] } else { $null }

        $filteringAttributes = @(
            ([string](Get-ObjectPropertyValue $step 'filteringattributes')).Split(',', [StringSplitOptions]::RemoveEmptyEntries) |
                ForEach-Object { $_.Trim() } |
                Where-Object { $_ } |
                Sort-Object -Unique
        )

        [ordered]@{
            stepId = $stepId
            stepName = [string](Get-ObjectPropertyValue $step 'name')
            assemblyName = if ($typeInfo) { $typeInfo.assemblyName } else { $null }
            pluginTypeName = if ($typeInfo) { $typeInfo.typeName } else { $null }
            message = if ($messageId -and $messageById.ContainsKey($messageId)) { $messageById[$messageId] } else { $null }
            primaryEntity = if ($filterInfo) { $filterInfo.primaryEntity } else { $null }
            stage = Get-ObjectPropertyValue $step 'stage'
            mode = Get-ObjectPropertyValue $step 'mode'
            rank = Get-ObjectPropertyValue $step 'rank'
            stateCode = Get-ObjectPropertyValue $step 'statecode'
            statusCode = Get-ObjectPropertyValue $step 'statuscode'
            supportedDeployment = Get-ObjectPropertyValue $step 'supporteddeployment'
            filteringAttributes = $filteringAttributes
            secureConfigurationPresent = Test-ValuePresent (Get-ObjectPropertyValue $step '_sdkmessageprocessingstepsecureconfigid_value')
            unsecureConfigurationPresent = Test-ValuePresent (Get-ObjectPropertyValue $step 'configuration')
            images = @(
                if ($stepId -and $imagesByStep.ContainsKey($stepId)) {
                    $imagesByStep[$stepId] | Sort-Object imageType, entityAlias, name
                }
            )
            modifiedOn = Get-ObjectPropertyValue $step 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object assemblyName, pluginTypeName, message, primaryEntity, stepName

$valuesByDefinition = @{}
foreach ($value in $envValuesResult.Data) {
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
    foreach ($definition in $envDefinitionsResult.Data) {
        $definitionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $definition 'environmentvariabledefinitionid')
        $values = if ($definitionId -and $valuesByDefinition.ContainsKey($definitionId)) { @($valuesByDefinition[$definitionId]) } else { @() }
        $activeValues = @($values | Where-Object { (Get-ObjectPropertyValue $_ 'statecode') -eq 0 })
        $presentActiveValues = @($activeValues | Where-Object { Test-ValuePresent (Get-ObjectPropertyValue $_ 'value') })

        [ordered]@{
            definitionId = $definitionId
            schemaName = [string](Get-ObjectPropertyValue $definition 'schemaname')
            displayName = [string](Get-ObjectPropertyValue $definition 'displayname')
            type = Get-ObjectPropertyValue $definition 'type'
            isSecretType = ((Get-ObjectPropertyValue $definition 'type') -eq 100000005)
            isRequired = Get-ObjectPropertyValue $definition 'isrequired'
            defaultValuePresent = Test-ValuePresent (Get-ObjectPropertyValue $definition 'defaultvalue')
            activeCurrentValueCount = $activeValues.Count
            currentValuePresent = ($presentActiveValues.Count -gt 0)
            stateCode = Get-ObjectPropertyValue $definition 'statecode'
            isManaged = Get-ObjectPropertyValue $definition 'ismanaged'
            modifiedOn = Get-ObjectPropertyValue $definition 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object schemaName

$connectionReferences = @(
    foreach ($connection in $connectionResult.Data) {
        $connectionPresent = Test-ValuePresent (Get-ObjectPropertyValue $connection 'connectionid')
        [ordered]@{
            connectionReferenceId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $connection 'connectionreferenceid')
            logicalName = [string](Get-ObjectPropertyValue $connection 'connectionreferencelogicalname')
            displayName = [string](Get-ObjectPropertyValue $connection 'connectionreferencedisplayname')
            connectorId = [string](Get-ObjectPropertyValue $connection 'connectorid')
            connectionIdPresent = $connectionPresent
            resolutionState = if ($connectionPresent) { 'RESOLVED' } else { 'UNRESOLVED' }
            stateCode = Get-ObjectPropertyValue $connection 'statecode'
            statusCode = Get-ObjectPropertyValue $connection 'statuscode'
            isManaged = Get-ObjectPropertyValue $connection 'ismanaged'
            modifiedOn = Get-ObjectPropertyValue $connection 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object logicalName

$flowSolutionMembership = @{}
foreach ($component in $componentsResult.Data) {
    if ((Get-ObjectPropertyValue $component 'componenttype') -ne 29) {
        continue
    }
    $objectId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $component 'objectid')
    $solutionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $component '_solutionid_value')
    if (-not $objectId -or -not $solutionId -or -not $solutionById.ContainsKey($solutionId)) {
        continue
    }
    if (-not $flowSolutionMembership.ContainsKey($objectId)) {
        $flowSolutionMembership[$objectId] = [System.Collections.Generic.List[string]]::new()
    }
    $flowSolutionMembership[$objectId].Add($solutionById[$solutionId])
}

$flows = @(
    foreach ($flow in $flowsResult.Data) {
        $flowId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $flow 'workflowid')
        $memberships = @(
            if ($flowId -and $flowSolutionMembership.ContainsKey($flowId)) {
                $flowSolutionMembership[$flowId] | Sort-Object -Unique
            }
        )
        [ordered]@{
            flowId = $flowId
            name = [string](Get-ObjectPropertyValue $flow 'name')
            stateCode = Get-ObjectPropertyValue $flow 'statecode'
            statusCode = Get-ObjectPropertyValue $flow 'statuscode'
            enabledState = if ((Get-ObjectPropertyValue $flow 'statecode') -eq 1) { 'ENABLED' } else { 'DISABLED' }
            ownerId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $flow '_ownerid_value')
            ownerDisplayName = Get-FormattedValue -InputObject $flow -AttributeName '_ownerid_value'
            solutionMembership = $memberships
            modifiedOn = Get-ObjectPropertyValue $flow 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object name, flowId

$solutions = @(
    foreach ($solution in $solutionsResult.Data) {
        [ordered]@{
            solutionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $solution 'solutionid')
            uniqueName = [string](Get-ObjectPropertyValue $solution 'uniquename')
            friendlyName = [string](Get-ObjectPropertyValue $solution 'friendlyname')
            version = [string](Get-ObjectPropertyValue $solution 'version')
            managed = Get-ObjectPropertyValue $solution 'ismanaged'
            installedOn = Get-ObjectPropertyValue $solution 'installedon'
            solutionType = Get-ObjectPropertyValue $solution 'solutiontype'
            parentSolutionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $solution '_parentsolutionid_value')
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object uniqueName

$pcfs = @(
    foreach ($pcf in $pcfResult.Data) {
        [ordered]@{
            controlId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $pcf 'customcontrolid')
            name = [string](Get-ObjectPropertyValue $pcf 'name')
            version = [string](Get-ObjectPropertyValue $pcf 'version')
            managed = Get-ObjectPropertyValue $pcf 'ismanaged'
            componentState = Get-ObjectPropertyValue $pcf 'componentstate'
            modifiedOn = Get-ObjectPropertyValue $pcf 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object name

$pluginAssemblies = @(
    foreach ($assembly in $assembliesResult.Data) {
        [ordered]@{
            assemblyId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $assembly 'pluginassemblyid')
            name = [string](Get-ObjectPropertyValue $assembly 'name')
            version = [string](Get-ObjectPropertyValue $assembly 'version')
            isolationMode = Get-ObjectPropertyValue $assembly 'isolationmode'
            sourceType = Get-ObjectPropertyValue $assembly 'sourcetype'
            managed = Get-ObjectPropertyValue $assembly 'ismanaged'
            modifiedOn = Get-ObjectPropertyValue $assembly 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object name

$pluginTypes = @(
    foreach ($type in $typesResult.Data) {
        $assemblyId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $type '_pluginassemblyid_value')
        [ordered]@{
            pluginTypeId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $type 'plugintypeid')
            name = [string](Get-ObjectPropertyValue $type 'name')
            typeName = [string](Get-ObjectPropertyValue $type 'typename')
            friendlyName = [string](Get-ObjectPropertyValue $type 'friendlyname')
            assemblyName = if ($assemblyId -and $assemblyById.ContainsKey($assemblyId)) { $assemblyById[$assemblyId] } else { $null }
            modifiedOn = Get-ObjectPropertyValue $type 'modifiedon'
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object assemblyName, typeName

$componentMetadata = @(
    foreach ($component in $componentsResult.Data) {
        $solutionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $component '_solutionid_value')
        [ordered]@{
            solutionComponentId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $component 'solutioncomponentid')
            componentType = Get-ObjectPropertyValue $component 'componenttype'
            objectId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $component 'objectid')
            rootSolutionComponentId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $component 'rootsolutioncomponentid')
            rootComponentBehaviour = Get-ObjectPropertyValue $component 'rootcomponentbehavior'
            isMetadata = Get-ObjectPropertyValue $component 'ismetadata'
            solutionUniqueName = if ($solutionId -and $solutionById.ContainsKey($solutionId)) { $solutionById[$solutionId] } else { $null }
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object solutionUniqueName, componentType, objectId

$organisation = @(
    foreach ($item in $organisationResult.Data) {
        [ordered]@{
            organisationId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $item 'organizationid')
            name = [string](Get-ObjectPropertyValue $item 'name')
            friendlyName = [string](Get-ObjectPropertyValue $item 'friendlyname')
            uniqueName = [string](Get-ObjectPropertyValue $item 'uniquename')
        }
    }
    $null
) | Where-Object { $null -ne $_ } | Sort-Object uniqueName

$fingerprint = [ordered]@{
    solutions = $solutions
    pcfs = $pcfs
    pluginAssemblies = $pluginAssemblies
    pluginTypes = $pluginTypes
    pluginSteps = $pluginSteps
    flows = $flows
    environmentVariables = $environmentVariables
    connectionReferences = $connectionReferences
    componentMetadata = $componentMetadata
}

$fingerprintJson = $fingerprint | ConvertTo-Json -Depth 30 -Compress
$fingerprintSha256 = Get-TextSha256 -Text $fingerprintJson

$classification = if ($errors.Count -gt 0) { 'SNAPSHOT_COMPLETE_WITH_GAPS' } else { 'SNAPSHOT_COMPLETE' }

$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{
        name = 'Get-PowerPlatformEnvironmentSnapshot'
        version = '1.0.0'
        maturity = 'Experimental'
    }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'READ_ONLY_REMOTE'
    safetyClassification = 'READ_ONLY_REMOTE'
    environment = [ordered]@{
        url = $environmentBaseUrl
        dataverseVersion = $serverVersion
        whoAmI = [ordered]@{
            userId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $whoAmI 'UserId')
            businessUnitId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $whoAmI 'BusinessUnitId')
            organisationId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $whoAmI 'OrganizationId')
        }
        organisation = $organisation
    }
    fingerprint = $fingerprint
    fingerprintSha256 = $fingerprintSha256
    limitations = @($limitations)
    errors = @($errors)
    summary = [ordered]@{
        classification = $classification
        solutions = $solutions.Count
        pcfs = $pcfs.Count
        pluginAssemblies = $pluginAssemblies.Count
        pluginTypes = $pluginTypes.Count
        pluginSteps = $pluginSteps.Count
        flows = $flows.Count
        environmentVariables = $environmentVariables.Count
        connectionReferences = $connectionReferences.Count
        solutionComponents = $componentMetadata.Count
        nonBlockingErrors = $errors.Count
    }
}

$summary = @"
Power Platform environment snapshot
Environment: $environmentBaseUrl
Classification: $classification
Solutions: $($solutions.Count)
PCFs: $($pcfs.Count)
Plug-in assemblies: $($pluginAssemblies.Count)
Plug-in types: $($pluginTypes.Count)
Plug-in steps: $($pluginSteps.Count)
Cloud flows: $($flows.Count)
Environment variables: $($environmentVariables.Count)
Connection references: $($connectionReferences.Count)
Solution components: $($componentMetadata.Count)
Fingerprint SHA-256: $fingerprintSha256
Non-blocking query errors: $($errors.Count)
"@

Write-ReportOutputs -Report $report -SummaryText $summary -JsonOutputPath $JsonOutputPath -SummaryOutputPath $SummaryOutputPath
