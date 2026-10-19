'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function ShareAccess({ url, name, compact = false, label = 'Enviar acesso', primary = false, email }: { url: string; name?: string; compact?: boolean; label?: string; primary?: boolean; email?: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 210;
      const height = panelRef.current?.offsetHeight ?? 210;
      const above = window.innerHeight - rect.bottom < height + 12 && rect.top > height + 12;
      setPosition({ top: above ? rect.top - height - 6 : Math.min(rect.bottom + 6, window.innerHeight - height - 8), left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)) });
    };
    const onPointer = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const message = `Olá${name ? `, ${name}` : ''}! Acesse o restaurante pelo Ponto do Pedido: ${url}`;
  return (
    <span style={{ display: 'inline-flex', position: 'relative' }}>
      <button ref={triggerRef} className={`gs-btn ${primary ? 'gs-btn--primary' : ''} ${compact ? 'gs-btn--small' : ''}`} type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        {label}
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div ref={panelRef} role="group" aria-label="Compartilhar acesso" style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 10000, padding: 10, width: 210, border: '1px solid var(--gs-line)', borderRadius: 12, background: 'var(--gs-surface, #211e1b)', color: 'var(--gs-ink, white)', boxShadow: '0 8px 30px #0006', display: 'grid', gap: 6 }}>
          <a className="gs-btn gs-btn--small" href={`mailto:${email ? encodeURIComponent(email) : ''}?subject=${encodeURIComponent('Acesso ao restaurante — Ponto do Pedido')}&body=${encodeURIComponent(message)}`}>E-mail</a>
          <a className="gs-btn gs-btn--small" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <button className="gs-btn gs-btn--small" type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copiado!' : 'Copiar link'}</button>
          <button className="gs-btn gs-btn--small" type="button" onClick={() => setOpen(false)}>Fechar</button>
        </div>, document.body
      ) : null}
    </span>
  );
}
