/**
 * SCENE rules (pure, render-independent). Single source of truth for the match.
 *
 * Board: 3 carriers. On each carrier the PLAYER owns 3 slots on the LEFT half and
 * the RIVAL owns 3 slots on the RIGHT half.
 *
 * Turns: match lasts MAX_TURNS. Energy each turn = min(turn, MAX_ENERGY); unspent energy is lost.
 * Hand refills to HAND_SIZE at the start of every turn.
 *
 * Player actions during their own turn (phase "player"):
 *  - play: hand -> empty own slot, spends cost.
 *  - takeBack: card placed THIS turn -> hand, refunds exact cost.
 *  - move: card placed THIS turn -> another empty own slot, no energy change.
 * End Turn locks every player card, then the rival plays random legal cards.
 *
 * Power: effective power = base + own passive bonus - enemy disruptors, never below 0.
 * Passive conditions read BASE power only, so there are no feedback loops and nothing accumulates.
 *
 * Winning: win 2 of 3 carriers (higher effective total). Tie on carriers -> higher total power; else draw.
 */
import { CARDS, DECK_LIST, type CardId } from "./cards";

export const MAX_TURNS = 6;
export const MAX_ENERGY = 6;
export const HAND_SIZE = 4;
export const SLOTS = 3;
export const CARRIERS = ["AERIAL", "COMMAND", "ASSAULT"] as const;

export type Side = "player" | "opponent";
export interface CardInst { uid: number; id: CardId }
export interface Placed extends CardInst { locked: boolean }
export type Slot = Placed | null;
export interface Carrier { name: string; player: Slot[]; opponent: Slot[] }
export interface SideState { deck: CardInst[]; hand: CardInst[]; energy: number }
export type Phase = "player" | "opponent" | "over";
export interface GameState {
  turn: number;
  phase: Phase;
  carriers: Carrier[];
  player: SideState;
  opponent: SideState;
}
export type Rng = () => number;

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!; a[i] = a[j]!; a[j] = t;
  }
  return a;
}

export const energyForTurn = (turn: number) => Math.min(turn, MAX_ENERGY);
export const other = (s: Side): Side => (s === "player" ? "opponent" : "player");

function draw(s: SideState) {
  while (s.hand.length < HAND_SIZE && s.deck.length) s.hand.push(s.deck.shift()!);
}

export function createGame(rng: Rng = Math.random): GameState {
  let uid = 1;
  const mk = (): SideState => ({ deck: shuffle(DECK_LIST, rng).map((id) => ({ uid: uid++, id })), hand: [], energy: energyForTurn(1) });
  const g: GameState = {
    turn: 1,
    phase: "player",
    carriers: CARRIERS.map((name) => ({ name, player: Array(SLOTS).fill(null), opponent: Array(SLOTS).fill(null) })),
    player: mk(),
    opponent: mk(),
  };
  draw(g.player);
  draw(g.opponent);
  return g;
}

// ---------- passives & scoring ----------
const baseSum = (c: Carrier, side: Side) => c[side].reduce((s, p) => s + (p ? CARDS[p.id].power : 0), 0);
const count = (c: Carrier, side: Side) => c[side].filter(Boolean).length;

/** Bonus from the card's own passive (0 if its condition is not met). */
export function selfBonus(c: Carrier, side: Side, slot: number): number {
  const p = c[side][slot];
  if (!p) return 0;
  const pas = CARDS[p.id].passive;
  switch (pas.kind) {
    case "sentinel": return baseSum(c, other(side)) > baseSum(c, side) ? pas.amount : 0;
    case "momentum": return count(c, side) > 1 ? pas.amount : 0;
    case "lonewolf": return count(c, side) === 1 ? pas.amount : 0;
    default: return 0;
  }
}

/** Total debuff applied to `side` by enemy disruptors on this carrier. */
export function debuff(c: Carrier, side: Side): number {
  return c[other(side)].reduce((s, p) => s + (p && CARDS[p.id].passive.kind === "disruptor" ? CARDS[p.id].passive.amount : 0), 0);
}

export function effectivePower(c: Carrier, side: Side, slot: number): number {
  const p = c[side][slot];
  if (!p) return 0;
  return Math.max(0, CARDS[p.id].power + selfBonus(c, side, slot) - debuff(c, side));
}

export function carrierScore(c: Carrier, side: Side): number {
  let s = 0;
  for (let i = 0; i < SLOTS; i++) s += effectivePower(c, side, i);
  return s;
}

// ---------- actions (validate, then commit) ----------
const inRange = (carrier: number, slot: number) => carrier >= 0 && carrier < 3 && slot >= 0 && slot < SLOTS;

export function canPlay(g: GameState, side: Side, handIndex: number, carrier: number, slot: number): boolean {
  if (g.phase !== side || !inRange(carrier, slot)) return false;
  const card = g[side].hand[handIndex];
  if (!card || CARDS[card.id].cost > g[side].energy) return false;
  return g.carriers[carrier]![side][slot] === null;
}

export function playCard(g: GameState, side: Side, handIndex: number, carrier: number, slot: number): boolean {
  if (!canPlay(g, side, handIndex, carrier, slot)) return false;
  const [card] = g[side].hand.splice(handIndex, 1);
  g[side].energy -= CARDS[card!.id].cost;
  g.carriers[carrier]![side][slot] = { ...card!, locked: side === "opponent" };
  return true;
}

export function canTakeBack(g: GameState, carrier: number, slot: number): boolean {
  if (g.phase !== "player" || !inRange(carrier, slot)) return false;
  const p = g.carriers[carrier]![ "player"][slot];
  return !!p && !p.locked;
}

/** Player returns an unlocked card to hand and is refunded its exact cost. */
export function takeBack(g: GameState, carrier: number, slot: number): boolean {
  if (!canTakeBack(g, carrier, slot)) return false;
  const p = g.carriers[carrier]!.player[slot]!;
  g.carriers[carrier]!.player[slot] = null;
  g.player.hand.push({ uid: p.uid, id: p.id });
  g.player.energy += CARDS[p.id].cost;
  return true;
}

/** Player repositions an unlocked card to another empty own slot. No energy change. */
export function moveCard(g: GameState, fromC: number, fromS: number, toC: number, toS: number): boolean {
  if (!canTakeBack(g, fromC, fromS) || !inRange(toC, toS)) return false;
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

export interface OpponentMove { carrier: number; slot: number; card: CardInst }

/** Rival plays one random legal card, or returns null when none is possible. */
export function opponentPlayOne(g: GameState, rng: Rng = Math.random): OpponentMove | null {
  if (g.phase !== "opponent") return null;
  const legal: { h: number; c: number; s: number }[] = [];
  g.opponent.hand.forEach((_, h) =>
    g.carriers.forEach((_, c) => {
      for (let s = 0; s < SLOTS; s++) if (canPlay(g, "opponent", h, c, s)) legal.push({ h, c, s });
    }),
  );
  if (!legal.length) return null;
  const m = legal[Math.floor(rng() * legal.length)]!;
  const card = g.opponent.hand[m.h]!;
  playCard(g, "opponent", m.h, m.c, m.s);
  return { carrier: m.c, slot: m.s, card };
}

/** Rival plays random legal cards until none remain. */
export function opponentTurn(g: GameState, rng: Rng = Math.random): OpponentMove[] {
  const moves: OpponentMove[] = [];
  for (let m = opponentPlayOne(g, rng); m; m = opponentPlayOne(g, rng)) moves.push(m);
  return moves;
}

/** After the rival acts: next turn (or match over). */
export function nextTurn(g: GameState) {
  if (g.turn >= MAX_TURNS) {
    g.phase = "over";
    return;
  }
  g.turn += 1;
  g.phase = "player";
  for (const s of [g.player, g.opponent]) {
    s.energy = energyForTurn(g.turn);
    draw(s);
  }
}

export type Outcome = "win" | "loss" | "draw";
export function result(g: GameState): { outcome: Outcome; won: number; lost: number } {
  let won = 0, lost = 0, pt = 0, ot = 0;
  for (const c of g.carriers) {
    const p = carrierScore(c, "player"), o = carrierScore(c, "opponent");
    pt += p; ot += o;
    if (p > o) won++; else if (o > p) lost++;
  }
  const outcome: Outcome = won > lost ? "win" : lost > won ? "loss" : pt > ot ? "win" : ot > pt ? "loss" : "draw";
  return { outcome, won, lost };
}

/** Count every card instance in play — used to assert no duplication. */
export function allUids(g: GameState): number[] {
  const out: number[] = [];
  for (const s of [g.player, g.opponent]) out.push(...s.deck.map((c) => c.uid), ...s.hand.map((c) => c.uid));
  for (const c of g.carriers) for (const side of ["player", "opponent"] as Side[]) for (const p of c[side]) if (p) out.push(p.uid);
  return out;
}
