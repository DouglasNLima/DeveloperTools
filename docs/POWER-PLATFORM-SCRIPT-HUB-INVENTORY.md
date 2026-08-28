# Power Platform Script Hub inventory

This is the reconciliation record for the Power Platform Script Hub modernisation. The attached packages were treated as source authority for the scripts, parameters, output contracts and safety notes. Their package prose was used as metadata, not as instructions to make Developer Tools execute anything.

The authority order is:

1. `Power-Platform-Script-Library-v1.0.0` for PowerShell workflows.
2. `Dynamics-Dataverse-Forensics-Toolkit-v1.0.0` for Dynamics / Dataverse JavaScript investigation workflows.
3. `PS Scripts` for existing PCF capabilities not superseded by either package.

All source files are committed under `assets/power-platform-script-hub/`. The catalogue stores each source name, package, SHA-256 and line count so that accidental truncation or replacement is detected by unit tests.

## Existing Hub reconciliation

| Existing Hub capability | Existing source | Attachment comparison | Decision |
| --- | --- | --- | --- |
| Create / initialise | `Initialize-NewPCFProject.ps1` | No newer equivalent in the Power Platform library | Keep and expose all source parameters. |
| Develop / environment report | `Get-PCFDevEnvironmentReport.ps1` | No newer equivalent | Keep, including the optional network diagnostics and baseline file. |
| Develop / test harness | `Start-PCFTestHarness.ps1` | No newer equivalent | Keep the local watch workflow. |
| Version & build / update version | `Update-Version.ps1` | No newer equivalent | Keep the source `Build` / `Revision` parameters. |
| Version & build / build and deploy | `Build-And-Deploy-PCF.ps1` | No newer equivalent | Keep the release, packaging, checker and deployment switches. |
| Deploy / quick deploy | `Push-PCFQuickDeploy.ps1` | No newer equivalent | Keep the PAC-context workflow; omit its service-principal parameter set. |
| Deploy / solution deployment | `Deploy-Solution.ps1` | No newer equivalent | Keep the authoritative import parameters. |
| Quality / Solution Checker | `Invoke-SolutionCheck.ps1` | No newer equivalent | Keep. The former UI-only `FailOnLevel` and numeric threshold are not emitted because the source accepts SARIF level and rule-file parameters instead. |

The former PCF-only workbench is now the Development mode of the single Power Platform Script Hub. The old action values remain available through `buildPcfScriptCommand()` and the old `/create`, `/develop`, `/build`, `/deploy` and `/quality` route aliases resolve to that mode.

## PowerShell library inventory

Every one of the 14 manifest scripts from `Power-Platform-Script-Library-v1.0.0` is integrated.

| Source script | Category / Hub location | Runtime | Inputs | Outputs | Safety | Maturity |
| --- | --- | --- | --- | --- | --- | --- |
| `Get-PowerPlatformEnvironmentSnapshot.ps1` | Environment and ALM / Investigation | PowerShell helper | Environment URL; run-time SecureString token; API version; row limit; JSON and summary paths | Deterministic environment snapshot JSON and summary | Remote read-only | Experimental |
| `Compare-PowerPlatformEnvironmentSnapshots.ps1` | Environment and ALM / Investigation | PowerShell helper | Reference and difference snapshot paths; JSON and summary paths | Local JSON comparison and summary | Local-only | Experimental |
| `Test-SolutionTargetReadiness.ps1` | Environment and ALM / Investigation | PowerShell helper | Solution ZIP; environment URL; run-time SecureString token; API version; row limit; resolved-reference gate; output paths | Readiness JSON and summary | Remote read-only plus local inspection | Experimental |
| `Get-SolutionDeploymentHistory.ps1` | Environment and ALM / Investigation | PowerShell helper | Environment URL; run-time SecureString token; optional solution name; lookback days; record limit; API version; output paths | Deployment-history JSON and summary | Remote read-only | Experimental |
| `Get-PluginRegistrationInventory.ps1` | Plug-ins / Investigation | PowerShell helper | Environment URL; run-time SecureString token; optional assembly filter; row limit; API version; output paths | Plug-in registration inventory JSON and summary | Remote read-only | Experimental |
| `Compare-PluginRegistration.ps1` | Plug-ins / Investigation | PowerShell helper | Reference and difference inventory paths; JSON and summary paths | Local plug-in comparison JSON and summary | Local-only | Experimental |
| `Test-EnvironmentReferences.ps1` | Environment configuration / Investigation | PowerShell helper | Environment URL; run-time SecureString token; row limit; API version; output paths | Environment-variable and connection-reference report | Remote read-only | Experimental |
| `Get-FlowDeploymentState.ps1` | Environment configuration / Investigation | PowerShell helper | Environment URL; run-time SecureString token; optional solution/name filters; row limit; API version; output paths | Flow deployment-state JSON and summary | Remote read-only | Experimental |
| `Test-PCFProjectHealth.ps1` | PCF / Development Quality | PowerShell helper | Project root; JSON and summary paths | Local PCF project health report | Local-only | Experimental |
| `Test-PCFReleasePackage.ps1` | PCF / Development Quality | PowerShell helper | At least one managed or unmanaged package path; expected identity and versions; blocked-result gate; JSON and summary paths | Local package validation JSON and summary | Local-only | Experimental |
| `Get-PowerPagesSiteInventory.ps1` | Site discovery / Power Pages | PowerShell helper | Environment-definition JSON or file; explicit authentication-profile and device-code switches; JSON path | Site inventory and optional JSON file | Remote read-only plus local authentication-context mutation | Experimental |
| `Sync-PowerPagesSite.ps1` | Synchronisation / Power Pages | PowerShell helper | Environment URL; PAC profile; website GUID; local target and staging directories; model version; explicit authentication switches | Downloaded and synchronised local site tree | Remote read-only plus local filesystem and authentication-context mutation | Experimental |
| `Backup-PowerPagesSite.ps1` | Backup / Power Pages | PowerShell helper | Environment URL; PAC profile; website GUID; backup root; model version; explicit authentication switches | Create-only local backup tree | Create-only local backup plus authentication-context mutation | Experimental |
| `Compare-PowerPagesSites.ps1` | Comparison / Power Pages | PowerShell helper | Two local site paths; optional environment manifest; JSON and Markdown paths | Local JSON diff and optional Markdown summary | Local-only | Experimental |

The library's SecureString `AccessToken` input is never shown as a Developer Tools field. Generated commands and launchers read it at execution time with `Read-Host -AsSecureString`; no token, password, client secret or refresh token is written to URL state, storage or a downloaded artefact.

## Retained PCF package inventory

The 11 non-superseded executable helpers from `PS Scripts` remain available in Development mode. They are the eight existing actions plus the three additional capabilities below.

| Source script | Hub location | Runtime | Decision |
| --- | --- | --- | --- |
| `Initialize-NewPCFProject.ps1` | Create | PowerShell helper | Retained existing capability. |
| `Get-PCFDevEnvironmentReport.ps1` | Develop | PowerShell helper | Retained existing capability. |
| `Start-PCFTestHarness.ps1` | Develop | PowerShell helper | Retained existing capability. |
| `Update-Version.ps1` | Version & build | PowerShell helper | Retained existing capability. |
| `Build-And-Deploy-PCF.ps1` | Version & build | PowerShell helper | Retained existing capability. |
| `Push-PCFQuickDeploy.ps1` | Deploy | PowerShell helper | Retained existing capability; PAC service-principal parameters are excluded. |
| `Deploy-Solution.ps1` | Deploy | PowerShell helper | Retained existing capability. |
| `Invoke-SolutionCheck.ps1` | Quality | PowerShell helper | Retained existing capability with actual source parameters. |
| `New-PCFIdentityClone.ps1` | Create | PowerShell helper | Added as a retained PCF capability. |
| `Set-PCFReleaseDefaults.ps1` | Quality | PowerShell helper | Added as a retained PCF capability. |
| `Test-PCFToolingPackage.ps1` | Quality | PowerShell helper | Added as a retained PCF capability. |

The package's `PCF.Common.ps1` is retained as a dot-sourced dependency, not as a user-facing action. `pcf-env.example.json` is retained as a supporting baseline example. `Test-PCFProjectConfiguration.ps1` is explicitly superseded by the broader authoritative `Test-PCFProjectHealth.ps1`; `Test-PCFReleaseArtifact.ps1` is explicitly superseded by `Test-PCFReleasePackage.ps1`, which covers package identity, managed/unmanaged parity and hashes. Both superseded files remain in the imported source folder for provenance and for the package's own dependency checks.

## JavaScript forensic inventory

Every one of the 15 scripts from `Dynamics-Dataverse-Forensics-Toolkit-v1.0.0` is integrated. Browser DevTools scripts are downloaded as `.txt` by default; local comparison scripts are also `.txt` because they are browser-run local utilities.

| Source script | Category / Hub location | Runtime | Inputs | Outputs | Safety | Maturity |
| --- | --- | --- | --- | --- | --- | --- |
| `PCF-Forensics-Generic.txt` | PCF / Investigation | Browser DevTools | PCF control name; API version; timeout/retry values; retained history, WebResource, layer and component row limits; HTTP and final-JSON switches | Rich console evidence, `window.__PCF_FORENSICS`, and the supplied panel's JSON actions | Remote read-only | Field-tested |
| `Solution-Forensics-Generic.txt` | Solutions / Investigation | Browser DevTools | Solution unique name; API version; timeout/retry values; component, patch, warning and history limits | Structured forensic report and toolkit panel | Remote read-only | Experimental |
| `Plugin-Step-Forensics.txt` | Plug-ins / Investigation | Browser DevTools | Assembly name; API version; timeout/retry values; type, step and image limits | Structured forensic report and toolkit panel | Remote read-only | Experimental |
| `Flow-Forensics.txt` | Power Automate / Investigation | Browser DevTools | Optional solution/name filters; API version; timeout/retry values; flow limit | Structured forensic report and toolkit panel | Remote read-only | Experimental |
| `Environment-Fingerprint.txt` | Environment / Investigation | Browser DevTools | API version; timeout/retry values; row limit | Fingerprint report and toolkit panel | Remote read-only | Experimental |
| `Compare-Environment-Fingerprints.txt` | Environment / Investigation | Local browser | Two saved fingerprint JSON files selected in the supplied panel | Local difference report | Local-only | Experimental |
| `Component-Forensics-Generic.txt` | Components / Investigation | Browser DevTools | Component GUID; API version; timeout/retry values; row limit | Structured forensic report and toolkit panel | Remote read-only | Experimental |
| `WebResource-Integrity-Audit.txt` | Web Resources / Investigation | Browser DevTools | Prefix/name filters; API version; timeout/retry values; row limit; HTTP switch | WebResource integrity report and toolkit panel | Remote read-only | Experimental |
| `Form-Forensics.txt` | Forms / Investigation | Browser DevTools | Form GUID or name filter; API version; timeout/retry values; form limit | FormXML and control evidence report | Remote read-only | Experimental |
| `BPF-Forensics.txt` | Business Process Flows / Investigation | Browser DevTools | Process-name filter; API version; timeout/retry values; process and stage limits | BPF evidence report | Remote read-only | Experimental |
| `Environment-Reference-Audit.txt` | Environment / Investigation | Browser DevTools | API version; timeout/retry values; row limit | Environment reference report | Remote read-only | Experimental |
| `App-Module-Forensics.txt` | Apps / Investigation | Browser DevTools | Optional app unique-name filter; API version; timeout/retry values; row limit | App module evidence report | Remote read-only | Experimental |
| `Async-Operations-Health.txt` | Async Operations / Investigation | Browser DevTools | Lookback and stuck-hour thresholds; API version; timeout/retry values; row limit | Async health report | Remote read-only | Experimental |
| `Security-Role-Audit.txt` | Security / Investigation | Browser DevTools | Optional role-name filter; API version; timeout/retry values; role and privilege limits | Role and privilege audit report | Remote read-only | Experimental |
| `Security-Role-Diff.txt` | Security / Investigation | Local browser | Two saved role-audit JSON files selected in the supplied panel | Local role and privilege difference report | Local-only | Experimental |

The PCF Forensics source is preserved as the supplied 2.0.1 field-tested implementation. Only its documented `CONFIG` values are parameterised. The query sequence, HTTP checks, findings, evidence collection, report schema and `window.__PCF_FORENSICS` contract are protected by source hashes and semantic unit assertions.

## Explicit exclusions and scope boundaries

- `Test-PCFProjectConfiguration.ps1` — superseded by `Test-PCFProjectHealth.ps1` from the higher-authority PowerShell library; exposing both would create two competing project-health actions.
- `Test-PCFReleaseArtifact.ps1` — superseded by `Test-PCFReleasePackage.ps1` from the higher-authority PowerShell library; the latter is the authoritative managed/unmanaged package validator.
- `PCF.Common.ps1` — a shared dependency, not a standalone workflow.
- `pcf-env.example.json` — a supporting example, not executable.
- Service-principal `ApplicationId`, `ClientSecret` and `TenantId` inputs on `Push-PCFQuickDeploy.ps1` — deliberately not exposed because Developer Tools must not request or emit credential-bearing artefacts; the generated workflow uses the user's existing PAC authentication context.
- Azure DevOps project export — expressly outside this Goal and not a catalogue workflow; no execution, repair or Azure DevOps integration was added.

No supplied PowerShell or JavaScript workflow is silently omitted. The app only validates, renders, copies and downloads text. It never executes a generated command or script and makes no remote Power Platform request.
