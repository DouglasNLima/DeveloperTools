import { bindFileDropZone } from './file-drop-zone.js';
import { formatValuePreview } from './json-diff.js';
import { renderMermaidToSvg } from './mermaid-runtime.js';
import {
  buildClassicWorkflowDiagram,
  buildUpdatedClassicWorkflowPackage,
  compareSolutionVersions,
  inspectClassicWorkflowPackage,
  isValidSolutionVersion,
  validateClassicWorkflowReplacement
} from './power-platform-classic-workflow-package.js';

const MAX_RENDERED_CHANGES = 200;

export function renderPowerPlatformClassicWorkflowPackageEditor(container) {
  container.innerHTML = `
    <form class="tool-board power-flow-package-tool" data-tool-form>
      <div id="classicWorkflowDropZone" class="drop-zone">
        <label class="drop-zone-label" for="classicWorkflowFileInput">
          <span>Drop an exported solution ZIP here or browse</span>
          <small>Solution files and classic workflow XAML stay in this browser.</small>
        </label>
        <input id="classicWorkflowFileInput" class="drop-zone-input" type="file" accept=".zip,application/zip,application/x-zip-compressed" />
      </div>

      <div class="button-row button-row--end">
        <button id="inspectClassicWorkflowsButton" class="primary" type="button">Inspect classic workflows</button>
        <button id="clearClassicWorkflowsButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="detail-grid flow-package-summary-grid" aria-live="polite">
        <div class="detail-card"><span>Solution</span><strong id="classicWorkflowSolutionDetail">-</strong></div>
        <div class="detail-card"><span>Version</span><strong id="classicWorkflowVersionDetail">-</strong></div>
        <div class="detail-card"><span>Package type</span><strong id="classicWorkflowTypeDetail">-</strong></div>
        <div class="detail-card"><span>Classic workflows</span><strong id="classicWorkflowCountDetail">-</strong></div>
        <div class="detail-card"><span>Staged updates</span><strong id="classicWorkflowUpdatesDetail">-</strong></div>
      </div>

      <div id="classicWorkflowReadOnlyNotice" class="status-message warning" role="note" hidden></div>
      <div id="classicWorkflowArchiveWarnings" class="solution-mermaid-issue-list" aria-live="polite"></div>

      <div class="flow-package-layout">
        <section class="solution-component-panel" aria-labelledby="classicWorkflowListLabel">
          <div class="output-toolbar">
            <h2 id="classicWorkflowListLabel">Available classic workflows</h2>
            <span id="classicWorkflowShownDetail" class="pill">0 shown</span>
          </div>
          <label class="field-stack" for="classicWorkflowSearch">
            <span>Search workflows</span>
            <input id="classicWorkflowSearch" type="search" autocomplete="off" placeholder="name or ZIP path" />
          </label>
          <div id="classicWorkflowList" class="solution-component-list" aria-live="polite">
            <p class="empty-state">Load a solution export to list classic workflows.</p>
          </div>
        </section>

        <section class="flow-package-editor-panel" aria-labelledby="classicWorkflowSelectedTitle">
          <div class="output-toolbar">
            <div>
              <span class="eyebrow">Selected workflow</span>
              <h2 id="classicWorkflowSelectedTitle">No workflow selected</h2>
              <small id="classicWorkflowSelectedPath">-</small>
            </div>
            <span id="classicWorkflowSelectedState" class="pill">Original</span>
          </div>

          <div class="detail-grid flow-package-change-grid" aria-live="polite">
            <div class="detail-card"><span>Primary table</span><strong id="classicWorkflowTableDetail">-</strong></div>
            <div class="detail-card"><span>Mode</span><strong id="classicWorkflowModeDetail">-</strong></div>
            <div class="detail-card"><span>Run when</span><strong id="classicWorkflowTriggersDetail">-</strong></div>
            <div class="detail-card"><span>State</span><strong id="classicWorkflowStateDetail">-</strong></div>
          </div>

          <div class="flow-package-json-grid">
            <section class="field-stack">
              <div class="output-toolbar">
                <label for="classicWorkflowOriginalXaml">Original XAML</label>
                <div class="button-row">
                  <button id="copyClassicWorkflowOriginalButton" class="secondary" type="button" disabled>Copy original</button>
                  <a id="downloadClassicWorkflowOriginalButton" class="button secondary" href="#" download="workflow.xaml" hidden>Download XAML</a>
                </div>
              </div>
              <textarea id="classicWorkflowOriginalXaml" spellcheck="false" readonly placeholder="Select a workflow to view its exported XAML."></textarea>
            </section>

            <section class="field-stack">
              <div class="output-toolbar">
                <label for="classicWorkflowUpdatedXaml">Updated XAML</label>
                <div class="button-row">
                  <label class="button secondary flow-package-file-button" for="classicWorkflowUpdatedFileInput">Load XAML</label>
                  <input id="classicWorkflowUpdatedFileInput" class="visually-hidden" type="file" accept=".xaml,.xml,text/xml,application/xml" disabled />
                  <button id="copyClassicWorkflowUpdatedButton" class="secondary" type="button" disabled>Copy updated</button>
                  <a id="downloadClassicWorkflowUpdatedButton" class="button secondary" href="#" download="workflow-updated.xaml" hidden>Download updated</a>
                </div>
              </div>
              <textarea id="classicWorkflowUpdatedXaml" spellcheck="false" placeholder="Paste the complete updated Workflows/*.xaml content here." disabled></textarea>
            </section>
          </div>

          <div class="button-row">
            <button id="reviewClassicWorkflowButton" class="primary" type="button" disabled>Review update</button>
            <button id="stageClassicWorkflowButton" class="secondary" type="button" disabled>Stage update</button>
            <button id="removeClassicWorkflowButton" class="danger" type="button" disabled>Remove staged update</button>
          </div>

          <div class="detail-grid flow-package-change-grid" aria-live="polite">
            <div class="detail-card"><span>Added</span><strong id="classicWorkflowAddedDetail">-</strong></div>
            <div class="detail-card"><span>Removed</span><strong id="classicWorkflowRemovedDetail">-</strong></div>
            <div class="detail-card"><span>Changed</span><strong id="classicWorkflowChangedDetail">-</strong></div>
            <div class="detail-card"><span>Steps</span><strong id="classicWorkflowStepsDetail">-</strong></div>
            <div class="detail-card"><span>Conditions</span><strong id="classicWorkflowConditionsDetail">-</strong></div>
            <div class="detail-card"><span>Branches</span><strong id="classicWorkflowBranchesDetail">-</strong></div>
            <div class="detail-card"><span>Custom activities</span><strong id="classicWorkflowCustomActivitiesDetail">-</strong></div>
          </div>

          <div id="classicWorkflowIssueList" class="solution-mermaid-issue-list" aria-live="polite"></div>
          <div id="classicWorkflowDiffList" class="flow-package-diff-list" aria-live="polite">
            <p class="empty-state">Review updated XAML to compare it with the exported workflow.</p>
          </div>

          <details class="flow-package-mermaid-section">
            <summary>Workflow diagram</summary>
            <div class="button-row">
              <button id="showOriginalClassicWorkflowDiagramButton" class="secondary" type="button" disabled>Show original diagram</button>
              <button id="showUpdatedClassicWorkflowDiagramButton" class="secondary" type="button" disabled>Show updated diagram</button>
            </div>
            <div id="classicWorkflowMermaidPreview" class="mermaid-preview" aria-live="polite">
              <p class="empty-state">Choose which workflow version to render.</p>
            </div>
          </details>
        </section>
      </div>

      <section class="flow-package-build-panel" aria-labelledby="classicWorkflowBuildTitle">
        <div>
          <span class="eyebrow">Updated package</span>
          <h2 id="classicWorkflowBuildTitle">Generate solution ZIP</h2>
          <p class="hint">Only staged XAML files and the solution version will change. customizations.xml remains intact.</p>
        </div>
        <div class="form-grid form-grid--triple">
          <label class="field-stack" for="classicWorkflowTargetVersion">
            <span>Target version</span>
            <input id="classicWorkflowTargetVersion" type="text" inputmode="numeric" placeholder="1.0.0.1" disabled />
          </label>
          <div class="field-stack">
            <span>Package readiness</span>
            <strong id="classicWorkflowReadinessDetail">Load an unmanaged solution</strong>
          </div>
          <div class="button-row button-row--end">
            <button id="generateClassicWorkflowPackageButton" class="primary" type="button" disabled>Generate updated ZIP</button>
            <a id="downloadClassicWorkflowPackageButton" class="button secondary" href="#" download="updated-solution.zip" hidden>Download updated ZIP</a>
          </div>
        </div>
        <label class="checkbox-row" for="classicWorkflowRiskAcknowledgement">
          <input id="classicWorkflowRiskAcknowledgement" type="checkbox" disabled />
          <span>I understand that editing classic workflow XAML outside the Power Platform designer is unsupported and I will test the rebuilt unmanaged solution before import.</span>
        </label>
        <div id="classicWorkflowStagedList" class="flow-package-staged-list" aria-live="polite">
          <p class="empty-state">No classic workflow updates staged.</p>
        </div>
      </section>

      <div id="classicWorkflowStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const get = selector => container.querySelector(selector);
  const fileInput = get('#classicWorkflowFileInput');
  const dropZone = get('#classicWorkflowDropZone');
  const inspectButton = get('#inspectClassicWorkflowsButton');
  const clearButton = get('#clearClassicWorkflowsButton');
  const search = get('#classicWorkflowSearch');
  const workflowList = get('#classicWorkflowList');
  const selectedTitle = get('#classicWorkflowSelectedTitle');
  const selectedPath = get('#classicWorkflowSelectedPath');
  const selectedState = get('#classicWorkflowSelectedState');
  const originalXaml = get('#classicWorkflowOriginalXaml');
  const updatedXaml = get('#classicWorkflowUpdatedXaml');
  const updatedFileInput = get('#classicWorkflowUpdatedFileInput');
  const copyOriginalButton = get('#copyClassicWorkflowOriginalButton');
  const copyUpdatedButton = get('#copyClassicWorkflowUpdatedButton');
  const downloadOriginalButton = get('#downloadClassicWorkflowOriginalButton');
  const downloadUpdatedButton = get('#downloadClassicWorkflowUpdatedButton');
  const reviewButton = get('#reviewClassicWorkflowButton');
  const stageButton = get('#stageClassicWorkflowButton');
  const removeButton = get('#removeClassicWorkflowButton');
  const issueList = get('#classicWorkflowIssueList');
  const diffList = get('#classicWorkflowDiffList');
  const originalDiagramButton = get('#showOriginalClassicWorkflowDiagramButton');
  const updatedDiagramButton = get('#showUpdatedClassicWorkflowDiagramButton');
  const mermaidPreview = get('#classicWorkflowMermaidPreview');
  const targetVersion = get('#classicWorkflowTargetVersion');
  const readiness = get('#classicWorkflowReadinessDetail');
  const riskAcknowledgement = get('#classicWorkflowRiskAcknowledgement');
  const generateButton = get('#generateClassicWorkflowPackageButton');
  const downloadPackageButton = get('#downloadClassicWorkflowPackageButton');
  const stagedList = get('#classicWorkflowStagedList');
  const readOnlyNotice = get('#classicWorkflowReadOnlyNotice');
  const archiveWarnings = get('#classicWorkflowArchiveWarnings');
  const status = get('#classicWorkflowStatus');
  const details = {
    solution: get('#classicWorkflowSolutionDetail'),
    version: get('#classicWorkflowVersionDetail'),
    type: get('#classicWorkflowTypeDetail'),
    count: get('#classicWorkflowCountDetail'),
    updates: get('#classicWorkflowUpdatesDetail'),
    shown: get('#classicWorkflowShownDetail'),
    table: get('#classicWorkflowTableDetail'),
    mode: get('#classicWorkflowModeDetail'),
    triggers: get('#classicWorkflowTriggersDetail'),
    state: get('#classicWorkflowStateDetail'),
    added: get('#classicWorkflowAddedDetail'),
    removed: get('#classicWorkflowRemovedDetail'),
    changed: get('#classicWorkflowChangedDetail'),
    steps: get('#classicWorkflowStepsDetail'),
    conditions: get('#classicWorkflowConditionsDetail'),
    branches: get('#classicWorkflowBranchesDetail'),
    customActivities: get('#classicWorkflowCustomActivitiesDetail')
  };

  let currentFile = null;
  let currentArchive = null;
  let selectedWorkflowPath = '';
  let currentReview = null;
  const drafts = new Map();
  const reviews = new Map();
  const staged = new Map();
  const objectUrls = new Set();

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status-message${type ? ` ${type}` : ''}`;
  }

  function setFile(file) {
    currentFile = file;
    setStatus(file ? `${file.name} selected.` : 'Ready.', null);
  }

  function getSelectedWorkflow() {
    return currentArchive?.workflows.find(workflow => workflow.path === selectedWorkflowPath) || null;
  }

  function getFilteredWorkflows() {
    const term = search.value.trim().toLocaleLowerCase('en-GB');
    return (currentArchive?.workflows || []).filter(workflow => (
      !term || `${workflow.name} ${workflow.path}`.toLocaleLowerCase('en-GB').includes(term)
    ));
  }

  async function inspectPackage() {
    if (!currentFile) {
      setStatus('Choose an exported solution ZIP file before inspecting classic workflows.', 'error');
      return;
    }

    inspectButton.disabled = true;
    setStatus('Inspecting classic workflows locally...', null);

    try {
      currentArchive = await inspectClassicWorkflowPackage(currentFile);
      selectedWorkflowPath = currentArchive.workflows[0]?.path || '';
      drafts.clear();
      reviews.clear();
      staged.clear();
      currentReview = null;
      riskAcknowledgement.checked = false;
      targetVersion.value = currentArchive.suggestedVersion;
      renderArchive();

      if (currentArchive.readOnly) {
        setStatus('Managed solution inspected in read-only mode.', 'warning');
      } else if (currentArchive.workflows.length === 0) {
        setStatus('No Category 0 classic workflows were found in this solution.', 'warning');
      } else {
        setStatus('Classic workflows inspected successfully.', 'success');
      }
    } catch (error) {
      currentArchive = null;
      selectedWorkflowPath = '';
      clearArchiveOutput();
      setStatus(error.message || 'Unable to inspect this solution export.', 'error');
    } finally {
      inspectButton.disabled = false;
    }
  }

  function renderArchive() {
    details.solution.textContent = currentArchive.solution.name;
    details.version.textContent = currentArchive.solution.version;
    details.type.textContent = currentArchive.solution.packageType;
    details.count.textContent = currentArchive.workflows.length.toLocaleString('en-GB');
    details.updates.textContent = staged.size.toLocaleString('en-GB');
    targetVersion.disabled = currentArchive.readOnly;
    riskAcknowledgement.disabled = currentArchive.readOnly;
    readOnlyNotice.hidden = !currentArchive.readOnly;
    readOnlyNotice.textContent = currentArchive.readOnlyReason;
    archiveWarnings.innerHTML = '';
    currentArchive.warnings.forEach(message => {
      const item = document.createElement('p');
      item.className = 'warning';
      item.textContent = message;
      archiveWarnings.append(item);
    });
    renderWorkflowList();
    selectWorkflow(selectedWorkflowPath || getFilteredWorkflows()[0]?.path || '');
    renderStagedList();
    updatePackageReadiness();
  }

  function renderWorkflowList() {
    workflowList.innerHTML = '';
    const workflows = getFilteredWorkflows();
    details.shown.textContent = `${workflows.length.toLocaleString('en-GB')} shown`;

    if (workflows.length === 0) {
      workflowList.innerHTML = '<p class="empty-state">No classic workflows match the current search.</p>';
      return;
    }

    workflows.forEach(workflow => {
      const button = document.createElement('button');
      const state = readWorkflowState(workflow.path);
      button.type = 'button';
      button.className = `solution-component-card${workflow.path === selectedWorkflowPath ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', workflow.path === selectedWorkflowPath ? 'true' : 'false');
      const title = document.createElement('strong');
      title.textContent = workflow.name;
      const meta = document.createElement('span');
      meta.textContent = `${state} · ${workflow.metrics.stepCount.toLocaleString('en-GB')} step${workflow.metrics.stepCount === 1 ? '' : 's'}`;
      const source = document.createElement('small');
      source.textContent = workflow.path || 'Missing XamlFileName';
      button.append(title, meta, source);
      button.addEventListener('click', () => selectWorkflow(workflow.path));
      workflowList.append(button);
    });
  }

  function readWorkflowState(path) {
    if (staged.has(path)) {
      return 'Changed';
    }
    if (reviews.get(path)?.valid) {
      return 'Valid update';
    }
    return 'Original';
  }

  function selectWorkflow(path) {
    selectedWorkflowPath = path;
    const workflow = getSelectedWorkflow();
    currentReview = workflow ? reviews.get(path) || staged.get(path)?.validation || null : null;
    revokeUrlsByKind('xaml');
    clearDiagram();

    if (!workflow) {
      selectedTitle.textContent = 'No workflow selected';
      selectedPath.textContent = '-';
      selectedState.textContent = 'Original';
      originalXaml.value = '';
      updatedXaml.value = '';
      renderWorkflowMetadata(null);
      setEditorAvailability(null);
      renderReview(null);
      renderWorkflowList();
      return;
    }

    selectedTitle.textContent = workflow.name;
    selectedPath.textContent = workflow.path || 'Missing XamlFileName';
    selectedState.textContent = readWorkflowState(workflow.path);
    originalXaml.value = workflow.originalText;
    updatedXaml.value = drafts.get(workflow.path) ?? staged.get(workflow.path)?.validation.updatedText ?? '';
    renderWorkflowMetadata(workflow);
    setEditorAvailability(workflow);
    setXamlDownloads(workflow);
    renderReview(currentReview);
    renderWorkflowList();
  }

  function renderWorkflowMetadata(workflow) {
    details.table.textContent = workflow?.primaryEntity || '-';
    details.mode.textContent = workflow?.triggers?.mode || '-';
    details.triggers.textContent = workflow ? formatTriggers(workflow.triggers) : '-';
    details.state.textContent = workflow?.state || '-';
  }

  function setEditorAvailability(workflow) {
    const hasWorkflow = Boolean(workflow);
    const canEdit = hasWorkflow && !currentArchive?.readOnly && workflow.editable;
    originalXaml.disabled = !hasWorkflow;
    copyOriginalButton.disabled = !workflow?.originalText;
    originalDiagramButton.disabled = !workflow?.parsed;
    updatedXaml.disabled = !canEdit;
    updatedFileInput.disabled = !canEdit;
    reviewButton.disabled = !canEdit || !updatedXaml.value.trim();
    stageButton.disabled = !canEdit || !currentReview?.valid;
    removeButton.disabled = !hasWorkflow || !staged.has(workflow.path);
    copyUpdatedButton.disabled = !updatedXaml.value.trim();
    updatedDiagramButton.disabled = !currentReview?.valid;
  }

  function renderReview(review) {
    issueList.innerHTML = '';
    diffList.innerHTML = '';
    const workflow = getSelectedWorkflow();

    (workflow?.warnings || []).forEach(message => {
      const item = document.createElement('p');
      item.className = 'warning';
      item.textContent = message;
      issueList.append(item);
    });

    if (!review) {
      ['added', 'removed', 'changed', 'steps', 'conditions', 'branches', 'customActivities'].forEach(key => {
        details[key].textContent = '-';
      });
      diffList.innerHTML = '<p class="empty-state">Review updated XAML to compare it with the exported workflow.</p>';
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
    details.steps.textContent = formatMetricChange(review.originalMetrics.stepCount, review.updatedMetrics.stepCount);
    details.conditions.textContent = formatMetricChange(review.originalMetrics.conditionCount, review.updatedMetrics.conditionCount);
    details.branches.textContent = formatMetricChange(review.originalMetrics.branchCount, review.updatedMetrics.branchCount);
    details.customActivities.textContent = formatMetricChange(
      review.originalMetrics.customActivityCount,
      review.updatedMetrics.customActivityCount
    );

    if (!review.diff?.changes?.length) {
      diffList.innerHTML = '<p class="empty-state">No structural XAML differences found. Formatting and comments are ignored.</p>';
      appendLineDiff(review.diff?.lineDiff);
      return;
    }

    const structuralHeading = document.createElement('h3');
    structuralHeading.textContent = 'Structural changes';
    diffList.append(structuralHeading);

    review.diff.changes.slice(0, MAX_RENDERED_CHANGES).forEach(change => {
      const card = document.createElement('article');
      card.className = `flow-package-diff-card ${change.type}`;
      const heading = document.createElement('strong');
      heading.textContent = `${capitalise(change.type)} ${change.kind}`;
      const path = document.createElement('code');
      path.textContent = change.path;
      card.append(heading, path);

      if (change.before !== undefined) {
        const before = document.createElement('small');
        before.textContent = `Before: ${formatValuePreview(change.before)}`;
        card.append(before);
      }
      if (change.after !== undefined) {
        const after = document.createElement('small');
        after.textContent = `After: ${formatValuePreview(change.after)}`;
        card.append(after);
      }
      diffList.append(card);
    });

    if (review.diff.changes.length > MAX_RENDERED_CHANGES) {
      const omitted = document.createElement('p');
      omitted.className = 'warning';
      omitted.textContent = `${(review.diff.changes.length - MAX_RENDERED_CHANGES).toLocaleString('en-GB')} additional structural changes were omitted from this preview.`;
      diffList.append(omitted);
    }

    appendLineDiff(review.diff.lineDiff);
  }

  function appendLineDiff(lineDiff) {
    if (!lineDiff) {
      return;
    }

    const lineDetails = document.createElement('details');
    lineDetails.className = 'flow-package-line-diff';
    const summary = document.createElement('summary');
    summary.textContent = lineDiff.truncated
      ? 'Line diff omitted for this large XAML document'
      : `Line diff · ${lineDiff.summary.added.toLocaleString('en-GB')} added, ${lineDiff.summary.removed.toLocaleString('en-GB')} removed, ${lineDiff.summary.changed.toLocaleString('en-GB')} changed`;
    lineDetails.append(summary);

    if (lineDiff.truncated) {
      const warning = document.createElement('p');
      warning.className = 'warning';
      warning.textContent = lineDiff.warnings[0];
      lineDetails.append(warning);
      diffList.append(lineDetails);
      return;
    }

    const changedRows = lineDiff.rows.filter(row => row.type !== 'unchanged');

    changedRows.slice(0, 100).forEach(row => {
      const card = document.createElement('article');
      card.className = `flow-package-diff-card ${row.type}`;
      const heading = document.createElement('strong');
      const lineNumbers = [
        row.leftLineNumber ? `original ${row.leftLineNumber}` : '',
        row.rightLineNumber ? `updated ${row.rightLineNumber}` : ''
      ].filter(Boolean).join(' · ');
      heading.textContent = `${capitalise(row.type)} line${lineNumbers ? ` · ${lineNumbers}` : ''}`;
      card.append(heading);

      if (row.leftText !== undefined) {
        const before = document.createElement('code');
        before.textContent = `- ${row.leftText}`;
        card.append(before);
      }

      if (row.rightText !== undefined) {
        const after = document.createElement('code');
        after.textContent = `+ ${row.rightText}`;
        card.append(after);
      }

      lineDetails.append(card);
    });

    if (changedRows.length > 100) {
      const omitted = document.createElement('p');
      omitted.className = 'warning';
      omitted.textContent = `${(changedRows.length - 100).toLocaleString('en-GB')} additional line changes were omitted from this preview.`;
      lineDetails.append(omitted);
    }

    diffList.append(lineDetails);
  }

  function reviewUpdate() {
    const workflow = getSelectedWorkflow();
    if (!workflow) {
      return;
    }

    currentReview = validateClassicWorkflowReplacement(workflow, updatedXaml.value);
    reviews.set(workflow.path, currentReview);
    renderReview(currentReview);
    selectedState.textContent = readWorkflowState(workflow.path);
    setEditorAvailability(workflow);
    renderWorkflowList();

    if (currentReview.valid) {
      setStatus('Updated classic workflow XAML is valid and ready to stage.', 'success');
    } else {
      setStatus(currentReview.errors[0] || 'The updated XAML is not valid.', 'error');
    }
  }

  function stageUpdate() {
    const workflow = getSelectedWorkflow();
    if (!workflow || !currentReview?.valid) {
      setStatus('Review a valid classic workflow update before staging it.', 'error');
      return;
    }

    staged.set(workflow.path, {
      path: workflow.path,
      updatedText: currentReview.updatedText,
      validation: currentReview
    });
    drafts.set(workflow.path, currentReview.updatedText);
    reviews.set(workflow.path, currentReview);
    invalidatePackageDownload();
    details.updates.textContent = staged.size.toLocaleString('en-GB');
    selectedState.textContent = 'Changed';
    renderWorkflowList();
    renderStagedList();
    setEditorAvailability(workflow);
    updatePackageReadiness();
    setStatus(`${workflow.name} staged for the updated solution package.`, 'success');
  }

  function removeStagedUpdate() {
    const workflow = getSelectedWorkflow();
    if (!workflow || !staged.has(workflow.path)) {
      return;
    }

    staged.delete(workflow.path);
    reviews.delete(workflow.path);
    drafts.delete(workflow.path);
    currentReview = null;
    updatedXaml.value = '';
    invalidatePackageDownload();
    details.updates.textContent = staged.size.toLocaleString('en-GB');
    selectedState.textContent = 'Original';
    renderReview(null);
    setEditorAvailability(workflow);
    setXamlDownloads(workflow);
    renderWorkflowList();
    renderStagedList();
    updatePackageReadiness();
    setStatus(`${workflow.name} removed from the staged updates.`, 'success');
  }

  function renderStagedList() {
    stagedList.innerHTML = '';

    if (staged.size === 0) {
      stagedList.innerHTML = '<p class="empty-state">No classic workflow updates staged.</p>';
      return;
    }

    staged.forEach(item => {
      const workflow = currentArchive.workflows.find(candidate => candidate.path === item.path);
      const card = document.createElement('article');
      card.className = 'flow-package-staged-card';
      const title = document.createElement('strong');
      title.textContent = workflow?.name || item.path;
      const summary = document.createElement('span');
      const count = item.validation.diff.summary.totalChanges;
      summary.textContent = `${count.toLocaleString('en-GB')} structural change${count === 1 ? '' : 's'} · ${item.path}`;
      const selectButton = document.createElement('button');
      selectButton.className = 'secondary';
      selectButton.type = 'button';
      selectButton.textContent = 'Review';
      selectButton.addEventListener('click', () => selectWorkflow(item.path));
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
      message = 'Stage at least one workflow update';
    } else if (!isValidSolutionVersion(version)) {
      message = 'Enter major.minor.build.revision';
    } else if (!riskAcknowledgement.checked) {
      message = 'Acknowledge the unsupported editing risk';
    } else {
      try {
        ready = compareSolutionVersions(currentArchive.solution.version, version) < 0;
        message = ready
          ? `${staged.size.toLocaleString('en-GB')} update${staged.size === 1 ? '' : 's'} ready`
          : 'Target version must be higher';
      } catch {
        message = 'Enter major.minor.build.revision';
      }
    }

    readiness.textContent = message;
    generateButton.disabled = !ready;
  }

  async function generatePackage() {
    if (!currentArchive || generateButton.disabled) {
      setStatus('Stage valid updates, acknowledge the risk and enter a higher target version first.', 'error');
      return;
    }

    generateButton.disabled = true;
    setStatus('Generating and verifying the updated solution ZIP locally...', null);

    try {
      const result = await buildUpdatedClassicWorkflowPackage({
        archive: currentArchive,
        replacements: staged,
        targetVersion: targetVersion.value.trim(),
        riskAcknowledged: riskAcknowledgement.checked
      });
      invalidatePackageDownload();
      const url = createObjectUrl(new Blob([result.bytes], { type: 'application/zip' }), 'package');
      downloadPackageButton.href = url;
      downloadPackageButton.download = result.fileName;
      downloadPackageButton.textContent = `Download ${result.fileName}`;
      downloadPackageButton.hidden = false;
      setStatus(
        `Updated solution ZIP verified successfully with ${result.summary.replacementCount.toLocaleString('en-GB')} classic workflow update${result.summary.replacementCount === 1 ? '' : 's'}.`,
        'success'
      );
    } catch (error) {
      setStatus(error.message || 'Unable to generate the updated solution ZIP.', 'error');
    } finally {
      updatePackageReadiness();
    }
  }

  async function renderDiagram(useUpdated) {
    const workflow = getSelectedWorkflow();
    const review = currentReview || staged.get(workflow?.path)?.validation;
    let diagram = null;

    try {
      diagram = useUpdated ? review?.diagram : buildClassicWorkflowDiagram(workflow, workflow?.originalText);
    } catch (error) {
      setStatus(error.message || 'Unable to interpret this workflow diagram.', 'error');
      return;
    }

    if (!diagram?.mermaid) {
      setStatus(`There is no ${useUpdated ? 'updated' : 'original'} classic workflow diagram to render.`, 'error');
      return;
    }

    mermaidPreview.innerHTML = '<p class="empty-state">Rendering workflow diagram...</p>';

    try {
      const rendered = await renderMermaidToSvg(diagram.mermaid);
      mermaidPreview.innerHTML = rendered.svg;
      rendered.bindFunctions?.(mermaidPreview);
      setStatus(`${useUpdated ? 'Updated' : 'Original'} classic workflow diagram rendered successfully.`, 'success');
    } catch (error) {
      clearDiagram();
      setStatus(error.message || 'Unable to render this workflow diagram.', 'error');
    }
  }

  function clearDiagram() {
    mermaidPreview.innerHTML = '<p class="empty-state">Choose which workflow version to render.</p>';
  }

  function setXamlDownloads(workflow) {
    revokeUrlsByKind('xaml');
    downloadOriginalButton.hidden = true;
    downloadUpdatedButton.hidden = true;

    if (!workflow?.originalText) {
      return;
    }

    downloadOriginalButton.href = createObjectUrl(new Blob([workflow.originalText], { type: 'application/xml;charset=utf-8' }), 'xaml');
    downloadOriginalButton.download = fileNameFromPath(workflow.path);
    downloadOriginalButton.hidden = false;

    if (updatedXaml.value.trim()) {
      downloadUpdatedButton.href = createObjectUrl(new Blob([updatedXaml.value], { type: 'application/xml;charset=utf-8' }), 'xaml');
      downloadUpdatedButton.download = buildUpdatedXamlName(workflow.path);
      downloadUpdatedButton.hidden = false;
      copyUpdatedButton.disabled = false;
    }
  }

  function createObjectUrl(blob, kind) {
    const url = URL.createObjectURL(blob);
    objectUrls.add(JSON.stringify({ url, kind }));
    return url;
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

  function invalidatePackageDownload() {
    revokeUrlsByKind('package');
    downloadPackageButton.hidden = true;
    downloadPackageButton.removeAttribute('href');
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
      await navigator.clipboard.writeText(text);
      setStatus(successMessage, 'success');
    } catch {
      const target = text === originalXaml.value ? originalXaml : updatedXaml;
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
    workflowList.innerHTML = '<p class="empty-state">Load a solution export to list classic workflows.</p>';
    readOnlyNotice.hidden = true;
    archiveWarnings.innerHTML = '';
    targetVersion.value = '';
    targetVersion.disabled = true;
    riskAcknowledgement.checked = false;
    riskAcknowledgement.disabled = true;
    staged.clear();
    drafts.clear();
    reviews.clear();
    stagedList.innerHTML = '<p class="empty-state">No classic workflow updates staged.</p>';
    readiness.textContent = 'Load an unmanaged solution';
    generateButton.disabled = true;
    selectWorkflow('');
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
  inspectButton.addEventListener('click', inspectPackage);
  clearButton.addEventListener('click', () => {
    currentFile = null;
    currentArchive = null;
    selectedWorkflowPath = '';
    currentReview = null;
    fileInput.value = '';
    search.value = '';
    clearArchiveOutput();
    setStatus('Ready.', null);
  });
  search.addEventListener('input', () => {
    renderWorkflowList();
    if (!getFilteredWorkflows().some(workflow => workflow.path === selectedWorkflowPath)) {
      selectWorkflow(getFilteredWorkflows()[0]?.path || '');
    }
  });
  updatedXaml.addEventListener('input', () => {
    const workflow = getSelectedWorkflow();
    if (!workflow) {
      return;
    }
    drafts.set(workflow.path, updatedXaml.value);
    reviews.delete(workflow.path);
    currentReview = staged.get(workflow.path)?.validation || null;
    reviewButton.disabled = !updatedXaml.value.trim();
    stageButton.disabled = true;
    updatedDiagramButton.disabled = true;
    setXamlDownloads(workflow);
    invalidatePackageDownload();
  });
  updatedFileInput.addEventListener('change', async () => {
    const file = updatedFileInput.files?.[0];
    if (!file) {
      return;
    }
    try {
      updatedXaml.value = await file.text();
      updatedXaml.dispatchEvent(new Event('input', { bubbles: true }));
      setStatus(`${file.name} loaded as the updated classic workflow XAML.`, 'success');
    } catch {
      setStatus('Unable to read the selected XAML file.', 'error');
    } finally {
      updatedFileInput.value = '';
    }
  });
  reviewButton.addEventListener('click', reviewUpdate);
  stageButton.addEventListener('click', stageUpdate);
  removeButton.addEventListener('click', removeStagedUpdate);
  copyOriginalButton.addEventListener('click', () => copyText(
    originalXaml.value,
    'Select a workflow before copying its original XAML.',
    'Original classic workflow XAML copied to the clipboard.'
  ));
  copyUpdatedButton.addEventListener('click', () => copyText(
    updatedXaml.value,
    'Enter updated workflow XAML before copying it.',
    'Updated classic workflow XAML copied to the clipboard.'
  ));
  originalDiagramButton.addEventListener('click', () => renderDiagram(false));
  updatedDiagramButton.addEventListener('click', () => renderDiagram(true));
  targetVersion.addEventListener('input', () => {
    invalidatePackageDownload();
    updatePackageReadiness();
  });
  riskAcknowledgement.addEventListener('change', () => {
    invalidatePackageDownload();
    updatePackageReadiness();
  });
  generateButton.addEventListener('click', generatePackage);

  return () => {
    unbindDropZone();
    revokeAllUrls();
  };
}

function formatTriggers(triggers = {}) {
  const values = [
    triggers.onCreate ? 'Create' : '',
    triggers.onDelete ? 'Delete' : '',
    triggers.onUpdateAttributes?.length ? `Update: ${triggers.onUpdateAttributes.join(', ')}` : '',
    triggers.onDemand ? 'On demand' : ''
  ].filter(Boolean);
  return values.join(' · ') || 'Not specified';
}

function formatMetricChange(before, after) {
  return `${Number(before || 0).toLocaleString('en-GB')} → ${Number(after || 0).toLocaleString('en-GB')}`;
}

function fileNameFromPath(path) {
  return String(path || '').split('/').pop() || 'workflow.xaml';
}

function buildUpdatedXamlName(path) {
  return fileNameFromPath(path).replace(/\.xaml$/i, '-updated.xaml');
}

function capitalise(value) {
  const text = String(value || '');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}
