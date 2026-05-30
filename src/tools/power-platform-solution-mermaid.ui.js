import { bindFileDropZone } from './file-drop-zone.js';
import {
  SOLUTION_MERMAID_COMPONENT_FILTERS,
  buildSolutionMermaidFileName,
  processPowerPlatformSolutionArchive
} from './power-platform-solution-mermaid.js';

export function renderPowerPlatformSolutionMermaid(container) {
  container.innerHTML = `
    <form class="tool-board power-solution-mermaid-tool" data-tool-form>
      <div id="solutionMermaidDropZone" class="drop-zone">
        <label class="drop-zone-label" for="solutionMermaidFileInput">
          <span>Drop an exported solution ZIP here or browse</span>
          <small>ZIP files stay in this browser.</small>
        </label>
        <input id="solutionMermaidFileInput" class="drop-zone-input" type="file" accept=".zip,application/zip,application/x-zip-compressed" />
      </div>

      <div class="form-grid form-grid--triple">
        <div class="field-stack">
          <label for="solutionMermaidComponentFilter">Component filter</label>
          <select id="solutionMermaidComponentFilter">
            ${SOLUTION_MERMAID_COMPONENT_FILTERS.map(filter => `<option value="${filter.value}">${filter.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-stack">
          <label for="solutionMermaidSearch">Search components</label>
          <input id="solutionMermaidSearch" type="search" autocomplete="off" placeholder="name or type" />
        </div>

        <div class="button-row button-row--end">
          <button id="analyseSolutionMermaidButton" class="primary" type="button">Analyse solution</button>
          <button id="clearSolutionMermaidButton" class="secondary" type="button">Clear</button>
        </div>
      </div>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Solution</span>
          <strong id="solutionMermaidNameDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Version</span>
          <strong id="solutionMermaidVersionDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Components</span>
          <strong id="solutionMermaidComponentsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="solutionMermaidWarningsDetail">-</strong>
        </div>
      </div>

      <div class="solution-mermaid-layout">
        <section class="solution-component-panel" aria-labelledby="solutionMermaidComponentListLabel">
          <div class="output-toolbar">
            <h2 id="solutionMermaidComponentListLabel">Detected components</h2>
            <span id="solutionMermaidFilteredDetail" class="pill">0 shown</span>
          </div>
          <div id="solutionMermaidComponentList" class="solution-component-list" aria-live="polite">
            <p class="empty-state">Load a solution export to list workflow components.</p>
          </div>
        </section>

        <section class="solution-output-panel" aria-labelledby="solutionMermaidOutputLabel">
          <div class="output-toolbar">
            <label id="solutionMermaidOutputLabel" for="solutionMermaidOutput">Selected Mermaid</label>
            <div class="button-row">
              <button id="showSolutionMermaidMapButton" class="secondary" type="button" disabled>Show dependency map</button>
              <button id="copySolutionMermaidButton" class="primary" type="button" disabled>Copy Mermaid</button>
              <a id="downloadSolutionMermaidButton" class="button secondary" href="#" download="solution-component.mmd" hidden>Download MMD</a>
              <a id="downloadSolutionMermaidInventoryButton" class="button secondary" href="#" download="solution-mermaid-inventory.md" hidden>Download inventory</a>
            </div>
          </div>

          <textarea id="solutionMermaidOutput" spellcheck="false" readonly placeholder="Analyse a solution to view the dependency map or a component Mermaid source."></textarea>
          <textarea id="solutionMermaidInventoryOutput" spellcheck="false" readonly hidden></textarea>

          <div class="detail-grid solution-mermaid-selected-grid" aria-live="polite">
            <div class="detail-card">
              <span>Component type</span>
              <strong id="solutionMermaidTypeDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Mermaid type</span>
              <strong id="solutionMermaidOutputTypeDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Steps/relations</span>
              <strong id="solutionMermaidStepsDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Output size</span>
              <strong id="solutionMermaidSizeDetail">-</strong>
            </div>
          </div>

          <div id="solutionMermaidIssueList" class="solution-mermaid-issue-list" aria-live="polite"></div>
        </section>
      </div>

      <div id="solutionMermaidStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const fileInput = container.querySelector('#solutionMermaidFileInput');
  const dropZone = container.querySelector('#solutionMermaidDropZone');
  const analyseButton = container.querySelector('#analyseSolutionMermaidButton');
  const clearButton = container.querySelector('#clearSolutionMermaidButton');
  const componentFilter = container.querySelector('#solutionMermaidComponentFilter');
  const search = container.querySelector('#solutionMermaidSearch');
  const componentList = container.querySelector('#solutionMermaidComponentList');
  const output = container.querySelector('#solutionMermaidOutput');
  const inventoryOutput = container.querySelector('#solutionMermaidInventoryOutput');
  const mapButton = container.querySelector('#showSolutionMermaidMapButton');
  const copyButton = container.querySelector('#copySolutionMermaidButton');
  const downloadButton = container.querySelector('#downloadSolutionMermaidButton');
  const inventoryDownloadButton = container.querySelector('#downloadSolutionMermaidInventoryButton');
  const issueList = container.querySelector('#solutionMermaidIssueList');
  const status = container.querySelector('#solutionMermaidStatus');
  const details = {
    name: container.querySelector('#solutionMermaidNameDetail'),
    version: container.querySelector('#solutionMermaidVersionDetail'),
    components: container.querySelector('#solutionMermaidComponentsDetail'),
    warnings: container.querySelector('#solutionMermaidWarningsDetail'),
    filtered: container.querySelector('#solutionMermaidFilteredDetail'),
    type: container.querySelector('#solutionMermaidTypeDetail'),
    outputType: container.querySelector('#solutionMermaidOutputTypeDetail'),
    steps: container.querySelector('#solutionMermaidStepsDetail'),
    size: container.querySelector('#solutionMermaidSizeDetail')
  };

  let currentFile = null;
  let currentResult = null;
  let selectedDiagramId = '';
  const objectUrls = [];

  function trackObjectUrl(url) {
    objectUrls.push(url);
    return url;
  }

  function revokeObjectUrls() {
    while (objectUrls.length > 0) {
      URL.revokeObjectURL(objectUrls.pop());
    }

    [downloadButton, inventoryDownloadButton].forEach(link => {
      link.hidden = true;
      link.removeAttribute('href');
    });
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function resetDetails() {
    Object.values(details).forEach(element => {
      element.textContent = '-';
    });
    details.filtered.textContent = '0 shown';
    issueList.innerHTML = '';
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
      currentResult = await processPowerPlatformSolutionArchive(currentFile);
      selectedDiagramId = currentResult.dependencyMap?.id || currentResult.components[0]?.id || '';
      renderResult();
      setStatus('Power Platform solution analysed successfully.', 'success');
    } catch (error) {
      currentResult = null;
      selectedDiagramId = '';
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

    details.name.textContent = currentResult.solution.name;
    details.version.textContent = currentResult.solution.version;
    details.components.textContent = currentResult.summary.componentCount.toLocaleString('en-GB');
    const warningCount = currentResult.summary.warningCount + currentResult.warnings.length + (currentResult.dependencyMap?.warnings.length || 0);
    details.warnings.textContent = warningCount === 0
      ? 'None'
      : `${warningCount.toLocaleString('en-GB')} warning${warningCount === 1 ? '' : 's'}`;
    inventoryOutput.value = currentResult.inventoryMarkdown;
    mapButton.disabled = !currentResult.dependencyMap;
    setInventoryDownload();
    renderComponentList();
    selectDiagram(selectedDiagramId || currentResult.dependencyMap?.id || currentResult.components[0]?.id);
  }

  function renderComponentList() {
    componentList.innerHTML = '';

    const components = getFilteredComponents();
    details.filtered.textContent = `${components.length.toLocaleString('en-GB')} shown`;

    if (components.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No components match the current filter.';
      componentList.append(empty);
      return;
    }

    components.forEach(component => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `solution-component-card${component.id === selectedDiagramId ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', component.id === selectedDiagramId ? 'true' : 'false');
      button.dataset.componentId = component.id;

      const title = document.createElement('strong');
      title.textContent = component.name;
      const meta = document.createElement('span');
      meta.textContent = `${component.typeLabel} · ${component.stepCount.toLocaleString('en-GB')} step${component.stepCount === 1 ? '' : 's'}`;
      const source = document.createElement('small');
      source.textContent = component.sourcePath;

      button.append(title, meta, source);
      button.addEventListener('click', () => selectComponent(component.id));
      componentList.append(button);
    });
  }

  function getFilteredComponents() {
    if (!currentResult) {
      return [];
    }

    const filter = componentFilter.value;
    const term = search.value.trim().toLocaleLowerCase('en-GB');

    return currentResult.components.filter(component => {
      if (filter !== 'all' && component.type !== filter) {
        return false;
      }

      if (!term) {
        return true;
      }

      return `${component.name} ${component.typeLabel} ${component.sourcePath}`.toLocaleLowerCase('en-GB').includes(term);
    });
  }

  function selectDiagram(diagramId) {
    const component = diagramId === currentResult?.dependencyMap?.id
      ? currentResult.dependencyMap
      : currentResult?.components.find(item => item.id === diagramId) || getFilteredComponents()[0];

    if (!component) {
      output.value = '';
      copyButton.disabled = true;
      mapButton.disabled = true;
      setSelectedDetails(null);
      revokeObjectUrls();
      setInventoryDownload();
      dispatchOutputChange();
      return;
    }

    selectedDiagramId = component.id;
    output.value = component.mermaid;
    copyButton.disabled = false;
    mapButton.disabled = !currentResult?.dependencyMap;
    setSelectedDetails(component);
    setComponentDownload(component);
    renderIssues(component);
    renderComponentList();
    dispatchOutputChange();
  }

  function selectComponent(componentId) {
    selectDiagram(componentId);
  }

  function setSelectedDetails(component) {
    details.type.textContent = component?.typeLabel || '-';
    details.outputType.textContent = component?.outputType || '-';
    details.steps.textContent = component ? component.stepCount.toLocaleString('en-GB') : '-';
    details.size.textContent = component?.outputSizeLabel || '-';
  }

  function renderIssues(component) {
    issueList.innerHTML = '';
    const warnings = [...(currentResult?.warnings || []), ...(component?.warnings || [])];

    warnings.forEach(warning => {
      const item = document.createElement('p');
      item.textContent = warning;
      issueList.append(item);
    });
  }

  function setComponentDownload(component) {
    revokeObjectUrls();
    const blob = new Blob([component.mermaid], { type: 'text/plain;charset=utf-8' });
    const url = trackObjectUrl(URL.createObjectURL(blob));
    downloadButton.href = url;
    downloadButton.download = component.downloadName;
    downloadButton.textContent = `Download ${component.downloadName}`;
    downloadButton.hidden = false;
    setInventoryDownload();
  }

  function setInventoryDownload() {
    if (!currentResult?.inventoryMarkdown) {
      inventoryDownloadButton.hidden = true;
      inventoryDownloadButton.removeAttribute('href');
      return;
    }

    const blob = new Blob([currentResult.inventoryMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = trackObjectUrl(URL.createObjectURL(blob));
    const fileName = buildSolutionMermaidFileName(currentResult.solution.name);
    inventoryDownloadButton.href = url;
    inventoryDownloadButton.download = fileName;
    inventoryDownloadButton.textContent = `Download ${fileName}`;
    inventoryDownloadButton.hidden = false;
  }

  function clearOutputs() {
    output.value = '';
    inventoryOutput.value = '';
    copyButton.disabled = true;
    mapButton.disabled = true;
    componentList.innerHTML = '<p class="empty-state">Load a solution export to list workflow components.</p>';
    revokeObjectUrls();
    resetDetails();
    dispatchOutputChange();
  }

  async function copyOutput() {
    if (!output.value || copyButton.disabled) {
      setStatus('There is no Mermaid source to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus('Mermaid source copied to the clipboard.', 'success');
    } catch {
      output.focus();
      output.select();
      document.execCommand('copy');
      setStatus('Mermaid source selected and copied using the browser fallback.', 'success');
    }
  }

  function dispatchOutputChange() {
    output.dispatchEvent(new Event('input', { bubbles: true }));
    inventoryOutput.dispatchEvent(new Event('input', { bubbles: true }));
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
  mapButton.addEventListener('click', () => selectDiagram(currentResult?.dependencyMap?.id));
  copyButton.addEventListener('click', copyOutput);
  componentFilter.addEventListener('change', () => {
    renderComponentList();
    selectComponent(getFilteredComponents()[0]?.id);
  });
  search.addEventListener('input', () => {
    renderComponentList();
    if (!getFilteredComponents().some(component => component.id === selectedDiagramId)) {
      selectComponent(getFilteredComponents()[0]?.id);
    }
  });
  clearButton.addEventListener('click', () => {
    currentFile = null;
    currentResult = null;
    selectedDiagramId = '';
    fileInput.value = '';
    componentFilter.value = 'all';
    search.value = '';
    analyseButton.disabled = false;
    clearOutputs();
    setStatus('Ready.', null);
  });

  return () => {
    unbindDropZone();
    revokeObjectUrls();
  };
}
