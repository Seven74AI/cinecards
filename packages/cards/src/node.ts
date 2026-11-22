import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalog, parseSet } from './parse.ts';
import type { Card, CardSet } from './schema.ts';

/** Node-only loader for content/sets/*.json (tests, server, tooling). */
export function loadSetsFromDir(dir: string): { sets: CardSet[]; catalog: Map<string, Card> } {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const parsed = files.map((f) => ({ file: f, set: parseSet(JSON.parse(readFileSync(join(dir, f), 'utf8')), f) }));
  return { sets: parsed.map((p) => p.set), catalog: buildCatalog(parsed) };
}
