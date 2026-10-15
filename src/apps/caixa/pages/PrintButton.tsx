'use client';

export function PrintButton() {
  return (
    <button type="button" className="cx-btn cx-noprint" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
