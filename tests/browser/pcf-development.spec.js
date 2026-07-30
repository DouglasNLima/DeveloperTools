import { expect, test } from '@playwright/test';

test('builds a launcher for a new PCF control and reports validation errors', async ({ page }) => {
  await page.goto('/#pcf-development-hub');

  await expect(page.getByRole('heading', { name: 'PCF Development Hub' })).toBeVisible();
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Create');
  await expect(page.getByText('Prepared here, run by you')).toBeVisible();

  await page.getByRole('button', { name: 'Build launcher', exact: true }).click();
  await expect(page.locator('#pcfScriptDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter ps scripts folder');

  await page.getByLabel('PS Scripts folder').fill(String.raw`C:\Projects\PCF\PS Scripts`);
  await page.getByLabel('Control name').fill('InspectionControl');
  await page.getByLabel('Publisher name').fill('Contoso');
  await page.getByLabel('Publisher prefix').fill('cts');
  await page.getByLabel('New project root').fill(String.raw`C:\Projects\PCF\InspectionControl`);
  await page.getByLabel('Solution unique name').fill('Inspection_Control');
  await page.getByLabel('Control template').selectOption('dataset');
  await page.getByLabel('Solution description').fill('Custom inspection control.');
  await page.getByRole('button', { name: 'Build launcher', exact: true }).click();

  await expect(page.locator('#pcfScriptDetail')).toHaveText('Initialize-NewPCFProject.ps1');
  await expect(page.locator('#pcfParametersDetail')).toHaveText('8');
  await expect(page.locator('#pcfCommandOutput')).toHaveValue(/Initialize-NewPCFProject\.ps1/);
  await expect(page.locator('#pcfCommandOutput')).toHaveValue(/-ControlName 'InspectionControl'/);
  await expect(page.locator('#pcfCommandOutput')).toHaveValue(/-ControlTemplate 'dataset'/);
  await expect(page.locator('#pcfLauncherOutput')).toHaveValue(/\$parameters = \[ordered\]@\{/);
  await expect(page.locator('#downloadPcfLauncherButton')).toHaveAttribute('download', 'initialise-project-launcher.ps1');
  await expect(page.getByRole('button', { name: 'Copy command', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('PCF launcher built successfully.');
});

test('supports the build, deploy and quality phases', async ({ page }) => {
  await page.goto('/#pcf-development-hub/build');

  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Version & build');
  await page.getByLabel('Action').selectOption('build-and-deploy');
  await expect(page.getByLabel('Environment URL')).toBeDisabled();
  await page.getByLabel('PS Scripts folder').fill(String.raw`C:\Projects\PCF\PS Scripts`);
  await page.getByLabel('PCF project root').fill(String.raw`C:\Projects\PCF\InspectionControl`);
  await page.getByLabel('Increment versions before building').check();
  await page.getByLabel('Build configuration').selectOption('Release');
  await page.getByLabel('Deploy after a successful build').check();
  await expect(page.getByLabel('Environment URL')).toBeEnabled();
  await page.getByLabel('Environment URL').fill('https://contoso.crm4.dynamics.com');
  await page.getByLabel('Deploy the managed solution').check();
  await page.getByRole('button', { name: 'Build launcher', exact: true }).click();

  await expect(page.locator('#pcfCommandOutput')).toHaveValue(/Build-And-Deploy-PCF\.ps1/);
  await expect(page.locator('#pcfCommandOutput')).toHaveValue(/-IncrementVersion/);
  await expect(page.locator('#pcfCommandOutput')).toHaveValue(/-DeployManaged/);

  await page.goto('/#pcf-development-hub/deploy');
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Deploy');
  await page.getByLabel('Action').selectOption('deploy-solution');
  await page.getByLabel('PS Scripts folder').fill(String.raw`C:\Projects\PCF\PS Scripts`);
  await page.getByLabel('Solution ZIP path').fill(String.raw`C:\Build\InspectionControl.zip`);
  await page.getByLabel('Environment URL').fill('https://contoso.crm4.dynamics.com');
  await page.getByLabel('Publish changes after import').uncheck();
  await page.getByLabel('Skip the deployment confirmation').check();
  await page.getByRole('button', { name: 'Build launcher', exact: true }).click();

  await expect(page.locator('#pcfCommandOutput')).toHaveValue(/-PublishChanges:\$false -Force/);

  await page.goto('/#pcf-development-hub/quality');
  await expect(page.locator('.tool-workbench-tab[aria-current="page"]')).toHaveText('Quality');
  await page.getByLabel('PS Scripts folder').fill(String.raw`C:\Projects\PCF\PS Scripts`);
  await page.getByLabel('Solution ZIP path').fill(String.raw`C:\Build\InspectionControl.zip`);
  await page.getByLabel('Checker output folder').fill(String.raw`C:\Build\checker`);
  await page.getByLabel('Checker geography').fill('Europe');
  await page.getByLabel('Fail on severity').selectOption('Medium');
  await page.getByLabel('Allowed issue threshold').fill('2');
  await page.getByRole('button', { name: 'Build launcher', exact: true }).click();

  await expect(page.locator('#pcfCommandOutput')).toHaveValue(/Invoke-SolutionCheck\.ps1/);
  await expect(page.locator('#pcfCommandOutput')).toHaveValue(/-FailOnLevel 'Medium' -FailOnThreshold 2/);
});
