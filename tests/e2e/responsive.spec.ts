import { test } from '@playwright/test';
import { T, collectErrors, login, noHorizontalOverflow } from './helpers';

const WIDTHS = [390, 768, 1024, 1440];
const AREAS: [string, string[]][] = [
  ['dono', ['/gestao', '/gestao/equipe', '/gestao/mesas', '/gestao/cardapio']],
  ['garcom', ['/atendimento', '/atendimento/comandas']],
  ['caixa', ['/caixa', '/caixa/movimentos', '/caixa/historico']],
  ['cozinha', ['/cozinha']],
  ['adm', ['/financeiro', '/financeiro/compras', '/financeiro/pagar', '/financeiro/fluxo']],
  ['estoque', ['/estoque', '/estoque/lotes', '/estoque/inventario', '/estoque/movimentos']],
];

for (const [who, pages] of AREAS) {
  test(`${who}: sem rolagem horizontal e sem erros em 390/768/1024/1440`, async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, who);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of pages) {
        await page.goto(`${T}${path}`, { waitUntil: 'networkidle' });
        await noHorizontalOverflow(page);
      }
    }
    test.expect(errors).toEqual([]);
  });
}

test('canais públicos responsivos (cardápio e delivery)', async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/cardapio', '/delivery']) {
      await page.goto(`${T}${path}`, { waitUntil: 'networkidle' });
      await noHorizontalOverflow(page);
    }
  }
});

// Todos os 4 modelos de cada aplicativo interno, na página principal, nas 4 larguras.
const MAIN: [string, string, string][] = [
  ['dono', '/gestao', '.gs'],
  ['garcom', '/atendimento', '.at'],
  ['caixa', '/caixa', '.cx'],
  ['cozinha', '/cozinha', '.kz'],
  ['adm', '/financeiro', '.fn'],
  ['estoque', '/estoque', '.es'],
];

for (const [who, path, root] of MAIN) {
  test(`${who}: os 4 modelos sem rolagem horizontal`, async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, who);
    await page.goto(`${T}${path}`, { waitUntil: 'networkidle' });
    const original = (await page.locator(root).getAttribute('data-model')) ?? 'm1';
    for (const model of ['m1', 'm2', 'm3', 'm4', original]) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.locator('.pdp-model-trigger').click();
      await page.locator(`[data-model-option="${model}"]`).click();
      await test.expect(page.locator(root)).toHaveAttribute('data-model', model);
      if (model === original && model !== 'm1') continue;
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${T}${path}`, { waitUntil: 'networkidle' });
        await noHorizontalOverflow(page);
      }
    }
    test.expect(errors).toEqual([]);
  });
}

// Os 4 modelos do Cardápio e do Delivery, escolhidos pelo restaurante na Gestão.
test('canais públicos: os 4 modelos sem rolagem horizontal', async ({ page }) => {
  await login(page, 'dono');
  for (const [channel, path] of [
    ['Cardápio Digital', '/cardapio'],
    ['Delivery', '/delivery'],
  ]) {
    for (const model of ['m1', 'm2', 'm3', 'm4']) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${T}/gestao/operacao`, { waitUntil: 'networkidle' });
      const block = page.locator('.gs-template-block').filter({ has: page.getByRole('heading', { name: channel, exact: true }) });
      await block.locator(`[data-model-option="${model}"]`).click();
      await test.expect(block.locator(`[data-model-option="${model}"]`)).toHaveAttribute('aria-pressed', 'true');
      await test.expect(page.getByText(/Modelo do (Cardápio Digital|Delivery) atualizado\./)).toBeVisible();
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${T}${path}`, { waitUntil: 'networkidle' });
        await test.expect(page.locator('[data-template]').first()).toHaveAttribute('data-template', model);
        await noHorizontalOverflow(page);
      }
    }
  }
});
