import { expect, test } from '@playwright/test';
import { T, login } from './helpers';

test('estoque: entrada avulsa aparece nas movimentações', async ({ page }) => {
  await login(page, 'estoque');
  await page.goto(`${T}/estoque/entrada`);
  const lot = `E2E${Date.now().toString().slice(-6)}`;
  await page.getByLabel('Material').selectOption({ label: 'Farinha de trigo 00 (kg)' });
  await page.getByLabel(/Quantidade/).fill('3');
  await page.getByLabel('Lote').fill(lot);
  await page.getByLabel('Motivo / origem').fill('Teste E2E');
  await page.getByRole('button', { name: 'Registrar entrada' }).click();
  await expect(page.getByText(/Entrada de 3 kg Farinha/)).toBeVisible();
  await page.goto(`${T}/estoque/movimentos?tipo=entrada`);
  await expect(page.getByText('Teste E2E').first()).toBeVisible();
});

test('financeiro: conta registrada e paga com comprovante de fluxo', async ({ page }) => {
  await login(page, 'adm');
  await page.goto(`${T}/financeiro/pagar`);
  const description = `Gás E2E ${Date.now().toString().slice(-6)}`;
  await page.getByLabel('Descrição', { exact: true }).fill(description);
  await page.getByLabel('Valor').fill('120,00');
  await page.getByRole('button', { name: 'Registrar' }).click();
  const row = page.locator('tr', { hasText: description });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Pagar' }).click();
  await page.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(row).toHaveCount(0);
  await page.goto(`${T}/financeiro/fluxo`);
  await expect(page.getByText(description)).toBeVisible();
});

test('cozinha solicita material e o estoque vê a solicitação', async ({ page }) => {
  await login(page, 'cozinha');
  await page.goto(`${T}/cozinha/materiais`);
  await page.getByLabel('Quantidade').first().fill('2');
  await page.getByRole('button', { name: 'Enviar solicitação' }).click();
  await expect(page.getByText('Solicitação enviada ao estoque.')).toBeVisible();
  await login(page, 'estoque');
  await page.goto(`${T}/estoque/solicitacoes`);
  await expect(page.getByRole('heading', { name: /Pendentes \(\d+\)/ })).toBeVisible();
});
