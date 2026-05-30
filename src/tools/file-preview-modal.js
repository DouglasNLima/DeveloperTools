import {
  TEXT_PREVIEW_BYTE_LIMIT,
  formatTextPreview,
  formatBytes,
  getFilePreviewKind
} from './base64.js';

const previewKindLabels = {
  audio: 'Audio preview',
  image: 'Image preview',
  pdf: 'PDF preview',
  text: 'Text preview',
  unsupported: 'File details',
  video: 'Video preview'
};

let nextFilePreviewId = 0;

export function openFilePreviewModal(container, options) {
  const documentRef = container.ownerDocument || document;
  const {
    blob,
    downloadUrl,
    fileInfo,
    fileName,
    objectUrl,
    previewKind: previewKindOverride,
    revokeObjectUrlOnClose = false,
    trigger
  } = options;
  const mimeType = fileInfo?.mimeType || blob.type || 'application/octet-stream';
  const previewKind = previewKindOverride || getFilePreviewKind(mimeType);
  const dialog = documentRef.createElement('dialog');
  const shell = documentRef.createElement('div');
  const header = documentRef.createElement('header');
  const titleBlock = documentRef.createElement('div');
  const kicker = documentRef.createElement('p');
  const title = documentRef.createElement('h2');
  const metadata = documentRef.createElement('p');
  const closeButton = documentRef.createElement('button');
  const body = documentRef.createElement('div');
  const titleId = `filePreviewTitle${nextFilePreviewId += 1}`;

  dialog.className = 'file-preview-dialog';
  dialog.setAttribute('aria-labelledby', titleId);
  shell.className = 'file-preview-shell';
  header.className = 'file-preview-header';
  kicker.className = 'eyebrow';
  kicker.textContent = 'File preview';
  title.id = titleId;
  title.textContent = fileName || 'Converted file';
  metadata.className = 'file-preview-meta';
  metadata.textContent = `${fileInfo?.label || previewKindLabels[previewKind]} - ${mimeType} - ${formatBytes(blob.size)}`;
  closeButton.className = 'secondary file-preview-close';
  closeButton.type = 'button';
  closeButton.textContent = 'Close preview';
  closeButton.setAttribute('aria-label', 'Close preview');
  body.className = 'file-preview-body';
  body.append(createPreviewMessage(documentRef, 'Preparing preview...'));

  titleBlock.append(kicker, title, metadata);
  header.append(titleBlock, closeButton);
  shell.append(header, body);
  dialog.append(shell);
  documentRef.body.append(dialog);

  let closed = false;

  function cleanup() {
    if (closed) {
      return;
    }

    closed = true;
    dialog.remove();

    if (revokeObjectUrlOnClose && objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    if (trigger && documentRef.contains(trigger)) {
      trigger.focus();
    }
  }

  function closeDialog() {
    if (closed) {
      return;
    }

    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
      return;
    }

    cleanup();
  }

  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('close', cleanup, { once: true });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) {
      return;
    }

    const rect = dialog.getBoundingClientRect();
    const isInsideDialog = event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;

    if (!isInsideDialog) {
      closeDialog();
    }
  });

  try {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  } catch {
    dialog.setAttribute('open', '');
  }

  closeButton.focus({ preventScroll: true });

  renderFilePreviewContent({
    blob,
    body,
    documentRef,
    downloadUrl,
    fileName,
    mimeType,
    objectUrl,
    previewKind
  }).catch(error => {
    if (!body.isConnected) {
      return;
    }

    body.replaceChildren(createPreviewFallback(documentRef, {
      downloadUrl,
      fileName,
      message: error.message || 'Preview is not available for this file type.',
      mimeType
    }));
  });

  return closeDialog;
}

async function renderFilePreviewContent(options) {
  const {
    blob,
    body,
    documentRef,
    downloadUrl,
    fileName,
    mimeType,
    objectUrl,
    previewKind
  } = options;

  if (previewKind === 'text') {
    const truncated = blob.size > TEXT_PREVIEW_BYTE_LIMIT;
    const text = await blob.slice(0, TEXT_PREVIEW_BYTE_LIMIT).text();
    const preview = formatTextPreview(text, mimeType, truncated);
    const wrapper = documentRef.createElement('div');
    const pre = documentRef.createElement('pre');

    wrapper.className = 'file-preview-text-shell';

    if (preview.truncated) {
      const hint = documentRef.createElement('p');
      hint.className = 'file-preview-note';
      hint.textContent = 'Preview limited to the first 256 KB.';
      wrapper.append(hint);
    }

    pre.className = 'file-preview-text';
    pre.textContent = preview.text || '(empty file)';
    wrapper.append(pre);
    body.replaceChildren(wrapper);
    return;
  }

  if (previewKind === 'image') {
    const image = documentRef.createElement('img');
    image.alt = fileName ? `Preview of ${fileName}` : 'File preview';
    image.className = 'file-preview-media';
    image.src = objectUrl;
    body.replaceChildren(image);
    return;
  }

  if (previewKind === 'pdf') {
    const frame = documentRef.createElement('iframe');
    frame.className = 'file-preview-frame';
    frame.title = fileName ? `Preview of ${fileName}` : 'PDF preview';
    frame.src = objectUrl;
    body.replaceChildren(frame);
    return;
  }

  if (previewKind === 'audio') {
    const audio = documentRef.createElement('audio');
    audio.className = 'file-preview-media file-preview-audio';
    audio.controls = true;
    audio.src = objectUrl;
    body.replaceChildren(audio);
    return;
  }

  if (previewKind === 'video') {
    const video = documentRef.createElement('video');
    video.className = 'file-preview-media';
    video.controls = true;
    video.src = objectUrl;
    body.replaceChildren(video);
    return;
  }

  body.replaceChildren(createPreviewFallback(documentRef, {
    downloadUrl,
    fileName,
    message: 'Preview is not available for this file type.',
    mimeType
  }));
}

function createPreviewFallback(documentRef, { downloadUrl, fileName, message, mimeType }) {
  const wrapper = documentRef.createElement('div');
  const title = documentRef.createElement('strong');
  const details = documentRef.createElement('p');

  wrapper.className = 'file-preview-fallback';
  title.textContent = 'Preview unavailable';
  details.textContent = `${message} MIME type: ${mimeType || 'application/octet-stream'}.`;
  wrapper.append(title, details);

  if (downloadUrl) {
    const downloadLink = documentRef.createElement('a');
    downloadLink.className = 'button secondary';
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName || 'converted.bin';
    downloadLink.textContent = 'Download file';
    wrapper.append(downloadLink);
  }

  return wrapper;
}

function createPreviewMessage(documentRef, message) {
  const paragraph = documentRef.createElement('p');
  paragraph.className = 'file-preview-message';
  paragraph.textContent = message;
  return paragraph;
}
