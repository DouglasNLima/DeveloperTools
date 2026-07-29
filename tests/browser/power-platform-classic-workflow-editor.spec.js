import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { readZipArchive } from '../../src/tools/power-platform-solution.js';
import { createClassicWorkflowEditorSolutionZip } from './support.js';

test('inspects classic workflow XAML, metadata and an on-demand diagram', async ({ page }) => {
  await page.goto('/#solution-package-inspector/classic-workflows');

  await expect(page.getByRole('heading', { name: 'Solution Package Inspector' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Classic workflow editor');
  await page.getByRole('button', { name: 'Inspect classic workflows' }).click();
  await expect(page.getByRole('status')).toContainText('Choose an exported solution ZIP');

  await loadClassicWorkflowSolution(page);

  await expect(page.locator('#classicWorkflowSolutionDetail')).toHaveText('Operations Toolkit');
  await expect(page.locator('#classicWorkflowVersionDetail')).toHaveText('1.2.3.4');
  await expect(page.locator('#classicWorkflowTypeDetail')).toHaveText('Unmanaged');
  await expect(page.locator('#classicWorkflowCountDetail')).toHaveText('2');
  await expect(page.locator('#classicWorkflowList').getByText('Account follow up')).toBeVisible();
  await expect(page.locator('#classicWorkflowList').getByText('Case escalation')).toBeVisible();
  await expect(page.locator('#classicWorkflowOriginalXaml')).toHaveValue(/XrmWorkflow111/);
  await expect(
    page.locator('[data-syntax-editor-for="classicWorkflowOriginalXaml"] .syntax-token--tag').first()
  ).toBeVisible();
  await expect(page.locator('[data-syntax-editor-for="classicWorkflowUpdatedXaml"]')).toBeVisible();
  await expect(page.locator('#classicWorkflowTableDetail')).toHaveText('account');
  await expect(page.locator('#classicWorkflowTriggersDetail')).toContainText('Create');
  await expect(page.locator('#classicWorkflowTriggersDetail')).toContainText('Update: name, statuscode');
  await expect(page.locator('#downloadClassicWorkflowOriginalButton')).toHaveAttribute(
    'download',
    'AccountFollowUp.xaml'
  );

  await page.getByRole('button', { name: 'Copy original' }).click();
  await expect(page.getByRole('status')).toContainText('Original classic workflow XAML copied');
  await page.locator('.flow-package-mermaid-section summary').click();
  await page.getByRole('button', { name: 'Show original diagram' }).click();
  await expect(page.locator('#classicWorkflowMermaidPreview svg')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Original classic workflow diagram rendered successfully.');
  await expect(page.getByRole('button', { name: 'Copy SVG' })).toBeVisible();
  await expect(page.locator('#classicWorkflowMermaidPreview [data-mermaid-download-source]')).toHaveAttribute(
    'download',
    'AccountFollowUp-original-diagram.mmd'
  );
  await expect(page.locator('#classicWorkflowMermaidPreview [data-mermaid-download-svg]')).toHaveAttribute(
    'download',
    'AccountFollowUp-original-diagram.svg'
  );
  await expect(page.locator('#classicWorkflowMermaidPreview [data-mermaid-download-png]')).toBeVisible();
  await page.getByRole('button', { name: 'Copy SVG' }).click();
  await expect(page.getByRole('status')).toContainText('Rendered SVG copied');
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(page.locator('#classicWorkflowMermaidPreview [data-mermaid-zoom-level]')).not.toHaveText('100%');
  await page.getByRole('button', { name: 'Fit diagram' }).click();
});

test('stages, reverts and packages classic workflow XAML updates', async ({ page }) => {
  const inputBytes = createClassicWorkflowEditorSolutionZip();
  const inputZip = await readZipArchive(inputBytes);
  const originalCustomisations = await inputZip.readText('customizations.xml');

  await page.goto('/#solution-package-inspector/classic-workflows');
  await loadClassicWorkflowSolution(page, inputBytes);

  const accountUpdated = (await page.locator('#classicWorkflowOriginalXaml').inputValue())
    .replace('Create task', 'Create reviewed task');
  await page.locator('#classicWorkflowUpdatedXaml').fill(accountUpdated);
  await expect(
    page.locator('[data-syntax-editor-for="classicWorkflowUpdatedXaml"] .syntax-token--tag').first()
  ).toBeVisible();
  await expect(page.locator('#downloadClassicWorkflowUpdatedButton')).toHaveAttribute(
    'download',
    'AccountFollowUp-updated.xaml'
  );
  await page.getByRole('button', { name: 'Copy updated' }).click();
  await expect(page.getByRole('status')).toContainText('Updated classic workflow XAML copied');
  await page.getByRole('button', { name: 'Review update' }).click();
  await expect(page.getByRole('status')).toContainText('valid and ready to stage');
  await expect(page.locator('#classicWorkflowChangedDetail')).not.toHaveText('-');
  await page.locator('.flow-package-mermaid-section summary').click();
  await page.getByRole('button', { name: 'Show updated diagram' }).click();
  await expect(page.locator('#classicWorkflowMermaidPreview svg')).toBeVisible();
  await page.getByRole('button', { name: 'Stage update' }).click();
  await expect(page.locator('#classicWorkflowUpdatesDetail')).toHaveText('1');

  await page.locator('#classicWorkflowList').getByRole('button').filter({ hasText: 'Case escalation' }).click();
  const caseUpdated = (await page.locator('#classicWorkflowOriginalXaml').inputValue())
    .replace(
      '</Sequence>',
      '<mxswa:UpdateEntity DisplayName="Update reviewed case" /></Sequence>'
    );
  await page.setInputFiles('#classicWorkflowUpdatedFileInput', {
    name: 'case-escalation-updated.xaml',
    mimeType: 'application/xml',
    buffer: Buffer.from(caseUpdated)
  });
  await expect(page.getByRole('status')).toContainText('loaded as the updated classic workflow XAML');
  await page.getByRole('button', { name: 'Review update' }).click();
  await expect(page.locator('#classicWorkflowStepsDetail')).toHaveText('4 → 5');
  await page.getByRole('button', { name: 'Stage update' }).click();
  await expect(page.locator('#classicWorkflowUpdatesDetail')).toHaveText('2');

  await page.locator('#classicWorkflowList').getByRole('button').filter({ hasText: 'Account follow up' }).click();
  await page.getByRole('button', { name: 'Remove staged update' }).click();
  await expect(page.locator('#classicWorkflowUpdatesDetail')).toHaveText('1');
  await expect(page.locator('#classicWorkflowTargetVersion')).toHaveValue('1.2.3.5');
  await expect(page.locator('#classicWorkflowReadinessDetail')).toHaveText('Acknowledge the unsupported editing risk');
  await page.locator('#classicWorkflowRiskAcknowledgement').check();
  await expect(page.locator('#classicWorkflowReadinessDetail')).toHaveText('1 update ready');
  await page.locator('#classicWorkflowTargetVersion').fill('1.2.3.4');
  await expect(page.locator('#classicWorkflowReadinessDetail')).toHaveText('Target version must be higher');
  await page.locator('#classicWorkflowTargetVersion').fill('1.2.3.5');
  await expect(page.locator('#classicWorkflowReadinessDetail')).toHaveText('1 update ready');

  await page.getByRole('button', { name: 'Generate updated ZIP' }).click();
  await expect(page.getByRole('status')).toContainText('Updated solution ZIP verified successfully');
  await expect(page.locator('#downloadClassicWorkflowPackageButton')).toHaveAttribute(
    'download',
    'ops_toolkit_1_2_3_5.zip'
  );

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadClassicWorkflowPackageButton').click();
  const download = await downloadPromise;
  const outputBytes = new Uint8Array(await readFile(await download.path()));
  const outputZip = await readZipArchive(outputBytes);

  expect(await outputZip.readText('solution.xml')).toContain('<Version>1.2.3.5</Version>');
  expect(await outputZip.readText('Workflows/AccountFollowUp.xaml')).toContain('Create task');
  expect(await outputZip.readText('Workflows/AccountFollowUp.xaml')).not.toContain('Create reviewed task');
  expect(await outputZip.readText('Workflows/CaseEscalation.xaml')).toContain('Update reviewed case');
  expect(await outputZip.readText('customizations.xml')).toBe(originalCustomisations);
  expect(await outputZip.readText('WebResources/contoso_/unchanged.txt'))
    .toBe('This entry must remain unchanged.');
});

test('reports unsafe XAML and keeps managed solutions read only', async ({ page }) => {
  await page.goto('/#solution-package-inspector/classic-workflows');
  await loadClassicWorkflowSolution(page);

  await page.locator('#classicWorkflowUpdatedXaml').fill('<Workflow />');
  await page.getByRole('button', { name: 'Review update' }).click();
  await expect(page.getByRole('status')).toContainText('Activity root');
  await expect(page.getByRole('button', { name: 'Stage update' })).toBeDisabled();

  const renamed = (await page.locator('#classicWorkflowOriginalXaml').inputValue())
    .replace('XrmWorkflow111', 'XrmWorkflow999');
  await page.locator('#classicWorkflowUpdatedXaml').fill(renamed);
  await page.getByRole('button', { name: 'Review update' }).click();
  await expect(page.getByRole('status')).toContainText('x:Class identity must remain unchanged');

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.setInputFiles('#classicWorkflowFileInput', {
    name: 'ops-toolkit-managed.zip',
    mimeType: 'application/zip',
    buffer: createClassicWorkflowEditorSolutionZip({ managed: true })
  });
  await page.getByRole('button', { name: 'Inspect classic workflows' }).click();

  await expect(page.locator('#classicWorkflowTypeDetail')).toHaveText('Managed');
  await expect(page.locator('#classicWorkflowReadOnlyNotice')).toContainText('Managed solutions can be inspected');
  await expect(page.locator('#classicWorkflowUpdatedXaml')).toBeDisabled();
  await expect(page.locator('#classicWorkflowRiskAcknowledgement')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Generate updated ZIP' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('read-only mode');

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.setInputFiles('#classicWorkflowFileInput', {
    name: 'invalid.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from([1, 2, 3, 4])
  });
  await page.getByRole('button', { name: 'Inspect classic workflows' }).click();
  await expect(page.getByRole('status')).toContainText('valid exported solution ZIP');
});

test('hands classic workflow XAML and rendered Mermaid to local workbenches', async ({ page }) => {
  await page.goto('/#solution-package-inspector/classic-workflows');
  await loadClassicWorkflowSolution(page);

  const originalXaml = await page.locator('#classicWorkflowOriginalXaml').inputValue();
  await expect(page.locator('#toolHandover')).toContainText('Continue with this XML');
  await page.locator('#toolHandover').getByRole('button', {
    name: /Original workflow XAML: Explore XAML as XML/
  }).click();

  await expect(page).toHaveURL(/#json-data-workbench\/explore$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Explore');
  await expect(page.getByLabel('Input format')).toHaveValue('xml');
  await expect(page.getByLabel('JSON or XML input')).toHaveValue(originalXaml);

  await page.goto('/#solution-package-inspector/classic-workflows');
  await loadClassicWorkflowSolution(page);
  await page.locator('.flow-package-mermaid-section summary').click();
  await page.getByRole('button', { name: 'Show original diagram' }).click();
  await expect(page.locator('#classicWorkflowMermaidPreview svg')).toBeVisible();
  await page.locator('#toolHandover').getByRole('button', {
    name: /Rendered workflow Mermaid: Preview and export/
  }).click();

  await expect(page).toHaveURL(/#mermaid-studio$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Editor');
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/^flowchart TD/);
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/Account follow up/);
});

async function loadClassicWorkflowSolution(page, bytes = createClassicWorkflowEditorSolutionZip()) {
  await page.setInputFiles('#classicWorkflowFileInput', {
    name: 'ops-toolkit.zip',
    mimeType: 'application/zip',
    buffer: bytes
  });
  await page.getByRole('button', { name: 'Inspect classic workflows' }).click();
  await expect(page.getByRole('status')).toContainText('Classic workflows inspected successfully.');
}
