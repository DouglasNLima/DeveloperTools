export const PCF_SCRIPT_PHASES = {
  create: {
    label: 'Create',
    summary: 'Initialise the control, solution project and recommended folder structure.'
  },
  develop: {
    label: 'Develop',
    summary: 'Check the workstation or start the local PCF test harness.'
  },
  build: {
    label: 'Version & build',
    summary: 'Keep manifests aligned, build the control and package the solution.'
  },
  deploy: {
    label: 'Deploy',
    summary: 'Prepare a rapid PCF push or a full Dataverse solution import.'
  },
  quality: {
    label: 'Quality',
    summary: 'Run the Power Platform Solution Checker as a configurable quality gate.'
  }
};

export const PCF_SCRIPT_FIELDS = {
  scriptsPath: {
    label: 'PS Scripts folder',
    type: 'text',
    placeholder: String.raw`C:\Projects\PCF\PS Scripts`,
    help: 'Folder containing the PCF helper scripts.'
  },
  controlName: {
    label: 'Control name',
    type: 'text',
    placeholder: 'InspectionControl'
  },
  publisherName: {
    label: 'Publisher name',
    type: 'text',
    placeholder: 'Contoso'
  },
  publisherPrefix: {
    label: 'Publisher prefix',
    type: 'text',
    placeholder: 'cts'
  },
  projectPath: {
    label: 'New project root',
    type: 'text',
    placeholder: String.raw`C:\Projects\PCF\InspectionControl`
  },
  solutionUniqueName: {
    label: 'Solution unique name',
    type: 'text',
    placeholder: 'InspectionControl'
  },
  controlTemplate: {
    label: 'Control template',
    type: 'select',
    options: [
      { value: 'field', label: 'Field' },
      { value: 'dataset', label: 'Dataset' }
    ],
    defaultValue: 'field'
  },
  controlFramework: {
    label: 'Control framework',
    type: 'select',
    options: [
      { value: 'react', label: 'React' },
      { value: 'none', label: 'None' }
    ],
    defaultValue: 'react'
  },
  solutionDescription: {
    label: 'Solution description',
    type: 'text',
    placeholder: 'Custom inspection control.'
  },
  controlFolder: {
    label: 'Control source folder',
    type: 'text',
    placeholder: String.raw`C:\Projects\PCF\InspectionControl\InspectionControl`,
    help: 'Folder containing ControlManifest.Input.xml.'
  },
  projectRoot: {
    label: 'PCF project root',
    type: 'text',
    placeholder: String.raw`C:\Projects\PCF\InspectionControl`,
    help: 'Folder containing the control project and Solution folder.'
  },
  incrementVersion: {
    label: 'Increment versions before building',
    type: 'checkbox',
    defaultValue: false
  },
  buildConfiguration: {
    label: 'Build configuration',
    type: 'select',
    options: [
      { value: 'Debug', label: 'Debug' },
      { value: 'Release', label: 'Release' }
    ],
    defaultValue: 'Debug'
  },
  deploy: {
    label: 'Deploy after a successful build',
    type: 'checkbox',
    defaultValue: false
  },
  environmentUrl: {
    label: 'Environment URL',
    type: 'url',
    placeholder: 'https://org.crm4.dynamics.com'
  },
  deployManaged: {
    label: 'Deploy the managed solution',
    type: 'checkbox',
    defaultValue: false
  },
  solutionZipPath: {
    label: 'Solution ZIP path',
    type: 'text',
    placeholder: String.raw`C:\Build\InspectionControl.zip`
  },
  publishChanges: {
    label: 'Publish changes after import',
    type: 'checkbox',
    defaultValue: true
  },
  force: {
    label: 'Skip the deployment confirmation',
    type: 'checkbox',
    defaultValue: false
  },
  outputDirectory: {
    label: 'Checker output folder',
    type: 'text',
    placeholder: String.raw`C:\Build\solution-check`
  },
  geo: {
    label: 'Checker geography',
    type: 'text',
    placeholder: 'Europe'
  },
  failOnLevel: {
    label: 'Fail on severity',
    type: 'select',
    options: [
      { value: 'Critical', label: 'Critical' },
      { value: 'High', label: 'High' },
      { value: 'Medium', label: 'Medium' },
      { value: 'Low', label: 'Low' },
      { value: 'Informational', label: 'Informational' }
    ],
    defaultValue: 'High'
  },
  failOnThreshold: {
    label: 'Allowed issue threshold',
    type: 'number',
    min: 0,
    step: 1,
    defaultValue: '0'
  }
};

export const PCF_SCRIPT_ACTIONS = [
  {
    value: 'initialise-project',
    label: 'Initialise a new PCF project',
    phase: 'create',
    scriptName: 'Initialize-NewPCFProject.ps1',
    fields: [
      'scriptsPath',
      'controlName',
      'publisherName',
      'publisherPrefix',
      'projectPath',
      'solutionUniqueName',
      'controlTemplate',
      'controlFramework',
      'solutionDescription'
    ],
    requiredFields: [
      'scriptsPath',
      'controlName',
      'publisherName',
      'publisherPrefix',
      'projectPath',
      'solutionUniqueName'
    ]
  },
  {
    value: 'environment-report',
    label: 'Check the PCF development environment',
    phase: 'develop',
    scriptName: 'Get-PCFDevEnvironmentReport.ps1',
    fields: ['scriptsPath'],
    requiredFields: ['scriptsPath']
  },
  {
    value: 'test-harness',
    label: 'Start the local test harness',
    phase: 'develop',
    scriptName: 'Start-PCFTestHarness.ps1',
    fields: ['scriptsPath', 'controlFolder'],
    requiredFields: ['scriptsPath', 'controlFolder'],
    workingDirectoryField: 'controlFolder'
  },
  {
    value: 'update-version',
    label: 'Increment the PCF and solution versions',
    phase: 'build',
    scriptName: 'Update-Version.ps1',
    fields: ['scriptsPath', 'projectRoot'],
    requiredFields: ['scriptsPath', 'projectRoot']
  },
  {
    value: 'build-and-deploy',
    label: 'Build, package and optionally deploy',
    phase: 'build',
    scriptName: 'Build-And-Deploy-PCF.ps1',
    fields: [
      'scriptsPath',
      'projectRoot',
      'incrementVersion',
      'buildConfiguration',
      'deploy',
      'environmentUrl',
      'deployManaged'
    ],
    requiredFields: ['scriptsPath', 'projectRoot']
  },
  {
    value: 'quick-deploy',
    label: 'Push a control for rapid testing',
    phase: 'deploy',
    scriptName: 'Push-PCFQuickDeploy.ps1',
    fields: ['scriptsPath', 'controlFolder', 'publisherPrefix', 'environmentUrl'],
    requiredFields: ['scriptsPath', 'controlFolder', 'publisherPrefix', 'environmentUrl'],
    workingDirectoryField: 'controlFolder'
  },
  {
    value: 'deploy-solution',
    label: 'Import a built solution',
    phase: 'deploy',
    scriptName: 'Deploy-Solution.ps1',
    fields: ['scriptsPath', 'solutionZipPath', 'environmentUrl', 'publishChanges', 'force'],
    requiredFields: ['scriptsPath', 'solutionZipPath', 'environmentUrl']
  },
  {
    value: 'solution-check',
    label: 'Run Solution Checker',
    phase: 'quality',
    scriptName: 'Invoke-SolutionCheck.ps1',
    fields: [
      'scriptsPath',
      'solutionZipPath',
      'outputDirectory',
      'geo',
      'failOnLevel',
      'failOnThreshold'
    ],
    requiredFields: ['scriptsPath', 'solutionZipPath', 'outputDirectory']
  }
];

const actionByValue = new Map(PCF_SCRIPT_ACTIONS.map(action => [action.value, action]));

export function getPcfActionsForPhase(phase) {
  return PCF_SCRIPT_ACTIONS.filter(action => action.phase === phase);
}

export function buildPcfScriptCommand(options = {}) {
  const action = actionByValue.get(options.action);

  if (!action) {
    throw new Error('Choose a supported PCF development action.');
  }

  const context = normaliseContext(action, options);
  validateContext(action, context);

  const parameters = buildParameters(action.value, context);
  const invocation = buildInvocation(action, context, parameters);
  const command = action.workingDirectoryField
    ? buildWorkingDirectoryCommand(context[action.workingDirectoryField], invocation)
    : invocation;
  const warnings = buildWarnings(action, context);
  const checklist = buildChecklist(action, context);
  const launcher = buildLauncher(action, context, parameters);

  return {
    action,
    actionLabel: action.label,
    phase: action.phase,
    phaseLabel: PCF_SCRIPT_PHASES[action.phase].label,
    scriptName: action.scriptName,
    command,
    launcher,
    launcherFilename: `${action.value}-launcher.ps1`,
    parameters,
    warnings,
    checklist,
    summary: {
      parameterCount: parameters.length,
      requiredFieldCount: action.requiredFields.length,
      warningCount: warnings.length
    }
  };
}

export function quotePowerShellArgument(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function normaliseContext(action, options) {
  return Object.fromEntries(action.fields.map(fieldName => {
    const definition = PCF_SCRIPT_FIELDS[fieldName];
    const supplied = options[fieldName];
    const fallback = definition.defaultValue ?? (definition.type === 'checkbox' ? false : '');
    const value = supplied === undefined ? fallback : supplied;

    if (definition.type === 'checkbox') {
      return [fieldName, Boolean(value)];
    }

    return [fieldName, String(value ?? '').trim()];
  }));
}

function validateContext(action, context) {
  const missing = action.requiredFields.filter(fieldName => !context[fieldName]);

  if (missing.length > 0) {
    throw new Error(`Enter ${formatFieldList(missing)} before building this PCF launcher.`);
  }

  action.fields.forEach(fieldName => {
    const value = context[fieldName];

    if (typeof value === 'string' && /[\r\n]/.test(value)) {
      throw new Error(`${PCF_SCRIPT_FIELDS[fieldName].label} must be a single line.`);
    }
  });

  if (context.controlName && !/^[A-Za-z][A-Za-z0-9]*$/.test(context.controlName)) {
    throw new Error('Control name must start with a letter and contain letters or numbers only.');
  }

  if (context.publisherPrefix && !/^[A-Za-z][A-Za-z0-9]*$/.test(context.publisherPrefix)) {
    throw new Error('Publisher prefix must start with a letter and contain letters or numbers only.');
  }

  if (context.solutionUniqueName && !/^[A-Za-z][A-Za-z0-9_]*$/.test(context.solutionUniqueName)) {
    throw new Error('Solution unique name must start with a letter and contain letters, numbers or underscores only.');
  }

  if (context.environmentUrl && !/^https:\/\/[^\s/]+(?:\/.*)?$/i.test(context.environmentUrl)) {
    throw new Error('Environment URL must be a valid HTTPS URL.');
  }

  if (action.value === 'build-and-deploy' && context.deploy && !context.environmentUrl) {
    throw new Error('Enter an environment URL when deployment is enabled.');
  }

  if (action.value === 'solution-check') {
    const threshold = Number(context.failOnThreshold);

    if (!Number.isInteger(threshold) || threshold < 0) {
      throw new Error('Allowed issue threshold must be a whole number of zero or more.');
    }
  }
}

function buildParameters(actionValue, context) {
  switch (actionValue) {
    case 'initialise-project':
      return compactParameters([
        valueParameter('ControlName', context.controlName),
        valueParameter('PublisherName', context.publisherName),
        valueParameter('PublisherPrefix', context.publisherPrefix),
        valueParameter('ProjectPath', context.projectPath),
        valueParameter('SolutionUniqueName', context.solutionUniqueName),
        valueParameter('ControlTemplate', context.controlTemplate),
        valueParameter('ControlFramework', context.controlFramework),
        optionalValueParameter('SolutionDescription', context.solutionDescription)
      ]);
    case 'environment-report':
    case 'test-harness':
      return [];
    case 'update-version':
      return [valueParameter('ProjectRoot', context.projectRoot)];
    case 'build-and-deploy':
      return compactParameters([
        valueParameter('ProjectRoot', context.projectRoot),
        switchParameter('IncrementVersion', context.incrementVersion),
        valueParameter('BuildConfiguration', context.buildConfiguration),
        switchParameter('Deploy', context.deploy),
        optionalValueParameter('EnvironmentUrl', context.deploy ? context.environmentUrl : ''),
        switchParameter('DeployManaged', context.deploy && context.deployManaged)
      ]);
    case 'quick-deploy':
      return [
        valueParameter('PublisherPrefix', context.publisherPrefix),
        valueParameter('EnvironmentUrl', context.environmentUrl)
      ];
    case 'deploy-solution':
      return compactParameters([
        valueParameter('SolutionZipPath', context.solutionZipPath),
        valueParameter('EnvironmentUrl', context.environmentUrl),
        booleanParameter('PublishChanges', context.publishChanges),
        switchParameter('Force', context.force)
      ]);
    case 'solution-check':
      return compactParameters([
        valueParameter('SolutionZipPath', context.solutionZipPath),
        valueParameter('OutputDirectory', context.outputDirectory),
        optionalValueParameter('Geo', context.geo),
        valueParameter('FailOnLevel', context.failOnLevel),
        numberParameter('FailOnThreshold', Number(context.failOnThreshold))
      ]);
    default:
      throw new Error('Choose a supported PCF development action.');
  }
}

function buildInvocation(action, context, parameters) {
  const scriptExpression = `(Join-Path ${quotePowerShellArgument(context.scriptsPath)} ${quotePowerShellArgument(action.scriptName)})`;
  const renderedParameters = parameters.map(renderInlineParameter);

  return ['&', scriptExpression, ...renderedParameters].join(' ');
}

function buildWorkingDirectoryCommand(workingDirectory, invocation) {
  return `Push-Location ${quotePowerShellArgument(workingDirectory)}; try { ${invocation} } finally { Pop-Location }`;
}

function buildLauncher(action, context, parameters) {
  const lines = [
    '# Generated by Developer Tools — PCF Development Hub',
    '# Review this file before running it in PowerShell.',
    '[CmdletBinding()]',
    'param()',
    '',
    "$ErrorActionPreference = 'Stop'",
    `$scriptPath = Join-Path ${quotePowerShellArgument(context.scriptsPath)} ${quotePowerShellArgument(action.scriptName)}`,
    'if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {',
    '  throw "Required PCF helper script not found: $scriptPath"',
    '}'
  ];

  if (parameters.length > 0) {
    lines.push('', '$parameters = [ordered]@{');
    parameters.forEach(parameter => {
      lines.push(`  ${parameter.name} = ${renderLauncherValue(parameter)}`);
    });
    lines.push('}');
  }

  const invocation = parameters.length > 0 ? '& $scriptPath @parameters' : '& $scriptPath';
  const workingDirectoryField = action.workingDirectoryField;

  if (workingDirectoryField) {
    lines.push(
      '',
      `Push-Location ${quotePowerShellArgument(context[workingDirectoryField])}`,
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

function buildChecklist(action, context) {
  const checklist = [
    `Confirm ${action.scriptName} is present in the selected PS Scripts folder.`,
    'Review the generated launcher before running it in a trusted PowerShell session.'
  ];

  if (action.value === 'initialise-project') {
    checklist.push('Confirm pac, Node.js, npm and the .NET SDK are installed.');
    checklist.push('Use a new project path or an empty control folder.');
  }

  if (action.workingDirectoryField) {
    checklist.push('Confirm the control source folder contains ControlManifest.Input.xml.');
  }

  if (['build-and-deploy', 'quick-deploy', 'deploy-solution'].includes(action.value)) {
    checklist.push('Confirm the active pac authentication profile and target environment before deployment.');
  }

  if (action.value === 'build-and-deploy' && !context.deploy) {
    checklist.push('Inspect the generated ZIP files in the selected build configuration folder.');
  }

  if (action.value === 'solution-check') {
    checklist.push('Keep the generated SARIF report with the build artefacts.');
  }

  return checklist;
}

function buildWarnings(action, context) {
  switch (action.value) {
    case 'initialise-project':
      return ['The helper script stops when the target control folder already contains files.'];
    case 'environment-report':
      return ['The attached report script documents a baseline option inside its function, but does not expose it as a script-level parameter. This launcher runs discovery only.'];
    case 'test-harness':
      return ['The test harness keeps running until it is stopped with Ctrl+C.'];
    case 'update-version':
      return ['This action modifies the solution manifest, control manifest and matching TypeScript version field. Review the Git diff afterwards.'];
    case 'build-and-deploy':
      return compactStrings([
        context.incrementVersion
          ? 'Version changes remain when a later build or deployment step fails.'
          : '',
        context.deploy
          ? `This action imports a ${context.deployManaged ? 'managed' : 'unmanaged'} solution into the selected environment.`
          : ''
      ]);
    case 'quick-deploy':
      return ['This launcher uses the existing pac authentication context. Service principal secrets are deliberately not added to generated files.'];
    case 'deploy-solution':
      return compactStrings([
        'This action imports a Dataverse solution and can change the target environment.',
        context.force ? 'The Force option skips the script confirmation prompt.' : ''
      ]);
    case 'solution-check':
      return ['Solution Checker uses the configured pac context and fails the command when the selected severity threshold is exceeded.'];
    default:
      return [];
  }
}

function valueParameter(name, value) {
  return { name, kind: 'value', value };
}

function optionalValueParameter(name, value) {
  return value ? valueParameter(name, value) : null;
}

function switchParameter(name, enabled) {
  return enabled ? { name, kind: 'switch', value: true } : null;
}

function booleanParameter(name, value) {
  return { name, kind: 'boolean', value: Boolean(value) };
}

function numberParameter(name, value) {
  return { name, kind: 'number', value };
}

function compactParameters(parameters) {
  return parameters.filter(Boolean);
}

function compactStrings(values) {
  return values.filter(Boolean);
}

function renderInlineParameter(parameter) {
  if (parameter.kind === 'switch') {
    return `-${parameter.name}`;
  }

  if (parameter.kind === 'boolean') {
    return `-${parameter.name}:$${parameter.value ? 'true' : 'false'}`;
  }

  if (parameter.kind === 'number') {
    return `-${parameter.name} ${parameter.value}`;
  }

  return `-${parameter.name} ${quotePowerShellArgument(parameter.value)}`;
}

function renderLauncherValue(parameter) {
  if (parameter.kind === 'switch' || parameter.kind === 'boolean') {
    return `$${parameter.value ? 'true' : 'false'}`;
  }

  if (parameter.kind === 'number') {
    return String(parameter.value);
  }

  return quotePowerShellArgument(parameter.value);
}

function formatFieldList(fields) {
  const labels = fields.map(fieldName => PCF_SCRIPT_FIELDS[fieldName].label.toLowerCase());

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}
