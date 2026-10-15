import { describe, expect, it } from 'vitest';
import { addDays, businessDay, minutesSince } from '@/core/dates';

describe('datas', () => {
  it('dia operacional respeita fuso e hora de virada', () => {
    // 02:30 em São Paulo (05:30Z) com virada às 4h ainda pertence ao dia anterior
    expect(businessDay(new Date('2026-10-15T05:30:00Z'), 'America/Sao_Paulo', 4)).toBe('2026-10-14');
    expect(businessDay(new Date('2026-10-15T08:00:00Z'), 'America/Sao_Paulo', 4)).toBe('2026-10-15');
    expect(businessDay(new Date('2026-10-15T02:00:00Z'), 'America/Sao_Paulo', 0)).toBe('2026-10-14');
  });

  it('soma dias atravessando meses e anos', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('minutos decorridos', () => {
    expect(minutesSince('2026-10-15T10:00:00Z', new Date('2026-10-15T10:45:30Z'))).toBe(45);
  });
});
