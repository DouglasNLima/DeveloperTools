const buttonResetTimers = new WeakMap();

export async function writeTextToClipboard(value, options = {}) {
  const text = String(value ?? '');
  const documentRef = options.documentRef ?? globalThis.document;
  const clipboard = options.clipboard ?? globalThis.navigator?.clipboard;
  const trigger = options.trigger ?? documentRef?.activeElement;

  try {
    if (!clipboard?.writeText) {
      throw new Error('Clipboard API unavailable.');
    }

    await clipboard.writeText(text);
  } catch (clipboardError) {
    try {
      copyWithDocumentFallback(text, documentRef);
    } catch {
      showCopyFeedback(trigger, 'Copy failed', 'error', options);
      throw clipboardError;
    }
  }

  showCopyFeedback(trigger, 'Copied', 'success', options);
}

export function showCopyFeedback(trigger, message, type = 'success', options = {}) {
  if (!isCopyButton(trigger)) {
    return;
  }

  const schedule = options.schedule ?? globalThis.setTimeout;
  const resetDelay = options.resetDelay ?? 1_800;
  const existingTimer = buttonResetTimers.get(trigger);

  if (existingTimer !== undefined && typeof globalThis.clearTimeout === 'function') {
    globalThis.clearTimeout(existingTimer);
  }

  if (!trigger.dataset.copyFeedbackLabel) {
    trigger.dataset.copyFeedbackLabel = trigger.textContent || 'Copy';
  }

  trigger.textContent = message;
  trigger.classList.remove('copy-feedback-success', 'copy-feedback-error');
  trigger.classList.add(type === 'error' ? 'copy-feedback-error' : 'copy-feedback-success');
  trigger.setAttribute('aria-live', 'polite');

  if (typeof schedule !== 'function') {
    return;
  }

  const timer = schedule(() => {
    trigger.textContent = trigger.dataset.copyFeedbackLabel || 'Copy';
    trigger.classList.remove('copy-feedback-success', 'copy-feedback-error');
    trigger.removeAttribute('aria-live');
    delete trigger.dataset.copyFeedbackLabel;
    buttonResetTimers.delete(trigger);
  }, resetDelay);
  buttonResetTimers.set(trigger, timer);
}

function copyWithDocumentFallback(text, documentRef) {
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') {
    throw new Error('Clipboard fallback unavailable.');
  }

  const fallback = documentRef.createElement('textarea');
  fallback.value = text;
  fallback.setAttribute('readonly', '');
  fallback.className = 'visually-hidden';
  documentRef.body.append(fallback);
  fallback.select();

  const copied = documentRef.execCommand('copy');
  fallback.remove();

  if (!copied) {
    throw new Error('Clipboard fallback failed.');
  }
}

function isCopyButton(value) {
  return Boolean(
    value
    && String(value.tagName || '').toLocaleLowerCase('en-GB') === 'button'
    && /copy/i.test(value.dataset?.copyFeedbackLabel || value.textContent || value.getAttribute?.('aria-label') || '')
  );
}
