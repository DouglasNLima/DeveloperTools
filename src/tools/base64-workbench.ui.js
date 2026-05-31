import { renderBase64ToFile, renderFileToBase64 } from './base64.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderBase64FileConverter(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'base64-to-file',
        label: 'Base64 to file',
        summary: 'Create a downloadable file from pasted Base64 content.',
        renderer: renderBase64ToFile
      },
      {
        id: 'file-to-base64',
        label: 'File to Base64',
        summary: 'Encode a local file as raw Base64 or a Data URL.',
        renderer: renderFileToBase64
      }
    ]
  });
}
