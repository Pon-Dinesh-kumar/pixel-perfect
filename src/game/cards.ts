export type CardId = "vanguard" | "riftdancer" | "skyguard" | "aurora";

export interface CardDef {
  id: CardId;
  name: string;
  cost: number;
  power: number;
  /** Hex colors for frame tint (rendering only). */
  color: number;
  glow: number;
  icon: "shield" | "blade" | "wing" | "star";
}

export const CARDS: Record<CardId, CardDef> = {
  vanguard: { id: "vanguard", name: "VANGUARD", cost: 1, power: 2, color: 0xc8243a, glow: 0xff4a5e, icon: "shield" },
  riftdancer: { id: "riftdancer", name: "RIFT DANCER", cost: 2, power: 3, color: 0x2a5bd7, glow: 0x5fd4ff, icon: "blade" },
  skyguard: { id: "skyguard", name: "SKYGUARD", cost: 3, power: 5, color: 0xd9a21b, glow: 0xffd75a, icon: "wing" },
  aurora: { id: "aurora", name: "AURORA", cost: 4, power: 7, color: 0xc0287f, glow: 0xff6ad0, icon: "star" },
};

export const DECK_LIST: CardId[] = [
  "vanguard", "vanguard", "vanguard",
  "riftdancer", "riftdancer", "riftdancer",
  "skyguard", "skyguard", "skyguard",
  "aurora", "aurora", "aurora",
];
