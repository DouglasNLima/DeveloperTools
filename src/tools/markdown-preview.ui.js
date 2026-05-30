import {
  analyseMarkdown,
  renderMarkdownPreview
} from './markdown.js';
import { renderMermaidToSvg } from './mermaid-runtime.js';

export function renderMarkdownPreviewInspector(container) {
  container.innerHTML = `
    <form class="tool-board markdown-tool" data-tool-form>
      <div class="button-row button-row--end">
        <button id="renderMarkdownButton" class="primary" type="button">Render Markdown</button>
        <button id="clearMarkdownButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="field-stack">
        <label for="markdownInput">Markdown input</label>
        <textarea id="markdownInput" spellcheck="false" placeholder="# Release notes&#10;&#10;See the [guide](https://example.test).&#10;&#10;\`\`\`mermaid&#10;flowchart TD&#10;  Draft --> Review&#10;\`\`\`"></textarea>
      </div>

      <div class="output-toolbar">
        <label for="markdownPreview">Preview</label>
        <div class="button-row">
          <button id="copyMarkdownButton" class="primary" type="button" disabled>Copy Markdown</button>
          <a id="downloadMarkdownButton" class="button secondary" href="#" download="markdown-preview.md" hidden>Download Markdown</a>
        </div>
      </div>

      <div id="markdownPreview" class="markdown-preview" aria-live="polite">
        <p class="empty-state">Render Markdown to preview it here.</p>
      </div>

      <textarea id="markdownMermaidOutput" spellcheck="false" readonly hidden></textarea>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Headings</span>
          <strong id="markdownHeadingDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Links</span>
          <strong id="markdownLinkDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Images</span>
          <strong id="markdownImageDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Code fences</span>
          <strong id="markdownFenceDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Mermaid blocks</span>
          <strong id="markdownMermaidDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Words</span>
          <strong id="markdownWordDetail">-</strong>
        </div>
      </div>

      <div class="markdown-inspector-grid">
        <section class="markdown-inspector-panel" aria-labelledby="markdownOutlineTitle">
          <h2 id="markdownOutlineTitle">Outline</h2>
          <div id="markdownOutline" class="markdown-inspector-list">
            <p class="empty-state">No headings found.</p>
          </div>
        </section>

        <section class="markdown-inspector-panel" aria-labelledby="markdownReferencesTitle">
          <h2 id="markdownReferencesTitle">References</h2>
          <div id="markdownReferences" class="markdown-inspector-list">
            <p class="empty-state">No links or images found.</p>
          </div>
        </section>
      </div>

      <div id="markdownStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const input = container.querySelector('#markdownInput');
  const renderButton = container.querySelector('#renderMarkdownButton');
  const clearButton = container.querySelector('#clearMarkdownButton');
  const copyButton = container.querySelector('#copyMarkdownButton');
  const downloadButton = container.querySelector('#downloadMarkdownButton');
  const preview = container.querySelector('#markdownPreview');
  const mermaidOutput = container.querySelector('#markdownMermaidOutput');
  const outline = container.querySelector('#markdownOutline');
  const references = container.querySelector('#markdownReferences');
  const headingDetail = container.querySelector('#markdownHeadingDetail');
  const linkDetail = container.querySelector('#markdownLinkDetail');
  const imageDetail = container.querySelector('#markdownImageDetail');
  const fenceDetail = container.querySelector('#markdownFenceDetail');
  const mermaidDetail = container.querySelector('#markdownMermaidDetail');
  const wordDetail = container.querySelector('#markdownWordDetail');
  const status = container.querySelector('#markdownStatus');

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
    headingDetail.textContent = '-';
    linkDetail.textContent = '-';
    imageDetail.textContent = '-';
    fenceDetail.textContent = '-';
    mermaidDetail.textContent = '-';
    wordDetail.textContent = '-';
  }

  function setDetails(result) {
    headingDetail.textContent = result.outline.length.toLocaleString('en-GB');
    linkDetail.textContent = result.links.length.toLocaleString('en-GB');
    imageDetail.textContent = result.images.length.toLocaleString('en-GB');
    fenceDetail.textContent = result.codeFences.length.toLocaleString('en-GB');
    mermaidDetail.textContent = result.mermaidBlocks.length.toLocaleString('en-GB');
    wordDetail.textContent = result.wordCount.toLocaleString('en-GB');
  }

  function setDownload(result) {
    revokeObjectUrl();
    const blob = new Blob([result.source], { type: 'text/markdown;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'markdown-preview.md';
    downloadButton.textContent = 'Download markdown-preview.md';
    downloadButton.hidden = false;
  }

  async function handleRender() {
    renderButton.disabled = true;
    setStatus('Rendering Markdown locally...', null);

    try {
      const result = renderMarkdownPreview({ input: input.value });
      preview.innerHTML = result.html || '<p class="empty-state">The Markdown preview is empty.</p>';
      mermaidOutput.value = result.mermaidBlocks[0]?.source || '';
      copyButton.disabled = false;
      setDetails(result);
      setDownload(result);
      renderOutline(result);
      renderReferences(result);
      dispatchControlEvents(mermaidOutput);

      const mermaidRenderWarnings = await renderEmbeddedMermaid(result);
      const warnings = [...result.warnings, ...mermaidRenderWarnings];
      setStatus(buildSuccessMessage(result, warnings), warnings.length ? null : 'success');
    } catch (error) {
      preview.innerHTML = '<p class="empty-state">The Markdown could not be rendered.</p>';
      mermaidOutput.value = '';
      copyButton.disabled = !input.value.trim();
      revokeObjectUrl();
      resetDetails();
      renderOutline(analyseMarkdown(input.value));
      renderReferences(analyseMarkdown(input.value));
      dispatchControlEvents(mermaidOutput);
      setStatus(error.message || 'Unable to render this Markdown.', 'error');
    } finally {
      renderButton.disabled = false;
    }
  }

  async function renderEmbeddedMermaid(result) {
    const warnings = [];

    for (let index = 0; index < result.mermaidBlocks.length; index += 1) {
      const block = result.mermaidBlocks[index];
      const mount = preview.querySelector(`[data-mermaid-index="${index}"]`);

      if (!mount) {
        continue;
      }

      try {
        const rendered = await renderMermaidToSvg(block.source, { theme: 'default' });
        mount.innerHTML = [
          '<figcaption>Mermaid diagram</figcaption>',
          rendered.svg
        ].join('');
        rendered.bindFunctions?.(mount);
      } catch {
        warnings.push('A Mermaid block could not be rendered.');
      }
    }

    return warnings;
  }

  function renderOutline(result) {
    if (result.outline.length === 0) {
      outline.innerHTML = '<p class="empty-state">No headings found.</p>';
      return;
    }

    outline.innerHTML = `
      <ol class="markdown-outline-list">
        ${result.outline.map(item => `
          <li style="--heading-level: ${item.level}">
            <strong>${escapeHtml(item.text)}</strong>
            <span>Line ${item.line.toLocaleString('en-GB')}</span>
          </li>
        `).join('')}
      </ol>
    `;
  }

  function renderReferences(result) {
    const items = [
      ...result.links.map(link => ({ kind: 'Link', label: link.label, url: link.url })),
      ...result.images.map(image => ({ kind: 'Image', label: image.alt || 'Image', url: image.url }))
    ];

    if (items.length === 0) {
      references.innerHTML = '<p class="empty-state">No links or images found.</p>';
      return;
    }

    references.innerHTML = `
      <div class="markdown-reference-list">
        ${items.map(item => `
          <div class="markdown-reference-item">
            <span>${item.kind}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <code>${escapeHtml(item.url)}</code>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function copyMarkdown() {
    if (!input.value.trim()) {
      setStatus('There is no Markdown to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(input.value);
      setStatus('Markdown copied to the clipboard.', 'success');
    } catch {
      input.focus();
      input.select();
      document.execCommand('copy');
      setStatus('Markdown selected and copied using the browser fallback.', 'success');
    }
  }

  input.addEventListener('input', () => {
    const result = analyseMarkdown(input.value);
    copyButton.disabled = !result.source;
    setDetails(result);
    renderOutline(result);
    renderReferences(result);
  });
  renderButton.addEventListener('click', handleRender);
  copyButton.addEventListener('click', copyMarkdown);
  clearButton.addEventListener('click', () => {
    input.value = '';
    mermaidOutput.value = '';
    preview.innerHTML = '<p class="empty-state">Render Markdown to preview it here.</p>';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    outline.innerHTML = '<p class="empty-state">No headings found.</p>';
    references.innerHTML = '<p class="empty-state">No links or images found.</p>';
    dispatchControlEvents(mermaidOutput);
    setStatus('Ready.', null);
    input.focus();
  });

  return () => revokeObjectUrl();
}

function buildSuccessMessage(result, warnings) {
  const message = `Markdown rendered with ${result.outline.length.toLocaleString('en-GB')} heading${result.outline.length === 1 ? '' : 's'}.`;

  if (warnings.length === 0) {
    return message;
  }

  return `${message} ${warnings[0]}`;
}

function dispatchControlEvents(control) {
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
