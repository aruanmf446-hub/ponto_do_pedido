// Ilustrações próprias (SVG) usadas quando o produto não tem foto.
// Genéricas para qualquer tipo de restaurante: o tipo é inferido pelo nome do
// produto/categoria. Sem dependências e sem imagens externas.

export type FoodKind =
  | 'prato'
  | 'lanche'
  | 'bebida'
  | 'cafe'
  | 'sobremesa'
  | 'salada'
  | 'massa'
  | 'sopa'
  | 'japonesa'
  | 'petisco'
  | 'pizza'
  | 'carne'
  | 'acai';

const RULES: [FoodKind, RegExp][] = [
  ['cafe', /caf[eé]|cappuccino|espresso|expresso|latte|ch[aá]\b|mocha/i],
  ['bebida', /bebida|suco|refri|refrigerante|[aá]gua|cerveja|vinho|drink|coquetel|soda|ch[aá] gelado|limonada|kombucha|dose|caipirinha/i],
  ['acai', /a[cç]a[ií]|smoothie|vitamina|shake|milk/i],
  ['sobremesa', /sobremesa|\bdoces?\b|\bbolos?\b|torta|pudim|sorvete|brownie|mousse|gelato|petit|cheesecake|brigadeiro|waffle|panqueca doce/i],
  ['salada', /salada|bowl|poke|vegano|vegetariano|verde|fit/i],
  ['massa', /massa|macarr|espaguete|spaghetti|lasanha|nhoque|talharim|penne|ravioli|risoto/i],
  ['sopa', /sopa|caldo|creme de|consom/i],
  ['japonesa', /sushi|sashimi|temaki|japon|uramaki|hot roll|yakisoba|ramen|gyoza/i],
  ['pizza', /pizza|calzone/i],
  ['lanche', /lanche|hamb[uú]rguer|burger|sandu[ií]che|x-|wrap|hot ?dog|cachorro|beirute|misto/i],
  ['petisco', /petisco|por[cç][aã]o|batata|frita|entrada|aperitivo|coxinha|pastel|bolinho|empada|nachos|tapas/i],
  ['carne', /carne|picanha|fil[eé]|bife|churrasco|costela|frango|grelhad|steak|peixe|salm[aã]o|parmegiana/i],
  ['prato', /prato|executivo|almo[cç]o|jantar|refei[cç][aã]o|feijoada|marmita|combo/i],
];

export function foodKind(...texts: (string | null | undefined)[]): FoodKind {
  const text = texts.filter(Boolean).join(' ');
  for (const [kind, re] of RULES) if (re.test(text)) return kind;
  return 'prato';
}

// Fundos suaves e estáveis por nome
const BACKDROPS: [string, string][] = [
  ['#fde8d7', '#f8c9a8'],
  ['#e7f3e4', '#c5e3bd'],
  ['#fdf1d6', '#f6d98f'],
  ['#e6eefb', '#bfd3f3'],
  ['#f6e3ec', '#ebbcd1'],
  ['#efe7fb', '#d3c1f2'],
  ['#e2f4f3', '#aee0dc'],
  ['#f3ece3', '#dfcdb6'],
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function Dish({ kind }: { kind: FoodKind }) {
  switch (kind) {
    case 'bebida':
      return (
        <g>
          <path d="M44 22h32l-5 52a6 6 0 0 1-6 5H55a6 6 0 0 1-6-5z" fill="#fff" opacity=".85" />
          <path d="M47 38h26l-3.6 36a4 4 0 0 1-4 3.6H54.6a4 4 0 0 1-4-3.6z" fill="#f08a24" />
          <path d="M47 38h26l-.6 6H47.6z" fill="#ffb347" />
          <circle cx="56" cy="52" r="2.2" fill="#fff" opacity=".7" />
          <circle cx="63" cy="60" r="1.6" fill="#fff" opacity=".7" />
          <rect x="63" y="12" width="3" height="34" rx="1.5" transform="rotate(14 64 28)" fill="#e5484d" />
          <circle cx="74" cy="30" r="7" fill="#9be15d" stroke="#5aa832" strokeWidth="2" />
        </g>
      );
    case 'cafe':
      return (
        <g>
          <ellipse cx="60" cy="72" rx="34" ry="7" fill="#fff" opacity=".9" />
          <path d="M38 40h40v18a16 16 0 0 1-16 16h-8a16 16 0 0 1-16-16z" fill="#fff" />
          <path d="M78 45h4a8 8 0 0 1 0 16h-5" fill="none" stroke="#fff" strokeWidth="4" />
          <ellipse cx="58" cy="41" rx="19" ry="4.5" fill="#7a4a2a" />
          <path d="M52 40c3-2 9-2 12 0" stroke="#e8c39e" strokeWidth="1.6" fill="none" />
          <path d="M50 30c-3-4 3-6 0-11M60 30c-3-4 3-6 0-11M70 30c-3-4 3-6 0-11" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".8" />
        </g>
      );
    case 'sobremesa':
      return (
        <g>
          <ellipse cx="60" cy="72" rx="36" ry="7" fill="#fff" opacity=".9" />
          <path d="M34 66l50-12v14H34z" fill="#f6d7a7" />
          <path d="M34 66V50l50-12v16z" fill="#fff4e0" />
          <path d="M34 50l50-12" stroke="#c9783f" strokeWidth="4" />
          <path d="M34 58l50-12" stroke="#e4a3b5" strokeWidth="5" />
          <path d="M34 50c8-6 18-2 28-8s16-6 22-4L84 38z" fill="#7b3f2e" />
          <circle cx="70" cy="34" r="6" fill="#e5484d" />
          <path d="M70 28c1-4 4-6 7-6" stroke="#3f8f3a" strokeWidth="2" fill="none" />
        </g>
      );
    case 'salada':
      return (
        <g>
          <path d="M26 46h68a34 30 0 0 1-68 0z" fill="#fff" />
          <circle cx="44" cy="44" r="10" fill="#7bc96f" />
          <circle cx="58" cy="40" r="11" fill="#5aa832" />
          <circle cx="73" cy="44" r="10" fill="#8fd47d" />
          <circle cx="50" cy="38" r="5" fill="#e5484d" />
          <circle cx="68" cy="36" r="4.5" fill="#f6c343" />
          <circle cx="80" cy="40" r="4" fill="#e5484d" />
          <ellipse cx="60" cy="47" rx="6" ry="3" fill="#f3e6c3" />
          <path d="M26 46h68" stroke="#e8e2d6" strokeWidth="2" />
        </g>
      );
    case 'massa':
      return (
        <g>
          <ellipse cx="60" cy="54" rx="38" ry="20" fill="#fff" />
          <ellipse cx="60" cy="50" rx="26" ry="12" fill="#f3c66b" />
          <path d="M40 50c6-8 14 4 20-4s14 6 20-2M42 56c8-6 12 4 20-2s12 4 18-2" stroke="#e3a93f" strokeWidth="2.4" fill="none" />
          <circle cx="56" cy="46" r="5" fill="#d9472b" />
          <circle cx="67" cy="52" r="4" fill="#d9472b" />
          <path d="M70 40l6-4 2 4z" fill="#3f8f3a" />
        </g>
      );
    case 'sopa':
      return (
        <g>
          <path d="M28 46h64a32 26 0 0 1-64 0z" fill="#fff" />
          <ellipse cx="60" cy="46" rx="32" ry="7" fill="#e88c3a" />
          <circle cx="50" cy="45" r="2.5" fill="#fff3d6" />
          <circle cx="62" cy="47" r="2" fill="#5aa832" />
          <circle cx="70" cy="44" r="2.5" fill="#fff3d6" />
          <path d="M52 34c-3-4 3-6 0-11M62 34c-3-4 3-6 0-11M72 34c-3-4 3-6 0-11" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".85" />
        </g>
      );
    case 'japonesa':
      return (
        <g>
          <rect x="22" y="58" width="76" height="10" rx="5" fill="#8a5a3c" />
          {[34, 54, 74].map((x) => (
            <g key={x}>
              <circle cx={x + 4} cy="48" r="10" fill="#1f2a24" />
              <circle cx={x + 4} cy="48" r="7.5" fill="#fff" />
              <circle cx={x + 4} cy="48" r="4" fill="#f27b55" />
              <circle cx={x + 5} cy="47" r="1.6" fill="#7bc96f" />
            </g>
          ))}
        </g>
      );
    case 'pizza':
      return (
        <g>
          <circle cx="60" cy="48" r="30" fill="#e9a54c" />
          <circle cx="60" cy="48" r="25" fill="#f6d27a" />
          <circle cx="50" cy="40" r="5" fill="#d9472b" />
          <circle cx="68" cy="44" r="5" fill="#d9472b" />
          <circle cx="58" cy="58" r="5" fill="#d9472b" />
          <path d="M44 52l4-2M70 58l3-3M64 34l3 2" stroke="#3f8f3a" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );
    case 'lanche':
      return (
        <g>
          <path d="M34 44a26 18 0 0 1 52 0z" fill="#e9a54c" />
          <circle cx="50" cy="36" r="1.4" fill="#fff3d6" />
          <circle cx="60" cy="33" r="1.4" fill="#fff3d6" />
          <circle cx="70" cy="36" r="1.4" fill="#fff3d6" />
          <path d="M32 46h56l-3 5H35z" fill="#7bc96f" />
          <rect x="33" y="50" width="54" height="6" rx="3" fill="#f6c343" />
          <rect x="34" y="55" width="52" height="8" rx="4" fill="#7b3f2e" />
          <path d="M34 64h52a4 4 0 0 1-4 6H38a4 4 0 0 1-4-6z" fill="#e9a54c" />
        </g>
      );
    case 'petisco':
      return (
        <g>
          <path d="M40 40h40l-6 34H46z" fill="#e5484d" />
          {[44, 50, 56, 62, 68, 74].map((x, i) => (
            <rect key={x} x={x - 2} y={22 + (i % 3) * 4} width="5" height="26" rx="2" fill="#f6c343" transform={`rotate(${(i - 2.5) * 5} ${x} 40)`} />
          ))}
          <path d="M40 40h40l-1 6H41z" fill="#c13b3f" />
          <circle cx="60" cy="60" r="6" fill="#fff" opacity=".9" />
        </g>
      );
    case 'carne':
      return (
        <g>
          <ellipse cx="60" cy="54" rx="40" ry="20" fill="#fff" />
          <path d="M40 50c0-10 14-14 26-12s20 8 16 16-18 10-28 8-14-4-14-12z" fill="#9c4a2f" />
          <path d="M48 46l20 10M54 42l20 10" stroke="#6e2f1d" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="82" cy="60" r="5" fill="#7bc96f" />
          <circle cx="40" cy="62" r="4" fill="#f6c343" />
        </g>
      );
    case 'acai':
      return (
        <g>
          <path d="M36 40h48l-6 34H42z" fill="#fff" />
          <path d="M38 40h44l-1.6 10H39.6z" fill="#5b2a6e" />
          <circle cx="48" cy="36" r="6" fill="#5b2a6e" />
          <circle cx="60" cy="33" r="7" fill="#6c3384" />
          <circle cx="72" cy="36" r="6" fill="#5b2a6e" />
          <circle cx="54" cy="31" r="2.5" fill="#f6c343" />
          <circle cx="68" cy="30" r="2.5" fill="#e5484d" />
          <path d="M58 26l4 3" stroke="#fff" strokeWidth="2" />
        </g>
      );
    default:
      return (
        <g>
          <ellipse cx="60" cy="54" rx="40" ry="20" fill="#fff" />
          <ellipse cx="60" cy="52" rx="28" ry="12" fill="#f3efe6" />
          <ellipse cx="50" cy="50" rx="11" ry="7" fill="#f6d27a" />
          <ellipse cx="68" cy="50" rx="10" ry="7" fill="#9c4a2f" />
          <circle cx="60" cy="44" r="5" fill="#7bc96f" />
          <circle cx="74" cy="56" r="3" fill="#e5484d" />
        </g>
      );
  }
}

/** Ilustração do produto (fallback quando não há foto). */
export function FoodArt({ name, category, className, label }: { name: string; category?: string | null; className?: string; label?: string }) {
  const kind = foodKind(name, category);
  const [a, b] = BACKDROPS[hash(name) % BACKDROPS.length] ?? BACKDROPS[0]!;
  const id = `fa${hash(`${name}${category ?? ''}`) % 100000}`;
  return (
    <svg className={['pdp-food-art', className].filter(Boolean).join(' ')} viewBox="0 0 120 90" role="img" aria-label={label ?? name} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="120" height="90" fill={`url(#${id})`} />
      <circle cx="98" cy="14" r="22" fill="#fff" opacity=".18" />
      <circle cx="14" cy="82" r="18" fill="#fff" opacity=".14" />
      <ellipse cx="60" cy="76" rx="38" ry="5" fill="#000" opacity=".07" />
      <Dish kind={kind} />
    </svg>
  );
}
