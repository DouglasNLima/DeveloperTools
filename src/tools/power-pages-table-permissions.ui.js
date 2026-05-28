import {
  TABLE_PERMISSION_OPERATIONS,
  TABLE_PERMISSION_SCOPES,
  buildTablePermissionsChecklist
} from './power-pages-table-permissions.js';

export function renderPowerPagesTablePermissionsChecklist(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="tablePermissionTable">Logical table name</label>
          <input id="tablePermissionTable" type="text" placeholder="account" />
        </div>

        <div class="field-stack">
          <label for="tablePermissionScope">Access type</label>
          <select id="tablePermissionScope">
            ${TABLE_PERMISSION_SCOPES.map(scope => `<option value="${scope.value}">${scope.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="tablePermissionRelationship">Relationship</label>
          <input id="tablePermissionRelationship" type="text" placeholder="contact_account" />
        </div>
      </div>

      <div class="field-stack">
        <label>Privileges</label>
        <div class="option-grid" aria-label="Privileges">
          ${TABLE_PERMISSION_OPERATIONS.map(operation => `
            <label class="checkbox-row" for="tablePermissionOperation-${operation.value}">
              <input id="tablePermissionOperation-${operation.value}" type="checkbox" value="${operation.value}" data-table-permission-operation ${operation.value === 'read' ? 'checked' : ''} />
              <span>${operation.label}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="form-grid form-grid--actions">
        <div class="field-stack">
          <label for="tablePermissionRoles">Custom web roles</label>
          <input id="tablePermissionRoles" type="text" placeholder="Portal Managers, Service Agents" />
        </div>
        <div class="button-row button-row--end">
          <button id="generateTablePermissionsButton" class="primary" type="button">Generate checklist</button>
          <button id="clearTablePermissionsButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="option-grid">
        <label class="checkbox-row" for="includeAuthenticatedRole">
          <input id="includeAuthenticatedRole" type="checkbox" checked />
          <span>Include Authenticated Users web role</span>
        </label>
        <label class="checkbox-row" for="includeAnonymousRole">
          <input id="includeAnonymousRole" type="checkbox" />
          <span>Include Anonymous Users web role</span>
        </label>
        <label class="checkbox-row" for="tablePermissionWebApi">
          <input id="tablePermissionWebApi" type="checkbox" />
          <span>Review this permission for Web API use</span>
        </label>
      </div>

      <div class="output-toolbar">
        <label for="tablePermissionOutput">Output</label>
        <div class="button-row">
          <button id="copyTablePermissionsButton" class="primary" type="button" disabled>Copy output</button>
          <a id="downloadTablePermissionsButton" class="button secondary" href="#" download="power-pages-table-permissions.md" hidden>Download output</a>
        </div>
      </div>

      <textarea id="tablePermissionOutput" spellcheck="false" readonly placeholder="The table permissions checklist will appear here."></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Risk level</span>
          <strong id="tablePermissionRisk">-</strong>
        </div>
        <div class="detail-card">
          <span>Privileges</span>
          <strong id="tablePermissionOperations">-</strong>
        </div>
        <div class="detail-card">
          <span>Access type</span>
          <strong id="tablePermissionScopeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="tablePermissionWarnings">-</strong>
        </div>
      </div>

      <div id="tablePermissionStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const table = container.querySelector('#tablePermissionTable');
  const scope = container.querySelector('#tablePermissionScope');
  const relationship = container.querySelector('#tablePermissionRelationship');
  const roles = container.querySelector('#tablePermissionRoles');
  const includeAuthenticated = container.querySelector('#includeAuthenticatedRole');
  const includeAnonymous = container.querySelector('#includeAnonymousRole');
  const webApiEnabled = container.querySelector('#tablePermissionWebApi');
  const operationCheckboxes = [...container.querySelectorAll('[data-table-permission-operation]')];
  const generateButton = container.querySelector('#generateTablePermissionsButton');
  const clearButton = container.querySelector('#clearTablePermissionsButton');
  const copyButton = container.querySelector('#copyTablePermissionsButton');
  const downloadButton = container.querySelector('#downloadTablePermissionsButton');
  const output = container.querySelector('#tablePermissionOutput');
  const risk = container.querySelector('#tablePermissionRisk');
  const operationCount = container.querySelector('#tablePermissionOperations');
  const scopeDetail = container.querySelector('#tablePermissionScopeDetail');
  const warnings = container.querySelector('#tablePermissionWarnings');
  const status = container.querySelector('#tablePermissionStatus');

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
    risk.textContent = '-';
    operationCount.textContent = '-';
    scopeDetail.textContent = '-';
    warnings.textContent = '-';
  }

  function setDetails(result) {
    risk.textContent = result.riskLevel;
    operationCount.textContent = result.operationLabels.join(', ');
    scopeDetail.textContent = result.scopeLabel;
    warnings.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  }

  function setOutput(result) {
    output.value = result.output;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const blob = new Blob([result.output], { type: 'text/markdown;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'power-pages-table-permissions.md';
    downloadButton.textContent = `Download ${downloadButton.download}`;
    downloadButton.hidden = false;
  }

  function getSelectedOperations() {
    return operationCheckboxes
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.value);
  }

  function handleGenerate() {
    try {
      const result = buildTablePermissionsChecklist({
        logicalTableName: table.value,
        operations: getSelectedOperations(),
        scope: scope.value,
        relationshipName: relationship.value,
        webRoles: roles.value,
        includeAuthenticated: includeAuthenticated.checked,
        includeAnonymous: includeAnonymous.checked,
        webApiEnabled: webApiEnabled.checked
      });

      setOutput(result);
      setStatus(buildSuccessMessage('Power Pages table permissions checklist generated successfully.', result), 'success');
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to generate this table permissions checklist.', 'error');
    }
  }

  async function copyOutput() {
    if (!output.value) {
      setStatus('There is no output to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Output copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Output selected and copied using the browser fallback.', 'success');
    }
  }

  generateButton.addEventListener('click', handleGenerate);
  copyButton.addEventListener('click', copyOutput);

  clearButton.addEventListener('click', () => {
    table.value = '';
    scope.value = 'global';
    relationship.value = '';
    roles.value = '';
    includeAuthenticated.checked = true;
    includeAnonymous.checked = false;
    webApiEnabled.checked = false;
    operationCheckboxes.forEach(checkbox => {
      checkbox.checked = checkbox.value === 'read';
    });
    output.value = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    table.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(message, result) {
  if (result.warnings.length === 0) {
    return message;
  }

  return `${message} ${result.warnings[0]}`;
}
