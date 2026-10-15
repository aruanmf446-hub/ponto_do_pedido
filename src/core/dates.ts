// Datas no fuso do restaurante e dia operacional.

export function businessDay(at: Date, timezone: string, startHour: number): string {
  const shifted = new Date(at.getTime() - startHour * 3600_000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted);
  return parts; // AAAA-MM-DD
}

export function addDays(isoDay: string, days: number): string {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateTime(value: string | Date | null | undefined, timezone = 'America/Sao_Paulo'): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function formatDate(value: string | Date | null | undefined, timezone = 'America/Sao_Paulo'): string {
  if (!value) return '—';
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: typeof value === 'string' && value.length === 10 ? 'UTC' : timezone }).format(date);
}

export function formatTime(value: string | Date | null | undefined, timezone = 'America/Sao_Paulo'): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

/** Minutos decorridos (para filas e tempo de preparo). */
export function minutesSince(value: string | Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 60_000));
}

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
