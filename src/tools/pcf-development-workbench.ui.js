import { renderPowerPlatformScriptHub } from './power-platform-script-hub.ui.js';

// Compatibility renderer for callers that still use the former workbench
// module and its create/develop/build/deploy/quality mode values.
export function renderPcfDevelopmentWorkbench(container, context = {}) {
  return renderPowerPlatformScriptHub(container, {
    ...context,
    mode: 'development',
    legacyMode: context.legacyMode || context.mode
  });
}
