/** Ranks items against a typed query. Every word of the query must match. */

/** Lower case, without accents, so "kakuno" finds "Kaküno". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * `fields` lists an item's searchable texts, most important first. A word
 * scores more when it starts a word, and more again in an earlier field.
 */
export function rank<T>(items: readonly T[], fields: (item: T) => string[], query: string, limit = 8): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const texts = fields(item).map(fold);
    let score = 0;
    for (const word of words) {
      let best = 0;
      texts.forEach((text, position) => {
        const at = text.indexOf(word);
        if (at < 0) return;
        const startsWord = at === 0 || /[\s\-·&/'(]/.test(text[at - 1] ?? '');
        const value = (startsWord ? 3 : 1) * (texts.length - position);
        best = Math.max(best, value);
      });
      if (!best) return;
      score += best;
    }
    scored.push({ item, score, index });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}
