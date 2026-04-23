// Deterministic shuffle for ranking questions.
// Seed comes from hashing player_id + question_id so a given player sees the
// same order across reloads, and different players see different orders.

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns an array of indices into `items` in a deterministic shuffled order.
 * e.g. shuffleIndices(4, "abc") might return [2, 0, 3, 1] meaning the player
 * sees items[2], items[0], items[3], items[1].
 */
export function shuffleIndices(length: number, seedSource: string): number[] {
  const seed = xmur3(seedSource)();
  const rng = mulberry32(seed);
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

export function rankingSeed(playerId: string, questionId: string): string {
  return `${playerId}:${questionId}`;
}
