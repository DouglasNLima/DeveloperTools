import { bindFileDropZone } from './file-drop-zone.js';
import {
  buildSolutionImportPreflightFileName,
  processPowerPlatformSolutionImportPreflightArchive
} from './power-platform-solution-import-preflight.js';

export function renderPowerPlatformSolutionImportPreflight(container) {
  container.innerHTML = `
    <form class="tool-board power-solution-import-tool" data-tool-form>
      <div id="solutionImportDropZone" class="drop-zone">
        <label class="drop-zone-label" for="solutionImportFileInput">
          <span>Drop an exported solution ZIP here or browse</span>
          <small>ZIP files stay in this browser.</small>
        </label>
        <input id="solutionImportFileInput" class="drop-zone-input" type="file" accept=".zip,application/zip,application/x-zip-compressed" />
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="solutionImportPath">Suggested ZIP path</label>
          <input id="solutionImportPath" type="text" spellcheck="false" placeholder="dist/contoso_core.zip" />
        </div>

        <div class="field-stack">
          <label for="solutionImportTargetNote">Target environment note</label>
          <input id="solutionImportTargetNote" type="text" spellcheck="false" placeholder="Test environment, CRM4 region, release 1.2" />
        </div>
      </div>

      <div class="option-grid">
        <label class="checkbox-row" for="solutionImportAsync">
          <input id="solutionImportAsync" type="checkbox" />
          <span>Run asynchronously</span>
        </label>
        <label class="checkbox-row" for="solutionImportForceOverwrite">
          <input id="solutionImportForceOverwrite" type="checkbox" />
          <span>Force overwrite on import</span>
        </label>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="solutionImportPreflightOutput">Generated preflight report</label>
          <textarea id="solutionImportPreflightOutput" spellcheck="false" readonly placeholder="Analyse a solution export to generate an import preflight report."></textarea>
        </div>

        <div class="field-stack">
          <div class="detail-grid solution-docs-detail-grid" aria-live="polite">
            <div class="detail-card">
              <span>Solution</span>
              <strong id="solutionImportNameDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Package type</span>
              <strong id="solutionImportPackageDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Root components</span>
              <strong id="solutionImportComponentsDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Dependencies</span>
              <strong id="solutionImportDependenciesDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Environment variables</span>
              <strong id="solutionImportVariablesDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Connection references</span>
              <strong id="solutionImportConnectionsDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Warnings</span>
              <strong id="solutionImportWarningsDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Output size</span>
              <strong id="solutionImportSizeDetail">-</strong>
            </div>
          </div>

          <div class="button-row button-row--end">
            <button id="analyseSolutionImportButton" class="primary" type="button">Analyse solution</button>
            <button id="copySolutionImportButton" class="secondary" type="button" disabled>Copy Markdown</button>
            <a id="downloadSolutionImportButton" class="button secondary" href="#" download="solution-import-preflight.md" hidden>Download Markdown</a>
            <button id="clearSolutionImportButton" class="secondary" type="button">Clear</button>
          </div>
        </div>
      </div>

      <div id="solutionImportStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const fileInput = container.querySelector('#solutionImportFileInput');
  const dropZone = container.querySelector('#solutionImportDropZone');
  const pathInput = container.querySelector('#solutionImportPath');
  const targetNoteInput = container.querySelector('#solutionImportTargetNote');
  const asyncInput = container.querySelector('#solutionImportAsync');
  const forceOverwriteInput = container.querySelector('#solutionImportForceOverwrite');
  const analyseButton = container.querySelector('#analyseSolutionImportButton');
  const copyButton = container.querySelector('#copySolutionImportButton');
  const clearButton = container.querySelector('#clearSolutionImportButton');
  const downloadButton = container.querySelector('#downloadSolutionImportButton');
  const output = container.querySelector('#solutionImportPreflightOutput');
  const status = container.querySelector('#solutionImportStatus');
  const details = {
    name: container.querySelector('#solutionImportNameDetail'),
    packageType: container.querySelector('#solutionImportPackageDetail'),
    components: container.querySelector('#solutionImportComponentsDetail'),
    dependencies: container.querySelector('#solutionImportDependenciesDetail'),
    variables: container.querySelector('#solutionImportVariablesDetail'),
    connections: container.querySelector('#solutionImportConnectionsDetail'),
    warnings: container.querySelector('#solutionImportWarningsDetail'),
    size: container.querySelector('#solutionImportSizeDetail')
  };

  let currentFile = null;
  let currentResult = null;
  let objectUrl = '';

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function setFile(file) {
    currentFile = file;

    if (file && !pathInput.value.trim()) {
      pathInput.value = file.name;
    }

    setStatus(file ? `${file.name} selected.` : 'Ready.', null);
  }

  async function analyseSolution() {
    if (!currentFile) {
      setStatus('Choose an exported solution ZIP file before analysing the solution.', 'error');
      return;
    }

    analyseButton.disabled = true;
    setStatus('Analysing solution import preflight locally...', null);

    try {
      currentResult = await processPowerPlatformSolutionImportPreflightArchive(currentFile, {
        path: pathInput.value || currentFile.name,
        targetEnvironmentNote: targetNoteInput.value,
        async: asyncInput.checked,
        forceOverwrite: forceOverwriteInput.checked
      });
      renderResult();
      setStatus('Power Platform solution import preflight generated successfully.', 'success');
    } catch (error) {
      currentResult = null;
      clearOutputs();
      setStatus(error.message || 'Unable to analyse this solution export.', 'error');
    } finally {
      analyseButton.disabled = false;
    }
  }

  function renderResult() {
    if (!currentResult) {
      clearOutputs();
      return;
    }

    output.value = currentResult.documentationMarkdown;
    details.name.textContent = currentResult.solution.name;
    details.packageType.textContent = currentResult.solution.packageType;
    details.components.textContent = currentResult.summary.rootComponentCount.toLocaleString('en-GB');
    details.dependencies.textContent = currentResult.summary.missingDependencyCount === 0
      ? 'None'
      : currentResult.summary.missingDependencyCount.toLocaleString('en-GB');
    details.variables.textContent = currentResult.summary.environmentVariableCount.toLocaleString('en-GB');
    details.connections.textContent = currentResult.summary.connectionReferenceCount.toLocaleString('en-GB');
    details.warnings.textContent = currentResult.summary.warningCount === 0
      ? 'None'
      : `${currentResult.summary.warningCount.toLocaleString('en-GB')} warning${currentResult.summary.warningCount === 1 ? '' : 's'}`;
    details.size.textContent = currentResult.outputSizeLabel;
    copyButton.disabled = false;
    setDownload();
    dispatchOutputChange();
  }

  function setDownload() {
    revokeObjectUrl();

    if (!currentResult?.documentationMarkdown) {
      downloadButton.hidden = true;
      downloadButton.removeAttribute('href');
      return;
    }

    const blob = new Blob([currentResult.documentationMarkdown], { type: 'text/markdown;charset=utf-8' });
    objectUrl = URL.createObjectURL(blob);
    const fileName = buildSolutionImportPreflightFileName(currentResult.solution.name);
    downloadButton.href = objectUrl;
    downloadButton.download = fileName;
    downloadButton.textContent = `Download ${fileName}`;
    downloadButton.hidden = false;
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    }
  }

  function resetDetails() {
    Object.values(details).forEach(element => {
      element.textContent = '-';
    });
  }

  function clearOutputs() {
    output.value = '';
    copyButton.disabled = true;
    downloadButton.hidden = true;
    downloadButton.removeAttribute('href');
    revokeObjectUrl();
    resetDetails();
    dispatchOutputChange();
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no preflight report to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Import preflight report copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Import preflight report selected and copied using the browser fallback.', 'success');
    }
  }

  function dispatchOutputChange() {
    output.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const unbindDropZone = bindFileDropZone(dropZone, {
    accept: '.zip,application/zip,application/x-zip-compressed',
    onFile: file => {
      fileInput.value = '';
      setFile(file);
    },
    onReject: () => setStatus('Choose an exported solution ZIP file.', 'error')
  });

  fileInput.addEventListener('change', () => setFile(fileInput.files?.[0] || null));
  analyseButton.addEventListener('click', analyseSolution);
  copyButton.addEventListener('click', copyOutput);
  clearButton.addEventListener('click', () => {
    currentFile = null;
    currentResult = null;
    fileInput.value = '';
    pathInput.value = '';
    targetNoteInput.value = '';
    asyncInput.checked = false;
    forceOverwriteInput.checked = false;
    analyseButton.disabled = false;
    clearOutputs();
    setStatus('Ready.', null);
  });

  return () => {
    unbindDropZone();
    revokeObjectUrl();
  };
}
