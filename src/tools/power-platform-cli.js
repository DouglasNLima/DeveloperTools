import { formatBytes } from './base64.js';

const DEFAULT_ACTION = 'auth-create';

export const POWER_PLATFORM_CLI_ACTIONS = [
  {
    value: 'auth-create',
    label: 'Create authentication profile',
    group: 'Authentication',
    requiredFields: ['environmentUrl']
  },
  {
    value: 'auth-list',
    label: 'List authentication profiles',
    group: 'Authentication',
    requiredFields: []
  },
  {
    value: 'solution-export',
    label: 'Export solution',
    group: 'Solutions',
    requiredFields: ['solutionName', 'path']
  },
  {
    value: 'solution-import',
    label: 'Import solution',
    group: 'Solutions',
    requiredFields: ['path']
  },
  {
    value: 'solution-pack',
    label: 'Pack solution',
    group: 'Solutions',
    requiredFields: ['path', 'folder']
  },
  {
    value: 'solution-unpack',
    label: 'Unpack solution',
    group: 'Solutions',
    requiredFields: ['path', 'folder']
  },
  {
    value: 'solution-check',
    label: 'Run solution checker',
    group: 'Solutions',
    requiredFields: ['path']
  },
  {
    value: 'powerpages-download',
    label: 'Download Power Pages site',
    group: 'Power Pages',
    requiredFields: ['folder', 'websiteId']
  },
  {
    value: 'powerpages-upload',
    label: 'Upload Power Pages site',
    group: 'Power Pages',
    requiredFields: ['folder']
  }
];

const actionByValue = new Map(POWER_PLATFORM_CLI_ACTIONS.map(action => [action.value, action]));

export function buildPowerPlatformCliCommand(options = {}) {
  const action = getAction(options.action);
  const context = normaliseContext(options);

  validateActionContext(action, context);

  const tokens = buildCommandTokens(action.value, context);
  const command = tokens.map(quoteCliArgument).join(' ');
  const checklist = buildChecklist(action, context);
  const warnings = buildWarnings(action, context);
  const output = formatCliReport({
    action,
    command,
    checklist,
    warnings
  });
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    action,
    actionLabel: action.label,
    actionGroup: action.group,
    command,
    tokens,
    checklist,
    warnings,
    output,
    outputType: 'Power Platform CLI command',
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    summary: {
      argumentCount: Math.max(tokens.length - 2, 0),
      requiredFieldCount: action.requiredFields.length,
      checklistCount: checklist.length
    }
  };
}

export function quoteCliArgument(value) {
  const text = String(value ?? '');

  if (text === '') {
    return '""';
  }

  if (/^[A-Za-z0-9._:/\\@{}=-]+$/.test(text)) {
    return text;
  }

  return `"${text.replace(/`/g, '``').replace(/"/g, '`"')}"`;
}

export function normalisePath(value) {
  return String(value ?? '').trim();
}

function getAction(value) {
  const action = actionByValue.get(value || DEFAULT_ACTION);

  if (!action) {
    throw new Error('Choose a supported Power Platform CLI command.');
  }

  return action;
}

function normaliseContext(options) {
  return {
    environmentUrl: normaliseText(options.environmentUrl),
    solutionName: normaliseText(options.solutionName),
    path: normalisePath(options.path),
    folder: normalisePath(options.folder),
    websiteId: normaliseText(options.websiteId),
    packageType: normalisePackageType(options.packageType),
    managed: Boolean(options.managed),
    async: Boolean(options.async),
    forceOverwrite: Boolean(options.forceOverwrite),
    deviceCode: Boolean(options.deviceCode),
    outputDirectory: normalisePath(options.outputDirectory)
  };
}

function validateActionContext(action, context) {
  const missing = action.requiredFields.filter(field => !context[field]);

  if (missing.length > 0) {
    throw new Error(`Enter ${formatFieldList(missing)} before building this pac command.`);
  }

  if (context.environmentUrl && !/^https?:\/\/[^\s]+$/i.test(context.environmentUrl)) {
    throw new Error('Environment URL must start with http:// or https://.');
  }

  if (context.websiteId && !/^[A-Za-z0-9{}-]+$/.test(context.websiteId)) {
    throw new Error('Website ID should be a GUID or a plain identifier without spaces.');
  }
}

function buildCommandTokens(actionValue, context) {
  switch (actionValue) {
    case 'auth-create':
      return [
        'pac',
        'auth',
        'create',
        '--environment',
        context.environmentUrl,
        ...(context.deviceCode ? ['--deviceCode'] : [])
      ];
    case 'auth-list':
      return ['pac', 'auth', 'list'];
    case 'solution-export':
      return [
        'pac',
        'solution',
        'export',
        '--name',
        context.solutionName,
        '--path',
        context.path,
        ...(context.managed ? ['--managed', 'true'] : []),
        ...(context.async ? ['--async'] : [])
      ];
    case 'solution-import':
      return [
        'pac',
        'solution',
        'import',
        '--path',
        context.path,
        ...(context.async ? ['--async'] : []),
        ...(context.forceOverwrite ? ['--force-overwrite'] : [])
      ];
    case 'solution-pack':
      return [
        'pac',
        'solution',
        'pack',
        '--zipfile',
        context.path,
        '--folder',
        context.folder,
        '--packagetype',
        context.packageType
      ];
    case 'solution-unpack':
      return [
        'pac',
        'solution',
        'unpack',
        '--zipfile',
        context.path,
        '--folder',
        context.folder,
        '--packagetype',
        context.packageType
      ];
    case 'solution-check':
      return [
        'pac',
        'solution',
        'check',
        '--path',
        context.path,
        ...(context.outputDirectory ? ['--outputDirectory', context.outputDirectory] : [])
      ];
    case 'powerpages-download':
      return [
        'pac',
        'pages',
        'download',
        '--path',
        context.folder,
        '--webSiteId',
        context.websiteId,
        ...(context.environmentUrl ? ['--environment', context.environmentUrl] : [])
      ];
    case 'powerpages-upload':
      return [
        'pac',
        'pages',
        'upload',
        '--path',
        context.folder,
        ...(context.environmentUrl ? ['--environment', context.environmentUrl] : [])
      ];
    default:
      throw new Error('Choose a supported Power Platform CLI command.');
  }
}

function buildChecklist(action, context) {
  const checklist = [
    'Confirm the Power Platform CLI is installed and available as pac.',
    'Confirm the selected authentication profile points at the intended tenant and environment.'
  ];

  if (action.group === 'Solutions') {
    checklist.push('Commit or back up solution source before packing, importing or exporting.');
    checklist.push('Use the same managed/unmanaged intent as the target ALM stage.');
  }

  if (action.group === 'Power Pages') {
    checklist.push('Confirm the Power Pages site ID and environment before uploading local site content.');
    checklist.push('Use the current pac pages command group; older powerpages and paportal aliases can appear in legacy notes.');
    checklist.push('Review generated site metadata before committing it to source control.');
  }

  if (context.outputDirectory) {
    checklist.push('Review solution checker output before sharing or importing the package.');
  }

  return checklist;
}

function buildWarnings(action, context) {
  const warnings = [];

  if (context.environmentUrl && !context.environmentUrl.toLowerCase().startsWith('https://')) {
    warnings.push('Use HTTPS environment URLs for real tenant work.');
  }

  if (action.value === 'solution-export' && context.managed) {
    warnings.push('Managed exports are usually for downstream deployment, not source customisation.');
  }

  if (action.value === 'solution-import' && context.forceOverwrite) {
    warnings.push('Force overwrite can replace unmanaged customisations in the target environment.');
  }

  if (action.value === 'solution-check' && !context.outputDirectory) {
    warnings.push('Add an output directory when you want to keep solution checker reports.');
  }

  if (action.group === 'Power Pages' && !context.environmentUrl) {
    warnings.push('Power Pages commands will use the active pac authentication context when no environment is supplied.');
  }

  return warnings;
}

function formatCliReport(report) {
  return [
    '# Power Platform CLI command',
    '',
    `Command: ${report.action.label}`,
    `Group: ${report.action.group}`,
    '',
    '```sh',
    report.command,
    '```',
    '',
    '## Checklist',
    ...report.checklist.map(item => `- ${item}`),
    ...formatWarnings(report.warnings)
  ].join('\n');
}

function formatWarnings(warnings) {
  if (warnings.length === 0) {
    return [];
  }

  return [
    '',
    '## Warnings',
    ...warnings.map(warning => `- ${warning}`)
  ];
}

function formatFieldList(fields) {
  const labels = fields.map(field => {
    const fieldLabels = {
      environmentUrl: 'an environment URL',
      solutionName: 'a solution name',
      path: 'a file path',
      folder: 'a folder path',
      websiteId: 'a Power Pages site ID'
    };

    return fieldLabels[field] || field;
  });

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

function normaliseText(value) {
  return String(value ?? '').trim();
}

function normalisePackageType(value) {
  const packageType = normaliseText(value) || 'Unmanaged';
  const supported = ['Unmanaged', 'Managed', 'Both'];
  const match = supported.find(item => item.toLowerCase() === packageType.toLowerCase());

  if (!match) {
    throw new Error('Package type must be Unmanaged, Managed or Both.');
  }

  return match;
}
