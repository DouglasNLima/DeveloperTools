import { writeTextToClipboard } from './clipboard-feedback.js';
import { renderToolWorkbench } from './workbench.js';
import { loadScriptTemplate } from './script-hub-assets.js';
import {
  SCRIPT_MATURITY,
  SCRIPT_RUNTIME,
  SCRIPT_RUNTIME_LABELS,
  SCRIPT_SAFETY_LABELS,
  generateScript,
  getScriptCategories,
  getScriptById,
  getScriptsForFamily
} from './script-hub.js';

const HUB_MODES = [
  {
    id: 'development',
    label: 'Development',
    summary: 'Create, develop, build, deploy and quality-check PCF projects.'
  },
  {
    id: 'investigation',
    label: 'Investigation',
    summary: 'Prepare Power Platform diagnostics and Dynamics / Dataverse forensic evidence.'
  },
  {
    id: 'power-pages',
    label: 'Power Pages',
    summary: 'Prepare site discovery, backup, synchronisation and comparison workflows.'
  }
];

const LEGACY_PCF_MODE_ACTIONS = {
  create: 'initialise-project',
  develop: 'environment-report',
  build: 'build-and-deploy',
  deploy: 'quick-deploy',
  quality: 'solution-check'
};

export function renderPowerPlatformScriptHub(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: HUB_MODES.map(mode => ({
      ...mode,
      renderer: renderScriptFamily
    }))
  });
}

function renderScriptFamily(container, context = {}) {
  const scripts = getScriptsForFamily(context.mode);
  let selectedScript = chooseInitialScript(scripts, context.legacyMode);
  let fieldControls = {};
  let savedValues = {};
  let currentObjectUrl = null;
  let generationNumber = 0;

  container.innerHTML = `
    <section class="tool-board script-hub-tool" data-script-hub-family="${context.mode}">
      <section class="script-hub-boundary" aria-label="How the Power Platform Script Hub works">
        <strong>Prepared here, run by you</strong>
        <p>Developer Tools validates documented inputs and prepares a command or browser script. It never executes PowerShell, PAC CLI commands or Dataverse investigations, and it never sends or stores credentials.</p>
      </section>

      <div class="form-grid form-grid--actions script-hub-selector-row">
        <div class="field-stack">
          <label for="scriptHubScript">Script or workflow</label>
          <select id="scriptHubScript"></select>
        </div>
        <div class="button-row button-row--end">
          <button id="generateScriptHubOutput" class="primary" type="button">Generate output</button>
          <button id="clearScriptHubOutput" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <p id="scriptHubFamilySummary" class="hint"></p>
      <section id="scriptHubScriptSummary" class="script-hub-script-summary" aria-live="polite"></section>
      <div id="scriptHubInputFields" class="script-hub-input-grid"></div>

      <section id="scriptHubDetails" class="script-hub-details" aria-labelledby="scriptHubDetailsTitle">
        <div class="script-hub-section-heading">
          <p class="eyebrow">Script details</p>
          <h2 id="scriptHubDetailsTitle">Review before generation</h2>
        </div>
        <div class="script-hub-info-grid">
          <article class="script-hub-info-card"><span>What it does</span><p id="scriptHubPurpose"></p></article>
          <article class="script-hub-info-card"><span>When to use it</span><p id="scriptHubApplicability"></p></article>
          <article class="script-hub-info-card"><span>Runtime</span><p id="scriptHubRuntime"></p></article>
          <article class="script-hub-info-card"><span>Version</span><p id="scriptHubVersion"></p></article>
          <article class="script-hub-info-card"><span>Maturity</span><p id="scriptHubMaturity"></p></article>
          <article class="script-hub-info-card"><span>Safety</span><div id="scriptHubSafety" class="script-hub-safety-list"></div></article>
          <article class="script-hub-info-card"><span>Inputs</span><div id="scriptHubInputSummary"></div></article>
          <article class="script-hub-info-card"><span>Outputs</span><div id="scriptHubOutputSummary"></div></article>
          <article class="script-hub-info-card"><span>Prerequisites</span><div id="scriptHubPrerequisites"></div></article>
          <article class="script-hub-info-card"><span>Limitations</span><div id="scriptHubLimitations"></div></article>
        </div>
      </section>

      <section id="scriptHubPowerShellOutput" class="script-hub-output-panel" hidden>
        <div class="output-toolbar">
          <label for="scriptHubCommandOutput">PowerShell command</label>
          <div class="button-row">
            <button id="copyScriptHubCommand" class="primary" type="button" disabled>Copy command</button>
          </div>
        </div>
        <textarea id="scriptHubCommandOutput" class="script-hub-command-output" spellcheck="false" readonly placeholder="The validated PowerShell command will appear here."></textarea>
        <div class="field-stack">
          <label for="scriptHubLauncherOutput">Launcher preview</label>
          <div class="output-toolbar output-toolbar--subtle">
            <span class="hint">Review the .ps1 launcher before running it.</span>
            <div class="button-row">
              <button id="copyScriptHubLauncher" class="secondary" type="button" disabled>Copy launcher</button>
            </div>
          </div>
          <textarea id="scriptHubLauncherOutput" class="script-hub-launcher-output" spellcheck="false" readonly placeholder="The downloadable .ps1 launcher will appear here."></textarea>
        </div>
      </section>

      <section id="scriptHubBrowserOutput" class="script-hub-output-panel" hidden>
        <div class="output-toolbar">
          <label for="scriptHubScriptOutput">Browser-console script</label>
          <div class="button-row">
            <button id="copyScriptHubScript" class="primary" type="button" disabled>Copy script</button>
          </div>
        </div>
        <textarea id="scriptHubScriptOutput" class="script-hub-script-output" spellcheck="false" readonly placeholder="The reviewed browser-console script will appear here."></textarea>
      </section>

      <div class="script-hub-output-actions">
        <a id="downloadScriptHubOutput" class="button secondary" href="#" download hidden>Download output</a>
      </div>

      <div id="scriptHubPreview" class="builder-preview" aria-live="polite"></div>
      <div class="detail-grid script-hub-result-details" aria-live="polite">
        <div class="detail-card"><span>Script</span><strong id="scriptHubScriptDetail">-</strong></div>
        <div class="detail-card"><span>Parameters</span><strong id="scriptHubParametersDetail">-</strong></div>
        <div class="detail-card"><span>Warnings</span><strong id="scriptHubWarningsDetail">-</strong></div>
      </div>
      <div id="scriptHubStatus" class="status-message" role="status" aria-live="polite">Select a script, review its safety and provide only its documented inputs.</div>
    </section>
  `;

  const familySummary = container.querySelector('#scriptHubFamilySummary');
  const scriptSelect = container.querySelector('#scriptHubScript');
  const scriptSummary = container.querySelector('#scriptHubScriptSummary');
  const inputFields = container.querySelector('#scriptHubInputFields');
  const generateButton = container.querySelector('#generateScriptHubOutput');
  const clearButton = container.querySelector('#clearScriptHubOutput');
  const powerShellOutput = container.querySelector('#scriptHubPowerShellOutput');
  const browserOutput = container.querySelector('#scriptHubBrowserOutput');
  const commandOutput = container.querySelector('#scriptHubCommandOutput');
  const launcherOutput = container.querySelector('#scriptHubLauncherOutput');
  const scriptOutput = container.querySelector('#scriptHubScriptOutput');
  const copyCommandButton = container.querySelector('#copyScriptHubCommand');
  const copyLauncherButton = container.querySelector('#copyScriptHubLauncher');
  const copyScriptButton = container.querySelector('#copyScriptHubScript');
  const downloadButton = container.querySelector('#downloadScriptHubOutput');
  const preview = container.querySelector('#scriptHubPreview');
  const status = container.querySelector('#scriptHubStatus');
  const resultDetails = {
    script: container.querySelector('#scriptHubScriptDetail'),
    parameters: container.querySelector('#scriptHubParametersDetail'),
    warnings: container.querySelector('#scriptHubWarningsDetail')
  };

  familySummary.textContent = `${scripts.length} script${scripts.length === 1 ? '' : 's'} available in this family. Select one to review its documented inputs and safety implications.`;
  renderScriptOptions();
  renderSelectedScript();

  function renderScriptOptions() {
    scriptSelect.innerHTML = '';
    getScriptCategories(context.mode).forEach(category => {
      const group = document.createElement('optgroup');
      group.label = category;
      scripts
        .filter(script => script.category === category)
        .forEach(script => {
          const option = document.createElement('option');
          option.value = script.id;
          option.textContent = `${script.title} — ${SCRIPT_RUNTIME_LABELS[script.runtime]}`;
          group.append(option);
        });
      scriptSelect.append(group);
    });
    scriptSelect.value = selectedScript.id;
  }

  function renderSelectedScript(resetValues = false) {
    selectedScript = getScriptById(scriptSelect.value) || scripts[0];
    if (resetValues) {
      savedValues = {};
    }
    resetOutput();
    renderScriptSummary();
    renderInputFields(!resetValues);
    renderScriptDetails();
    setStatus('Review the details and provide the documented inputs before generating output.');
  }

  function renderScriptSummary() {
    scriptSummary.innerHTML = '';
    const title = document.createElement('h2');
    title.textContent = selectedScript.title;
    const description = document.createElement('p');
    description.textContent = selectedScript.description;
    const source = document.createElement('small');
    source.textContent = `Source: ${selectedScript.source.package} · ${selectedScript.source.name}`;
    scriptSummary.append(title, description, source);
  }

  function renderInputFields(preserveValues = true) {
    if (preserveValues) {
      saveCurrentValues();
    }
    inputFields.innerHTML = '';
    fieldControls = {};
    const values = getInitialValues();

    selectedScript.inputs.forEach(input => {
      if (input.runtimePrompt) {
        const runtimeNote = document.createElement('div');
        runtimeNote.className = 'script-hub-runtime-note';
        runtimeNote.textContent = `${input.label} is collected securely when the generated launcher runs. Developer Tools never asks for or stores the token.`;
        inputFields.append(runtimeNote);
        return;
      }

      if (!isInputVisible(input, values)) {
        return;
      }

      const field = createInputField(input, values[input.id]);
      inputFields.append(field.wrapper);
      fieldControls[input.id] = field.control;
    });

    inputFields.classList.toggle('script-hub-input-grid--single', inputFields.childElementCount === 1);
    updateDependentFields();
  }

  function createInputField(input, value) {
    if (input.type === 'checkbox') {
      const row = document.createElement('label');
      row.className = 'checkbox-row script-hub-checkbox-row';
      const control = document.createElement('input');
      control.type = 'checkbox';
      control.checked = Boolean(value);
      control.dataset.scriptField = input.id;
      row.append(control, document.createTextNode(input.label));
      if (input.help) {
        const help = document.createElement('small');
        help.className = 'script-hub-field-help';
        help.textContent = input.help;
        row.append(help);
      }
      return { wrapper: row, control };
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'field-stack';
    const label = document.createElement('label');
    label.textContent = input.label;
    const control = input.type === 'textarea'
      ? document.createElement('textarea')
      : input.type === 'select'
        ? document.createElement('select')
        : document.createElement('input');

    if (input.type === 'select') {
      input.options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        control.append(optionElement);
      });
    } else if (input.type !== 'textarea') {
      control.type = input.type || 'text';
      control.spellcheck = false;
    }

    const controlId = `scriptHub${input.id.charAt(0).toUpperCase()}${input.id.slice(1)}`;
    control.id = controlId;
    control.dataset.scriptField = input.id;
    control.value = input.type === 'checkbox' ? undefined : value ?? '';
    label.htmlFor = controlId;
    wrapper.append(label, control);

    if (input.placeholder) {
      control.placeholder = input.placeholder;
    }
    if (input.min !== undefined) {
      control.min = String(input.min);
    }
    if (input.max !== undefined) {
      control.max = String(input.max);
    }
    if (input.step !== undefined) {
      control.step = String(input.step);
    }
    if (input.maxLength !== undefined) {
      control.maxLength = input.maxLength;
    }
    if (input.help) {
      const help = document.createElement('small');
      help.className = 'script-hub-field-help';
      help.textContent = input.help;
      wrapper.append(help);
    }

    return { wrapper, control };
  }

  function saveCurrentValues() {
    Object.entries(fieldControls).forEach(([fieldId, control]) => {
      savedValues[fieldId] = control.type === 'checkbox' ? control.checked : control.value;
    });
  }

  function getInitialValues() {
    const values = { ...savedValues };
    selectedScript.inputs.forEach(input => {
      if (values[input.id] === undefined && input.defaultValue !== undefined) {
        values[input.id] = input.defaultValue;
      }
      if (values[input.id] === undefined && input.type === 'checkbox') {
        values[input.id] = false;
      }
    });
    return values;
  }

  function readValues() {
    saveCurrentValues();
    return { ...getInitialValues(), ...savedValues };
  }

  function updateDependentFields() {
    const values = readValues();
    Object.entries(fieldControls).forEach(([fieldId, control]) => {
      const input = selectedScript.inputs.find(candidate => candidate.id === fieldId);
      if (input?.disabledWhen) {
        control.disabled = Boolean(input.disabledWhen(values));
      }
    });
  }

  function renderScriptDetails() {
    container.querySelector('#scriptHubPurpose').textContent = selectedScript.description;
    container.querySelector('#scriptHubApplicability').textContent = selectedScript.applicability;
    container.querySelector('#scriptHubRuntime').textContent = SCRIPT_RUNTIME_LABELS[selectedScript.runtime];
    container.querySelector('#scriptHubVersion').textContent = `${selectedScript.version} · source ${selectedScript.source.lineCount.toLocaleString('en-GB')} lines`;
    const maturity = container.querySelector('#scriptHubMaturity');
    maturity.textContent = selectedScript.maturity;
    maturity.className = `script-hub-maturity script-hub-maturity--${selectedScript.maturity === SCRIPT_MATURITY.FIELD_TESTED ? 'field-tested' : 'experimental'}`;

    renderList(container.querySelector('#scriptHubSafety'), selectedScript.safety.map(safety => SCRIPT_SAFETY_LABELS[safety]), 'script-hub-safety-item');
    const requiredAlternativeIds = new Set((selectedScript.requiredAny || []).flat());
    renderList(container.querySelector('#scriptHubInputSummary'), selectedScript.inputs.map(input => `${input.label} — ${getInputRequirementLabel(input, requiredAlternativeIds)}`));
    renderList(container.querySelector('#scriptHubOutputSummary'), selectedScript.outputs);
    renderList(container.querySelector('#scriptHubPrerequisites'), selectedScript.prerequisites);
    renderList(container.querySelector('#scriptHubLimitations'), selectedScript.limitations);
  }

  function renderList(parent, values, itemClass = '') {
    parent.innerHTML = '';
    if (values.length === 0) {
      parent.textContent = 'None documented.';
      return;
    }
    const list = document.createElement('ul');
    if (itemClass) {
      list.className = itemClass;
    }
    values.forEach(value => {
      const item = document.createElement('li');
      item.textContent = value;
      list.append(item);
    });
    parent.append(list);
  }

  function resetOutput() {
    generationNumber += 1;
    commandOutput.value = '';
    launcherOutput.value = '';
    scriptOutput.value = '';
    powerShellOutput.hidden = true;
    browserOutput.hidden = true;
    copyCommandButton.disabled = true;
    copyLauncherButton.disabled = true;
    copyScriptButton.disabled = true;
    resultDetails.script.textContent = '-';
    resultDetails.parameters.textContent = '-';
    resultDetails.warnings.textContent = '-';
    preview.innerHTML = '';
    revokeObjectUrl();
  }

  function revokeObjectUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    downloadButton.hidden = true;
    downloadButton.removeAttribute('href');
  }

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  async function generateOutput() {
    const requestNumber = ++generationNumber;
    const values = readValues();
    generateButton.disabled = true;
    setStatus('Validating inputs and preparing the local output.');

    try {
      const template = selectedScript.runtime === SCRIPT_RUNTIME.POWERSHELL_HELPER
        ? ''
        : await loadScriptTemplate(selectedScript.id);
      const result = generateScript({
        script: selectedScript,
        values,
        template
      });

      if (requestNumber !== generationNumber) {
        return;
      }

      setOutput(result);
      const warning = result.warnings[0];
      setStatus(
        warning
          ? `Output generated successfully. ${warning}`
          : 'Output generated successfully. Review it before running it manually.',
        warning ? 'warning' : 'success'
      );
    } catch (error) {
      resetOutput();
      resultDetails.script.textContent = 'Invalid';
      setStatus(error.message || 'Unable to generate the selected output.', 'error');
    } finally {
      generateButton.disabled = false;
    }
  }

  function setOutput(result) {
    resetOutput();
    resultDetails.script.textContent = result.scriptName;
    resultDetails.parameters.textContent = result.summary.parameterCount.toLocaleString('en-GB');
    resultDetails.warnings.textContent = result.warnings.length === 0
      ? 'None'
      : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;

    if (result.runtime === SCRIPT_RUNTIME.POWERSHELL_HELPER) {
      powerShellOutput.hidden = false;
      commandOutput.value = result.command;
      launcherOutput.value = result.launcher;
      copyCommandButton.disabled = false;
      copyLauncherButton.disabled = false;
      prepareDownload(result.launcher, result.launcherFilename);
    } else {
      browserOutput.hidden = false;
      scriptOutput.value = result.script;
      copyScriptButton.disabled = false;
      prepareDownload(result.script, result.filename);
    }

    renderPreview(result);
  }

  function prepareDownload(content, filename) {
    revokeObjectUrl();
    currentObjectUrl = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    downloadButton.href = currentObjectUrl;
    downloadButton.download = filename;
    downloadButton.textContent = `Download ${filename}`;
    downloadButton.hidden = false;
  }

  function renderPreview(result) {
    preview.innerHTML = '';
    [
      ['Run checklist', result.checklist.join('\n')],
      ['Review before running', result.warnings.join('\n') || 'No additional warnings.']
    ].forEach(([label, value]) => {
      const card = document.createElement('article');
      card.className = 'builder-card';
      const title = document.createElement('span');
      title.textContent = label;
      const content = document.createElement('code');
      content.textContent = value;
      card.append(title, content);
      preview.append(card);
    });
  }

  async function copyOutput(output, trigger, emptyMessage, successMessage) {
    if (!output.value || trigger.disabled) {
      setStatus(emptyMessage, 'error');
      return;
    }

    try {
      await writeTextToClipboard(output.value, { trigger });
      setStatus(successMessage, 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus(`${successMessage} Browser fallback used.`, 'success');
    }
  }

  scriptSelect.addEventListener('change', () => {
    savedValues = {};
    renderSelectedScript(true);
  });
  inputFields.addEventListener('change', () => {
    const visibleBefore = getVisibleInputIds(getInitialValues(), selectedScript.inputs).join('|');
    saveCurrentValues();
    const visibleAfter = getVisibleInputIds(getInitialValues(), selectedScript.inputs).join('|');
    if (visibleBefore !== visibleAfter) {
      renderInputFields();
    } else {
      updateDependentFields();
    }
  });
  generateButton.addEventListener('click', generateOutput);
  clearButton.addEventListener('click', () => {
    savedValues = {};
    renderSelectedScript(true);
    inputFields.querySelector('input, select, textarea')?.focus();
    setStatus('Script Hub fields cleared.');
  });
  copyCommandButton.addEventListener('click', () => copyOutput(
    commandOutput,
    copyCommandButton,
    'There is no PowerShell command to copy.',
    'PowerShell command copied to the clipboard.'
  ));
  copyLauncherButton.addEventListener('click', () => copyOutput(
    launcherOutput,
    copyLauncherButton,
    'There is no PowerShell launcher to copy.',
    'PowerShell launcher copied to the clipboard.'
  ));
  copyScriptButton.addEventListener('click', () => copyOutput(
    scriptOutput,
    copyScriptButton,
    'There is no browser script to copy.',
    'Browser script copied to the clipboard.'
  ));

  return () => revokeObjectUrl();
}

function chooseInitialScript(scripts, legacyMode = '') {
  const legacyAction = LEGACY_PCF_MODE_ACTIONS[legacyMode];
  return legacyAction
    ? scripts.find(script => script.legacyAction === legacyAction) || scripts[0]
    : scripts[0];
}

function isInputVisible(input, values) {
  const condition = typeof input.when !== 'function' || input.when(values);
  const included = typeof input.includeWhen !== 'function' || input.includeWhen(values);
  return condition && included;
}

function getVisibleInputIds(values, inputs = []) {
  return inputs
    .filter(input => !input.runtimePrompt && isInputVisible(input, values))
    .map(input => input.id);
}

function getInputRequirementLabel(input, requiredAlternativeIds) {
  if (input.runtimePrompt) {
    return 'asked at run time';
  }
  if (input.required) {
    return 'required';
  }
  if (typeof input.requiredWhen === 'function') {
    return 'required when applicable';
  }
  if (requiredAlternativeIds.has(input.id)) {
    return 'one of these is required';
  }
  return 'optional';
}
