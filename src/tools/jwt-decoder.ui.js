import { decodeJwt } from './jwt-decoder.js';
import { bindSyntaxHighlight } from './syntax-highlight.js';

export function renderJwtDecoder(container) {
  container.innerHTML = `
    <form class="tool-board" data-tool-form>
      <div class="field-stack">
        <label for="jwtInput">JWT input</label>
        <textarea id="jwtInput" spellcheck="false" placeholder="Paste a JWT or Bearer token here."></textarea>
        <p class="hint">Decoding stays in this browser. Signature verification is not performed by this tool.</p>
      </div>

      <div class="button-row">
        <button id="decodeJwtButton" class="primary" type="button">Decode JWT</button>
        <button id="clearJwtButton" class="secondary" type="button">Clear</button>
      </div>

      <div class="form-grid form-grid--split">
        <div class="field-stack">
          <label for="jwtHeaderOutput">Decoded header</label>
          <textarea id="jwtHeaderOutput" spellcheck="false" readonly placeholder="The decoded JWT header will appear here."></textarea>
        </div>

        <div class="field-stack">
          <label for="jwtPayloadOutput">Decoded payload</label>
          <textarea id="jwtPayloadOutput" spellcheck="false" readonly placeholder="The decoded JWT payload will appear here."></textarea>
        </div>
      </div>

      <div class="output-toolbar">
        <label for="jwtPayloadOutput">Payload output</label>
        <div class="button-row">
          <button id="copyJwtPayloadButton" class="primary" type="button" disabled>Copy payload</button>
          <a id="downloadJwtButton" class="button secondary" href="#" download="decoded-jwt.json" hidden>Download decoded JSON</a>
        </div>
      </div>

      <div class="detail-grid" aria-live="polite">
        <div class="detail-card">
          <span>Token status</span>
          <strong id="jwtStatusDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Algorithm</span>
          <strong id="jwtAlgorithmDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Subject</span>
          <strong id="jwtSubjectDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Audience</span>
          <strong id="jwtAudienceDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Expires</span>
          <strong id="jwtExpiresDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Scopes / roles</span>
          <strong id="jwtAccessDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Signature</span>
          <strong id="jwtSignatureDetail">-</strong>
        </div>
        <div class="detail-card">
          <span>Warnings</span>
          <strong id="jwtWarningsDetail">-</strong>
        </div>
      </div>

      <div id="jwtWarningList" class="jwt-warning-list" aria-live="polite"></div>
      <div id="jwtStatus" class="status-message" role="status" aria-live="polite">Ready.</div>
    </form>
  `;

  const input = container.querySelector('#jwtInput');
  const decodeButton = container.querySelector('#decodeJwtButton');
  const clearButton = container.querySelector('#clearJwtButton');
  const copyButton = container.querySelector('#copyJwtPayloadButton');
  const downloadButton = container.querySelector('#downloadJwtButton');
  const headerOutput = container.querySelector('#jwtHeaderOutput');
  const payloadOutput = container.querySelector('#jwtPayloadOutput');
  const statusDetail = container.querySelector('#jwtStatusDetail');
  const algorithmDetail = container.querySelector('#jwtAlgorithmDetail');
  const subjectDetail = container.querySelector('#jwtSubjectDetail');
  const audienceDetail = container.querySelector('#jwtAudienceDetail');
  const expiresDetail = container.querySelector('#jwtExpiresDetail');
  const accessDetail = container.querySelector('#jwtAccessDetail');
  const signatureDetail = container.querySelector('#jwtSignatureDetail');
  const warningsDetail = container.querySelector('#jwtWarningsDetail');
  const warningList = container.querySelector('#jwtWarningList');
  const status = container.querySelector('#jwtStatus');
  const headerHighlight = bindSyntaxHighlight(headerOutput, { language: 'json' });
  const payloadHighlight = bindSyntaxHighlight(payloadOutput, { language: 'json' });

  let currentObjectUrl = null;
  let currentExport = '';

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
    statusDetail.textContent = '-';
    algorithmDetail.textContent = '-';
    subjectDetail.textContent = '-';
    audienceDetail.textContent = '-';
    expiresDetail.textContent = '-';
    accessDetail.textContent = '-';
    signatureDetail.textContent = '-';
    warningsDetail.textContent = '-';
    warningList.innerHTML = '';
  }

  function setDetails(result) {
    statusDetail.textContent = result.timing.label;
    algorithmDetail.textContent = result.header.alg || '-';
    subjectDetail.textContent = result.claims.subject;
    audienceDetail.textContent = result.claims.audienceLabel;
    expiresDetail.textContent = result.timing.expiresAtLabel;
    accessDetail.textContent = [result.claims.scopesLabel, result.claims.rolesLabel].filter(value => value !== '-').join(' / ') || '-';
    signatureDetail.textContent = result.signature.present ? `${result.signature.length.toLocaleString('en-GB')} characters` : 'Empty';
    warningsDetail.textContent = result.warnings.length === 0 ? 'None' : `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
    setWarningList(result.warnings);
  }

  function setWarningList(warnings) {
    warningList.innerHTML = '';

    warnings.forEach(warning => {
      const item = document.createElement('p');
      item.textContent = warning;
      warningList.append(item);
    });
  }

  function setOutput(result) {
    headerHighlight.setLanguage('json');
    payloadHighlight.setLanguage('json');
    headerOutput.value = result.headerJson;
    payloadOutput.value = result.payloadJson;
    currentExport = result.exportJson;
    copyButton.disabled = false;
    setDetails(result);
    revokeObjectUrl();

    const blob = new Blob([currentExport], { type: 'application/json;charset=utf-8' });
    currentObjectUrl = URL.createObjectURL(blob);
    downloadButton.href = currentObjectUrl;
    downloadButton.download = 'decoded-jwt.json';
    downloadButton.textContent = 'Download decoded-jwt.json';
    downloadButton.hidden = false;
  }

  function handleDecode() {
    try {
      const result = decodeJwt(input.value);

      setOutput(result);
      setStatus(buildSuccessMessage('JWT decoded successfully.', result), 'success');
    } catch (error) {
      headerHighlight.setLanguage('plain');
      payloadHighlight.setLanguage('plain');
      headerOutput.value = '';
      payloadOutput.value = '';
      currentExport = '';
      copyButton.disabled = true;
      revokeObjectUrl();
      resetDetails();
      setStatus(error.message || 'Unable to decode this JWT.', 'error');
    }
  }

  async function copyPayload() {
    if (!payloadOutput.value || copyButton.disabled) {
      setStatus('There is no decoded payload to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(payloadOutput.value);
      setStatus('Decoded payload copied to the clipboard.', 'success');
    } catch {
      payloadOutput.focus();
      payloadOutput.select();
      document.execCommand('copy');
      setStatus('Decoded payload selected and copied using the browser fallback.', 'success');
    }
  }

  decodeButton.addEventListener('click', handleDecode);
  copyButton.addEventListener('click', copyPayload);

  clearButton.addEventListener('click', () => {
    input.value = '';
    headerHighlight.setLanguage('json');
    payloadHighlight.setLanguage('json');
    headerOutput.value = '';
    payloadOutput.value = '';
    currentExport = '';
    copyButton.disabled = true;
    revokeObjectUrl();
    resetDetails();
    setStatus('Ready.', null);
    input.focus();
  });

  return () => {
    headerHighlight.destroy();
    payloadHighlight.destroy();
    revokeObjectUrl();
  };
}

function buildSuccessMessage(message, result) {
  const importantWarning = result.warnings.find(warning => !warning.startsWith('Decode only')) || result.warnings[0];

  if (!importantWarning) {
    return message;
  }

  return `${message} ${importantWarning}`;
}
