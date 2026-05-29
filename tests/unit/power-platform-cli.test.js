import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPowerPlatformCliCommand,
  normalisePath,
  quoteCliArgument
} from '../../src/tools/power-platform-cli.js';

test('builds authentication commands', () => {
  const result = buildPowerPlatformCliCommand({
    action: 'auth-create',
    environmentUrl: 'https://org.crm4.dynamics.com',
    deviceCode: true
  });

  assert.equal(result.command, 'pac auth create --environment https://org.crm4.dynamics.com --deviceCode');
  assert.equal(result.actionGroup, 'Authentication');
  assert.equal(result.warnings.length, 0);
});

test('builds solution export and import commands with warnings', () => {
  const exportResult = buildPowerPlatformCliCommand({
    action: 'solution-export',
    solutionName: 'Core Solution',
    path: 'dist/core solution.zip',
    managed: true,
    async: true
  });

  assert.equal(
    exportResult.command,
    'pac solution export --name "Core Solution" --path "dist/core solution.zip" --managed true --async'
  );
  assert.match(exportResult.warnings[0], /Managed exports/);

  const importResult = buildPowerPlatformCliCommand({
    action: 'solution-import',
    path: 'dist/core.zip',
    forceOverwrite: true
  });

  assert.equal(importResult.command, 'pac solution import --path dist/core.zip --force-overwrite');
  assert.match(importResult.warnings[0], /Force overwrite/);
});

test('builds pack, unpack and checker commands', () => {
  assert.equal(
    buildPowerPlatformCliCommand({
      action: 'solution-pack',
      path: 'dist/core.zip',
      folder: 'src/core',
      packageType: 'Managed'
    }).command,
    'pac solution pack --zipfile dist/core.zip --folder src/core --packagetype Managed'
  );
  assert.equal(
    buildPowerPlatformCliCommand({
      action: 'solution-unpack',
      path: 'dist/core.zip',
      folder: 'src/core',
      packageType: 'Both'
    }).command,
    'pac solution unpack --zipfile dist/core.zip --folder src/core --packagetype Both'
  );
  assert.equal(
    buildPowerPlatformCliCommand({
      action: 'solution-check',
      path: 'dist/core.zip',
      outputDirectory: 'reports/check'
    }).command,
    'pac solution check --path dist/core.zip --outputDirectory reports/check'
  );
});

test('builds Power Pages commands and active context warnings', () => {
  const download = buildPowerPlatformCliCommand({
    action: 'powerpages-download',
    folder: 'sites/contoso',
    websiteId: '00000000-0000-0000-0000-000000000001',
    environmentUrl: 'https://org.crm4.dynamics.com'
  });
  const upload = buildPowerPlatformCliCommand({
    action: 'powerpages-upload',
    folder: 'sites/contoso'
  });

  assert.equal(
    download.command,
    'pac pages download --path sites/contoso --webSiteId 00000000-0000-0000-0000-000000000001 --environment https://org.crm4.dynamics.com'
  );
  assert.equal(upload.command, 'pac pages upload --path sites/contoso');
  assert.match(upload.warnings[0], /active pac authentication context/);
});

test('quotes CLI arguments and reports validation errors', () => {
  assert.equal(quoteCliArgument('simple/path.zip'), 'simple/path.zip');
  assert.equal(quoteCliArgument('path with spaces.zip'), '"path with spaces.zip"');
  assert.equal(normalisePath('  dist/core.zip  '), 'dist/core.zip');
  assert.throws(
    () => buildPowerPlatformCliCommand({ action: 'solution-export', path: 'dist/core.zip' }),
    /solution name/
  );
  assert.throws(
    () => buildPowerPlatformCliCommand({ action: 'auth-create', environmentUrl: 'org.crm4.dynamics.com' }),
    /Environment URL/
  );
  assert.throws(
    () => buildPowerPlatformCliCommand({ action: 'solution-pack', path: 'a.zip', folder: 'src', packageType: 'Unknown' }),
    /Package type/
  );
});
