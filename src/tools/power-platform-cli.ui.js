import { POWER_PLATFORM_CLI_ACTIONS, buildPowerPlatformCliCommand } from './power-platform-cli.js';

export function renderPowerPlatformCliCommandBuilder(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="pacAction">Command</label>
          <select id="pacAction">
            ${POWER_PLATFORM_CLI_ACTIONS.map(action => `<option value="${action.value}">${action.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="pacEnvironmentUrl">Environment URL</label>
          <input id="pacEnvironmentUrl" type="text" spellcheck="false" placeholder="https://org.crm4.dynamics.com" />
        </div>

        <div class="button-row button-row--end">
          <button id="buildPacCommandButton" class="primary" type="button">Build command</button>
          <button id="clearPacCommandButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="pacSolutionName">Solution name</label>
          <input id="pacSolutionName" type="text" spellcheck="false" placeholder="contoso_core" />
        </div>

        <div class="field-stack">
          <label for="pacPath">Zip or file path</label>
          <input id="pacPath" type="text" spellcheck="false" placeholder="dist/contoso_core.zip" />
        </div>

        <div class="field-stack">
          <label for="pacFolder">Folder path</label>
          <input id="pacFolder" type="text" spellcheck="false" placeholder="src/solutions/contoso_core" />
        </div>
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="pacWebsiteId">Power Pages site ID</label>
          <input id="pacWebsiteId" type="text" spellcheck="false" placeholder="00000000-0000-0000-0000-000000000000" />
        </div>

        <div class="field-stack">
          <label for="pacPackageType">Package type</label>
          <select id="pacPackageType">
            <option value="Unmanaged">Unmanaged</option>
            <option value="Managed">Managed</option>
            <option value="Both">Both</option>
          </select>
        </div>

        <div class="field-stack">
          <label for="pacOutputDirectory">Checker output directory</label>
          <input id="pacOutputDirectory" type="text" spellcheck="false" placeholder="reports/solution-check" />
        </div>
      </div>

      <div class="option-grid">
        <label class="checkbox-row" for="pacManaged">
          <input id="pacManaged" type="checkbox" />
          <span>Export as managed</span>
        </label>
        <label class="checkbox-row" for="pacAsync">
          <input id="pacAsync" type="checkbox" />
          <span>Run asynchronously</span>
        </label>
        <label class="checkbox-row" for="pacForceOverwrite">
          <input id="pacForceOverwrite" type="checkbox" />
          <span>Force overwrite on import</span>
        </label>
        <label class="checkbox-row" for="pacDeviceCode">
          <input id="pacDeviceCode" type="checkbox" />
          <span>Use device code authentication</span>
        </label>
      </div>

      <div class="field-stack">
        <label for="pacPreview">Command preview</label>
        <div id="pacPreview" class="builder-preview" aria-live="polite"></div>
      </div>

      <div class="output-toolbar">
        <label for="pacOutput">Output</label>
        <div class="button-row">
          <button id="copyPacCommandButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadPacCommandButton" class="button secondary" href="#" download="power-platform-cli-command.md" hidden>Download output</a>
        </div>
      </div>

      <textarea id="pacOutput" spellcheck="false" readonly placeholder="The Power Platform CLI command report will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Group</span>
          <strong id="pacGroupDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Command</span>
          <strong id="pacCommandDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Arguments</span>
          <strong id="pacArgumentsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Required fields</span>
          <strong id="pacRequiredFieldsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Checklist items</span>
          <strong id="pacChecklistDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Output size</span>
          <strong id="pacOutputSizeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="pacWarningsDetail">-</strong>
        </div>
      </div>

      <div id="pacStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const fields = {
    action: container.querySelector('#pacAction'),
    environmentUrl: container.querySelector('#pacEnvironmentUrl'),
    solutionName: container.querySelector('#pacSolutionName'),
    path: container.querySelector('#pacPath'),
    folder: container.querySelector('#pacFolder'),
    websiteId: container.querySelector('#pacWebsiteId'),
    packageType: container.querySelector('#pacPackageType'),
    outputDirectory: container.querySelector('#pacOutputDirectory'),
    managed: container.querySelector('#pacManaged'),
    async: container.querySelector('#pacAsync'),
    forceOverwrite: container.querySelector('#pacForceOverwrite'),
    deviceCode: container.querySelector('#pacDeviceCode')
  };
  const preview = container.querySelector('#pacPreview');
  const output = container.querySelector('#pacOutput');
  const buildButton = container.querySelector('#buildPacCommandButton');
  const clearButton = container.querySelector('#clearPacCommandButton');
  const copyButton = container.querySelector('#copyPacCommandButton');
  const downloadButton = container.querySelector('#downloadPacCommandButton');
  const details = {
    group: container.querySelector('#pacGroupDetail'),
    command: container.querySelector('#pacCommandDetail'),
    arguments: container.querySelector('#pacArgumentsDetail'),
    requiredFields: container.querySelector('#pacRequiredFieldsDetail'),
    checklist: container.querySelector('#pacChecklistDetail'),
    outputSize: container.querySelector('#pacOutputSizeDetail'),
    warnings: container.querySelector('#pacWarningsDetail')
  };
  const status = container.querySelector('#pacStatus');

  let currentObjectUrl = null;

  function revokeObjectUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    downloadButton.hidden = true;
    downloadButton.removeAttribute('href');
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function resetDetails() {
    Object.values(details).forEach(element => {
      element.textContent = '-';
    });
    preview.innerHTML = '';
  }

  function setDetails(result) {
    details.group.textContent = result.actionGroup;
    details.command.textContent = result.actionLabel;
    details.arguments.textContent = result.summary.argumentCount.toLocaleString('en-GB');
    details.requiredFields.textContent = result.summary.requiredFieldCount.toLocaleString('en-GB');
    details.checklist.textContent = result.summary.checklistCount.toLocaleString('en-GB');
    details.outputSize.textContent = result.outputSizeLabel;
    details.warnings.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function renderPreview(result) {
    preview.innerHTML = '';

    [
      ['Command', result.command],
      ['Checklist', result.checklist.join('\n')],
      ['Warnings', result.warnings.join('\n') || 'None']
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

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    renderPreview(result);
    revokeObjectUrl();

    const blob = new Blob([result.output], { type: 'text/markdown;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'power-platform-cli-command.md';
    downloadButton.textContent = 'Download power-platform-cli-command.md';
    downloadButton.hidden = false;
  }

  function buildCommand() {
    try {
      const result = buildPowerPlatformCliCommand({
        action: fields.action.value,
        environmentUrl: fields.environmentUrl.value,
        solutionName: fields.solutionName.value,
        path: fields.path.value,
        folder: fields.folder.value,
        websiteId: fields.websiteId.value,
        packageType: fields.packageType.value,
        outputDirectory: fields.outputDirectory.value,
        managed: fields.managed.checked,
        async: fields.async.checked,
        forceOverwrite: fields.forceOverwrite.checked,
        deviceCode: fields.deviceCode.checked
      });
      setOutput(result);
      setStatus(buildSuccessMessage(result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      details.command.textContent = 'Invalid';
      setStatus(error.message || 'Unable to build this pac command.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no Power Platform CLI output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Power Platform CLI output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Power Platform CLI output selected and copied using the browser fallback.', 'success');
    }
  }

  buildButton.addEventListener('click', buildCommand);
  copyButton.addEventListener('click', copyOutput);
  clearButton.addEventListener('click', () => {
    fields.action.value = 'auth-create';
    fields.environmentUrl.value = '';
    fields.solutionName.value = '';
    fields.path.value = '';
    fields.folder.value = '';
    fields.websiteId.value = '';
    fields.packageType.value = 'Unmanaged';
    fields.outputDirectory.value = '';
    fields.managed.checked = false;
    fields.async.checked = false;
    fields.forceOverwrite.checked = false;
    fields.deviceCode.checked = false;
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    fields.environmentUrl.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(result) {
  const message = 'Power Platform CLI command built successfully.';

  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
