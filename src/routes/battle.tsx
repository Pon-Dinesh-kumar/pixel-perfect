import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import sky from "@/assets/scene-sky.jpg";
import carrier from "@/assets/carrier-stylized.png";
import { HERO_ART, HERO_LOGO, artKey, logoKey } from "@/game/heroArt";
import { deckEntries, isValidDeck, loadProfile, reward, saveProfile } from "@/game/profile";
import { isHeroId } from "@/game/heroes";
import type { Tier } from "@/game/tiers";

const ART: Record<string, string> = {};
for (const [id, tiers] of Object.entries(HERO_ART)) for (const [t, url] of Object.entries(tiers)) if (isHeroId(id) && url) ART[artKey(id, t as Tier)] = url;
for (const [id, url] of Object.entries(HERO_LOGO)) if (isHeroId(id)) ART[logoKey(id)] = url;

export const Route = createFileRoute("/battle")({
  head: () => ({
    meta: [
      { title: "Battle — SCENE" },
      { name: "description", content: "Play your 8-hero deck across three floating sky carriers in a six-turn SCENE battle." },
      { property: "og:title", content: "Battle — SCENE" },
      { property: "og:description", content: "Play your 8-hero deck across three floating sky carriers in a six-turn SCENE battle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Battle,
});

function Battle() {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    let game: { destroy: (b: boolean) => void } | undefined;
    let dead = false;
    if (!isValidDeck(loadProfile().deck)) { navigate({ to: "/deck" }); return; }
    import("@/game/main").then(async (m) => {
      if (dead || !ref.current) return;
      game = await m.startGame(ref.current, {
        sky, carrier, art: ART, deck: deckEntries(loadProfile()),
        onResult: (o) => saveProfile(reward(loadProfile(), o)),
        onExit: () => navigate({ to: "/" }),
      });
      if (dead) game.destroy(true);
    });
    return () => { dead = true; game?.destroy(true); };
  }, [navigate]);
  return (
    <main className="relative flex h-dvh w-full items-center justify-center bg-background">
      <h1 className="sr-only">SCENE battle</h1>
      <button type="button" onClick={() => navigate({ to: "/" })} className="absolute left-2 top-2 z-10 rounded-md border border-border bg-card/80 px-3 py-1 font-display text-lg text-muted-foreground hover:text-foreground">‹ MENU</button>
      <div ref={ref} className="h-full w-full max-w-[min(100vw,56.25dvh)] touch-none select-none" onContextMenu={(e) => e.preventDefault()} />
    </main>
  );
}
