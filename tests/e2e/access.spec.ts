import { expect, test } from '@playwright/test';
import { T, login } from './helpers';

// Após o login, cada pessoa cai direto na sua área principal (sem tela de seleção).
const LANDING: [string, string][] = [
  ['dono', '/gestao'],
  ['garcom', '/atendimento'],
  ['cozinha', '/cozinha'],
  ['caixa', '/caixa'],
  ['adm', '/financeiro'],
  ['estoque', '/estoque'],
];

for (const [who, area] of LANDING) {
  test(`${who} entra direto em ${area}`, async ({ page }) => {
    await login(page, who);
    await expect(page).toHaveURL(new RegExp(`${T}${area}`));
    await expect(page.locator('.pdp-tenant-name').first()).toBeVisible();
    await expect(page.locator('.pdp-footer')).toContainText('crmplus.store');
  });
}

test('sem permissão, a área é bloqueada', async ({ page }) => {
  await login(page, 'garcom');
  await page.goto(`${T}/financeiro`);
  await expect(page).toHaveURL(/acesso\?motivo=sem-permissao/);
  await page.goto(`${T}/estoque/lotes`);
  await expect(page).toHaveURL(/acesso\?motivo=sem-permissao/);
});

test('sem sessão, a área interna pede login', async ({ page }) => {
  await page.goto(`${T}/caixa`);
  await expect(page).toHaveURL(new RegExp(`${T}/?\\?next=%2Fcaixa`));
  await expect(page.locator('input[name=email]')).toBeVisible();
});
