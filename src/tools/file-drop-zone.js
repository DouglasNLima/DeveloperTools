export function bindFileDropZone(dropZone, options = {}) {
  const {
    accept = '',
    onFile,
    onReject
  } = options;
  const acceptedRules = parseAcceptRules(accept);

  function setDragOver(event) {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  }

  function clearDragOver(event) {
    if (!event.relatedTarget || !dropZone.contains(event.relatedTarget)) {
      dropZone.classList.remove('drag-over');
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    dropZone.classList.remove('drag-over');

    const file = event.dataTransfer?.files?.[0];

    if (!file) {
      return;
    }

    if (!isAcceptedFile(file, acceptedRules)) {
      onReject?.(file);
      return;
    }

    onFile?.(file);
  }

  dropZone.addEventListener('dragenter', setDragOver);
  dropZone.addEventListener('dragover', setDragOver);
  dropZone.addEventListener('dragleave', clearDragOver);
  dropZone.addEventListener('drop', handleDrop);

  return () => {
    dropZone.removeEventListener('dragenter', setDragOver);
    dropZone.removeEventListener('dragover', setDragOver);
    dropZone.removeEventListener('dragleave', clearDragOver);
    dropZone.removeEventListener('drop', handleDrop);
  };
}

export function isAcceptedFile(file, acceptedRules = []) {
  if (!acceptedRules.length) {
    return true;
  }

  const fileName = String(file?.name ?? '').toLocaleLowerCase('en-GB');
  const fileType = String(file?.type ?? '').toLocaleLowerCase('en-GB');

  return acceptedRules.some(rule => {
    if (rule.kind === 'extension') {
      return fileName.endsWith(rule.value);
    }

    if (rule.kind === 'wildcard') {
      return fileType.startsWith(rule.value);
    }

    return fileType === rule.value;
  });
}

function parseAcceptRules(accept) {
  return String(accept ?? '')
    .split(',')
    .map(item => item.trim().toLocaleLowerCase('en-GB'))
    .filter(Boolean)
    .map(value => {
      if (value.startsWith('.')) {
        return {
          kind: 'extension',
          value
        };
      }

      if (value.endsWith('/*')) {
        return {
          kind: 'wildcard',
          value: value.slice(0, -1)
        };
      }

      return {
        kind: 'mime',
        value
      };
    });
}
