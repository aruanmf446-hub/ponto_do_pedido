import { expect, test } from '@playwright/test';
import { noHorizontalOverflow } from './helpers';

test('landing azulejaria: cabeçalho, CTAs e carrossel cabem em Android, iPhone e desktop', async ({ page }) => {
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?modelo=m1', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.pl-landing[data-template="m1"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Seu salão cheio/ })).toBeVisible();
    await expect(page.locator('.pl-m1-hero .pl-app-story')).toHaveCount(1);
    await expect(page.locator('.pl-landing > .pl-app-story')).toHaveCount(0);
    await expect(page.locator('.pl-m1-hero .pl-cta .pl-btn')).toHaveCount(2);
    await noHorizontalOverflow(page);

    for (const selector of ['.pl-header .pl-mark', '.pl-header .pl-nav .pl-btn', '.pl-header .pl-scheme', '.pl-m1-hero .pl-cta']) {
      const box = await page.locator(selector).boundingBox();
      expect(box, `elemento ausente: ${selector}`).not.toBeNull();
      expect(box!.x, `${selector} saiu pela esquerda a ${width}px`).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width, `${selector} saiu pela direita a ${width}px`).toBeLessThanOrEqual(width + 1);
    }

    const carousel = page.locator('.pl-m1-hero .pl-app-story');
    await carousel.getByRole('button', { name: 'Próximos aplicativos' }).click();
    await expect(carousel.getByText('2 aplicativos', { exact: true })).toBeVisible();
    await carousel.getByRole('button', { name: 'Mostrar 7 aplicativos' }).click();
    await expect(carousel.getByText('7 aplicativos', { exact: true })).toBeVisible();
    await noHorizontalOverflow(page);
  }
});
