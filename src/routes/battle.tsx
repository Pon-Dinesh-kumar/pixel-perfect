import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import costBadge from "@/assets/ui/cost.webp";
import powerBadge from "@/assets/ui/power.webp";
import cardBack from "@/assets/ui/card-back.jpg";
import twilightSky from "@/assets/Twilight Twin-Faction Skylands.gif";
import carrier from "@/assets/carrier-stylized.png";
import { HERO_ART, HERO_FOREGROUND, HERO_LOGO, artKey, foregroundKey, logoKey } from "@/game/heroArt";
import { deckEntries, isValidDeck, loadProfile, reward, saveProfile } from "@/game/profile";
import { isHeroId } from "@/game/heroes";
import type { Tier } from "@/game/tiers";

const ART: Record<string, string> = { "badge-cost": costBadge, "badge-power": powerBadge, "card-back": cardBack };
for (const [id, tiers] of Object.entries(HERO_ART)) for (const [t, url] of Object.entries(tiers)) if (isHeroId(id) && url) ART[artKey(id, t as Tier)] = url;
for (const [id, tiers] of Object.entries(HERO_FOREGROUND)) for (const [t, url] of Object.entries(tiers)) if (isHeroId(id) && url) ART[foregroundKey(id, t as Tier)] = url;
for (const [id, url] of Object.entries(HERO_LOGO)) if (isHeroId(id)) ART[logoKey(id)] = url;

export const Route = createFileRoute("/battle")({
  head: () => ({
    meta: [
      { title: "Battle — Citadel Wars" },
      { name: "description", content: "Play your 8-hero deck across three floating sky carriers in Citadel Wars." },
      { property: "og:title", content: "Battle — Citadel Wars" },
      { property: "og:description", content: "Play your 8-hero deck across three floating sky carriers in Citadel Wars." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Battle,
});

function Battle() {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(false); setReady(false); setProgress(0);
    let game: { destroy: (b: boolean) => void } | undefined;
    let dead = false;
    if (!isValidDeck(loadProfile().deck)) { navigate({ to: "/deck" }); return; }
    import("@/game/main").then(async (m) => {
      if (dead || !ref.current) return;
      game = await m.startGame(ref.current, {
        sky: twilightSky, carrier, art: ART, onLoad: setProgress, onReady: () => { if (!dead) setReady(true); }, onError: () => { if (!dead) setError(true); }, deck: deckEntries(loadProfile()),
        onResult: (o) => saveProfile(reward(loadProfile(), o)),
        onExit: () => navigate({ to: "/" }),
      });
      if (dead) game.destroy(true);
    }).catch(() => { if (!dead) setError(true); });
    return () => { dead = true; game?.destroy(true); };
  }, [navigate, attempt]);

  return (
    <main className="fixed inset-0 flex h-full w-full items-center justify-center bg-[#030712] overflow-hidden">
      <h1 className="sr-only">Citadel Wars battle</h1>
      <div className="relative h-full w-full max-w-[min(100vw,640px,calc(100dvh*9/16))] flex items-center justify-center overflow-hidden shadow-2xl">
        <img
          src={twilightSky}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none z-0"
        />
        {!ready && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background" role="status">
          <span className="font-display text-5xl text-primary">CITADEL WARS</span>
          <span className="font-display text-xl text-muted-foreground">{error ? "Battle could not load" : `PREPARING BATTLE · ${Math.round(progress * 100)}%`}</span>
          <progress className="h-2 w-48 accent-primary" max={1} value={progress} aria-label="Battle loading" />
          {error && <Button onClick={() => setAttempt((n) => n + 1)}>Retry</Button>}
          <Button variant="ghost" onClick={() => navigate({ to: "/" })}>Back to menu</Button>
        </div>}
        <div ref={ref} className="relative z-10 h-full w-full flex items-center justify-center touch-none select-none" onContextMenu={(e) => e.preventDefault()} />
      </div>
    </main>
  );
}
