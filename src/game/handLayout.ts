/**
 * Responsive hand layout for SCENE.
 *
 * - Up to FLAT_MAX cards: flat row.
 * - More cards: subtle upward arc fan.
 * - Cards belonging to the same hero form tighter piles.
 * - Selected cards lift and straighten without pushing the hand
 *   outside its available horizontal span.
 *
 * Coordinates represent card centers.
 * Rotation is expressed in radians.
 */

export const FLAT_MAX = 5;

export interface HandItem {
  key: string;
  group: string | null;
}

export interface HandPos {
  x: number;
  y: number;
  rot: number;
}

export interface HandLayoutOptions {
  /** Force an arc when true, or a flat row when false. */
  convexArc?: boolean;

  /** Maximum vertical rise of the arc, in pixels. */
  arcHeight?: number;

  /** Maximum absolute rotation of the outer cards, in radians. */
  maxRot?: number;

  /** When true, cards are strictly placed in a non-overlapping row. */
  noOverlapRow?: boolean;

  selection?: {
    /** Index of the currently selected card, or -1 for none. */
    index: number;

    /** How far the selected card rises, in pixels. */
    liftY?: number;

    /** Maximum extra horizontal separation around selection. */
    partSpacing?: number;
  };
}

/**
 * Returns mathematically tuned dimensions and gaps for 1 to 8 cards with zero overlap.
 */
export function getHandCardDimensions(handCount: number, availableWidth = 680): { cardW: number; cardH: number; gap: number } {
  const n = Math.max(1, Math.min(8, handCount));
  let cardW = 152;
  let gap = 20;

  if (n === 1) {
    cardW = 152;
    gap = 0;
  } else if (n === 2) {
    cardW = 142;
    gap = 24;
  } else if (n === 3) {
    cardW = 132;
    gap = 20;
  } else if (n === 4) {
    cardW = 122;
    gap = 16;
  } else if (n === 5) {
    cardW = 114;
    gap = 12;
  } else if (n === 6) {
    cardW = 102;
    gap = 9;
  } else if (n === 7) {
    cardW = 90;
    gap = 7;
  } else {
    // 8 cards: 8 * 80 + 7 * 5 = 675 <= availableWidth
    cardW = 80;
    gap = 5;
  }

  // Ensure total width fits within available width
  const totalW = n * cardW + (n - 1) * gap;
  if (totalW > availableWidth && n > 1) {
    gap = 4;
    cardW = Math.floor((availableWidth - (n - 1) * gap) / n);
  }

  const cardH = Math.round(cardW * 1.4);
  return { cardW, cardH, gap };
}

/**
 * Calculates guaranteed non-overlapping positions for 1 to 8 cards.
 */
export function zeroOverlapHandLayout(
  count: number,
  cx: number,
  baseY: number,
  availableWidth: number,
  cardW: number,
  opts?: {
    selectionIndex?: number | undefined;
    liftY?: number | undefined;
    enableCurve?: boolean;
    curveFactor?: number;
  }
): HandPos[] {
  if (count <= 0) return [];
  const liftY = opts?.liftY ?? 28;

  if (count === 1) {
    const isSel = opts?.selectionIndex === 0;
    return [{
      x: cx,
      y: baseY - (isSel ? liftY : 0),
      rot: 0,
    }];
  }

  const n = count;
  const rawGap = Math.max(4, Math.floor((availableWidth - n * cardW) / (n - 1)));
  let gap = rawGap;
  if (n === 2) gap = Math.min(26, rawGap);
  else if (n === 3) gap = Math.min(20, rawGap);
  else if (n === 4) gap = Math.min(16, rawGap);
  else if (n === 5) gap = Math.min(12, rawGap);

  const totalWidth = n * cardW + (n - 1) * gap;
  const startX = cx - totalWidth / 2 + cardW / 2;
  const step = cardW + gap;

  // Gentle minimal arch curve that scales subtly with card count
  const withCurve = opts?.enableCurve ?? false;
  // Parabolic arch drop and subtle rotation (at most ~3.5° for outer cards of 8)
  const maxArcY = withCurve ? (n >= 7 ? 22 : n >= 5 ? 16 : n >= 3 ? 8 : 4) : 0;
  const maxRot = withCurve ? (n >= 7 ? 0.055 : n >= 5 ? 0.040 : n >= 3 ? 0.022 : 0.010) : 0;

  const positions: HandPos[] = [];
  for (let i = 0; i < n; i++) {
    const isSel = opts?.selectionIndex === i;
    // Normalized card position from -1 (leftmost) to +1 (rightmost)
    const norm = n > 1 ? (i / (n - 1) - 0.5) * 2 : 0;
    // Outer cards drop slightly lower in a gentle parabolic arch (center card is highest)
    const arcDrop = withCurve ? Math.round(maxArcY * (norm * norm)) : 0;
    const rot = (withCurve && !isSel) ? Number((norm * maxRot).toFixed(4)) : 0;

    positions.push({
      x: Math.round(startX + i * step),
      y: baseY + arcDrop - (isSel ? liftY : 0),
      rot,
    });
  }
  return positions;
}

/**
 * Clamp a number to a valid range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Smooth interpolation between 0 and 1.
 */
function smoothStep(t: number): number {
  const v = clamp(t, 0, 1);
  return v * v * (3 - 2 * v);
}

/**
 * Calculate positions for cards in a responsive hand.
 *
 * cx: horizontal center of the hand container.
 * y: baseline Y coordinate for card centers.
 * span: available horizontal width for the complete hand.
 * cardW: rendered card width in the same coordinate system.
 */
export function handLayout(
  items: HandItem[],
  cx: number,
  y: number,
  span: number,
  cardW: number,
  opts?: HandLayoutOptions
): HandPos[] {
  const n = items.length;

  if (n === 0) return [];

  if (
    !Number.isFinite(cx) ||
    !Number.isFinite(y) ||
    !Number.isFinite(span) ||
    !Number.isFinite(cardW) ||
    span <= 0 ||
    cardW <= 0
  ) {
    return items.map(() => ({ x: cx, y, rot: 0 }));
  }

  if (opts?.noOverlapRow) {
    return zeroOverlapHandLayout(n, cx, y, span, cardW, {
      selectionIndex: opts.selection?.index,
      liftY: opts.selection?.liftY,
    });
  }

  const safeSpan = Math.max(1, span);
  const safeCardW = Math.min(cardW, safeSpan);
  const halfCard = safeCardW / 2;

  const selectionIndex = opts?.selection?.index ?? -1;
  const hasSelection =
    Number.isInteger(selectionIndex) &&
    selectionIndex >= 0 &&
    selectionIndex < n;

  const liftY = Math.max(0, opts?.selection?.liftY ?? 40);
  const requestedPartSpacing = Math.max(
    0,
    opts?.selection?.partSpacing ?? 14
  );

  const flat =
    opts?.convexArc !== undefined
      ? !opts.convexArc
      : n <= FLAT_MAX;

  /*
   * Build horizontal spacing weights.
   *
   * Normal cards use a full spacing unit.
   * Consecutive cards from the same hero use tighter spacing.
   */
  const weights = items.map((item, index) => {
    if (
      index > 0 &&
      item.group !== null &&
      item.group === items[index - 1]!.group
    ) {
      return 0.55;
    }

    return 1;
  });

  /*
   * Available distance between the first and last card centers.
   * The first and last card edges remain within the hand span.
   */
  const maxCenterDistance = Math.max(0, safeSpan - safeCardW);

  const totalWeight = weights
    .slice(1)
    .reduce((sum, weight) => sum + weight, 0);

  /*
   * Keep the hand compact when possible, but shrink spacing
   * proportionally whenever the available span is limited.
   */
  const preferredStep = safeCardW + 8;

  const step =
    totalWeight > 0
      ? Math.min(preferredStep, maxCenterDistance / totalWeight)
      : 0;

  /*
   * Precompute weighted horizontal positions.
   * This includes all inter-card gaps and avoids the previous
   * off-by-one error in the total width calculation.
   */
  const offsets: number[] = [];
  let accumulated = 0;

  for (let i = 0; i < n; i++) {
    if (i > 0) {
      accumulated += weights[i]! * step;
    }

    offsets.push(accumulated);
  }

  const totalDistance = accumulated;

  /*
   * Selection creates a small opening around the chosen card.
   * Its total extra width is budgeted before positions are
   * calculated, so the outer cards do not overflow the span.
   */
  const leftCount = hasSelection ? selectionIndex : 0;
  const rightCount = hasSelection ? n - 1 - selectionIndex : 0;

  const selectionGapBudget =
    hasSelection && n > 1
      ? requestedPartSpacing * (leftCount + rightCount) / 2
      : 0;

  const availableDistance = Math.max(
    0,
    maxCenterDistance - selectionGapBudget
  );

  const distanceScale =
    totalDistance > 0
      ? Math.min(1, availableDistance / totalDistance)
      : 1;

  const scaledDistance = totalDistance * distanceScale;

  /*
   * Apply the final center offset.
   */
  const startX = cx - scaledDistance / 2;

  /*
   * Convert the requested selection spacing into a per-card
   * offset while respecting the available width.
   */
  const actualPartSpacing =
    hasSelection && n > 1
      ? Math.min(
          requestedPartSpacing,
          maxCenterDistance / Math.max(1, n - 1)
        )
      : 0;

  const arcHeight = Math.max(0, opts?.arcHeight ?? 32);
  const maxRotation = Math.max(0, opts?.maxRot ?? 0.16);

  return items.map((_, index) => {
    let x = startX + offsets[index]! * distanceScale;

    /*
     * Create a subtle opening around the selected card.
     * Normalize the offsets afterward to preserve centering.
     */
    if (hasSelection) {
      if (index < selectionIndex) {
        x -= actualPartSpacing;
      } else if (index > selectionIndex) {
        x += actualPartSpacing;
      }
    }

    const selected = hasSelection && index === selectionIndex;

    /*
     * Normalize X positions to keep the complete hand centered.
     */
    if (hasSelection && actualPartSpacing > 0) {
      const leftShift = -actualPartSpacing * leftCount;
      const rightShift = actualPartSpacing * rightCount;
      const centerCorrection = (leftShift + rightShift) / 2;

      x -= centerCorrection;
    }

    /*
     * Clamp card centers so the card body stays inside the span.
     */
    x = clamp(
      x,
      cx - safeSpan / 2 + halfCard,
      cx + safeSpan / 2 - halfCard
    );

    /*
     * Flat layout: selected card lifts, all cards remain upright.
     */
    if (flat) {
      return {
        x,
        y: y - (selected ? liftY : 0),
        rot: 0,
      };
    }

    /*
     * Fan layout.
     *
     * t ranges from -0.5 on the left to +0.5 on the right.
     * The center rises gently; outer cards remain lower.
     */
    const t =
      scaledDistance > 0
        ? (offsets[index]! * distanceScale) / scaledDistance - 0.5
        : 0;

    const arch = Math.max(0, 1 - 4 * t * t) * arcHeight;

    /*
     * Rotation is restrained for mobile readability.
     * The selected card straightens and lifts above the fan.
     */
    const rotation = selected ? 0 : t * maxRotation;

    return {
      x,
      y: y - arch - (selected ? liftY : 0),
      rot: rotation,
    };
  });
}

/**
 * Returns the index of the nearest card center to a finger X.
 *
 * For equal distances, the later card wins because it is
 * assumed to be visually on top in a left-to-right card fan.
 *
 * This helper is useful for swipe peeking, but actual taps on
 * overlapping cards should use rectangular/polygon hit testing
 * in reverse render order.
 */
export function nearestIndex(pos: HandPos[], x: number): number {
  if (pos.length === 0 || !Number.isFinite(x)) {
    return -1;
  }

  let bestIndex = -1;
  let bestDistance = Infinity;

  pos.forEach((position, index) => {
    const distance = Math.abs(position.x - x);

    if (distance <= bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

/**
 * Find the visually topmost card containing a point.
 *
 * Supply card bounds in the same coordinate system as HandPos.
 * The returned index follows the assumed render order:
 * higher array indices are drawn above lower indices.
 *
 * For rotated cards, replace the rectangular test with polygon
 * hit testing if precise corner interaction is required.
 */
export function hitTestHand(
  pos: HandPos[],
  cardW: number,
  cardH: number,
  x: number,
  y: number
): number {
  if (
    pos.length === 0 ||
    cardW <= 0 ||
    cardH <= 0 ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return -1;
  }

  for (let i = pos.length - 1; i >= 0; i--) {
    const card = pos[i]!;

    const dx = x - card.x;
    const dy = y - card.y;

    /*
     * Transform the point into the card's local coordinates
     * by rotating it in the opposite direction.
     */
    const cos = Math.cos(card.rot);
    const sin = Math.sin(card.rot);

    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;

    if (
      localX >= -cardW / 2 &&
      localX <= cardW / 2 &&
      localY >= -cardH / 2 &&
      localY <= cardH / 2
    ) {
      return i;
    }
  }

  return -1;
}