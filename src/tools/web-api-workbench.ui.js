import { renderCronRruleBuilder } from './cron-rrule-builder.ui.js';
import { renderCurlFetchConverter } from './curl-fetch-converter.ui.js';
import { renderJwtDecoder } from './jwt-decoder.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderWebApiWorkbench(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'jwt',
        label: 'JWT',
        summary: 'Decode JWT headers and payload claims locally.',
        renderer: renderJwtDecoder
      },
      {
        id: 'schedule',
        label: 'Schedules',
        summary: 'Build Cron and RRULE schedules with timezone notes.',
        renderer: renderCronRruleBuilder
      },
      {
        id: 'request',
        label: 'Requests',
        summary: 'Convert common cURL commands and fetch snippets.',
        renderer: renderCurlFetchConverter
      }
    ]
  });
}
