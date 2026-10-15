'use client';

export function CsvButton({ filename, rows }: { filename: string; rows: string[][] }) {
  const download = () => {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" className="gs-btn gs-btn--small" onClick={download}>
      Exportar CSV
    </button>
  );
}
