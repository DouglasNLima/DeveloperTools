[CmdletBinding()]
param(
    [Parameter()]
    [string]$BaselineFile,

    [Parameter()]
    [switch]$CheckNetwork,

    [Parameter()]
    [string]$NpmRegistry = 'https://registry.npmjs.org/'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1')

function Get-VersionFromText {
    param([string]$Text)
    $match = [regex]::Match($Text, '(?<!\d)(\d+\.\d+\.\d+)(?:\.\d+)?')
    if ($match.Success) {
        return $match.Groups[1].Value
    }
    return $null
}

function Get-ToolReport {
    param(
        [string]$Tool,
        [string]$CommandName,
        [string[]]$Arguments
    )

    try {
        $command = Resolve-NativeCommandPath -Name $CommandName
        $result = Invoke-NativeCommand -Command $command -Arguments $Arguments
        $version = Get-VersionFromText -Text $result.Text
        if (-not $version -and $result.Output.Count -gt 0) {
            $version = $result.Output[0].Trim().TrimStart('v')
        }

        $status = if ($result.ExitCode -eq 0) { 'OK' } else { 'ERROR' }
        $details = if ($result.ExitCode -eq 0) { '' } else { "Exit code $($result.ExitCode)" }
        [PSCustomObject]@{
            Tool    = $Tool
            Version = $version
            Path    = $command
            Status  = $status
            Details = $details
        }
    }
    catch {
        [PSCustomObject]@{
            Tool    = $Tool
            Version = $null
            Path    = $null
            Status  = 'NOT FOUND'
            Details = $_.Exception.Message
        }
    }
}

$report = New-Object System.Collections.Generic.List[object]
$report.Add((Get-ToolReport -Tool 'node' -CommandName 'node' -Arguments @('--version'))) | Out-Null
$report.Add((Get-ToolReport -Tool 'npm' -CommandName 'npm' -Arguments @('--version'))) | Out-Null

try {
    $dotnet = Resolve-NativeCommandPath -Name 'dotnet'
    $dotnetResult = Invoke-NativeCommand -Command $dotnet -Arguments @('--version')
    $dotnetStatus = if ($dotnetResult.ExitCode -eq 0) { 'OK' } else { 'ERROR' }
    $dotnetDetails = if ($dotnetResult.ExitCode -eq 0) { '' } else { "Exit code $($dotnetResult.ExitCode)" }
    $report.Add([PSCustomObject]@{
        Tool    = 'dotnetSDK'
        Version = Get-VersionFromText -Text $dotnetResult.Text
        Path    = $dotnet
        Status  = $dotnetStatus
        Details = $dotnetDetails
    }) | Out-Null
}
catch {
    $report.Add([PSCustomObject]@{ Tool='dotnetSDK'; Version=$null; Path=$null; Status='NOT FOUND'; Details=$_.Exception.Message }) | Out-Null
}

try {
    $pac = Resolve-NativeCommandPath -Name 'pac'
    $pacResult = Invoke-NativeCommand -Command $pac -Arguments @('version')
    $pacStatus = if ($pacResult.ExitCode -eq 0) { 'OK' } else { 'ERROR' }
    $pacDetails = if ($pacResult.ExitCode -eq 0) { '' } else { "Exit code $($pacResult.ExitCode)" }
    $report.Add([PSCustomObject]@{
        Tool    = 'pac'
        Version = Get-VersionFromText -Text $pacResult.Text
        Path    = $pac
        Status  = $pacStatus
        Details = $pacDetails
    }) | Out-Null
}
catch {
    $report.Add([PSCustomObject]@{ Tool='pac'; Version=$null; Path=$null; Status='NOT FOUND'; Details=$_.Exception.Message }) | Out-Null
}

if ($CheckNetwork) {
    try {
        $npm = Resolve-NativeCommandPath -Name 'npm'
        $npmPing = Invoke-NativeCommand -Command $npm -Arguments @('ping', "--registry=$NpmRegistry")
        $npmRegistryStatus = if ($npmPing.ExitCode -eq 0 -and $npmPing.Text -match 'PONG') { 'OK' } else { 'ERROR' }
        $report.Add([PSCustomObject]@{
            Tool    = 'npmRegistry'
            Version = $null
            Path    = $NpmRegistry
            Status  = $npmRegistryStatus
            Details = ($npmPing.Output | Select-Object -Last 3) -join ' | '
        }) | Out-Null
    }
    catch {
        $report.Add([PSCustomObject]@{ Tool='npmRegistry'; Version=$null; Path=$NpmRegistry; Status='ERROR'; Details=$_.Exception.Message }) | Out-Null
    }

    try {
        $node = Resolve-NativeCommandPath -Name 'node'
        $escapedRegistry = $NpmRegistry.Replace("'", "\\'")
        $nodeCode = "require('https').get('$escapedRegistry',r=>{console.log('STATUS',r.statusCode);r.resume();process.exit(r.statusCode>=200&&r.statusCode<400?0:2)}).on('error',e=>{console.error(e);process.exit(1)})"
        $nodeProbe = Invoke-NativeCommand -Command $node -Arguments @('-e', $nodeCode)
        $nodeHttpsStatus = if ($nodeProbe.ExitCode -eq 0) { 'OK' } else { 'ERROR' }
        $report.Add([PSCustomObject]@{
            Tool    = 'nodeHttps'
            Version = $null
            Path    = $NpmRegistry
            Status  = $nodeHttpsStatus
            Details = ($nodeProbe.Output | Select-Object -Last 3) -join ' | '
        }) | Out-Null
    }
    catch {
        $report.Add([PSCustomObject]@{ Tool='nodeHttps'; Version=$null; Path=$NpmRegistry; Status='ERROR'; Details=$_.Exception.Message }) | Out-Null
    }
}

$validationFailures = New-Object System.Collections.Generic.List[string]
if ($BaselineFile) {
    $resolvedBaseline = (Resolve-Path -LiteralPath $BaselineFile -ErrorAction Stop).Path
    $baseline = Get-Content -LiteralPath $resolvedBaseline -Raw | ConvertFrom-Json

    foreach ($item in $report) {
        $property = $baseline.PSObject.Properties[$item.Tool]
        if (-not $property) {
            continue
        }

        $requirement = [string]$property.Value
        if ($item.Status -ne 'OK') {
            $validationFailures.Add("$($item.Tool) is required by the baseline but status is $($item.Status).")
            continue
        }

        if ([string]::IsNullOrWhiteSpace($item.Version)) {
            $validationFailures.Add("$($item.Tool) version could not be determined.")
            continue
        }

        $minimumText = $requirement.Trim() -replace '^>=\s*', ''
        try {
            $actualVersion = [version]$item.Version
            $minimumVersion = [version]$minimumText
            if ($actualVersion -lt $minimumVersion) {
                $validationFailures.Add("$($item.Tool) version $actualVersion is below required version $minimumVersion.")
            }
        }
        catch {
            $validationFailures.Add("Could not compare version requirement '$requirement' for $($item.Tool) with detected version '$($item.Version)'.")
        }
    }
}

$report | Format-Table Tool, Version, Status, Path, Details -AutoSize | Out-Host

if ($validationFailures.Count -gt 0) {
    throw "Environment validation failed:`n - " + ($validationFailures -join "`n - ")
}

return $report.ToArray()
