export function bindFileImportFeedback(dropZone, options = {}) {
  const label = dropZone?.querySelector?.('.drop-zone-label');
  const title = label?.querySelector?.('span');
  const hint = label?.querySelector?.('small');
  const initialTitle = title?.textContent || options.emptyTitle || 'Choose a file';
  const initialHint = hint?.textContent || options.emptyHint || 'Files stay in this browser.';
  const kind = String(options.kind || 'File').trim() || 'File';
  let currentFiles = [];

  label?.setAttribute?.('aria-live', 'polite');

  function update(files, state, message = '') {
    currentFiles = normaliseFiles(files, currentFiles);
    const hasFiles = currentFiles.length > 0;

    dropZone.classList.toggle('has-file', hasFiles);
    dropZone.classList.toggle('is-loading', state === 'loading');
    dropZone.classList.toggle('is-loaded', state === 'loaded');
    dropZone.classList.toggle('has-error', state === 'error');

    if (!hasFiles) {
      if (state === 'error' && message) {
        title.textContent = options.errorTitle || 'File could not be loaded';
        hint.textContent = message;
        return;
      }

      title.textContent = initialTitle;
      hint.textContent = initialHint;
      return;
    }

    title.textContent = formatFileSelectionTitle(currentFiles);
    hint.textContent = message || formatFileImportState(currentFiles, {
      kind,
      state
    });
  }

  return {
    clear() {
      currentFiles = [];
      update([], 'empty');
    },
    error(files, message) {
      update(files, 'error', message);
    },
    loaded(files, message) {
      update(files, 'loaded', message);
    },
    loading(files, message) {
      update(files, 'loading', message);
    },
    selected(files, message) {
      update(files, 'selected', message);
    }
  };
}

export function formatFileImportState(files, options = {}) {
  const list = normaliseFiles(files);
  const kind = String(options.kind || 'File').trim() || 'File';
  const state = options.state || 'selected';
  const count = list.length;
  const size = formatFileSize(list.reduce((total, file) => total + (Number(file?.size) || 0), 0));
  const subject = count === 1
    ? kind
    : `${count.toLocaleString('en-GB')} ${pluraliseKind(kind)}`;

  if (state === 'loading') {
    return `${subject} selected · ${size} · loading locally`;
  }

  if (state === 'loaded') {
    return `${subject} loaded successfully · ${size}`;
  }

  if (state === 'error') {
    return `${subject} could not be loaded`;
  }

  return `${subject} selected · ${size} · ready to process`;
}

export function formatFileSelectionTitle(files) {
  const list = normaliseFiles(files);

  if (list.length === 1) {
    return list[0]?.name || 'Selected file';
  }

  return `${list.length.toLocaleString('en-GB')} files selected`;
}

export function formatFileSize(value) {
  const bytes = Math.max(0, Number(value) || 0);

  if (bytes < 1024) {
    return `${bytes.toLocaleString('en-GB')} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}

function normaliseFiles(files, fallback = []) {
  if (files === undefined) {
    return fallback;
  }

  if (!files) {
    return [];
  }

  if (typeof files.length === 'number' && typeof files !== 'string' && !files.name) {
    return Array.from(files).filter(Boolean);
  }

  return [files];
}

function pluraliseKind(kind) {
  let plural;

  if (/[^aeiou]y$/i.test(kind)) {
    plural = `${kind.slice(0, -1)}ies`;
  } else if (/s$/i.test(kind)) {
    plural = kind;
  } else {
    plural = `${kind}s`;
  }

  if (kind === kind.toLocaleUpperCase('en-GB')) {
    return plural;
  }

  return plural.charAt(0).toLocaleLowerCase('en-GB') + plural.slice(1);
}
