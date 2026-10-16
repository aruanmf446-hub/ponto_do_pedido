import { expect, test } from '@playwright/test';

// Somente navegação e validação: nunca cria conta, assinatura ou cobrança.
test.describe('produção sem identidade de teste', () => {
  test.skip(process.env.PDP_E2E_PUBLIC_SMOKE !== '1', 'Execução remota opt-in, sem mutações comerciais.');

  test('cadastro e login renderizam os formulários oficiais', async ({ page }) => {
    await page.goto('/cadastro');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await page.goto('/entrar');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('Portal exige sessão e contratação exige cadastro', async ({ page }) => {
    await page.goto('/portal');
    await expect(page).toHaveURL(/\/entrar\?next=\/portal/);
    await page.goto('/contratar');
    await expect(page).toHaveURL(/\/cadastro/);
  });

  test('catálogo publicado contém os três preços oficiais', async ({ page }) => {
    await page.goto('/planos');
    await expect(page.getByText(/49,99/).first()).toBeVisible();
    await expect(page.getByText(/80,00/).first()).toBeVisible();
    await expect(page.getByText(/150,00/).first()).toBeVisible();
  });
});
