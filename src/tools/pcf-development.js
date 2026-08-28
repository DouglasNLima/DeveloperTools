import {
  SCRIPT_CATALOGUE,
  SCRIPT_FIELDS,
  generateScript,
  getScriptById,
  quotePowerShellArgument
} from './script-hub.js';

export const PCF_SCRIPT_PHASES = {
  create: {
    label: 'Create',
    summary: 'Initialise a control, solution project or new PCF identity.'
  },
  develop: {
    label: 'Develop',
    summary: 'Inspect local prerequisites or start the PCF test harness.'
  },
  build: {
    label: 'Version & build',
    summary: 'Synchronise versions, validate release inputs and build a PCF package.'
  },
  deploy: {
    label: 'Deploy',
    summary: 'Prepare an explicit PCF push or solution import.'
  },
  quality: {
    label: 'Quality',
    summary: 'Validate the PCF tooling, project, artefacts or Solution Checker output.'
  }
};

const pcfDefinitions = SCRIPT_CATALOGUE.filter(script => script.legacyAction);

export const PCF_SCRIPT_FIELDS = Object.fromEntries(
  [...new Map(
    pcfDefinitions
      .flatMap(script => script.inputs)
      .filter(input => input.id !== 'scriptsPath' || input.required)
      .map(input => [input.id, input])
  ).entries()]
);

const pcfActionDetails = [
  ['initialise-project', 'Initialise a new PCF project', 'create', 'pcf-initialise-project'],
  ['environment-report', 'Inspect the PCF development environment', 'develop', 'pcf-environment-report'],
  ['test-harness', 'Start the PCF test harness', 'develop', 'pcf-test-harness'],
  ['update-version', 'Synchronise PCF and solution versions', 'build', 'pcf-update-version'],
  ['build-and-deploy', 'Build, package and optionally deploy', 'build', 'pcf-build-deploy'],
  ['quick-deploy', 'Push a PCF control for rapid testing', 'deploy', 'pcf-quick-deploy'],
  ['deploy-solution', 'Import a PCF solution', 'deploy', 'pcf-deploy-solution'],
  ['solution-check', 'Run Solution Checker', 'quality', 'pcf-solution-check']
];

export const PCF_SCRIPT_ACTIONS = pcfActionDetails.map(([value, label, phase, scriptId]) => {
  const script = getScriptById(scriptId);
  const fields = script.inputs.map(input => input.id);

  return {
    value,
    label,
    phase,
    scriptId,
    scriptName: script.scriptName,
    fields,
    requiredFields: script.inputs
      .filter(input => input.required)
      .map(input => input.id),
    workingDirectoryField: script.workingDirectoryField
  };
});

const actionByValue = new Map(PCF_SCRIPT_ACTIONS.map(action => [action.value, action]));

export function getPcfActionsForPhase(phase) {
  return PCF_SCRIPT_ACTIONS.filter(action => action.phase === phase);
}

export function buildPcfScriptCommand(options = {}) {
  const action = actionByValue.get(options.action);

  if (!action) {
    throw new Error('Choose a supported PCF development action.');
  }

  const values = { ...options };

  // Keep the old JavaScript API useful for callers that supplied the former
  // controlFolder value while following the authoritative quick-deploy
  // script's mandatory ProjectRoot parameter.
  if (action.value === 'quick-deploy' && !values.projectRoot && values.controlFolder) {
    values.projectRoot = values.controlFolder;
  }

  const result = generateScript({
    scriptId: action.scriptId,
    values
  });

  return {
    ...result,
    action,
    actionLabel: action.label,
    phase: action.phase,
    phaseLabel: PCF_SCRIPT_PHASES[action.phase].label,
    scriptName: action.scriptName
  };
}

export { SCRIPT_FIELDS, quotePowerShellArgument };
