/**
 * Skill cards: 3 per hero (s1 at Base, s2 at Ascend, ultimate at Apex).
 * A skill is a one-use action dropped on a carrier; it resolves once and vanishes.
 */
import { HERO_BY_ID, HEROES, type HeroId } from "./heroes";
import type { Tier } from "./tiers";

export type SkillEffect =
  | "buffOne"   // your strongest card on the target carrier +N
  | "buffAll"   // all your cards on the target carrier +N
  | "buffHero"  // the hero that created this skill +N (must be on the target carrier)
  | "debuffTop" // the strongest enemy card on the target carrier -N
  | "debuffAll" // all enemy cards on the target carrier -N
  | "fortify";  // +N to your score on the target carrier (needs a card of yours there)

export interface SkillDef {
  id: string;
  hero: HeroId;
  slot: 0 | 1 | 2;
  ultimate: boolean;
  name: string;
  cost: number;
  effect: SkillEffect;
  amount: number;
  text: string;
  requires: Tier;
  /** Presentation hint for the reveal animation. */
  anim: "burst" | "shards" | "ring" | "slash" | "wave";
  target: "carrier";
}

const TEXT: Record<SkillEffect, (n: number, hero: string) => string> = {
  buffOne: (n) => `Your strongest card here +${n}`,
  buffAll: (n) => `All your cards here +${n}`,
  buffHero: (n, h) => `${h} gains +${n} (must be here)`,
  debuffTop: (n) => `Strongest enemy here -${n}`,
  debuffAll: (n) => `All enemies here -${n}`,
  fortify: (n) => `+${n} to your score here`,
};

type Row = [name: string, cost: number, effect: SkillEffect, amount: number, anim: SkillDef["anim"]];
const ROWS: Record<HeroId, [Row, Row, Row]> = {
  aruvi:    [["FLOW STATE", 2, "buffOne", 2, "ring"], ["RISING LIGHT", 3, "buffHero", 3, "burst"], ["CHAKRA STORM", 4, "buffAll", 3, "ring"]],
  yuki:     [["FROST LANCE", 1, "debuffTop", 2, "shards"], ["GLACIER WALL", 2, "fortify", 3, "shards"], ["ABSOLUTE ZERO", 4, "debuffAll", 3, "shards"]],
  amara:    [["SOLAR SHIELD", 2, "buffAll", 1, "burst"], ["SUNFLARE", 3, "debuffTop", 3, "burst"], ["HIGH NOON", 5, "buffAll", 3, "burst"]],
  liwei:    [["SMOKE STEP", 1, "buffHero", 2, "slash"], ["NIGHT CUT", 2, "debuffTop", 3, "slash"], ["THOUSAND SHADOWS", 4, "debuffAll", 2, "slash"]],
  kofi:     [["STONE RAMPART", 2, "fortify", 2, "wave"], ["QUAKE STOMP", 3, "debuffAll", 1, "wave"], ["LIVING MOUNTAIN", 4, "buffAll", 2, "wave"]],
  ella:     [["GALE ORDER", 2, "buffOne", 2, "ring"], ["THUNDER CALL", 3, "debuffTop", 3, "slash"], ["TEMPEST FRONT", 5, "fortify", 5, "burst"]],
  diego:    [["QUICKDRAW", 1, "debuffTop", 2, "slash"], ["RICOCHET", 2, "debuffAll", 1, "slash"], ["LAST LIGHT", 4, "buffHero", 5, "burst"]],
  aisha:    [["PULL", 2, "debuffTop", 2, "ring"], ["DUNE WELL", 3, "fortify", 3, "ring"], ["SINGULARITY", 5, "debuffAll", 3, "ring"]],
  kavin:    [["REWIND PULSE", 1, "buffHero", 2, "ring"], ["SECOND HAND", 2, "buffOne", 3, "ring"], ["CHRONOBREAK", 4, "buffAll", 2, "wave"]],
  sara:     [["JAGUAR POUNCE", 2, "debuffTop", 3, "slash"], ["WILD ROAR", 3, "buffAll", 1, "wave"], ["PRIMAL FORM", 4, "buffHero", 6, "burst"]],
  kimi:     [["NANO PATCH", 1, "buffOne", 2, "shards"], ["TRANSMUTE", 3, "fortify", 3, "ring"], ["GOLD CIRCUIT", 5, "buffAll", 3, "shards"]],
  meenal:   [["KOLAM LATTICE", 2, "fortify", 2, "ring"], ["MIND FOLD", 3, "debuffTop", 3, "wave"], ["TEMPLE OF THOUGHT", 4, "buffAll", 2, "ring"]],
  fatima:   [["CINDER STEP", 2, "buffHero", 3, "burst"], ["FIREWHEEL", 3, "debuffAll", 1, "ring"], ["PHOENIX SPIN", 5, "fortify", 6, "burst"]],
  senthil:  [["PEARL SHOT", 1, "debuffTop", 2, "shards"], ["MONSOON", 3, "buffAll", 2, "wave"], ["TIDAL BRIDGE", 4, "debuffAll", 2, "wave"]],
  thabo:    [["PULSE STRIKE", 2, "debuffTop", 2, "wave"], ["SONIC WALL", 3, "fortify", 3, "wave"], ["EARTHSONG", 5, "buffAll", 3, "wave"]],
  mei:      [["NEON DASH", 1, "buffHero", 2, "slash"], ["STROBE", 2, "debuffTop", 2, "slash"], ["OVERDRIVE", 4, "buffOne", 5, "burst"]],
  andres:   [["GLINT", 1, "debuffTop", 1, "shards"], ["PRISM GUARD", 2, "buffOne", 3, "shards"], ["SOLAR CATHEDRAL", 5, "buffAll", 3, "burst"]],
  zara:     [["DOUBLE IMAGE", 2, "buffHero", 3, "ring"], ["FALSE DOOR", 3, "debuffAll", 1, "ring"], ["HALL OF MIRRORS", 4, "debuffTop", 5, "shards"]],
  thamarai: [["UPDRAFT", 1, "buffOne", 2, "wave"], ["STAFF CYCLONE", 3, "debuffAll", 1, "wave"], ["MONSOON WINGS", 4, "buffAll", 2, "wave"]],
  sakura:   [["SEEDLING", 1, "fortify", 2, "wave"], ["THORN BIND", 2, "debuffTop", 2, "wave"], ["WORLD TREE", 5, "buffAll", 3, "burst"]],
};

const REQ: Tier[] = ["base", "ascend", "apex"];
export const SKILLS: SkillDef[] = HEROES.flatMap((h) =>
  ROWS[h.id].map(([name, cost, effect, amount, anim], i) => ({
    id: h.skills[i]!, hero: h.id, slot: i as 0 | 1 | 2, ultimate: i === 2, name, cost, effect, amount, anim,
    text: TEXT[effect](amount, h.name), requires: REQ[i]!, target: "carrier" as const,
  })),
);
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<string, SkillDef>;
export const skillsOf = (hero: HeroId) => HERO_BY_ID[hero].skills.map((id) => SKILL_BY_ID[id]!);
