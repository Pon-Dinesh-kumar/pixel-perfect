/**
 * SCENE rules (pure, render-independent). Single source of truth for the match.
 *
 * Board: 3 carriers. On each carrier the PLAYER owns 3 slots on the LEFT half (slot 0 outer/rear,
 * slot 2 inner/front) and the RIVAL owns 3 slots on the RIGHT half (slot 0 inner/front, slot 2 outer/rear).
 *
 * Decks: each side brings exactly 8 unique heroes with a tier each (Base / Ascend / Apex).
 * Tier raises power (+0 / +1 / +2) and unlocks skills (1 / 2 / 3).
 *
 * Hero cards: hand -> empty own slot, spends cost. Playing a hero adds its unlocked skill cards to hand.
 * Skill cards: dropped on a carrier (any own slot of it), spend cost, resolve once and vanish.
 *   Skill effects are stored as a flat `mod` on the affected cards (or carrier `fortify`), so they
 *   are applied exactly once and never recomputed.
 * Take-back: a hero placed THIS turn returns to hand with an exact refund and its unused skill cards
 *   leave the hand. Blocked once any of that hero's skills has been used.
 * Move: a hero placed THIS turn may move to another empty own slot. No energy change.
 * End Turn locks player cards; then the rival plays random legal cards one by one.
 *
 * Power: effective = base + own passive + ally auras - enemy auras + skill mods, never below 0.
 * Passive conditions read BASE power / layout only, so there are no feedback loops.
 *
 * Winning: win 2 of 3 carriers (higher score). Tie on carriers -> higher total; else draw.
 */
import { HERO_BY_ID, HERO_IDS, isHeroId, type HeroId } from "./heroes";
import { SKILL_BY_ID, skillsOf, type SkillDef } from "./skills";
import { skillsUnlocked, type Tier } from "./tiers";

export const MAX_TURNS = 6;
export const MAX_ENERGY = 6;
export const HAND_SIZE = 4;
export const MAX_HAND = 7;
export const SLOTS = 3;
export const DECK_SIZE = 8;
export const CARRIERS = ["AERIAL", "COMMAND", "ASSAULT"] as const;
export const TIER_POWER: Record<Tier, number> = { base: 0, ascend: 1, apex: 2 };

export type Side = "player" | "opponent";
/** id is a HeroId or a skill id. */
export interface CardInst { uid: number; id: string }
export interface Placed extends CardInst { id: HeroId; locked: boolean; power: number; cost: number; mod: number; skillUids: number[] }
export type Slot = Placed | null;
export interface Carrier { name: string; player: Slot[]; opponent: Slot[]; fortify: Record<Side, number> }
export interface SideState { deck: CardInst[]; hand: CardInst[]; energy: number; tiers: Partial<Record<HeroId, Tier>>; skillUsed: HeroId[] }
export type Phase = "player" | "opponent" | "over";
export interface GameState { turn: number; phase: Phase; carriers: Carrier[]; player: SideState; opponent: SideState; nextUid: number }
export type Rng = () => number;
export interface DeckEntry { hero: HeroId; tier: Tier }

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!; a[i] = a[j]!; a[j] = t;
  }
  return a;
}

/** Energy starts at 2 (every hero costs 2+) and grows by 1 per turn, capped at MAX_ENERGY. */
export const energyForTurn = (turn: number) => Math.min(turn + 1, MAX_ENERGY);
export const other = (s: Side): Side => (s === "player" ? "opponent" : "player");
export const isSkill = (id: string) => !isHeroId(id) && id in SKILL_BY_ID;
export const heroPower = (hero: HeroId, tier: Tier) => HERO_BY_ID[hero].power + TIER_POWER[tier];
export const cardCost = (id: string) => (isHeroId(id) ? HERO_BY_ID[id].cost : SKILL_BY_ID[id]!.cost);
/** Skill cards a hero brings at a tier. */
export const unlockedSkills = (hero: HeroId, tier: Tier): SkillDef[] => skillsOf(hero).slice(0, skillsUnlocked(tier));

export function validDeck(deck: DeckEntry[]): boolean {
  return deck.length === DECK_SIZE && new Set(deck.map((d) => d.hero)).size === DECK_SIZE && deck.every((d) => isHeroId(d.hero));
}

/** Random rival deck: 8 unique heroes, mixed tiers. */
export function randomDeck(rng: Rng): DeckEntry[] {
  const tiers: Tier[] = ["base", "base", "ascend", "ascend", "apex"];
  return shuffle(HERO_IDS, rng).slice(0, DECK_SIZE).map((hero) => ({ hero, tier: tiers[Math.floor(rng() * tiers.length)]! }));
}

function heroesInHand(s: SideState) { return s.hand.filter((c) => isHeroId(c.id)).length; }
function draw(s: SideState) {
  while (heroesInHand(s) < HAND_SIZE && s.hand.length < MAX_HAND && s.deck.length) s.hand.push(s.deck.shift()!);
}

export function createGame(opts: { player?: DeckEntry[]; opponent?: DeckEntry[]; rng?: Rng } = {}): GameState {
  const rng = opts.rng ?? Math.random;
  const pd = opts.player && validDeck(opts.player) ? opts.player : randomDeck(rng);
  const od = opts.opponent && validDeck(opts.opponent) ? opts.opponent : randomDeck(rng);
  let uid = 1;
  const order = (d: DeckEntry[]) => {
    const a = shuffle(d, rng);
    // guarantee a turn-1 play: a hero costing <= 2 in the opening hand
    if (!a.slice(0, HAND_SIZE).some((e) => HERO_BY_ID[e.hero].cost <= energyForTurn(1))) {
      const i = a.findIndex((e) => HERO_BY_ID[e.hero].cost <= energyForTurn(1));
      if (i >= 0) { const t = a[0]!; a[0] = a[i]!; a[i] = t; }
    }
    return a;
  };
  const mk = (d: DeckEntry[]): SideState => ({
    deck: order(d).map((e) => ({ uid: uid++, id: e.hero })),
    hand: [], energy: energyForTurn(1), skillUsed: [],
    tiers: Object.fromEntries(d.map((e) => [e.hero, e.tier])),
  });
  const g: GameState = {
    turn: 1, phase: "player",
    carriers: CARRIERS.map((name) => ({ name, player: Array(SLOTS).fill(null), opponent: Array(SLOTS).fill(null), fortify: { player: 0, opponent: 0 } })),
    player: mk(pd), opponent: mk(od), nextUid: 0,
  };
  g.nextUid = uid;
  draw(g.player);
  draw(g.opponent);
  return g;
}

export const tierOf = (g: GameState, side: Side, hero: HeroId): Tier => g[side].tiers[hero] ?? "base";

// ---------- passives & scoring ----------
const list = (c: Carrier, side: Side) => c[side].filter((p): p is Placed => !!p);
const baseSum = (c: Carrier, side: Side) => list(c, side).reduce((s, p) => s + p.power, 0);
const isFront = (side: Side, slot: number) => (side === "player" ? slot === SLOTS - 1 : slot === 0);
const isRear = (side: Side, slot: number) => (side === "player" ? slot === 0 : slot === SLOTS - 1);

/** Bonus from the card's own passive (0 if its condition is not met). */
export function selfBonus(g: GameState, ci: number, side: Side, slot: number): number {
  const c = g.carriers[ci]!;
  const p = c[side][slot];
  if (!p) return 0;
  const pas = HERO_BY_ID[p.id].passive;
  const n = pas.amount;
  const mine = list(c, side).length, theirs = list(c, other(side)).length;
  switch (pas.kind) {
    case "sentinel": return baseSum(c, other(side)) > baseSum(c, side) ? n : 0;
    case "momentum": return mine > 1 ? n : 0;
    case "lonewolf": return mine === 1 ? n : 0;
    case "center": return slot === 1 ? n : 0;
    case "rear": return isRear(side, slot) ? n : 0;
    case "front": return isFront(side, slot) ? n : 0;
    case "lateTide": return g.turn >= 4 ? n : 0;
    case "pack": return mine === 3 ? n : 0;
    case "overclock": return c[side].some((q, i) => q && i !== slot && q.cost >= 4) ? n : 0;
    case "outnumbered": return theirs > mine ? n : 0;
    case "contested": return theirs > 0 ? n : 0;
    case "shoreline": return theirs === 0 ? n : 0;
    case "resonance": return (mine - 1) * n;
    case "lane": return ci === (pas.param ?? -1) ? n : 0;
    case "tailwind": return !!c[side][slot - 1] || !!c[side][slot + 1] ? n : 0;
    default: return 0;
  }
}

/** Bonus a card gets from friendly aura passives (rally, nurture). */
export function allyAura(c: Carrier, side: Side, slot: number): number {
  const p = c[side][slot];
  if (!p) return 0;
  let b = 0;
  c[side].forEach((q, i) => {
    if (!q || i === slot) return;
    const pas = HERO_BY_ID[q.id].passive;
    if (pas.kind === "rally") b += pas.amount;
    if (pas.kind === "nurture" && p.cost <= 2) b += pas.amount;
  });
  return b;
}

/** Index of the strongest (base power) card on a side; ties -> lowest slot. */
function strongestBase(c: Carrier, side: Side): number {
  let best = -1;
  c[side].forEach((q, i) => { if (q && (best < 0 || q.power > c[side][best]!.power)) best = i; });
  return best;
}

/** Penalty a card takes from enemy aura passives (disruptor, crusher, mirage). */
export function debuff(c: Carrier, side: Side, slot: number): number {
  const p = c[side][slot];
  if (!p) return 0;
  let d = 0;
  for (const q of c[other(side)]) {
    if (!q) continue;
    const pas = HERO_BY_ID[q.id].passive;
    if (pas.kind === "disruptor") d += pas.amount;
    if (pas.kind === "crusher" && p.cost <= 2) d += pas.amount;
    if (pas.kind === "mirage" && strongestBase(c, side) === slot) d += pas.amount;
  }
  return d;
}

export function effectivePower(g: GameState, ci: number, side: Side, slot: number): number {
  const c = g.carriers[ci]!;
  const p = c[side][slot];
  if (!p) return 0;
  return Math.max(0, p.power + selfBonus(g, ci, side, slot) + allyAura(c, side, slot) - debuff(c, side, slot) + p.mod);
}

export function carrierScore(g: GameState, ci: number, side: Side): number {
  let s = g.carriers[ci]!.fortify[side];
  for (let i = 0; i < SLOTS; i++) s += effectivePower(g, ci, side, i);
  return s;
}

// ---------- actions (validate, then commit) ----------
const inRange = (carrier: number, slot: number) => carrier >= 0 && carrier < 3 && slot >= 0 && slot < SLOTS;

/** Why a skill cannot be cast on a carrier, or null if it can. Ignores energy/phase. */
export function skillBlock(g: GameState, side: Side, skillId: string, ci: number): string | null {
  const sk = SKILL_BY_ID[skillId];
  const c = g.carriers[ci];
  if (!sk || !c) return "INVALID";
  const mine = list(c, side), theirs = list(c, other(side));
  // normal skills only on their hero's carrier; ultimates on any carrier
  if (!sk.ultimate && !mine.some((p) => p.id === sk.hero)) return `ONLY ON ${HERO_BY_ID[sk.hero].name}'S CARRIER`;
  switch (sk.effect) {
    case "buffOne": case "buffAll": case "fortify": return mine.length ? null : "NEED A HERO HERE";
    case "buffHero": return mine.some((p) => p.id === sk.hero) ? null : `${HERO_BY_ID[sk.hero].name} MUST BE HERE`;
    case "debuffTop": case "debuffAll": return theirs.length ? null : "NO ENEMY HERE";
  }
}

export function canPlay(g: GameState, side: Side, handIndex: number, carrier: number, slot: number): boolean {
  if (g.phase !== side || !inRange(carrier, slot)) return false;
  const card = g[side].hand[handIndex];
  if (!card || cardCost(card.id) > g[side].energy) return false;
  if (isSkill(card.id)) return skillBlock(g, side, card.id, carrier) === null;
  return g.carriers[carrier]![side][slot] === null;
}

function strongestEff(g: GameState, ci: number, side: Side): number {
  let best = -1, bp = -1;
  for (let i = 0; i < SLOTS; i++) {
    if (!g.carriers[ci]![side][i]) continue;
    const e = effectivePower(g, ci, side, i);
    if (e > bp) { bp = e; best = i; }
  }
  return best;
}

function resolveSkill(g: GameState, side: Side, sk: SkillDef, ci: number) {
  const c = g.carriers[ci]!;
  const foe = other(side);
  switch (sk.effect) {
    case "buffOne": c[side][strongestEff(g, ci, side)]!.mod += sk.amount; break;
    case "buffAll": for (const p of list(c, side)) p.mod += sk.amount; break;
    case "buffHero": for (const p of list(c, side)) if (p.id === sk.hero) p.mod += sk.amount; break;
    case "debuffTop": c[foe][strongestEff(g, ci, foe)]!.mod -= sk.amount; break;
    case "debuffAll": for (const p of list(c, foe)) p.mod -= sk.amount; break;
    case "fortify": c.fortify[side] += sk.amount; break;
  }
}

export function playCard(g: GameState, side: Side, handIndex: number, carrier: number, slot: number): boolean {
  if (!canPlay(g, side, handIndex, carrier, slot)) return false;
  const s = g[side];
  const [card] = s.hand.splice(handIndex, 1);
  s.energy -= cardCost(card!.id);
  if (isSkill(card!.id)) {
    const sk = SKILL_BY_ID[card!.id]!;
    resolveSkill(g, side, sk, carrier);
    if (!s.skillUsed.includes(sk.hero)) s.skillUsed.push(sk.hero);
    return true;
  }
  const hero = card!.id as HeroId;
  const tier = tierOf(g, side, hero);
  const skills = unlockedSkills(hero, tier).map((k) => ({ uid: g.nextUid++, id: k.id }));
  s.hand.push(...skills);
  g.carriers[carrier]![side][slot] = {
    uid: card!.uid, id: hero, locked: side === "opponent", power: heroPower(hero, tier), cost: HERO_BY_ID[hero].cost, mod: 0,
    skillUids: skills.map((k) => k.uid),
  };
  return true;
}

export function canTakeBack(g: GameState, carrier: number, slot: number): boolean {
  if (g.phase !== "player" || !inRange(carrier, slot)) return false;
  const p = g.carriers[carrier]!.player[slot];
  return !!p && !p.locked && !g.player.skillUsed.includes(p.id);
}

export function canMove(g: GameState, carrier: number, slot: number): boolean {
  if (g.phase !== "player" || !inRange(carrier, slot)) return false;
  const p = g.carriers[carrier]!.player[slot];
  return !!p && !p.locked;
}

/** Player returns an unlocked hero to hand: exact refund, its unused skill cards leave the hand. */
export function takeBack(g: GameState, carrier: number, slot: number): boolean {
  if (!canTakeBack(g, carrier, slot)) return false;
  const p = g.carriers[carrier]!.player[slot]!;
  g.carriers[carrier]!.player[slot] = null;
  g.player.hand = g.player.hand.filter((c) => !p.skillUids.includes(c.uid));
  g.player.hand.push({ uid: p.uid, id: p.id });
  g.player.energy += p.cost;
  return true;
}

/** Player repositions an unlocked hero to another empty own slot. No energy change. */
export function moveCard(g: GameState, fromC: number, fromS: number, toC: number, toS: number): boolean {
  if (!canMove(g, fromC, fromS) || !inRange(toC, toS)) return false;
  if (g.carriers[toC]!.player[toS] !== null) return false;
  g.carriers[toC]!.player[toS] = g.carriers[fromC]!.player[fromS]!;
  g.carriers[fromC]!.player[fromS] = null;
  return true;
}

/** Locks the player's cards and hands the turn to the rival. */
export function endPlayerTurn(g: GameState): boolean {
  if (g.phase !== "player") return false;
  for (const c of g.carriers) for (const p of c.player) if (p) p.locked = true;
  g.phase = "opponent";
  return true;
}

export interface OpponentMove { carrier: number; slot: number; card: CardInst; skill: boolean }

/** Rival plays one random legal card, or returns null when none is possible. */
export function opponentPlayOne(g: GameState, rng: Rng = Math.random): OpponentMove | null {
  if (g.phase !== "opponent") return null;
  const legal: { h: number; c: number; s: number }[] = [];
  g.opponent.hand.forEach((card, h) =>
    g.carriers.forEach((_, c) => {
      if (isSkill(card.id)) { if (canPlay(g, "opponent", h, c, 0)) legal.push({ h, c, s: 0 }); return; }
      for (let s = 0; s < SLOTS; s++) if (canPlay(g, "opponent", h, c, s)) legal.push({ h, c, s });
    }),
  );
  if (!legal.length) return null;
  const m = legal[Math.floor(rng() * legal.length)]!;
  const card = g.opponent.hand[m.h]!;
  playCard(g, "opponent", m.h, m.c, m.s);
  return { carrier: m.c, slot: m.s, card, skill: isSkill(card.id) };
}

export function opponentTurn(g: GameState, rng: Rng = Math.random): OpponentMove[] {
  const moves: OpponentMove[] = [];
  for (let m = opponentPlayOne(g, rng); m; m = opponentPlayOne(g, rng)) moves.push(m);
  return moves;
}

/** After the rival acts: next turn (or match over). */
export function nextTurn(g: GameState) {
  if (g.turn >= MAX_TURNS) { g.phase = "over"; return; }
  g.turn += 1;
  g.phase = "player";
  for (const s of [g.player, g.opponent]) { s.energy = energyForTurn(g.turn); draw(s); }
}

export type Outcome = "win" | "loss" | "draw";
export function result(g: GameState): { outcome: Outcome; won: number; lost: number } {
  let won = 0, lost = 0, pt = 0, ot = 0;
  g.carriers.forEach((_, i) => {
    const p = carrierScore(g, i, "player"), o = carrierScore(g, i, "opponent");
    pt += p; ot += o;
    if (p > o) won++; else if (o > p) lost++;
  });
  const outcome: Outcome = won > lost ? "win" : lost > won ? "loss" : pt > ot ? "win" : ot > pt ? "loss" : "draw";
  return { outcome, won, lost };
}

/** Every card instance in play — used to assert no duplication. */
export function allUids(g: GameState): number[] {
  const out: number[] = [];
  for (const s of [g.player, g.opponent]) out.push(...s.deck.map((c) => c.uid), ...s.hand.map((c) => c.uid));
  for (const c of g.carriers) for (const side of ["player", "opponent"] as Side[]) for (const p of c[side]) if (p) out.push(p.uid);
  return out;
}
