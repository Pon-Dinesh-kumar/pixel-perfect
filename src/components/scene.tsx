import { Link } from "@tanstack/react-router";
import { useSyncExternalStore, type ReactNode } from "react";
import { HERO_BY_ID, type HeroId } from "@/game/heroes";
import { heroArt } from "@/game/heroArt";
import { heroPower } from "@/game/rules";
import { loadProfile, subscribe, type Profile } from "@/game/profile";
import { TIER_LABEL, type Tier } from "@/game/tiers";

/** Saved profile; null during server render / before hydration. */
export function useProfile(): Profile | null {
  return useSyncExternalStore(subscribe, loadProfile, () => null);
}

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function Screen({ title, back = "/", right, children }: { title: string; back?: "/" | "/collection"; right?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl bg-background px-4 pb-16 pt-4 text-foreground">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link to={back} className="rounded-md border border-border px-3 py-1 font-display text-xl tracking-wide text-muted-foreground hover:text-foreground">‹ BACK</Link>
        <h1 className="font-display text-4xl font-semibold tracking-wider">{title}</h1>
        <div className="min-w-16 text-right">{right}</div>
      </header>
      {children}
    </main>
  );
}

export function Shards({ n }: { n: number }) {
  return <span className="font-display text-2xl text-primary">◆ {n}</span>;
}

export function TierBadge({ tier }: { tier: Tier }) {
  const cls = tier === "apex" ? "bg-primary text-primary-foreground" : tier === "ascend" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground";
  return <span className={`rounded px-1.5 font-display text-sm tracking-wider ${cls}`}>{TIER_LABEL[tier]}</span>;
}

export function HeroTile({ id, tier, inDeck, onClick }: { id: HeroId; tier: Tier; inDeck?: boolean; onClick?: () => void }) {
  const h = HERO_BY_ID[id];
  const body = (
    <div className="relative aspect-[3/4] overflow-hidden rounded-lg border-2 bg-card" style={{ borderColor: hex(h.color) }}>
      <img src={heroArt(id, tier)} alt={h.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent px-2 pb-1 pt-6">
        <div className="font-display text-xl leading-none tracking-wide">{h.name}</div>
        <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{h.archetype}</span><TierBadge tier={tier} /></div>
      </div>
      <span className="absolute left-1 top-1 rounded bg-secondary px-1.5 font-display text-lg leading-tight">{h.cost}</span>
      <span className="absolute right-1 top-1 rounded bg-primary px-1.5 font-display text-lg leading-tight text-primary-foreground">{heroPower(id, tier)}</span>
      {inDeck && <span className="absolute left-1 top-8 rounded bg-accent px-1 font-display text-xs text-accent-foreground">IN DECK</span>}
    </div>
  );
  if (onClick) return <button type="button" onClick={onClick} className="block w-full text-left">{body}</button>;
  return <Link to="/heroes/$id" params={{ id }} className="block">{body}</Link>;
}

export function Loading() {
  return <main className="flex min-h-dvh items-center justify-center bg-background font-display text-2xl text-muted-foreground">LOADING…</main>;
}
