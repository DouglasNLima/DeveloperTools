# PCF Build & Deployment Tooling — Release-Safe Baseline

This package modernises the existing PCF PowerShell workflow while keeping the current project structure:

```text
<ProjectRoot>/
  <ControlName>/
    *.pcfproj
    ControlManifest.Input.xml
    package.json
    package-lock.json
  Solution/
    *.cdsproj
    src/Other/Solution.xml
  PS Scripts/
    ...this package...
```

## Key guarantees

- Promotable builds are **Release + PCF production mode**.
- `PcfBuildMode=production` is required in the `.pcfproj`.
- `SolutionPackageType=Both` is required in the `.cdsproj`.
- `package-lock.json` + `npm ci` are required for deterministic release builds unless an explicit diagnostic override is used.
- npm warnings on stderr do not fail a build when the native exit code is `0`.
- Release ZIPs are validated before deployment.
- A release is rejected if `bundle.js` contains known Webpack development-build markers such as `sourceURL=webpack://`.
- Managed and unmanaged PCF resources must have identical SHA-256 hashes.
- Version rollback restores the exact original bytes of versioned files instead of using `git restore .`.
- PAC authentication uses `--environment`, not the deprecated `--url` option.
- PAC commands are invoked with argument arrays rather than `Invoke-Expression`.
- `pac solution import` can use async import, max wait, force overwrite, settings files, and stage-and-upgrade through explicit parameters.

## Files

- `Build-And-Deploy-PCF.ps1` — main release build/package/deploy workflow.
- `Deploy-Solution.ps1` — solution import wrapper.
- `Get-PCFDevEnvironmentReport.ps1` — local tool and optional npm/Node network diagnostics.
- `Initialize-NewPCFProject.ps1` — creates a new PCF + solution project with release-safe defaults.
- `Invoke-SolutionCheck.ps1` — Power Apps Checker wrapper and SARIF gate.
- `Push-PCFQuickDeploy.ps1` — direct `pac pcf push` workflow with correct parameter sets.
- `Set-PCFReleaseDefaults.ps1` — applies `PcfBuildMode=production` and `SolutionPackageType=Both` to an existing project.
- `Start-PCFTestHarness.ps1` — local development/watch workflow.
- `Test-PCFProjectConfiguration.ps1` — release-readiness checks.
- `Test-PCFReleaseArtifact.ps1` — inspects packaged PCF manifests/resources and rejects development bundles.
- `Test-PCFToolingPackage.ps1` — parses every PowerShell file in this package for syntax errors.
- `Update-Version.ps1` — synchronises solution, manifest, and optional `_manifestVersion` values.
- `PCF.Common.ps1` — shared helper functions.
- `pcf-env.example.json` — optional minimum tool-version baseline.

## One-time migration for an existing PCF

Copy the package into the project's `PS Scripts` directory, then run:

```powershell
cd "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3\PS Scripts"

.\Test-PCFToolingPackage.ps1

.\Set-PCFReleaseDefaults.ps1 `
  -ProjectRoot "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3"
```

If the project does not yet contain `package-lock.json`, create it deliberately and review/commit it before the release build:

```powershell
cd "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3\InspectionReportPCFV3"
npm install --package-lock-only
```

Alternatively, `Set-PCFReleaseDefaults.ps1 -GenerateNpmLockFile` can create it.

Then validate the project configuration:

```powershell
cd "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3\PS Scripts"

.\Test-PCFProjectConfiguration.ps1 `
  -ProjectRoot "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3"
```

## Main build + DEV deployment

For the current `InspectionReportPCFV3` case, this should increment control version, create production/Release managed and unmanaged artifacts, validate them, and deploy the unmanaged artifact to DEV:

```powershell
.\Build-And-Deploy-PCF.ps1 `
  -ProjectRoot "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3" `
  -IncrementVersion `
  -Deploy `
  -EnvironmentUrl "https://hsi-dev.crm4.dynamics.com/"
```

Generated artifacts are copied to:

```text
<ProjectRoot>\artifacts\<SolutionVersion>\
```

The build output includes SHA-256 hashes for both ZIPs.

## Managed deployment

```powershell
.\Build-And-Deploy-PCF.ps1 `
  -ProjectRoot "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3" `
  -Deploy `
  -DeployManaged `
  -EnvironmentUrl "https://target.crm4.dynamics.com/"
```

For normal ALM promotion, prefer promoting the already-built validated managed artifact rather than rebuilding for each environment.

## Power Apps Checker

```powershell
.\Build-And-Deploy-PCF.ps1 `
  -ProjectRoot "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3" `
  -RunSolutionChecker `
  -SolutionCheckerGeo Europe
```

The default gate fails on SARIF `error` findings. Use `Invoke-SolutionCheck.ps1` directly for a different threshold.

## Local development harness

Development/watch mode is intentionally separate from the release workflow:

```powershell
.\Start-PCFTestHarness.ps1 `
  -ControlFolder "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3\InspectionReportPCFV3"
```

## Environment diagnostics

```powershell
.\Get-PCFDevEnvironmentReport.ps1 -CheckNetwork
```

This includes both `npm ping` and direct Node HTTPS checks, which is useful for identifying endpoint-security/firewall blocks that affect `node.exe` but not other HTTP clients.

## Reproducibility notes

The project currently uses floating/ranged package versions in some places. A committed `package-lock.json` makes npm restore deterministic. For NuGet/MSBuild package references, prefer exact versions or a committed NuGet lock-file policy after the currently approved tooling versions are established. `Test-PCFProjectConfiguration.ps1` reports floating/ranged NuGet references as warnings rather than silently changing them.

## Release workflow philosophy

`Start-PCFTestHarness.ps1` is for developer feedback. `Build-And-Deploy-PCF.ps1` is for promotable artifacts. A promotable artifact should never depend on a Debug build, a Webpack `eval` development bundle, an unlocked npm restore, or ambiguous ZIP selection.

---

# PCF Identity Clone Tooling

## Validate tooling

```powershell
cd "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3\PS Scripts"
.\Test-PCFToolingPackage.ps1
```

## Preview the next identity clone

Current control: `InspectionReportPCFV3`. Planned next control: `InspectionReportPCFV4`.

```powershell
.\New-PCFIdentityClone.ps1 `
  -SourceProjectRoot "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3" `
  -NextGeneration `
  -WhatIf
```

## Create the next identity without building/deploying

```powershell
.\New-PCFIdentityClone.ps1 `
  -SourceProjectRoot "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3" `
  -NextGeneration
```

## Create, build and deploy the next identity unmanaged to DEV

```powershell
.\New-PCFIdentityClone.ps1 `
  -SourceProjectRoot "C:\SC\HSI\HSI\PCF\InspectionReportPCFV3" `
  -NextGeneration `
  -Build `
  -DeployToDev `
  -EnvironmentUrl "https://hsi-dev.crm4.dynamics.com/"
```

The deployment intentionally does not pass `-DeployManaged`. The source project is never modified. The target path must not already exist. On failure, an incomplete target is removed unless `-KeepTargetOnFailure` is supplied.
