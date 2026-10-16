import { createFileRoute, Link } from "@tanstack/react-router";
import sky from "@/assets/scene-sky.jpg";
import { heroArt } from "@/game/heroArt";
import { Shards, useProfile } from "@/components/scene";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SCENE — Carrier Card Battler" },
      { name: "description", content: "Collect 20 heroes, upgrade them to Apex, build an 8-hero deck and battle across three sky carriers." },
      { property: "og:title", content: "SCENE — Carrier Card Battler" },
      { property: "og:description", content: "Collect 20 heroes, upgrade them to Apex, build an 8-hero deck and battle across three sky carriers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const p = useProfile();
  const btn = "block w-full rounded-lg border border-border bg-card/80 px-6 py-3 text-center font-display text-3xl tracking-widest backdrop-blur hover:border-accent";
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-end overflow-hidden bg-background px-6 pb-12 text-foreground">
      <img src={sky} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <img src={heroArt("aruvi", "apex")} alt="ARUVI" className="absolute left-1/2 top-0 h-[70dvh] -translate-x-1/2 object-contain" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="relative w-full max-w-sm space-y-3">
        <h1 className="text-center font-display text-8xl font-bold tracking-[0.2em]">SCENE</h1>
        {p && <p className="text-center"><Shards n={p.shards} /> <span className="text-muted-foreground">shards</span></p>}
        <Link to="/battle" className={`${btn} border-primary bg-primary text-primary-foreground hover:border-primary`}>BATTLE</Link>
        <Link to="/collection" className={btn}>HEROES</Link>
        <Link to="/deck" className={btn}>DECK</Link>
      </div>
    </main>
  );
}
