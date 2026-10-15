'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FoodArt } from '@/core/ui/FoodArt';
import { Icon, type IconName } from '@/core/ui/Icon';
import type { Lot } from '@/apps/estoque/queries';
import { Empty, daysTo, fmtDay, fmtQty } from '@/apps/estoque/ui';

type Band = 'vencido' | 'd7' | 'd30' | 'valido';
const BANDS: { key: Band; label: string; icon: IconName; tone: string }[] = [
  { key: 'vencido', label: 'Vencidos', icon: 'alert', tone: 'danger' },
  { key: 'd7', label: 'Vencendo em 7 dias', icon: 'clock', tone: 'warn' },
  { key: 'd30', label: 'Vencendo em 30 dias', icon: 'calendar', tone: 'info' },
  { key: 'valido', label: 'Válidos', icon: 'check', tone: 'ok' },
];

/** Lotes por validade com filtros laterais (modelo Lotes e Validade). */
export function LotsBoard({ lots, today, base }: { lots: Lot[]; today: string; base: string }) {
  const band = (l: Lot): Band => {
    const d = daysTo(l.expires_on ?? today, today);
    return d < 0 ? 'vencido' : d <= 7 ? 'd7' : d <= 30 ? 'd30' : 'valido';
  };
  const [bands, setBands] = useState<Band[]>([]);
  const [location, setLocation] = useState('');
  const [query, setQuery] = useState('');
  const locations = useMemo(() => [...new Map(lots.filter((l) => l.location).map((l) => [l.location!.id, l.location!.name])).entries()], [lots]);
  const shown = lots.filter(
    (l) =>
      (bands.length === 0 || bands.includes(band(l))) &&
      (!location || l.location?.id === location) &&
      (!query || `${l.material?.name ?? ''} ${l.lot_code ?? ''}`.toLowerCase().includes(query.toLowerCase())),
  );
  const toggle = (b: Band) => setBands((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));

  return (
    <div className="es-lots">
      <aside className="es-filters" aria-label="Filtros">
        <label className="es-search">
          <Icon name="search" size={15} />
          <span className="sr-only">Buscar produto ou lote</span>
          <input placeholder="Buscar produto ou lote" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <fieldset>
          <legend>Situação da validade</legend>
          <label className="es-check">
            <input type="checkbox" checked={bands.length === 0} onChange={() => setBands([])} /> Todos
          </label>
          {BANDS.map((b) => (
            <label key={b.key} className="es-check">
              <input type="checkbox" checked={bands.includes(b.key)} onChange={() => toggle(b.key)} /> {b.label}
            </label>
          ))}
        </fieldset>
        <label className="es-field">
          Localização
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Todas as localizações</option>
            {locations.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="es-btn es-btn--ghost" onClick={() => (setBands([]), setLocation(''), setQuery(''))}>
          <Icon name="refresh" size={14} /> Limpar filtros
        </button>
      </aside>
      <div className="es-stack">
        <div className="es-tiles">
          {BANDS.map((b) => (
            <button key={b.key} type="button" className="es-tile" data-tone={b.tone} aria-pressed={bands.includes(b.key)} onClick={() => toggle(b.key)}>
              <span className="es-tile-icon">
                <Icon name={b.icon} size={20} />
              </span>
              <span className="es-tile-label">{b.label}</span>
              <strong>{lots.filter((l) => band(l) === b.key).length}</strong>
              <small>lotes</small>
            </button>
          ))}
        </div>
        <section className="es-panel">
          {shown.length === 0 ? (
            <Empty>Nenhum lote com esses filtros.</Empty>
          ) : (
            <div className="es-table-wrap">
              <table className="es-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Lote</th>
                    <th>Localização</th>
                    <th className="es-num">Quantidade</th>
                    <th>Validade</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l) => {
                    const b = BANDS.find((x) => x.key === band(l))!;
                    const d = daysTo(l.expires_on ?? today, today);
                    return (
                      <tr key={l.id}>
                        <td>
                          <span className="es-prod">
                            <span className="es-thumb">
                              <FoodArt name={l.material?.name ?? ''} label="" />
                            </span>
                            <strong>{l.material?.name}</strong>
                          </span>
                        </td>
                        <td className="es-mono">{l.lot_code ?? '—'}</td>
                        <td>{l.location?.name ?? '—'}</td>
                        <td className="es-num">{fmtQty(l.qty, l.material?.unit)}</td>
                        <td>{fmtDay(l.expires_on)}</td>
                        <td>
                          <span className="es-pill" data-tone={b.tone}>
                            {d < 0 ? `Vencido há ${-d}d` : d === 0 ? 'Vence hoje' : b.key === 'valido' ? 'Válido' : `Vence em ${d}d`}
                          </span>
                          {l.status === 'blocked' ? <span className="es-pill" data-tone="danger">Bloqueado</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Link className="es-more" href={`${base}/estoque/lotes`}>
            Gerir todos os lotes <Icon name="arrow-right" size={14} />
          </Link>
        </section>
      </div>
    </div>
  );
}
