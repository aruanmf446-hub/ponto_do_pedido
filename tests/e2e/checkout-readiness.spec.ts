import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { login, noHorizontalOverflow } from './helpers';

for (const width of [390, 1440]) {
  test(`contratação bloqueada não promete ativação em ${width}px`, async ({ page }) => {
    const host = new URL(process.env.PDP_E2E_BASE_URL ?? 'http://localhost:3000').hostname;
    test.skip(
      !['localhost', '127.0.0.1'].includes(host) && !host.endsWith('.localhost'),
      'Usa exclusivamente fixtures da stack local.',
    );
    await page.setViewportSize({ width, height: 900 });
    await login(page, 'dono');
    await page.goto('/contratar');
    await expect(page.getByRole('button', { name: 'Contratação indisponível' })).toBeDisabled();
    await expect(page.getByText('Novas contratações estão temporariamente indisponíveis.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contratar e ativar' })).toHaveCount(0);
    await page.locator('input[name=restaurant]').fill('Famiglia da Pizza E2E');
    await expect(page.locator('#slug-help')).toContainText('/r/famiglia-da-pizza-e2e');
    await noHorizontalOverflow(page);
  });
  test(`template de confirmação preserva link oficial e cabe em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(readFileSync('backend/app/supabase/templates/confirmation.html', 'utf8'));
    await expect(page.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Confirmar meu e-mail' })).toHaveAttribute('href', '{{ .ConfirmationURL }}');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await noHorizontalOverflow(page);
  });
}
