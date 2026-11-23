const P: Record<string, string> = {
  sword: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.050 3 5.5l7 7Z"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  star: '<path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z"/>',
  fist: '<path d="M7 10V7a2 2 0 0 1 4 0v3"/><path d="M11 9V6a2 2 0 0 1 4 0v4"/><path d="M15 9.5V8a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-3a2 2 0 0 1 2-2h3a2 2 0 0 1 0 4H8"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  silence: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
  poison: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/><line x1="9.5" x2="14.5" y1="13" y2="18"/><line x1="14.5" x2="9.5" y1="13" y2="18"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.510 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  immune: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
  cycle: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
  spell: '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>',
  terrain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  deck: '<rect x="7" y="3" width="12" height="16" rx="2"/><path d="M5 7v12a2 2 0 0 0 2 2h9"/>',
  grave: '<path d="M7 21V9a5 5 0 0 1 10 0v12"/><path d="M4 21h16"/><path d="M12 9v6"/><path d="M9.5 11.5h5"/>',
  hand: '<rect x="3" y="6" width="9" height="13" rx="1.5" transform="rotate(-10 7.5 12.5)"/><rect x="11" y="5" width="9" height="13" rx="1.5" transform="rotate(8 15.5 11.5)"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  sound: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  mute: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
  stun: '<circle cx="12" cy="12" r="9"/><path d="M8 9.5c1-1 2-1 3 0M13 9.5c1-1 2-1 3 0M8 16c2.5-2 5.5-2 8 0"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
  close: '<line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>',
  speed: '<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M11 8v6M8 11h6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  crown: '<path d="M3 18h18l-1.6-10-4.9 4-2.5-7-2.5 7-4.9-4z"/><path d="M3 21h18"/>',
};
const FILLED = new Set(['heart', 'bolt', 'star']);

export function Icon({ name, size = 16, color, title }: { name: string; size?: number; color?: string; title?: string }) {
  const filled = FILLED.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color, flex: 'none' }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : '') + (P[name] ?? '') }}
    />
  );
}

export const STATUS_ICON: Record<string, { icon: string; label: string; color: string }> = {
  silence: { icon: 'silence', label: 'Silence', color: '#B8A8FF' },
  poison: { icon: 'poison', label: 'Poison', color: '#8FE36A' },
  shield: { icon: 'shield', label: 'Bouclier', color: '#F2D27A' },
  immune: { icon: 'immune', label: 'Immunisé', color: '#7FE0A8' },
  insensible: { icon: 'shield', label: 'Insensible', color: '#4FD1C5' },
  stunned: { icon: 'stun', label: 'Étourdi', color: '#FFB86B' },
  extraAttack: { icon: 'sword', label: 'Attaque bonus', color: '#FF8A8A' },
  precision: { icon: 'eye', label: 'Précision', color: '#4FD1C5' },
  spellImmune: { icon: 'spell', label: 'Intouchable par les sorts', color: '#FFB0A0' },
};

/** The same icon as an SVG string, for effects drawn outside React (epic 12). */
export function iconSvg(name: string, size: number, color: string): string {
  const filled = FILLED.has(name);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? color : 'none'}" stroke="${filled ? 'none' : color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`;
}
