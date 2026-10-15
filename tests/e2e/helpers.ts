import { expect, type Page } from '@playwright/test';

export const SLUG = process.env.PDP_E2E_SLUG ?? 'aurora';
export const PASSWORD = 'Senha12345!';
export const T = `/r/${SLUG}`;
export const user = (who: string) => `${who}+${SLUG}@teste.local`;

export async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto(`${T}/`);
  await page.fill('input[name=email]', user(who));
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(new RegExp(`${T}/(?!$)`));
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `rolagem horizontal em ${page.url()}`).toBeLessThanOrEqual(1);
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}
