const POWER_PLATFORM_LIBRARY = 'Power-Platform-Script-Library-v1.0.0';
const DATAVERSE_FORENSICS_TOOLKIT = 'Dynamics-Dataverse-Forensics-Toolkit-v1.0.0';
const PCF_SCRIPTS_PACKAGE = 'PS Scripts';

export const SCRIPT_ASSETS = {
  'pcf-initialise-project': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/Initialize-NewPCFProject.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF workflow',
    name: 'Initialize-NewPCFProject.ps1',
    sha256: '3EC9E57A178F41F8369EADDBE9C9BFCDD8BC7E4AA9CC527C20D6B14F83E07926',
    lineCount: 144
  },
  'pcf-environment-report': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/Get-PCFDevEnvironmentReport.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF workflow',
    name: 'Get-PCFDevEnvironmentReport.ps1',
    sha256: '3281B6E220C3D840414504305CBABB4BDD7B1C705957527E606DA9B51E2645FD',
    lineCount: 179
  },
  'pcf-test-harness': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/Start-PCFTestHarness.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF workflow',
    name: 'Start-PCFTestHarness.ps1',
    sha256: '4B379F83906A5D024828F809023BDA0788A9FB1C161699275F1B50B7C2DCC499',
    lineCount: 55
  },
  'pcf-update-version': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/Update-Version.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF workflow',
    name: 'Update-Version.ps1',
    sha256: '32F1EA9FABFF4FF2854AAE2E6603E427DF8BBA2C242B488A304A4525083A1035',
    lineCount: 98
  },
  'pcf-build-deploy': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/Build-And-Deploy-PCF.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF workflow',
    name: 'Build-And-Deploy-PCF.ps1',
    sha256: 'C27CFE32D40588989FBFBC20593A150620932AB571F1174884F2EEAC95476218',
    lineCount: 313
  },
  'pcf-quick-deploy': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/Push-PCFQuickDeploy.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF workflow',
    name: 'Push-PCFQuickDeploy.ps1',
    sha256: '891244F9BD5211A7CF3427E9D07E3B5DAF4CCA8D091B5F002BBAFE115352CBB1',
    lineCount: 95
  },
  'pcf-deploy-solution': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/Deploy-Solution.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF workflow',
    name: 'Deploy-Solution.ps1',
    sha256: '24E9371AC2E8FF4CDF95A437C88FD3C82F2B043ECDA2D46240E9A25222CAD874',
    lineCount: 121
  },
  'pcf-solution-check': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/Invoke-SolutionCheck.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF workflow',
    name: 'Invoke-SolutionCheck.ps1',
    sha256: '4D9DF154220D84CD534D3FC766273DC80FD7289583601885AC5EBBFE7928A166',
    lineCount: 125
  },
  'pcf-identity-clone': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/New-PCFIdentityClone.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF capability',
    name: 'New-PCFIdentityClone.ps1',
    sha256: '31EE7B632CB5691A5A18A39D962E45CC7C5C88082ED7BA9C31FB9C847EDC350B',
    lineCount: 1332
  },
  'pcf-set-release-defaults': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/Set-PCFReleaseDefaults.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF capability',
    name: 'Set-PCFReleaseDefaults.ps1',
    sha256: 'F0C50326EE3C49D898D08AD2729218536640229965BEE83C603E0A678EA293E6',
    lineCount: 125
  },
  'pcf-tooling-validation': {
    path: '../../assets/power-platform-script-hub/powershell/pcf/Test-PCFToolingPackage.ps1',
    package: PCF_SCRIPTS_PACKAGE,
    authority: 'existing PCF capability',
    name: 'Test-PCFToolingPackage.ps1',
    sha256: '316810C6F7FC25CFEF145330F0BCBEE1C0FBE549CA1F1C2ABB874180951C1C5A',
    lineCount: 46
  },
  'pp-environment-snapshot': {
    path: '../../assets/power-platform-script-hub/powershell/library/Get-PowerPlatformEnvironmentSnapshot.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Get-PowerPlatformEnvironmentSnapshot.ps1',
    sha256: 'A3825C393C154ECD770B651F22F04D5A2445EF6C1BD4E6F7EAF7C1DE9CF3EA7A',
    lineCount: 984
  },
  'pp-environment-compare': {
    path: '../../assets/power-platform-script-hub/powershell/library/Compare-PowerPlatformEnvironmentSnapshots.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Compare-PowerPlatformEnvironmentSnapshots.ps1',
    sha256: '65CB3DC928CF167A36D050409D888B4FD1A9CA8ED1B9275A97D34A7CA6EE0529',
    lineCount: 493
  },
  'pp-solution-readiness': {
    path: '../../assets/power-platform-script-hub/powershell/library/Test-SolutionTargetReadiness.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Test-SolutionTargetReadiness.ps1',
    sha256: '6595C3EF18E7ADF9826A412CC00154301AB1276D5EA5E2C5BA538068BEDE6B15',
    lineCount: 1070
  },
  'pp-solution-history': {
    path: '../../assets/power-platform-script-hub/powershell/library/Get-SolutionDeploymentHistory.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Get-SolutionDeploymentHistory.ps1',
    sha256: '6D5C04B263EF89009A9D3ECD533F3A316E7DD3D2FD8E0977B7ECA3762073D8C4',
    lineCount: 657
  },
  'pp-plugin-inventory': {
    path: '../../assets/power-platform-script-hub/powershell/library/Get-PluginRegistrationInventory.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Get-PluginRegistrationInventory.ps1',
    sha256: 'E4E53ED1E853124D51DAA58466E1C9A5085B410AC4F61AC71B8E631DB91D946F',
    lineCount: 746
  },
  'pp-plugin-compare': {
    path: '../../assets/power-platform-script-hub/powershell/library/Compare-PluginRegistration.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Compare-PluginRegistration.ps1',
    sha256: 'A9FEEF381067FAF85EBD4607E5CEF07F4D0FA24B43C97B5261976EFED24FFCF2',
    lineCount: 409
  },
  'pp-environment-references': {
    path: '../../assets/power-platform-script-hub/powershell/library/Test-EnvironmentReferences.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Test-EnvironmentReferences.ps1',
    sha256: 'CC0B56EB26F200016763B2E8DD6F2D02BF6429BF92C4B193A1B00F6E1F3108D1',
    lineCount: 597
  },
  'pp-flow-state': {
    path: '../../assets/power-platform-script-hub/powershell/library/Get-FlowDeploymentState.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Get-FlowDeploymentState.ps1',
    sha256: 'A624A9F45DFDC149D681415B8960475D3D15E4F821EFD63EE6F43A712791DDBC',
    lineCount: 624
  },
  'pp-pcf-project-health': {
    path: '../../assets/power-platform-script-hub/powershell/library/Test-PCFProjectHealth.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Test-PCFProjectHealth.ps1',
    sha256: '9D54DFD734BC1DA52F5F539CA88001DDD49B8CE28B5EEC1B85F17DB6BBEF70CF',
    lineCount: 414
  },
  'pp-pcf-release-package': {
    path: '../../assets/power-platform-script-hub/powershell/library/Test-PCFReleasePackage.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Test-PCFReleasePackage.ps1',
    sha256: 'C369B95F9DE101BC7AF6B045E5AE890AA3E78BB596A4793E7012C8B224E867AA',
    lineCount: 486
  },
  'pp-pages-inventory': {
    path: '../../assets/power-platform-script-hub/powershell/library/Get-PowerPagesSiteInventory.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Get-PowerPagesSiteInventory.ps1',
    sha256: '46160A2275418D7E9EEBBEC1B0454DAC897C8384E665F82981A9BF10284A8731',
    lineCount: 310
  },
  'pp-pages-sync': {
    path: '../../assets/power-platform-script-hub/powershell/library/Sync-PowerPagesSite.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Sync-PowerPagesSite.ps1',
    sha256: '19C2CF70A847A52E82DD76EF8CD4F74347C8899DB7C91BA3F72F5B76836D130C',
    lineCount: 533
  },
  'pp-pages-backup': {
    path: '../../assets/power-platform-script-hub/powershell/library/Backup-PowerPagesSite.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Backup-PowerPagesSite.ps1',
    sha256: '8DFC16DBAA372149683C18C33D8475CBE38FFB5AE548AA12DC346B8F13FE7733',
    lineCount: 421
  },
  'pp-pages-compare': {
    path: '../../assets/power-platform-script-hub/powershell/library/Compare-PowerPagesSites.ps1',
    package: POWER_PLATFORM_LIBRARY,
    authority: 'PowerShell library',
    name: 'Compare-PowerPagesSites.ps1',
    sha256: 'A4005ECD9B9888A9951C6F0076ABA21C84162B909D46D80F0D3DCD5ACA2CA872',
    lineCount: 362
  },
  'forensics-app-module': {
    path: '../../assets/power-platform-script-hub/forensics/App-Module-Forensics.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'App-Module-Forensics.txt',
    sha256: '6C1629D6E3A06A2D9EF8AF962677B80D546BD05F31B8C74FA431A742268F01A5',
    lineCount: 267
  },
  'forensics-async-operations': {
    path: '../../assets/power-platform-script-hub/forensics/Async-Operations-Health.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Async-Operations-Health.txt',
    sha256: '84257E14AA123E99BBD41F7112ADBEB7D48513983F426718B53F550C11A3BACA',
    lineCount: 264
  },
  'forensics-bpf': {
    path: '../../assets/power-platform-script-hub/forensics/BPF-Forensics.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'BPF-Forensics.txt',
    sha256: '12C128A4DB707CEA33841CC85C5201A2B040578541581D75AD8C5EA20BC5C363',
    lineCount: 266
  },
  'forensics-environment-compare': {
    path: '../../assets/power-platform-script-hub/forensics/Compare-Environment-Fingerprints.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Compare-Environment-Fingerprints.txt',
    sha256: '9AB603153C2E2CBB490114AE1AED0C6339FCB7BABD0C6FF57688787DF2CE7EC9',
    lineCount: 39
  },
  'forensics-component': {
    path: '../../assets/power-platform-script-hub/forensics/Component-Forensics-Generic.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Component-Forensics-Generic.txt',
    sha256: '37D1348A5938D173AFB7F60E60C9EC0FAA6DC7C8E08CB90AEA5F38B20863C90D',
    lineCount: 268
  },
  'forensics-environment-fingerprint': {
    path: '../../assets/power-platform-script-hub/forensics/Environment-Fingerprint.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Environment-Fingerprint.txt',
    sha256: '5668D49B48A4C4C26639C7BAEA7898F23DC315287CBC45396A438C0E0CF18D23',
    lineCount: 279
  },
  'forensics-environment-references': {
    path: '../../assets/power-platform-script-hub/forensics/Environment-Reference-Audit.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Environment-Reference-Audit.txt',
    sha256: '22C95679828F405EC3054016FA941278E79F9D2C5405934EA13E20630AF0013E',
    lineCount: 264
  },
  'forensics-flow': {
    path: '../../assets/power-platform-script-hub/forensics/Flow-Forensics.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Flow-Forensics.txt',
    sha256: '413DBD17F880B94518424CC183DC1C352D34BBAF215FEA8D72715CD9F86DA091',
    lineCount: 281
  },
  'forensics-form': {
    path: '../../assets/power-platform-script-hub/forensics/Form-Forensics.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Form-Forensics.txt',
    sha256: 'D7DDF42EADBE8AB97F73DCAD4C604869688F864AF3EEC738197E495C409D7E04',
    lineCount: 281
  },
  'forensics-pcf': {
    path: '../../assets/power-platform-script-hub/forensics/PCF-Forensics-Generic.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'PCF-Forensics-Generic.txt',
    sha256: '976BB9AAB6147A58D2BF3D8115EC0A3E512F9904CD2D34C20B5E0190493577F9',
    lineCount: 2883
  },
  'forensics-plugin-steps': {
    path: '../../assets/power-platform-script-hub/forensics/Plugin-Step-Forensics.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Plugin-Step-Forensics.txt',
    sha256: 'A726AE8E978C468901539ACE6BC0F1F4FD73881504844908F4EE0A026FAEAB69',
    lineCount: 295
  },
  'forensics-security-role-audit': {
    path: '../../assets/power-platform-script-hub/forensics/Security-Role-Audit.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Security-Role-Audit.txt',
    sha256: '1C04D6E135A4DC25CA4C3611FA4F44F4C12AD58F74D87A527139FD2AE4607992',
    lineCount: 264
  },
  'forensics-security-role-diff': {
    path: '../../assets/power-platform-script-hub/forensics/Security-Role-Diff.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Security-Role-Diff.txt',
    sha256: 'BB74BD15900FC1FE8BF7515CBBB8457370F2E369492F947F60C184DC4472B352',
    lineCount: 26
  },
  'forensics-solution': {
    path: '../../assets/power-platform-script-hub/forensics/Solution-Forensics-Generic.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'Solution-Forensics-Generic.txt',
    sha256: 'AD5D9E376B2976B0749060F26F502AC0C1E8E2E5B4E2B228B3509B712F2697FD',
    lineCount: 287
  },
  'forensics-web-resource': {
    path: '../../assets/power-platform-script-hub/forensics/WebResource-Integrity-Audit.txt',
    package: DATAVERSE_FORENSICS_TOOLKIT,
    authority: 'JavaScript forensic toolkit',
    name: 'WebResource-Integrity-Audit.txt',
    sha256: 'F6DFD9CBF12804936C8329A077425CF594D6F046E514E7708D9192C01B814D13',
    lineCount: 269
  }
};

export async function loadScriptTemplate(scriptId) {
  const asset = SCRIPT_ASSETS[scriptId];

  if (!asset) {
    throw new Error('The selected script source is not available.');
  }

  const response = await fetch(new URL(asset.path, import.meta.url));

  if (!response.ok) {
    throw new Error(`Unable to load ${asset.name} from the local script catalogue.`);
  }

  return response.text();
}
