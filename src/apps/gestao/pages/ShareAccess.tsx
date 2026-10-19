'use client';

import { useState } from 'react';

export function ShareAccess({ url, name, compact = false, label = 'Enviar acesso', primary = false, email }: { url: string; name?: string; compact?: boolean; label?: string; primary?: boolean; email?: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = `Olá${name ? `, ${name}` : ''}! Acesse o restaurante pelo Ponto do Pedido: ${url}`;
  return (
    <span style={{ display: 'inline-flex', position: 'relative' }}>
      <button className={`gs-btn ${primary ? 'gs-btn--primary' : ''} ${compact ? 'gs-btn--small' : ''}`} type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        {label}
      </button>
      {open ? (
        <span role="group" aria-label="Compartilhar acesso" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, padding: 10, minWidth: 180, border: '1px solid var(--gs-line)', borderRadius: 12, background: 'var(--gs-surface)', boxShadow: '0 8px 30px #0003', display: 'grid', gap: 6 }}>
          <a className="gs-btn gs-btn--small" href={`mailto:${email ? encodeURIComponent(email) : ''}?subject=${encodeURIComponent('Acesso ao restaurante — Ponto do Pedido')}&body=${encodeURIComponent(message)}`}>E-mail</a>
          <a className="gs-btn gs-btn--small" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <button className="gs-btn gs-btn--small" type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copiado!' : 'Copiar link'}</button>
          <button className="gs-btn gs-btn--small" type="button" onClick={() => setOpen(false)}>Fechar</button>
        </span>
      ) : null}
    </span>
  );
}
