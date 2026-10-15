// Miniatura esquemática de um modelo visual (desenhada a partir de uma
// especificação simples), usada na galeria de modelos de cada aplicativo.

export type ThumbSpec = {
  bg: string;
  surface: string;
  ink: string;
  accent: string;
  /** Navegação do modelo */
  nav: 'side' | 'sideDark' | 'top' | 'rail' | 'bottom' | 'none';
  /** Composição da área principal */
  body: 'cards' | 'kanban' | 'table' | 'grid' | 'split' | 'focus' | 'map' | 'hero' | 'list' | 'feed' | 'menu';
  /** Cor da barra superior (opcional) */
  top?: string;
};

function Body({ s, x, y, w, h }: { s: ThumbSpec; x: number; y: number; w: number; h: number }) {
  const r = 2.5;
  const box = (bx: number, by: number, bw: number, bh: number, fill = s.surface, key?: string | number) => (
    <rect key={key ?? `${bx}-${by}`} x={bx} y={by} width={bw} height={bh} rx={r} fill={fill} />
  );
  const line = (lx: number, ly: number, lw: number, key: string | number, color = s.ink, o = 0.35) => (
    <rect key={key} x={lx} y={ly} width={lw} height={2.4} rx={1.2} fill={color} opacity={o} />
  );
  switch (s.body) {
    case 'kanban': {
      const cw = (w - 9) / 4;
      return (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={x + i * (cw + 3)} y={y} width={cw} height={5} rx={1.5} fill={s.accent} opacity={1 - i * 0.18} />
              {[0, 1, 2].slice(0, 3 - (i % 2)).map((j) => box(x + i * (cw + 3), y + 8 + j * 14, cw, 11, s.surface, `${i}-${j}`))}
            </g>
          ))}
        </g>
      );
    }
    case 'table':
      return (
        <g>
          {[0, 1, 2, 3].map((i) => box(x + i * ((w - 9) / 4 + 3), y, (w - 9) / 4, 10, s.surface, `s${i}`))}
          {box(x, y + 14, w, h - 14)}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              {line(x + 4, y + 20 + i * 6, w * 0.3, `a${i}`)}
              {line(x + w * 0.45, y + 20 + i * 6, w * 0.2, `b${i}`)}
              <rect x={x + w - 16} y={y + 19.4 + i * 6} width={11} height={3.4} rx={1.7} fill={s.accent} opacity={0.55} />
            </g>
          ))}
        </g>
      );
    case 'grid':
      return (
        <g>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const cw = (w - 9) / 4;
            const bx = x + (i % 4) * (cw + 3);
            const by = y + Math.floor(i / 4) * (h / 2);
            return (
              <g key={i}>
                {box(bx, by, cw, h / 2 - 3)}
                <circle cx={bx + cw / 2} cy={by + h / 4 - 4} r={Math.min(cw, h / 2) / 4} fill={s.accent} opacity={0.45} />
                {line(bx + 3, by + h / 2 - 9, cw - 6, `g${i}`)}
              </g>
            );
          })}
        </g>
      );
    case 'menu':
      return (
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const cw = (w * 0.66 - 6) / 3;
            const bx = x + (i % 3) * (cw + 3);
            const by = y + Math.floor(i / 3) * (h / 2);
            return (
              <g key={i}>
                {box(bx, by, cw, h / 2 - 3)}
                <rect x={bx + 2} y={by + 2} width={cw - 4} height={h / 4} rx={2} fill={s.accent} opacity={0.35} />
                {line(bx + 3, by + h / 4 + 5, cw - 8, `m${i}`)}
              </g>
            );
          })}
          {box(x + w * 0.69, y, w * 0.31, h)}
          {[0, 1, 2].map((i) => line(x + w * 0.69 + 4, y + 6 + i * 7, w * 0.22, `o${i}`))}
          <rect x={x + w * 0.69 + 3} y={y + h - 11} width={w * 0.31 - 6} height={7} rx={2} fill={s.accent} />
        </g>
      );
    case 'split':
      return (
        <g>
          {box(x, y, w * 0.38, h)}
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={x + 3} y={y + 4 + i * 9} width={w * 0.38 - 6} height={6} rx={1.5} fill={i === 1 ? s.accent : s.ink} opacity={i === 1 ? 0.6 : 0.12} />
          ))}
          {box(x + w * 0.41, y, w * 0.59, h)}
          {[0, 1, 2, 3].map((i) => line(x + w * 0.41 + 5, y + 8 + i * 7, w * 0.4, `r${i}`))}
          <rect x={x + w * 0.41 + 5} y={y + h - 12} width={w * 0.24} height={7} rx={2} fill={s.accent} />
        </g>
      );
    case 'focus':
      return (
        <g>
          {box(x, y, w * 0.62, h)}
          <circle cx={x + w * 0.2} cy={y + h / 2} r={h / 3.2} fill="none" stroke={s.accent} strokeWidth={3.5} />
          {[0, 1, 2].map((i) => line(x + w * 0.38, y + h / 2 - 8 + i * 7, w * 0.18, `f${i}`))}
          {[0, 1, 2, 3].map((i) => box(x + w * 0.65, y + i * (h / 4), w * 0.35, h / 4 - 2.5, s.surface, `q${i}`))}
        </g>
      );
    case 'map':
      return (
        <g>
          {box(x, y, w * 0.7, h, s.surface)}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const cx = x + 10 + (i % 3) * (w * 0.7 - 20) / 2;
            const cy = y + 12 + Math.floor(i / 3) * (h - 24);
            return (
              <g key={i}>
                <rect x={cx - 7} y={cy - 5} width={14} height={10} rx={2} fill={i === 1 || i === 4 ? s.accent : s.ink} opacity={i === 1 || i === 4 ? 0.7 : 0.18} />
                <circle cx={cx - 9} cy={cy} r={1.6} fill={s.ink} opacity={0.3} />
                <circle cx={cx + 9} cy={cy} r={1.6} fill={s.ink} opacity={0.3} />
              </g>
            );
          })}
          {box(x + w * 0.73, y, w * 0.27, h)}
          {[0, 1, 2].map((i) => line(x + w * 0.73 + 4, y + 6 + i * 7, w * 0.18, `l${i}`))}
          <rect x={x + w * 0.73 + 3} y={y + h - 11} width={w * 0.27 - 6} height={7} rx={2} fill={s.accent} />
        </g>
      );
    case 'hero':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h * 0.45} rx={r} fill={s.accent} opacity={0.85} />
          {line(x + 6, y + 8, w * 0.35, 'h1', '#fff', 0.9)}
          {line(x + 6, y + 14, w * 0.25, 'h2', '#fff', 0.7)}
          {[0, 1, 2].map((i) => box(x + i * ((w - 6) / 3 + 3), y + h * 0.5, (w - 6) / 3, h * 0.5, s.surface, `c${i}`))}
        </g>
      );
    case 'list':
      return (
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              {box(x, y + i * (h / 6), w, h / 6 - 2.5, s.surface, `li${i}`)}
              <circle cx={x + 6} cy={y + i * (h / 6) + h / 12 - 1} r={2.4} fill={s.accent} opacity={0.6} />
              {line(x + 12, y + i * (h / 6) + h / 12 - 2.2, w * 0.45, `lt${i}`)}
            </g>
          ))}
        </g>
      );
    case 'feed':
      return (
        <g>
          {box(x, y, w * 0.5 - 2, h)}
          {box(x + w * 0.5 + 2, y, w * 0.5 - 2, h)}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <circle cx={x + w * 0.5 + 8} cy={y + 8 + i * 10} r={2.4} fill={s.accent} />
              {line(x + w * 0.5 + 13, y + 7 + i * 10, w * 0.3, `fe${i}`)}
              {line(x + 4, y + 7 + i * 10, w * 0.38, `fl${i}`)}
            </g>
          ))}
        </g>
      );
    default:
      return (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              {box(x + i * ((w - 9) / 4 + 3), y, (w - 9) / 4, 14, s.surface, `k${i}`)}
              <circle cx={x + i * ((w - 9) / 4 + 3) + 5} cy={y + 7} r={2.6} fill={s.accent} opacity={0.75} />
            </g>
          ))}
          {box(x, y + 18, w * 0.62, h - 18)}
          <path
            d={`M${x + 5} ${y + h - 6} L${x + w * 0.15} ${y + h - 16} L${x + w * 0.3} ${y + h - 11} L${x + w * 0.45} ${y + h - 24} L${x + w * 0.58} ${y + h - 18}`}
            fill="none"
            stroke={s.accent}
            strokeWidth={2}
          />
          {box(x + w * 0.65, y + 18, w * 0.35, h - 18)}
          <circle cx={x + w * 0.825} cy={y + 18 + (h - 18) / 2} r={(h - 18) / 4} fill="none" stroke={s.accent} strokeWidth={4} />
        </g>
      );
  }
}

export function ModelThumb({ spec }: { spec: ThumbSpec }) {
  const W = 160;
  const H = 100;
  const side = spec.nav === 'side' || spec.nav === 'sideDark' || spec.nav === 'rail';
  const x = !side ? 6 : spec.nav === 'rail' ? 20 : 38;
  const y = 16;
  const w = W - x - 6;
  const h = H - 22 - (spec.nav === 'bottom' ? 10 : 0);
  const navColor = spec.nav === 'sideDark' || spec.nav === 'rail' ? (spec.top ?? spec.ink) : spec.surface;
  return (
    <svg className="pdp-model-thumb" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true">
      <rect width={W} height={H} rx={6} fill={spec.bg} />
      {/* barra superior */}
      <rect x={0} y={0} width={W} height={11} fill={spec.top ?? spec.surface} />
      <circle cx={7} cy={5.5} r={3} fill={spec.accent} />
      <rect x={13} y={4.3} width={26} height={2.4} rx={1.2} fill={spec.top ? '#fff' : spec.ink} opacity={0.55} />
      {spec.nav === 'side' || spec.nav === 'sideDark' ? (
        <g>
          <rect x={0} y={11} width={34} height={H - 11} fill={navColor} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={5} y={18 + i * 9} width={24} height={5} rx={2} fill={i === 1 ? spec.accent : spec.nav === 'sideDark' ? '#fff' : spec.ink} opacity={i === 1 ? 0.9 : 0.25} />
          ))}
        </g>
      ) : null}
      {spec.nav === 'rail' ? (
        <g>
          <rect x={0} y={11} width={16} height={H - 11} fill={navColor} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={4} y={17 + i * 10} width={8} height={7} rx={2} fill={i === 0 ? spec.accent : '#fff'} opacity={i === 0 ? 1 : 0.3} />
          ))}
        </g>
      ) : null}
      {spec.nav === 'top' ? (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={50 + i * 20} y={4.3} width={14} height={2.4} rx={1.2} fill={i === 0 ? spec.accent : spec.top ? '#fff' : spec.ink} opacity={i === 0 ? 1 : 0.4} />
          ))}
        </g>
      ) : null}
      {spec.nav === 'bottom' ? (
        <g>
          <rect x={0} y={H - 12} width={W} height={12} fill={spec.surface} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={20 + i * 36} y={H - 8} width={14} height={4} rx={2} fill={i === 0 ? spec.accent : spec.ink} opacity={i === 0 ? 1 : 0.25} />
          ))}
        </g>
      ) : null}
      <Body s={spec} x={x} y={y} w={w} h={h} />
    </svg>
  );
}
