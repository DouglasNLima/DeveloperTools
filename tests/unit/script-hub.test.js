import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SCRIPT_ASSETS
} from '../../src/tools/script-hub-assets.js';
import {
  SCRIPT_CATALOGUE,
  SCRIPT_HUB_EXCLUSIONS,
  SCRIPT_MATURITY,
  SCRIPT_RUNTIME,
  SCRIPT_SAFETY_LABELS,
  escapeJavaScriptString,
  generateScript,
  getScriptById,
  getScriptsForFamily,
  validateScriptCatalogue,
  validateScriptInputs
} from '../../src/tools/script-hub.js';

const assetsModuleUrl = new URL('../../src/tools/script-hub-assets.js', import.meta.url);
const libraryManifest = JSON.parse(await readFile(
  new URL('../../assets/power-platform-script-hub/manifests/power-platform-library-manifest.json', import.meta.url),
  'utf8'
));
const forensicsManifest = JSON.parse(await readFile(
  new URL('../../assets/power-platform-script-hub/manifests/dataverse-forensics-manifest.json', import.meta.url),
  'utf8'
));

const legacyPowerShellNames = [
  'Build-And-Deploy-PCF.ps1',
  'Deploy-Solution.ps1',
  'Get-PCFDevEnvironmentReport.ps1',
  'Initialize-NewPCFProject.ps1',
  'Invoke-SolutionCheck.ps1',
  'New-PCFIdentityClone.ps1',
  'Push-PCFQuickDeploy.ps1',
  'Set-PCFReleaseDefaults.ps1',
  'Start-PCFTestHarness.ps1',
  'Test-PCFProjectConfiguration.ps1',
  'Test-PCFReleaseArtifact.ps1',
  'Test-PCFToolingPackage.ps1',
  'Update-Version.ps1'
];

async function readAsset(scriptId) {
  return readFile(new URL(SCRIPT_ASSETS[scriptId].path, assetsModuleUrl), 'utf8');
}

function lineCount(value) {
  if (value === '') {
    return 0;
  }

  const lines = value.split(/\r?\n/);
  return lines.at(-1) === '' ? lines.length - 1 : lines.length;
}

test('registers every authoritative script with unique source integrity metadata', async () => {
  const catalogueNames = new Set(SCRIPT_CATALOGUE.map(script => script.source.name));

  assert.equal(SCRIPT_CATALOGUE.length, 40);
  assert.equal(getScriptsForFamily('development').length, 13);
  assert.equal(getScriptsForFamily('investigation').length, 23);
  assert.equal(getScriptsForFamily('power-pages').length, 4);
  assert.equal(SCRIPT_CATALOGUE.filter(script => script.runtime === SCRIPT_RUNTIME.POWERSHELL_HELPER).length, 25);
  assert.equal(SCRIPT_CATALOGUE.filter(script => script.runtime !== SCRIPT_RUNTIME.POWERSHELL_HELPER).length, 15);
  assert.equal(SCRIPT_CATALOGUE.filter(script => script.maturity === SCRIPT_MATURITY.FIELD_TESTED).length, 1);
  assert.equal(getScriptById('forensics-pcf').maturity, SCRIPT_MATURITY.FIELD_TESTED);
  assert.equal(new Set(SCRIPT_CATALOGUE.map(script => script.id)).size, SCRIPT_CATALOGUE.length);
  assert.equal(new Set(SCRIPT_CATALOGUE.map(script => `${script.source.package}|${script.source.name}`)).size, SCRIPT_CATALOGUE.length);

  for (const manifestScript of libraryManifest.scripts) {
    assert.equal(catalogueNames.has(manifestScript.name), true, `Missing PowerShell library script ${manifestScript.name}`);
  }
  for (const manifestName of forensicsManifest.scripts) {
    assert.equal(catalogueNames.has(manifestName), true, `Missing forensic script ${manifestName}`);
  }

  const legacyExcluded = new Set(SCRIPT_HUB_EXCLUSIONS
    .filter(entry => entry.package === 'PS Scripts' && entry.decision === 'superseded')
    .map(entry => entry.name));
  const integratedLegacyNames = new Set(SCRIPT_CATALOGUE
    .filter(script => script.source.package === 'PS Scripts')
    .map(script => script.source.name));

  assert.deepEqual([...legacyExcluded].sort(), [
    'Test-PCFProjectConfiguration.ps1',
    'Test-PCFReleaseArtifact.ps1'
  ]);
  assert.deepEqual(
    [...new Set(legacyPowerShellNames)].filter(name => !legacyExcluded.has(name)).sort(),
    [...integratedLegacyNames].sort()
  );

  for (const [scriptId, asset] of Object.entries(SCRIPT_ASSETS)) {
    const content = await readAsset(scriptId);
    const hash = createHash('sha256').update(content).digest('hex').toUpperCase();
    assert.equal(hash, asset.sha256, `Source hash changed for ${asset.name}`);
    assert.equal(lineCount(content), asset.lineCount, `Source line count changed for ${asset.name}`);
  }

  assert.deepEqual(validateScriptCatalogue(), { valid: true, errors: [] });
});

test('does not expose parameters that are absent from the authoritative sources', async () => {
  for (const script of SCRIPT_CATALOGUE) {
    const source = await readAsset(script.id);

    if (script.runtime === SCRIPT_RUNTIME.POWERSHELL_HELPER) {
      const parameterBlock = source.match(/^param\(\r?\n([\s\S]*?)\r?\n\)\r?\n\r?\nSet-StrictMode/m)?.[1] || '';
      const excluded = new Set((script.excludedParameters || []).map(parameter => parameter.name));
      const sourceParameters = [...parameterBlock.matchAll(/\]\$(\w+)/g)]
        .map(match => match[1])
        .filter(name => !excluded.has(name));
      const catalogueParameters = script.parameters
        .map(parameter => parameter.name);

      assert.deepEqual(
        catalogueParameters.sort(),
        sourceParameters.sort(),
        `Parameter metadata drifted for ${script.scriptName}`
      );
      continue;
    }

    const configBlock = source.match(/const\s+CONFIG\s*=\s*\{([\s\S]*?)\r?\n\s*\};/)?.[1] || '';
    const sourceKeys = [...configBlock.matchAll(/["']?([A-Za-z][A-Za-z0-9_]*)["']?\s*:/g)].map(match => match[1]);
    const catalogueKeys = script.parameters.map(parameter => parameter.configKey || parameter.name);

    assert.deepEqual(
      catalogueKeys.sort(),
      sourceKeys.sort(),
      `Configuration metadata drifted for ${script.scriptName}`
    );
  }
});

test('detects duplicate IDs, duplicate inputs, ambiguous authorities and unsupported metadata', () => {
  const base = getScriptById('pcf-environment-report');
  const duplicateInput = {
    ...base,
    id: 'synthetic-duplicate-input',
    source: { ...base.source, package: 'Synthetic', name: 'duplicate-input.ps1' },
    inputs: [...base.inputs, { ...base.inputs[0] }]
  };
  const ambiguousAuthority = {
    ...base,
    id: 'synthetic-ambiguous-authority',
    source: { ...base.source }
  };
  const unsupported = {
    ...base,
    id: 'synthetic-unsupported',
    source: { ...base.source, package: 'Synthetic', name: 'unsupported.ps1' },
    runtime: 'unknown-runtime',
    maturity: 'Unverified',
    safety: ['unknown-safety']
  };

  const result = validateScriptCatalogue([
    base,
    { ...base, source: { ...base.source, package: 'Synthetic', name: 'duplicate-id.ps1' } },
    duplicateInput,
    ambiguousAuthority,
    unsupported
  ]);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => /Duplicate script id pcf-environment-report/.test(error)));
  assert.ok(result.errors.some(error => /duplicate input scriptsPath/.test(error)));
  assert.ok(result.errors.some(error => /ambiguous source authority/.test(error)));
  assert.ok(result.errors.some(error => /unsupported runtime/.test(error)));
  assert.ok(result.errors.some(error => /unsupported maturity/.test(error)));
  assert.ok(result.errors.some(error => /unsupported safety classification/.test(error)));
});

test('validates required inputs, conditional inputs and required input alternatives', () => {
  assert.throws(
    () => validateScriptInputs(getScriptById('pp-environment-snapshot'), { scriptsPath: 'C:/Scripts' }),
    /Enter environment url/
  );
  assert.throws(
    () => validateScriptInputs(getScriptById('pcf-build-deploy'), { scriptsPath: 'C:/Scripts', projectRoot: 'C:/Project', deploy: true }),
    /Enter environment url/
  );
  assert.throws(
    () => validateScriptInputs(getScriptById('pp-pcf-release-package'), { scriptsPath: 'C:/Scripts' }),
    /Enter one of managed package path or unmanaged package path/
  );
  assert.throws(
    () => validateScriptInputs(getScriptById('forensics-form'), {}),
    /Enter one of form id or form name contains/
  );
  assert.throws(
    () => validateScriptInputs(getScriptById('forensics-component'), { objectId: 'not-a-guid' }),
    /Component object ID must be a valid GUID/
  );

  assert.doesNotThrow(() => validateScriptInputs(getScriptById('forensics-component'), {
    objectId: '00000000-0000-0000-0000-000000000000'
  }));
  assert.doesNotThrow(() => validateScriptInputs(getScriptById('pcf-build-deploy'), {
    scriptsPath: 'C:/Scripts',
    projectRoot: 'C:/Project'
  }));
});

test('generates deterministic, source-supported PowerShell output without secrets', () => {
  const values = {
    scriptsPath: String.raw`C:\Projects\Power Platform\PS Scripts`,
    projectRoot: String.raw`C:\Projects\PCF Controls\InspectionControl`,
    publisherPrefix: 'cts',
    environmentUrl: 'https://contoso.crm4.dynamics.com',
    solutionUniqueName: 'Inspection_Control',
    incremental: false
  };
  const first = generateScript({ scriptId: 'pcf-quick-deploy', values });
  const second = generateScript({ scriptId: 'pcf-quick-deploy', values });

  assert.deepEqual(first, second);
  assert.equal(first.filename, 'quick-deploy-launcher.ps1');
  assert.equal(first.launcherFilename, 'quick-deploy-launcher.ps1');
  assert.match(first.command, /Push-Location 'C:\\Projects\\PCF Controls\\InspectionControl'/);
  assert.match(first.command, /-ProjectRoot 'C:\\Projects\\PCF Controls\\InspectionControl'/);
  assert.doesNotMatch(first.command, /ClientSecret|ApplicationId|TenantId|secret-value|access-token-value/i);
  assert.doesNotMatch(first.launcher, /ClientSecret|ApplicationId|TenantId|secret-value|access-token-value/i);

  const snapshot = generateScript({
    scriptId: 'pp-environment-snapshot',
    values: {
      scriptsPath: String.raw`C:\Scripts folder`,
      environmentUrl: 'https://contoso.crm4.dynamics.com',
      maxRows: 25
    }
  });

  assert.match(snapshot.command, /\$accessToken = Read-Host 'Dataverse access token' -AsSecureString/);
  assert.match(snapshot.command, /-AccessToken \$accessToken/);
  assert.match(snapshot.launcher, /\$accessToken = Read-Host 'Dataverse access token' -AsSecureString/);
  assert.doesNotMatch(snapshot.launcher, /ClientSecret|password|refreshToken/i);
  assert.equal(snapshot.filename, 'pp-environment-snapshot-launcher.ps1');
});

test('escapes browser configuration values and keeps browser outputs as text downloads', async () => {
  const template = await readAsset('forensics-flow');
  const specialValue = "O'Brien $& $' $`";
  const generated = generateScript({
    scriptId: 'forensics-flow',
    values: {
      nameContains: specialValue
    },
    template
  });

  assert.equal(generated.runtime, SCRIPT_RUNTIME.BROWSER_DEVTOOLS);
  assert.equal(generated.filename, 'Flow-Forensics.txt');
  assert.equal(generated.scriptName, 'Flow-Forensics.txt');
  assert.equal(generated.script.match(/"nameContains":/g).length, 1);
  assert.ok(generated.script.includes(`"nameContains": ${JSON.stringify(specialValue)}`));
  assert.equal(escapeJavaScriptString('line one\nline two'), '"line one\\nline two"');
  assert.equal(escapeJavaScriptString('quote " and slash \\'), '"quote \\" and slash \\\\"');

  const localComparison = generateScript({
    scriptId: 'forensics-environment-compare',
    template: await readAsset('forensics-environment-compare')
  });
  assert.equal(localComparison.runtime, SCRIPT_RUNTIME.LOCAL_BROWSER);
  assert.equal(localComparison.filename, 'Compare-Environment-Fingerprints.txt');
  assert.deepEqual(localComparison.script.match(/PATCH|POST|PUT|DELETE/g), null);
});

test('keeps the field-tested PCF forensic source contract intact', async () => {
  const source = await readAsset('forensics-pcf');
  const generated = generateScript({
    scriptId: 'forensics-pcf',
    values: { controlName: 'publisher_namespace.Controls.InspectionControl' },
    template: source
  });

  assert.equal(generated.filename, 'PCF-Forensics-Generic.txt');
  assert.match(source, /Version: 2\.0\.1/);
  assert.match(source, /const CONFIG = \{/);
  assert.match(source, /window\.__PCF_FORENSICS/);
  assert.match(source, /CustomControlResource/);
  assert.match(source, /httpTest/);
  assert.match(source, /deriveIdentity/);
  assert.match(generated.script, /publisher_namespace\.Controls\.InspectionControl/);
  assert.match(generated.script, /window\.__PCF_FORENSICS/);
  assert.equal(lineCount(generated.script), lineCount(source));
});

test('exposes safety and maturity metadata without classifying forensic collectors as mutating', () => {
  const safetyKeys = new Set(Object.keys(SCRIPT_SAFETY_LABELS));

  SCRIPT_CATALOGUE.forEach(script => {
    assert.ok(script.version);
    assert.ok(script.maturity);
    assert.ok(Array.isArray(script.safety) && script.safety.length > 0);
    script.safety.forEach(safety => assert.equal(safetyKeys.has(safety), true));
  });

  SCRIPT_CATALOGUE
    .filter(script => script.runtime !== SCRIPT_RUNTIME.POWERSHELL_HELPER)
    .forEach(script => {
      assert.equal(script.safety.includes('remote-platform-mutation'), false);
    });

  assert.deepEqual(getScriptById('pcf-quick-deploy').excludedParameters.map(parameter => parameter.name), [
    'ApplicationId',
    'ClientSecret',
    'TenantId'
  ]);
  assert.equal(getScriptById('forensics-pcf').maturity, SCRIPT_MATURITY.FIELD_TESTED);
  assert.equal(SCRIPT_CATALOGUE.filter(script => script.maturity === SCRIPT_MATURITY.EXPERIMENTAL).length, 39);
});
