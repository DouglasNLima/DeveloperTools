<#
.SYNOPSIS
    Downloads a Power Pages site and safely replaces a configured local working directory.

.DESCRIPTION
    General-purpose Power Pages synchronisation workflow:
      select PAC authentication
      -> prepare isolated staging
      -> download site
      -> validate downloaded content
      -> prepare a same-parent replacement candidate
      -> safely replace the configured local target with rollback protection
      -> clean staging
      -> restore the previous PAC authentication profile where possible.

    This script mutates the local filesystem and the local PAC authentication context. It does not upload,
    delete or modify remote Power Pages or Dataverse data.

    Execution context:
      - Remote: read-only Power Pages download.
      - Local: filesystem mutation and PAC authentication-context mutation.
    Safety classification: LOCAL_FILESYSTEM_MUTATION_WITH_READ_ONLY_REMOTE_DOWNLOAD.

.PARAMETER EnvironmentUrl
    Absolute HTTPS Dataverse environment URL.

.PARAMETER PacAuthProfile
    Existing named PAC authentication profile to select.

.PARAMETER WebsiteId
    Power Pages website GUID.

.PARAMETER LocalTargetDirectory
    Local working directory that will be replaced only after a fresh download is validated.

.PARAMETER StagingDirectory
    Staging root. A unique child directory is created and removed per run.

.PARAMETER ModelVersion
    Optional PAC modelVersion value: Standard or Enhanced.

.PARAMETER CreateAuthenticationProfile
    Explicitly allow creation of the named PAC authentication profile when it does not exist.

.PARAMETER DeviceCode
    Use device-code authentication only when a missing profile is explicitly created.

.EXAMPLE
    .\Sync-PowerPagesSite.ps1 `
        -EnvironmentUrl 'https://contoso.crm.dynamics.com' `
        -PacAuthProfile 'Contoso-Dev' `
        -WebsiteId '11111111-2222-3333-4444-555555555555' `
        -LocalTargetDirectory 'C:\Repos\Portal\site' `
        -StagingDirectory 'C:\Temp\power-pages-staging' `
        -ModelVersion Enhanced
#>
[CmdletBinding(SupportsShouldProcess=$true,ConfirmImpact='High')]
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
    [string]$LocalTargetDirectory,

    [Parameter(Mandatory)]
    [string]$StagingDirectory,

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
$target = Assert-SafeMutationDirectory -Path $LocalTargetDirectory -Description 'LocalTargetDirectory' -MayNotExist
$stagingRoot = Assert-SafeMutationDirectory -Path $StagingDirectory -Description 'StagingDirectory' -MayNotExist

if ($target.Equals($stagingRoot,[StringComparison]::OrdinalIgnoreCase) -or
    (Test-PathIsDescendant -Candidate $target -Parent $stagingRoot) -or
    (Test-PathIsDescendant -Candidate $stagingRoot -Parent $target)) {
    throw "LocalTargetDirectory '$target' and StagingDirectory '$stagingRoot' must not be equal or nested within one another."
}

$targetParent = Split-Path -Path $target -Parent
if ([string]::IsNullOrWhiteSpace($targetParent)) { throw "Could not determine parent directory for '$target'." }
$targetParent = Assert-SafeMutationDirectory -Path $targetParent -Description 'Local target parent directory' -MayNotExist

$operation = "Download Power Pages site '$WebsiteId' from '$environment' and replace local target '$target'"
if (-not $PSCmdlet.ShouldProcess($target,$operation)) {
    return [pscustomobject]@{
        planned = $true
        environment = $environment
        websiteId = $WebsiteId.ToLowerInvariant()
        target = $target
        stagingRoot = $stagingRoot
        remoteMutation = $false
        localFilesystemMutation = $true
        localAuthenticationContextMutation = $true
    }
}

Write-Warning "LOCAL FILESYSTEM MUTATION: after a fresh site download is validated, '$target' will be replaced. The previous target is retained temporarily for rollback until the replacement succeeds."

if (-not (Test-Path -LiteralPath $stagingRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $stagingRoot -Force -ErrorAction Stop | Out-Null
}
if (-not (Test-Path -LiteralPath $targetParent -PathType Container)) {
    New-Item -ItemType Directory -Path $targetParent -Force -ErrorAction Stop | Out-Null
}

$pac = Resolve-PacCommand
$originalIndex = Get-ActivePacProfileIndex -PacCommand $pac
$sessionName = 'sync-' + [Guid]::NewGuid().ToString('N')
$sessionRoot = Join-Path $stagingRoot $sessionName
$candidate = Join-Path $targetParent ((Split-Path $target -Leaf) + '.incoming-' + [Guid]::NewGuid().ToString('N'))
$rollback = Join-Path $targetParent ((Split-Path $target -Leaf) + '.rollback-' + [Guid]::NewGuid().ToString('N'))
$authCreated = $false
$targetBackedUp = $false
$candidateInstalled = $false
$downloadInfo = $null
$restoreSucceeded = $false

try {
    Select-PacAuthenticationProfile -PacCommand $pac -ProfileName $PacAuthProfile -EnvironmentUrl $environment `
        -CreateIfMissing:$CreateAuthenticationProfile -DeviceCode:$DeviceCode | ForEach-Object { $authCreated = [bool]$_.created }

    New-Item -ItemType Directory -Path $sessionRoot -ErrorAction Stop | Out-Null

    $downloadArgs = [System.Collections.Generic.List[string]]::new()
    foreach ($value in @('pages','download','--path',$sessionRoot,'--webSiteId',$WebsiteId,'--environment',$environment,'--overwrite')) {
        $downloadArgs.Add($value) | Out-Null
    }
    if ($ModelVersion) {
        $downloadArgs.Add('--modelVersion') | Out-Null
        $downloadArgs.Add($ModelVersion) | Out-Null
    }

    Write-Host 'Downloading Power Pages site into isolated staging...' -ForegroundColor Cyan
    Invoke-PacCommand -PacCommand $pac -Arguments $downloadArgs.ToArray() -WriteOutput | Out-Null

    $downloadInfo = Get-DownloadedPowerPagesSiteRoot -DownloadRoot $sessionRoot
    Write-Host "Validated downloaded site: $($downloadInfo.path) ($($downloadInfo.totalFileCount) files)." -ForegroundColor Green

    $candidate = Assert-SafeChildPath -Path $candidate -AllowedRoot $targetParent -Description 'Replacement candidate'
    $rollback = Assert-SafeChildPath -Path $rollback -AllowedRoot $targetParent -Description 'Rollback directory'
    if (Test-Path -LiteralPath $candidate) { throw "Replacement candidate unexpectedly exists: '$candidate'." }
    if (Test-Path -LiteralPath $rollback) { throw "Rollback path unexpectedly exists: '$rollback'." }

    Write-Host 'Preparing same-parent replacement candidate...' -ForegroundColor Cyan
    Copy-Item -LiteralPath $downloadInfo.path -Destination $candidate -Recurse -Force -ErrorAction Stop
    $candidateInfo = Get-DownloadedPowerPagesSiteRoot -DownloadRoot $candidate
    if (-not (Get-CanonicalPath -Path $candidateInfo.path).Equals((Get-CanonicalPath -Path $candidate),[StringComparison]::OrdinalIgnoreCase)) {
        throw "Copied replacement candidate did not validate at its expected root '$candidate'."
    }

    try {
        if (Test-Path -LiteralPath $target) {
            $targetItem = Get-Item -LiteralPath $target -Force -ErrorAction Stop
            if (($targetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Refusing to replace reparse point/symbolic link target '$target'."
            }
            Move-Item -LiteralPath $target -Destination $rollback -ErrorAction Stop
            $targetBackedUp = $true
        }

        Move-Item -LiteralPath $candidate -Destination $target -ErrorAction Stop
        $candidateInstalled = $true
    }
    catch {
        $replacementError = $_
        if (-not $candidateInstalled -and $targetBackedUp) {
            if (Test-Path -LiteralPath $target) {
                Remove-SafeDirectory -Path $target -AllowedRoot $targetParent -Description 'Incomplete replacement target'
            }
            if (Test-Path -LiteralPath $rollback) {
                Move-Item -LiteralPath $rollback -Destination $target -ErrorAction Stop
                $targetBackedUp = $false
            }
        }
        throw "Local target replacement failed. Rollback was attempted. $($replacementError.Exception.Message)"
    }

    try {
        $finalInfo = Get-DownloadedPowerPagesSiteRoot -DownloadRoot $target
    }
    catch {
        $validationError = $_
        Write-Warning "The installed target failed post-swap validation. Restoring the previous local target where possible."

        if (Test-Path -LiteralPath $target) {
            Remove-SafeDirectory -Path $target -AllowedRoot $targetParent -Description 'Invalid installed replacement target'
        }

        if ($targetBackedUp -and (Test-Path -LiteralPath $rollback)) {
            Move-Item -LiteralPath $rollback -Destination $target -ErrorAction Stop
            $targetBackedUp = $false
        }

        throw "The replacement target failed validation after installation and rollback was attempted. $($validationError.Exception.Message)"
    }

    if ($targetBackedUp -and (Test-Path -LiteralPath $rollback)) {
        try {
            Remove-SafeDirectory -Path $rollback -AllowedRoot $targetParent -Description 'Completed rollback directory'
            $targetBackedUp = $false
        }
        catch {
            Write-Warning "Replacement succeeded and validated, but rollback directory '$rollback' could not be removed automatically: $($_.Exception.Message)"
        }
    }
    $result = [ordered]@{
        schemaVersion = 1
        tool = [ordered]@{ name='Sync-PowerPagesSite'; version='1.0.0'; maturity='Experimental' }
        capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
        executionContext = 'READ_ONLY_REMOTE_WITH_LOCAL_FILESYSTEM_AND_AUTH_CONTEXT_MUTATION'
        safetyClassification = 'LOCAL_FILESYSTEM_MUTATION'
        environment = $environment
        websiteId = $WebsiteId.ToLowerInvariant()
        pacAuthProfile = $PacAuthProfile
        authenticationProfileCreated = $authCreated
        modelVersion = if ($ModelVersion) { $ModelVersion } else { $null }
        localTargetDirectory = $target
        downloadedFileCount = $downloadInfo.totalFileCount
        finalFileCount = $finalInfo.totalFileCount
        replacementCompleted = $true
        remoteMutationPerformed = $false
        rollbackDirectoryRetained = [bool]$targetBackedUp
    }

    Write-Host "Power Pages local synchronisation completed successfully: '$target'." -ForegroundColor Green
    return [pscustomobject]$result
}
finally {
    if (Test-Path -LiteralPath $candidate) {
        try { Remove-SafeDirectory -Path $candidate -AllowedRoot $targetParent -Description 'Replacement candidate cleanup' }
        catch { Write-Warning "Could not clean replacement candidate '$candidate': $($_.Exception.Message)" }
    }

    if (Test-Path -LiteralPath $sessionRoot) {
        try { Remove-SafeDirectory -Path $sessionRoot -AllowedRoot $stagingRoot -Description 'Staging session cleanup' }
        catch { Write-Warning "Could not clean staging session '$sessionRoot': $($_.Exception.Message)" }
    }

    $restoreSucceeded = Restore-PacAuthenticationProfile -PacCommand $pac -OriginalIndex $originalIndex
    if (-not $restoreSucceeded) {
        Write-Warning 'The local PAC authentication context may differ from its state before the synchronisation.'
    }
}
