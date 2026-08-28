[CmdletBinding(DefaultParameterSetName = 'ExistingAuth')]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z][A-Za-z0-9]{1,7}$')]
    [string]$PublisherPrefix,

    [Parameter(Mandatory = $true)]
    [string]$EnvironmentUrl,

    [Parameter()]
    [string]$SolutionUniqueName,

    [Parameter()]
    [switch]$Incremental,

    [Parameter(Mandatory = $true, ParameterSetName = 'ServicePrincipal')]
    [string]$ApplicationId,

    [Parameter(Mandatory = $true, ParameterSetName = 'ServicePrincipal')]
    [string]$ClientSecret,

    [Parameter(Mandatory = $true, ParameterSetName = 'ServicePrincipal')]
    [string]$TenantId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path -Path $PSScriptRoot -ChildPath 'PCF.Common.ps1')

$context = Get-PcfProjectContext -ProjectRoot $ProjectRoot
$pac = Resolve-NativeCommandPath -Name 'pac'
$normalisedEnvironment = $EnvironmentUrl.TrimEnd('/')
$tempProfileName = ('PCFPush-{0}' -f (Get-Date -Format 'yyyyMMddHHmmss'))
$tempProfileCreated = $false

try {
    if ($PSCmdlet.ParameterSetName -eq 'ServicePrincipal') {
        Write-Host 'Creating temporary service-principal PAC authentication profile...' -ForegroundColor Cyan
        $auth = Invoke-NativeCommand -Command $pac -Arguments @(
            'auth', 'create',
            '--name', $tempProfileName,
            '--applicationId', $ApplicationId,
            '--clientSecret', $ClientSecret,
            '--tenant', $TenantId,
            '--environment', $normalisedEnvironment
        ) -WriteOutput
        Assert-NativeCommandSucceeded -Result $auth -Description 'pac auth create (service principal)'
        $tempProfileCreated = $true
    }
    else {
        Ensure-PacAuthentication -PacCommand $pac -EnvironmentUrl $normalisedEnvironment | Out-Null
    }

    $arguments = New-Object System.Collections.Generic.List[string]
    $arguments.Add('pcf')
    $arguments.Add('push')
    $arguments.Add('--publisher-prefix')
    $arguments.Add($PublisherPrefix)
    $arguments.Add('--environment')
    $arguments.Add($normalisedEnvironment)

    if ($SolutionUniqueName) {
        $arguments.Add('--solution-unique-name')
        $arguments.Add($SolutionUniqueName)
    }
    if ($Incremental) {
        $arguments.Add('--incremental')
    }

    Write-Host "Pushing '$($context.ControlNamespace).$($context.ControlConstructor)' to '$normalisedEnvironment'..." -ForegroundColor Green
    Write-Host "PcfBuildMode in project: $(Get-MsBuildPropertyValue -ProjectFile $context.PcfProject.FullName -PropertyName 'PcfBuildMode')" -ForegroundColor DarkGray

    Push-Location $context.ControlFolder
    try {
        $push = Invoke-NativeCommand -Command $pac -Arguments $arguments.ToArray() -WriteOutput
        Assert-NativeCommandSucceeded -Result $push -Description 'pac pcf push'
    }
    finally {
        Pop-Location
    }

    Write-Host 'PCF push completed successfully.' -ForegroundColor Green
}
finally {
    if ($tempProfileCreated) {
        $cleanup = Invoke-NativeCommand -Command $pac -Arguments @('auth', 'delete', '--name', $tempProfileName)
        if ($cleanup.ExitCode -ne 0) {
            Write-Warning "Temporary PAC auth profile '$tempProfileName' could not be removed automatically."
        }
    }
}
