import { renderCaseConverter } from './case-converter.ui.js';
import { renderRegexTester } from './regex-tester.ui.js';
import { renderSqlFormatter } from './sql-formatter.ui.js';
import { renderSupportPackSanitiser } from './support-pack-sanitiser.ui.js';
import { renderTextDiff } from './text-diff.ui.js';
import { renderUuidGenerator } from './uuid-generator.ui.js';
import { renderToolWorkbench } from './workbench.js';

export function renderTextUtilitiesWorkbench(container, context = {}) {
  return renderToolWorkbench(container, context, {
    modes: [
      {
        id: 'regex',
        label: 'Regex',
        summary: 'Test patterns, groups and replacement previews locally.',
        renderer: renderRegexTester
      },
      {
        id: 'sql',
        label: 'SQL',
        summary: 'Format and linearise common SQL snippets.',
        renderer: renderSqlFormatter
      },
      {
        id: 'sanitise',
        label: 'Sanitise',
        summary: 'Mask sensitive values in support packs and logs.',
        renderer: renderSupportPackSanitiser
      },
      {
        id: 'diff',
        label: 'Diff',
        summary: 'Compare text with line-level changes.',
        renderer: renderTextDiff
      },
      {
        id: 'case',
        label: 'Case',
        summary: 'Convert text into common code casing styles.',
        renderer: renderCaseConverter
      },
      {
        id: 'uuid',
        label: 'UUID',
        summary: 'Generate, restore and validate UUID values.',
        renderer: renderUuidGenerator
      }
    ]
  });
}
