/** Original hero artwork, transparent upgraded character overlays and name-logo URLs. */
import type { HeroId } from "./heroes";
import type { Tier } from "./tiers";

const files = import.meta.glob("../assets/heroes/*/*.webp", { eager: true, import: "default" }) as Record<string, string>;
const logos = import.meta.glob("../assets/logos/*.webp", { eager: true, import: "default" }) as Record<string, string>;
const foregrounds = import.meta.glob("../assets/foregrounds/*/*.webp", { eager: true, import: "default" }) as Record<string, string>;

export const HERO_FOREGROUND: Record<string, Partial<Record<Tier, string>>> = {};
for (const [path, url] of Object.entries(foregrounds)) {
  const m = path.match(/foregrounds\/([^/]+)\/(ascend|apex)\.webp$/);
  if (m?.[1] && m[2]) (HERO_FOREGROUND[m[1]] ??= {})[m[2] as Tier] = url;
}

export const HERO_ART: Record<string, Partial<Record<Tier, string>>> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/heroes\/([^/]+)\/(base|ascend|apex)\.webp$/);
  if (m) (HERO_ART[m[1]!] ??= {})[m[2] as Tier] = url;
}
export const HERO_LOGO: Record<string, string> = {};
for (const [path, url] of Object.entries(logos)) {
  const m = path.match(/logos\/([^/]+)\.webp$/);
  if (m) HERO_LOGO[m[1]!] = url;
}

export const heroArt = (id: HeroId, tier: Tier): string => HERO_ART[id]?.[tier] ?? HERO_ART[id]?.base ?? "";
export const heroLogo = (id: HeroId): string => HERO_LOGO[id] ?? "";
export const heroForeground = (id: HeroId, tier: Tier): string => HERO_FOREGROUND[id]?.[tier] ?? "";
export const foregroundKey = (id: HeroId, tier: Tier) => `foreground-${id}-${tier}`;
export const artKey = (id: HeroId, tier: Tier) => `hero-${id}-${tier}`;
export const logoKey = (id: HeroId) => `logo-${id}`;
