import { expect, test } from '@playwright/test';
import { noHorizontalOverflow } from './helpers';
for (const width of [390, 1440]) {
  test(`recuperação pública e proteção da conta em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/entrar');
    await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
    await expect(page.locator('input[type=email]')).toBeVisible();
    await noHorizontalOverflow(page);
    await page.goto('/auth/recuperar?code=invalid-local-test&next=https://evil.invalid');
    expect(new URL(page.url()).pathname).toBe('/recuperar-senha');
    await expect(page.getByRole('alert')).toContainText('inválido ou expirou');
    await page.goto('/nova-senha');
    await expect(page.locator('input[name=confirmation]')).toHaveCount(0);
    await page.goto('/portal/seguranca');
    expect(new URL(page.url()).pathname).toBe('/entrar');
  });
}
