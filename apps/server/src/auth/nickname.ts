/** Account nicknames (story 8.1): 3-16 letters (accents included), digits, space, `-` and `_`. */
export const NICKNAME_RE = /^[\p{L}\p{N} _-]{3,16}$/u;

/** Trims, composes accents (NFC) and folds runs of spaces into one. */
export const normalizeNickname = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ');

/** Uniqueness key: case does not matter, composed and decomposed accents are the same. */
export const nicknameKey = (s: string) => normalizeNickname(s).toLocaleLowerCase('fr');

export const validNickname = (normalized: string) => NICKNAME_RE.test(normalized);

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
/** Length in characters (code points), not UTF-16 units. */
export const validPassword = (p: unknown): p is string => typeof p === 'string' && [...p].length >= PASSWORD_MIN && [...p].length <= PASSWORD_MAX;
