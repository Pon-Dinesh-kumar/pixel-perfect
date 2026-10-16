/** Hero artwork URLs by hero and tier. Skill cards reuse their hero's tier art (placeholder until skill art exists). */
import type { HeroId } from "./heroes";
import type { Tier } from "./tiers";

const files = import.meta.glob("../assets/heroes/*/*.jpg", { eager: true, import: "default" }) as Record<string, string>;

export const HERO_ART: Record<string, Partial<Record<Tier, string>>> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/heroes\/([^/]+)\/(base|ascend|apex)\.jpg$/);
  if (m) (HERO_ART[m[1]!] ??= {})[m[2] as Tier] = url;
}

export const heroArt = (id: HeroId, tier: Tier): string => HERO_ART[id]?.[tier] ?? HERO_ART[id]?.base ?? "";
export const artKey = (id: HeroId, tier: Tier) => `hero-${id}-${tier}`;
