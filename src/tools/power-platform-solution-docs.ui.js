import { bindFileDropZone } from './file-drop-zone.js';
import {
  buildSolutionDocumentationFileName,
  processPowerPlatformSolutionDocumentationArchive
} from './power-platform-solution-docs.js';

export function renderPowerPlatformSolutionDocs(container) {
  container.innerHTML = `
    <form class="tool-board power-solution-docs-tool" data-tool-form>
      <div id="solutionDocsDropZone" class="drop-zone">
        <label class="drop-zone-label" for="solutionDocsFileInput">
          <span>Drop an exported solution ZIP here or browse</span>
          <small>ZIP files stay in this browser.</small>
        </label>
        <input id="solutionDocsFileInput" class="drop-zone-input" type="file" accept=".zip,application/zip,application/x-zip-compressed" />
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="solutionDocsOutput">Generated documentation</label>
          <textarea id="solutionDocsOutput" spellcheck="false" readonly placeholder="Analyse a solution export to generate Markdown documentation."></textarea>
        </div>

        <div class="field-stack">
          <div class="detail-grid solution-docs-detail-grid" aria-live="polite">
            <div class="detail-card">
              <span>Solution</span>
              <strong id="solutionDocsNameDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Version</span>
              <strong id="solutionDocsVersionDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Processes</span>
              <strong id="solutionDocsProcessesDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Environment variables</span>
              <strong id="solutionDocsVariablesDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Connection references</span>
              <strong id="solutionDocsConnectionsDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Warnings</span>
              <strong id="solutionDocsWarningsDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Output size</span>
              <strong id="solutionDocsSizeDetail">-</strong>
            </div>
          </div>

          <div class="button-row button-row--end">
            <button id="analyseSolutionDocsButton" class="primary" type="button">Analyse solution</button>
            <button id="copySolutionDocsButton" class="secondary" type="button" disabled>Copy Markdown</button>
            <a id="downloadSolutionDocsButton" class="button secondary" href="#" download="solution-documentation.md" hidden>Download Markdown</a>
            <button id="clearSolutionDocsButton" class="secondary" type="button">Clear</button>
          </div>
        </div>
      </div>

      <div id="solutionDocsStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const fileInput = container.querySelector('#solutionDocsFileInput');
  const dropZone = container.querySelector('#solutionDocsDropZone');
  const analyseButton = container.querySelector('#analyseSolutionDocsButton');
  const copyButton = container.querySelector('#copySolutionDocsButton');
  const clearButton = container.querySelector('#clearSolutionDocsButton');
  const downloadButton = container.querySelector('#downloadSolutionDocsButton');
  const output = container.querySelector('#solutionDocsOutput');
  const status = container.querySelector('#solutionDocsStatus');
  const details = {
    name: container.querySelector('#solutionDocsNameDetail'),
    version: container.querySelector('#solutionDocsVersionDetail'),
    processes: container.querySelector('#solutionDocsProcessesDetail'),
    variables: container.querySelector('#solutionDocsVariablesDetail'),
    connections: container.querySelector('#solutionDocsConnectionsDetail'),
    warnings: container.querySelector('#solutionDocsWarningsDetail'),
    size: container.querySelector('#solutionDocsSizeDetail')
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
    setStatus(file ? `${file.name} selected.` : 'Ready.', null);
  }

  async function analyseSolution() {
    if (!currentFile) {
      setStatus('Choose an exported solution ZIP file before analysing the solution.', 'error');
      return;
    }

    analyseButton.disabled = true;
    setStatus('Analysing solution export locally...', null);

    try {
      currentResult = await processPowerPlatformSolutionDocumentationArchive(currentFile);
      renderResult();
      setStatus('Power Platform solution documentation generated successfully.', 'success');
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
    details.version.textContent = currentResult.solution.version;
    details.processes.textContent = currentResult.summary.componentCount.toLocaleString('en-GB');
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
    const fileName = buildSolutionDocumentationFileName(currentResult.solution.name);
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
      setStatus('There is no Markdown documentation to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Markdown documentation copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Markdown documentation selected and copied using the browser fallback.', 'success');
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
    analyseButton.disabled = false;
    clearOutputs();
    setStatus('Ready.', null);
  });

  return () => {
    unbindDropZone();
    revokeObjectUrl();
  };
}
