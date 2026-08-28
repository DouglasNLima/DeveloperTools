import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PCF_SCRIPT_ACTIONS,
  buildPcfScriptCommand,
  getPcfActionsForPhase,
  quotePowerShellArgument
} from '../../src/tools/pcf-development.js';

const scriptsPath = String.raw`C:\Projects\PCF\PS Scripts`;

test('preserves the legacy PCF create command and launcher API', () => {
  const result = buildPcfScriptCommand({
    action: 'initialise-project',
    scriptsPath,
    controlName: 'InspectionControl',
    publisherName: 'Contoso',
    publisherPrefix: 'cts',
    projectPath: String.raw`C:\Projects\PCF Controls\InspectionControl`,
    solutionUniqueName: 'Inspection_Control',
    controlTemplate: 'dataset',
    controlFramework: 'react',
    solutionDescription: "Director's $([System.IO.File]::Delete('x'))"
  });

  assert.equal(result.phaseLabel, 'Create');
  assert.equal(result.scriptName, 'Initialize-NewPCFProject.ps1');
  assert.match(result.command, /& \(Join-Path 'C:\\Projects\\PCF\\PS Scripts' 'Initialize-NewPCFProject\.ps1'\)/);
  assert.match(result.command, /-PublisherName 'Contoso'/);
  assert.match(result.command, /-ControlTemplate 'dataset'/);
  assert.match(result.command, /-SolutionDescription 'Director''s \$\(\[System\.IO\.File\]::Delete\(''x''\)\)'/);
  assert.match(result.launcher, /\$parameters = \[ordered\]@\{/);
  assert.match(result.launcher, /ControlName = 'InspectionControl'/);
  assert.match(result.launcher, /& \$scriptPath @parameters/);
  assert.equal(result.launcherFilename, 'initialise-project-launcher.ps1');
  assert.equal(result.summary.parameterCount, 8);
});

test('keeps every legacy PCF action available with authoritative parameters', () => {
  const fixtures = [
    { action: 'initialise-project', controlName: 'InspectionControl', publisherName: 'Contoso', publisherPrefix: 'cts', projectPath: String.raw`C:\Projects\PCF`, solutionUniqueName: 'Inspection_Control' },
    { action: 'environment-report' },
    { action: 'test-harness', controlFolder: String.raw`C:\Projects\PCF\Control\Control` },
    { action: 'update-version', projectRoot: String.raw`C:\Projects\PCF\Control` },
    { action: 'build-and-deploy', projectRoot: String.raw`C:\Projects\PCF\Control`, incrementVersion: true, deploy: true, environmentUrl: 'https://contoso.crm4.dynamics.com', deployManaged: true },
    { action: 'quick-deploy', controlFolder: String.raw`C:\Projects\PCF\Control`, publisherPrefix: 'cts', environmentUrl: 'https://contoso.crm4.dynamics.com' },
    { action: 'deploy-solution', solutionZipPath: String.raw`C:\Build\Control_managed.zip`, environmentUrl: 'https://contoso.crm4.dynamics.com', publishChanges: false, force: true },
    { action: 'solution-check', solutionZipPath: String.raw`C:\Build\Control.zip`, outputDirectory: String.raw`C:\Build\checker`, geo: 'Europe', failOnSarifLevel: 'warning' }
  ];

  const results = fixtures.map(fixture => buildPcfScriptCommand({ scriptsPath, ...fixture }));

  assert.equal(PCF_SCRIPT_ACTIONS.length, 8);
  assert.equal(results.length, 8);
  assert.equal(new Set(results.map(result => result.scriptName)).size, 8);
  assert.match(results[2].command, /^Push-Location 'C:\\Projects\\PCF\\Control\\Control'; try \{/);
  assert.match(results[3].command, /-IncrementPart 'Build'/);
  assert.match(results[4].command, /-IncrementVersion/);
  assert.match(results[4].command, /-DeployManaged/);
  assert.match(results[5].command, /-ProjectRoot 'C:\\Projects\\PCF\\Control'/);
  assert.doesNotMatch(results[5].command, /ClientSecret|ApplicationId|TenantId/);
  assert.match(results[6].command, /-PublishChanges:\$false/);
  assert.match(results[6].command, /-Force/);
  assert.match(results[7].command, /-FailOnSarifLevel 'warning'/);
  assert.doesNotMatch(results[7].command, /FailOnLevel|FailOnThreshold/);
});

test('validates required fields, identifiers, URLs and source-supported choices', () => {
  assert.throws(
    () => buildPcfScriptCommand({ action: 'environment-report' }),
    /Enter ps scripts folder/
  );

  assert.throws(
    () => buildPcfScriptCommand({
      action: 'initialise-project',
      scriptsPath,
      controlName: 'Inspection Control',
      publisherName: 'Contoso',
      publisherPrefix: 'cts',
      projectPath: String.raw`C:\Projects\PCF`,
      solutionUniqueName: 'InspectionControl'
    }),
    /Control name must start with a letter/
  );

  assert.throws(
    () => buildPcfScriptCommand({
      action: 'build-and-deploy',
      scriptsPath,
      projectRoot: String.raw`C:\Projects\PCF\Control`,
      deploy: true
    }),
    /Enter environment url/
  );

  assert.throws(
    () => buildPcfScriptCommand({
      action: 'quick-deploy',
      scriptsPath,
      controlFolder: String.raw`C:\Projects\PCF\Control`,
      publisherPrefix: 'cts',
      environmentUrl: 'http://contoso.crm4.dynamics.com'
    }),
    /Environment URL must be a valid HTTPS URL/
  );

  assert.throws(
    () => buildPcfScriptCommand({
      action: 'solution-check',
      scriptsPath,
      solutionZipPath: String.raw`C:\Build\Control.zip`,
      outputDirectory: String.raw`C:\Build\checker`,
      failOnSarifLevel: 'medium'
    }),
    /Choose a supported fail on sarif level/
  );
});

test('keeps phase grouping and exposes material safety warnings', () => {
  assert.deepEqual(
    getPcfActionsForPhase('deploy').map(action => action.value),
    ['quick-deploy', 'deploy-solution']
  );
  assert.equal(getPcfActionsForPhase('missing').length, 0);

  const environmentReport = buildPcfScriptCommand({
    action: 'environment-report',
    scriptsPath
  });
  const quickDeploy = buildPcfScriptCommand({
    action: 'quick-deploy',
    scriptsPath,
    controlFolder: String.raw`C:\Projects\PCF\Control`,
    publisherPrefix: 'cts',
    environmentUrl: 'https://contoso.crm4.dynamics.com'
  });

  assert.deepEqual(environmentReport.warnings, []);
  assert.ok(quickDeploy.warnings.some(warning => /can change a remote Power Platform environment/.test(warning)));
  assert.ok(quickDeploy.warnings.some(warning => /service-principal parameter set is deliberately omitted/.test(warning)));
});

test('quotes PowerShell values without allowing expression or newline breaks', () => {
  const value = "O'Brien $([System.IO.File]::Delete('x')) `n next";
  const quoted = quotePowerShellArgument(value);

  assert.equal(quoted, "'O''Brien $([System.IO.File]::Delete(''x'')) `n next'");
  assert.equal(quoted.startsWith("'"), true);
  assert.equal(quoted.endsWith("'"), true);
});
