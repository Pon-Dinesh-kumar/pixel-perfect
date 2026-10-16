export type Tier = "base" | "ascend" | "apex";
export const TIERS: Tier[] = ["base", "ascend", "apex"];
export const TIER_LABEL: Record<Tier, string> = { base: "BASE", ascend: "ASCEND", apex: "APEX" };
export const isTier = (x: unknown): x is Tier => x === "base" || x === "ascend" || x === "apex";
/** Number of skills unlocked at a tier: Base 1, Ascend 2, Apex 3. Upgrades never remove skills. */
export const skillsUnlocked = (t: Tier) => TIERS.indexOf(t) + 1;
export const nextTier = (t: Tier): Tier | null => TIERS[TIERS.indexOf(t) + 1] ?? null;
/** Shard cost to reach the given tier. */
export const UPGRADE_COST: Record<Exclude<Tier, "base">, number> = { ascend: 1, apex: 2 };
export const START_SHARDS = 60;
