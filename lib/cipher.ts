export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export type Cipher = Record<string, string>;

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFromString(seed: string): () => number {
  const hasher = xmur3(seed);
  return mulberry32(hasher());
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a substitution cipher (a derangement — no letter maps to itself).
 * Returned map: encryptedLetter -> plaintextLetter.
 */
export function buildCipher(rng: () => number): Cipher {
  // Generate a derangement of the alphabet using rejection-with-repair.
  for (let attempt = 0; attempt < 64; attempt++) {
    const perm = shuffle(ALPHABET, rng);
    let bad = false;
    for (let i = 0; i < ALPHABET.length; i++) {
      if (perm[i] === ALPHABET[i]) {
        bad = true;
        break;
      }
    }
    if (!bad) {
      // perm[i] is the plaintext at position i. We want enc->plain map.
      // Encryption: plaintext letter ALPHABET[i] is replaced by perm[i] in the puzzle.
      // So cipher[ perm[i] ] = ALPHABET[i].
      const cipher: Cipher = {};
      for (let i = 0; i < ALPHABET.length; i++) {
        cipher[perm[i]] = ALPHABET[i];
      }
      return cipher;
    }
  }
  // Fallback: shift-by-one cipher
  const cipher: Cipher = {};
  for (let i = 0; i < ALPHABET.length; i++) {
    cipher[ALPHABET[(i + 1) % 26]] = ALPHABET[i];
  }
  return cipher;
}

/**
 * Encrypt plaintext using cipher (enc -> plain). Returns the encrypted string,
 * preserving case and non-letters.
 */
export function encrypt(text: string, cipher: Cipher): string {
  // Invert: plain -> enc
  const inv: Record<string, string> = {};
  for (const [enc, plain] of Object.entries(cipher)) inv[plain] = enc;
  let out = "";
  for (const ch of text) {
    const upper = ch.toUpperCase();
    if (upper >= "A" && upper <= "Z") {
      const enc = inv[upper];
      out += ch === upper ? enc : enc.toLowerCase();
    } else {
      out += ch;
    }
  }
  return out;
}
