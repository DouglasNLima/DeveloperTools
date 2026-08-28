<#
.SYNOPSIS
    Lists Power Pages sites across one or more explicitly configured environments.

.DESCRIPTION
    Selects an existing PAC authentication profile for each environment and runs the read-only
    'pac pages list --environment ... --verbose' operation. Authentication profile selection changes
    the local PAC authentication context temporarily; the original active profile is restored where
    its index can be determined.

    Authentication profiles are never created by default. Use -CreateAuthenticationProfiles explicitly
    if profile creation is required.

    Execution context:
      - Remote: read-only Power Pages listing.
      - Local: PAC authentication-context mutation.
    Safety classification: READ_ONLY_REMOTE_WITH_LOCAL_AUTH_CONTEXT_MUTATION.

.PARAMETER EnvironmentDefinition
    One or more objects containing Label, EnvironmentUrl and PacAuthProfile properties.

.PARAMETER EnvironmentFile
    JSON file containing an array of environment definitions, or an object with an 'environments' array.

.PARAMETER CreateAuthenticationProfiles
    Explicitly allow creation of missing named PAC profiles.

.PARAMETER DeviceCode
    Use device-code authentication only when a missing PAC profile is explicitly created.

.EXAMPLE
    $environments = @(
        [pscustomobject]@{ Label='Development'; EnvironmentUrl='https://contoso-dev.crm.dynamics.com'; PacAuthProfile='Contoso-Dev' },
        [pscustomobject]@{ Label='Test'; EnvironmentUrl='https://contoso-test.crm.dynamics.com'; PacAuthProfile='Contoso-Test' }
    )
    .\Get-PowerPagesSiteInventory.ps1 -EnvironmentDefinition $environments
#>
[CmdletBinding(DefaultParameterSetName='Definitions')]
param(
    [Parameter(Mandatory,ParameterSetName='Definitions')]
    [object[]]$EnvironmentDefinition,

    [Parameter(Mandatory,ParameterSetName='File')]
    [string]$EnvironmentFile,

    [Parameter()]
    [switch]$CreateAuthenticationProfiles,

    [Parameter()]
    [switch]$DeviceCode,

    [Parameter()]
    [string]$JsonOutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'


function Resolve-PacCommand {
    [CmdletBinding()]
    param()
    $command = Get-Command pac.cmd, pac.exe, pac -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) { throw "Required command 'pac' was not found in PATH." }
    if ($command.Source) { return $command.Source }
    if ($command.Definition) { return $command.Definition }
    return $command.Name
}

function Invoke-PacCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PacCommand,
        [Parameter(Mandatory)][string[]]$Arguments,
        [switch]$WriteOutput,
        [switch]$AllowFailure
    )

    $previousPreference = $ErrorActionPreference
    $nativePreference = Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $previousNative = $null
    try {
        $ErrorActionPreference = 'Continue'
        if ($nativePreference) {
            $previousNative = $PSNativeCommandUseErrorActionPreference
            $PSNativeCommandUseErrorActionPreference = $false
        }
        $raw = & $PacCommand @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
        if ($nativePreference) { $PSNativeCommandUseErrorActionPreference = $previousNative }
    }

    $lines = @($raw | ForEach-Object { $_.ToString() })
    if ($WriteOutput) {
        foreach ($line in $lines) { Write-Host $line }
    }

    $result = [ordered]@{
        exitCode = [int]$exitCode
        output = $lines
        text = ($lines -join [Environment]::NewLine)
    }

    if (-not $AllowFailure -and $exitCode -ne 0) {
        $tail = @($lines | Select-Object -Last 20) -join [Environment]::NewLine
        throw "PAC command failed with exit code $exitCode: pac $($Arguments -join ' ')`n$tail"
    }

    return $result
}

function Assert-HttpsEnvironmentUrl {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Url)
    $uri = $null
    if (-not [Uri]::TryCreate($Url, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https' -or [string]::IsNullOrWhiteSpace($uri.Host)) {
        throw "Environment URL must be an absolute HTTPS URL. Received '$Url'."
    }
    return $uri.GetLeftPart([UriPartial]::Authority).TrimEnd('/')
}

function Get-ActivePacProfileIndex {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$PacCommand)

    $list = Invoke-PacCommand -PacCommand $PacCommand -Arguments @('auth','list') -AllowFailure
    if ($list.exitCode -ne 0) { return $null }

    foreach ($line in $list.output) {
        $match = [regex]::Match($line, '^\s*\[(?<Index>\d+)\]\s+\*\s+')
        if ($match.Success) { return [int]$match.Groups['Index'].Value }
    }

    return $null
}

function Select-PacAuthenticationProfile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PacCommand,
        [Parameter(Mandatory)][ValidateLength(1,30)][string]$ProfileName,
        [Parameter(Mandatory)][string]$EnvironmentUrl,
        [switch]$CreateIfMissing,
        [switch]$DeviceCode
    )

    $select = Invoke-PacCommand -PacCommand $PacCommand -Arguments @('auth','select','--name',$ProfileName) -AllowFailure
    if ($select.exitCode -eq 0) {
        return [ordered]@{ profileName=$ProfileName; created=$false; selected=$true }
    }

    if (-not $CreateIfMissing) {
        throw "PAC authentication profile '$ProfileName' could not be selected. No profile was created because -CreateAuthenticationProfiles/-CreateAuthenticationProfile was not supplied."
    }

    $createArgs = [System.Collections.Generic.List[string]]::new()
    foreach ($value in @('auth','create','--name',$ProfileName,'--environment',$EnvironmentUrl)) { $createArgs.Add($value) | Out-Null }
    if ($DeviceCode) { $createArgs.Add('--deviceCode') | Out-Null }
    Invoke-PacCommand -PacCommand $PacCommand -Arguments $createArgs.ToArray() -WriteOutput | Out-Null
    Invoke-PacCommand -PacCommand $PacCommand -Arguments @('auth','select','--name',$ProfileName) | Out-Null

    return [ordered]@{ profileName=$ProfileName; created=$true; selected=$true }
}

function Restore-PacAuthenticationProfile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PacCommand,
        [AllowNull()][Nullable[int]]$OriginalIndex
    )

    if ($null -eq $OriginalIndex) {
        Write-Warning 'The previously active PAC profile index could not be determined, so the local PAC authentication context cannot be restored automatically.'
        return $false
    }

    $restore = Invoke-PacCommand -PacCommand $PacCommand -Arguments @('auth','select','--index',$OriginalIndex.ToString()) -AllowFailure
    if ($restore.exitCode -ne 0) {
        Write-Warning "Failed to restore PAC authentication profile index $OriginalIndex."
        return $false
    }
    return $true
}

function Write-Utf8NoBomText {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path,[Parameter(Mandatory)][AllowEmptyString()][string]$Content)
    $full = [IO.Path]::GetFullPath($Path)
    $parent = Split-Path -Path $full -Parent
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) { throw "Output parent directory does not exist: '$parent'." }
    [IO.File]::WriteAllText($full,$Content,[Text.UTF8Encoding]::new($false))
}

function ConvertTo-EnvironmentDefinition {
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$InputObject)

    foreach ($name in @('Label','EnvironmentUrl','PacAuthProfile')) {
        if (-not $InputObject.PSObject.Properties[$name] -or [string]::IsNullOrWhiteSpace([string]$InputObject.$name)) {
            throw "Each environment definition must contain a non-empty '$name' property."
        }
    }

    $profile = [string]$InputObject.PacAuthProfile
    if ($profile.Length -gt 30) { throw "PAC authentication profile '$profile' exceeds the 30-character PAC limit." }

    return [ordered]@{
        label = [string]$InputObject.Label
        environmentUrl = Assert-HttpsEnvironmentUrl -Url ([string]$InputObject.EnvironmentUrl)
        pacAuthProfile = $profile
    }
}

function Convert-PacPagesListOutput {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string[]]$Lines)

    $items = [System.Collections.Generic.List[object]]::new()
    $seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($line in $Lines) {
        $match = [regex]::Match($line, '(?i)(?<Id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
        if (-not $match.Success) { continue }
        $id = $match.Groups['Id'].Value.ToLowerInvariant()
        if (-not $seen.Add($id)) { continue }
        $model = if ($line -match '(?i)\bEnhanced\b') { 'Enhanced' } elseif ($line -match '(?i)\bStandard\b') { 'Standard' } else { 'UNKNOWN' }
        $items.Add([ordered]@{
            websiteId = $id
            dataModel = $model
            displayText = $line.Trim()
        }) | Out-Null
    }
    return @($items | Sort-Object websiteId, displayText)
}

$definitions = if ($PSCmdlet.ParameterSetName -eq 'File') {
    if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) { throw "EnvironmentFile was not found at '$EnvironmentFile'." }
    $json = Get-Content -LiteralPath (Resolve-Path -LiteralPath $EnvironmentFile).Path -Raw | ConvertFrom-Json
    if ($json.PSObject.Properties['environments']) { @($json.environments) } else { @($json) }
} else {
    @($EnvironmentDefinition)
}

if ($definitions.Count -eq 0) { throw 'At least one environment definition is required.' }
$environments = @($definitions | ForEach-Object { ConvertTo-EnvironmentDefinition -InputObject $_ } | Sort-Object label, environmentUrl)

$pac = Resolve-PacCommand
$originalIndex = Get-ActivePacProfileIndex -PacCommand $pac
$results = [System.Collections.Generic.List[object]]::new()
$profileCreations = [System.Collections.Generic.List[string]]::new()
$restoreSucceeded = $false

try {
    foreach ($environment in $environments) {
        Write-Host "`n=== $($environment.label) ===" -ForegroundColor Cyan
        Write-Host "Remote operation: READ-ONLY site listing."
        Write-Host "Local operation: temporary PAC authentication-profile selection." -ForegroundColor Yellow

        $auth = Select-PacAuthenticationProfile -PacCommand $pac -ProfileName $environment.pacAuthProfile -EnvironmentUrl $environment.environmentUrl `
            -CreateIfMissing:$CreateAuthenticationProfiles -DeviceCode:$DeviceCode
        if ($auth.created) { $profileCreations.Add($environment.pacAuthProfile) | Out-Null }

        $list = Invoke-PacCommand -PacCommand $pac -Arguments @('pages','list','--environment',$environment.environmentUrl,'--verbose') -WriteOutput
        $sites = Convert-PacPagesListOutput -Lines $list.output
        $results.Add([ordered]@{
            label = $environment.label
            environmentUrl = $environment.environmentUrl
            pacAuthProfile = $environment.pacAuthProfile
            authenticationProfileCreated = [bool]$auth.created
            siteCount = $sites.Count
            sites = $sites
        }) | Out-Null
    }
}
finally {
    $restoreSucceeded = Restore-PacAuthenticationProfile -PacCommand $pac -OriginalIndex $originalIndex
}

$versionResult = Invoke-PacCommand -PacCommand $pac -Arguments @('--version') -AllowFailure
$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{ name='Get-PowerPagesSiteInventory'; version='1.0.0'; maturity='Experimental' }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'READ_ONLY_REMOTE_WITH_LOCAL_AUTH_CONTEXT_MUTATION'
    safetyClassification = 'READ_ONLY_REMOTE_WITH_LOCAL_AUTH_CONTEXT_MUTATION'
    pacVersion = if ($versionResult.exitCode -eq 0) { $versionResult.text.Trim() } else { $null }
    authentication = [ordered]@{
        originalProfileIndex = $originalIndex
        originalProfileRestored = $restoreSucceeded
        missingProfileCreationAllowed = [bool]$CreateAuthenticationProfiles
        createdProfiles = @($profileCreations | Sort-Object)
    }
    environments = @($results)
    limitations = @(
        'PAC pages list is a textual CLI surface; website identifiers are parsed conservatively from GUID-bearing output lines.',
        'Display text is retained because PAC does not expose a documented JSON output contract for pages list in this workflow.',
        'Selecting a PAC profile changes local authentication context temporarily even though the remote operation is read-only.'
    )
    summary = [ordered]@{
        environments = $results.Count
        sites = (@($results | ForEach-Object { $_.siteCount }) | Measure-Object -Sum).Sum
        profilesCreated = $profileCreations.Count
        originalProfileRestored = $restoreSucceeded
    }
}

if ($JsonOutputPath) { Write-Utf8NoBomText -Path $JsonOutputPath -Content ($report | ConvertTo-Json -Depth 20) }
return $report
