import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { readZipArchive } from '../../src/tools/power-platform-solution.js';
import {
  createFlowEditorSolutionZip
} from './support.js';

test('inspects cloud flow JSON and renders the selected flow diagram', async ({ page }) => {
  await page.goto('/#solution-package-inspector/flows');

  await expect(page.getByRole('heading', { name: 'Solution Package Inspector' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Flow editor');
  await page.getByRole('button', { name: 'Inspect flows' }).click();
  await expect(page.getByRole('status')).toContainText('Choose an exported solution ZIP');

  await loadFlowEditorSolution(page);

  await expect(page.locator('#flowPackageSolutionDetail')).toHaveText('Operations Toolkit');
  await expect(page.locator('#flowPackageVersionDetail')).toHaveText('1.2.3.4');
  await expect(page.locator('#flowPackageTypeDetail')).toHaveText('Unmanaged');
  await expect(page.locator('#flowPackageFlowsDetail')).toHaveText('2');
  await expect(page.locator('#flowPackageList').getByText('Account approval')).toBeVisible();
  await expect(page.locator('#flowPackageList').getByText('Child notifier')).toBeVisible();
  await expect(page.locator('#flowPackageOriginalJson')).toHaveValue(/"displayName": "Account approval"/);
  await expect(
    page.locator('[data-syntax-editor-for="flowPackageOriginalJson"] .syntax-token--key').first()
  ).toBeVisible();
  await expect(page.locator('[data-syntax-editor-for="flowPackageUpdatedJson"]')).toBeVisible();
  await expect(page.locator('#downloadFlowOriginalButton')).toHaveAttribute(
    'download',
    '11111111-1111-1111-1111-111111111111.json'
  );

  await page.getByRole('button', { name: 'Copy original' }).click();
  await expect(page.getByRole('status')).toContainText('Original flow JSON copied');
  await page.locator('.flow-package-mermaid-section summary').click();
  await page.getByRole('button', { name: 'Show original diagram' }).click();
  await expect(page.locator('#flowPackageMermaidPreview svg')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Original flow diagram rendered successfully.');
  await expect(page.getByRole('button', { name: 'Copy Mermaid' })).toBeVisible();
  await expect(page.locator('#flowPackageMermaidPreview [data-mermaid-download-source]')).toHaveAttribute(
    'download',
    '11111111-1111-1111-1111-111111111111-original-diagram.mmd'
  );
  await expect(page.locator('#flowPackageMermaidPreview [data-mermaid-download-svg]')).toHaveAttribute(
    'download',
    '11111111-1111-1111-1111-111111111111-original-diagram.svg'
  );
  await expect(page.locator('#flowPackageMermaidPreview [data-mermaid-download-png]')).toBeVisible();

  await page.getByRole('button', { name: 'Copy Mermaid' }).click();
  await expect(page.getByRole('status')).toContainText('Mermaid source copied');
  const zoomLevel = page.locator('#flowPackageMermaidPreview [data-mermaid-zoom-level]');
  const initialZoom = await zoomLevel.textContent();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoomLevel).not.toHaveText(initialZoom);

  const viewport = page.locator('#flowPackageMermaidPreview [data-mermaid-viewport]');
  const canvas = page.locator('#flowPackageMermaidPreview [data-mermaid-canvas]');
  const initialTransform = await canvas.getAttribute('style');
  const bounds = await viewport.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 45, bounds.y + bounds.height / 2 + 30);
  await page.mouse.up();
  await expect(canvas).not.toHaveAttribute('style', initialTransform);
});

test('stages multiple flow updates and downloads a verified solution ZIP', async ({ page }) => {
  await page.goto('/#solution-package-inspector/flows');
  await loadFlowEditorSolution(page);

  const accountOriginal = JSON.parse(await page.locator('#flowPackageOriginalJson').inputValue());
  accountOriginal.properties.definition.actions.Compose_update = {
    type: 'Compose'
  };
  await page.locator('#flowPackageUpdatedJson').fill(JSON.stringify(accountOriginal, null, 2));
  await expect(
    page.locator('[data-syntax-editor-for="flowPackageUpdatedJson"] .syntax-token--key').first()
  ).toBeVisible();
  await page.getByRole('button', { name: 'Review update' }).click();

  await expect(page.getByRole('status')).toContainText('valid and ready to stage');
  await expect(page.locator('#flowPackageAddedDetail')).toHaveText('1');
  await expect(page.locator('#flowPackageActionsDetail')).toHaveText('1 → 2');
  await expect(page.getByRole('button', { name: 'Stage update' })).toBeEnabled();
  await page.locator('.flow-package-mermaid-section summary').click();
  await page.getByRole('button', { name: 'Show updated diagram' }).click();
  await expect(page.locator('#flowPackageMermaidPreview svg')).toBeVisible();
  await page.getByRole('button', { name: 'Stage update' }).click();
  await expect(page.locator('#flowPackageUpdatesDetail')).toHaveText('1');

  await page.locator('#flowPackageList').getByRole('button').filter({ hasText: 'Child notifier' }).click();
  const childOriginal = JSON.parse(await page.locator('#flowPackageOriginalJson').inputValue());
  childOriginal.properties.definition.actions.Send_message = {
    type: 'OpenApiConnection'
  };
  await page.setInputFiles('#flowPackageUpdatedFileInput', {
    name: 'child-notifier-updated.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(childOriginal, null, 2))
  });
  await expect(page.getByRole('status')).toContainText('loaded as the updated flow JSON');
  await page.getByRole('button', { name: 'Review update' }).click();
  await page.getByRole('button', { name: 'Stage update' }).click();

  await expect(page.locator('#flowPackageUpdatesDetail')).toHaveText('2');
  await expect(page.locator('#flowPackageTargetVersion')).toHaveValue('1.2.3.5');
  await expect(page.locator('#flowPackageReadinessDetail')).toHaveText('2 updates ready');
  await page.getByRole('button', { name: 'Generate updated ZIP' }).click();
  await expect(page.getByRole('status')).toContainText('Updated solution ZIP verified successfully');
  await expect(page.locator('#downloadFlowPackageButton')).toHaveAttribute(
    'download',
    'ops_toolkit_1_2_3_5.zip'
  );

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadFlowPackageButton').click();
  const download = await downloadPromise;
  const downloadedBytes = new Uint8Array(await readFile(await download.path()));
  const zip = await readZipArchive(downloadedBytes);

  expect(await zip.readText('solution.xml')).toContain('<Version>1.2.3.5</Version>');
  expect(JSON.parse(await zip.readText('Workflows/11111111-1111-1111-1111-111111111111.json')))
    .toEqual(accountOriginal);
  expect(JSON.parse(await zip.readText('Workflows/22222222-2222-2222-2222-222222222222.json')))
    .toEqual(childOriginal);
  expect(await zip.readText('WebResources/contoso_/unchanged.txt'))
    .toBe('This entry must remain unchanged.');
});

test('reports unsafe flow updates and keeps managed solutions read only', async ({ page }) => {
  await page.goto('/#solution-package-inspector/flows');
  await loadFlowEditorSolution(page);

  await page.locator('#flowPackageUpdatedJson').fill('{}');
  await page.getByRole('button', { name: 'Review update' }).click();
  await expect(page.getByRole('status')).toContainText('recognised cloud flow definition');
  await expect(page.getByRole('button', { name: 'Stage update' })).toBeDisabled();

  const renamed = JSON.parse(await page.locator('#flowPackageOriginalJson').inputValue());
  renamed.properties.displayName = 'Renamed by AI';
  await page.locator('#flowPackageUpdatedJson').fill(JSON.stringify(renamed));
  await page.getByRole('button', { name: 'Review update' }).click();
  await expect(page.getByRole('status')).toContainText('properties.displayName must remain unchanged');

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.setInputFiles('#flowPackageFileInput', {
    name: 'ops-toolkit-managed.zip',
    mimeType: 'application/zip',
    buffer: createFlowEditorSolutionZip({ managed: true })
  });
  await page.getByRole('button', { name: 'Inspect flows' }).click();

  await expect(page.locator('#flowPackageTypeDetail')).toHaveText('Managed');
  await expect(page.locator('#flowPackageReadOnlyNotice')).toContainText('Managed solutions can be inspected');
  await expect(page.locator('#flowPackageUpdatedJson')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Review update' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Generate updated ZIP' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('read-only mode');
});

test('hands flow JSON and rendered Mermaid to the local workbenches', async ({ page }) => {
  await page.goto('/#solution-package-inspector/flows');
  await loadFlowEditorSolution(page);

  const originalJson = await page.locator('#flowPackageOriginalJson').inputValue();
  await expect(page.locator('#toolHandover')).toContainText('Continue with this JSON');
  await page.locator('#toolHandover').getByRole('button', {
    name: /Original flow JSON: Open in JSON Workbench/
  }).click();

  await expect(page).toHaveURL(/#json-data-workbench$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Format');
  await expect(page.getByLabel('JSON input')).toHaveValue(originalJson);

  await page.goto('/#solution-package-inspector/flows');
  await loadFlowEditorSolution(page);
  const updated = JSON.parse(await page.locator('#flowPackageOriginalJson').inputValue());
  updated.properties.definition.actions.Handover_action = { type: 'Compose' };
  await page.locator('#flowPackageUpdatedJson').fill(JSON.stringify(updated, null, 2));
  await page.locator('#toolHandover').getByRole('button', {
    name: /Updated flow JSON: Open in JSON Workbench/
  }).click();

  await expect(page).toHaveURL(/#json-data-workbench$/);
  await expect(page.getByLabel('JSON input')).toHaveValue(/Handover_action/);

  await page.goto('/#solution-package-inspector/flows');
  await loadFlowEditorSolution(page);
  await page.locator('.flow-package-mermaid-section summary').click();
  await page.getByRole('button', { name: 'Show original diagram' }).click();
  await expect(page.locator('#flowPackageMermaidPreview svg')).toBeVisible();
  await page.locator('#toolHandover').getByRole('button', {
    name: /Rendered flow Mermaid: Preview and export/
  }).click();

  await expect(page).toHaveURL(/#mermaid-studio$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Editor');
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/^flowchart TD/);
  await expect(page.getByLabel('Mermaid source')).toHaveValue(/Account approval/);
});

async function loadFlowEditorSolution(page) {
  await page.setInputFiles('#flowPackageFileInput', {
    name: 'ops-toolkit.zip',
    mimeType: 'application/zip',
    buffer: createFlowEditorSolutionZip()
  });
  await page.getByRole('button', { name: 'Inspect flows' }).click();
  await expect(page.getByRole('status')).toContainText('Cloud flows inspected successfully.');
}
