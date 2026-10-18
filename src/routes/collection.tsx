import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HEROES } from "@/game/heroes";
import { TIERS, TIER_LABEL, type Tier } from "@/game/tiers";
import { HeroTile, Loading, Screen, Shards, useProfile } from "@/components/scene";

export const Route = createFileRoute("/collection")({
  head: () => ({
    meta: [
      { title: "Hero Collection — Citadel Wars" },
      { name: "description", content: "Browse all 20 Citadel Wars heroes, their passives, tiers and skill cards." },
      { property: "og:title", content: "Hero Collection — Citadel Wars" },
      { property: "og:description", content: "Browse all 20 Citadel Wars heroes, their passives, tiers and skill cards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Collection,
});

type Filter = "all" | "deck" | "tamil" | Tier;

function Collection() {
  const p = useProfile();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  if (!p) return <Loading />;
  const list = HEROES.filter((h) => {
    const s = q.trim().toLowerCase();
    if (s && !`${h.name} ${h.archetype} ${h.nation} ${h.inspiration}`.toLowerCase().includes(s)) return false;
    if (f === "deck") return p.deck.includes(h.id);
    if (f === "tamil") return !!h.tamil;
    if (f !== "all") return p.tiers[h.id] === f;
    return true;
  });
  const filters: [Filter, string][] = [["all", "ALL"], ["deck", "IN DECK"], ["tamil", "TAMIL"], ...TIERS.map((t) => [t, TIER_LABEL[t]] as [Filter, string])];
  return (
    <Screen title="HEROES" right={<Shards n={p.shards} />}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role, place…" aria-label="Search heroes"
        className="mb-3 w-full rounded-md border border-input bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground" />
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setF(k)}
            className={`rounded-full border px-3 font-display text-lg tracking-wide ${f === k ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{label}</button>
        ))}
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{list.length} of 20 heroes</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {list.map((h) => <HeroTile key={h.id} id={h.id} tier={p.tiers[h.id]} inDeck={p.deck.includes(h.id)} />)}
      </div>
    </Screen>
  );
}
