const IMAGE_HANDOVER_STORAGE_KEY = 'developer-tools-image-handover';

export function storeImageHandover(payload, storage = getSessionStorage()) {
  if (!storage || !payload?.targetToolId || !payload?.fileName || !(payload.bytes instanceof Uint8Array)) {
    throw new Error('A target tool, file name and image bytes are required for an image handover.');
  }

  storage.setItem(IMAGE_HANDOVER_STORAGE_KEY, JSON.stringify({
    targetToolId: payload.targetToolId,
    fileName: payload.fileName,
    mimeType: payload.mimeType || 'application/octet-stream',
    bytes: Array.from(payload.bytes)
  }));
}

export function consumeImageHandover(targetToolId, storage = getSessionStorage()) {
  if (!storage) return null;

  const raw = storage.getItem(IMAGE_HANDOVER_STORAGE_KEY);
  if (!raw) return null;

  let payload;

  try {
    payload = JSON.parse(raw);
  } catch {
    storage.removeItem(IMAGE_HANDOVER_STORAGE_KEY);
    return null;
  }

  if (payload?.targetToolId !== targetToolId) {
    return null;
  }

  storage.removeItem(IMAGE_HANDOVER_STORAGE_KEY);

  if (!payload.fileName || !Array.isArray(payload.bytes)) {
    return null;
  }

  const bytes = Uint8Array.from(payload.bytes.filter(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255));

  if (typeof File !== 'function') {
    return {
      fileName: payload.fileName,
      mimeType: payload.mimeType || 'application/octet-stream',
      bytes
    };
  }

  return {
    file: new File([bytes], payload.fileName, {
      type: payload.mimeType || 'application/octet-stream'
    }),
    fileName: payload.fileName,
    mimeType: payload.mimeType || 'application/octet-stream',
    bytes
  };
}

function getSessionStorage() {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
