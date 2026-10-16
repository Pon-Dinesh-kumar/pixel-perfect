import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import sky from "@/assets/scene-sky.jpg";
import carrier from "@/assets/carrier-stylized.png";
import vanguard from "@/assets/card-vanguard.jpg";
import riftdancer from "@/assets/card-riftdancer.jpg";
import skyguard from "@/assets/card-skyguard.jpg";
import aurora from "@/assets/card-aurora.jpg";

const ASSETS = { sky, carrier, art: { vanguard, riftdancer, skyguard, aurora } };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SCENE — Carrier Card Battler" },
      { name: "description", content: "Play SCENE: a portrait card battler across three floating sky carriers." },
      { property: "og:title", content: "SCENE — Carrier Card Battler" },
      { property: "og:description", content: "Play SCENE: a portrait card battler across three floating sky carriers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: { destroy: (b: boolean) => void } | undefined;
    let dead = false;
    import("@/game/main").then(async (m) => {
      if (dead || !ref.current) return;
      game = await m.startGame(ref.current, ASSETS);
      if (dead) game.destroy(true);
    });
    return () => { dead = true; game?.destroy(true); };
  }, []);
  return (
    <main className="flex h-dvh w-full items-center justify-center bg-background">
      <h1 className="sr-only">SCENE</h1>
      <div ref={ref} className="h-full w-full max-w-[min(100vw,56.25dvh)] touch-none select-none" onContextMenu={(e) => e.preventDefault()} />
    </main>
  );
}
