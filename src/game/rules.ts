/**
 * SCENE rules (pure, render-independent).
 * - 3 carriers, each with 3 slots per side.
 * - Match lasts MAX_TURNS turns. Energy each turn = min(turn, MAX_ENERGY); unspent energy is lost.
 * - Hand holds HAND_SIZE cards; it refills from the deck at the start of every turn.
 * - Carrier score = sum of card power on that side. Higher score wins the carrier.
 * - Win 2 of 3 carriers to win. If carriers are tied, the higher total power wins; else draw.
 * - After the player ends the turn, the opponent plays random legal cards until it cannot.
 */
import { CARDS, DECK_LIST, type CardId } from "./cards";

export const MAX_TURNS = 6;
export const MAX_ENERGY = 6;
export const HAND_SIZE = 4;
export const SLOTS = 3;
export const CARRIERS = ["AERIAL LANE", "COMMAND LANE", "ASSAULT LANE"] as const;

export type Side = "player" | "opponent";
export type Slot = CardId | null;
export interface Carrier { name: string; player: Slot[]; opponent: Slot[] }
export interface SideState { deck: CardId[]; hand: CardId[]; energy: number }
export interface GameState {
  turn: number;
  carriers: Carrier[];
  player: SideState;
  opponent: SideState;
  over: boolean;
}
export type Rng = () => number;

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const energyForTurn = (turn: number) => Math.min(turn, MAX_ENERGY);

function draw(s: SideState) {
  while (s.hand.length < HAND_SIZE && s.deck.length) s.hand.push(s.deck.shift()!);
}

export function createGame(rng: Rng = Math.random): GameState {
  const mk = (): SideState => ({ deck: shuffle(DECK_LIST, rng), hand: [], energy: energyForTurn(1) });
  const g: GameState = {
    turn: 1,
    carriers: CARRIERS.map((name) => ({ name, player: Array(SLOTS).fill(null), opponent: Array(SLOTS).fill(null) })),
    player: mk(),
    opponent: mk(),
    over: false,
  };
  draw(g.player);
  draw(g.opponent);
  return g;
}

export function canPlay(g: GameState, side: Side, handIndex: number, carrier: number, slot: number): boolean {
  if (g.over) return false;
  const card = g[side].hand[handIndex];
  if (!card) return false;
  if (CARDS[card].cost > g[side].energy) return false;
  return g.carriers[carrier]?.[side][slot] === null;
}

export function playCard(g: GameState, side: Side, handIndex: number, carrier: number, slot: number): boolean {
  if (!canPlay(g, side, handIndex, carrier, slot)) return false;
  const [card] = g[side].hand.splice(handIndex, 1);
  g[side].energy -= CARDS[card].cost;
  g.carriers[carrier][side][slot] = card;
  return true;
}

export function carrierScore(c: Carrier, side: Side): number {
  return c[side].reduce((s, id) => s + (id ? CARDS[id].power : 0), 0);
}

export interface OpponentMove { handIndex: number; carrier: number; slot: number; card: CardId }

/** Plays random legal opponent cards until none remain. Returns moves made. */
export function opponentTurn(g: GameState, rng: Rng = Math.random): OpponentMove[] {
  const moves: OpponentMove[] = [];
  for (;;) {
    const legal: Omit<OpponentMove, "card">[] = [];
    g.opponent.hand.forEach((_, h) =>
      g.carriers.forEach((_, c) => {
        for (let s = 0; s < SLOTS; s++) if (canPlay(g, "opponent", h, c, s)) legal.push({ handIndex: h, carrier: c, slot: s });
      }),
    );
    if (!legal.length) return moves;
    const m = legal[Math.floor(rng() * legal.length)];
    const card = g.opponent.hand[m.handIndex];
    playCard(g, "opponent", m.handIndex, m.carrier, m.slot);
    moves.push({ ...m, card });
  }
}

/** Advances to the next turn (or ends the match). */
export function nextTurn(g: GameState) {
  if (g.turn >= MAX_TURNS) {
    g.over = true;
    return;
  }
  g.turn += 1;
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
