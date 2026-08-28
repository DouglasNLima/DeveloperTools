import { renderPowerPlatformScriptHub } from './power-platform-script-hub.ui.js';

// Compatibility renderer for callers that still import the original PCF UI
// module. The visible application now uses the unified Script Hub renderer.
export function renderPcfScriptCommandBuilder(container, context = {}) {
  return renderPowerPlatformScriptHub(container, {
    ...context,
    mode: 'development',
    legacyMode: context.legacyMode || context.mode
  });
}
