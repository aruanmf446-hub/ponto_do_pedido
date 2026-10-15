'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Diálogo acessível baseado no elemento nativo <dialog>. Sem estilo próprio:
// cada aplicativo estiliza `.pdp-dialog` conforme o modelo visual.
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={['pdp-dialog', className].filter(Boolean).join(' ')}
      aria-labelledby="pdp-dialog-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open ? (
        <div className="pdp-dialog-body">
          <header className="pdp-dialog-header">
            <h2 id="pdp-dialog-title">{title}</h2>
            <button type="button" className="pdp-dialog-close" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </header>
          <div className="pdp-dialog-content">{children}</div>
          {footer ? <footer className="pdp-dialog-footer">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
