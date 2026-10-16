export type CardId = "vanguard" | "riftdancer" | "skyguard" | "aurora";

/** Passive effect types. All are evaluated fresh from board state; base power is never mutated. */
export type PassiveKind =
  | "sentinel"   // +N while the rival has more base power on this carrier than you
  | "momentum"   // +N if another friendly card is on this carrier
  | "lonewolf"   // +N if this is your only card on this carrier
  | "disruptor"; // each enemy card on this carrier gets -N (min 0)

export interface Passive {
  kind: PassiveKind;
  name: string;
  /** One short sentence shown on the card. */
  text: string;
  /** Plain-language trigger, for tooltips/docs. */
  trigger: string;
  amount: number;
}

export interface CardDef {
  id: CardId;
  name: string;
  cost: number;
  power: number;
  color: number;
  glow: number;
  passive: Passive;
}

export const CARDS: Record<CardId, CardDef> = {
  vanguard: {
    id: "vanguard", name: "VANGUARD", cost: 1, power: 1, color: 0xc8243a, glow: 0xff4a5e,
    passive: { kind: "sentinel", name: "SENTINEL", text: "+3 while losing here", trigger: "Rival base power on this carrier is higher than yours", amount: 3 },
  },
  riftdancer: {
    id: "riftdancer", name: "RIFT DANCER", cost: 2, power: 2, color: 0x2a5bd7, glow: 0x5fd4ff,
    passive: { kind: "momentum", name: "MOMENTUM", text: "+2 with an ally here", trigger: "Another friendly card is on this carrier", amount: 2 },
  },
  skyguard: {
    id: "skyguard", name: "SKYGUARD", cost: 3, power: 4, color: 0xd9a21b, glow: 0xffd75a,
    passive: { kind: "lonewolf", name: "LONE WING", text: "+3 if alone here", trigger: "No other friendly card is on this carrier", amount: 3 },
  },
  aurora: {
    id: "aurora", name: "AURORA", cost: 4, power: 5, color: 0xc0287f, glow: 0xff6ad0,
    passive: { kind: "disruptor", name: "DISRUPTOR", text: "Enemies here -1", trigger: "Always, for enemy cards on this carrier", amount: 1 },
  },
};

export const DECK_LIST: CardId[] = [
  "vanguard", "vanguard", "vanguard",
  "riftdancer", "riftdancer", "riftdancer",
  "skyguard", "skyguard", "skyguard",
  "aurora", "aurora", "aurora",
];
