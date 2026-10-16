import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { HERO_BY_ID, isHeroId } from "@/game/heroes";
import { heroArt } from "@/game/heroArt";
import { heroPower } from "@/game/rules";
import { skillsOf } from "@/game/skills";
import { TIERS, TIER_LABEL, skillsUnlocked, type Tier } from "@/game/tiers";
import { saveProfile, upgrade, upgradeCost } from "@/game/profile";
import { hex, Loading, Screen, Shards, TierBadge, useProfile } from "@/components/scene";

export const Route = createFileRoute("/heroes/$id")({
  loader: ({ params }) => {
    if (!isHeroId(params.id)) throw notFound();
    return { id: params.id };
  },
  head: ({ loaderData }) => {
    const h = loaderData ? HERO_BY_ID[loaderData.id] : null;
    const title = h ? `${h.name} — ${h.archetype} — SCENE` : "Hero — SCENE";
    const desc = h ? h.description : "SCENE hero details.";
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title }, { property: "og:description", content: desc },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
        ...(h ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => <Screen title="HERO" back="/collection"><p className="text-muted-foreground">That hero doesn't exist.</p></Screen>,
  component: HeroPage,
});

function HeroPage() {
  const { id } = Route.useLoaderData();
  const p = useProfile();
  const [view, setView] = useState<Tier | null>(null);
  if (!p) return <Loading />;
  const h = HERO_BY_ID[id];
  const tier = p.tiers[id];
  const shown = view ?? tier;
  const cost = upgradeCost(p, id);
  const inDeck = p.deck.includes(id);
  const unlocked = skillsUnlocked(tier);

  const doUpgrade = () => {
    const n = upgrade(p, id);
    if (!n) { toast.error("Not enough shards"); return; }
    saveProfile(n); setView(null);
    toast.success(`${h.name} reached ${TIER_LABEL[n.tiers[id]]}`);
  };
  const toggleDeck = () => {
    if (inDeck) { saveProfile({ ...p, deck: p.deck.filter((x) => x !== id) }); toast(`${h.name} removed — deck needs 8 to battle`); return; }
    if (p.deck.length >= 8) { toast.error("Deck is full (8). Remove a hero first."); return; }
    saveProfile({ ...p, deck: [...p.deck, id] });
    toast.success(`${h.name} added to deck`);
  };

  return (
    <Screen title={h.name} back="/collection" right={<Shards n={p.shards} />}>
      <div className="grid gap-5 sm:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl border-2 bg-card" style={{ borderColor: hex(h.color) }}>
            <img src={heroArt(id, shown)} alt={`${h.name} ${TIER_LABEL[shown]}`} className="h-full w-full object-cover" />
            <div className="absolute left-2 top-2"><TierBadge tier={shown} /></div>
            {shown !== tier && TIERS.indexOf(shown) > TIERS.indexOf(tier) && <div className="absolute inset-x-0 bottom-0 bg-background/80 py-1 text-center font-display text-lg">PREVIEW · LOCKED</div>}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {TIERS.map((t) => (
              <button key={t} type="button" onClick={() => setView(t)}
                className={`rounded-md border py-1 font-display text-lg ${shown === t ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{TIER_LABEL[t]}</button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">#{h.num} · {h.archetype} · {h.inspiration}, {h.nation}</p>
            <p className="mt-1 italic">“{h.quote}”</p>
            <p className="mt-1 text-sm text-muted-foreground">{h.description}</p>
          </div>
          <div className="flex gap-3 font-display text-2xl">
            <span className="rounded bg-secondary px-3">COST {h.cost}</span>
            <span className="rounded bg-primary px-3 text-primary-foreground">POWER {heroPower(id, tier)}</span>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="font-display text-xl" style={{ color: hex(h.color) }}>PASSIVE · {h.passive.name}</div>
            <div>{h.passive.text}</div>
            <div className="text-sm text-muted-foreground">When: {h.passive.trigger}</div>
          </div>
          <div className="space-y-2">
            <div className="font-display text-xl tracking-wide">SKILL CARDS</div>
            {skillsOf(id).map((s, i) => {
              const open = i < unlocked;
              return (
                <div key={s.id} className={`flex items-center gap-3 rounded-lg border p-2 ${open ? "border-border bg-card" : "border-dashed border-border opacity-50"}`}>
                  <span className="rounded bg-secondary px-2 font-display text-xl">{s.cost}</span>
                  <div className="flex-1">
                    <div className="font-display text-lg leading-none">{s.name}{s.ultimate && <span className="ml-2 text-primary">ULTIMATE</span>}</div>
                    <div className="text-sm text-muted-foreground">{s.text}</div>
                  </div>
                  <span className="font-display text-sm">{open ? "UNLOCKED" : `🔒 ${TIER_LABEL[s.requires]}`}</span>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">Playing {h.name} adds unlocked skill cards to your hand. Each skill is used once on a carrier. Skill art uses the hero's picture for now.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" disabled={cost === null || p.shards < cost} onClick={doUpgrade}
              className="flex-1 rounded-lg bg-primary py-2 font-display text-2xl text-primary-foreground disabled:opacity-40">
              {cost === null ? "MAX TIER" : `UPGRADE · ◆${cost}`}
            </button>
            <button type="button" onClick={toggleDeck} className="flex-1 rounded-lg border border-accent py-2 font-display text-2xl text-accent">
              {inDeck ? "REMOVE FROM DECK" : "ADD TO DECK"}
            </button>
          </div>
        </div>
      </div>
    </Screen>
  );
}
