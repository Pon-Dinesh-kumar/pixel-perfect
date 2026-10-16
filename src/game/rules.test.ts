import { describe, expect, it } from "vitest";
import {
  beginReveal, revealNext, allUids, canPlay, carrierScore, createGame, effectivePower, endPlayerTurn, energyForTurn, moveCard, nextTurn,
  opponentTurn, playCard, result, takeBack, unlockedSkills, validDeck, heroPower, MAX_TURNS, type DeckEntry, type GameState,
} from "./rules";
import { HEROES } from "./heroes";
import { SKILLS } from "./skills";
import { freshProfile, isValidDeck, reward, sanitize, upgrade } from "./profile";

const seeded = () => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const DECK: DeckEntry[] = ["aruvi", "kavin", "meenal", "senthil", "thamarai", "yuki", "amara", "kofi"].map((hero) => ({ hero, tier: "base" })) as DeckEntry[];
const setHand = (g: GameState, ids: string[]) => { g.player.hand = ids.map((id, i) => ({ uid: 900 + i, id })); };
const settle = (g: GameState) => { endPlayerTurn(g); beginReveal(g); while (revealNext(g)) {} nextTurn(g); };
const game = (deck = DECK) => createGame({ player: deck, opponent: DECK, rng: seeded() });

describe("roster", () => {
  it("has exactly 20 heroes, at least 5 Tamil, 3 skills each", () => {
    expect(HEROES).toHaveLength(20);
    expect(HEROES.filter((h) => h.tamil).map((h) => h.id)).toEqual(expect.arrayContaining(["aruvi", "kavin", "meenal", "senthil", "thamarai"]));
    expect(SKILLS).toHaveLength(60);
  });
  it("tiers unlock 1/2/3 skills and add 0/1/2 power", () => {
    expect(unlockedSkills("aruvi", "base")).toHaveLength(1);
    expect(unlockedSkills("aruvi", "ascend")).toHaveLength(2);
    expect(unlockedSkills("aruvi", "apex")).toHaveLength(3);
    expect(heroPower("aruvi", "apex") - heroPower("aruvi", "base")).toBe(2);
  });
});

describe("deck", () => {
  it("requires exactly 8 unique heroes", () => {
    expect(validDeck(DECK)).toBe(true);
    expect(validDeck(DECK.slice(0, 7))).toBe(false);
    expect(validDeck([...DECK.slice(0, 7), DECK[0]!])).toBe(false);
    expect(isValidDeck(["aruvi", "aruvi", "kavin", "meenal", "senthil", "thamarai", "yuki", "amara"])).toBe(false);
  });
  it("battle deck is built from the saved deck", () => {
    const g = game();
    const ids = [...g.player.deck, ...g.player.hand].map((c) => c.id).sort();
    expect(ids).toEqual(DECK.map((d) => d.hero).sort());
  });
});

describe("battle", () => {
  it("energy is turn + 1, capped at 6", () => {
    expect(energyForTurn(1)).toBe(2);
    expect(energyForTurn(3)).toBe(4);
    expect(energyForTurn(9)).toBe(6);
  });

  it("a queued hero has no skills or power; take-back refunds exactly", () => {
    const g = game([{ hero: "aruvi", tier: "ascend" }, ...DECK.slice(1)]);
    g.player.energy = 5;
    setHand(g, ["aruvi"]);
    expect(playCard(g, "player", 0, 0, 0)).toBe(true);
    expect(g.player.energy).toBe(2);
    expect(g.player.hand).toHaveLength(0);
    expect(effectivePower(g, 0, "player", 0)).toBe(0);
    expect(takeBack(g, 0, 0)).toBe(true);
    expect(g.player.energy).toBe(5);
    expect(g.player.hand.map((c) => c.id)).toEqual(["aruvi"]);
    expect(new Set(allUids(g)).size).toBe(allUids(g).length);
  });

  it("skills resolve once, vanish, and lock their hero in", () => {
    const g = game();
    g.player.energy = 6;
    setHand(g, ["aruvi"]);
    playCard(g, "player", 0, 0, 1);
    settle(g);
    g.player.energy = 6;
    g.player.hand = g.player.hand.filter((c) => c.id === "aruvi-s1");
    const before = effectivePower(g, 0, "player", 1);
    // FLOW STATE: strongest card here +2
    expect(playCard(g, "player", 0, 0, 0)).toBe(true);
    expect(effectivePower(g, 0, "player", 1)).toBe(before);
    settle(g);
    expect(effectivePower(g, 0, "player", 1)).toBe(before + 2);
    expect(g.player.skillUsed).toContain("aruvi");
    expect(takeBack(g, 0, 1)).toBe(false);
    expect(moveCard(g, 0, 1, 1, 0)).toBe(false);
  });

  it("skills need a valid target", () => {
    const g = game();
    g.player.energy = 6;
    setHand(g, ["yuki-s1", "aruvi-s1"]);
    expect(canPlay(g, "player", 0, 0, 0)).toBe(false); // no enemy
    expect(canPlay(g, "player", 1, 0, 0)).toBe(false); // no ally
  });

  it("normal skills only work on their hero's carrier", () => {
    const g = game();
    g.player.energy = 6;
    setHand(g, ["aruvi", "kavin"]);
    playCard(g, "player", 0, 0, 0); // aruvi on carrier 0 -> adds aruvi-s1
    playCard(g, "player", 0, 1, 0); // kavin on carrier 1
    settle(g);
    g.player.energy = 6;
    const i = g.player.hand.findIndex((c) => c.id === "aruvi-s1");
    expect(canPlay(g, "player", i, 1, 0)).toBe(false);
    expect(canPlay(g, "player", i, 0, 0)).toBe(true);
  });

  it("ultimate skills work on any carrier", () => {
    const g = game();
    g.player.energy = 6;
    setHand(g, ["kavin", "aruvi-ult"]); // CHRONOBREAK not needed; aruvi ultimate buffAll
    playCard(g, "player", 0, 1, 0); // kavin on carrier 1, aruvi absent
    settle(g);
    g.player.energy = 6;
    const i = g.player.hand.findIndex((c) => c.id === "aruvi-ult");
    expect(canPlay(g, "player", i, 1, 0)).toBe(true);
  });

  it("rejects unaffordable plays and occupied slots", () => {
    const g = game();
    setHand(g, ["amara", "yuki"]);
    g.player.energy = 1;
    expect(playCard(g, "player", 0, 0, 0)).toBe(false);
    g.player.energy = 6;
    expect(playCard(g, "player", 1, 0, 0)).toBe(true);
    expect(canPlay(g, "player", 0, 0, 0)).toBe(false);
  });

  it("opening hand always has a playable hero", () => {
    for (let k = 1; k < 30; k++) {
      let x = k; const g = createGame({ player: DECK, rng: () => ((x = (x * 16807) % 2147483647) / 2147483647) });
      expect(g.player.hand.some((c) => canPlay(g, "player", g.player.hand.indexOf(c), 0, 0))).toBe(true);
    }
  });

  it("full match runs to a result with no duplicated cards", () => {
    const g = game();
    const rng = seeded();
    while (g.phase !== "over") {
      for (let i = 0; i < 8; i++) for (let c = 0; c < 3; c++) for (let s = 0; s < 3; s++) if (canPlay(g, "player", 0, c, s)) playCard(g, "player", 0, c, s);
      endPlayerTurn(g);
      opponentTurn(g, rng);
      beginReveal(g);
      while (revealNext(g)) {}
      nextTurn(g);
      expect(new Set(allUids(g)).size).toBe(allUids(g).length);
    }
    expect(g.turn).toBe(MAX_TURNS);
    expect(["win", "loss", "draw"]).toContain(result(g).outcome);
    for (let i = 0; i < 3; i++) expect(carrierScore(g, i, "player")).toBeGreaterThanOrEqual(0);
  });
});

describe("profile", () => {
  it("upgrades cost shards and stop at Apex", () => {
    let p = freshProfile();
    const s0 = p.shards;
    p = upgrade(p, "aruvi")!;
    expect(p.tiers.aruvi).toBe("ascend");
    p = upgrade(p, "aruvi")!;
    expect(p.tiers.aruvi).toBe("apex");
    expect(s0 - p.shards).toBe(3);
    expect(upgrade(p, "aruvi")).toBeNull();
    expect(upgrade({ ...p, shards: 0 }, "kavin")).toBeNull();
  });
  it("sanitizes corrupt storage and rewards wins", () => {
    expect(sanitize({ shards: -5, tiers: { aruvi: "godlike" }, deck: ["x"] })).toEqual(freshProfile());
    expect(reward(freshProfile(), "win").shards - freshProfile().shards).toBe(3);
  });
});

describe("deferred reveal", () => {
  it("skills arrive only at hero reveal and cannot be cast in its deployment round", () => {
    const g = game(); setHand(g, ["aruvi"]); g.player.energy = 6;
    playCard(g, "player", 0, 0, 0);
    expect(g.player.hand).toEqual([]);
    expect(carrierScore(g, 0, "player")).toBe(0);
    endPlayerTurn(g); beginReveal(g);
    expect(revealNext(g)?.card.id).toBe("aruvi");
    expect(g.player.hand.map((c) => c.id)).toEqual(["aruvi-s1"]);
    expect(canPlay(g, "player", 0, 0, 0)).toBe(false);
    nextTurn(g); g.player.energy = 6;
    expect(canPlay(g, "player", 0, 0, 0)).toBe(true);
  });
  it("reveals deployment order and follows repositioned cards", () => {
    const g = game(); setHand(g, ["kavin", "thamarai"]); g.player.energy = 6;
    playCard(g, "player", 0, 0, 0); playCard(g, "player", 0, 1, 0);
    moveCard(g, 0, 0, 2, 1);
    endPlayerTurn(g); beginReveal(g);
    expect(revealNext(g)).toMatchObject({ card: { id: "kavin" }, carrier: 2, slot: 1 });
    expect(revealNext(g)?.card.id).toBe("thamarai");
    expect(revealNext(g)).toBeNull();
    expect(g.carriers[2]?.player[1]?.revealed).toBe(true);
  });
  it("unrevealed hero auras never buff a revealed ally", () => {
    const g = game(); setHand(g, ["kavin"]); g.player.energy = 6;
    playCard(g, "player", 0, 0, 0); settle(g);
    const before = effectivePower(g, 0, "player", 0);
    setHand(g, ["amara"]); g.player.energy = 6; playCard(g, "player", 0, 0, 1);
    expect(effectivePower(g, 0, "player", 0)).toBe(before);
  });
});
