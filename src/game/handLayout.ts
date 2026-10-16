/**
 * Hand layout (pure). Up to FLAT_MAX cards: a flat row. More: an overlapping arc fan.
 * Skill cards from the same hero stack tighter (a "pile") so big hands stay readable.
 */
export const FLAT_MAX = 5;
export interface HandItem { key: string; group: string | null }
export interface HandPos { x: number; y: number; rot: number }

export function handLayout(items: HandItem[], cx: number, y: number, span: number, cardW: number): HandPos[] {
  const n = items.length;
  if (!n) return [];
  // weights: first card of a pile = 1, following cards of the same pile = 0.4
  const wts = items.map((it, i) => (i > 0 && it.group && items[i - 1]!.group === it.group ? 0.4 : 1));
  const units = wts.slice(1).reduce((a, b) => a + b, 0);
  const flat = n <= FLAT_MAX;
  const step = units ? Math.min(cardW + 6, (span - cardW) / units) : 0;
  const total = units * step;
  let acc = 0;
  return items.map((_, i) => {
    if (i > 0) acc += wts[i]! * step;
    const t = total ? acc / total - 0.5 : 0; // -0.5..0.5
    const x = cx - total / 2 + acc;
    if (flat) return { x, y, rot: 0 };
    return { x, y: y + t * t * 120, rot: t * 0.5 };
  });
}

/** Index of the card nearest to x (for the finger-slide peek). */
export function nearestIndex(pos: HandPos[], x: number): number {
  let best = -1, bd = Infinity;
  pos.forEach((p, i) => { const d = Math.abs(p.x - x); if (d <= bd) { bd = d; best = i; } });
  return best;
}
