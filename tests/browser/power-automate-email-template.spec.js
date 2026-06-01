import { expect, test } from '@playwright/test';

test('generates Outlook-friendly email HTML with preview-only token highlights', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search tools').fill('email template');
  await expect(page.locator('[data-tool-id="power-automate-email-template-builder"]')).toBeVisible();
  await expect(page.locator('[data-tool-id="power-automate-email-template-builder"]')).toBeEnabled();
  await page.locator('[data-tool-id="power-automate-email-template-builder"]').click();

  await expect(page).toHaveURL(/#power-automate-email-template-builder$/);
  await expect(page.getByRole('heading', { name: 'Power Automate Email Template Builder' })).toBeVisible();
  await page.getByLabel('Email text').fill([
    'Deployment complete',
    'Owner: @{triggerOutputs()?[' + "'body/owner'" + ']}',
    '- Accounts updated',
    '- Contacts checked'
  ].join('\n'));
  await page.getByRole('button', { name: 'Generate email HTML', exact: true }).click();

  await expect(page.locator('#flowEmailTemplateDetail')).toHaveText('Notification');
  await expect(page.locator('#flowEmailParagraphsDetail')).toHaveText('1');
  await expect(page.locator('#flowEmailListsDetail')).toHaveText('1');
  await expect(page.locator('#flowEmailTokensDetail')).toHaveText('1');
  await expect(page.locator('#flowEmailWarningsDetail')).toHaveText('None');
  await expect(page.locator('#flowEmailOutput')).toHaveValue(/<table role="presentation"/);
  await expect(page.locator('#flowEmailOutput')).toHaveValue(/mso-table-lspace:0pt/);
  await expect(page.locator('#flowEmailOutput')).toHaveValue(/@\{triggerOutputs\(\)\?\['body\/owner'\]\}/);
  await expect(page.locator('#flowEmailOutput')).not.toHaveValue(/data-power-automate-token/);
  await expect(page.frameLocator('#flowEmailPreviewFrame').locator('[data-power-automate-token="true"]')).toContainText("@{triggerOutputs()?['body/owner']}");
  await expect(page.locator('#copyFlowEmailButton')).toBeEnabled();
  await expect(page.locator('#downloadFlowEmailButton')).toHaveAttribute('download', 'power-automate-email-body.html');
  await expect(page.getByRole('status')).toContainText('Email HTML generated successfully.');
});

test('reports validation errors and resets generated email output', async ({ page }) => {
  await page.goto('/#power-automate-email-template-builder');

  await page.getByRole('button', { name: 'Generate email HTML', exact: true }).click();

  await expect(page.locator('#flowEmailTemplateDetail')).toHaveText('Invalid');
  await expect(page.getByRole('status')).toContainText('Enter email text before generating HTML.');
  await expect(page.locator('#copyFlowEmailButton')).toBeDisabled();

  await page.getByLabel('Template', { exact: true }).selectOption('digest');
  await page.getByLabel('Output scope', { exact: true }).selectOption('document');
  await page.getByLabel('Email text').fill('Daily digest\nAlpha\nBeta');
  await page.getByRole('button', { name: 'Generate email HTML', exact: true }).click();

  await expect(page.locator('#flowEmailTemplateDetail')).toHaveText('Digest');
  await expect(page.locator('#flowEmailOutput')).toHaveValue(/^<!doctype html>/);
  await expect(page.locator('#downloadFlowEmailButton')).toHaveAttribute('download', 'power-automate-email.html');

  await page.getByRole('button', { name: 'Clear', exact: true }).click();

  await expect(page.getByLabel('Template', { exact: true })).toHaveValue('notification');
  await expect(page.getByLabel('Output scope', { exact: true })).toHaveValue('fragment');
  await expect(page.getByLabel('Use first line as heading')).toBeChecked();
  await expect(page.getByLabel('Email text')).toHaveValue('');
  await expect(page.locator('#flowEmailOutput')).toHaveValue('');
  await expect(page.locator('#copyFlowEmailButton')).toBeDisabled();
  await expect(page.locator('#flowEmailTemplateDetail')).toHaveText('-');
  await expect(page.getByRole('status')).toContainText('Ready.');
});
