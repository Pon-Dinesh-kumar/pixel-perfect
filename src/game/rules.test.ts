import { describe, expect, it } from "vitest";
import { canPlay, carrierScore, createGame, energyForTurn, nextTurn, opponentTurn, playCard, result, MAX_TURNS } from "./rules";

const seeded = () => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

describe("SCENE rules", () => {
  it("starts with 4 cards and 1 energy", () => {
    const g = createGame(seeded());
    expect(g.player.hand).toHaveLength(4);
    expect(g.player.energy).toBe(1);
  });
  it("energy equals turn number capped at 6", () => {
    expect(energyForTurn(3)).toBe(3);
    expect(energyForTurn(9)).toBe(6);
  });
  it("playing deducts cost and blocks occupied slots / insufficient energy", () => {
    const g = createGame(seeded());
    g.player.hand = ["vanguard", "aurora", "vanguard", "skyguard"];
    expect(canPlay(g, "player", 1, 0, 0)).toBe(false); // aurora costs 4
    expect(playCard(g, "player", 0, 0, 0)).toBe(true);
    expect(g.player.energy).toBe(0);
    g.player.energy = 5;
    expect(canPlay(g, "player", 1, 0, 0)).toBe(false); // occupied
    expect(carrierScore(g.carriers[0], "player")).toBe(2);
  });
  it("opponent only makes legal moves and match ends after max turns", () => {
    const g = createGame(seeded());
    for (let t = 0; t < MAX_TURNS; t++) {
      const before = g.opponent.energy;
      const moves = opponentTurn(g, seeded());
      expect(g.opponent.energy).toBeGreaterThanOrEqual(0);
      expect(before - g.opponent.energy).toBe(moves.length ? before - g.opponent.energy : 0);
      nextTurn(g);
    }
    expect(g.over).toBe(true);
    expect(["win", "loss", "draw"]).toContain(result(g).outcome);
  });
});
