import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyseMermaidSource,
  buildMermaidDownloadFileName,
  buildMermaidTemplate,
  convertApiWorkflowToMermaid,
  convertDataToMermaid,
  convertJsonToMermaidTree,
  convertRequestTextToMermaid,
  detectMermaidDiagramType,
  extractMermaidSource,
  isLikelyMermaidSource
} from '../../src/tools/mermaid.js';

test('extracts and analyses Mermaid source', () => {
  const source = extractMermaidSource([
    '# Diagram',
    '',
    '```mermaid',
    'flowchart TD',
    '  start --> done',
    '```'
  ].join('\n'));

  assert.equal(source, 'flowchart TD\n  start --> done');
  assert.equal(detectMermaidDiagramType(source), 'Flowchart');
  assert.equal(isLikelyMermaidSource(source), true);

  const analysis = analyseMermaidSource(source);
  assert.equal(analysis.validSourceShape, true);
  assert.equal(analysis.lineCount, 2);
  assert.match(analysis.outputSizeLabel, /bytes/);
});

test('builds Mermaid templates for common diagram types', () => {
  const sequence = buildMermaidTemplate({
    template: 'sequence',
    title: 'Checkout',
    primary: 'Browser',
    secondary: 'API'
  });

  assert.equal(sequence.templateLabel, 'Sequence diagram');
  assert.equal(sequence.outputType, 'Sequence diagram');
  assert.match(sequence.output, /^sequenceDiagram/);
  assert.match(sequence.output, /Browser->>API|browser->>api/i);

  const er = buildMermaidTemplate({
    template: 'er',
    primary: 'Account',
    secondary: 'Contact'
  });

  assert.match(er.output, /^erDiagram/);
  assert.match(er.output, /ACCOUNT \|\|--o\{ CONTACT/);
});

test('converts JSON and delimited data into Mermaid', () => {
  const tree = convertDataToMermaid({
    input: JSON.stringify({ account: { name: 'Contoso', active: true } }),
    inputFormat: 'json',
    diagramType: 'tree'
  });

  assert.equal(tree.inputFormatLabel, 'JSON');
  assert.equal(tree.outputType, 'Flowchart');
  assert.match(tree.output, /^flowchart TD/);
  assert.match(tree.output, /account/);

  const pie = convertDataToMermaid({
    input: 'status,count\nActive,12\nPaused,4\nActive,3',
    inputFormat: 'csv',
    diagramType: 'pie',
    labelField: 'status',
    valueField: 'count'
  });

  assert.equal(pie.inputFormatLabel, 'Comma (,)');
  assert.match(pie.output, /^pie showData/);
  assert.match(pie.output, /"Active" : 15/);
  assert.match(pie.output, /"Paused" : 4/);

  const er = convertDataToMermaid({
    input: '[{"name":"Ada","score":3.5,"active":true}]',
    diagramType: 'er',
    entityName: 'Person'
  });
  assert.match(er.output, /PERSON/);
  assert.match(er.output, /float score/);

  assert.throws(() => convertDataToMermaid({ input: '', diagramType: 'tree' }), /Enter JSON, CSV or TSV/);
});

test('converts request and workflow text into Mermaid', () => {
  const sequence = convertApiWorkflowToMermaid({
    input: 'curl -X POST https://api.example.test/orders -H "Content-Type: application/json" --data-raw "{\\"name\\":\\"Ada\\"}"',
    mode: 'request',
    diagramType: 'sequence'
  });

  assert.equal(sequence.modeLabel, 'API request');
  assert.equal(sequence.request.method, 'POST');
  assert.match(sequence.output, /^sequenceDiagram/);
  assert.match(sequence.output, /POST https:\/\/api.example.test\/orders/);

  const flowchart = convertApiWorkflowToMermaid({
    input: 'Draft request\nSend request\nReview response',
    mode: 'steps',
    diagramType: 'flowchart',
    title: 'Manual test'
  });

  assert.equal(flowchart.modeLabel, 'Step list');
  assert.match(flowchart.output, /^flowchart TD/);
  assert.match(flowchart.output, /Draft request/);
});

test('builds handover transform outputs and safe download names', () => {
  assert.match(convertJsonToMermaidTree('{"name":"Ada"}'), /^flowchart TD/);
  assert.match(convertRequestTextToMermaid('// Endpoint: /_api/accounts?$select=name'), /^sequenceDiagram/);
  assert.equal(buildMermaidDownloadFileName('Quarterly chart.svg', 'png'), 'Quarterly chart.png');
});
