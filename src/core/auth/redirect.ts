/** Caminho interno; recusa formas que o navegador normaliza para outro domínio. */
export function safeAuthNext(value: unknown, fallback: string): string {
  const path = String(value ?? '');
  return path.startsWith('/') && !path.startsWith('//') && !/[\\\u0000-\u001f\u007f]/.test(path) ? path : fallback;
}
