// Valores monetários sempre em centavos inteiros.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCents(cents: number | string | null | undefined): string {
  const value = typeof cents === 'string' ? Number(cents) : (cents ?? 0);
  return BRL.format((Number.isFinite(value) ? value : 0) / 100);
}

/** Converte texto digitado ("12,50", "R$ 1.234,56", "12.5") em centavos. */
export function parseCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(',')) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Divide um valor em N partes inteiras; os centavos restantes vão para as primeiras partes. */
export function splitEvenly(totalCents: number, parts: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new Error('Valor inválido');
  if (!Number.isInteger(parts) || parts < 1) throw new Error('Número de partes inválido');
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Troco para pagamento em dinheiro. */
export function changeFor(amountCents: number, tenderedCents: number): number {
  if (tenderedCents < amountCents) throw new Error('Valor entregue insuficiente');
  return tenderedCents - amountCents;
}

export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}
