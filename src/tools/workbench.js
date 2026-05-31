import { buildToolHash } from './catalog.js';

export function renderToolWorkbench(container, context = {}, options = {}) {
  const modes = Array.isArray(options.modes) ? options.modes.filter(mode => mode?.id) : [];
  const activeMode = getActiveMode(modes, context.mode);
  let cleanup = null;

  container.innerHTML = '';

  const shell = document.createElement('section');
  shell.className = 'tool-workbench';

  const tabs = document.createElement('nav');
  tabs.className = 'tool-workbench-tabs';
  tabs.setAttribute('aria-label', `${context.tool?.title || 'Tool'} modes`);

  modes.forEach(mode => {
    const link = document.createElement('a');
    link.className = 'tool-workbench-tab';
    link.href = buildToolHash(context.tool, mode.id);
    link.textContent = mode.label || mode.title || mode.id;
    link.title = mode.summary || link.textContent;

    if (mode.id === activeMode?.id) {
      link.setAttribute('aria-current', 'page');
    }

    tabs.append(link);
  });

  const mount = document.createElement('div');
  mount.className = 'tool-workbench-mount';

  shell.append(tabs, mount);
  container.append(shell);

  if (typeof activeMode?.renderer === 'function') {
    cleanup = activeMode.renderer(mount, {
      ...context,
      mode: activeMode.id
    });
  }

  return () => {
    cleanup?.();
  };
}

function getActiveMode(modes, requestedMode) {
  if (modes.length === 0) {
    return null;
  }

  return modes.find(mode => mode.id === requestedMode) || modes[0];
}
