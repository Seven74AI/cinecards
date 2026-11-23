import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Epic 8 retrospective, action 1: the client styles live in one file per feature (src/styles/*.css, imported in
 * cascade order by src/styles/index.css). Two merges once lost a closing brace and shipped a page without CSS:
 * every stylesheet must parse on its own.
 */

// postcss comes with Vite (no extra dependency): load it from Vite's own location
const requireHere = createRequire(import.meta.url);
const postcss = createRequire(requireHere.resolve('vite'))('postcss') as { parse: (css: string, opts: { from: string }) => unknown };

const src = dirname(fileURLToPath(import.meta.url));
const stylesDir = join(src, 'styles');

const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : [],
  );

describe('client stylesheets', () => {
  const files = cssFiles(src);

  it('the parser rejects a broken sheet (unclosed block, stray brace)', () => {
    expect(() => postcss.parse('.a { color: red;\n.b { color: blue; }', { from: 'broken.css' })).toThrow(/Unclosed block/);
    expect(() => postcss.parse('.a { color: red; } }', { from: 'broken.css' })).toThrow(/Unexpected }/);
  });

  it('finds the stylesheets', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [relative(src, f), f]))('%s parses without a syntax error', (_name, file) => {
    expect(() => postcss.parse(readFileSync(file, 'utf8'), { from: file })).not.toThrow();
  });

  it('index.css imports every feature stylesheet exactly once, and only imports', () => {
    const index = readFileSync(join(stylesDir, 'index.css'), 'utf8');
    const imported = [...index.matchAll(/@import\s+'\.\/([^']+)';/g)].map((m) => m[1]);
    const onDisk = readdirSync(stylesDir).filter((f) => f.endsWith('.css') && f !== 'index.css').sort();
    expect([...imported].sort()).toEqual(onDisk);
    expect(new Set(imported).size).toBe(imported.length);
    // nothing but imports and comments, so the cascade order is the import order
    const rest = index.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import\s+'[^']+';/g, '').trim();
    expect(rest).toBe('');
  });
});
