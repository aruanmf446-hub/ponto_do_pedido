'use client';

import { useState } from 'react';
import { LiveRefresh, type LiveEvent } from '@/core/ui/LiveRefresh';

type Alert = { id: string; text: string };

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    /* sem áudio disponível */
  }
}

/** Notificações de pedido pronto, indisponibilidade e conta solicitada. */
export function ReadyAlerts({ tenantId }: { tenantId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const push = (text: string) => {
    const id = `${Date.now()}${Math.random()}`;
    setAlerts((a) => [...a.slice(-3), { id, text }]);
    beep();
    setTimeout(() => setAlerts((a) => a.filter((x) => x.id !== id)), 9000);
  };
  const onEvent = (e: LiveEvent) => {
    if (e.table === 'orders' && e.type === 'UPDATE') {
      if (e.record.status === 'ready' && e.old.status !== 'ready' && e.record.source !== 'delivery') push(`Pedido #${e.record.number} pronto para entrega`);
      if (e.record.has_issue === true && e.old.has_issue !== true) push(`Pedido #${e.record.number}: item indisponível na cozinha`);
    }
    if (e.table === 'orders' && e.type === 'INSERT' && e.record.status === 'pending_confirmation' && e.record.source === 'cardapio') {
      push(`Novo pedido pelo QR Code (#${e.record.number}) aguardando confirmação`);
    }
    if (e.table === 'tabs' && e.type === 'UPDATE' && e.record.bill_requested_at && !e.old.bill_requested_at && e.record.bill_requested_by === 'cliente') {
      push(`Comanda #${e.record.number}: cliente pediu a conta`);
    }
  };
  return (
    <>
      <LiveRefresh tenantId={tenantId} tables={['orders', 'tabs']} onEvent={onEvent} />
      <div className="at-alerts" role="status" aria-live="polite">
        {alerts.map((a) => (
          <p key={a.id} className="at-alert">
            {a.text}
          </p>
        ))}
      </div>
    </>
  );
}
