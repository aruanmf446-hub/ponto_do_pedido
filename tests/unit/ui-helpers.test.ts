import { describe, expect, it } from 'vitest';
import { daysTo, expiryTone, fmtDay, fmtQty } from '@/apps/estoque/ui';
import { statusTone } from '@/apps/financeiro/ui';

describe('auxiliares de validade e status', () => {
  it('calcula dias até o vencimento', () => {
    expect(daysTo('2026-10-20', '2026-10-15')).toBe(5);
    expect(daysTo('2026-10-14', '2026-10-15')).toBe(-1);
  });
  it('classifica risco de validade', () => {
    expect(expiryTone('2026-10-14', '2026-10-15')).toBe('danger');
    expect(expiryTone('2026-10-22', '2026-10-15')).toBe('warn');
    expect(expiryTone('2026-12-01', '2026-10-15')).toBe('ok');
    expect(expiryTone(null, '2026-10-15')).toBeUndefined();
  });
  it('formata datas e quantidades sem conversão de fuso', () => {
    expect(fmtDay('2026-01-02')).toBe('02/01/2026');
    expect(fmtDay(null)).toBe('—');
    expect(fmtQty(1.5, 'kg')).toBe('1,5 kg');
  });
  it('tons de status financeiro', () => {
    expect(statusTone('paid')).toBe('ok');
    expect(statusTone('rejected')).toBe('danger');
    expect(statusTone('open')).toBe('warn');
  });
});

describe('ilustração por tipo de produto', async () => {
  const { foodKind } = await import('@/core/ui/FoodArt');
  it('reconhece tipos comuns sem confundir palavras parecidas', () => {
    expect(foodKind('Lasanha à bolonhesa')).toBe('massa');
    expect(foodKind('Bolo de cenoura')).toBe('sobremesa');
    expect(foodKind('Cappuccino')).toBe('cafe');
    expect(foodKind('Suco natural')).toBe('bebida');
    expect(foodKind('Burger da casa')).toBe('lanche');
    expect(foodKind('Hot roll')).toBe('japonesa');
    expect(foodKind('Prato do dia')).toBe('prato');
    expect(foodKind('Qualquer coisa', 'Bebidas')).toBe('bebida');
  });
});
