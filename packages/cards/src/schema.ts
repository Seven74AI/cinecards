import { z } from 'zod';

/** Every category has a rarity (story 11.7): the category is shown by the cost token, the rarity by the gem and ornaments. */
export const RaritySchema = z.enum(['common', 'rare', 'epic', 'legendary']);
export const CategorySchema = z.enum(['character', 'spell', 'equipment', 'terrain']);
export const PowerIconSchema = z.enum(['bolt', 'star', 'fist', 'eye']);
/**
 * Ability kinds (triggers) known today (story 11.4). `kind` itself accepts any string so a card with a new
 * trigger still loads; the engine's support check (`unsupportedReason`) then refuses it until it is implemented.
 * - attack: used instead of the character's normal attack, once per turn (same eligibility, haste included)
 * - onPlay / onDeath / onAllyPlayed / onEnemyPlayed / startOfTurn / endOfTurn / onAttack / onAttacked / onKill: triggered effects
 * - active: legacy activated ability (spells: the spell's effect; characters: once per placement, or `cooldown` / `oncePerGame`)
 */
export const AbilityKindSchema = z.enum([
  'attack',
  'active',
  'passive',
  'onPlay',
  'onAllyPlayed',
  'onEnemyPlayed',
  'onDeath',
  'startOfTurn',
  'endOfTurn',
  'onAttack',
  'onAttacked',
  'onKill',
  'reaction',
  'choice',
  'flavor',
]);

/** Which played cards wake an onAllyPlayed / onEnemyPlayed ability. */
export const TriggerFilterSchema = z
  .object({ set: z.string(), category: z.string(), role: z.string(), ids: z.array(z.string()) })
  .partial();

/** Machine-readable effect. The op vocabulary is defined by the engine's effect DSL (epic 3). */
export const EffectSchema = z.object({ op: z.string().min(1) }).passthrough();

export const AbilitySchema = z.object({
  name: z.string().min(1),
  power: z.object({ icon: PowerIconSchema, count: z.number().int().min(1).max(4) }),
  kind: z.union([AbilityKindSchema, z.string().min(1)]),
  text: z.string().min(1),
  /** onAllyPlayed / onEnemyPlayed only: restricts the played cards that trigger it. */
  filter: TriggerFilterSchema.optional(),
  effects: z.array(EffectSchema).optional(),
});

const statSchema = z.union([z.number().int().nonnegative(), z.array(z.number().int().nonnegative()).min(1)]).nullable();

export const CardSchema = z
  .object({
    id: z.string().regex(/^[a-z]{2}-[a-z0-9-]+$/, 'id must look like "mx-neo"'),
    set: z.string().min(1),
    name: z.string().min(1),
    /** Short names other card texts use for this card ("Arthur", "Topper"), linked to it in those texts (story 13.1). */
    aliases: z.array(z.string().min(1)).optional(),
    rarity: RaritySchema,
    category: CategorySchema,
    role: z.string().min(1),
    cost: z.number().int().nonnegative().nullable(),
    hp: statSchema,
    atk: statSchema,
    element: PowerIconSchema.optional(),
    abilities: z.array(AbilitySchema),
    flavor: z.string().optional(),
    image: z.string().nullable(),
    choice: z.literal('exclusive').optional(),
    bodies: z.number().int().min(2).optional(),
  })
  .superRefine((card, ctx) => {
    if (card.category === 'character' && (card.hp === null || card.atk === null)) {
      ctx.addIssue({ code: 'custom', message: 'characters need hp and atk', path: ['hp'] });
    }
    if (card.category !== 'character' && (card.hp !== null || card.atk !== null)) {
      ctx.addIssue({ code: 'custom', message: 'only characters have hp and atk', path: ['hp'] });
    }
  });

export const CardSetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  year: z.number().int(),
  family: z.string().min(1),
  source: z.string().optional(),
  cards: z.array(CardSchema).min(1),
});

export type Rarity = z.infer<typeof RaritySchema>;
export type Category = z.infer<typeof CategorySchema>;
export type PowerIcon = z.infer<typeof PowerIconSchema>;
export type AbilityKind = z.infer<typeof AbilityKindSchema>;
export type TriggerFilter = z.infer<typeof TriggerFilterSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type Ability = z.infer<typeof AbilitySchema>;
export type Card = z.infer<typeof CardSchema>;
export type CardSet = z.infer<typeof CardSetSchema>;
