import { expect, test } from '@playwright/test';
import { T, login } from './helpers';

// O modelo visual é salvo por usuário, restaurante e aplicativo e persiste.
test('troca de modelo do Estoque persiste após recarregar', async ({ page }) => {
  await login(page, 'estoque');
  const root = page.locator('.es');
  const before = await root.getAttribute('data-model');
  const target = before === 'm3' ? 'm2' : 'm3';
  await page.getByRole('button', { name: 'Aparência' }).click();
  await page.locator(`[data-model-option="${target}"]`).click();
  await expect(root).toHaveAttribute('data-model', target);
  await page.reload();
  await expect(root).toHaveAttribute('data-model', target);
  // Outro aplicativo não é afetado pela escolha
  await login(page, 'adm');
  await expect(page.locator('.fn')).toHaveAttribute('data-model', /m[1-4]/);
});

test('cada modelo muda a estrutura, não só a cor', async ({ page }) => {
  await login(page, 'adm');
  const seen = new Set<string>();
  for (const model of ['m1', 'm2', 'm3', 'm4']) {
    await page.getByRole('button', { name: 'Aparência' }).click();
    await page.locator(`[data-model-option="${model}"]`).click();
    await expect(page.locator('.fn')).toHaveAttribute('data-model', model);
    const shape = await page.evaluate(() =>
      ['.fn-side', '.fn-bar', '.fn-tabs', '.fn-rail'].map((s) => (document.querySelector(s) ? 1 : 0)).join(''),
    );
    seen.add(shape);
  }
  expect(seen.size).toBe(4);
  await page.goto(`${T}/financeiro`);
});
