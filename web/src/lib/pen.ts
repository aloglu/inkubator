/** Suggested values for a pen's free-text fields. */

export const nibSizes = ['EF', 'F', 'MF', 'M', 'B', 'BB', 'Stub', 'Italic', 'Music'];
export const nibMaterials = ['Steel', 'Gold', '14k gold', '18k gold', '21k gold', 'Titanium'];
export const fillingSystems = ['Cartridge', 'Converter', 'Piston', 'Vacuum', 'Eyedropper', 'Dipping'];

/**
 * Values already used in the collection, most used first, then the standard
 * ones not yet used. Case differences count as the same value.
 */
export function suggestions(used: readonly string[], standard: readonly string[], limit = 10): string[] {
  const counts = new Map<string, { value: string; count: number }>();
  for (const value of used) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { value: trimmed, count: 1 });
  }
  const fromCollection = [...counts.values()].sort((a, b) => b.count - a.count).map((entry) => entry.value);
  const rest = standard.filter((value) => !counts.has(value.toLowerCase()));
  return [...fromCollection, ...rest].slice(0, limit);
}

/** `YYYY-MM-DD` or `YYYY-MM`, as the server accepts for purchase dates. */
export function isPurchaseDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return false;
  if (match[3] === undefined) return true;
  const day = Number(match[3]);
  const date = new Date(Number(match[1]), month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day;
}
