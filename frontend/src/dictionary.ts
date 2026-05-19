// Fully offline Kelime Zinciri engine. The 6,197-word common Turkish dictionary
// is bundled into the app, so the game never needs network access to start a
// round or validate a guess. This eliminates the entire class of production
// failures we were hitting against the Emergent preview backend (Cloudflare
// bot challenges, rate-limits, captive portals, etc.).
import words from "./words.json";

// Turkish-aware case helpers ---------------------------------------------------
// JavaScript's default lower/upper does NOT handle the i/İ ı/I pair correctly
// for Turkish, so we use locale-aware operations.
export function trLower(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}
export function trUpper(s: string): string {
  return s.toLocaleUpperCase("tr-TR");
}

// Normalise input for dictionary lookup. We accept any-case Turkish letters
// (including dotted vs dotless i) and trim/normalise whitespace.
function normalize(raw: string): string {
  return trLower(raw || "").trim();
}

// Build a Set once for O(1) lookups.
const DICTIONARY: ReadonlyArray<string> = words as string[];
const DICT_SET: Set<string> = new Set(DICTIONARY);

// Word count for splash / debug surfaces.
export const DICT_SIZE = DICTIONARY.length;

// Pre-index words by first letter to make start-word selection cheap and
// guarantee we never hand out a word ending in a dead letter.
const FIRST_LETTER_BUCKETS: Record<string, string[]> = {};
for (const w of DICTIONARY) {
  const k = w[0];
  if (!k) continue;
  if (!FIRST_LETTER_BUCKETS[k]) FIRST_LETTER_BUCKETS[k] = [];
  FIRST_LETTER_BUCKETS[k].push(w);
}

// Letters that actually have at least one word starting with them. Used to
// guarantee a chain can continue.
const LETTERS_WITH_WORDS: Set<string> = new Set(Object.keys(FIRST_LETTER_BUCKETS));

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a random start word. We only pick words whose final letter has at least
 * one candidate continuation — so the player can never be handed a dead-end.
 */
export function pickStartWord(): string {
  // Try up to 20 times — virtually always succeeds on the first attempt
  // because our dictionary was pre-filtered to exclude dead-end finals.
  for (let i = 0; i < 20; i++) {
    const w = randomFromArray(DICTIONARY as string[]);
    if (LETTERS_WITH_WORDS.has(w[w.length - 1])) return w;
  }
  // Fallback — should be unreachable
  return DICTIONARY[0] || "kelime";
}

export type ValidateResult =
  | { valid: true; nextLetter: string }
  | { valid: false; reason: string };

/**
 * Validate a candidate word against the chain rules.
 *
 *   - Word must be 3-7 Turkish letters (matches the backend filter).
 *   - Word must exist in the bundled dictionary.
 *   - Word must not have been used earlier in this session.
 *   - Word's first letter must match the previous word's last letter
 *     (Turkish-aware: i↔i, İ↔i, etc.).
 */
export function validateWord(input: {
  word: string;
  previousWord: string;
  usedWords: Iterable<string>;
}): ValidateResult {
  const w = normalize(input.word);
  if (!w) return { valid: false, reason: "Kelime çok kısa" };
  if (w.length < 3) return { valid: false, reason: "Kelime çok kısa" };
  if (w.length > 7) return { valid: false, reason: "Kelime çok uzun" };

  // Only Turkish letters are valid.
  if (!/^[a-zçğıöşüâîû]+$/i.test(w)) {
    return { valid: false, reason: "Geçersiz karakter" };
  }

  const prev = normalize(input.previousWord);
  if (prev) {
    const needed = prev[prev.length - 1];
    if (w[0] !== needed) {
      return {
        valid: false,
        reason: `'${trUpper(needed)}' ile başlamalı`,
      };
    }
  }

  if (!DICT_SET.has(w)) return { valid: false, reason: "Sözlükte yok" };

  const used = new Set<string>();
  for (const u of input.usedWords) used.add(normalize(u));
  if (used.has(w)) return { valid: false, reason: "Daha önce kullanıldı" };

  return { valid: true, nextLetter: w[w.length - 1] };
}

// Convenience predicate used by some screens.
export function isWordInDictionary(word: string): boolean {
  return DICT_SET.has(normalize(word));
}
