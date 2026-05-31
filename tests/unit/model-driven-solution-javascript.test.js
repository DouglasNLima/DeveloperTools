import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWebResourceSourceDependencyMap,
  buildWebResourceDependencyMap,
  parseFormLibraries,
  parseJavaScriptWebResources,
  parseSolutionJavaScriptModel,
  parseWebResourceSourceFiles,
  processSolutionJavaScriptEventsArchive,
  processWebResourceDependencyMapArchive
} from '../../src/tools/model-driven-solution-javascript.js';

test('parses JavaScript web resources and form event handlers from customizations XML', () => {
  const model = parseSolutionJavaScriptModel(createCustomizationsXml(), {
    name: 'Operations Toolkit'
  });

  assert.equal(model.webResources.length, 1);
  assert.equal(model.webResources[0].name, 'contoso_/account.js');
  assert.equal(model.libraries.length, 1);
  assert.equal(model.libraries[0].libraryName, 'contoso_/account.js');
  assert.equal(model.formHandlers.length, 2);
  assert.equal(model.formHandlers[0].functionName, 'Contoso.Account.onLoad');
  assert.equal(model.formHandlers[0].libraryOnForm, true);
  assert.equal(model.formHandlers[0].passExecutionContext, true);
  assert.equal(model.formHandlers[1].passExecutionContext, false);
});

test('processes solution JavaScript event reports from stored ZIP archives', async () => {
  const result = await processSolutionJavaScriptEventsArchive(createSolutionZip());

  assert.equal(result.summary.webResourceCount, 1);
  assert.equal(result.summary.libraryCount, 1);
  assert.equal(result.summary.handlerCount, 2);
  assert.equal(result.summary.sourceFileCount, 2);
  assert.equal(result.webResourceSources.length, 2);
  assert.equal(result.libraryFindings.length, 1);
  assert.ok(result.libraryFindings[0].findings.some(finding => finding.ruleId === 'retrieve-multiple-missing-paging'));
  assert.match(result.reportMarkdown, /Model-driven JavaScript event inspection/);
  assert.match(result.reportMarkdown, /Library inventory/);
  assert.match(result.reportMarkdown, /Per-library review findings/);
  assert.match(result.reportMarkdown, /Pass execution context/);
  assert.ok(result.warnings.some(warning => warning.includes('does not show Pass execution context')));
});

test('builds web resource dependency Markdown and Mermaid outputs', async () => {
  const result = await processWebResourceDependencyMapArchive(createSolutionZip());

  assert.match(result.markdown, /Web resource dependency map/);
  assert.match(result.markdown, /Source file references/);
  assert.match(result.mermaid, /flowchart LR/);
  assert.match(result.mermaid, /Contoso.Account.onLoad/);
  assert.match(result.mermaid, /HTML script/);
  assert.match(result.mermaid, /contoso_\/account\.js/);
  assert.equal(result.summary.handlerCount, 2);
  assert.equal(result.summary.sourceReferenceCount, 2);
});

test('parses web resource source files and source references', () => {
  const sources = parseWebResourceSourceFiles([
    {
      path: 'WebResources/contoso_/account.js',
      text: 'const icon = "$webresource:contoso_/icons/save.svg";'
    },
    {
      path: 'WebResources/contoso_/page.html',
      text: '<script src="/WebResources/contoso_/account.js"></script>'
    }
  ]);
  const dependencyMap = buildWebResourceSourceDependencyMap({ webResourceSources: sources });

  assert.deepEqual(sources.map(source => source.webResourceName), ['contoso_/account.js', 'contoso_/page.html']);
  assert.ok(dependencyMap.references.some(reference => reference.referenceType === 'html-script' && reference.target === 'contoso_/account.js'));
  assert.ok(dependencyMap.references.some(reference => reference.referenceType === '$webresource' && reference.target === 'contoso_/icons/save.svg'));
});

test('flags handlers that are not backed by form libraries', () => {
  const libraries = parseFormLibraries(createCustomizationsXml(), [{ name: 'contoso_/account.js', displayName: 'Account script', type: '3' }]);
  const model = parseSolutionJavaScriptModel(createCustomizationsXml().replace(
    '<Library name="$webresource:contoso_/account.js" rank="1" />',
    '<Library name="$webresource:contoso_/unused.js" rank="1" />'
  ));

  assert.equal(libraries.length, 1);
  assert.equal(model.formHandlers.every(handler => handler.libraryOnForm), false);
});

test('handles empty metadata without claiming live validation', () => {
  const resources = parseJavaScriptWebResources('<ImportExportXml></ImportExportXml>');
  const map = buildWebResourceDependencyMap({
    solution: { name: 'Empty solution' },
    webResources: resources,
    formHandlers: [],
    warnings: ['No JavaScript web resources were detected.']
  });

  assert.deepEqual(resources, []);
  assert.match(map.markdown, /No dependencies detected/);
  assert.match(map.mermaid, /No JavaScript dependencies detected/);
});

function createCustomizationsXml() {
  return [
    '<ImportExportXml>',
    '  <WebResources>',
    '    <WebResource Name="contoso_/account.js" DisplayName="Account script" WebResourceType="3" />',
    '  </WebResources>',
    '  <Entities>',
    '    <Entity>',
    '      <FormXml>',
    '        <systemform name="Account main">',
    '          <formLibraries>',
    '            <Library name="$webresource:contoso_/account.js" rank="1" />',
    '          </formLibraries>',
    '          <events>',
    '            <event name="onload">',
    '              <Handlers>',
    '                <Handler functionName="Contoso.Account.onLoad" libraryName="$webresource:contoso_/account.js" enabled="true" passExecutionContext="true" rank="1" />',
    '              </Handlers>',
    '            </event>',
    '            <event name="onsave">',
    '              <Handlers>',
    '                <Handler functionName="Contoso.Account.onSave" libraryName="$webresource:contoso_/account.js" enabled="true" passExecutionContext="false" rank="2" />',
    '              </Handlers>',
    '            </event>',
    '          </events>',
    '        </systemform>',
    '      </FormXml>',
    '    </Entity>',
    '  </Entities>',
    '</ImportExportXml>'
  ].join('\n');
}

function createSolutionZip() {
  return createStoredZip([
    ['solution.xml', [
      '<ImportExportXml>',
      '  <SolutionManifest>',
      '    <UniqueName>ops_toolkit</UniqueName>',
      '    <LocalizedNames>',
      '      <LocalizedName description="Operations Toolkit" languagecode="1033" />',
      '    </LocalizedNames>',
      '    <Version>1.2.3.4</Version>',
      '    <Managed>0</Managed>',
      '    <PublisherUniqueName>contoso</PublisherUniqueName>',
      '  </SolutionManifest>',
      '</ImportExportXml>'
    ].join('\n')],
    ['customizations.xml', createCustomizationsXml()],
    ['WebResources/contoso_/account.js', [
      'Contoso.Account.onSave = function (executionContext) {',
      '  return Xrm.WebApi.retrieveMultipleRecords("account", "?$select=name");',
      '};'
    ].join('\n')],
    ['WebResources/contoso_/page.html', [
      '<!doctype html>',
      '<html>',
      '<head><script src="/WebResources/contoso_/account.js"></script></head>',
      '<body data-script="$webresource:contoso_/account.js"></body>',
      '</html>'
    ].join('\n')]
  ]);
}

function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(([name, content]) => {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBytes, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localData.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralDirectory, eocd]);
}
