/** Line icons of the deck screens, drawn as in mockup B / "Mes decks" (story 10.2). */
const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
} as const;

export type DeckIconName = keyof typeof PATHS | 'dots';

export function DeckIcon({ name, size = 16, width = 2.4, className }: { name: DeckIconName; size?: number; width?: number; className?: string }) {
  if (name === 'dots') {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}

/** Token outline of a category (same shapes as the cost token): shield, wax seal, hex nut, diamond. */
const TOKEN: Record<string, { d: string; fill: string }> = {
  character: { d: 'M1 1H23V16L12 25L1 16Z', fill: 'url(#deck-tk-char)' },
  spell: { d: 'M12 1.5A11.5 11.5 0 1 1 11.99 1.5Z', fill: '#a3271f' },
  equipment: { d: 'M6.5 2H17.5L23.5 13L17.5 24H6.5L0.5 13Z', fill: '#4a5662' },
  terrain: { d: 'M12 0.5L23.5 13L12 25.5L0.5 13Z', fill: '#3e7a1c' },
};

export function CategoryToken({ category, size = 18 }: { category: string; size?: number }) {
  const t = TOKEN[category] ?? TOKEN.character!;
  return (
    <svg className="deck-tk" width={size} height={size * 1.08} viewBox="0 0 24 26" aria-hidden="true">
      <defs>
        <linearGradient id="deck-tk-char" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9c25d" />
          <stop offset="1" stopColor="#9a6a14" />
        </linearGradient>
      </defs>
      <path d={t.d} fill={t.fill} stroke="#8a6416" strokeWidth="1.4" />
    </svg>
  );
}
