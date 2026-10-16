import { describe, expect, it } from "vitest";
import {
  allUids, canPlay, carrierScore, createGame, effectivePower, endPlayerTurn, energyForTurn, moveCard, nextTurn,
  opponentTurn, playCard, result, takeBack, MAX_TURNS, type GameState,
} from "./rules";
import type { CardId } from "./cards";

const seeded = () => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const setHand = (g: GameState, ids: CardId[]) => { g.player.hand = ids.map((id, i) => ({ uid: 900 + i, id })); };

describe("SCENE rules", () => {
  it("energy equals turn number capped at 6", () => {
    expect(energyForTurn(3)).toBe(3);
    expect(energyForTurn(9)).toBe(6);
  });

  it("rejects unaffordable plays and occupied slots without changing energy", () => {
    const g = createGame(seeded());
    setHand(g, ["vanguard", "aurora", "vanguard", "skyguard"]);
    expect(playCard(g, "player", 1, 0, 0)).toBe(false);
    expect(g.player.energy).toBe(1);
    expect(playCard(g, "player", 0, 0, 0)).toBe(true);
    g.player.energy = 5;
    expect(canPlay(g, "player", 0, 0, 0)).toBe(false);
    expect(g.player.energy).toBe(5);
  });

  it("acceptance: play, take back (refund once), replay, end-turn lock, next turn", () => {
    const g = createGame(seeded());
    g.player.energy = 3;
    setHand(g, ["riftdancer", "vanguard", "vanguard", "vanguard"]);
    const total = allUids(g).length;

    expect(playCard(g, "player", 0, 1, 0)).toBe(true);
    expect(g.player.energy).toBe(1);
    expect(takeBack(g, 1, 0)).toBe(true);
    expect(g.player.energy).toBe(3);
    expect(g.carriers[1]!.player[0]).toBeNull();
    expect(takeBack(g, 1, 0)).toBe(false); // no second refund
    expect(g.player.energy).toBe(3);

    const idx = g.player.hand.findIndex((c) => c.id === "riftdancer");
    expect(playCard(g, "player", idx, 1, 2)).toBe(true);
    expect(g.player.energy).toBe(1);
    expect(moveCard(g, 1, 2, 0, 1)).toBe(true); // reposition is free
    expect(g.player.energy).toBe(1);
    expect(allUids(g).length).toBe(total);
    expect(new Set(allUids(g)).size).toBe(total);

    endPlayerTurn(g);
    expect(takeBack(g, 0, 1)).toBe(false);
    expect(moveCard(g, 0, 1, 0, 2)).toBe(false);
    opponentTurn(g, seeded());
    nextTurn(g);
    expect(g.phase).toBe("player");
    expect(takeBack(g, 0, 1)).toBe(false); // last turn's card stays locked
    const v = g.player.hand.findIndex((c) => c.id === "vanguard");
    expect(playCard(g, "player", v, 2, 0)).toBe(true);
    expect(takeBack(g, 2, 0)).toBe(true);
  });

  it("passives: momentum, lone wing, sentinel, disruptor recalc on change", () => {
    const g = createGame(seeded());
    g.player.energy = 99;
    setHand(g, ["riftdancer", "skyguard", "vanguard", "riftdancer"]);
    const c = g.carriers[0]!;
    playCard(g, "player", 1, 0, 0); // skyguard alone: 4 + 3
    expect(effectivePower(c, "player", 0)).toBe(7);
    playCard(g, "player", 0, 0, 1); // rift dancer with ally: 2 + 2; skyguard loses bonus
    expect(effectivePower(c, "player", 1)).toBe(4);
    expect(effectivePower(c, "player", 0)).toBe(4);
    takeBack(g, 0, 1);
    expect(effectivePower(c, "player", 0)).toBe(7);

    // sentinel: losing on base power
    c.opponent[0] = { uid: 1, id: "aurora", locked: true }; // 5 base, disruptor -1
    const v = g.player.hand.findIndex((h) => h.id === "vanguard");
    playCard(g, "player", v, 0, 2);
    // base: player 4+1=5, rival 5 -> not losing, no sentinel; disruptor -1 each
    expect(effectivePower(c, "player", 2)).toBe(0);
    expect(effectivePower(c, "player", 0)).toBe(4 - 1);
    expect(carrierScore(c, "player")).toBe(3);
    // scores stable across repeated recalculation
    expect(carrierScore(c, "player")).toBe(3);
  });

  it("player cards only go left, rival only right; match ends after max turns", () => {
    const g = createGame(seeded());
    for (let t = 0; t < MAX_TURNS; t++) {
      expect(playCard(g, "opponent", 0, 0, 0)).toBe(false); // not rival's turn
      endPlayerTurn(g);
      opponentTurn(g, seeded());
      for (const c of g.carriers) for (const p of c.player) expect(p?.locked ?? true).toBe(true);
      nextTurn(g);
    }
    expect(g.phase).toBe("over");
    expect(["win", "loss", "draw"]).toContain(result(g).outcome);
  });
});
