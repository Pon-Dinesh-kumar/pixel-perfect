import { describe, expect, it } from "vitest";
import { handLayout, nearestIndex } from "./handLayout";

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
});
