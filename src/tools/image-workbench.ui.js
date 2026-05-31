import { renderImageConverter } from './image-converter.ui.js';
import { renderImageResizerCompressor } from './image-resizer.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderImageConverterOptimiser(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'convert',
        label: 'Convert',
        summary: 'Convert local SVG, PNG, JPEG and WebP images.',
        renderer: renderImageConverter
      },
      {
        id: 'optimise',
        label: 'Optimise',
        summary: 'Resize and compress local images.',
        renderer: renderImageResizerCompressor
      }
    ]
  });
}
