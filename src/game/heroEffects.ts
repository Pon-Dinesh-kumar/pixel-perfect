import type { HeroId } from "./heroes";

/** Distinct motifs shared by the collection, reveals and spell feedback. */
export const HERO_EFFECTS: Record<HeroId, { motif: string; sides: number; speed: number; drift: number; pitch: number }> = {
  aruvi: { motif: "chakra", sides: 12, speed: 2200, drift: 0, pitch: 294 },
  yuki: { motif: "frost", sides: 3, speed: 3400, drift: -18, pitch: 740 },
  amara: { motif: "solar", sides: 8, speed: 2800, drift: 8, pitch: 392 },
  liwei: { motif: "shadow", sides: 2, speed: 1600, drift: -36, pitch: 147 },
  kofi: { motif: "stone", sides: 5, speed: 4200, drift: 4, pitch: 98 },
  ella: { motif: "lightning", sides: 2, speed: 1100, drift: 28, pitch: 659 },
  diego: { motif: "ricochet", sides: 4, speed: 1200, drift: 46, pitch: 440 },
  aisha: { motif: "gravity", sides: 24, speed: 3800, drift: -5, pitch: 110 },
  kavin: { motif: "clock", sides: 12, speed: 3000, drift: -24, pitch: 523 },
  sara: { motif: "claw", sides: 2, speed: 1700, drift: 32, pitch: 196 },
  kimi: { motif: "nano", sides: 6, speed: 2100, drift: 16, pitch: 880 },
  meenal: { motif: "kolam", sides: 8, speed: 3600, drift: -12, pitch: 349 },
  fatima: { motif: "flame", sides: 3, speed: 1400, drift: 18, pitch: 330 },
  senthil: { motif: "tide", sides: 24, speed: 3200, drift: 36, pitch: 262 },
  thabo: { motif: "sonic", sides: 24, speed: 2400, drift: 0, pitch: 131 },
  mei: { motif: "neon", sides: 4, speed: 900, drift: -44, pitch: 988 },
  andres: { motif: "prism", sides: 3, speed: 2600, drift: 24, pitch: 587 },
  zara: { motif: "mirror", sides: 4, speed: 3900, drift: -32, pitch: 622 },
  thamarai: { motif: "feather", sides: 2, speed: 3700, drift: 42, pitch: 494 },
  sakura: { motif: "petal", sides: 5, speed: 4500, drift: -26, pitch: 466 },
};