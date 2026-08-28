<#
.SYNOPSIS
    Assesses whether a Power Platform solution package appears ready for a target Dataverse environment.

.DESCRIPTION
    Performs a read-only target assessment and local solution-package inspection. The script never imports,
    publishes, stages, upgrades or otherwise changes Dataverse. Where Power Platform CLI is available it may
    run the local-only 'pac solution create-settings' command against the supplied ZIP to discover environment
    variable and connection-reference requirements.

    Conditions that cannot be established reliably are reported explicitly as UNKNOWN or as limitations.

    Execution context: read-only remote Dataverse operations plus local solution ZIP inspection.
    Safety classification: READ_ONLY_REMOTE_AND_LOCAL_INSPECTION.

.PARAMETER SolutionZipPath
    Path to a managed or unmanaged Dataverse solution ZIP.

.PARAMETER EnvironmentUrl
    Absolute HTTPS Dataverse environment URL.

.PARAMETER AccessToken
    Dataverse OAuth bearer token as a SecureString. It is used only in memory and is never written.

.PARAMETER RequireResolvedReferences
    Treat unresolved required environment variables or connection references discovered by PAC settings
    generation as blocking rather than warning conditions.

.PARAMETER JsonOutputPath
    Optional path for the JSON assessment. The parent directory must already exist.

.PARAMETER SummaryOutputPath
    Optional path for the text summary. The parent directory must already exist.

.EXAMPLE
    $token = Read-Host 'Dataverse access token' -AsSecureString
    .\Test-SolutionTargetReadiness.ps1 `
        -SolutionZipPath '.\Example_managed.zip' `
        -EnvironmentUrl 'https://contoso.crm.dynamics.com' `
        -AccessToken $token
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$SolutionZipPath,

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
    [switch]$RequireResolvedReferences,

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



function Get-RequiredLeafFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path,
        [Parameter(Mandatory)]
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Description was not found at '$Path'."
    }

    return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
}

function Read-ZipEntryText {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [System.IO.Compression.ZipArchiveEntry]$Entry
    )

    $stream = $Entry.Open()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $true)
    try {
        return $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}

function Get-SolutionPackageMetadata {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ZipPath
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $solutionEntries = @(
            $archive.Entries |
                Where-Object { $_.FullName -match '(^|/)solution\.xml$' } |
                Sort-Object FullName
        )

        if ($solutionEntries.Count -ne 1) {
            throw "Expected exactly one solution.xml in '$ZipPath', but found $($solutionEntries.Count)."
        }

        [xml]$solutionXml = Read-ZipEntryText -Entry $solutionEntries[0]
        $manifest = $solutionXml.SelectSingleNode("/*[local-name()='ImportExportXml']/*[local-name()='SolutionManifest']")
        if (-not $manifest) {
            throw "solution.xml in '$ZipPath' does not contain a SolutionManifest element."
        }

        function Get-ChildText {
            param([System.Xml.XmlNode]$Parent, [string]$LocalName)
            $node = $Parent.SelectSingleNode("*[local-name()='$LocalName']")
            if ($node) { return [string]$node.InnerText }
            return $null
        }

        $uniqueName = Get-ChildText $manifest 'UniqueName'
        $version = Get-ChildText $manifest 'Version'
        $managedText = Get-ChildText $manifest 'Managed'
        $parentUniqueName = Get-ChildText $manifest 'ParentSolutionUniqueName'

        if ([string]::IsNullOrWhiteSpace($uniqueName)) {
            throw 'The solution package does not declare a solution unique name.'
        }
        if ([string]::IsNullOrWhiteSpace($version)) {
            throw 'The solution package does not declare a solution version.'
        }

        $managed = switch ($managedText) {
            '1' { $true }
            '0' { $false }
            default { $null }
        }

        $rootComponents = @(
            $manifest.SelectNodes(".//*[local-name()='RootComponents']/*[local-name()='RootComponent']") |
                ForEach-Object {
                    [ordered]@{
                        type = if ($_.Attributes['type']) { [int]$_.Attributes['type'].Value } else { $null }
                        schemaName = if ($_.Attributes['schemaName']) { [string]$_.Attributes['schemaName'].Value } else { $null }
                        id = if ($_.Attributes['id']) { ([string]$_.Attributes['id'].Value).Trim('{','}').ToLowerInvariant() } else { $null }
                        behaviour = if ($_.Attributes['behavior']) { [string]$_.Attributes['behavior'].Value } else { $null }
                    }
                } |
                Sort-Object type, schemaName, id
        )

        $missingDependencies = @(
            $solutionXml.SelectNodes("//*[local-name()='MissingDependencies']/*[local-name()='MissingDependency']") |
                ForEach-Object {
                    $required = $_.SelectSingleNode("*[local-name()='Required']")
                    $dependent = $_.SelectSingleNode("*[local-name()='Dependent']")
                    [ordered]@{
                        requiredType = if ($required -and $required.Attributes['type']) { [string]$required.Attributes['type'].Value } else { $null }
                        requiredSchemaName = if ($required -and $required.Attributes['schemaName']) { [string]$required.Attributes['schemaName'].Value } else { $null }
                        requiredDisplayName = if ($required -and $required.Attributes['displayName']) { [string]$required.Attributes['displayName'].Value } else { $null }
                        requiredSolution = if ($required -and $required.Attributes['solution']) { [string]$required.Attributes['solution'].Value } else { $null }
                        dependentType = if ($dependent -and $dependent.Attributes['type']) { [string]$dependent.Attributes['type'].Value } else { $null }
                        dependentSchemaName = if ($dependent -and $dependent.Attributes['schemaName']) { [string]$dependent.Attributes['schemaName'].Value } else { $null }
                    }
                } |
                Sort-Object requiredType, requiredSchemaName, dependentType, dependentSchemaName
        )

        $controls = [System.Collections.Generic.List[object]]::new()
        foreach ($entry in @($archive.Entries | Where-Object { $_.FullName -match '(^|/)Controls/.+/ControlManifest\.xml$' } | Sort-Object FullName)) {
            try {
                [xml]$controlXml = Read-ZipEntryText -Entry $entry
                $control = $controlXml.SelectSingleNode("/*[local-name()='manifest']/*[local-name()='control']")
                if (-not $control) { continue }
                $namespace = if ($control.Attributes['namespace']) { [string]$control.Attributes['namespace'].Value } else { $null }
                $constructor = if ($control.Attributes['constructor']) { [string]$control.Attributes['constructor'].Value } else { $null }
                $controlVersion = if ($control.Attributes['version']) { [string]$control.Attributes['version'].Value } else { $null }
                $controls.Add([ordered]@{
                    namespace = $namespace
                    constructor = $constructor
                    manifestIdentity = if ($namespace -and $constructor) { "$namespace.$constructor" } else { $null }
                    version = $controlVersion
                    packageEntry = $entry.FullName
                }) | Out-Null
            }
            catch {
                throw "Failed to parse PCF manifest '$($entry.FullName)': $($_.Exception.Message)"
            }
        }

        $pcfRootNames = @(
            $rootComponents |
                Where-Object { $_.type -eq 66 -and -not [string]::IsNullOrWhiteSpace($_.schemaName) } |
                ForEach-Object { $_.schemaName } |
                Sort-Object -Unique
        )

        $pluginAssemblyNames = @(
            $rootComponents |
                Where-Object { $_.type -eq 91 -and -not [string]::IsNullOrWhiteSpace($_.schemaName) } |
                ForEach-Object { $_.schemaName } |
                Sort-Object -Unique
        )

        return [ordered]@{
            uniqueName = $uniqueName
            version = $version
            managed = $managed
            managedRaw = $managedText
            parentSolutionUniqueName = if ([string]::IsNullOrWhiteSpace($parentUniqueName)) { $null } else { $parentUniqueName }
            rootComponents = $rootComponents
            missingDependencies = $missingDependencies
            pcfRootComponentNames = $pcfRootNames
            controls = @($controls)
            pluginAssemblyNames = $pluginAssemblyNames
            sha256 = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    finally {
        $archive.Dispose()
    }
}

function Get-PacDeploymentRequirements {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ZipPath
    )

    $pac = Get-Command pac, pac.exe, pac.cmd -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $pac) {
        return [ordered]@{
            state = 'UNKNOWN'
            reason = 'Power Platform CLI was not found in PATH, so deployment settings requirements could not be generated.'
            environmentVariables = @()
            connectionReferences = @()
            pacVersion = $null
        }
    }

    $tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('ppsl-readiness-' + [Guid]::NewGuid().ToString('N'))
    $settingsPath = Join-Path $tempRoot 'deployment-settings.json'
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    try {
        $pacCommand = if ($pac.Source) { $pac.Source } else { $pac.Definition }
        $versionOutput = & $pacCommand --version 2>&1
        $versionExit = $LASTEXITCODE
        $pacVersion = if ($versionExit -eq 0) { (@($versionOutput) -join ' ').Trim() } else { $null }

        $createOutput = & $pacCommand solution create-settings --solution-zip $ZipPath --settings-file $settingsPath 2>&1
        $createExit = $LASTEXITCODE
        if ($createExit -ne 0 -or -not (Test-Path -LiteralPath $settingsPath -PathType Leaf)) {
            $tail = Protect-OperationalText (@($createOutput | Select-Object -Last 10) -join [Environment]::NewLine)
            return [ordered]@{
                state = 'UNKNOWN'
                reason = "pac solution create-settings could not generate a deployment settings file. Exit code: $createExit. $tail"
                environmentVariables = @()
                connectionReferences = @()
                pacVersion = $pacVersion
            }
        }

        $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
        $envRequirements = @(
            @((Get-ObjectPropertyValue $settings 'EnvironmentVariables')) |
                ForEach-Object {
                    [ordered]@{
                        schemaName = [string](Get-ObjectPropertyValue $_ 'SchemaName')
                        packageSuppliedValuePresent = Test-ValuePresent (Get-ObjectPropertyValue $_ 'Value')
                    }
                } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_.schemaName) } |
                Sort-Object schemaName
        )
        $connectionRequirements = @(
            @((Get-ObjectPropertyValue $settings 'ConnectionReferences')) |
                ForEach-Object {
                    [ordered]@{
                        logicalName = [string](Get-ObjectPropertyValue $_ 'LogicalName')
                        connectorId = [string](Get-ObjectPropertyValue $_ 'ConnectorId')
                        packageSuppliedConnectionPresent = Test-ValuePresent (Get-ObjectPropertyValue $_ 'ConnectionId')
                    }
                } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_.logicalName) } |
                Sort-Object logicalName
        )

        return [ordered]@{
            state = 'PRESENT'
            reason = $null
            environmentVariables = $envRequirements
            connectionReferences = $connectionRequirements
            pacVersion = $pacVersion
        }
    }
    finally {
        if (Test-Path -LiteralPath $tempRoot) {
            Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function ConvertTo-ComparableVersion {
    [CmdletBinding()]
    param([AllowNull()][string]$VersionText)

    if ([string]::IsNullOrWhiteSpace($VersionText)) { return $null }
    $parts = @($VersionText.Split('.'))
    if ($parts.Count -gt 4) { return $null }
    while ($parts.Count -lt 4) { $parts += '0' }
    foreach ($part in $parts) {
        $number = 0
        if (-not [int]::TryParse($part, [ref]$number) -or $number -lt 0) { return $null }
    }
    try { return [version]($parts -join '.') } catch { return $null }
}

function Add-ReadinessFinding {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][System.Collections.Generic.List[object]]$List,
        [Parameter(Mandatory)][ValidateSet('BLOCKER','WARNING','INFO')][string]$Severity,
        [Parameter(Mandatory)][string]$Code,
        [Parameter(Mandatory)][string]$Message,
        [AllowNull()][object]$Details
    )

    $List.Add([ordered]@{
        severity = $Severity
        code = $Code
        message = $Message
        details = $Details
    }) | Out-Null
}

$resolvedZip = Get-RequiredLeafFile -Path $SolutionZipPath -Description 'Solution ZIP'
if ([IO.Path]::GetExtension($resolvedZip) -ine '.zip') {
    throw "SolutionZipPath must point to a .zip file. Received '$resolvedZip'."
}

$environmentBaseUrl = Assert-DataverseEnvironmentUrl -Url $EnvironmentUrl
$package = Get-SolutionPackageMetadata -ZipPath $resolvedZip
$requirements = Get-PacDeploymentRequirements -ZipPath $resolvedZip

$errors = [System.Collections.Generic.List[object]]::new()
$findings = [System.Collections.Generic.List[object]]::new()

$whoAmI = $null
$serverVersion = $null
try { $whoAmI = Invoke-DataverseGet -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -AccessToken $AccessToken -RelativeOrAbsoluteUri 'WhoAmI' } catch { $errors.Add([ordered]@{ section='WhoAmI'; error=Protect-OperationalText $_.Exception.Message }) | Out-Null }
try { $serverVersion = Invoke-DataverseGet -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -AccessToken $AccessToken -RelativeOrAbsoluteUri 'RetrieveVersion' } catch { $errors.Add([ordered]@{ section='RetrieveVersion'; error=Protect-OperationalText $_.Exception.Message }) | Out-Null }

$installedSolutions = Invoke-DataverseRowsSafe -Errors $errors -Section 'target solution' -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -AccessToken $AccessToken `
    -EntitySet 'solutions' -Select @('solutionid','uniquename','friendlyname','version','ismanaged','installedon','modifiedon','_parentsolutionid_value') `
    -Filter ("uniquename eq '{0}'" -f $package.uniqueName.Replace("'","''")) -MaxRows 10

if ($installedSolutions.Count -gt 1) {
    Add-ReadinessFinding -List $findings -Severity BLOCKER -Code 'MULTIPLE_TARGET_SOLUTIONS' -Message "More than one target solution row matched '$($package.uniqueName)'." -Details @{ count=$installedSolutions.Count }
}

$installed = if ($installedSolutions.Count -eq 1) { $installedSolutions[0] } else { $null }
if ($installed) {
    if ($null -ne $package.managed -and $null -ne (Get-ObjectPropertyValue $installed 'ismanaged') -and [bool](Get-ObjectPropertyValue $installed 'ismanaged') -ne [bool]$package.managed) {
        Add-ReadinessFinding -List $findings -Severity BLOCKER -Code 'MANAGEMENT_STATE_CONFLICT' -Message 'The package managed/unmanaged state conflicts with the installed target solution.' -Details @{
            packageManaged = $package.managed
            installedManaged = [bool](Get-ObjectPropertyValue $installed 'ismanaged')
        }
    }

    $packageVersion = ConvertTo-ComparableVersion $package.version
    $installedVersionText = [string](Get-ObjectPropertyValue $installed 'version')
    $installedVersion = ConvertTo-ComparableVersion $installedVersionText
    if (-not $packageVersion -or -not $installedVersion) {
        Add-ReadinessFinding -List $findings -Severity WARNING -Code 'VERSION_COMPARISON_UNKNOWN' -Message 'Package or installed solution version could not be compared conclusively.' -Details @{ packageVersion=$package.version; installedVersion=$installedVersionText }
    }
    elseif ($packageVersion -lt $installedVersion) {
        Add-ReadinessFinding -List $findings -Severity BLOCKER -Code 'LOWER_VERSION_THAN_TARGET' -Message 'The package version is lower than the version installed in the target environment.' -Details @{ packageVersion=$package.version; installedVersion=$installedVersionText }
    }
    elseif ($packageVersion -eq $installedVersion) {
        Add-ReadinessFinding -List $findings -Severity WARNING -Code 'SAME_VERSION_AS_TARGET' -Message 'The package version is the same as the version installed in the target environment.' -Details @{ version=$package.version }
    }
}

if ($null -eq $package.managed) {
    Add-ReadinessFinding -List $findings -Severity WARNING -Code 'PACKAGE_MANAGED_STATE_UNKNOWN' -Message "The package Managed flag was '$($package.managedRaw)' and could not be interpreted as managed or unmanaged." -Details $null
}

$parentAssessment = [ordered]@{ required=$false; uniqueName=$package.parentSolutionUniqueName; state='NOT_APPLICABLE' }
if ($package.parentSolutionUniqueName) {
    $parentAssessment.required = $true
    $parentRows = Invoke-DataverseRowsSafe -Errors $errors -Section 'parent solution' -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -AccessToken $AccessToken `
        -EntitySet 'solutions' -Select @('solutionid','uniquename','version','ismanaged') `
        -Filter ("uniquename eq '{0}'" -f $package.parentSolutionUniqueName.Replace("'","''")) -MaxRows 10
    if ($parentRows.Count -eq 1) {
        $parentAssessment.state = 'PRESENT'
        $parentAssessment['version'] = [string](Get-ObjectPropertyValue $parentRows[0] 'version')
    }
    elseif ($parentRows.Count -eq 0) {
        $parentAssessment.state = 'MISSING'
        Add-ReadinessFinding -List $findings -Severity BLOCKER -Code 'PARENT_SOLUTION_MISSING' -Message "The package declares parent solution '$($package.parentSolutionUniqueName)', but it was not found in the target environment." -Details $null
    }
    else {
        $parentAssessment.state = 'UNKNOWN'
        Add-ReadinessFinding -List $findings -Severity BLOCKER -Code 'PARENT_SOLUTION_AMBIGUOUS' -Message "Multiple target rows matched parent solution '$($package.parentSolutionUniqueName)'." -Details @{ count=$parentRows.Count }
    }
}

$upgradeCandidates = Invoke-DataverseRowsSafe -Errors $errors -Section 'holding or staged upgrade candidates' -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -AccessToken $AccessToken `
    -EntitySet 'solutions' -Select @('solutionid','uniquename','friendlyname','version','ismanaged','installedon') `
    -Filter ("startswith(uniquename,'{0}') and uniquename ne '{0}'" -f $package.uniqueName.Replace("'","''")) -MaxRows 100

$holdingCandidates = @(
    $upgradeCandidates |
        Where-Object {
            ([string](Get-ObjectPropertyValue $_ 'uniquename')) -match '(?i)(_upgrade|_holding)$' -or
            ([string](Get-ObjectPropertyValue $_ 'friendlyname')) -match '(?i)\b(upgrade|holding)\b'
        } |
        Sort-Object uniquename, version
)
$holdingState = if ($holdingCandidates.Count -gt 0) { 'POSSIBLE_PENDING_UPGRADE' } else { 'UNKNOWN' }
if ($holdingCandidates.Count -gt 0) {
    Add-ReadinessFinding -List $findings -Severity WARNING -Code 'POSSIBLE_PENDING_UPGRADE' -Message 'Potential holding/staged upgrade solution rows were detected. Review them before import.' -Details @{ candidates=@($holdingCandidates | ForEach-Object { [ordered]@{ uniqueName=[string](Get-ObjectPropertyValue $_ 'uniquename'); version=[string](Get-ObjectPropertyValue $_ 'version') } }) }
} else {
    Add-ReadinessFinding -List $findings -Severity INFO -Code 'PENDING_UPGRADE_STATE_NOT_CONCLUSIVE' -Message 'No obvious upgrade/holding row was found, but absence of a naming-pattern match is not conclusive proof that no pending upgrade state exists.' -Details $null
}

$allDefinitions = Invoke-DataverseRowsSafe -Errors $errors -Section 'environment variable definitions' -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -AccessToken $AccessToken `
    -EntitySet 'environmentvariabledefinitions' -Select @('environmentvariabledefinitionid','schemaname','displayname','type','defaultvalue','isrequired','statecode') -MaxRows $MaxRows
$allValues = Invoke-DataverseRowsSafe -Errors $errors -Section 'environment variable values' -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -AccessToken $AccessToken `
    -EntitySet 'environmentvariablevalues' -Select @('environmentvariablevalueid','_environmentvariabledefinitionid_value','value','statecode','modifiedon') -MaxRows $MaxRows

$valuesByDefinition = @{}
foreach ($valueRow in $allValues) {
    $definitionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $valueRow '_environmentvariabledefinitionid_value')
    if (-not $definitionId) { continue }
    if (-not $valuesByDefinition.ContainsKey($definitionId)) { $valuesByDefinition[$definitionId] = @() }
    $valuesByDefinition[$definitionId] += $valueRow
}
$definitionBySchema = @{}
foreach ($definition in $allDefinitions) {
    $schema = [string](Get-ObjectPropertyValue $definition 'schemaname')
    if (-not [string]::IsNullOrWhiteSpace($schema)) { $definitionBySchema[$schema.ToLowerInvariant()] = $definition }
}

$environmentVariableAssessments = [System.Collections.Generic.List[object]]::new()
foreach ($requirement in @($requirements.environmentVariables)) {
    $definition = if ($definitionBySchema.ContainsKey($requirement.schemaName.ToLowerInvariant())) { $definitionBySchema[$requirement.schemaName.ToLowerInvariant()] } else { $null }
    if (-not $definition) {
        $environmentVariableAssessments.Add([ordered]@{ schemaName=$requirement.schemaName; definitionState='MISSING'; currentValueState='UNKNOWN'; defaultValueState='UNKNOWN'; readiness='MISSING' }) | Out-Null
        $severity = if ($RequireResolvedReferences) { 'BLOCKER' } else { 'WARNING' }
        Add-ReadinessFinding -List $findings -Severity $severity -Code 'ENVIRONMENT_VARIABLE_DEFINITION_MISSING' -Message "Required environment variable definition '$($requirement.schemaName)' was not found in the target." -Details $null
        continue
    }

    $definitionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $definition 'environmentvariabledefinitionid')
    $activeValues = @(
        if ($definitionId -and $valuesByDefinition.ContainsKey($definitionId)) {
            $valuesByDefinition[$definitionId] | Where-Object { [int](Get-ObjectPropertyValue $_ 'statecode') -eq 0 }
        }
    )
    $currentPresent = @($activeValues | Where-Object { Test-ValuePresent (Get-ObjectPropertyValue $_ 'value') }).Count -gt 0
    $defaultPresent = Test-ValuePresent (Get-ObjectPropertyValue $definition 'defaultvalue')
    $resolved = $currentPresent -or $defaultPresent -or [bool]$requirement.packageSuppliedValuePresent

    $environmentVariableAssessments.Add([ordered]@{
        schemaName = $requirement.schemaName
        definitionState = 'PRESENT'
        currentValueState = if ($currentPresent) { 'PRESENT' } else { 'MISSING' }
        defaultValueState = if ($defaultPresent) { 'PRESENT' } else { 'MISSING' }
        packageSuppliedValueState = if ($requirement.packageSuppliedValuePresent) { 'PRESENT' } else { 'MISSING' }
        readiness = if ($resolved) { 'RESOLVED' } else { 'UNRESOLVED' }
    }) | Out-Null

    if (-not $resolved) {
        $severity = if ($RequireResolvedReferences) { 'BLOCKER' } else { 'WARNING' }
        Add-ReadinessFinding -List $findings -Severity $severity -Code 'ENVIRONMENT_VARIABLE_UNRESOLVED' -Message "Environment variable '$($requirement.schemaName)' has no detected target current/default value and no package-supplied value." -Details $null
    }
}

$targetConnectionReferences = Invoke-DataverseRowsSafe -Errors $errors -Section 'connection references' -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -AccessToken $AccessToken `
    -EntitySet 'connectionreferences' -Select @('connectionreferenceid','connectionreferencelogicalname','connectionreferencedisplayname','connectorid','connectionid','statecode','statuscode') -MaxRows $MaxRows
$connectionByLogicalName = @{}
foreach ($row in $targetConnectionReferences) {
    $logicalName = [string](Get-ObjectPropertyValue $row 'connectionreferencelogicalname')
    if (-not [string]::IsNullOrWhiteSpace($logicalName)) { $connectionByLogicalName[$logicalName.ToLowerInvariant()] = $row }
}

$connectionAssessments = [System.Collections.Generic.List[object]]::new()
foreach ($requirement in @($requirements.connectionReferences)) {
    $row = if ($connectionByLogicalName.ContainsKey($requirement.logicalName.ToLowerInvariant())) { $connectionByLogicalName[$requirement.logicalName.ToLowerInvariant()] } else { $null }
    if (-not $row) {
        $connectionAssessments.Add([ordered]@{ logicalName=$requirement.logicalName; targetState='MISSING'; resolutionState='UNRESOLVED'; connectorMatch='UNKNOWN' }) | Out-Null
        $severity = if ($RequireResolvedReferences) { 'BLOCKER' } else { 'WARNING' }
        Add-ReadinessFinding -List $findings -Severity $severity -Code 'CONNECTION_REFERENCE_MISSING' -Message "Connection reference '$($requirement.logicalName)' was not found in the target." -Details $null
        continue
    }

    $connectionPresent = Test-ValuePresent (Get-ObjectPropertyValue $row 'connectionid')
    $targetConnector = [string](Get-ObjectPropertyValue $row 'connectorid')
    $connectorMatch = if ([string]::IsNullOrWhiteSpace($requirement.connectorId) -or [string]::IsNullOrWhiteSpace($targetConnector)) { 'UNKNOWN' } elseif ($requirement.connectorId -eq $targetConnector) { 'MATCH' } else { 'DRIFT' }
    $resolved = $connectionPresent -or [bool]$requirement.packageSuppliedConnectionPresent

    $connectionAssessments.Add([ordered]@{
        logicalName = $requirement.logicalName
        targetState = 'PRESENT'
        resolutionState = if ($resolved) { 'RESOLVED' } else { 'UNRESOLVED' }
        connectorMatch = $connectorMatch
        connectorId = if ([string]::IsNullOrWhiteSpace($targetConnector)) { $null } else { $targetConnector }
        packageSuppliedConnectionState = if ($requirement.packageSuppliedConnectionPresent) { 'PRESENT' } else { 'MISSING' }
    }) | Out-Null

    if ($connectorMatch -eq 'DRIFT') {
        Add-ReadinessFinding -List $findings -Severity WARNING -Code 'CONNECTION_REFERENCE_CONNECTOR_DRIFT' -Message "Connection reference '$($requirement.logicalName)' resolves to a different connector identity in the target." -Details @{ packageConnectorId=$requirement.connectorId; targetConnectorId=$targetConnector }
    }
    if (-not $resolved) {
        $severity = if ($RequireResolvedReferences) { 'BLOCKER' } else { 'WARNING' }
        Add-ReadinessFinding -List $findings -Severity $severity -Code 'CONNECTION_REFERENCE_UNRESOLVED' -Message "Connection reference '$($requirement.logicalName)' has no detected target connection and no package-supplied connection." -Details $null
    }
}

if ($requirements.state -eq 'UNKNOWN') {
    $requirementsSeverity = if ($RequireResolvedReferences) { 'BLOCKER' } else { 'WARNING' }
    Add-ReadinessFinding -List $findings -Severity $requirementsSeverity -Code 'DEPLOYMENT_SETTINGS_REQUIREMENTS_UNKNOWN' -Message $requirements.reason -Details $null
}

if ($package.missingDependencies.Count -gt 0) {
    Add-ReadinessFinding -List $findings -Severity WARNING -Code 'PACKAGE_DECLARES_MISSING_DEPENDENCIES' -Message "The package solution.xml contains $($package.missingDependencies.Count) MissingDependency record(s). These require human review because package metadata alone does not establish target satisfaction." -Details @{ count=$package.missingDependencies.Count }
}

$targetAssemblies = Invoke-DataverseRowsSafe -Errors $errors -Section 'plug-in assemblies' -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -AccessToken $AccessToken `
    -EntitySet 'pluginassemblies' -Select @('pluginassemblyid','name','version','ismanaged','isolationmode','sourcetype') -MaxRows $MaxRows
$assemblyByName = @{}
foreach ($row in $targetAssemblies) {
    $name = [string](Get-ObjectPropertyValue $row 'name')
    if (-not [string]::IsNullOrWhiteSpace($name)) { $assemblyByName[$name.ToLowerInvariant()] = $row }
}
$pluginPrerequisites = @(
    foreach ($assemblyName in $package.pluginAssemblyNames) {
        $targetAssembly = if ($assemblyByName.ContainsKey($assemblyName.ToLowerInvariant())) { $assemblyByName[$assemblyName.ToLowerInvariant()] } else { $null }
        [ordered]@{
            assemblyName = $assemblyName
            targetState = if ($targetAssembly) { 'PRESENT' } else { 'MISSING_OR_NEW' }
            targetVersion = if ($targetAssembly) { [string](Get-ObjectPropertyValue $targetAssembly 'version') } else { $null }
            targetManaged = if ($targetAssembly) { Get-ObjectPropertyValue $targetAssembly 'ismanaged' } else { $null }
            assessment = if ($targetAssembly) { 'EXISTING_IDENTITY_REVIEWED' } else { 'NO_EXISTING_IDENTITY_DETECTED' }
        }
    }
)
foreach ($item in $pluginPrerequisites) {
    if ($item.targetState -eq 'PRESENT' -and $null -ne $package.managed -and $null -ne $item.targetManaged -and [bool]$item.targetManaged -ne [bool]$package.managed) {
        Add-ReadinessFinding -List $findings -Severity WARNING -Code 'PLUGIN_ASSEMBLY_MANAGEMENT_STATE_DRIFT' -Message "Existing plug-in assembly '$($item.assemblyName)' has a different managed state from the package." -Details @{ packageManaged=$package.managed; targetManaged=$item.targetManaged }
    }
}

$targetPcfs = Invoke-DataverseRowsSafe -Errors $errors -Section 'PCF custom controls' -EnvironmentBaseUrl $environmentBaseUrl -ApiVersion $ApiVersion -AccessToken $AccessToken `
    -EntitySet 'customcontrols' -Select @('customcontrolid','name','version','ismanaged','componentstate') -MaxRows $MaxRows
$pcfByName = @{}
foreach ($row in $targetPcfs) {
    $name = [string](Get-ObjectPropertyValue $row 'name')
    if (-not [string]::IsNullOrWhiteSpace($name)) { $pcfByName[$name.ToLowerInvariant()] = $row }
}

$pcfAssessments = [System.Collections.Generic.List[object]]::new()
foreach ($rootName in @($package.pcfRootComponentNames)) {
    $target = if ($pcfByName.ContainsKey($rootName.ToLowerInvariant())) { $pcfByName[$rootName.ToLowerInvariant()] } else { $null }
    $pcfAssessments.Add([ordered]@{
        identity = $rootName
        targetState = if ($target) { 'PRESENT' } else { 'MISSING_OR_NEW' }
        targetVersion = if ($target) { [string](Get-ObjectPropertyValue $target 'version') } else { $null }
        targetManaged = if ($target) { Get-ObjectPropertyValue $target 'ismanaged' } else { $null }
    }) | Out-Null
    if ($target -and $null -ne $package.managed -and $null -ne (Get-ObjectPropertyValue $target 'ismanaged') -and [bool](Get-ObjectPropertyValue $target 'ismanaged') -ne [bool]$package.managed) {
        Add-ReadinessFinding -List $findings -Severity BLOCKER -Code 'PCF_IDENTITY_MANAGEMENT_CONFLICT' -Message "PCF identity '$rootName' exists in the target with a different managed state from the package." -Details @{ packageManaged=$package.managed; targetManaged=[bool](Get-ObjectPropertyValue $target 'ismanaged') }
    }
}
if ($package.controls.Count -gt 0 -and $package.pcfRootComponentNames.Count -eq 0) {
    Add-ReadinessFinding -List $findings -Severity WARNING -Code 'PCF_TARGET_IDENTITY_NOT_CONCLUSIVE' -Message 'Packaged PCF ControlManifest.xml files were found, but no type-66 RootComponent schema names were available to establish the exact Dataverse custom-control identities.' -Details @{ manifestIdentities=@($package.controls.manifestIdentity) }
}

if ($errors.Count -gt 0) {
    Add-ReadinessFinding -List $findings -Severity WARNING -Code 'TARGET_QUERY_GAPS' -Message 'One or more non-blocking target queries failed. Review the errors collection before relying on READY status.' -Details @{ errorCount=$errors.Count }
}

$blockers = @($findings | Where-Object { $_.severity -eq 'BLOCKER' })
$warnings = @($findings | Where-Object { $_.severity -eq 'WARNING' })
$classification = if ($blockers.Count -gt 0) { 'BLOCKED' } elseif ($warnings.Count -gt 0) { 'READY_WITH_WARNINGS' } else { 'READY' }

$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{ name='Test-SolutionTargetReadiness'; version='1.0.0'; maturity='Experimental' }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'READ_ONLY_REMOTE_AND_LOCAL_INSPECTION'
    safetyClassification = 'READ_ONLY_REMOTE'
    environment = [ordered]@{
        url = $environmentBaseUrl
        organisationId = if ($whoAmI) { ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $whoAmI 'OrganizationId') } else { $null }
        businessUnitId = if ($whoAmI) { ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $whoAmI 'BusinessUnitId') } else { $null }
        serverVersion = if ($serverVersion) { [string](Get-ObjectPropertyValue $serverVersion 'Version') } else { $null }
    }
    package = $package
    installedSolution = if ($installed) {
        [ordered]@{
            solutionId = ConvertTo-NormalisedGuid (Get-ObjectPropertyValue $installed 'solutionid')
            uniqueName = [string](Get-ObjectPropertyValue $installed 'uniquename')
            version = [string](Get-ObjectPropertyValue $installed 'version')
            managed = Get-ObjectPropertyValue $installed 'ismanaged'
            installedOn = Get-ObjectPropertyValue $installed 'installedon'
        }
    } else { $null }
    parentSolution = $parentAssessment
    pendingOrHoldingUpgrade = [ordered]@{
        state = $holdingState
        candidates = @($holdingCandidates | ForEach-Object { [ordered]@{ uniqueName=[string](Get-ObjectPropertyValue $_ 'uniquename'); version=[string](Get-ObjectPropertyValue $_ 'version'); managed=Get-ObjectPropertyValue $_ 'ismanaged' } })
        conclusive = $false
    }
    deploymentRequirements = [ordered]@{
        discoveryState = $requirements.state
        pacVersion = $requirements.pacVersion
        environmentVariables = @($environmentVariableAssessments)
        connectionReferences = @($connectionAssessments)
    }
    pluginPrerequisites = $pluginPrerequisites
    pcfIdentityAssessment = @($pcfAssessments)
    dependencyInformation = [ordered]@{
        packageMissingDependencies = $package.missingDependencies
        assessment = if ($package.missingDependencies.Count -gt 0) { 'REVIEW_REQUIRED' } else { 'NO_PACKAGE_MISSINGDEPENDENCY_ROWS' }
        conclusiveTargetDependencyCheck = $false
    }
    findings = @($findings | Sort-Object severity, code, message)
    errors = @($errors)
    limitations = @(
        'The script does not execute a Dataverse ImportSolution or stage operation and therefore cannot reproduce the server-side import validation pipeline.',
        'Pending/holding upgrade detection is best-effort and not conclusive.',
        'Dependency assessment is limited to package metadata and read-only target evidence; absence of MissingDependency rows does not prove every runtime prerequisite.',
        'Environment variable and connection-reference requirement discovery depends on the locally installed PAC create-settings capability.',
        'No secret environment-variable values, connection IDs, bearer tokens or plug-in configuration contents are written to the report.'
    )
    summary = [ordered]@{
        classification = $classification
        blockers = $blockers.Count
        warnings = $warnings.Count
        nonBlockingQueryErrors = $errors.Count
        packageUniqueName = $package.uniqueName
        packageVersion = $package.version
        packageManaged = $package.managed
        installedVersion = if ($installed) { [string](Get-ObjectPropertyValue $installed 'version') } else { $null }
        environmentVariableRequirements = $environmentVariableAssessments.Count
        connectionReferenceRequirements = $connectionAssessments.Count
        secretValuesEmitted = $false
    }
}

$summary = @"
Solution target readiness
Environment: $environmentBaseUrl
Package: $($package.uniqueName) $($package.version)
Classification: $classification
Blockers: $($blockers.Count)
Warnings: $($warnings.Count)
Target query gaps: $($errors.Count)
Environment-variable requirements assessed: $($environmentVariableAssessments.Count)
Connection-reference requirements assessed: $($connectionAssessments.Count)
Import performed: NO
Secret values emitted: NO
"@

Write-ReportOutputs -Report $report -SummaryText $summary -JsonOutputPath $JsonOutputPath -SummaryOutputPath $SummaryOutputPath
