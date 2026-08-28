import { expect, test } from '@playwright/test';

test('modernises the legacy PCF route and generates a reviewed PCF launcher', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#pcf-development-hub');

  await expect(page.locator('#activeToolTitle')).toHaveText('Power Platform Script Hub');
  await expect(page).toHaveURL(/#power-platform-script-hub$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Development');
  await expect(page.getByText('Prepared here, run by you')).toBeVisible();

  await page.getByRole('button', { name: 'Generate output', exact: true }).click();
  await expect(page.locator('#scriptHubScriptDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter ps scripts folder');

  await page.getByLabel('PS Scripts folder').fill(String.raw`C:\Projects\PCF\PS Scripts`);
  await page.getByLabel('Control name').fill('InspectionControl');
  await page.getByLabel('Publisher name').fill('Contoso');
  await page.getByLabel('Publisher prefix').fill('cts');
  await page.getByLabel('New project root').fill(String.raw`C:\Projects\PCF\InspectionControl`);
  await page.getByLabel('Solution unique name').fill('Inspection_Control');
  await page.getByLabel('Control template').selectOption('dataset');
  await page.getByLabel('Solution description').fill("Director's inspection control");
  await page.getByRole('button', { name: 'Generate output', exact: true }).click();

  await expect(page.locator('#scriptHubScriptDetail')).toHaveText('Initialize-NewPCFProject.ps1');
  await expect(page.locator('#scriptHubParametersDetail')).toHaveText('8');
  await expect(page.locator('#scriptHubCommandOutput')).toHaveValue(/Initialize-NewPCFProject\.ps1/);
  await expect(page.locator('#scriptHubCommandOutput')).toHaveValue(/-ControlName 'InspectionControl'/);
  await expect(page.locator('#scriptHubCommandOutput')).toHaveValue(/-ControlTemplate 'dataset'/);
  await expect(page.locator('#scriptHubLauncherOutput')).toHaveValue(/\$parameters = \[ordered\]@\{/);
  await expect(page.locator('#downloadScriptHubOutput')).toHaveAttribute('download', 'initialise-project-launcher.ps1');
  await expect(page.getByRole('button', { name: 'Copy command', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Copy command', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('PowerShell command copied to the clipboard.');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadScriptHubOutput').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('initialise-project-launcher.ps1');
});

test('preserves legacy PCF phase links and uses source-supported build parameters', async ({ page }) => {
  await page.goto('/#pcf-development-hub/build');

  await expect(page).toHaveURL(/#power-platform-script-hub$/);
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Development');
  await expect(page.locator('#scriptHubScript')).toHaveValue('pcf-build-deploy');
  await page.getByLabel('PS Scripts folder').fill(String.raw`C:\Projects\PCF\PS Scripts`);
  await page.getByLabel('PCF project root').fill(String.raw`C:\Projects\PCF\InspectionControl`);
  await page.getByLabel('Increment the version before building').check();
  await page.getByLabel('Deploy after a successful build').check();
  await expect(page.getByLabel('Environment URL')).toBeEnabled();
  await page.getByLabel('Environment URL').fill('https://contoso.crm4.dynamics.com');
  await page.getByLabel('Deploy the managed solution').check();
  await page.getByRole('button', { name: 'Generate output', exact: true }).click();

  await expect(page.locator('#scriptHubCommandOutput')).toHaveValue(/Build-And-Deploy-PCF\.ps1/);
  await expect(page.locator('#scriptHubCommandOutput')).toHaveValue(/-IncrementVersion/);
  await expect(page.locator('#scriptHubCommandOutput')).toHaveValue(/-DeployManaged/);
  await expect(page.locator('#scriptHubCommandOutput')).not.toHaveValue(/BuildConfiguration|FailOnLevel|FailOnThreshold/);

  await page.goto('/#pcf-development-hub/deploy');
  await expect(page.locator('#scriptHubScript')).toHaveValue('pcf-quick-deploy');
});

test('supports Investigation mode with field-tested PCF Forensics and another forensic script', async ({ page }) => {
  await page.goto('/#power-platform-script-hub/investigation');

  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Investigation');
  await page.locator('#scriptHubScript').selectOption('forensics-pcf');
  await page.getByLabel('PCF control name').fill('publisher_namespace.Controls.InspectionControl');
  await expect(page.locator('#scriptHubMaturity')).toHaveText('Field-tested');
  await expect(page.locator('#scriptHubSafety')).toContainText('Remote read-only');
  await page.getByRole('button', { name: 'Generate output', exact: true }).click();

  await expect(page.locator('#scriptHubScriptOutput')).toBeVisible();
  await expect(page.locator('#scriptHubScriptOutput')).toHaveValue(/window\.__PCF_FORENSICS/);
  await expect(page.locator('#scriptHubScriptOutput')).toHaveValue(/CustomControlResource/);
  await expect(page.locator('#downloadScriptHubOutput')).toHaveAttribute('download', 'PCF-Forensics-Generic.txt');
  await page.getByRole('button', { name: 'Copy script', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Browser script copied to the clipboard.');

  await page.locator('#scriptHubScript').selectOption('forensics-flow');
  await page.getByLabel('Flow name contains').fill("O'Brien $&");
  await expect(page.locator('#scriptHubMaturity')).toHaveText('Experimental');
  await expect(page.locator('#scriptHubSafety')).toContainText('Remote read-only');
  await page.getByRole('button', { name: 'Generate output', exact: true }).click();

  await expect(page.locator('#scriptHubScriptOutput')).toHaveValue(/"nameContains": "O'Brien \$&"/);
  await expect(page.locator('#downloadScriptHubOutput')).toHaveAttribute('download', 'Flow-Forensics.txt');
});

test('supports the Power Pages operational family and makes local mutation visible', async ({ page }) => {
  await page.goto('/#power-platform-script-hub/power-pages');

  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Power Pages');
  await page.locator('#scriptHubScript').selectOption('pp-pages-sync');
  await expect(page.locator('#scriptHubSafety')).toContainText('local filesystem');
  await expect(page.locator('#scriptHubSafety')).toContainText('authentication-context');

  await page.getByLabel('PS Scripts folder').fill(String.raw`C:\Projects\Power Pages\PS Scripts`);
  await page.getByLabel('Environment URL').fill('https://contoso.crm4.dynamics.com');
  await page.getByLabel('PAC authentication profile').fill('Contoso-Dev');
  await page.getByLabel('Website ID').fill('00000000-0000-0000-0000-000000000000');
  await page.getByLabel('Local target directory').fill(String.raw`C:\Power Pages\site`);
  await page.getByLabel('Staging directory').fill(String.raw`C:\Power Pages\staging`);
  await page.getByRole('button', { name: 'Generate output', exact: true }).click();

  await expect(page.locator('#scriptHubCommandOutput')).toHaveValue(/Sync-PowerPagesSite\.ps1/);
  await expect(page.locator('#scriptHubCommandOutput')).toHaveValue(/-WebsiteId '00000000-0000-0000-0000-000000000000'/);
  await expect(page.getByRole('status')).toContainText('Output generated successfully.');
});

test('keeps the Script Hub usable at a narrow responsive viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#power-platform-script-hub/investigation');

  await expect(page.locator('#scriptHubScript')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate output', exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
