import { describe, expect, it } from "vitest";
import {
  allUids, canPlay, carrierScore, createGame, effectivePower, endPlayerTurn, energyForTurn, moveCard, nextTurn,
  opponentTurn, playCard, result, takeBack, unlockedSkills, validDeck, heroPower, MAX_TURNS, type DeckEntry, type GameState,
} from "./rules";
import { HEROES } from "./heroes";
import { SKILLS } from "./skills";
import { freshProfile, isValidDeck, reward, sanitize, upgrade } from "./profile";

const seeded = () => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const DECK: DeckEntry[] = ["aruvi", "kavin", "meenal", "senthil", "thamarai", "yuki", "amara", "kofi"].map((hero) => ({ hero, tier: "base" })) as DeckEntry[];
const setHand = (g: GameState, ids: string[]) => { g.player.hand = ids.map((id, i) => ({ uid: 900 + i, id })); };
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

  it("playing a hero adds its unlocked skills; take back removes them and refunds exactly", () => {
    const g = game([{ hero: "aruvi", tier: "ascend" }, ...DECK.slice(1)]);
    g.player.energy = 5;
    setHand(g, ["aruvi"]);
    expect(playCard(g, "player", 0, 0, 0)).toBe(true);
    expect(g.player.energy).toBe(2);
    expect(g.player.hand.map((c) => c.id)).toEqual(["aruvi-s1", "aruvi-s2"]);
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
    const before = effectivePower(g, 0, "player", 1);
    // FLOW STATE: strongest card here +2
    expect(playCard(g, "player", 0, 0, 0)).toBe(true);
    expect(effectivePower(g, 0, "player", 1)).toBe(before + 2);
    expect(g.player.hand).toHaveLength(0);
    expect(g.player.energy).toBe(6 - 3 - 2);
    expect(takeBack(g, 0, 1)).toBe(false);
    expect(moveCard(g, 0, 1, 1, 0)).toBe(true);
    expect(effectivePower(g, 1, "player", 0)).toBe(before + 2);
  });

  it("skills need a valid target", () => {
    const g = game();
    g.player.energy = 6;
    setHand(g, ["yuki-s1", "aruvi-s1"]);
    expect(canPlay(g, "player", 0, 0, 0)).toBe(false); // no enemy
    expect(canPlay(g, "player", 1, 0, 0)).toBe(false); // no ally
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
