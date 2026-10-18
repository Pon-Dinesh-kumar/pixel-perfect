import { describe, expect, it } from "vitest";
import { getHandCardDimensions, handLayout, nearestIndex, zeroOverlapHandLayout } from "./handLayout";

const items = (n: number, group: string | null = null) => Array.from({ length: n }, (_, i) => ({ key: `${i}`, group }));

describe("hand layout", () => {
  it("up to 5 cards lie flat", () => {
    expect(handLayout(items(5), 360, 1000, 500, 110).every((p) => p.rot === 0 && p.y === 1000)).toBe(true);
  });
  it("6+ cards fan out within the span", () => {
    const p = handLayout(items(9), 360, 1000, 500, 110);
    expect(p.some((q) => q.rot !== 0)).toBe(true);
    expect(p[p.length - 1]!.x - p[0]!.x).toBeLessThanOrEqual(500 - 110 + 0.001);
  });
  it("cards of the same skill pile stack tighter", () => {
    const p = handLayout([{ key: "a", group: null }, { key: "b", group: "kavin" }, { key: "c", group: "kavin" }], 360, 1000, 500, 110);
    expect(p[2]!.x - p[1]!.x).toBeLessThan(p[1]!.x - p[0]!.x);
  });
  it("finds the card under the finger", () => {
    const p = handLayout(items(4), 360, 1000, 500, 110);
    expect(nearestIndex(p, p[2]!.x + 3)).toBe(2);
  });

  describe("zero overlap hand layout (1 to 8 cards)", () => {
    for (let count = 1; count <= 8; count++) {
      it(`guarantees zero overlap for ${count} card(s)`, () => {
        const availableWidth = 680;
        const { cardW } = getHandCardDimensions(count, availableWidth);
        const pos = zeroOverlapHandLayout(count, 360, 1150, availableWidth, cardW);

        expect(pos).toHaveLength(count);

        // Check cards fit within available width
        const firstLeft = pos[0]!.x - cardW / 2;
        const lastRight = pos[pos.length - 1]!.x + cardW / 2;
        expect(firstLeft).toBeGreaterThanOrEqual(360 - availableWidth / 2 - 1);
        expect(lastRight).toBeLessThanOrEqual(360 + availableWidth / 2 + 1);

        // Check zero overlap: distance between consecutive card edges must be strictly > 0
        for (let i = 0; i < count - 1; i++) {
          const cardRightEdge = pos[i]!.x + cardW / 2;
          const nextCardLeftEdge = pos[i + 1]!.x - cardW / 2;
          expect(nextCardLeftEdge).toBeGreaterThan(cardRightEdge);
        }
      });
    }

    it("selected card lifts upward while maintaining non-overlapping slots", () => {
      const availableWidth = 680;
      const count = 7;
      const { cardW } = getHandCardDimensions(count, availableWidth);
      const selIdx = 3;
      const pos = zeroOverlapHandLayout(count, 360, 1150, availableWidth, cardW, { selectionIndex: selIdx, liftY: 26 });

      expect(pos[selIdx]!.y).toBe(1150 - 26);
      expect(pos[0]!.y).toBe(1150);
      expect(pos[1]!.y).toBe(1150);

      // Verify zero overlap remains intact
      for (let i = 0; i < count - 1; i++) {
        expect(pos[i + 1]!.x - cardW / 2).toBeGreaterThan(pos[i]!.x + cardW / 2);
      }
    });

    it("subtle curve arch effect introduces gentle rotation and elevation for higher card counts with zero overlap", () => {
      const availableWidth = 680;
      const count = 8;
      const { cardW } = getHandCardDimensions(count, availableWidth);
      const pos = zeroOverlapHandLayout(count, 360, 1150, availableWidth, cardW, { enableCurve: true });

      expect(pos).toHaveLength(8);
      expect(Math.abs(pos[0]!.rot)).toBeGreaterThan(0);
      expect(Math.abs(pos[7]!.rot)).toBeGreaterThan(0);
      expect(pos[0]!.rot).toBeLessThan(0);
      expect(pos[7]!.rot).toBeGreaterThan(0);

      for (let i = 0; i < count - 1; i++) {
        expect(pos[i + 1]!.x - cardW / 2).toBeGreaterThan(pos[i]!.x + cardW / 2);
      }
    });
  });
});
