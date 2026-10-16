import { expect, test } from '@playwright/test';
import { noHorizontalOverflow } from './helpers';

test('abertura tem só dois painéis e mantém cabeçalho inteiro de 320 a 1440px', async ({ page }) => {
  for (const width of [320, 360, 375, 390, 430, 768, 900, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?modelo=m1', { waitUntil: 'domcontentloaded' });

    const hero = page.locator('.pl-m1-hero');
    const panels = hero.locator('.pl-m1-hero-slides');
    await expect(page.locator('.pl-landing[data-template="m1"]')).toBeVisible();
    await expect(panels.locator(':scope > div')).toHaveCount(2);
    await expect(hero.locator('.pl-m1-hero-copy h1')).toContainText('Seu salão cheio.');
    await expect(hero.locator('.pl-m1-app-panel h2')).toContainText('7 apps.');
    await expect(hero.locator('.pl-m1-hero-copy .pl-cta .pl-btn')).toHaveCount(2);
    await expect(hero.locator('.pl-m1-hero-plan .pl-m1-app-action')).toHaveAttribute('href', '/planos');
    await expect(hero.locator('.pl-m1-app-map')).toHaveCount(1);
    await noHorizontalOverflow(page);

    for (const selector of ['.pl-header .pl-mark', '.pl-header .pl-nav .pl-btn', '.pl-header .pl-scheme']) {
      const box = await page.locator(selector).boundingBox();
      expect(box, `elemento ausente: ${selector}`).not.toBeNull();
      expect(box!.x, `${selector} cortado à esquerda em ${width}px`).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width, `${selector} cortado à direita em ${width}px`).toBeLessThanOrEqual(width + 1);
    }

    if (width < 900) {
      await expect(hero.locator('.pl-m1-hero-layout')).toHaveAttribute('data-mobile', 'true');
      await expect(hero.locator('.pl-m1-hero-switch button')).toHaveCount(2);
      await hero.getByRole('button', { name: 'Tela dos aplicativos' }).click();
      await expect(panels).toHaveAttribute('data-active', '1');
      await expect(hero.locator('.pl-m1-hero-switch')).toContainText('02 / 02');
      await hero.getByRole('button', { name: 'Tela inicial' }).click();
      await expect(panels).toHaveAttribute('data-active', '0');
    } else {
      const left = await hero.locator('.pl-m1-hero-copy').boundingBox();
      const right = await hero.locator('.pl-m1-hero-plan').boundingBox();
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();
      expect(right!.x).toBeGreaterThan(left!.x + left!.width - 1);
      expect(Math.abs(left!.y - right!.y)).toBeLessThan(350);
    }
    await noHorizontalOverflow(page);
  }
});
