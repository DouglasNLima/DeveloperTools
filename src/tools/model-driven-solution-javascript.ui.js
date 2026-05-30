import { bindFileDropZone } from './file-drop-zone.js';
import {
  buildSolutionJavaScriptEventsFileName,
  buildWebResourceDependencyFileName,
  processSolutionJavaScriptEventsArchive,
  processWebResourceDependencyMapArchive
} from './model-driven-solution-javascript.js';

export function renderSolutionJavaScriptEventInspector(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      ${buildDropZone('solutionJavascriptEvents')}
      ${buildSolutionOutputLayout({
        outputId: 'solutionJavascriptEventsOutput',
        label: 'JavaScript event report',
        prefix: 'solutionJavascriptEvents',
        actionLabel: 'Analyse JavaScript events'
      })}
      <div id="solutionJavascriptEventsStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  return bindSolutionArchiveTool(container, {
    prefix: 'solutionJavascriptEvents',
    outputId: '#solutionJavascriptEventsOutput',
    statusId: '#solutionJavascriptEventsStatus',
    run: file => processSolutionJavaScriptEventsArchive(file),
    readOutput: result => result.reportMarkdown,
    fileName: result => buildSolutionJavaScriptEventsFileName(result.solution.name),
    success: 'Solution JavaScript events analysed successfully.',
    emptyCopy: 'There is no JavaScript event report to copy.'
  });
}

export function renderWebResourceDependencyMapper(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      ${buildDropZone('webResourceDependency')}
      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="webResourceDependencyMapOutput">Dependency report</label>
          <textarea id="webResourceDependencyMapOutput" spellcheck="false" readonly placeholder="Analyse a solution export to generate a dependency report."></textarea>
        </div>
        <div class="field-stack">
          <label for="webResourceDependencyMermaidOutput">Mermaid diagram</label>
          <textarea id="webResourceDependencyMermaidOutput" spellcheck="false" readonly placeholder="The Mermaid dependency diagram will appear here."></textarea>
        </div>
      </div>
      ${buildDetails('webResourceDependency')}
      <div class="button-row button-row--end">
        <button id="analyseWebResourceDependencyButton" class="primary" type="button">Build dependency map</button>
        <button id="copyWebResourceDependencyButton" class="secondary" type="button" disabled>Copy report</button>
        <button id="copyWebResourceDependencyMermaidButton" class="secondary" type="button" disabled>Copy Mermaid</button>
        <a id="downloadWebResourceDependencyButton" class="button secondary" href="#" download="web-resource-dependency-map.md" hidden>Download report</a>
        <a id="downloadWebResourceDependencyMermaidButton" class="button secondary" href="#" download="web-resource-dependencies.mmd" hidden>Download Mermaid</a>
        <button id="clearWebResourceDependencyButton" class="secondary" type="button">Clear</button>
      </div>
      <div id="webResourceDependencyStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  return bindDependencyTool(container);
}

function bindSolutionArchiveTool(container, options) {
  const prefix = options.prefix;
  const fileInput = container.querySelector(`#${prefix}FileInput`);
  const dropZone = container.querySelector(`#${prefix}DropZone`);
  const analyseButton = container.querySelector(`#analyse${capitalise(prefix)}Button`);
  const copyButton = container.querySelector(`#copy${capitalise(prefix)}Button`);
  const clearButton = container.querySelector(`#clear${capitalise(prefix)}Button`);
  const downloadButton = container.querySelector(`#download${capitalise(prefix)}Button`);
  const output = container.querySelector(options.outputId);
  const status = container.querySelector(options.statusId);
  const details = collectDetails(container);
  let currentFile = null;
  let objectUrl = '';

  function setFile(file) {
    currentFile = file;
    setStatus(status, file ? `${file.name} selected.` : 'Ready.', null);
  }

  async function analyse() {
    if (!currentFile) {
      setStatus(status, 'Choose an exported solution ZIP file before analysing JavaScript events.', 'error');
      return;
    }

    analyseButton.disabled = true;
    setStatus(status, 'Analysing solution export locally...', null);

    try {
      const result = await options.run(currentFile);
      output.value = options.readOutput(result);
      copyButton.disabled = false;
      objectUrl = setDownload(downloadButton, objectUrl, options.fileName(result), output.value, 'text/markdown;charset=utf-8');
      setDetails(details, result);
      setStatus(status, options.success, 'success');
      dispatchOutputChange(output);
    } catch (error) {
      output.value = '';
      copyButton.disabled = true;
      objectUrl = clearDownload(downloadButton, objectUrl);
      resetDetails(details);
      setStatus(status, error.message || 'Unable to analyse this solution export.', 'error');
      dispatchOutputChange(output);
    } finally {
      analyseButton.disabled = false;
    }
  }

  const unbindDropZone = bindFileDropZone(dropZone, {
    accept: '.zip,application/zip,application/x-zip-compressed',
    onFile: file => {
      fileInput.value = '';
      setFile(file);
    },
    onReject: () => setStatus(status, 'Choose an exported solution ZIP file.', 'error')
  });

  fileInput.addEventListener('change', () => setFile(fileInput.files?.[0] || null));
  analyseButton.addEventListener('click', analyse);
  copyButton.addEventListener('click', () => copyValue(output, copyButton, status, options.emptyCopy));
  clearButton.addEventListener('click', () => {
    currentFile = null;
    fileInput.value = '';
    output.value = '';
    copyButton.disabled = true;
    objectUrl = clearDownload(downloadButton, objectUrl);
    resetDetails(details);
    setStatus(status, 'Ready.', null);
    dispatchOutputChange(output);
  });

  return () => {
    unbindDropZone();
    clearDownload(downloadButton, objectUrl);
  };
}

function bindDependencyTool(container) {
  const fileInput = container.querySelector('#webResourceDependencyFileInput');
  const dropZone = container.querySelector('#webResourceDependencyDropZone');
  const analyseButton = container.querySelector('#analyseWebResourceDependencyButton');
  const copyButton = container.querySelector('#copyWebResourceDependencyButton');
  const copyMermaidButton = container.querySelector('#copyWebResourceDependencyMermaidButton');
  const clearButton = container.querySelector('#clearWebResourceDependencyButton');
  const downloadButton = container.querySelector('#downloadWebResourceDependencyButton');
  const downloadMermaidButton = container.querySelector('#downloadWebResourceDependencyMermaidButton');
  const output = container.querySelector('#webResourceDependencyMapOutput');
  const mermaidOutput = container.querySelector('#webResourceDependencyMermaidOutput');
  const status = container.querySelector('#webResourceDependencyStatus');
  const details = collectDetails(container);
  let currentFile = null;
  let markdownUrl = '';
  let mermaidUrl = '';

  function setFile(file) {
    currentFile = file;
    setStatus(status, file ? `${file.name} selected.` : 'Ready.', null);
  }

  async function analyse() {
    if (!currentFile) {
      setStatus(status, 'Choose an exported solution ZIP file before building the dependency map.', 'error');
      return;
    }

    analyseButton.disabled = true;
    setStatus(status, 'Building dependency map locally...', null);

    try {
      const result = await processWebResourceDependencyMapArchive(currentFile);
      output.value = result.markdown;
      mermaidOutput.value = result.mermaid;
      copyButton.disabled = false;
      copyMermaidButton.disabled = false;
      markdownUrl = setDownload(downloadButton, markdownUrl, buildWebResourceDependencyFileName(result.solution.name), result.markdown, 'text/markdown;charset=utf-8');
      mermaidUrl = setDownload(downloadMermaidButton, mermaidUrl, buildWebResourceDependencyFileName(result.solution.name, 'mmd'), result.mermaid, 'text/plain;charset=utf-8');
      setDetails(details, result);
      setStatus(status, 'Web resource dependency map built successfully.', 'success');
      dispatchOutputChange(output);
      dispatchOutputChange(mermaidOutput);
    } catch (error) {
      clearOutputs();
      setStatus(status, error.message || 'Unable to build this dependency map.', 'error');
    } finally {
      analyseButton.disabled = false;
    }
  }

  function clearOutputs() {
    output.value = '';
    mermaidOutput.value = '';
    copyButton.disabled = true;
    copyMermaidButton.disabled = true;
    markdownUrl = clearDownload(downloadButton, markdownUrl);
    mermaidUrl = clearDownload(downloadMermaidButton, mermaidUrl);
    resetDetails(details);
    dispatchOutputChange(output);
    dispatchOutputChange(mermaidOutput);
  }

  const unbindDropZone = bindFileDropZone(dropZone, {
    accept: '.zip,application/zip,application/x-zip-compressed',
    onFile: file => {
      fileInput.value = '';
      setFile(file);
    },
    onReject: () => setStatus(status, 'Choose an exported solution ZIP file.', 'error')
  });

  fileInput.addEventListener('change', () => setFile(fileInput.files?.[0] || null));
  analyseButton.addEventListener('click', analyse);
  copyButton.addEventListener('click', () => copyValue(output, copyButton, status, 'There is no dependency report to copy.'));
  copyMermaidButton.addEventListener('click', () => copyValue(mermaidOutput, copyMermaidButton, status, 'There is no Mermaid diagram to copy.'));
  clearButton.addEventListener('click', () => {
    currentFile = null;
    fileInput.value = '';
    clearOutputs();
    setStatus(status, 'Ready.', null);
  });

  return () => {
    unbindDropZone();
    clearDownload(downloadButton, markdownUrl);
    clearDownload(downloadMermaidButton, mermaidUrl);
  };
}

function buildDropZone(prefix) {
  return `
    <div id="${prefix}DropZone" class="drop-zone">
      <label class="drop-zone-label" for="${prefix}FileInput">
        <span>Drop an exported solution ZIP here or browse</span>
        <small>ZIP files stay in this browser.</small>
      </label>
      <input id="${prefix}FileInput" class="drop-zone-input" type="file" accept=".zip,application/zip,application/x-zip-compressed" />
    </div>
  `;
}

function buildSolutionOutputLayout({ outputId, label, prefix, actionLabel }) {
  return `
    <div class="form-grid form-grid--split">
      <div class="field-stack">
        <label for="${outputId}">${label}</label>
        <textarea id="${outputId}" spellcheck="false" readonly placeholder="Analyse a solution export to generate a Markdown report."></textarea>
      </div>
      <div class="field-stack">
        ${buildDetails(prefix)}
        <div class="button-row button-row--end">
          <button id="analyse${capitalise(prefix)}Button" class="primary" type="button">${actionLabel}</button>
          <button id="copy${capitalise(prefix)}Button" class="secondary" type="button" disabled>Copy report</button>
          <a id="download${capitalise(prefix)}Button" class="button secondary" href="#" hidden>Download report</a>
          <button id="clear${capitalise(prefix)}Button" class="secondary" type="button">Clear</button>
        </div>
      </div>
    </div>
  `;
}

function buildDetails(prefix) {
  const labels = ['Solution', 'Web resources', 'Handlers', 'Forms', 'Warnings', 'Output size'];
  return `
    <div class="detail-grid" aria-live="polite">
      ${labels.map(label => `
        <div class="detail-card">
          <span>${label}</span>
          <strong id="${prefix}${label.replace(/\s+/g, '')}Detail">-</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function collectDetails(container) {
  return [...container.querySelectorAll('.detail-card')].map(card => ({
    label: card.querySelector('span').textContent,
    value: card.querySelector('strong')
  }));
}

function setDetails(details, result) {
  const values = {
    Solution: result.solution.name,
    'Web resources': result.summary.webResourceCount.toLocaleString('en-GB'),
    Handlers: result.summary.handlerCount.toLocaleString('en-GB'),
    Forms: result.summary.formCount.toLocaleString('en-GB'),
    Warnings: result.summary.warningCount === 0 ? 'None' : result.summary.warningCount.toLocaleString('en-GB'),
    'Output size': result.outputSizeLabel
  };

  details.forEach(detail => {
    detail.value.textContent = values[detail.label] ?? '-';
  });
}

function resetDetails(details) {
  details.forEach(detail => {
    detail.value.textContent = '-';
  });
}

function setDownload(downloadButton, previousUrl, fileName, value, mimeType) {
  clearDownload(downloadButton, previousUrl);
  const blob = new Blob([value], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  downloadButton.href = objectUrl;
  downloadButton.download = fileName;
  downloadButton.textContent = `Download ${fileName}`;
  downloadButton.hidden = false;
  return objectUrl;
}

function clearDownload(downloadButton, objectUrl) {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }

  downloadButton.hidden = true;
  downloadButton.removeAttribute('href');
  return '';
}

async function copyValue(output, copyButton, status, emptyMessage) {
  if (!output.value || copyButton.disabled) {
    setStatus(status, emptyMessage, 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(output.value);
    setStatus(status, 'Output copied to the clipboard.', 'success');
  } catch {
    output.focus();
    output.select();
    document.execCommand('copy');
    setStatus(status, 'Output selected and copied using the browser fallback.', 'success');
  }
}

function setStatus(status, message, type) {
  status.textContent = message;
  status.className = `status-message${type ? ` ${type}` : ''}`;
}

function dispatchOutputChange(output) {
  output.dispatchEvent(new Event('input', { bubbles: true }));
}

function capitalise(value) {
  return String(value).charAt(0).toLocaleUpperCase('en-GB') + String(value).slice(1);
}
