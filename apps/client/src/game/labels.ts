import type { Ability, Card } from '@cinecards/cards';
import { TRIGGERS } from '@cinecards/engine';

/** Trigger label shown before each ability text (story 11.7): "À l'arrivée", "Attaque spéciale", "Passif", "Effet"… */
export function abilityTag(card: Pick<Card, 'category'>, ab: Pick<Ability, 'kind'>): { label: string; tone: string } {
  const k = ab.kind;
  if (card.category === 'spell' && (k === 'active' || k === 'choice')) return { label: 'Effet', tone: 'eff' };
  if (k === 'attack') return { label: 'Attaque spéciale', tone: 'atk' };
  if (k === 'passive') return { label: 'Passif', tone: 'pas' };
  if (k === 'active') return { label: 'Activée', tone: 'act' };
  if (k === 'choice') return { label: 'Au choix', tone: 'act' };
  if (k === 'reaction') return { label: 'Réaction', tone: 'rea' };
  if (k === 'flavor') return { label: 'Ambiance', tone: 'fla' };
  const t = (TRIGGERS as Record<string, { label: string }>)[k];
  return { label: t ? t.label.replace('’', "'") : k, tone: k === 'onPlay' ? 'arr' : 'trg' };
}

const norm = (s: string) => s.replace(/’/g, "'").toLowerCase();
/** Ability text without the leading trigger words the tag already shows ("À l'arrivée : …", "Attaque : …"). */
export function abilityBody(card: Pick<Card, 'category'>, ab: Pick<Ability, 'kind' | 'text'>): string {
  const heads = [abilityTag(card, ab).label, ...(ab.kind === 'attack' ? ['Attaque'] : [])];
  for (const h of heads) {
    if (!norm(ab.text).startsWith(norm(h))) continue;
    const rest = ab.text.slice(h.length);
    const m = /^\s*[:,]\s*/.exec(rest);
    if (m) {
      const body = rest.slice(m[0].length);
      return body.charAt(0).toUpperCase() + body.slice(1);
    }
  }
  return ab.text;
}
