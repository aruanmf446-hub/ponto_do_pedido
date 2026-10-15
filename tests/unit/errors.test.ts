import { describe, expect, it } from 'vitest';
import { fromPostgrest } from '@/core/errors';

describe('mapeamento de erros das RPCs', () => {
  it('usa o código de negócio enviado em DETAIL', () => {
    expect(fromPostgrest({ message: 'Caixa fechado.', details: 'CASH_CLOSED', code: 'P0001' })).toEqual({ ok: false, code: 'CASH_CLOSED', message: 'Caixa fechado.' });
  });

  it('expõe a permissão quando a ação exige aprovação', () => {
    const r = fromPostgrest({ message: 'Requer aprovação.', details: 'APPROVAL_REQUIRED', hint: 'caixa.desconto.aplicar', code: 'P0001' });
    expect(r.code).toBe('APPROVAL_REQUIRED');
    expect(r.permission).toBe('caixa.desconto.aplicar');
  });

  it('traduz erros do Postgres sem vazar detalhes internos', () => {
    expect(fromPostgrest({ message: 'duplicate key value violates unique constraint "x"', code: '23505', details: 'Key (a)=(b) already exists.' })).toEqual({
      ok: false,
      code: '23505',
      message: 'Já existe um registro com esses dados.',
    });
    expect(fromPostgrest({ message: 'permission denied', code: '42501' }).message).toBe('Você não tem permissão para esta ação.');
  });
});
