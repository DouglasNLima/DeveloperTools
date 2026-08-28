import { SCRIPT_ASSETS } from './script-hub-assets.js';

export const SCRIPT_RUNTIME = Object.freeze({
  POWERSHELL_HELPER: 'powershell-helper',
  BROWSER_DEVTOOLS: 'browser-devtools',
  LOCAL_BROWSER: 'local-browser'
});

export const SCRIPT_RUNTIME_LABELS = Object.freeze({
  [SCRIPT_RUNTIME.POWERSHELL_HELPER]: 'PowerShell helper',
  [SCRIPT_RUNTIME.BROWSER_DEVTOOLS]: 'Browser DevTools',
  [SCRIPT_RUNTIME.LOCAL_BROWSER]: 'Local browser'
});

export const SCRIPT_MATURITY = Object.freeze({
  FIELD_TESTED: 'Field-tested',
  EXPERIMENTAL: 'Experimental'
});

export const SCRIPT_SAFETY_LABELS = Object.freeze({
  'local-only': 'Local-only',
  'local-filesystem-mutation': 'Local filesystem mutation',
  'remote-read-only': 'Remote read-only',
  'remote-read-only-local-inspection': 'Remote read-only + local inspection',
  'local-auth-context-mutation': 'Local authentication-context mutation',
  'remote-platform-mutation': 'Remote Power Platform mutation',
  'remote-check-service': 'Remote checker service operation',
  'local-backup-creation': 'Create-only local backup',
  'remote-read-only-local-auth-context-mutation': 'Remote read-only + local authentication-context mutation',
  'remote-read-only-local-filesystem-mutation': 'Remote read-only + local filesystem mutation',
  'remote-read-only-local-filesystem-and-auth-mutation': 'Remote read-only + local filesystem and authentication-context mutation'
});

const SOLUTION_CHECKER_GEOS = [
  'PreviewUnitedStates',
  'UnitedStates',
  'Europe',
  'Asia',
  'Australia',
  'Japan',
  'India',
  'Canada',
  'SouthAmerica',
  'UnitedKingdom',
  'France',
  'SouthAfrica',
  'Germany',
  'UnitedArabEmirates',
  'Switzerland',
  'Norway',
  'Singapore',
  'Korea',
  'Sweden',
  'Italy',
  'Poland',
  'NewZealand',
  'USGovernment',
  'USGovernmentL4',
  'USGovernmentL5DoD',
  'China'
];

const MODEL_VERSIONS = ['Standard', 'Enhanced'];
const API_VERSION_DEFAULT = 'v9.2';

function launcherInput() {
  return {
    id: 'scriptsPath',
    label: 'PS Scripts folder',
    type: 'text',
    required: true,
    launcherOnly: true,
    singleLine: true,
    placeholder: String.raw`C:\Projects\PowerPlatform\PS Scripts`,
    help: 'Folder containing the selected helper script and any companion files it requires.'
  };
}

function textInput(id, label, options = {}) {
  return {
    id,
    label,
    type: 'text',
    singleLine: options.singleLine ?? true,
    ...options
  };
}

function urlInput(id, label, options = {}) {
  return textInput(id, label, { type: 'url', validation: 'https-url', ...options });
}

function pathInput(id, label, options = {}) {
  return textInput(id, label, { kind: 'path', ...options });
}

function selectInput(id, label, options, config = {}) {
  return {
    id,
    label,
    type: 'select',
    options,
    ...config
  };
}

function checkboxInput(id, label, config = {}) {
  return {
    id,
    label,
    type: 'checkbox',
    kind: config.kind || 'switch',
    defaultValue: false,
    ...config
  };
}

function numberInput(id, label, config = {}) {
  return {
    id,
    label,
    type: 'number',
    kind: 'number',
    step: 1,
    ...config
  };
}

function psParameter(name, id, label, type = 'text', config = {}) {
  const input = type === 'url'
    ? urlInput(id, label, config)
    : type === 'path'
      ? pathInput(id, label, config)
      : type === 'select'
        ? selectInput(id, label, config.options || [], config)
        : type === 'checkbox'
          ? checkboxInput(id, label, config)
          : type === 'number'
            ? numberInput(id, label, config)
            : textInput(id, label, config);

  return {
    ...input,
    name,
    parameter: name,
    kind: config.kind || input.kind || (type === 'checkbox' ? 'switch' : type === 'number' ? 'number' : 'value')
  };
}

function secureRuntimeParameter(name = 'AccessToken') {
  return {
    id: name,
    name,
    label: 'Dataverse access token',
    type: 'runtime-prompt',
    parameter: name,
    kind: 'secure-runtime',
    required: true,
    runtimePrompt: "Read-Host 'Dataverse access token' -AsSecureString",
    help: 'The generated launcher asks for this as a SecureString when it runs; the value is never stored in Developer Tools or the generated file.'
  };
}

function jsonArrayParameter(name, id, label, config = {}) {
  return {
    ...textInput(id, label, { type: 'textarea', singleLine: false, ...config }),
    name,
    parameter: name,
    kind: 'json-array'
  };
}

function configParameter(name, label, type = 'text', config = {}) {
  const input = type === 'number'
    ? numberInput(name, label, config)
    : type === 'checkbox'
      ? checkboxInput(name, label, { kind: 'boolean', ...config })
      : type === 'select'
        ? selectInput(name, label, config.options || [], config)
        : textInput(name, label, config);

  return {
    ...input,
    name,
    configKey: name,
    kind: config.kind || input.kind || (type === 'number' ? 'number' : type === 'checkbox' ? 'boolean' : 'value')
  };
}

function sourceFor(id, documentation = '') {
  const source = SCRIPT_ASSETS[id];

  if (!source) {
    throw new Error(`No static source asset is registered for ${id}.`);
  }

  return {
    ...source,
    documentation
  };
}

function powershellScript(config) {
  const parameters = config.parameters || [];

  return {
    id: config.id,
    title: config.title,
    family: config.family,
    category: config.category,
    description: config.description,
    applicability: config.applicability,
    runtime: SCRIPT_RUNTIME.POWERSHELL_HELPER,
    version: config.version || '1.0.0',
    maturity: config.maturity || SCRIPT_MATURITY.EXPERIMENTAL,
    safety: config.safety,
    prerequisites: config.prerequisites || ['PowerShell and the supplied script package.'],
    inputs: [launcherInput(), ...(config.generatorInputs || []), ...parameters],
    parameters,
    outputs: config.outputs,
    limitations: config.limitations,
    warnings: config.warnings || [],
    checklist: config.checklist || [],
    source: sourceFor(config.id, config.documentation),
    scriptName: SCRIPT_ASSETS[config.id].name,
    downloadBaseName: config.downloadBaseName || config.id,
    workingDirectoryField: config.workingDirectoryField,
    requiredAny: config.requiredAny || [],
    legacyAction: config.legacyAction,
    excludedParameters: config.excludedParameters || []
  };
}

function browserScript(config) {
  const parameters = config.parameters || [];

  return {
    id: config.id,
    title: config.title,
    family: config.family,
    category: config.category,
    description: config.description,
    applicability: config.applicability,
    runtime: config.runtime || SCRIPT_RUNTIME.BROWSER_DEVTOOLS,
    version: config.version || '1.0.0',
    maturity: config.maturity || SCRIPT_MATURITY.EXPERIMENTAL,
    safety: config.safety,
    prerequisites: config.prerequisites || ['An authenticated Dynamics 365 or Power Apps browser session.'],
    inputs: parameters,
    parameters,
    outputs: config.outputs,
    limitations: config.limitations,
    warnings: config.warnings || [],
    checklist: config.checklist || [],
    source: sourceFor(config.id, config.documentation),
    scriptName: SCRIPT_ASSETS[config.id].name,
    downloadBaseName: config.downloadBaseName || SCRIPT_ASSETS[config.id].name.replace(/\.txt$/i, ''),
    requiredAny: config.requiredAny || []
  };
}

const textOutput = 'Structured JSON report and the toolkit on-page export panel.';
const collectorLimitations = [
  'The script records best-effort evidence; unavailable tables or columns remain visible as errors or UNKNOWN states.',
  'Findings are diagnostic heuristics, not Microsoft Support determinations.'
];
const localComparisonLimitations = [
  'Only the evidence present in the two selected JSON files can be compared.',
  'The script makes no network requests.'
];

export const SCRIPT_CATALOGUE = [
  powershellScript({
    id: 'pcf-initialise-project',
    title: 'Initialise a new PCF project',
    family: 'development',
    category: 'Create',
    legacyAction: 'initialise-project',
    description: 'Create a PCF control and Dataverse solution project with release-safe defaults.',
    applicability: 'Use when starting a new PCF control and its companion solution from an empty project path.',
    safety: ['local-filesystem-mutation'],
    prerequisites: ['PowerShell, pac, Node.js, npm and the .NET SDK.', 'An empty or new target project path.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'A new local PCF project when you run the launcher.'],
    limitations: ['The helper stops when the target control folder already contains files.'],
    documentation: 'PS Scripts/README.md',
    downloadBaseName: 'initialise-project',
    parameters: [
      psParameter('ControlName', 'controlName', 'Control name', 'text', { required: true, validation: 'pcf-init-control-name', placeholder: 'InspectionControl' }),
      psParameter('PublisherName', 'publisherName', 'Publisher name', 'text', { required: true, validation: 'publisher-name', placeholder: 'Contoso' }),
      psParameter('PublisherPrefix', 'publisherPrefix', 'Publisher prefix', 'text', { required: true, validation: 'publisher-prefix', placeholder: 'cts' }),
      psParameter('ProjectPath', 'projectPath', 'New project root', 'path', { required: true, placeholder: String.raw`C:\Projects\PCF\InspectionControl` }),
      psParameter('SolutionUniqueName', 'solutionUniqueName', 'Solution unique name', 'text', { required: true, validation: 'solution-name', placeholder: 'Inspection_Control' }),
      psParameter('ControlTemplate', 'controlTemplate', 'Control template', 'select', { options: [{ value: 'field', label: 'Field' }, { value: 'dataset', label: 'Dataset' }], defaultValue: 'field' }),
      psParameter('ControlFramework', 'controlFramework', 'Control framework', 'select', { options: [{ value: 'react', label: 'React' }, { value: 'none', label: 'None' }], defaultValue: 'react' }),
      psParameter('SolutionDescription', 'solutionDescription', 'Solution description', 'text', { placeholder: 'Custom inspection control.', singleLine: true })
    ]
  }),
  powershellScript({
    id: 'pcf-environment-report',
    title: 'Inspect the PCF development environment',
    family: 'development',
    category: 'Develop',
    legacyAction: 'environment-report',
    description: 'Report local PCF tooling versions and optionally run the supplied network diagnostics.',
    applicability: 'Use when a workstation cannot build, restore or run a PCF control and you need a shareable baseline.',
    safety: ['local-only'],
    prerequisites: ['PowerShell and the PCF helper package.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'A local environment report when you run the launcher.'],
    limitations: ['CheckNetwork runs npm and Node HTTPS diagnostics against the configured registry; the browser itself makes no such request.'],
    documentation: 'PS Scripts/README.md',
    downloadBaseName: 'environment-report',
    parameters: [
      psParameter('BaselineFile', 'baselineFile', 'Baseline JSON file', 'path', { placeholder: String.raw`C:\Projects\PCF\pcf-env.example.json` }),
      psParameter('CheckNetwork', 'checkNetwork', 'Run npm and Node network diagnostics', 'checkbox'),
      psParameter('NpmRegistry', 'npmRegistry', 'npm registry', 'url', { defaultValue: 'https://registry.npmjs.org/', placeholder: 'https://registry.npmjs.org/' })
    ]
  }),
  powershellScript({
    id: 'pcf-test-harness',
    title: 'Start the PCF test harness',
    family: 'development',
    category: 'Develop',
    legacyAction: 'test-harness',
    description: 'Start the local PCF development and watch workflow.',
    applicability: 'Use while iterating on a control locally before packaging or deployment.',
    safety: ['local-only'],
    prerequisites: ['PowerShell, Node.js and a PCF control project.', 'The control folder should contain ControlManifest.Input.xml.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'A long-running local test harness when you run the launcher.'],
    limitations: ['The test harness keeps running until it is stopped with Ctrl+C.'],
    documentation: 'PS Scripts/README.md',
    downloadBaseName: 'test-harness',
    workingDirectoryField: 'controlFolder',
    parameters: [
      psParameter('ControlFolder', 'controlFolder', 'Control source folder', 'path', { placeholder: String.raw`C:\Projects\PCF\InspectionControl\InspectionControl`, help: 'Optional in the source script; supplying it makes the launch location explicit.' })
    ]
  }),
  powershellScript({
    id: 'pcf-update-version',
    title: 'Synchronise PCF and solution versions',
    family: 'development',
    category: 'Version & build',
    legacyAction: 'update-version',
    description: 'Synchronise solution, control and optional manifest version values.',
    applicability: 'Use before a release build when the project version needs a controlled Build or Revision increment.',
    safety: ['local-filesystem-mutation'],
    prerequisites: ['PowerShell and a valid PCF project with its solution project.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'Updated local versioned project files when you run the launcher.'],
    limitations: ['Version changes remain in the working tree; review the Git diff afterwards.'],
    documentation: 'PS Scripts/README.md',
    downloadBaseName: 'update-version',
    parameters: [
      psParameter('ProjectRoot', 'projectRoot', 'PCF project root', 'path', { required: true, placeholder: String.raw`C:\Projects\PCF\InspectionControl` }),
      psParameter('IncrementPart', 'incrementPart', 'Version part to increment', 'select', { options: [{ value: 'Build', label: 'Build' }, { value: 'Revision', label: 'Revision' }], defaultValue: 'Build' }),
      psParameter('ResetRevisionOnBuild', 'resetRevisionOnBuild', 'Reset revision when incrementing Build', 'checkbox', { kind: 'boolean', defaultValue: true })
    ]
  }),
  powershellScript({
    id: 'pcf-build-deploy',
    title: 'Build, package and optionally deploy a PCF release',
    family: 'development',
    category: 'Version & build',
    legacyAction: 'build-and-deploy',
    description: 'Run the release-safe PCF build, package validation, optional Solution Checker and optional deployment workflow.',
    applicability: 'Use for a promotable Release build, with explicit controls for deployment, checker diagnostics and package handling.',
    safety: ['local-filesystem-mutation', 'remote-platform-mutation', 'remote-check-service'],
    prerequisites: ['PowerShell, pac, Node.js, npm, the .NET SDK and a valid PCF project.', 'An existing PAC authentication context when deployment or checking is enabled.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'Release artefacts and optional remote deployment/checker results when you run the launcher.'],
    limitations: ['Deployment and Solution Checker are optional but change the safety profile from local packaging to remote operations.', 'The source workflow rejects unlocked dependencies and development bundles unless an explicit diagnostic override is selected.'],
    documentation: 'PS Scripts/README.md',
    downloadBaseName: 'build-and-deploy',
    parameters: [
      psParameter('ProjectRoot', 'projectRoot', 'PCF project root', 'path', { required: true, placeholder: String.raw`C:\Projects\PCF\InspectionControl` }),
      psParameter('IncrementVersion', 'incrementVersion', 'Increment the version before building', 'checkbox'),
      psParameter('Deploy', 'deploy', 'Deploy after a successful build', 'checkbox'),
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { requiredWhen: values => Boolean(values.deploy), dependsOn: 'deploy', disabledWhen: values => !values.deploy, placeholder: 'https://org.crm4.dynamics.com' }),
      psParameter('DeployManaged', 'deployManaged', 'Deploy the managed solution', 'checkbox', { dependsOn: 'deploy', disabledWhen: values => !values.deploy, includeWhen: values => Boolean(values.deploy) }),
      psParameter('RunSolutionChecker', 'runSolutionChecker', 'Run Solution Checker', 'checkbox'),
      psParameter('SolutionCheckerGeo', 'solutionCheckerGeo', 'Solution Checker geography', 'select', { options: SOLUTION_CHECKER_GEOS.map(value => ({ value, label: value })), defaultValue: 'Europe' }),
      psParameter('SkipLint', 'skipLint', 'Skip linting', 'checkbox'),
      psParameter('AllowUnlockedDependencies', 'allowUnlockedDependencies', 'Allow unlocked npm dependencies', 'checkbox'),
      psParameter('KeepVersionOnFailure', 'keepVersionOnFailure', 'Keep the incremented version after failure', 'checkbox'),
      psParameter('ArtifactsDirectory', 'artifactsDirectory', 'Artefacts directory', 'path', { placeholder: String.raw`C:\Projects\PCF\InspectionControl\artefacts` }),
      psParameter('ForceOverwriteUnmanagedCustomisations', 'forceOverwriteUnmanagedCustomisations', 'Force overwrite unmanaged customisations', 'checkbox', { includeWhen: values => Boolean(values.deploy) }),
      psParameter('StageAndUpgrade', 'stageAndUpgrade', 'Stage and upgrade the solution', 'checkbox', { includeWhen: values => Boolean(values.deploy) })
    ]
  }),
  powershellScript({
    id: 'pcf-quick-deploy',
    title: 'Push a PCF control for rapid testing',
    family: 'development',
    category: 'Deploy',
    legacyAction: 'quick-deploy',
    description: 'Push a local PCF project through the existing PAC authentication context for rapid testing.',
    applicability: 'Use for a fast unmanaged control push during development when a full solution package is unnecessary.',
    safety: ['remote-platform-mutation'],
    prerequisites: ['PowerShell, pac and an active PAC authentication context.', 'A valid PCF project root.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'A remote PCF push when you run the launcher.'],
    limitations: ['The service-principal parameter set is intentionally not exposed because Developer Tools never requests or emits client secrets, application IDs or tenant IDs.', 'The launcher relies on the existing PAC authentication context.'],
    documentation: 'PS Scripts/README.md',
    downloadBaseName: 'quick-deploy',
    workingDirectoryField: 'projectRoot',
    excludedParameters: [
      { name: 'ApplicationId', reason: 'Credential-related service-principal parameter; omitted to prevent secret-bearing generated artefacts.' },
      { name: 'ClientSecret', reason: 'Secret parameter; never requested or emitted by Developer Tools.' },
      { name: 'TenantId', reason: 'Credential-related service-principal parameter; omitted with the secret-bearing parameter set.' }
    ],
    parameters: [
      psParameter('ProjectRoot', 'projectRoot', 'PCF project root', 'path', { required: true, placeholder: String.raw`C:\Projects\PCF\InspectionControl` }),
      psParameter('PublisherPrefix', 'publisherPrefix', 'Publisher prefix', 'text', { required: true, validation: 'publisher-prefix', placeholder: 'cts' }),
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { required: true, placeholder: 'https://org.crm4.dynamics.com' }),
      psParameter('SolutionUniqueName', 'solutionUniqueName', 'Solution unique name', 'text', { validation: 'solution-name', placeholder: 'Inspection_Control' }),
      psParameter('Incremental', 'incremental', 'Use incremental push', 'checkbox')
    ]
  }),
  powershellScript({
    id: 'pcf-deploy-solution',
    title: 'Import a PCF solution',
    family: 'development',
    category: 'Deploy',
    legacyAction: 'deploy-solution',
    description: 'Prepare an explicit PAC solution import with asynchronous, overwrite, upgrade and activation options.',
    applicability: 'Use when a built solution ZIP must be imported into a target Dataverse environment.',
    safety: ['remote-platform-mutation'],
    prerequisites: ['PowerShell, pac and an active PAC authentication context.', 'A built solution ZIP.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'A remote solution import when you run the launcher.'],
    limitations: ['This workflow can publish, activate plug-ins, overwrite unmanaged customisations or stage an upgrade in the target environment. Review every selected option.'],
    documentation: 'PS Scripts/README.md',
    downloadBaseName: 'deploy-solution',
    parameters: [
      psParameter('SolutionZipPath', 'solutionZipPath', 'Solution ZIP path', 'path', { required: true, placeholder: String.raw`C:\Build\InspectionControl.zip` }),
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { required: true, placeholder: 'https://org.crm4.dynamics.com' }),
      psParameter('PublishChanges', 'publishChanges', 'Publish changes after import', 'checkbox', { kind: 'boolean', defaultValue: true }),
      psParameter('Async', 'asyncImport', 'Use asynchronous import', 'checkbox', { kind: 'boolean', defaultValue: true }),
      psParameter('MaxAsyncWaitMinutes', 'maxAsyncWaitMinutes', 'Maximum asynchronous wait in minutes', 'number', { defaultValue: 60, min: 1, max: 720 }),
      psParameter('ForceOverwriteUnmanagedCustomisations', 'forceOverwriteUnmanagedCustomisations', 'Force overwrite unmanaged customisations', 'checkbox'),
      psParameter('StageAndUpgrade', 'stageAndUpgrade', 'Stage and upgrade', 'checkbox'),
      psParameter('SkipLowerVersion', 'skipLowerVersion', 'Skip lower solution versions', 'checkbox'),
      psParameter('ActivatePlugins', 'activatePlugins', 'Activate plug-ins', 'checkbox'),
      psParameter('SettingsFile', 'settingsFile', 'Solution settings file', 'path', { placeholder: String.raw`C:\Build\deployment-settings.json` }),
      psParameter('Force', 'force', 'Skip the deployment confirmation', 'checkbox')
    ]
  }),
  powershellScript({
    id: 'pcf-solution-check',
    title: 'Run Solution Checker',
    family: 'development',
    category: 'Quality',
    legacyAction: 'solution-check',
    description: 'Submit a solution to the Power Apps Checker wrapper and apply its SARIF gate settings.',
    applicability: 'Use as a configurable quality gate before release promotion.',
    safety: ['remote-check-service'],
    prerequisites: ['PowerShell, pac and a solution ZIP.', 'A PAC context or checker access appropriate to the supplied script.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'Checker JSON/SARIF output when you run the launcher.'],
    limitations: ['The source script accepts SARIF level and rule-file options; it does not accept the former UI-only FailOnLevel or numeric threshold fields.'],
    documentation: 'PS Scripts/README.md',
    downloadBaseName: 'solution-check',
    parameters: [
      psParameter('SolutionZipPath', 'solutionZipPath', 'Solution ZIP path', 'path', { required: true, placeholder: String.raw`C:\Build\InspectionControl.zip` }),
      psParameter('OutputDirectory', 'outputDirectory', 'Checker output folder', 'path', { required: true, placeholder: String.raw`C:\Build\solution-check` }),
      psParameter('Geo', 'geo', 'Checker geography', 'select', { options: SOLUTION_CHECKER_GEOS.map(value => ({ value, label: value })), defaultValue: 'Europe' }),
      psParameter('RuleSet', 'ruleSet', 'Checker rule set', 'text', { defaultValue: 'Solution Checker', placeholder: 'Solution Checker' }),
      psParameter('FailOnSarifLevel', 'failOnSarifLevel', 'Fail on SARIF level', 'select', { options: [{ value: 'error', label: 'Error' }, { value: 'warning', label: 'Warning' }, { value: 'note', label: 'Note' }, { value: 'none', label: 'None' }], defaultValue: 'error' }),
      psParameter('RuleLevelOverrideFile', 'ruleLevelOverrideFile', 'Rule-level override file', 'path', { placeholder: String.raw`C:\Build\rule-level-overrides.json` }),
      psParameter('ExcludedFiles', 'excludedFiles', 'Excluded files', 'text', { placeholder: 'path/to/file.js;path/to/file.css' })
    ]
  }),
  powershellScript({
    id: 'pcf-identity-clone',
    title: 'Clone a new PCF identity',
    family: 'development',
    category: 'Create',
    description: 'Clone a PCF project into a new control identity while resetting identity, version and runtime state.',
    applicability: 'Use when a new generation of an existing control needs isolated source, solution and WebResource identity.',
    safety: ['local-filesystem-mutation', 'remote-platform-mutation'],
    prerequisites: ['PowerShell and the supplied PCF tooling package.', 'A source PCF project root; the target path must not already exist.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'A new local identity and optional build/deployment results when you run the launcher.'],
    limitations: ['The source project is never modified. Build, deployment and checker switches expand the operation beyond local cloning.'],
    documentation: 'PS Scripts/README.md',
    generatorInputs: [
      selectInput('cloneMode', 'Clone mode', [{ value: 'next-generation', label: 'Next generation' }, { value: 'explicit', label: 'Explicit target identity' }], { defaultValue: 'next-generation', generatorOnly: true })
    ],
    parameters: [
      psParameter('SourceProjectRoot', 'sourceProjectRoot', 'Source project root', 'path', { required: true, placeholder: String.raw`C:\Projects\PCF\InspectionControlPCFV2` }),
      psParameter('TargetControlName', 'targetControlName', 'Target control name', 'text', { requiredWhen: values => values.cloneMode === 'explicit', validation: 'pcf-init-control-name', placeholder: 'InspectionControlPCFV3', includeWhen: values => values.cloneMode === 'explicit' }),
      psParameter('NextGeneration', 'nextGeneration', 'Derive the next generation identity', 'checkbox', { includeWhen: values => values.cloneMode === 'next-generation' }),
      psParameter('TargetProjectRoot', 'targetProjectRoot', 'Target project root', 'path', { placeholder: String.raw`C:\Projects\PCF\InspectionControlPCFV3` }),
      psParameter('TargetSolutionUniqueName', 'targetSolutionUniqueName', 'Target solution unique name', 'text', { validation: 'solution-name' }),
      psParameter('TargetNamespace', 'targetNamespace', 'Target namespace', 'text', { validation: 'namespace' }),
      psParameter('InitialControlVersion', 'initialControlVersion', 'Initial control version', 'text', { defaultValue: '1.0.0', validation: 'semver3' }),
      psParameter('InitialSolutionVersion', 'initialSolutionVersion', 'Initial solution version', 'text', { defaultValue: '1.0.0.0', validation: 'semver4' }),
      psParameter('TargetDisplayName', 'targetDisplayName', 'Target display name', 'text'),
      psParameter('TargetControlDescription', 'targetControlDescription', 'Target control description', 'text'),
      psParameter('TargetSolutionDescription', 'targetSolutionDescription', 'Target solution description', 'text'),
      psParameter('Reason', 'reason', 'Clone reason', 'text', { defaultValue: 'Managed PCF WebResource identity reset' }),
      psParameter('Build', 'build', 'Build the cloned identity', 'checkbox'),
      psParameter('DeployToDev', 'deployToDev', 'Deploy the cloned identity to DEV', 'checkbox'),
      psParameter('EnvironmentUrl', 'environmentUrl', 'DEV environment URL', 'url', { requiredWhen: values => Boolean(values.deployToDev), dependsOn: 'deployToDev', disabledWhen: values => !values.deployToDev, placeholder: 'https://org.crm4.dynamics.com' }),
      psParameter('RunSolutionChecker', 'runSolutionChecker', 'Run Solution Checker', 'checkbox'),
      psParameter('SolutionCheckerGeo', 'identitySolutionCheckerGeo', 'Solution Checker geography', 'text', { defaultValue: 'Europe' }),
      psParameter('KeepTargetOnFailure', 'keepTargetOnFailure', 'Keep the target on failure', 'checkbox'),
      psParameter('SkipToolingValidation', 'skipToolingValidation', 'Skip tooling validation', 'checkbox')
    ]
  }),
  powershellScript({
    id: 'pcf-set-release-defaults',
    title: 'Apply PCF release defaults',
    family: 'development',
    category: 'Quality',
    description: 'Set production PCF build and Both solution package defaults on an existing project.',
    applicability: 'Use before a release build when a project has not yet adopted the package’s release-safe MSBuild defaults.',
    safety: ['local-filesystem-mutation'],
    prerequisites: ['PowerShell and an existing PCF project with its solution project.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'Updated local project files and optional package-lock.json when you run the launcher.'],
    limitations: ['This action changes project files; review the resulting diff and lock-file changes.'],
    documentation: 'PS Scripts/README.md',
    parameters: [
      psParameter('ProjectRoot', 'projectRoot', 'PCF project root', 'path', { required: true, placeholder: String.raw`C:\Projects\PCF\InspectionControl` }),
      psParameter('GenerateNpmLockFile', 'generateNpmLockFile', 'Generate an npm lock file if missing', 'checkbox')
    ]
  }),
  powershellScript({
    id: 'pcf-tooling-validation',
    title: 'Validate the PCF tooling package',
    family: 'development',
    category: 'Quality',
    description: 'Parse the supplied PCF helper package and report missing files or PowerShell syntax errors.',
    applicability: 'Use after copying or updating the PCF helper package before relying on a launcher.',
    safety: ['local-only'],
    prerequisites: ['PowerShell and the complete PCF helper package.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'A syntax and package-completeness result when you run the launcher.'],
    limitations: ['This validates the helper package itself; it does not validate a live tenant or execute the other scripts.'],
    documentation: 'PS Scripts/README.md',
    parameters: [
      psParameter('ScriptsDirectory', 'scriptsDirectory', 'Scripts directory', 'path', { placeholder: String.raw`C:\Projects\PCF\PS Scripts`, help: 'Optional in the source script; the launcher defaults to its own script directory when omitted.' })
    ]
  }),
  powershellScript({
    id: 'pp-environment-snapshot',
    title: 'Capture an environment snapshot',
    family: 'investigation',
    category: 'Environment and ALM',
    description: 'Capture a deterministic, secret-safe Dataverse environment snapshot for later comparison.',
    applicability: 'Use before and after a release, or in healthy and affected environments, to preserve comparable evidence.',
    safety: ['remote-read-only'],
    prerequisites: ['PowerShell and an authorised Dataverse access token supplied at run time as a SecureString.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'JSON snapshot and optional text summary when you run the script.'],
    limitations: ['Table and column exposure varies by tenant, security role and platform version; gaps remain explicit.', 'The access token is read only at launcher execution time and is never written to output.'],
    documentation: 'docs/Get-PowerPlatformEnvironmentSnapshot.md',
    parameters: [
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { required: true, placeholder: 'https://org.crm.dynamics.com' }),
      secureRuntimeParameter(),
      psParameter('ApiVersion', 'apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      psParameter('MaxRows', 'maxRows', 'Maximum rows per evidence surface', 'number', { defaultValue: 5000, min: 1, max: 100000 }),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON output path', 'path'),
      psParameter('SummaryOutputPath', 'summaryOutputPath', 'Text summary output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-environment-compare',
    title: 'Compare environment snapshots',
    family: 'investigation',
    category: 'Environment and ALM',
    description: 'Compare two saved environment snapshots without connecting to Power Platform.',
    applicability: 'Use for local environment drift review after collecting matching snapshots.',
    safety: ['local-only'],
    prerequisites: ['PowerShell and two saved snapshot JSON files.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'JSON diff and optional Markdown summary when you run the script.'],
    limitations: localComparisonLimitations,
    documentation: 'docs/Compare-PowerPlatformEnvironmentSnapshots.md',
    parameters: [
      psParameter('ReferenceSnapshotPath', 'referenceSnapshotPath', 'Reference snapshot path', 'path', { required: true }),
      psParameter('DifferenceSnapshotPath', 'differenceSnapshotPath', 'Snapshot to compare', 'path', { required: true }),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON diff output path', 'path'),
      psParameter('SummaryOutputPath', 'summaryOutputPath', 'Markdown summary output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-solution-readiness',
    title: 'Assess solution target readiness',
    family: 'investigation',
    category: 'Environment and ALM',
    description: 'Assess a solution ZIP against a live target using read-only evidence without importing it.',
    applicability: 'Use before deployment to identify evidence-backed blockers, warnings and unresolved references.',
    safety: ['remote-read-only-local-inspection'],
    prerequisites: ['PowerShell, a solution ZIP and an authorised Dataverse access token supplied at run time.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'JSON assessment, text summary and READY/READY_WITH_WARNINGS/BLOCKED result when you run the script.'],
    limitations: ['Server-side import validation is not executed; inconclusive checks remain UNKNOWN rather than being guessed.'],
    documentation: 'docs/Test-SolutionTargetReadiness.md',
    parameters: [
      psParameter('SolutionZipPath', 'solutionZipPath', 'Solution ZIP path', 'path', { required: true }),
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { required: true, placeholder: 'https://org.crm.dynamics.com' }),
      secureRuntimeParameter(),
      psParameter('ApiVersion', 'apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      psParameter('MaxRows', 'maxRows', 'Maximum rows per evidence surface', 'number', { defaultValue: 5000, min: 1, max: 100000 }),
      psParameter('RequireResolvedReferences', 'requireResolvedReferences', 'Require all references to resolve', 'checkbox'),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON output path', 'path'),
      psParameter('SummaryOutputPath', 'summaryOutputPath', 'Text summary output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-solution-history',
    title: 'Export solution deployment history',
    family: 'investigation',
    category: 'Environment and ALM',
    description: 'Export retained Dataverse solution deployment history with explicit lookback and retention boundaries.',
    applicability: 'Use when investigating an import incident or reconstructing retained deployment evidence.',
    safety: ['remote-read-only'],
    prerequisites: ['PowerShell and an authorised Dataverse access token supplied at run time.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'JSON history and optional text summary when you run the script.'],
    limitations: ['History is limited to rows retained and exposed by msdyn_solutionhistories; the oldest retained timestamp is not lifetime history.'],
    documentation: 'docs/Get-SolutionDeploymentHistory.md',
    parameters: [
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { required: true, placeholder: 'https://org.crm.dynamics.com' }),
      secureRuntimeParameter(),
      psParameter('SolutionUniqueName', 'solutionUniqueName', 'Solution unique name', 'text', { validation: 'solution-name' }),
      psParameter('LookbackDays', 'lookbackDays', 'Look back days', 'number', { defaultValue: 90, min: 1, max: 3650 }),
      psParameter('MaximumRecords', 'maximumRecords', 'Maximum records', 'number', { defaultValue: 500, min: 1, max: 5000 }),
      psParameter('ApiVersion', 'apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON output path', 'path'),
      psParameter('SummaryOutputPath', 'summaryOutputPath', 'Text summary output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-plugin-inventory',
    title: 'Inventory plug-in registrations',
    family: 'investigation',
    category: 'Plug-ins',
    description: 'Capture plug-in assemblies, types, SDK steps, filters and images without exporting configuration content.',
    applicability: 'Use when plug-in registration, execution order, filtering or deployment drift is suspected.',
    safety: ['remote-read-only'],
    prerequisites: ['PowerShell and an authorised Dataverse access token supplied at run time.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'Deterministic JSON inventory and optional text summary when you run the script.'],
    limitations: ['Secure and unsecure plug-in configuration values are represented by presence flags only.'],
    documentation: 'docs/Get-PluginRegistrationInventory.md',
    parameters: [
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { required: true, placeholder: 'https://org.crm.dynamics.com' }),
      secureRuntimeParameter(),
      psParameter('AssemblyName', 'assemblyName', 'Assembly name filter', 'text'),
      psParameter('MaxRows', 'maxRows', 'Maximum rows per evidence surface', 'number', { defaultValue: 5000, min: 1, max: 100000 }),
      psParameter('ApiVersion', 'apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON output path', 'path'),
      psParameter('SummaryOutputPath', 'summaryOutputPath', 'Text summary output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-plugin-compare',
    title: 'Compare plug-in registration inventories',
    family: 'investigation',
    category: 'Plug-ins',
    description: 'Compare two saved plug-in registration inventories and classify registration drift locally.',
    applicability: 'Use after collecting matching inventories from two environments or two release points.',
    safety: ['local-only'],
    prerequisites: ['PowerShell and two saved plug-in inventory JSON files.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'JSON diff and optional Markdown summary when you run the script.'],
    limitations: localComparisonLimitations,
    documentation: 'docs/Compare-PluginRegistration.md',
    parameters: [
      psParameter('ReferenceInventoryPath', 'referenceInventoryPath', 'Reference inventory path', 'path', { required: true }),
      psParameter('DifferenceInventoryPath', 'differenceInventoryPath', 'Inventory to compare', 'path', { required: true }),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON diff output path', 'path'),
      psParameter('SummaryOutputPath', 'summaryOutputPath', 'Markdown summary output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-environment-references',
    title: 'Test environment references',
    family: 'investigation',
    category: 'Environment configuration',
    description: 'Inspect environment variables and connection references using presence and resolution states only.',
    applicability: 'Use when a deployment works in one environment but values or connections are missing in another.',
    safety: ['remote-read-only'],
    prerequisites: ['PowerShell and an authorised Dataverse access token supplied at run time.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'JSON reference report and optional text summary when you run the script.'],
    limitations: ['Sensitive environment-variable values and connection IDs are never emitted; a missing optional value remains a warning.'],
    documentation: 'docs/Test-EnvironmentReferences.md',
    parameters: [
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { required: true, placeholder: 'https://org.crm.dynamics.com' }),
      secureRuntimeParameter(),
      psParameter('MaxRows', 'maxRows', 'Maximum rows per evidence surface', 'number', { defaultValue: 5000, min: 1, max: 100000 }),
      psParameter('ApiVersion', 'apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON output path', 'path'),
      psParameter('SummaryOutputPath', 'summaryOutputPath', 'Text summary output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-flow-state',
    title: 'Inspect flow deployment state',
    family: 'investigation',
    category: 'Environment configuration',
    description: 'Inventory cloud-flow activation, ownership, solution membership and conservative connection-reference relationships.',
    applicability: 'Use when flows import successfully but remain inactive, ambiguous or disconnected from expected solution scope.',
    safety: ['remote-read-only'],
    prerequisites: ['PowerShell and an authorised Dataverse access token supplied at run time.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'JSON flow inventory and optional text summary when you run the script.'],
    limitations: ['Flow-to-connection-reference relationships are conservative best-effort matches; raw clientData is not emitted.'],
    documentation: 'docs/Get-FlowDeploymentState.md',
    parameters: [
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { required: true, placeholder: 'https://org.crm.dynamics.com' }),
      secureRuntimeParameter(),
      psParameter('SolutionUniqueName', 'solutionUniqueName', 'Solution unique name filter', 'text', { validation: 'solution-name' }),
      psParameter('NameContains', 'nameContains', 'Flow name contains', 'text', { singleLine: true }),
      psParameter('MaxRows', 'maxRows', 'Maximum rows', 'number', { defaultValue: 5000, min: 1, max: 100000 }),
      psParameter('ApiVersion', 'apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON output path', 'path'),
      psParameter('SummaryOutputPath', 'summaryOutputPath', 'Text summary output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-pcf-project-health',
    title: 'Check PCF project health',
    family: 'development',
    category: 'Quality',
    description: 'Validate local PCF project, solution-project, version and dependency relationships before packaging.',
    applicability: 'Use as a local release-readiness check before a build or after cloning a control identity.',
    safety: ['local-only'],
    prerequisites: ['PowerShell and a valid PCF project root.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'JSON health report and optional text summary when you run the script.'],
    limitations: ['This is local inspection; it does not prove that a target environment will accept an import.'],
    documentation: 'docs/Test-PCFProjectHealth.md',
    parameters: [
      psParameter('ProjectRoot', 'projectRoot', 'PCF project root', 'path', { required: true, placeholder: String.raw`C:\Projects\PCF\InspectionControl` }),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON output path', 'path'),
      psParameter('SummaryOutputPath', 'summaryOutputPath', 'Text summary output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-pcf-release-package',
    title: 'Validate PCF release packages',
    family: 'development',
    category: 'Quality',
    description: 'Inspect managed and unmanaged PCF solution artefacts, versions, resources, hashes and parity.',
    applicability: 'Use after packaging and before promotion to preserve release evidence and catch development bundles.',
    safety: ['local-only'],
    prerequisites: ['PowerShell and at least one generated managed or unmanaged solution ZIP.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'JSON release report and optional text summary when you run the script.'],
    limitations: ['At least one package path must be supplied; the script validates artefacts locally and does not import them.'],
    documentation: 'docs/Test-PCFReleasePackage.md',
    requiredAny: [['managedPackagePath', 'unmanagedPackagePath']],
    parameters: [
      psParameter('ManagedPackagePath', 'managedPackagePath', 'Managed package path', 'path'),
      psParameter('UnmanagedPackagePath', 'unmanagedPackagePath', 'Unmanaged package path', 'path'),
      psParameter('ExpectedControlIdentity', 'expectedControlIdentity', 'Expected control identity', 'text'),
      psParameter('ExpectedControlVersion', 'expectedControlVersion', 'Expected control version', 'text', { validation: 'semver3' }),
      psParameter('ExpectedSolutionVersion', 'expectedSolutionVersion', 'Expected solution version', 'text', { validation: 'semver3or4' }),
      psParameter('FailOnBlocked', 'failOnBlocked', 'Fail when the report is blocked', 'checkbox'),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON output path', 'path'),
      psParameter('SummaryOutputPath', 'summaryOutputPath', 'Text summary output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-pages-inventory',
    title: 'Inventory Power Pages sites',
    family: 'power-pages',
    category: 'Site discovery',
    description: 'List Power Pages sites for explicit environment and PAC profile definitions.',
    applicability: 'Use to discover sites across environments before a backup, synchronisation or comparison workflow.',
    safety: ['remote-read-only-local-auth-context-mutation'],
    prerequisites: ['PowerShell, pac and named PAC authentication profiles.', 'An environment file or JSON environment-definition array.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'Site inventory object and optional JSON output when you run the script.'],
    limitations: ['Site inventory depends on human-readable PAC output; unrecognised fields remain unparsed rather than guessed.', 'Profile selection temporarily changes local PAC state and is restored where possible.'],
    documentation: 'docs/Get-PowerPagesSiteInventory.md',
    requiredAny: [['environmentFile', 'environmentDefinitionJson']],
    parameters: [
      jsonArrayParameter('EnvironmentDefinition', 'environmentDefinitionJson', 'Environment definitions JSON', { placeholder: '[{"Label":"Development","EnvironmentUrl":"https://org.crm.dynamics.com","PacAuthProfile":"Org-Dev"}]', help: 'Alternative to EnvironmentFile. Supply an array of objects with Label, EnvironmentUrl and PacAuthProfile.' }),
      psParameter('EnvironmentFile', 'environmentFile', 'Environment definitions file', 'path', { placeholder: String.raw`C:\PowerPages\environments.json`, help: 'Alternative to Environment definitions JSON.' }),
      psParameter('CreateAuthenticationProfiles', 'createAuthenticationProfiles', 'Create missing PAC profiles explicitly', 'checkbox'),
      psParameter('DeviceCode', 'deviceCode', 'Use device-code authentication for explicit profile creation', 'checkbox'),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON output path', 'path')
    ]
  }),
  powershellScript({
    id: 'pp-pages-sync',
    title: 'Synchronise a Power Pages site',
    family: 'power-pages',
    category: 'Synchronisation',
    description: 'Download, validate and safely replace a local Power Pages working tree with staging and rollback protection.',
    applicability: 'Use when a local site tree must be refreshed from a named site after reviewing the replacement risk.',
    safety: ['remote-read-only-local-filesystem-and-auth-mutation'],
    prerequisites: ['PowerShell, pac, a named PAC profile, a site GUID and safe local target/staging directories.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'A replaced local site tree when you run the script.'],
    limitations: ['This script mutates local files and temporarily selects PAC authentication; it does not upload or mutate the remote site.', 'Canonical descendant checks, staging validation and rollback protection remain part of the supplied script.'],
    documentation: 'docs/Sync-PowerPagesSite.md',
    parameters: [
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { required: true, placeholder: 'https://org.crm.dynamics.com' }),
      psParameter('PacAuthProfile', 'pacAuthProfile', 'PAC authentication profile', 'text', { required: true, placeholder: 'Org-Dev', maxLength: 30 }),
      psParameter('WebsiteId', 'websiteId', 'Website ID', 'text', { required: true, validation: 'guid', placeholder: '11111111-2222-3333-4444-555555555555' }),
      psParameter('LocalTargetDirectory', 'localTargetDirectory', 'Local target directory', 'path', { required: true, placeholder: String.raw`C:\PowerPages\sites\contoso` }),
      psParameter('StagingDirectory', 'stagingDirectory', 'Staging directory', 'path', { required: true, placeholder: String.raw`C:\PowerPages\staging` }),
      psParameter('ModelVersion', 'modelVersion', 'PAC model version', 'select', { options: MODEL_VERSIONS.map(value => ({ value, label: value })), defaultValue: '' }),
      psParameter('CreateAuthenticationProfile', 'createAuthenticationProfile', 'Create the PAC profile explicitly', 'checkbox'),
      psParameter('DeviceCode', 'deviceCode', 'Use device-code authentication for explicit profile creation', 'checkbox')
    ]
  }),
  powershellScript({
    id: 'pp-pages-backup',
    title: 'Back up a Power Pages site',
    family: 'power-pages',
    category: 'Backup',
    description: 'Create a new timestamped local Power Pages backup without replacing existing work.',
    applicability: 'Use before a synchronisation or when preserving a known site state for later comparison.',
    safety: ['local-backup-creation', 'local-auth-context-mutation'],
    prerequisites: ['PowerShell, pac, a named PAC profile, a site GUID and a backup root directory.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'A new backup tree and backup-metadata.json when you run the script.'],
    limitations: ['The script creates local files and temporarily selects PAC authentication; it does not replace an existing backup or mutate the remote site.'],
    documentation: 'docs/Backup-PowerPagesSite.md',
    parameters: [
      psParameter('EnvironmentUrl', 'environmentUrl', 'Environment URL', 'url', { required: true, placeholder: 'https://org.crm.dynamics.com' }),
      psParameter('PacAuthProfile', 'pacAuthProfile', 'PAC authentication profile', 'text', { required: true, placeholder: 'Org-Dev', maxLength: 30 }),
      psParameter('WebsiteId', 'websiteId', 'Website ID', 'text', { required: true, validation: 'guid', placeholder: '11111111-2222-3333-4444-555555555555' }),
      psParameter('BackupRoot', 'backupRoot', 'Backup root directory', 'path', { required: true, placeholder: String.raw`C:\PowerPages\backups` }),
      psParameter('ModelVersion', 'modelVersion', 'PAC model version', 'select', { options: MODEL_VERSIONS.map(value => ({ value, label: value })), defaultValue: '' }),
      psParameter('CreateAuthenticationProfile', 'createAuthenticationProfile', 'Create the PAC profile explicitly', 'checkbox'),
      psParameter('DeviceCode', 'deviceCode', 'Use device-code authentication for explicit profile creation', 'checkbox')
    ]
  }),
  powershellScript({
    id: 'pp-pages-compare',
    title: 'Compare Power Pages site trees',
    family: 'power-pages',
    category: 'Comparison',
    description: 'Compare two locally downloaded Power Pages trees using content-aware normalisation.',
    applicability: 'Use to identify site content and metadata drift between two downloaded states.',
    safety: ['local-only'],
    prerequisites: ['PowerShell and two local Power Pages site trees.'],
    outputs: ['PowerShell command.', 'Downloadable reviewed .ps1 launcher.', 'JSON diff and optional Markdown summary when you run the script.'],
    limitations: ['org-url-manifest.yml is ignored by default because it is environment-specific; include it only when that comparison is intentional.'],
    documentation: 'docs/Compare-PowerPagesSites.md',
    parameters: [
      psParameter('SiteAPath', 'siteAPath', 'First site path', 'path', { required: true }),
      psParameter('SiteBPath', 'siteBPath', 'Second site path', 'path', { required: true }),
      psParameter('IncludeEnvironmentManifest', 'includeEnvironmentManifest', 'Include org-url-manifest.yml', 'checkbox'),
      psParameter('JsonOutputPath', 'jsonOutputPath', 'JSON diff output path', 'path'),
      psParameter('MarkdownOutputPath', 'markdownOutputPath', 'Markdown summary output path', 'path')
    ]
  }),
  browserScript({
    id: 'forensics-pcf',
    title: 'PCF Forensics',
    family: 'investigation',
    category: 'PCF',
    version: '2.0.1',
    maturity: SCRIPT_MATURITY.FIELD_TESTED,
    safety: ['remote-read-only'],
    description: 'Investigate a PCF CustomControl resource graph, runtime HTTP integrity, solution membership and retained history.',
    applicability: 'Use when a PCF works in one environment but fails in another, or when bundle.js/CSS is missing, empty or returning HTTP errors.',
    prerequisites: ['Open the target Dynamics 365 or Power Apps model-driven app while authenticated.', 'Run the generated source manually in browser DevTools Console.'],
    outputs: ['Copyable/downloadable browser-console script.', 'Rich console tables and final JSON in window.__PCF_FORENSICS.', 'The supplied PCF Forensics panel with Download JSON, Copy JSON and Print JSON actions.'],
    limitations: ['The report is field evidence and a diagnostic aid, not a Microsoft Support determination.', 'The supplied query sequence and HTTP checks are kept intact.'],
    documentation: 'docs/10-PCF-Forensics-Generic.md',
    parameters: [
      configParameter('controlName', 'PCF control name', 'text', { required: true, validation: 'pcf-control-name', placeholder: 'publisher_namespace.Controls.SampleControl', singleLine: true }),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('historyOldestTop', 'Oldest history rows', 'number', { defaultValue: 25, min: 1, max: 1000 }),
      configParameter('historyNewestTop', 'Newest history rows', 'number', { defaultValue: 25, min: 1, max: 1000 }),
      configParameter('historyRelatedTop', 'Related history rows', 'number', { defaultValue: 200, min: 1, max: 5000 }),
      configParameter('broadWebResourceTop', 'Broad WebResource rows', 'number', { defaultValue: 200, min: 1, max: 5000 }),
      configParameter('componentLayerTop', 'Component layer rows', 'number', { defaultValue: 200, min: 1, max: 5000 }),
      configParameter('solutionComponentTop', 'Solution component rows', 'number', { defaultValue: 200, min: 1, max: 5000 }),
      configParameter('httpTest', 'Run runtime HTTP checks', 'checkbox', { defaultValue: true }),
      configParameter('printFinalJson', 'Print final JSON in the console', 'checkbox', { defaultValue: true })
    ]
  }),
  browserScript({
    id: 'forensics-solution',
    title: 'Solution Forensics',
    family: 'investigation',
    category: 'Solutions',
    description: 'Inspect solution components, patch relationships and retained import history.',
    applicability: 'Use for failed or suspicious deployments, long patch chains or overwrite-customisation review.',
    safety: ['remote-read-only'],
    documentation: 'docs/11-Solution-Forensics-Generic.md',
    parameters: [
      configParameter('solutionUniqueName', 'Solution unique name', 'text', { required: true, validation: 'solution-name', placeholder: 'contoso_solution' }),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('componentTop', 'Component rows', 'number', { defaultValue: 5000, min: 1, max: 100000 }),
      configParameter('patchTop', 'Patch rows', 'number', { defaultValue: 500, min: 1, max: 5000 }),
      configParameter('patchWarningThreshold', 'Patch warning threshold', 'number', { defaultValue: 20, min: 1, max: 1000 }),
      configParameter('historyTop', 'History rows', 'number', { defaultValue: 300, min: 1, max: 5000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['Historical failures are warnings because an old failed import does not necessarily describe the current state.'],
    documentation: 'docs/11-Solution-Forensics-Generic.md'
  }),
  browserScript({
    id: 'forensics-plugin-steps',
    title: 'Plug-in Step Forensics',
    family: 'investigation',
    category: 'Plug-ins',
    description: 'Inspect a plug-in assembly, types, SDK message-processing steps, filters and images.',
    applicability: 'Use when steps are disabled, duplicated, too broad or running in an unexpected order after deployment.',
    safety: ['remote-read-only'],
    documentation: 'docs/12-Plugin-Step-Forensics.md',
    parameters: [
      configParameter('assemblyName', 'Plug-in assembly name', 'text', { required: true, placeholder: 'Contoso.Plugins' }),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('typeTop', 'Plug-in type rows', 'number', { defaultValue: 500, min: 1, max: 5000 }),
      configParameter('stepTop', 'Step rows', 'number', { defaultValue: 1000, min: 1, max: 10000 }),
      configParameter('imageTop', 'Image rows', 'number', { defaultValue: 1000, min: 1, max: 10000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['The script does not activate or repair steps.'],
    documentation: 'docs/12-Plugin-Step-Forensics.md'
  }),
  browserScript({
    id: 'forensics-flow',
    title: 'Flow Forensics',
    family: 'investigation',
    category: 'Power Automate',
    description: 'Audit cloud-flow records, activation state, ownership metadata and optional solution scope.',
    applicability: 'Use when flows import but remain inactive, or when a solution-scoped flow inventory is needed.',
    safety: ['remote-read-only'],
    documentation: 'docs/13-Flow-Forensics.md',
    parameters: [
      configParameter('solutionUniqueName', 'Solution unique name filter', 'text', { validation: 'solution-name', placeholder: 'contoso_solution' }),
      configParameter('nameContains', 'Flow name contains', 'text', { singleLine: true }),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('flowTop', 'Flow rows', 'number', { defaultValue: 1000, min: 1, max: 10000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['Connection references and environment variables are handled by Environment Reference Audit; raw flow clientData is not emitted.'],
    documentation: 'docs/13-Flow-Forensics.md'
  }),
  browserScript({
    id: 'forensics-environment-fingerprint',
    title: 'Environment Fingerprint',
    family: 'investigation',
    category: 'Environment',
    description: 'Create a deterministic environment snapshot covering solutions, PCFs, plug-ins, flows and references.',
    applicability: 'Use before and after releases, or in healthy and affected environments, to find configuration drift.',
    safety: ['remote-read-only'],
    documentation: 'docs/14-Environment-Fingerprint.md',
    parameters: [
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('maxRows', 'Maximum rows per surface', 'number', { defaultValue: 5000, min: 1, max: 100000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['Use the supplied Compare Environment Fingerprints script to compare two exported reports.'],
    documentation: 'docs/14-Environment-Fingerprint.md'
  }),
  browserScript({
    id: 'forensics-environment-compare',
    title: 'Compare Environment Fingerprints',
    family: 'investigation',
    category: 'Environment',
    runtime: SCRIPT_RUNTIME.LOCAL_BROWSER,
    description: 'Compare two saved Environment Fingerprint JSON files locally without network access.',
    applicability: 'Use after collecting matching fingerprints from two environments or release points.',
    safety: ['local-only'],
    prerequisites: ['Any ordinary browser; select the two JSON files in the supplied on-page panel.'],
    outputs: ['Copyable/downloadable browser-console script.', 'Local JSON difference report in window.__DYNAMICS_FORENSICS_DIFF.'],
    limitations: localComparisonLimitations,
    documentation: 'docs/15-Compare-Environment-Fingerprints.md'
  }),
  browserScript({
    id: 'forensics-component',
    title: 'Component Forensics',
    family: 'investigation',
    category: 'Components',
    description: 'Investigate a known Dataverse component GUID and its solution-component and layer evidence.',
    applicability: 'Use when tracing which solutions contain a component or when layer exposure needs investigation.',
    safety: ['remote-read-only'],
    documentation: 'docs/16-Component-Forensics-Generic.md',
    parameters: [
      configParameter('objectId', 'Component object ID', 'text', { required: true, validation: 'guid', placeholder: '00000000-0000-0000-0000-000000000000' }),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('maxRows', 'Maximum rows', 'number', { defaultValue: 1000, min: 1, max: 10000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['An empty msdyn_componentlayers result is informational only and is not proof that no internal layers exist.'],
    documentation: 'docs/16-Component-Forensics-Generic.md'
  }),
  browserScript({
    id: 'forensics-web-resource',
    title: 'WebResource Integrity Audit',
    family: 'investigation',
    category: 'Web Resources',
    description: 'Audit WebResource payload storage and runtime HTTP serving for a prefix or substring.',
    applicability: 'Use for bulk JS, CSS or HTML WebResource checks after deployment.',
    safety: ['remote-read-only'],
    documentation: 'docs/17-WebResource-Integrity-Audit.md',
    parameters: [
      configParameter('namePrefix', 'WebResource name prefix', 'text'),
      configParameter('nameContains', 'WebResource name contains', 'text'),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('maxRows', 'Maximum rows', 'number', { defaultValue: 500, min: 1, max: 10000 }),
      configParameter('httpTest', 'Run runtime HTTP checks', 'checkbox', { defaultValue: true })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['Raw Base64 payload is inspected for presence and length but is not copied into the report.'],
    documentation: 'docs/17-WebResource-Integrity-Audit.md'
  }),
  browserScript({
    id: 'forensics-form',
    title: 'Form Forensics',
    family: 'investigation',
    category: 'Forms',
    description: 'Read FormXML, inventory controls, detect duplicate control IDs and check JavaScript library references.',
    applicability: 'Use for form errors, missing JavaScript libraries or malformed FormXML after solution deployment.',
    safety: ['remote-read-only'],
    requiredAny: [['formId', 'formNameContains']],
    documentation: 'docs/18-Form-Forensics.md',
    parameters: [
      configParameter('formId', 'Form ID', 'text', { validation: 'guid', placeholder: '00000000-0000-0000-0000-000000000000' }),
      configParameter('formNameContains', 'Form name contains', 'text'),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('maxForms', 'Maximum forms', 'number', { defaultValue: 50, min: 1, max: 1000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['FormXML is complex; the script deliberately performs conservative checks rather than interpreting every schema variation.'],
    documentation: 'docs/18-Form-Forensics.md'
  }),
  browserScript({
    id: 'forensics-bpf',
    title: 'Business Process Flow Forensics',
    family: 'investigation',
    category: 'Business Process Flows',
    description: 'Audit Business Process Flow workflow records and their process stages.',
    applicability: 'Use when a BPF is inactive, has missing or duplicate stages, or needs a stage inventory.',
    safety: ['remote-read-only'],
    documentation: 'docs/19-BPF-Forensics.md',
    parameters: [
      configParameter('processNameContains', 'Process name contains', 'text'),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('maxProcesses', 'Maximum processes', 'number', { defaultValue: 200, min: 1, max: 5000 }),
      configParameter('maxStages', 'Maximum stages', 'number', { defaultValue: 500, min: 1, max: 10000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['The script is read-only and does not activate BPFs.'],
    documentation: 'docs/19-BPF-Forensics.md'
  }),
  browserScript({
    id: 'forensics-environment-references',
    title: 'Environment Reference Audit',
    family: 'investigation',
    category: 'Environment',
    description: 'Audit environment variable definitions/current values and connection references.',
    applicability: 'Use when a deployment works in one environment but values or connections are missing in another.',
    safety: ['remote-read-only'],
    documentation: 'docs/20-Environment-Reference-Audit.md',
    parameters: [
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('maxRows', 'Maximum rows per surface', 'number', { defaultValue: 5000, min: 1, max: 100000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['Missing values are warnings because some environment variables are intentionally optional; sensitive values and connection IDs are not emitted.'],
    documentation: 'docs/20-Environment-Reference-Audit.md'
  }),
  browserScript({
    id: 'forensics-app-module',
    title: 'App Module Forensics',
    family: 'investigation',
    category: 'Apps',
    description: 'Inspect a model-driven app record, solution membership and best-effort app component inventory.',
    applicability: 'Use when an app differs between environments or its solution ownership and component membership need evidence.',
    safety: ['remote-read-only'],
    documentation: 'docs/21-App-Module-Forensics.md',
    parameters: [
      configParameter('appUniqueName', 'App unique name', 'text', { required: true, placeholder: 'contoso_app' }),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('maxRows', 'Maximum rows', 'number', { defaultValue: 5000, min: 1, max: 100000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['AppModuleComponent exposure varies; an empty component result is informational, not proof that the app is empty.'],
    documentation: 'docs/21-App-Module-Forensics.md'
  }),
  browserScript({
    id: 'forensics-async-operations',
    title: 'Async Operations Health',
    family: 'investigation',
    category: 'Async Operations',
    description: 'Review recent asynchronous operations for failures and work that appears to be running unusually long.',
    applicability: 'Use when investigating background processing issues or post-deployment async failures.',
    safety: ['remote-read-only'],
    documentation: 'docs/22-Async-Operations-Health.md',
    parameters: [
      configParameter('lookbackHours', 'Lookback hours', 'number', { defaultValue: 168, min: 1, max: 8760 }),
      configParameter('stuckHours', 'Possibly stuck after hours', 'number', { defaultValue: 2, min: 1, max: 8760 }),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('maxRows', 'Maximum rows', 'number', { defaultValue: 1000, min: 1, max: 10000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['Possibly stuck is a heuristic; long-running work may be legitimate.'],
    documentation: 'docs/22-Async-Operations-Health.md'
  }),
  browserScript({
    id: 'forensics-security-role-audit',
    title: 'Security Role Audit',
    family: 'investigation',
    category: 'Security',
    description: 'Export security roles and privilege assignments, including privilege depth masks.',
    applicability: 'Use to capture role configuration for comparison or investigate role drift around a deployment.',
    safety: ['remote-read-only'],
    documentation: 'docs/23-Security-Role-Audit.md',
    parameters: [
      configParameter('roleNameContains', 'Role name contains', 'text'),
      configParameter('apiVersion', 'Dataverse API version', 'text', { defaultValue: API_VERSION_DEFAULT, validation: 'api-version' }),
      configParameter('requestTimeoutMs', 'Request timeout (ms)', 'number', { defaultValue: 15000, min: 1000, max: 120000 }),
      configParameter('requestRetries', 'Request retries', 'number', { defaultValue: 1, min: 0, max: 5 }),
      configParameter('maxRoles', 'Maximum roles', 'number', { defaultValue: 200, min: 1, max: 5000 }),
      configParameter('maxPrivileges', 'Maximum privileges', 'number', { defaultValue: 5000, min: 1, max: 100000 })
    ],
    outputs: ['Copyable/downloadable browser-console script.', textOutput],
    limitations: ['Use the supplied Security Role Diff script to compare two exported role audit reports.'],
    documentation: 'docs/23-Security-Role-Audit.md'
  }),
  browserScript({
    id: 'forensics-security-role-diff',
    title: 'Security Role Diff',
    family: 'investigation',
    category: 'Security',
    runtime: SCRIPT_RUNTIME.LOCAL_BROWSER,
    description: 'Compare two Security Role Audit JSON files and highlight role, privilege and depth changes.',
    applicability: 'Use for QA/production role comparisons or to check whether a deployment changed security privileges.',
    safety: ['local-only'],
    prerequisites: ['Any ordinary browser; select the two JSON files in the supplied on-page panel.'],
    outputs: ['Copyable/downloadable browser-console script.', 'Local JSON difference report in window.__DYNAMICS_FORENSICS_DIFF.'],
    limitations: localComparisonLimitations,
    documentation: 'docs/24-Security-Role-Diff.md'
  })
];

// These files remain in the imported PCF package for dependency and provenance
// reasons, but are not offered as duplicate catalogue actions.
export const SCRIPT_HUB_EXCLUSIONS = Object.freeze([
  {
    package: 'PS Scripts',
    name: 'Test-PCFProjectConfiguration.ps1',
    decision: 'superseded',
    reason: 'Superseded by the authoritative Power Platform library Test-PCFProjectHealth.ps1, which provides the broader current project health workflow.'
  },
  {
    package: 'PS Scripts',
    name: 'Test-PCFReleaseArtifact.ps1',
    decision: 'superseded',
    reason: 'Superseded by the authoritative Power Platform library Test-PCFReleasePackage.ps1, which validates managed/unmanaged packages, hashes and release parity.'
  },
  {
    package: 'PS Scripts',
    name: 'PCF.Common.ps1',
    decision: 'dependency',
    reason: 'Shared dot-sourced helper required by retained PCF workflows; it is not a user-facing standalone action.'
  },
  {
    package: 'PS Scripts',
    name: 'pcf-env.example.json',
    decision: 'supporting-fixture',
    reason: 'Supporting baseline example retained with the source package; it is not an executable workflow.'
  }
]);

export const SCRIPT_FIELDS = Object.freeze(Object.fromEntries(
  SCRIPT_CATALOGUE
    .flatMap(script => script.inputs || [])
    .map(input => [input.id, input])
));

export function getScriptById(id, catalogue = SCRIPT_CATALOGUE) {
  return catalogue.find(script => script.id === id) || null;
}

export function getScriptsForFamily(family, catalogue = SCRIPT_CATALOGUE) {
  return catalogue.filter(script => script.family === family);
}

export function getScriptCategories(family, catalogue = SCRIPT_CATALOGUE) {
  return [...new Set(getScriptsForFamily(family, catalogue).map(script => script.category))];
}

export function validateScriptCatalogue(catalogue = SCRIPT_CATALOGUE) {
  const errors = [];
  const ids = new Set();
  const sourceKeys = new Map();

  catalogue.forEach(script => {
    if (!script?.id) {
      errors.push('Script is missing an id.');
      return;
    }

    if (ids.has(script.id)) {
      errors.push(`Duplicate script id ${script.id}.`);
    }
    ids.add(script.id);

    if (!script.title || !script.family || !script.category || !script.description || !script.applicability) {
      errors.push(`${script.id} is missing required catalogue metadata.`);
    }

    if (!SCRIPT_RUNTIME_LABELS[script.runtime]) {
      errors.push(`${script.id} has an unsupported runtime ${script.runtime || '(empty)'}.`);
    }

    if (!Object.values(SCRIPT_MATURITY).includes(script.maturity)) {
      errors.push(`${script.id} has an unsupported maturity ${script.maturity || '(empty)'}.`);
    }

    if (!Array.isArray(script.safety) || script.safety.length === 0) {
      errors.push(`${script.id} is missing safety metadata.`);
    } else {
      script.safety.forEach(safety => {
        if (!SCRIPT_SAFETY_LABELS[safety]) {
          errors.push(`${script.id} has an unsupported safety classification ${safety}.`);
        }
      });
    }

    if (!script.source?.path || !script.source?.sha256 || !script.source?.name) {
      errors.push(`${script.id} is missing source integrity metadata.`);
    }

    const sourceKey = `${script.source?.package || ''}|${script.source?.name || ''}`;
    if (sourceKey !== '|') {
      const previous = sourceKeys.get(sourceKey);
      if (previous) {
        errors.push(`${script.id} has an ambiguous source authority with ${previous.id} for ${sourceKey}.`);
      } else {
        sourceKeys.set(sourceKey, script);
      }
    }

    const inputIds = new Set();
    (script.inputs || []).forEach(input => {
      if (!input?.id) {
        errors.push(`${script.id} has an input without an id.`);
        return;
      }

      if (inputIds.has(input.id)) {
        errors.push(`${script.id} has duplicate input ${input.id}.`);
      }
      inputIds.add(input.id);
    });

    const parameterNames = new Set();
    (script.parameters || []).forEach(parameter => {
      if (!parameter.name) {
        errors.push(`${script.id} has a parameter without a name.`);
      }
      if (parameterNames.has(parameter.name)) {
        errors.push(`${script.id} has duplicate parameter ${parameter.name}.`);
      }
      parameterNames.add(parameter.name);
      if (parameter.name && /clientsecret|password|refreshtoken|accesstoken/i.test(parameter.name) && parameter.kind !== 'secure-runtime') {
        errors.push(`${script.id} exposes a sensitive parameter ${parameter.name} without a run-time prompt.`);
      }
    });

    (script.requiredAny || []).forEach(inputIdList => {
      const requiredIds = Array.isArray(inputIdList) ? inputIdList : [inputIdList];
      requiredIds.forEach(inputId => {
        if (!inputIds.has(inputId)) {
          errors.push(`${script.id} requiredAny input ${inputId} is not defined.`);
        }
      });
    });
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normaliseScriptValues(script, suppliedValues = {}) {
  const values = {};

  (script.inputs || []).forEach(input => {
    if (input.runtimePrompt) {
      return;
    }

    const supplied = suppliedValues[input.id];
    const value = supplied === undefined ? input.defaultValue : supplied;

    if (input.type === 'checkbox') {
      values[input.id] = Boolean(value);
    } else if (input.type === 'number') {
      values[input.id] = value === '' || value === undefined || value === null ? '' : Number(value);
    } else {
      values[input.id] = value === undefined || value === null ? '' : String(value).trim();
    }
  });

  return values;
}

export function validateScriptInputs(script, suppliedValues = {}) {
  const values = normaliseScriptValues(script, suppliedValues);
  const errors = [];

  (script.inputs || []).forEach(input => {
    if (input.runtimePrompt || !isInputActive(input, values)) {
      return;
    }

    const value = values[input.id];
    const blank = isBlankValue(value);
    const required = input.required === true || (typeof input.requiredWhen === 'function' && input.requiredWhen(values));

    if (required && blank) {
      errors.push(`Enter ${input.label.toLowerCase()} before building this script.`);
      return;
    }

    if (blank) {
      return;
    }

    if (input.singleLine && typeof value === 'string' && /[\r\n]/.test(value)) {
      errors.push(`${input.label} must be a single line.`);
      return;
    }

    if (input.maxLength && String(value).length > input.maxLength) {
      errors.push(`${input.label} must be ${input.maxLength} characters or fewer.`);
    }

    if (input.type === 'select' && !input.options.some(option => option.value === value)) {
      errors.push(`Choose a supported ${input.label.toLowerCase()}.`);
    }

    if (input.type === 'number') {
      if (!Number.isInteger(value)) {
        errors.push(`${input.label} must be a whole number.`);
      } else if (input.min !== undefined && value < input.min) {
        errors.push(`${input.label} must be ${input.min} or more.`);
      } else if (input.max !== undefined && value > input.max) {
        errors.push(`${input.label} must be ${input.max} or less.`);
      }
    }

    if (input.validation && !validateInputPattern(input.validation, value)) {
      errors.push(validationMessage(input));
    }

    if (input.kind === 'json-array') {
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          errors.push(`${input.label} must contain a JSON array.`);
        }
      } catch {
        errors.push(`${input.label} must contain valid JSON.`);
      }
    }
  });

  (script.requiredAny || []).forEach(inputIdList => {
    const inputIds = Array.isArray(inputIdList) ? inputIdList : [inputIdList];
    if (inputIds.some(inputId => !isBlankValue(values[inputId]))) {
      return;
    }

    const labels = inputIds
      .map(inputId => script.inputs.find(input => input.id === inputId)?.label)
      .filter(Boolean)
      .map(label => label.toLowerCase());
    errors.push(`Enter one of ${formatList(labels)} before building this script.`);
  });

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  return values;
}

export function generateScript({ scriptId, script: suppliedScript, values = {}, template = '' } = {}) {
  const script = suppliedScript || getScriptById(scriptId);

  if (!script) {
    throw new Error('Choose a supported script.');
  }

  const normalisedValues = validateScriptInputs(script, values);

  if (script.runtime === SCRIPT_RUNTIME.POWERSHELL_HELPER) {
    return generatePowerShellOutput(script, normalisedValues);
  }

  if (typeof template !== 'string' || template.length === 0) {
    throw new Error('The selected browser script source could not be loaded.');
  }

  return generateBrowserOutput(script, normalisedValues, template);
}

export function quotePowerShellArgument(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

export function escapeJavaScriptString(value) {
  return JSON.stringify(String(value ?? ''));
}

function generatePowerShellOutput(script, values) {
  const parameters = getActiveParameters(script, values);
  const secureParameters = parameters.filter(parameter => parameter.kind === 'secure-runtime');
  const scriptExpression = `(Join-Path ${quotePowerShellArgument(values.scriptsPath)} ${quotePowerShellArgument(script.scriptName)})`;
  const renderedParameters = parameters.map(parameter => renderInlinePowerShellParameter(parameter, values));
  const invocation = ['&', scriptExpression, ...renderedParameters].join(' ');
  const commandInvocation = script.workingDirectoryField && values[script.workingDirectoryField]
    ? buildWorkingDirectoryCommand(values[script.workingDirectoryField], invocation)
    : invocation;
  const prompts = secureParameters.map(parameter => `${getRuntimeVariableName(parameter)} = ${parameter.runtimePrompt}`);
  const command = [...prompts, commandInvocation].join('; ');
  const launcher = buildPowerShellLauncher(script, values, parameters, secureParameters, scriptExpression);
  const warnings = buildScriptWarnings(script, values);
  const checklist = buildScriptChecklist(script, values);
  const launcherFilename = `${safeFilename(script.downloadBaseName)}-launcher.ps1`;

  return {
    script,
    runtime: script.runtime,
    scriptName: script.scriptName,
    command,
    launcher,
    launcherFilename,
    filename: launcherFilename,
    parameters,
    warnings,
    checklist,
    summary: {
      parameterCount: parameters.length,
      requiredFieldCount: script.inputs.filter(input => input.required).length,
      warningCount: warnings.length
    }
  };
}

function generateBrowserOutput(script, values, template) {
  const generatedScript = replaceConfigValues(template, script.parameters, values);
  const warnings = buildScriptWarnings(script, values);
  const checklist = buildScriptChecklist(script, values);
  const filename = `${safeFilename(script.downloadBaseName || script.source.name.replace(/\.txt$/i, ''))}.txt`;

  return {
    scriptDefinition: script,
    runtime: script.runtime,
    scriptName: script.scriptName,
    scriptText: generatedScript,
    script: generatedScript,
    filename,
    parameters: getActiveParameters(script, values),
    warnings,
    checklist,
    summary: {
      parameterCount: getActiveParameters(script, values).length,
      requiredFieldCount: script.inputs.filter(input => input.required).length,
      warningCount: warnings.length
    }
  };
}

function getActiveParameters(script, values) {
  return (script.parameters || [])
    .filter(parameter => isInputActive(parameter, values))
    .filter(parameter => typeof parameter.includeWhen !== 'function' || parameter.includeWhen(values))
    .filter(parameter => (
      parameter.kind === 'secure-runtime' ||
      parameter.kind === 'boolean' ||
      (parameter.kind === 'switch' ? Boolean(values[parameter.id]) : !isBlankValue(values[parameter.id]))
    ))
    .map(parameter => ({
      ...parameter,
      value: parameter.kind === 'secure-runtime' ? undefined : values[parameter.id]
    }));
}

function buildPowerShellLauncher(script, values, parameters, secureParameters, scriptExpression) {
  const lines = [
    '# Generated by Developer Tools — Power Platform Script Hub',
    `# Source: ${script.scriptName} v${script.version}`,
    '# Review this file before running it in PowerShell.',
    '[CmdletBinding()]',
    'param()',
    '',
    "$ErrorActionPreference = 'Stop'",
    `$scriptPath = Join-Path ${quotePowerShellArgument(values.scriptsPath)} ${quotePowerShellArgument(script.scriptName)}`,
    'if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {',
    `  throw "Required PowerShell script not found: $scriptPath"`,
    '}'
  ];

  secureParameters.forEach(parameter => {
    lines.push('', `${getRuntimeVariableName(parameter)} = ${parameter.runtimePrompt}`);
  });

  if (parameters.length > 0) {
    lines.push('', '$parameters = [ordered]@{');
    parameters.forEach(parameter => {
      lines.push(`  ${parameter.name} = ${renderLauncherPowerShellValue(parameter, values)}`);
    });
    lines.push('}');
  }

  const invocation = parameters.length > 0 ? '& $scriptPath @parameters' : '& $scriptPath';
  if (script.workingDirectoryField && values[script.workingDirectoryField]) {
    lines.push(
      '',
      `Push-Location ${quotePowerShellArgument(values[script.workingDirectoryField])}`,
      'try {',
      `  ${invocation}`,
      '}',
      'finally {',
      '  Pop-Location',
      '}'
    );
  } else {
    lines.push('', invocation);
  }

  return `${lines.join('\n')}\n`;
}

function renderInlinePowerShellParameter(parameter, values) {
  if (parameter.kind === 'switch') {
    return `-${parameter.name}`;
  }

  if (parameter.kind === 'boolean') {
    return `-${parameter.name}:$${values[parameter.id] ? 'true' : 'false'}`;
  }

  if (parameter.kind === 'number') {
    return `-${parameter.name} ${values[parameter.id]}`;
  }

  if (parameter.kind === 'secure-runtime') {
    return `-${parameter.name} ${getRuntimeVariableName(parameter)}`;
  }

  if (parameter.kind === 'json-array') {
    return `-${parameter.name} (ConvertFrom-Json -InputObject ${quotePowerShellArgument(values[parameter.id])})`;
  }

  return `-${parameter.name} ${quotePowerShellArgument(values[parameter.id])}`;
}

function renderLauncherPowerShellValue(parameter, values) {
  if (parameter.kind === 'switch' || parameter.kind === 'boolean') {
    return `$${values[parameter.id] ? 'true' : 'false'}`;
  }

  if (parameter.kind === 'number') {
    return String(values[parameter.id]);
  }

  if (parameter.kind === 'secure-runtime') {
    return getRuntimeVariableName(parameter);
  }

  if (parameter.kind === 'json-array') {
    return `(ConvertFrom-Json -InputObject ${quotePowerShellArgument(values[parameter.id])})`;
  }

  return quotePowerShellArgument(values[parameter.id]);
}

function buildWorkingDirectoryCommand(workingDirectory, invocation) {
  return `Push-Location ${quotePowerShellArgument(workingDirectory)}; try { ${invocation} } finally { Pop-Location }`;
}

function buildScriptWarnings(script, values) {
  const warnings = [...(script.warnings || [])];

  if (script.safety.includes('remote-platform-mutation')) {
    warnings.push('Running this output can change a remote Power Platform environment. Confirm the target and authentication context first.');
  }

  if (script.safety.includes('local-filesystem-mutation')) {
    warnings.push('Running this output changes local files or directories. Review the target paths first.');
  }

  if (script.id === 'pcf-quick-deploy') {
    warnings.push('The service-principal parameter set is deliberately omitted; use the existing PAC authentication context.');
  }

  if (script.id === 'pcf-build-deploy' && values.deploy) {
    warnings.push(`This action imports a ${values.deployManaged ? 'managed' : 'unmanaged'} solution into the selected environment.`);
  }

  if (script.id === 'pcf-solution-check') {
    warnings.push('The source script uses SARIF level and rule-file options; no unsupported numeric issue threshold is generated.');
  }

  return [...new Set(warnings)];
}

function buildScriptChecklist(script) {
  return [
    `Confirm ${script.scriptName} is present in the selected local package folder.`,
    'Review the generated output before running it manually.',
    ...script.prerequisites.map(prerequisite => `Confirm: ${prerequisite}`)
  ];
}

function replaceConfigValues(template, parameters, values) {
  if (!parameters || parameters.length === 0) {
    return template;
  }

  const configMatch = template.match(/const\s+CONFIG\s*=\s*\{([\s\S]*?)\n\s*\};/);

  if (!configMatch) {
    throw new Error('The selected browser script does not expose a supported CONFIG block.');
  }

  let configBody = configMatch[1];

  parameters.forEach(parameter => {
    if (isBlankValue(values[parameter.id])) {
      return;
    }

    const key = parameter.configKey || parameter.name;
    const keyPattern = escapeRegularExpression(key);
    const propertyPattern = new RegExp(`(["']?${keyPattern}["']?\\s*:\\s*)("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|true|false|-?\\d+(?:\\.\\d+)?|[^,\\n}]+)`, 'g');
    const matches = configBody.match(propertyPattern) || [];

    if (matches.length !== 1) {
      throw new Error(`The ${key} configuration field could not be located safely in the supplied script.`);
    }

    const literal = renderJavaScriptLiteral(parameter, values[parameter.id]);
    // Use a replacement callback so user input such as "$&", "$'" or "$`"
    // is treated as literal text rather than as a JavaScript replacement token.
    configBody = configBody.replace(propertyPattern, (match, prefix) => `${prefix}${literal}`);
  });

  // Replace only the captured body and retain the source's closing newline and
  // brace layout. A callback also keeps literal dollar signs out of replacement
  // string semantics.
  const renderedConfig = configMatch[0].replace(configMatch[1], () => configBody);

  return `${template.slice(0, configMatch.index)}${renderedConfig}${template.slice(configMatch.index + configMatch[0].length)}`;
}

function renderJavaScriptLiteral(parameter, value) {
  if (parameter.kind === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (parameter.kind === 'number') {
    return String(value);
  }

  return escapeJavaScriptString(value);
}

function isInputActive(input, values) {
  return typeof input.when !== 'function' || input.when(values);
}

function validateInputPattern(validation, value) {
  const patterns = {
    'https-url': /^https:\/\/[^\s/]+(?:\/[^\s]*)?$/i,
    'api-version': /^v\d+\.\d+$/,
    'guid': /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'pcf-control-name': /^[A-Za-z][A-Za-z0-9_.-]*$/,
    'pcf-init-control-name': /^[A-Za-z][A-Za-z0-9]*$/,
    'publisher-name': /^[A-Za-z_][A-Za-z0-9_]*$/,
    'publisher-prefix': /^[A-Za-z][A-Za-z0-9]{1,7}$/,
    'solution-name': /^[A-Za-z][A-Za-z0-9_]*$/,
    namespace: /^[A-Za-z_][A-Za-z0-9_.]*$/,
    semver3: /^\d+\.\d+\.\d+$/,
    semver4: /^\d+\.\d+\.\d+\.\d+$/,
    semver3or4: /^\d+\.\d+\.\d+(?:\.\d+)?$/
  };
  return !patterns[validation] || patterns[validation].test(String(value));
}

function validationMessage(input) {
  const messages = {
    'https-url': `${input.label} must be a valid HTTPS URL.`,
    'api-version': `${input.label} must look like v9.2.`,
    guid: `${input.label} must be a valid GUID.`,
    'pcf-control-name': 'Control name must start with a letter and contain letters, numbers, dots, hyphens or underscores only.',
    'pcf-init-control-name': 'Control name must start with a letter and contain letters and numbers only.',
    'publisher-name': 'Publisher name must start with a letter or underscore and contain letters, numbers or underscores only.',
    'publisher-prefix': 'Publisher prefix must start with a letter and contain two to eight letters or numbers.',
    'solution-name': 'Solution unique name must start with a letter and contain letters, numbers or underscores only.',
    namespace: 'Namespace must contain letters, numbers, underscores or dots and start with a letter or underscore.',
    semver3: `${input.label} must use three numeric version parts.`,
    semver4: `${input.label} must use four numeric version parts.`,
    semver3or4: `${input.label} must use three or four numeric version parts.`
  };
  return messages[input.validation] || `${input.label} is invalid.`;
}

function getRuntimeVariableName(parameter) {
  return `$${parameter.id.charAt(0).toLowerCase()}${parameter.id.slice(1)}`;
}

function isBlankValue(value) {
  return value === undefined || value === null || value === '' || (typeof value === 'string' && value.trim() === '');
}

function formatList(values) {
  if (values.length === 1) {
    return values[0];
  }
  return `${values.slice(0, -1).join(', ')} or ${values.at(-1)}`;
}

function escapeRegularExpression(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeFilename(value) {
  return String(value || 'script').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'script';
}
