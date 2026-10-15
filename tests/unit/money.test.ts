import { describe, expect, it } from 'vitest';
import { changeFor, formatCents, parseCents, percentOf, splitEvenly } from '@/core/money';

const nbsp = (s: string) => s.replace(/ /g, ' ');

describe('dinheiro em centavos', () => {
  it('formata em reais', () => {
    expect(nbsp(formatCents(123456))).toBe('R$ 1.234,56');
    expect(nbsp(formatCents('500'))).toBe('R$ 5,00');
    expect(nbsp(formatCents(null))).toBe('R$ 0,00');
  });

  it('interpreta valores digitados', () => {
    expect(parseCents('12,50')).toBe(1250);
    expect(parseCents('R$ 1.234,56')).toBe(123456);
    expect(parseCents('12.5')).toBe(1250);
    expect(parseCents('0,1')).toBe(10);
    expect(parseCents('')).toBeNull();
    expect(parseCents('abc')).toBeNull();
    expect(parseCents('-5')).toBeNull();
  });

  it('divide sem perder centavos', () => {
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEvenly(1000, 3).reduce((a, b) => a + b, 0)).toBe(1000);
    expect(splitEvenly(5, 1)).toEqual([5]);
    expect(() => splitEvenly(10, 0)).toThrow();
    expect(() => splitEvenly(10.5, 2)).toThrow();
  });

  it('calcula troco e percentuais', () => {
    expect(changeFor(4550, 5000)).toBe(450);
    expect(() => changeFor(5000, 4000)).toThrow();
    expect(percentOf(10000, 10)).toBe(1000);
    expect(percentOf(999, 10)).toBe(100);
  });
});
