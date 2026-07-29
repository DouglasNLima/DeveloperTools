import { buildMermaidDownloadFileName } from './mermaid.js';

export const MERMAID_VIEWER_MIN_ZOOM = 0.25;
export const MERMAID_VIEWER_MAX_ZOOM = 4;

export function clampMermaidViewerZoom(value) {
  const zoom = Number(value);

  if (!Number.isFinite(zoom)) {
    return 1;
  }

  return Math.min(MERMAID_VIEWER_MAX_ZOOM, Math.max(MERMAID_VIEWER_MIN_ZOOM, zoom));
}

export function calculateMermaidFitTransform(viewport, diagram, options = {}) {
  const viewportWidth = positiveNumber(viewport?.width);
  const viewportHeight = positiveNumber(viewport?.height);
  const diagramWidth = positiveNumber(diagram?.width);
  const diagramHeight = positiveNumber(diagram?.height);
  const padding = Math.max(0, Number(options.padding ?? 24));
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - padding * 2);
  const zoom = clampMermaidViewerZoom(Math.min(
    availableWidth / diagramWidth,
    availableHeight / diagramHeight,
    Number(options.maxZoom ?? 1)
  ));

  return {
    zoom,
    x: (viewportWidth - diagramWidth * zoom) / 2,
    y: (viewportHeight - diagramHeight * zoom) / 2
  };
}

export function calculateMermaidZoomTransform(transform, nextZoom, anchor) {
  const currentZoom = clampMermaidViewerZoom(transform?.zoom);
  const zoom = clampMermaidViewerZoom(nextZoom);
  const x = Number(transform?.x) || 0;
  const y = Number(transform?.y) || 0;
  const anchorX = Number(anchor?.x) || 0;
  const anchorY = Number(anchor?.y) || 0;
  const contentX = (anchorX - x) / currentZoom;
  const contentY = (anchorY - y) / currentZoom;

  return {
    zoom,
    x: anchorX - contentX * zoom,
    y: anchorY - contentY * zoom
  };
}

export function buildMermaidViewerFileNames(name) {
  return {
    source: buildMermaidDownloadFileName(name, 'mmd'),
    svg: buildMermaidDownloadFileName(name, 'svg'),
    png: buildMermaidDownloadFileName(name, 'png')
  };
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 1;
}
