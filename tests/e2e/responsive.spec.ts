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
