import { writeTextToClipboard } from './clipboard-feedback.js';
import { bindFileDropZone } from './file-drop-zone.js';
import { bindFileImportFeedback } from './file-import-feedback.js';
import { formatValuePreview } from './json-diff.js';
import { bindMermaidViewer } from './mermaid-viewer.ui.js';
import {
  buildFlowDiagram,
  buildUpdatedFlowPackage,
  compareSolutionVersions,
  inspectFlowPackage,
  isValidSolutionVersion,
  validateFlowReplacement
} from './power-platform-flow-package.js';
import { bindSyntaxHighlight } from './syntax-highlight.js';
import { publishHandoverValue } from './tool-handover.js';

const MAX_RENDERED_CHANGES = 200;

export function renderPowerPlatformFlowPackageEditor(container) {
  container.innerHTML = `
    <form class="tool-board power-flow-package-tool" data-tool-form>
      <div id="flowPackageDropZone" class="drop-zone">
        <label class="drop-zone-label" for="flowPackageFileInput" aria-live="polite">
          <span id="flowPackageDropTitle">Drop an exported solution ZIP here or browse</span>
          <small id="flowPackageDropHint">Solution files and flow JSON stay in this browser.</small>
        </label>
        <input id="flowPackageFileInput" class="drop-zone-input" type="file" accept=".zip,application/zip,application/x-zip-compressed" />
      </div>

      <div class="button-row button-row--end">
        <button id="analyseFlowPackageButton" class="primary" type="button">Inspect flows</button>
        <button id="clearFlowPackageButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="detail-grid flow-package-summary-grid" aria-live="polite">
        <div class="detail-card">
          <span>Solution</span>
          <strong id="flowPackageSolutionDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Version</span>
          <strong id="flowPackageVersionDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Package type</span>
          <strong id="flowPackageTypeDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Cloud flows</span>
          <strong id="flowPackageFlowsDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Staged updates</span>
          <strong id="flowPackageUpdatesDetail">-</strong>
        </div>
      </div>

      <div id="flowPackageReadOnlyNotice" class="status-message warning" role="note" hidden></div>

      <div class="flow-package-layout">
        <section class="solution-component-panel" aria-labelledby="flowPackageListLabel">
          <div class="output-toolbar">
            <h2 id="flowPackageListLabel">Available cloud flows</h2>
            <span id="flowPackageShownDetail" class="pill">0 shown</span>
          </div>
          <label class="field-stack" for="flowPackageSearch">
            <span>Search flows</span>
            <input id="flowPackageSearch" type="search" autocomplete="off" placeholder="name or ZIP path" />
          </label>
          <div id="flowPackageList" class="solution-component-list" aria-live="polite">
            <p class="empty-state">Load a solution export to list cloud flows.</p>
          </div>
        </section>

        <section class="flow-package-editor-panel" aria-labelledby="flowPackageSelectedTitle">
          <div class="output-toolbar">
            <div>
              <span class="eyebrow">Selected flow</span>
              <h2 id="flowPackageSelectedTitle">No flow selected</h2>
              <small id="flowPackageSelectedPath">-</small>
            </div>
            <span id="flowPackageSelectedState" class="pill">Original</span>
          </div>

          <div class="flow-package-json-grid">
            <section class="field-stack">
              <div class="output-toolbar">
                <label for="flowPackageOriginalJson">Original JSON</label>
                <div class="button-row">
                  <button id="copyFlowOriginalButton" class="secondary" type="button" disabled>Copy original</button>
                  <a id="downloadFlowOriginalButton" class="button secondary" href="#" download="flow.json" hidden>Download JSON</a>
                </div>
              </div>
              <textarea id="flowPackageOriginalJson" spellcheck="false" readonly placeholder="Select a flow to view its exported JSON."></textarea>
            </section>

            <section class="field-stack">
              <div class="output-toolbar">
                <label for="flowPackageUpdatedJson">Updated JSON</label>
                <div class="button-row">
                  <label class="button secondary flow-package-file-button" for="flowPackageUpdatedFileInput">Load JSON</label>
                  <input id="flowPackageUpdatedFileInput" class="visually-hidden" type="file" accept=".json,application/json,text/json" disabled />
                  <button id="copyFlowUpdatedButton" class="secondary" type="button" disabled>Copy updated</button>
                  <a id="downloadFlowUpdatedButton" class="button secondary" href="#" download="flow-updated.json" hidden>Download updated</a>
                </div>
              </div>
              <textarea id="flowPackageUpdatedJson" spellcheck="false" placeholder="Paste the complete updated Workflows/*.json content here." disabled></textarea>
            </section>
          </div>

          <div class="button-row">
            <button id="reviewFlowUpdateButton" class="primary" type="button" disabled>Review update</button>
            <button id="stageFlowUpdateButton" class="secondary" type="button" disabled>Stage update</button>
            <button id="removeFlowUpdateButton" class="danger" type="button" disabled>Remove staged update</button>
          </div>

          <div class="detail-grid flow-package-change-grid" aria-live="polite">
            <div class="detail-card">
              <span>Added</span>
              <strong id="flowPackageAddedDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Removed</span>
              <strong id="flowPackageRemovedDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Changed</span>
              <strong id="flowPackageChangedDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Triggers</span>
              <strong id="flowPackageTriggersDetail">-</strong>
            </div>
            <div class="detail-card">
              <span>Actions</span>
              <strong id="flowPackageActionsDetail">-</strong>
            </div>
          </div>

          <div id="flowPackageIssueList" class="solution-mermaid-issue-list" aria-live="polite"></div>
          <div id="flowPackageDiffList" class="flow-package-diff-list" aria-live="polite">
            <p class="empty-state">Review an updated JSON document to compare it with the exported flow.</p>
          </div>

          <details class="flow-package-mermaid-section">
            <summary>Flow diagram</summary>
            <div class="button-row">
              <button id="showOriginalFlowDiagramButton" class="secondary" type="button" disabled>Show original diagram</button>
              <button id="showUpdatedFlowDiagramButton" class="secondary" type="button" disabled>Show updated diagram</button>
            </div>
            <div id="flowPackageMermaidPreview" aria-live="polite"></div>
            <output id="flowPackageMermaidHandoverOutput" hidden></output>
          </details>
        </section>
      </div>

      <section class="flow-package-build-panel" aria-labelledby="flowPackageBuildTitle">
        <div>
          <span class="eyebrow">Updated package</span>
          <h2 id="flowPackageBuildTitle">Generate solution ZIP</h2>
          <p class="hint">Only staged flow JSON files and the solution version will change.</p>
        </div>
        <div class="form-grid form-grid--triple">
          <label class="field-stack" for="flowPackageTargetVersion">
            <span>Target version</span>
            <input id="flowPackageTargetVersion" type="text" inputmode="numeric" placeholder="1.0.0.1" disabled />
          </label>
          <div class="field-stack">
            <span>Package readiness</span>
            <strong id="flowPackageReadinessDetail">Load an unmanaged solution</strong>
          </div>
          <div class="button-row button-row--end">
            <button id="generateFlowPackageButton" class="primary" type="button" disabled>Generate updated ZIP</button>
            <a id="downloadFlowPackageButton" class="button secondary" href="#" download="updated-solution.zip" hidden>Download updated ZIP</a>
          </div>
        </div>
        <div id="flowPackageStagedList" class="flow-package-staged-list" aria-live="polite">
          <p class="empty-state">No flow updates staged.</p>
        </div>
      </section>

      <div id="flowPackageStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const fileInput = container.querySelector('#flowPackageFileInput');
  const dropZone = container.querySelector('#flowPackageDropZone');
  const analyseButton = container.querySelector('#analyseFlowPackageButton');
  const clearButton = container.querySelector('#clearFlowPackageButton');
  const search = container.querySelector('#flowPackageSearch');
  const flowList = container.querySelector('#flowPackageList');
  const selectedTitle = container.querySelector('#flowPackageSelectedTitle');
  const selectedPath = container.querySelector('#flowPackageSelectedPath');
  const selectedState = container.querySelector('#flowPackageSelectedState');
  const originalJson = container.querySelector('#flowPackageOriginalJson');
  const updatedJson = container.querySelector('#flowPackageUpdatedJson');
  const updatedFileInput = container.querySelector('#flowPackageUpdatedFileInput');
  const copyOriginalButton = container.querySelector('#copyFlowOriginalButton');
  const copyUpdatedButton = container.querySelector('#copyFlowUpdatedButton');
  const downloadOriginalButton = container.querySelector('#downloadFlowOriginalButton');
  const downloadUpdatedButton = container.querySelector('#downloadFlowUpdatedButton');
  const reviewButton = container.querySelector('#reviewFlowUpdateButton');
  const stageButton = container.querySelector('#stageFlowUpdateButton');
  const removeButton = container.querySelector('#removeFlowUpdateButton');
  const issueList = container.querySelector('#flowPackageIssueList');
  const diffList = container.querySelector('#flowPackageDiffList');
  const originalDiagramButton = container.querySelector('#showOriginalFlowDiagramButton');
  const updatedDiagramButton = container.querySelector('#showUpdatedFlowDiagramButton');
  const mermaidPreview = container.querySelector('#flowPackageMermaidPreview');
  const mermaidHandoverOutput = container.querySelector('#flowPackageMermaidHandoverOutput');
  const targetVersion = container.querySelector('#flowPackageTargetVersion');
  const readiness = container.querySelector('#flowPackageReadinessDetail');
  const generateButton = container.querySelector('#generateFlowPackageButton');
  const downloadPackageButton = container.querySelector('#downloadFlowPackageButton');
  const stagedList = container.querySelector('#flowPackageStagedList');
  const readOnlyNotice = container.querySelector('#flowPackageReadOnlyNotice');
  const status = container.querySelector('#flowPackageStatus');
  const details = {
    solution: container.querySelector('#flowPackageSolutionDetail'),
    version: container.querySelector('#flowPackageVersionDetail'),
    type: container.querySelector('#flowPackageTypeDetail'),
    flows: container.querySelector('#flowPackageFlowsDetail'),
    updates: container.querySelector('#flowPackageUpdatesDetail'),
    shown: container.querySelector('#flowPackageShownDetail'),
    added: container.querySelector('#flowPackageAddedDetail'),
    removed: container.querySelector('#flowPackageRemovedDetail'),
    changed: container.querySelector('#flowPackageChangedDetail'),
    triggers: container.querySelector('#flowPackageTriggersDetail'),
    actions: container.querySelector('#flowPackageActionsDetail')
  };

  let currentFile = null;
  let currentArchive = null;
  let selectedFlowPath = '';
  let currentReview = null;
  const drafts = new Map();
  const reviews = new Map();
  const staged = new Map();
  const objectUrls = new Set();
  const originalJsonHighlight = bindSyntaxHighlight(originalJson, { language: 'json' });
  const updatedJsonHighlight = bindSyntaxHighlight(updatedJson, { language: 'json' });
  const fileFeedback = bindFileImportFeedback(dropZone, { kind: 'ZIP' });
  const mermaidViewer = bindMermaidViewer(mermaidPreview, {
    label: 'Flow diagram',
    emptyMessage: 'Choose which flow version to render.',
    onSourceChange: value => publishHandoverValue(mermaidHandoverOutput, value),
    setStatus
  });

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function setFile(file) {
    currentFile = file;
    file ? fileFeedback.selected(file) : fileFeedback.clear();
    setStatus(file ? `${file.name} selected.` : 'Ready.', null);
  }

  function getSelectedFlow() {
    return currentArchive?.flows.find(flow => flow.path === selectedFlowPath) || null;
  }

  function getFilteredFlows() {
    const term = search.value.trim().toLocaleLowerCase('en-GB');

    return (currentArchive?.flows || []).filter(flow => (
      !term || `${flow.displayName} ${flow.name} ${flow.path}`.toLocaleLowerCase('en-GB').includes(term)
    ));
  }

  async function inspectPackage() {
    if (!currentFile) {
      setStatus('Choose an exported solution ZIP file before inspecting flows.', 'error');
      return;
    }

    analyseButton.disabled = true;
    setStatus('Inspecting the solution export locally...', null);

    try {
      currentArchive = await inspectFlowPackage(currentFile);
      selectedFlowPath = currentArchive.flows[0]?.path || '';
      drafts.clear();
      reviews.clear();
      staged.clear();
      currentReview = null;
      targetVersion.value = currentArchive.suggestedVersion;
      renderArchive();
      const count = currentArchive.flows.length;
      fileFeedback.loaded(currentFile, `Loaded successfully · ${count.toLocaleString('en-GB')} cloud flow${count === 1 ? '' : 's'} found`);

      if (currentArchive.readOnly) {
        setStatus('Managed solution inspected in read-only mode.', 'warning');
      } else if (currentArchive.flows.length === 0) {
        setStatus('No Workflows/*.json cloud flows were found in this solution.', 'warning');
      } else {
        setStatus('Cloud flows inspected successfully.', 'success');
      }
    } catch (error) {
      currentArchive = null;
      selectedFlowPath = '';
      clearArchiveOutput();
      fileFeedback.error(currentFile, 'The selected ZIP could not be inspected. Choose another file or review the error below.');
      setStatus(error.message || 'Unable to inspect this solution export.', 'error');
    } finally {
      analyseButton.disabled = false;
    }
  }

  function renderArchive() {
    if (!currentArchive) {
      clearArchiveOutput();
      return;
    }

    details.solution.textContent = currentArchive.solution.name;
    details.version.textContent = currentArchive.solution.version;
    details.type.textContent = currentArchive.solution.packageType;
    details.flows.textContent = currentArchive.flows.length.toLocaleString('en-GB');
    details.updates.textContent = staged.size.toLocaleString('en-GB');
    targetVersion.disabled = currentArchive.readOnly;
    readOnlyNotice.hidden = !currentArchive.readOnly;
    readOnlyNotice.textContent = currentArchive.readOnlyReason;
    renderFlowList();
    selectFlow(selectedFlowPath || getFilteredFlows()[0]?.path || '');
    renderStagedList();
    updatePackageReadiness();
  }

  function renderFlowList() {
    flowList.innerHTML = '';
    const flows = getFilteredFlows();
    details.shown.textContent = `${flows.length.toLocaleString('en-GB')} shown`;

    if (flows.length === 0) {
      flowList.innerHTML = '<p class="empty-state">No cloud flows match the current search.</p>';
      return;
    }

    flows.forEach(flow => {
      const button = document.createElement('button');
      const state = readFlowState(flow.path);
      button.type = 'button';
      button.className = `solution-component-card${flow.path === selectedFlowPath ? ' selected' : ''}`;
      button.dataset.flowPath = flow.path;
      button.setAttribute('aria-pressed', flow.path === selectedFlowPath ? 'true' : 'false');

      const title = document.createElement('strong');
      title.textContent = flow.displayName;
      const meta = document.createElement('span');
      meta.textContent = `${state} · ${flow.metrics.actionCount.toLocaleString('en-GB')} action${flow.metrics.actionCount === 1 ? '' : 's'}`;
      const source = document.createElement('small');
      source.textContent = flow.path;
      source.title = flow.path;
      button.append(title, meta, source);
      button.addEventListener('click', () => selectFlow(flow.path));
      flowList.append(button);
    });
  }

  function readFlowState(path) {
    if (staged.has(path)) {
      return 'Changed';
    }

    if (reviews.get(path)?.valid) {
      return 'Valid update';
    }

    return 'Original';
  }

  function selectFlow(path) {
    selectedFlowPath = path;
    const flow = getSelectedFlow();
    currentReview = flow ? reviews.get(flow.path) || staged.get(flow.path)?.validation || null : null;
    revokeJsonUrls();
    clearDiagram();

    if (!flow) {
      selectedTitle.textContent = 'No flow selected';
      selectedPath.textContent = '-';
      selectedState.textContent = 'Original';
      originalJson.value = '';
      updatedJson.value = '';
      publishHandoverValue(originalJson, '');
      setEditorAvailability(null);
      renderReview(null);
      renderFlowList();
      return;
    }

    selectedTitle.textContent = flow.displayName;
    selectedPath.textContent = flow.path;
    selectedState.textContent = readFlowState(flow.path);
    originalJson.value = flow.originalText;
    updatedJson.value = drafts.get(flow.path) ?? staged.get(flow.path)?.validation.updatedText ?? '';
    publishHandoverValue(originalJson, originalJson.value);
    setEditorAvailability(flow);
    setJsonDownloads(flow);
    renderReview(currentReview);
    renderFlowList();
  }

  function setEditorAvailability(flow) {
    const hasFlow = Boolean(flow);
    const canEdit = hasFlow && !currentArchive?.readOnly && flow.editable;
    originalJson.disabled = !hasFlow;
    copyOriginalButton.disabled = !hasFlow;
    originalDiagramButton.disabled = !flow?.definition;
    updatedJson.disabled = !canEdit;
    updatedFileInput.disabled = !canEdit;
    reviewButton.disabled = !canEdit || !updatedJson.value.trim();
    stageButton.disabled = !canEdit || !currentReview?.valid;
    removeButton.disabled = !hasFlow || !staged.has(flow.path);
    copyUpdatedButton.disabled = !updatedJson.value.trim();
    updatedDiagramButton.disabled = !currentReview?.valid;
  }

  function renderReview(review) {
    issueList.innerHTML = '';
    diffList.innerHTML = '';

    if (!review) {
      details.added.textContent = '-';
      details.removed.textContent = '-';
      details.changed.textContent = '-';
      details.triggers.textContent = '-';
      details.actions.textContent = '-';
      diffList.innerHTML = '<p class="empty-state">Review an updated JSON document to compare it with the exported flow.</p>';
      return;
    }

    [...review.errors, ...review.warnings].forEach(message => {
      const item = document.createElement('p');
      item.className = review.errors.includes(message) ? 'error' : 'warning';
      item.textContent = message;
      issueList.append(item);
    });

    const summary = review.diff?.summary;
    details.added.textContent = summary ? summary.added.toLocaleString('en-GB') : '-';
    details.removed.textContent = summary ? summary.removed.toLocaleString('en-GB') : '-';
    details.changed.textContent = summary ? summary.changed.toLocaleString('en-GB') : '-';
    details.triggers.textContent = review.definition
      ? `${review.originalMetrics.triggerCount.toLocaleString('en-GB')} → ${review.updatedMetrics.triggerCount.toLocaleString('en-GB')}`
      : '-';
    details.actions.textContent = review.definition
      ? `${review.originalMetrics.actionCount.toLocaleString('en-GB')} → ${review.updatedMetrics.actionCount.toLocaleString('en-GB')}`
      : '-';

    if (!review.diff?.changes?.length) {
      diffList.innerHTML = '<p class="empty-state">No structural JSON differences found.</p>';
      return;
    }

    review.diff.changes.slice(0, MAX_RENDERED_CHANGES).forEach(change => {
      const card = document.createElement('article');
      card.className = `flow-package-diff-card ${change.type}`;
      const heading = document.createElement('strong');
      heading.textContent = `${capitalise(change.type)} ${change.path}`;
      const message = document.createElement('span');
      message.textContent = change.message;
      card.append(heading, message);

      if ('leftValue' in change) {
        const before = document.createElement('code');
        before.textContent = `Original: ${formatValuePreview(change.leftValue)}`;
        card.append(before);
      }

      if ('rightValue' in change) {
        const after = document.createElement('code');
        after.textContent = `Updated: ${formatValuePreview(change.rightValue)}`;
        card.append(after);
      }

      diffList.append(card);
    });

    if (review.diff.changes.length > MAX_RENDERED_CHANGES) {
      const omitted = document.createElement('p');
      omitted.className = 'hint';
      omitted.textContent = `${review.diff.changes.length - MAX_RENDERED_CHANGES} additional changes are not shown.`;
      diffList.append(omitted);
    }
  }

  function reviewUpdate() {
    const flow = getSelectedFlow();

    if (!flow) {
      setStatus('Select a cloud flow before reviewing an update.', 'error');
      return;
    }

    const review = validateFlowReplacement(flow, updatedJson.value);
    drafts.set(flow.path, updatedJson.value);
    reviews.set(flow.path, review);
    currentReview = review;
    renderReview(review);
    setEditorAvailability(flow);
    setJsonDownloads(flow);
    renderFlowList();
    selectedState.textContent = readFlowState(flow.path);

    if (review.valid) {
      setStatus('Updated flow JSON is valid and ready to stage.', 'success');
    } else {
      setStatus(review.errors[0] || 'Review the updated flow JSON.', 'error');
    }
  }

  function stageUpdate() {
    const flow = getSelectedFlow();

    if (!flow || !currentReview?.valid) {
      setStatus('Review a valid flow update before staging it.', 'error');
      return;
    }

    staged.set(flow.path, {
      path: flow.path,
      updatedText: currentReview.updatedText,
      validation: currentReview
    });
    reviews.set(flow.path, currentReview);
    drafts.set(flow.path, currentReview.updatedText);
    invalidatePackageDownload();
    details.updates.textContent = staged.size.toLocaleString('en-GB');
    selectedState.textContent = 'Changed';
    removeButton.disabled = false;
    renderFlowList();
    renderStagedList();
    updatePackageReadiness();
    setStatus(`${flow.displayName} staged for the updated solution package.`, 'success');
  }

  function removeStagedUpdate() {
    const flow = getSelectedFlow();

    if (!flow || !staged.has(flow.path)) {
      return;
    }

    staged.delete(flow.path);
    reviews.delete(flow.path);
    drafts.delete(flow.path);
    currentReview = null;
    updatedJson.value = '';
    invalidatePackageDownload();
    details.updates.textContent = staged.size.toLocaleString('en-GB');
    selectedState.textContent = 'Original';
    renderReview(null);
    setEditorAvailability(flow);
    setJsonDownloads(flow);
    renderFlowList();
    renderStagedList();
    updatePackageReadiness();
    setStatus(`${flow.displayName} removed from the staged updates.`, 'success');
  }

  function renderStagedList() {
    stagedList.innerHTML = '';

    if (staged.size === 0) {
      stagedList.innerHTML = '<p class="empty-state">No flow updates staged.</p>';
      return;
    }

    staged.forEach(item => {
      const flow = currentArchive.flows.find(candidate => candidate.path === item.path);
      const card = document.createElement('article');
      card.className = 'flow-package-staged-card';
      const title = document.createElement('strong');
      title.textContent = flow?.displayName || item.path;
      const summary = document.createElement('span');
      const count = item.validation.diff.summary.totalChanges;
      summary.textContent = `${count.toLocaleString('en-GB')} structural change${count === 1 ? '' : 's'} · ${item.path}`;
      const selectButton = document.createElement('button');
      selectButton.className = 'secondary';
      selectButton.type = 'button';
      selectButton.textContent = 'Review';
      selectButton.addEventListener('click', () => selectFlow(item.path));
      card.append(title, summary, selectButton);
      stagedList.append(card);
    });
  }

  function updatePackageReadiness() {
    const version = targetVersion.value.trim();
    let message = 'Load an unmanaged solution';
    let ready = false;

    if (currentArchive?.readOnly) {
      message = 'Managed solution · read only';
    } else if (currentArchive?.packagingErrors.length) {
      message = currentArchive.packagingErrors[0];
    } else if (staged.size === 0) {
      message = 'Stage at least one flow update';
    } else if (!isValidSolutionVersion(version)) {
      message = 'Enter major.minor.build.revision';
    } else {
      try {
        ready = compareSolutionVersions(currentArchive.solution.version, version) < 0;
        message = ready ? `${staged.size.toLocaleString('en-GB')} update${staged.size === 1 ? '' : 's'} ready` : 'Target version must be higher';
      } catch {
        message = 'Enter major.minor.build.revision';
      }
    }

    readiness.textContent = message;
    generateButton.disabled = !ready;
  }

  async function generatePackage() {
    if (!currentArchive || generateButton.disabled) {
      setStatus('Stage valid updates and enter a higher target version first.', 'error');
      return;
    }

    generateButton.disabled = true;
    setStatus('Generating and verifying the updated solution ZIP locally...', null);

    try {
      const result = await buildUpdatedFlowPackage({
        archive: currentArchive,
        replacements: staged,
        targetVersion: targetVersion.value.trim()
      });
      invalidatePackageDownload();
      const url = createObjectUrl(new Blob([result.bytes], { type: 'application/zip' }));
      downloadPackageButton.href = url;
      downloadPackageButton.download = result.fileName;
      downloadPackageButton.textContent = `Download ${result.fileName}`;
      downloadPackageButton.hidden = false;
      setStatus(
        `Updated solution ZIP verified successfully with ${result.summary.replacementCount.toLocaleString('en-GB')} flow update${result.summary.replacementCount === 1 ? '' : 's'}.`,
        'success'
      );
    } catch (error) {
      setStatus(error.message || 'Unable to generate the updated solution ZIP.', 'error');
    } finally {
      updatePackageReadiness();
    }
  }

  async function renderDiagram(useUpdated) {
    const flow = getSelectedFlow();
    const review = currentReview || staged.get(flow?.path)?.validation;
    const diagram = useUpdated ? review?.diagram : buildFlowDiagram(flow);

    if (!diagram?.mermaid) {
      setStatus(`There is no ${useUpdated ? 'updated' : 'original'} flow diagram to render.`, 'error');
      return;
    }

    mermaidViewer.setLoading('Rendering flow diagram...');

    try {
      const rendered = await mermaidViewer.render(diagram.mermaid, {
        fileName: buildFlowDiagramName(flow.path, useUpdated)
      });

      if (!rendered) {
        return;
      }

      setStatus(`${useUpdated ? 'Updated' : 'Original'} flow diagram rendered successfully.`, 'success');
    } catch (error) {
      clearDiagram();
      setStatus(error.message || 'Unable to render this flow diagram.', 'error');
    }
  }

  function clearDiagram() {
    mermaidViewer.clear('Choose which flow version to render.');
  }

  function setJsonDownloads(flow) {
    revokeJsonUrls();

    if (!flow) {
      return;
    }

    const originalUrl = createObjectUrl(new Blob([flow.originalText], { type: 'application/json;charset=utf-8' }), 'json');
    downloadOriginalButton.href = originalUrl;
    downloadOriginalButton.download = fileNameFromPath(flow.path);
    downloadOriginalButton.hidden = false;

    if (updatedJson.value.trim()) {
      const updatedUrl = createObjectUrl(new Blob([updatedJson.value], { type: 'application/json;charset=utf-8' }), 'json');
      downloadUpdatedButton.href = updatedUrl;
      downloadUpdatedButton.download = buildUpdatedJsonName(flow.path);
      downloadUpdatedButton.hidden = false;
      copyUpdatedButton.disabled = false;
    } else {
      downloadUpdatedButton.hidden = true;
      downloadUpdatedButton.removeAttribute('href');
      copyUpdatedButton.disabled = true;
    }
  }

  function createObjectUrl(blob, kind = 'package') {
    const url = URL.createObjectURL(blob);
    objectUrls.add(JSON.stringify({ url, kind }));
    return url;
  }

  function revokeJsonUrls() {
    revokeUrlsByKind('json');
    downloadOriginalButton.hidden = true;
    downloadOriginalButton.removeAttribute('href');
    downloadUpdatedButton.hidden = true;
    downloadUpdatedButton.removeAttribute('href');
  }

  function invalidatePackageDownload() {
    revokeUrlsByKind('package');
    downloadPackageButton.hidden = true;
    downloadPackageButton.removeAttribute('href');
  }

  function revokeUrlsByKind(kind) {
    [...objectUrls].forEach(recordText => {
      const record = JSON.parse(recordText);

      if (record.kind === kind) {
        URL.revokeObjectURL(record.url);
        objectUrls.delete(recordText);
      }
    });
  }

  function revokeAllUrls() {
    [...objectUrls].forEach(recordText => URL.revokeObjectURL(JSON.parse(recordText).url));
    objectUrls.clear();
  }

  async function copyText(text, emptyMessage, successMessage) {
    if (!text) {
      setStatus(emptyMessage, 'error');
      return;
    }

    try {
      await writeTextToClipboard(text);
      setStatus(successMessage, 'success');
    } catch {
      const target = text === originalJson.value ? originalJson : updatedJson;
      target.focus();
      target.select();
      document.execCommand('copy');
      setStatus(`${successMessage} Browser fallback used.`, 'success');
    }
  }

  function clearArchiveOutput() {
    revokeAllUrls();
    Object.values(details).forEach(detail => {
      detail.textContent = '-';
    });
    details.shown.textContent = '0 shown';
    details.updates.textContent = '-';
    flowList.innerHTML = '<p class="empty-state">Load a solution export to list cloud flows.</p>';
    readOnlyNotice.hidden = true;
    targetVersion.value = '';
    targetVersion.disabled = true;
    staged.clear();
    drafts.clear();
    reviews.clear();
    stagedList.innerHTML = '<p class="empty-state">No flow updates staged.</p>';
    readiness.textContent = 'Load an unmanaged solution';
    generateButton.disabled = true;
    selectFlow('');
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
  analyseButton.addEventListener('click', inspectPackage);
  clearButton.addEventListener('click', () => {
    currentFile = null;
    currentArchive = null;
    selectedFlowPath = '';
    currentReview = null;
    fileInput.value = '';
    search.value = '';
    clearArchiveOutput();
    fileFeedback.clear();
    setStatus('Ready.', null);
  });
  search.addEventListener('input', () => {
    renderFlowList();

    if (!getFilteredFlows().some(flow => flow.path === selectedFlowPath)) {
      selectFlow(getFilteredFlows()[0]?.path || '');
    }
  });
  updatedJson.addEventListener('input', () => {
    const flow = getSelectedFlow();

    if (!flow) {
      return;
    }

    drafts.set(flow.path, updatedJson.value);
    reviews.delete(flow.path);
    currentReview = staged.get(flow.path)?.validation || null;
    reviewButton.disabled = !updatedJson.value.trim();
    stageButton.disabled = true;
    updatedDiagramButton.disabled = true;
    setJsonDownloads(flow);
    invalidatePackageDownload();
  });
  updatedFileInput.addEventListener('change', async () => {
    const file = updatedFileInput.files?.[0];

    if (!file) {
      return;
    }

    try {
      updatedJson.value = await file.text();
      updatedJson.dispatchEvent(new Event('input', { bubbles: true }));
      setStatus(`${file.name} loaded as the updated flow JSON.`, 'success');
    } catch {
      setStatus('Unable to read the selected JSON file.', 'error');
    } finally {
      updatedFileInput.value = '';
    }
  });
  reviewButton.addEventListener('click', reviewUpdate);
  stageButton.addEventListener('click', stageUpdate);
  removeButton.addEventListener('click', removeStagedUpdate);
  copyOriginalButton.addEventListener('click', () => copyText(
    originalJson.value,
    'Select a flow before copying its original JSON.',
    'Original flow JSON copied to the clipboard.'
  ));
  copyUpdatedButton.addEventListener('click', () => copyText(
    updatedJson.value,
    'Enter updated flow JSON before copying it.',
    'Updated flow JSON copied to the clipboard.'
  ));
  originalDiagramButton.addEventListener('click', () => renderDiagram(false));
  updatedDiagramButton.addEventListener('click', () => renderDiagram(true));
  targetVersion.addEventListener('input', () => {
    invalidatePackageDownload();
    updatePackageReadiness();
  });
  generateButton.addEventListener('click', generatePackage);

  return () => {
    unbindDropZone();
    originalJsonHighlight.destroy();
    updatedJsonHighlight.destroy();
    mermaidViewer.destroy();
    revokeAllUrls();
  };
}

function fileNameFromPath(path) {
  return String(path || '').split('/').pop() || 'flow.json';
}

function buildUpdatedJsonName(path) {
  return fileNameFromPath(path).replace(/\.json$/i, '-updated.json');
}

function buildFlowDiagramName(path, useUpdated) {
  return fileNameFromPath(path).replace(/\.json$/i, `-${useUpdated ? 'updated' : 'original'}-diagram`);
}

function capitalise(value) {
  const text = String(value || '');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}
