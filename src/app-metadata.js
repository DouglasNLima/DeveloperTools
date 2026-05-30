export const APP_NAME = 'Developer Tools';
export const APP_VERSION = '0.1.0';
export const APP_BUILD = '17';

export const APP_TITLE = formatAppTitle({
  name: APP_NAME,
  version: APP_VERSION,
  build: APP_BUILD
});

export function formatAppTitle({ name = APP_NAME, version = APP_VERSION, build = APP_BUILD } = {}) {
  return `${name} v${version} (build ${build})`;
}
