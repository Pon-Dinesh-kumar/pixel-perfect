/** Saved player progress (browser storage). Pure helpers + a tiny store. */
import { HERO_IDS, isHeroId, type HeroId } from "./heroes";
import { DECK_SIZE, type DeckEntry } from "./rules";
import { isTier, nextTier, START_SHARDS, UPGRADE_COST, type Tier } from "./tiers";

export interface Profile { shards: number; tiers: Record<HeroId, Tier>; deck: HeroId[] }
export const STORAGE_KEY = "scene.profile.v1";
export const DEFAULT_DECK: HeroId[] = ["aruvi", "kavin", "meenal", "senthil", "thamarai", "yuki", "amara", "kofi"];
export const WIN_SHARDS = 3, DRAW_SHARDS = 1;

export function freshProfile(): Profile {
  return { shards: START_SHARDS, tiers: Object.fromEntries(HERO_IDS.map((h) => [h, "base"])) as Record<HeroId, Tier>, deck: [...DEFAULT_DECK] };
}

export const isValidDeck = (deck: HeroId[]) => deck.length === DECK_SIZE && new Set(deck).size === DECK_SIZE && deck.every(isHeroId);

/** Accepts anything (corrupt/old storage) and returns a valid profile. */
export function sanitize(raw: unknown): Profile {
  const p = freshProfile();
  if (!raw || typeof raw !== "object") return p;
  const r = raw as Partial<Record<keyof Profile, unknown>>;
  if (typeof r.shards === "number" && Number.isFinite(r.shards) && r.shards >= 0) p.shards = Math.floor(r.shards);
  if (r.tiers && typeof r.tiers === "object") for (const h of HERO_IDS) { const t = (r.tiers as Record<string, unknown>)[h]; if (isTier(t)) p.tiers[h] = t; }
  if (Array.isArray(r.deck) && isValidDeck(r.deck as HeroId[])) p.deck = [...(r.deck as HeroId[])];
  return p;
}

export function upgradeCost(p: Profile, hero: HeroId): number | null {
  const n = nextTier(p.tiers[hero]);
  return n ? UPGRADE_COST[n as Exclude<Tier, "base">] : null;
}

/** Returns a new profile with the hero upgraded, or null if maxed / unaffordable. */
export function upgrade(p: Profile, hero: HeroId): Profile | null {
  const n = nextTier(p.tiers[hero]);
  const cost = upgradeCost(p, hero);
  if (!n || cost === null || p.shards < cost) return null;
  return { ...p, shards: p.shards - cost, tiers: { ...p.tiers, [hero]: n } };
}

export function setDeck(p: Profile, deck: HeroId[]): Profile | null {
  return isValidDeck(deck) ? { ...p, deck: [...deck] } : null;
}

export const deckEntries = (p: Profile): DeckEntry[] => p.deck.map((hero) => ({ hero, tier: p.tiers[hero] }));

export function reward(p: Profile, outcome: "win" | "loss" | "draw"): Profile {
  return { ...p, shards: p.shards + (outcome === "win" ? WIN_SHARDS : outcome === "draw" ? DRAW_SHARDS : 0) };
}

// ---------- store ----------
let current: Profile | null = null;
const subs = new Set<() => void>();

export function loadProfile(): Profile {
  if (current) return current;
  try { current = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")); } catch { current = freshProfile(); }
  return current;
}
export function saveProfile(p: Profile) {
  current = p;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* storage full/blocked */ }
  subs.forEach((f) => f());
}
export function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
