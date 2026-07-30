import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PCF_SCRIPT_ACTIONS,
  buildPcfScriptCommand,
  getPcfActionsForPhase,
  quotePowerShellArgument
} from '../../src/tools/pcf-development.js';

const scriptsPath = String.raw`C:\Projects\PCF\PS Scripts`;

test('builds a safely quoted new PCF project command and launcher', () => {
  const result = buildPcfScriptCommand({
    action: 'initialise-project',
    scriptsPath,
    controlName: 'InspectionControl',
    publisherName: "Director's Tools",
    publisherPrefix: 'dt',
    projectPath: String.raw`C:\Projects\PCF Controls\InspectionControl`,
    solutionUniqueName: 'Inspection_Control',
    controlTemplate: 'dataset',
    controlFramework: 'react',
    solutionDescription: "Director's inspection control"
  });

  assert.equal(result.phaseLabel, 'Create');
  assert.equal(result.scriptName, 'Initialize-NewPCFProject.ps1');
  assert.match(result.command, /& \(Join-Path 'C:\\Projects\\PCF\\PS Scripts' 'Initialize-NewPCFProject\.ps1'\)/);
  assert.match(result.command, /-PublisherName 'Director''s Tools'/);
  assert.match(result.command, /-ControlTemplate 'dataset'/);
  assert.match(result.command, /-SolutionDescription 'Director''s inspection control'/);
  assert.match(result.launcher, /\$parameters = \[ordered\]@\{/);
  assert.match(result.launcher, /ControlName = 'InspectionControl'/);
  assert.match(result.launcher, /& \$scriptPath @parameters/);
  assert.equal(result.launcherFilename, 'initialise-project-launcher.ps1');
  assert.equal(result.summary.parameterCount, 8);
});

test('builds commands for every attached PCF helper script', () => {
  const fixtures = [
    {
      action: 'environment-report',
      scriptsPath
    },
    {
      action: 'test-harness',
      scriptsPath,
      controlFolder: String.raw`C:\Projects\PCF\Control\Control`
    },
    {
      action: 'update-version',
      scriptsPath,
      projectRoot: String.raw`C:\Projects\PCF\Control`
    },
    {
      action: 'build-and-deploy',
      scriptsPath,
      projectRoot: String.raw`C:\Projects\PCF\Control`,
      incrementVersion: true,
      buildConfiguration: 'Release',
      deploy: true,
      environmentUrl: 'https://contoso.crm4.dynamics.com',
      deployManaged: true
    },
    {
      action: 'quick-deploy',
      scriptsPath,
      controlFolder: String.raw`C:\Projects\PCF\Control\Control`,
      publisherPrefix: 'cts',
      environmentUrl: 'https://contoso.crm4.dynamics.com'
    },
    {
      action: 'deploy-solution',
      scriptsPath,
      solutionZipPath: String.raw`C:\Build\Control_managed.zip`,
      environmentUrl: 'https://contoso.crm4.dynamics.com',
      publishChanges: false,
      force: true
    },
    {
      action: 'solution-check',
      scriptsPath,
      solutionZipPath: String.raw`C:\Build\Control.zip`,
      outputDirectory: String.raw`C:\Build\checker`,
      geo: 'Europe',
      failOnLevel: 'Medium',
      failOnThreshold: '2'
    }
  ];

  const results = fixtures.map(buildPcfScriptCommand);

  assert.equal(results.length, 7);
  assert.equal(new Set(results.map(result => result.scriptName)).size, 7);
  assert.match(results[1].command, /^Push-Location 'C:\\Projects\\PCF\\Control\\Control'; try \{/);
  assert.match(results[3].command, /-IncrementVersion/);
  assert.match(results[3].command, /-DeployManaged/);
  assert.match(results[4].command, /-PublisherPrefix 'cts'/);
  assert.doesNotMatch(results[4].command, /ClientSecret|ApplicationId|TenantId/);
  assert.match(results[5].command, /-PublishChanges:\$false/);
  assert.match(results[5].command, /-Force/);
  assert.match(results[6].command, /-FailOnLevel 'Medium' -FailOnThreshold 2/);
});

test('validates required fields, identifiers, URLs and quality thresholds', () => {
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
    /Enter an environment URL when deployment is enabled/
  );

  assert.throws(
    () => buildPcfScriptCommand({
      action: 'quick-deploy',
      scriptsPath,
      controlFolder: String.raw`C:\Projects\PCF\Control\Control`,
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
      failOnThreshold: '-1'
    }),
    /whole number of zero or more/
  );
});

test('keeps phase actions focused and warns about attached script boundaries', () => {
  assert.equal(PCF_SCRIPT_ACTIONS.length, 8);
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
    controlFolder: String.raw`C:\Projects\PCF\Control\Control`,
    publisherPrefix: 'cts',
    environmentUrl: 'https://contoso.crm4.dynamics.com'
  });

  assert.match(environmentReport.warnings[0], /does not expose it as a script-level parameter/);
  assert.match(quickDeploy.warnings[0], /Service principal secrets are deliberately not added/);
});

test('quotes PowerShell values without allowing single-quoted expression breaks', () => {
  assert.equal(
    quotePowerShellArgument("O'Brien $([System.IO.File]::Delete('x'))"),
    "'O''Brien $([System.IO.File]::Delete(''x''))'"
  );
});
