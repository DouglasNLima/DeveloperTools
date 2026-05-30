import { formatBytes } from './base64.js';

const JAVASCRIPT_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const DOTTED_IDENTIFIER = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
const GUID_PATTERN = /\{?[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\}?/gi;
const URL_PATTERN = /https?:\/\/[^\s'"`<>),]+/gi;

export const FORM_EVENT_TYPES = [
  { value: 'onload', label: 'OnLoad' },
  { value: 'onsave', label: 'OnSave' },
  { value: 'onchange', label: 'OnChange' },
  { value: 'subgrid', label: 'Subgrid load' }
];

export const XRM_WEBAPI_OPERATIONS = [
  { value: 'retrieveRecord', label: 'Retrieve record' },
  { value: 'retrieveMultipleRecords', label: 'Retrieve multiple records' },
  { value: 'createRecord', label: 'Create record' },
  { value: 'updateRecord', label: 'Update record' },
  { value: 'deleteRecord', label: 'Delete record' }
];

export const FORM_VALIDATION_RULES = [
  { value: 'required', label: 'Required field' },
  { value: 'maxLength', label: 'Maximum length' },
  { value: 'regex', label: 'Regex pattern' }
];

export const COMMAND_BAR_CONTEXTS = [
  { value: 'form', label: 'Form command' },
  { value: 'grid', label: 'Grid command' }
];

export function analyseModelDrivenJavaScript(options = {}) {
  const source = normaliseJavaScriptSource(options.source, 'Paste a JavaScript web resource to review.');
  const fileName = String(options.fileName || 'web-resource.js').trim() || 'web-resource.js';
  const functions = extractFunctionCandidates(source);
  const findings = [
    ...findDeprecatedXrmPageUsage(source),
    ...findHandlerContextRisks(source, functions),
    ...findUnsafeAttributeAccess(source),
    ...findWebApiHandlingRisks(source),
    ...findHardCodedEnvironmentValues(source),
    ...findGlobalNamespaceRisks(source, functions),
    ...findDomAccessRisks(source)
  ];
  const sortedFindings = findings.sort(compareFindings);
  const reportMarkdown = buildJavaScriptReviewMarkdown({
    fileName,
    source,
    findings: sortedFindings,
    functions
  });
  const outputBytes = new TextEncoder().encode(reportMarkdown).length;

  return {
    fileName,
    functions,
    findings: sortedFindings,
    reportMarkdown,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    summary: summariseFindings(sortedFindings)
  };
}

export function buildClientApiMigrationReport(options = {}) {
  const source = normaliseJavaScriptSource(options.source, 'Paste legacy model-driven app JavaScript to review.');
  const analysis = analyseModelDrivenJavaScript({ source, fileName: options.fileName || 'legacy-web-resource.js' });
  const replacements = collectMigrationSuggestions(source);
  const handlerSnippet = buildMigrationHandlerSkeleton(options);
  const reportMarkdown = buildMigrationMarkdown({
    analysis,
    replacements,
    handlerSnippet
  });
  const outputBytes = new TextEncoder().encode(reportMarkdown).length;

  return {
    analysis,
    replacements,
    handlerSnippet,
    reportMarkdown,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    summary: {
      replacementCount: replacements.length,
      findingCount: analysis.findings.length,
      highCount: analysis.summary.high
    }
  };
}

export function buildFormEventHandlerSnippet(options = {}) {
  const eventType = normaliseChoice(options.eventType, FORM_EVENT_TYPES, 'onload');
  const namespace = normaliseDottedIdentifier(options.namespace, 'Contoso.ModelDriven');
  const functionName = normaliseIdentifier(options.functionName, `${eventType}Handler`);
  const fieldName = normaliseOptionalLogicalName(options.fieldName);
  const controlName = normaliseOptionalLogicalName(options.controlName || fieldName);
  const code = buildEventHandlerCode({ eventType, namespace, functionName, fieldName, controlName });
  const checklist = buildEventHandlerChecklist({ eventType, namespace, functionName });
  const output = `${code}\n\n${checklist}`;
  const warnings = [];

  if ((eventType === 'onchange' || eventType === 'onsave') && !fieldName) {
    warnings.push('Add the field logical name before registering this handler on a real form.');
  }

  return buildSnippetResult({
    output,
    code,
    warnings,
    outputType: `${getChoiceLabel(eventType, FORM_EVENT_TYPES)} handler`,
    summary: {
      eventType,
      namespace,
      functionName,
      warningCount: warnings.length
    }
  });
}

export function buildXrmWebApiSnippet(options = {}) {
  const operation = normaliseChoice(options.operation, XRM_WEBAPI_OPERATIONS, 'retrieveRecord');
  const entityName = normaliseLogicalName(options.entityName, 'Enter the Dataverse table logical name.');
  const recordId = String(options.recordId || '').trim();
  const select = normaliseCsvList(options.select);
  const filter = String(options.filter || '').trim();
  const dataJson = String(options.dataJson || '').trim();
  const functionName = normaliseIdentifier(options.functionName, `${operation}Sample`);
  const parsedData = parseOptionalJson(dataJson, operation);
  const warnings = buildWebApiWarnings({ operation, recordId, select, filter, parsedData });
  const code = buildWebApiCode({
    operation,
    entityName,
    recordId,
    select,
    filter,
    parsedData,
    functionName
  });
  const output = [
    code,
    '',
    '## Review checklist',
    '',
    ...warnings.map(warning => `- ${warning}`),
    ...(warnings.length === 0 ? ['- Review table permissions, column names and business rules before publishing.'] : [])
  ].join('\n');

  return buildSnippetResult({
    output,
    code,
    warnings,
    outputType: getChoiceLabel(operation, XRM_WEBAPI_OPERATIONS),
    summary: {
      operation,
      entityName,
      warningCount: warnings.length
    }
  });
}

export function buildFormValidationSnippet(options = {}) {
  const namespace = normaliseDottedIdentifier(options.namespace, 'Contoso.ModelDriven');
  const functionName = normaliseIdentifier(options.functionName, 'validateField');
  const fieldName = normaliseLogicalName(options.fieldName, 'Enter the field logical name to validate.');
  const ruleType = normaliseChoice(options.ruleType, FORM_VALIDATION_RULES, 'required');
  const message = String(options.message || 'Check this field before saving.').trim();
  const notificationId = normaliseIdentifier(options.notificationId || `${fieldName}_validation`, 'field_validation');
  const maxLength = parsePositiveInteger(options.maxLength, 'Maximum length must be a positive whole number.', true);
  const pattern = String(options.pattern || '').trim();
  const runOnSave = Boolean(options.runOnSave);
  const warnings = [];

  if (ruleType === 'maxLength' && !maxLength) {
    throw new Error('Enter the maximum allowed length.');
  }

  if (ruleType === 'regex' && !pattern) {
    throw new Error('Enter the regex pattern to validate.');
  }

  if (ruleType === 'regex') {
    try {
      new RegExp(pattern);
    } catch {
      throw new Error('Enter a valid JavaScript regex pattern.');
    }
  }

  if (!runOnSave) {
    warnings.push('Register this on OnSave as well if invalid values must block saving.');
  }

  const code = buildValidationCode({
    namespace,
    functionName,
    fieldName,
    ruleType,
    message,
    notificationId,
    maxLength,
    pattern,
    runOnSave
  });
  const output = [
    code,
    '',
    '## Registration checklist',
    '',
    `- Register ${namespace}.${functionName} on the relevant field OnChange event.`,
    ...(runOnSave ? [`- Register ${namespace}.${functionName} on the form OnSave event and tick Pass execution context.`] : []),
    '- Publish and smoke-test create, update and read-only form states.',
    ...warnings.map(warning => `- Warning: ${warning}`)
  ].join('\n');

  return buildSnippetResult({
    output,
    code,
    warnings,
    outputType: getChoiceLabel(ruleType, FORM_VALIDATION_RULES),
    summary: {
      ruleType,
      fieldName,
      warningCount: warnings.length
    }
  });
}

export function buildCommandBarJavaScriptSnippet(options = {}) {
  const contextType = normaliseChoice(options.contextType, COMMAND_BAR_CONTEXTS, 'form');
  const namespace = normaliseDottedIdentifier(options.namespace, 'Contoso.Commands');
  const functionName = normaliseIdentifier(options.functionName, 'runCommand');
  const entityName = normaliseOptionalLogicalName(options.entityName);
  const useConfirmation = Boolean(options.useConfirmation);
  const includeWebApiUpdate = Boolean(options.includeWebApiUpdate);
  const warnings = [];

  if (includeWebApiUpdate && !entityName) {
    throw new Error('Enter the table logical name for the Web API update.');
  }

  if (!useConfirmation && includeWebApiUpdate) {
    warnings.push('Consider adding a confirmation dialog before updating records from a command.');
  }

  const code = buildCommandCode({
    contextType,
    namespace,
    functionName,
    entityName,
    useConfirmation,
    includeWebApiUpdate
  });
  const output = [
    code,
    '',
    '## Command registration checklist',
    '',
    contextType === 'form'
      ? '- Pass PrimaryControl to the JavaScript action.'
      : '- Pass SelectedControl to the JavaScript action for grid commands.',
    '- Keep command visibility rules aligned with table permissions and form state.',
    '- Publish the command bar and test with users who have minimal privileges.',
    ...warnings.map(warning => `- Warning: ${warning}`)
  ].join('\n');

  return buildSnippetResult({
    output,
    code,
    warnings,
    outputType: getChoiceLabel(contextType, COMMAND_BAR_CONTEXTS),
    summary: {
      contextType,
      includeWebApiUpdate,
      warningCount: warnings.length
    }
  });
}

export function normaliseJavaScriptSource(input, emptyMessage = 'Enter JavaScript source.') {
  const source = String(input ?? '').trim();

  if (!source) {
    throw new Error(emptyMessage);
  }

  return source;
}

export function extractFunctionCandidates(source) {
  const functions = [];
  const seen = new Set();
  const patterns = [
    /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g,
    /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
    /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*:\s*(?:async\s+)?function\s*\(([^)]*)\)/g
  ];

  patterns.forEach(pattern => {
    let match = pattern.exec(source);

    while (match) {
      const name = match[1];
      const key = `${name}:${match.index}`;

      if (!seen.has(key)) {
        seen.add(key);
        functions.push({
          name,
          parameters: splitParameters(match[2]),
          line: getLineNumber(source, match.index),
          index: match.index
        });
      }

      match = pattern.exec(source);
    }
  });

  return functions.sort((left, right) => left.index - right.index);
}

function findDeprecatedXrmPageUsage(source) {
  return collectPatternFindings(source, /\bXrm\.Page\b/g, match => ({
    severity: 'high',
    code: 'deprecated-xrm-page',
    title: 'Deprecated Xrm.Page usage',
    message: `${match[0]} is still supported for compatibility, but modern handlers should use executionContext.getFormContext().`,
    recommendation: 'Pass execution context to the event handler and read const formContext = executionContext.getFormContext();.'
  }));
}

function findHandlerContextRisks(source, functions) {
  return functions
    .filter(candidate => {
      const body = readFunctionBody(source, candidate.index);
      const parameterText = candidate.parameters.join(' ').toLocaleLowerCase('en-GB');
      const usesFormApi = /\b(getAttribute|getControl|data\.entity|ui\.setFormNotification|Xrm\.Page)\b/.test(body);

      return usesFormApi && !/(executioncontext|formcontext|primarycontrol|selectedcontrol)/.test(parameterText);
    })
    .map(candidate => ({
      severity: 'medium',
      code: 'missing-context-parameter',
      title: 'Handler may be missing form context',
      message: `${candidate.name} uses form APIs but does not declare an executionContext, formContext or command context parameter.`,
      recommendation: 'Register the handler with Pass execution context enabled, or pass PrimaryControl/SelectedControl for command actions.',
      line: candidate.line
    }));
}

function findUnsafeAttributeAccess(source) {
  const findings = [];
  const patterns = [
    /\b(?:formContext|Xrm\.Page)\.getAttribute\(([^)]*)\)\.(getValue|setValue|setRequiredLevel|addOnChange|removeOnChange)\b/g,
    /\b(?:formContext|Xrm\.Page)\.getControl\(([^)]*)\)\.(setVisible|setDisabled|setNotification|clearNotification|addNotification)\b/g
  ];

  patterns.forEach(pattern => {
    let match = pattern.exec(source);

    while (match) {
      findings.push({
        severity: 'medium',
        code: 'unguarded-form-member',
        title: 'Unguarded form member access',
        message: `Direct ${match[0]} access can fail when the field or control is removed from this form.`,
        recommendation: 'Store the attribute or control in a variable and check it before reading or writing values.',
        line: getLineNumber(source, match.index)
      });
      match = pattern.exec(source);
    }
  });

  return findings;
}

function findWebApiHandlingRisks(source) {
  const findings = [];
  const pattern = /\bXrm\.WebApi(?:\.(?:online|offline))?\.(createRecord|retrieveRecord|retrieveMultipleRecords|updateRecord|deleteRecord|execute|executeMultiple)\b/g;
  let match = pattern.exec(source);

  while (match) {
    const statement = readStatement(source, match.index);
    const preceding = source.slice(Math.max(0, match.index - 180), match.index);
    const hasAwait = /\bawait\b/.test(statement);
    const hasThen = /\.then\s*\(/.test(statement);
    const hasCatch = /\.catch\s*\(/.test(statement) || /\bcatch\s*\(/.test(source.slice(match.index, match.index + 500));
    const hasTry = /\btry\s*\{[\s\S]*$/.test(preceding);

    if (!hasAwait && !hasThen) {
      findings.push({
        severity: 'high',
        code: 'unhandled-webapi-promise',
        title: 'Unhandled Xrm.WebApi promise',
        message: `${match[1]} returns a promise that is not awaited or chained.`,
        recommendation: 'Use await inside try/catch, or return the promise chain with a catch handler.',
        line: getLineNumber(source, match.index)
      });
    } else if ((hasAwait && !hasTry && !hasCatch) || (hasThen && !hasCatch)) {
      findings.push({
        severity: 'medium',
        code: 'webapi-error-handling',
        title: 'Xrm.WebApi error path is not obvious',
        message: `${match[1]} should surface failures with a catch block, form notification or dialog.`,
        recommendation: 'Wrap the call in try/catch and use Xrm.Navigation.openErrorDialog or a form notification for failures.',
        line: getLineNumber(source, match.index)
      });
    }

    match = pattern.exec(source);
  }

  return findings;
}

function findHardCodedEnvironmentValues(source) {
  const findings = [];

  collectPatternFindings(source, URL_PATTERN, match => ({
    severity: 'medium',
    code: 'hard-coded-url',
    title: 'Hard-coded URL',
    message: `${match[0]} may bind the web resource to one environment.`,
    recommendation: 'Use Xrm.Utility.getGlobalContext().getClientUrl(), environment variables or relative paths where possible.'
  })).forEach(finding => findings.push(finding));

  collectPatternFindings(source, GUID_PATTERN, match => ({
    severity: 'low',
    code: 'hard-coded-guid',
    title: 'Hard-coded GUID',
    message: `${match[0]} looks like an environment-specific record identifier.`,
    recommendation: 'Resolve records by configuration, alternate keys or secure environment-specific data.'
  })).forEach(finding => findings.push(finding));

  return findings;
}

function findGlobalNamespaceRisks(source, functions) {
  const hasNamespacePattern = /\bwindow\.[A-Za-z_$][\w$]*\b|(?:var|let|const)\s+[A-Za-z_$][\w$]*\s*=\s*(?:window\.)?[A-Za-z_$][\w$]*\s*\|\|\s*\{\s*\}/.test(source);
  const bareFunctions = functions.filter(candidate => !candidate.name.includes('.'));

  if (hasNamespacePattern || bareFunctions.length === 0) {
    return [];
  }

  return [{
    severity: 'low',
    code: 'global-handler-namespace',
    title: 'Global function namespace risk',
    message: `${bareFunctions.length} top-level function${bareFunctions.length === 1 ? '' : 's'} detected without an obvious namespace object.`,
    recommendation: 'Expose handlers through one publisher namespace, for example Contoso.Account.onLoad.',
    line: bareFunctions[0].line
  }];
}

function findDomAccessRisks(source) {
  return collectPatternFindings(source, /\b(?:document\.getElementById|document\.querySelector|parent\.document|window\.parent\.document)\b/g, match => ({
    severity: 'medium',
    code: 'unsupported-dom-access',
    title: 'DOM access risk',
    message: `${match[0]} depends on model-driven app DOM structure.`,
    recommendation: 'Use supported Client API methods instead of reading or changing the host page DOM.'
  }));
}

function collectMigrationSuggestions(source) {
  const suggestions = [];
  const rules = [
    {
      pattern: /\bXrm\.Page\.getAttribute\(([^)]*)\)/g,
      replace: match => `formContext.getAttribute(${match[1]})`,
      note: 'Move field reads and writes to the passed form context.'
    },
    {
      pattern: /\bXrm\.Page\.getControl\(([^)]*)\)/g,
      replace: match => `formContext.getControl(${match[1]})`,
      note: 'Move control visibility and notifications to the passed form context.'
    },
    {
      pattern: /\bXrm\.Page\.data\.entity\.getId\(\)/g,
      replace: () => 'formContext.data.entity.getId()',
      note: 'Read the current record from the form context.'
    },
    {
      pattern: /\bXrm\.Page\.data\.save\(/g,
      replace: () => 'formContext.data.save(',
      note: 'Use formContext.data for form save operations.'
    },
    {
      pattern: /\bXrm\.Page\.ui\./g,
      replace: () => 'formContext.ui.',
      note: 'Use formContext.ui for form notifications and UI state.'
    },
    {
      pattern: /\bXrm\.Page\.context\b/g,
      replace: () => 'Xrm.Utility.getGlobalContext()',
      note: 'Use the global context helper for organisation, user and client details.'
    }
  ];

  rules.forEach(rule => {
    let match = rule.pattern.exec(source);

    while (match) {
      suggestions.push({
        line: getLineNumber(source, match.index),
        before: match[0],
        after: rule.replace(match),
        note: rule.note
      });
      match = rule.pattern.exec(source);
    }
  });

  return suggestions;
}

function buildMigrationHandlerSkeleton(options = {}) {
  const namespace = normaliseDottedIdentifier(options.namespace, 'Contoso.ModelDriven');
  const functionName = normaliseIdentifier(options.functionName, 'onLoad');

  return [
    ...buildNamespaceInitialiser(namespace),
    '',
    `${namespace}.${functionName} = function (executionContext) {`,
    '  const formContext = executionContext.getFormContext();',
    '',
    '  // Move migrated form logic here and keep field/control access guarded.',
    '  const nameAttribute = formContext.getAttribute("name");',
    '  const name = nameAttribute ? nameAttribute.getValue() : null;',
    '',
    '  return name;',
    '};'
  ].join('\n');
}

function buildJavaScriptReviewMarkdown({ fileName, source, findings, functions }) {
  const summary = summariseFindings(findings);
  const lines = [
    '# Model-driven JavaScript review',
    '',
    `File: ${fileName}`,
    `Source size: ${formatBytes(new TextEncoder().encode(source).length)}`,
    '',
    '## Summary',
    '',
    '| Severity | Count |',
    '| --- | ---: |',
    `| High | ${summary.high} |`,
    `| Medium | ${summary.medium} |`,
    `| Low | ${summary.low} |`,
    `| Info | ${summary.info} |`,
    '',
    '## Findings',
    ''
  ];

  if (findings.length === 0) {
    lines.push('No obvious model-driven app JavaScript risks were detected.');
  } else {
    findings.forEach(finding => {
      lines.push(
        `### ${finding.title}`,
        '',
        `- Severity: ${capitalise(finding.severity)}`,
        `- Line: ${finding.line || '-'}`,
        `- Detail: ${finding.message}`,
        `- Recommendation: ${finding.recommendation}`,
        ''
      );
    });
  }

  lines.push(
    '',
    '## Detected functions',
    '',
    '| Function | Parameters | Line |',
    '| --- | --- | ---: |',
    ...(functions.length > 0
      ? functions.map(candidate => `| ${escapeMarkdownCell(candidate.name)} | ${escapeMarkdownCell(candidate.parameters.join(', ') || '-')} | ${candidate.line} |`)
      : ['| No functions detected | - | - |']),
    '',
    '## Registration notes',
    '',
    '- Register form handlers with Pass execution context enabled.',
    '- Use PrimaryControl for form command JavaScript and SelectedControl for grid command JavaScript.',
    '- Keep web resources in a publisher namespace to avoid global collisions.'
  );

  return lines.join('\n');
}

function buildMigrationMarkdown({ analysis, replacements, handlerSnippet }) {
  const lines = [
    '# Client API migration helper',
    '',
    '## Migration summary',
    '',
    `Potential replacement points: ${replacements.length}`,
    `Review findings: ${analysis.findings.length}`,
    '',
    '## Suggested replacements',
    ''
  ];

  if (replacements.length === 0) {
    lines.push('No direct Xrm.Page replacement patterns were detected.');
  } else {
    lines.push('| Line | Current pattern | Suggested pattern | Note |', '| ---: | --- | --- | --- |');
    replacements.forEach(item => {
      lines.push(`| ${item.line} | \`${escapeMarkdownCell(item.before)}\` | \`${escapeMarkdownCell(item.after)}\` | ${escapeMarkdownCell(item.note)} |`);
    });
  }

  lines.push(
    '',
    '## Handler skeleton',
    '',
    '```javascript',
    handlerSnippet,
    '```',
    '',
    '## Review notes',
    '',
    '- This helper does not rewrite source automatically.',
    '- Retest form events, business rules and command actions after migration.',
    '- Keep `Xrm.Page` only where a legacy handler cannot be moved safely yet.'
  );

  return lines.join('\n');
}

function buildEventHandlerCode({ eventType, namespace, functionName, fieldName, controlName }) {
  const lines = [
    ...buildNamespaceInitialiser(namespace),
    '',
    `${namespace}.${functionName} = function (executionContext) {`,
    '  const formContext = executionContext.getFormContext();'
  ];

  if (eventType === 'onload') {
    lines.push(
      '',
      '  formContext.ui.clearFormNotification("form_ready");',
      '  // Add form initialisation logic here.'
    );
  } else if (eventType === 'onsave') {
    lines.push(
      '  const eventArgs = executionContext.getEventArgs();',
      `  const attribute = formContext.getAttribute("${fieldName || 'name'}");`,
      '  const value = attribute ? attribute.getValue() : null;',
      '',
      '  if (!value) {',
      '    eventArgs.preventDefault();',
      '    formContext.ui.setFormNotification("Complete the required value before saving.", "ERROR", "save_validation");',
      '    return;',
      '  }',
      '',
      '  formContext.ui.clearFormNotification("save_validation");'
    );
  } else if (eventType === 'onchange') {
    lines.push(
      `  const attribute = formContext.getAttribute("${fieldName || 'name'}");`,
      `  const control = formContext.getControl("${controlName || fieldName || 'name'}");`,
      '  const value = attribute ? attribute.getValue() : null;',
      '',
      '  if (!control) {',
      '    return;',
      '  }',
      '',
      '  if (value) {',
      '    control.clearNotification("field_validation");',
      '  } else {',
      '    control.setNotification("Enter a value before continuing.", "field_validation");',
      '  }'
    );
  } else {
    lines.push(
      `  const gridControl = formContext.getControl("${controlName || 'contacts'}");`,
      '',
      '  if (!gridControl) {',
      '    return;',
      '  }',
      '',
      '  const grid = gridControl.getGrid();',
      '  const selectedRows = grid ? grid.getSelectedRows().getLength() : 0;',
      '  formContext.ui.setFormNotification(`${selectedRows} related row(s) selected.`, "INFO", "subgrid_state");'
    );
  }

  lines.push('};');
  return lines.join('\n');
}

function buildEventHandlerChecklist({ eventType, namespace, functionName }) {
  const eventLabel = getChoiceLabel(eventType, FORM_EVENT_TYPES);

  return [
    '## Registration checklist',
    '',
    `- Add the JavaScript web resource to the form libraries.`,
    `- Register ${namespace}.${functionName} on ${eventLabel}.`,
    '- Tick Pass execution context.',
    '- Publish customisations and test create, update and read-only form states.'
  ].join('\n');
}

function buildWebApiCode({ operation, entityName, recordId, select, filter, parsedData, functionName }) {
  const idExpression = recordId ? `"${stripGuidBraces(recordId)}"` : 'recordId';
  const query = buildODataOptions({ select, filter });
  const dataLiteral = parsedData ? stringifyObjectLiteral(parsedData) : '{\n    name: "Sample value"\n  }';
  const lines = [
    `async function ${functionName}(${needsRecordId(operation, recordId) ? 'recordId' : ''}) {`.replace('( )', '()'),
    '  try {'
  ];

  if (operation === 'retrieveRecord') {
    lines.push(
      `    const result = await Xrm.WebApi.retrieveRecord("${entityName}", ${idExpression}, "${query || '?$select=name'}");`,
      '    return result;'
    );
  } else if (operation === 'retrieveMultipleRecords') {
    lines.push(
      `    const result = await Xrm.WebApi.retrieveMultipleRecords("${entityName}", "${query || '?$select=name'}");`,
      '    return result.entities;'
    );
  } else if (operation === 'createRecord') {
    lines.push(
      `    const data = ${indentMultiline(dataLiteral, 4)};`,
      `    const result = await Xrm.WebApi.createRecord("${entityName}", data);`,
      '    return result.id;'
    );
  } else if (operation === 'updateRecord') {
    lines.push(
      `    const data = ${indentMultiline(dataLiteral, 4)};`,
      `    await Xrm.WebApi.updateRecord("${entityName}", ${idExpression}, data);`,
      `    return ${idExpression};`
    );
  } else {
    lines.push(
      `    await Xrm.WebApi.deleteRecord("${entityName}", ${idExpression});`,
      `    return ${idExpression};`
    );
  }

  lines.push(
    '  } catch (error) {',
    '    await Xrm.Navigation.openErrorDialog({ message: error.message });',
    '    throw error;',
    '  }',
    '}'
  );

  return lines.join('\n');
}

function buildValidationCode({ namespace, functionName, fieldName, ruleType, message, notificationId, maxLength, pattern, runOnSave }) {
  const condition = {
    required: '!value',
    maxLength: `typeof value === "string" && value.length > ${maxLength}`,
    regex: `value && !/${escapeRegexLiteral(pattern)}/.test(String(value))`
  }[ruleType];
  const lines = [
    ...buildNamespaceInitialiser(namespace),
    '',
    `${namespace}.${functionName} = function (executionContext) {`,
    '  const formContext = executionContext.getFormContext();',
    `  const attribute = formContext.getAttribute("${fieldName}");`,
    `  const control = formContext.getControl("${fieldName}");`,
    '  const eventArgs = executionContext.getEventArgs ? executionContext.getEventArgs() : null;',
    '',
    '  if (!attribute || !control) {',
    '    return;',
    '  }',
    '',
    '  const value = attribute.getValue();',
    '',
    `  if (${condition}) {`,
    `    control.setNotification("${escapeJavaScriptString(message)}", "${notificationId}");`,
    ...(runOnSave ? ['    eventArgs?.preventDefault();'] : []),
    '    return;',
    '  }',
    '',
    `  control.clearNotification("${notificationId}");`,
    '};'
  ];

  return lines.join('\n');
}

function buildCommandCode({ contextType, namespace, functionName, entityName, useConfirmation, includeWebApiUpdate }) {
  const argument = contextType === 'form' ? 'primaryControl' : 'selectedControl';
  const lines = [
    ...buildNamespaceInitialiser(namespace),
    '',
    `${namespace}.${functionName} = async function (${argument}) {`,
    contextType === 'form'
      ? '  const formContext = primaryControl;'
      : '  const gridContext = selectedControl;',
    contextType === 'form'
      ? '  const recordId = formContext.data.entity.getId().replace(/[{}]/g, "");'
      : '  const selectedRows = gridContext.getGrid().getSelectedRows();',
    ''
  ];

  if (contextType === 'grid') {
    lines.push(
      '  if (selectedRows.getLength() === 0) {',
      '    await Xrm.Navigation.openAlertDialog({ text: "Select at least one row first." });',
      '    return;',
      '  }',
      ''
    );
  }

  if (useConfirmation) {
    lines.push(
      '  const confirmation = await Xrm.Navigation.openConfirmDialog({',
      '    title: "Confirm action",',
      '    text: "Run this command for the selected record(s)?"',
      '  });',
      '',
      '  if (!confirmation.confirmed) {',
      '    return;',
      '  }',
      ''
    );
  }

  if (includeWebApiUpdate) {
    if (contextType === 'form') {
      lines.push(
        '  try {',
        `    await Xrm.WebApi.updateRecord("${entityName}", recordId, {`,
        '      description: "Updated from command bar"',
        '    });',
        '    await formContext.data.refresh(false);',
        '  } catch (error) {',
        '    await Xrm.Navigation.openErrorDialog({ message: error.message });',
        '    throw error;',
        '  }'
      );
    } else {
      lines.push(
        '  const updates = [];',
        '  selectedRows.forEach(row => {',
        '    const id = row.getData().getEntity().getId().replace(/[{}]/g, "");',
        `    updates.push(Xrm.WebApi.updateRecord("${entityName}", id, {`,
        '      description: "Updated from command bar"',
        '    }));',
        '  });',
        '',
        '  try {',
        '    await Promise.all(updates);',
        '    gridContext.refresh();',
        '  } catch (error) {',
        '    await Xrm.Navigation.openErrorDialog({ message: error.message });',
        '    throw error;',
        '  }'
      );
    }
  } else {
    lines.push(contextType === 'form'
      ? '  await Xrm.Navigation.openAlertDialog({ text: `Command ran for ${recordId}.` });'
      : '  await Xrm.Navigation.openAlertDialog({ text: `${selectedRows.getLength()} row(s) selected.` });');
  }

  lines.push('};');
  return lines.join('\n');
}

function buildSnippetResult({ output, code, warnings, outputType, summary }) {
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    output,
    code,
    warnings,
    outputType,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    summary: {
      ...summary,
      lineCount: output.split('\n').length
    }
  };
}

function buildNamespaceInitialiser(namespace) {
  const parts = namespace.split('.');
  const lines = [`var ${parts[0]} = window.${parts[0]} || {};`];

  for (let index = 1; index < parts.length; index += 1) {
    const path = parts.slice(0, index + 1).join('.');
    lines.push(`${path} = ${path} || {};`);
  }

  return lines;
}

function buildWebApiWarnings({ operation, recordId, select, filter, parsedData }) {
  const warnings = [];

  if ((operation === 'retrieveRecord' || operation === 'retrieveMultipleRecords') && select.length === 0) {
    warnings.push('Add a focused $select list before using this against a large Dataverse table.');
  }

  if (operation === 'retrieveMultipleRecords' && !filter) {
    warnings.push('Add a focused $filter or paging strategy for production retrieveMultipleRecords calls.');
  }

  if (recordId && GUID_PATTERN.test(recordId)) {
    warnings.push('The snippet contains a hard-coded record ID; pass it from the form or command context where possible.');
  }
  GUID_PATTERN.lastIndex = 0;

  if ((operation === 'createRecord' || operation === 'updateRecord') && !parsedData) {
    warnings.push('Replace the sample data object with real schema names and values before publishing.');
  }

  return warnings;
}

function buildODataOptions({ select, filter }) {
  const parts = [];

  if (select.length > 0) {
    parts.push(`$select=${select.join(',')}`);
  }

  if (filter) {
    parts.push(`$filter=${filter}`);
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function parseOptionalJson(value, operation) {
  if (!value) {
    return null;
  }

  if (!['createRecord', 'updateRecord'].includes(operation)) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error();
    }

    return parsed;
  } catch {
    throw new Error('Enter the data object as valid JSON.');
  }
}

function normaliseChoice(value, choices, fallback) {
  const text = String(value || fallback).trim();
  return choices.some(choice => choice.value === text) ? text : fallback;
}

function getChoiceLabel(value, choices) {
  return choices.find(choice => choice.value === value)?.label || value;
}

function normaliseIdentifier(value, fallback) {
  const text = String(value || fallback).trim();

  if (!JAVASCRIPT_IDENTIFIER.test(text)) {
    throw new Error('Enter a valid JavaScript function name.');
  }

  return text;
}

function normaliseDottedIdentifier(value, fallback) {
  const text = String(value || fallback).trim();

  if (!DOTTED_IDENTIFIER.test(text)) {
    throw new Error('Enter a valid dotted JavaScript namespace.');
  }

  return text;
}

function normaliseLogicalName(value, message) {
  const text = String(value || '').trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) {
    throw new Error(message || 'Enter a valid Dataverse logical name.');
  }

  return text;
}

function normaliseOptionalLogicalName(value) {
  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  return normaliseLogicalName(text);
}

function normaliseCsvList(value) {
  return String(value || '')
    .split(/[,\s]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value, message, allowEmpty = false) {
  const text = String(value || '').trim();

  if (!text && allowEmpty) {
    return null;
  }

  const number = Number(text);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error(message);
  }

  return number;
}

function splitParameters(value) {
  return String(value || '')
    .split(',')
    .map(parameter => parameter.trim())
    .filter(Boolean);
}

function collectPatternFindings(source, pattern, createFinding) {
  const findings = [];
  let match = pattern.exec(source);

  while (match) {
    findings.push({
      ...createFinding(match),
      line: getLineNumber(source, match.index)
    });
    match = pattern.exec(source);
  }

  return findings;
}

function getLineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function readFunctionBody(source, functionIndex) {
  const openBrace = source.indexOf('{', functionIndex);

  if (openBrace < 0) {
    return '';
  }

  let depth = 0;
  let quote = '';

  for (let index = openBrace; index < source.length; index += 1) {
    const character = source[index];
    const previous = source[index - 1];

    if (quote) {
      if (character === quote && previous !== '\\') {
        quote = '';
      }
      continue;
    }

    if (character === '"' || character === '\'' || character === '`') {
      quote = character;
      continue;
    }

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return source.slice(openBrace, index + 1);
      }
    }
  }

  return source.slice(openBrace);
}

function readStatement(source, startIndex) {
  const end = source.indexOf(';', startIndex);
  return source.slice(startIndex, end < 0 ? Math.min(source.length, startIndex + 500) : end + 1);
}

function summariseFindings(findings) {
  return findings.reduce((summary, finding) => {
    summary[finding.severity] = (summary[finding.severity] || 0) + 1;
    summary.total += 1;
    return summary;
  }, { high: 0, medium: 0, low: 0, info: 0, total: 0 });
}

function compareFindings(left, right) {
  const weights = { high: 0, medium: 1, low: 2, info: 3 };
  return (weights[left.severity] - weights[right.severity]) || ((left.line || 0) - (right.line || 0));
}

function stringifyObjectLiteral(value) {
  return JSON.stringify(value, null, 2);
}

function indentMultiline(value, spaces) {
  const indent = ' '.repeat(spaces);
  const lines = String(value).split('\n');

  if (lines.length === 1) {
    return lines[0];
  }

  return `${lines[0]}\n${lines.slice(1).map(line => `${indent}${line}`).join('\n')}`;
}

function needsRecordId(operation, recordId) {
  return ['retrieveRecord', 'updateRecord', 'deleteRecord'].includes(operation) && !recordId;
}

function stripGuidBraces(value) {
  return String(value || '').replace(/[{}]/g, '');
}

function escapeRegexLiteral(value) {
  return String(value || '').replace(/\//g, '\\/');
}

function escapeJavaScriptString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeMarkdownCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function capitalise(value) {
  return String(value).charAt(0).toLocaleUpperCase('en-GB') + String(value).slice(1);
}
