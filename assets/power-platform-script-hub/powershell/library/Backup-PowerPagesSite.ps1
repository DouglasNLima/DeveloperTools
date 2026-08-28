<#
.SYNOPSIS
    Creates a new timestamped local backup of a Power Pages site.

.DESCRIPTION
    Downloads a Power Pages site into a newly created backup directory and writes secret-safe metadata
    beside the downloaded content. Existing backups are never replaced.

    This script performs local filesystem creation and temporary PAC authentication-profile selection.
    The remote Power Pages operation is download-only.

    Execution context:
      - Remote: read-only Power Pages download.
      - Local: create-only backup filesystem mutation and PAC authentication-context mutation.
    Safety classification: CREATE_ONLY_LOCAL_BACKUP_WITH_READ_ONLY_REMOTE_DOWNLOAD.

.PARAMETER BackupRoot
    Existing directory beneath which a new timestamped backup directory is created.

.PARAMETER ModelVersion
    Optional PAC modelVersion value: Standard or Enhanced.

.EXAMPLE
    .\Backup-PowerPagesSite.ps1 `
        -EnvironmentUrl 'https://contoso.crm.dynamics.com' `
        -PacAuthProfile 'Contoso-Prod' `
        -WebsiteId '11111111-2222-3333-4444-555555555555' `
        -BackupRoot 'D:\PowerPagesBackups' `
        -ModelVersion Enhanced
#>
[CmdletBinding(SupportsShouldProcess=$true,ConfirmImpact='Low')]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$EnvironmentUrl,

    [Parameter(Mandatory)]
    [ValidateLength(1,30)]
    [string]$PacAuthProfile,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$')]
    [string]$WebsiteId,

    [Parameter(Mandatory)]
    [string]$BackupRoot,

    [Parameter()]
    [ValidateSet('Standard','Enhanced')]
    [string]$ModelVersion,

    [Parameter()]
    [switch]$CreateAuthenticationProfile,

    [Parameter()]
    [switch]$DeviceCode
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

function Get-CanonicalPath {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $full = [IO.Path]::GetFullPath($Path)
    $root = [IO.Path]::GetPathRoot($full)
    if ($full.Equals($root,[StringComparison]::OrdinalIgnoreCase)) { return $root }
    return $full.TrimEnd([char[]]'\/')
}

function Test-PathIsDescendant {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Candidate,[Parameter(Mandatory)][string]$Parent)

    $candidateFull = Get-CanonicalPath -Path $Candidate
    $parentFull = Get-CanonicalPath -Path $Parent
    if ($candidateFull.Equals($parentFull,[StringComparison]::OrdinalIgnoreCase)) { return $false }
    $prefix = $parentFull.TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
    return $candidateFull.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)
}

function Assert-SafeMutationDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Description,
        [switch]$MayNotExist
    )

    $full = Get-CanonicalPath -Path $Path
    $root = [IO.Path]::GetPathRoot($full)
    if ($full.Equals($root,[StringComparison]::OrdinalIgnoreCase)) {
        throw "$Description cannot be a filesystem root: '$full'."
    }

    $home = if ($HOME) { Get-CanonicalPath -Path $HOME } else { $null }
    if ($home -and $full.Equals($home,[StringComparison]::OrdinalIgnoreCase)) {
        throw "$Description cannot be the current user's home directory: '$full'."
    }

    if (Test-Path -LiteralPath $full) {
        $item = Get-Item -LiteralPath $full -Force -ErrorAction Stop
        if (-not $item.PSIsContainer) { throw "$Description exists but is not a directory: '$full'." }
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "$Description is a reparse point/symbolic link and is not accepted for destructive operations: '$full'."
        }
    }
    elseif (-not $MayNotExist) {
        throw "$Description does not exist: '$full'."
    }

    return $full
}

function Assert-SafeChildPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$AllowedRoot,
        [Parameter(Mandatory)][string]$Description
    )

    $full = Get-CanonicalPath -Path $Path
    $root = Get-CanonicalPath -Path $AllowedRoot
    if ($full.Equals($root,[StringComparison]::OrdinalIgnoreCase) -or -not (Test-PathIsDescendant -Candidate $full -Parent $root)) {
        throw "$Description '$full' is not a strict child of allowed root '$root'."
    }
    return $full
}

function Remove-SafeDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$AllowedRoot,
        [Parameter(Mandatory)][string]$Description
    )

    $safe = Assert-SafeChildPath -Path $Path -AllowedRoot $AllowedRoot -Description $Description
    if (Test-Path -LiteralPath $safe) {
        $item = Get-Item -LiteralPath $safe -Force -ErrorAction Stop
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Refusing to remove reparse point/symbolic link '$safe'."
        }
        Remove-Item -LiteralPath $safe -Recurse -Force -ErrorAction Stop
    }
}

function Get-DownloadedPowerPagesSiteRoot {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$DownloadRoot)

    if (-not (Test-Path -LiteralPath $DownloadRoot -PathType Container)) {
        throw "Download root does not exist after PAC download: '$DownloadRoot'."
    }

    $manifestFiles = @(
        Get-ChildItem -LiteralPath $DownloadRoot -Filter 'org-url-manifest.yml' -File -Recurse -ErrorAction Stop |
            Sort-Object FullName
    )
    $candidates = @(
        foreach ($manifest in $manifestFiles) {
            $directory = $manifest.Directory.FullName
            if (Test-Path -LiteralPath (Join-Path $directory 'manifest.yml') -PathType Leaf) {
                $directory
            }
        } |
            Sort-Object -Unique
    )

    if ($candidates.Count -ne 1) {
        throw "Expected exactly one downloaded Power Pages site root containing both org-url-manifest.yml and manifest.yml below '$DownloadRoot', but found $($candidates.Count)."
    }

    $siteRoot = $candidates[0]
    $contentFiles = @(
        Get-ChildItem -LiteralPath $siteRoot -File -Recurse -ErrorAction Stop |
            Where-Object { $_.Name -notin @('org-url-manifest.yml','manifest.yml') }
    )
    if ($contentFiles.Count -eq 0) {
        throw "Downloaded site '$siteRoot' contains the PAC manifest files but no additional site content."
    }

    return [ordered]@{
        path = $siteRoot
        contentFileCount = $contentFiles.Count
        totalFileCount = @(Get-ChildItem -LiteralPath $siteRoot -File -Recurse -ErrorAction Stop).Count
    }
}

$environment = Assert-HttpsEnvironmentUrl -Url $EnvironmentUrl
$backupRootPath = Assert-SafeMutationDirectory -Path $BackupRoot -Description 'BackupRoot'
$timestamp = [DateTimeOffset]::UtcNow
$stamp = $timestamp.ToString('yyyyMMddTHHmmssZ')
$backupName = 'PowerPages-' + $WebsiteId.ToLowerInvariant() + '-' + $stamp + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$backupDirectory = Assert-SafeChildPath -Path (Join-Path $backupRootPath $backupName) -AllowedRoot $backupRootPath -Description 'Backup directory'
$downloadRoot = Join-Path $backupDirectory 'site-download'

if (Test-Path -LiteralPath $backupDirectory) {
    throw "Backup directory unexpectedly already exists: '$backupDirectory'."
}

if (-not $PSCmdlet.ShouldProcess($backupDirectory,"Create a new Power Pages backup for site '$WebsiteId' from '$environment'")) {
    return [pscustomobject]@{
        planned = $true
        environment = $environment
        websiteId = $WebsiteId.ToLowerInvariant()
        backupDirectory = $backupDirectory
        remoteMutation = $false
        localFilesystemMutation = $true
        localAuthenticationContextMutation = $true
    }
}

$pac = Resolve-PacCommand
$originalIndex = Get-ActivePacProfileIndex -PacCommand $pac
$authCreated = $false
$backupCreated = $false
$restoreSucceeded = $false

try {
    Select-PacAuthenticationProfile -PacCommand $pac -ProfileName $PacAuthProfile -EnvironmentUrl $environment `
        -CreateIfMissing:$CreateAuthenticationProfile -DeviceCode:$DeviceCode | ForEach-Object { $authCreated = [bool]$_.created }

    New-Item -ItemType Directory -Path $downloadRoot -Force -ErrorAction Stop | Out-Null
    $backupCreated = $true

    $downloadArgs = [System.Collections.Generic.List[string]]::new()
    foreach ($value in @('pages','download','--path',$downloadRoot,'--webSiteId',$WebsiteId,'--environment',$environment)) {
        $downloadArgs.Add($value) | Out-Null
    }
    if ($ModelVersion) {
        $downloadArgs.Add('--modelVersion') | Out-Null
        $downloadArgs.Add($ModelVersion) | Out-Null
    }

    Write-Host "Downloading Power Pages site into new backup '$backupDirectory'..." -ForegroundColor Cyan
    Invoke-PacCommand -PacCommand $pac -Arguments $downloadArgs.ToArray() -WriteOutput | Out-Null
    $siteInfo = Get-DownloadedPowerPagesSiteRoot -DownloadRoot $downloadRoot

    $versionResult = Invoke-PacCommand -PacCommand $pac -Arguments @('--version') -AllowFailure
    $metadata = [ordered]@{
        schemaVersion = 1
        tool = [ordered]@{ name='Backup-PowerPagesSite'; version='1.0.0'; maturity='Experimental' }
        capturedUtc = $timestamp.ToString('o')
        environment = $environment
        websiteId = $WebsiteId.ToLowerInvariant()
        pacAuthProfile = $PacAuthProfile
        authenticationProfileCreated = $authCreated
        modelVersion = if ($ModelVersion) { $ModelVersion } else { $null }
        pacVersion = if ($versionResult.exitCode -eq 0) { $versionResult.text.Trim() } else { $null }
        backupDirectory = $backupDirectory
        siteContentDirectory = $siteInfo.path
        totalFileCount = $siteInfo.totalFileCount
        contentFileCount = $siteInfo.contentFileCount
        remoteMutationPerformed = $false
        safetyClassification = 'CREATE_ONLY_LOCAL_BACKUP'
    }

    $metadataPath = Join-Path $backupDirectory 'backup-metadata.json'
    Write-Utf8NoBomText -Path $metadataPath -Content ($metadata | ConvertTo-Json -Depth 12)

    Write-Host "Power Pages backup completed successfully: '$backupDirectory'." -ForegroundColor Green
    return [pscustomobject]$metadata
}
catch {
    if ($backupCreated -and (Test-Path -LiteralPath $backupDirectory)) {
        try {
            Remove-SafeDirectory -Path $backupDirectory -AllowedRoot $backupRootPath -Description 'Incomplete backup cleanup'
        }
        catch {
            Write-Warning "Backup failed and incomplete backup '$backupDirectory' could not be removed automatically: $($_.Exception.Message)"
        }
    }
    throw
}
finally {
    $restoreSucceeded = Restore-PacAuthenticationProfile -PacCommand $pac -OriginalIndex $originalIndex
    if (-not $restoreSucceeded) {
        Write-Warning 'The local PAC authentication context may differ from its state before the backup.'
    }
}
