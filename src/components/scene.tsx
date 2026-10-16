import { Link } from "@tanstack/react-router";
import { useSyncExternalStore, type ReactNode } from "react";
import { HERO_BY_ID, type HeroId } from "@/game/heroes";
import { HeroCard } from "@/components/HeroCard";
import { loadProfile, subscribe, type Profile } from "@/game/profile";
import { TIER_LABEL, type Tier } from "@/game/tiers";

/** Saved profile; null during server render / before hydration. */
export function useProfile(): Profile | null {
  return useSyncExternalStore(subscribe, loadProfile, () => null);
}

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function Screen({ title, back = "/", right, children }: { title: string; back?: "/" | "/collection"; right?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-background px-4 pb-16 pt-4 text-foreground">
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
    <div className="pt-[14%]">
      <HeroCard id={id} tier={tier} />
      <div className="mt-1 flex items-center justify-between gap-1 text-xs text-muted-foreground">
        <span className="truncate">{h.archetype}</span><TierBadge tier={tier} />
      </div>
      {inDeck && <div className="mt-0.5 text-center font-display text-xs tracking-wider text-accent">IN DECK</div>}
    </div>
  );
  if (onClick) return <button type="button" onClick={onClick} className="block w-full text-left">{body}</button>;
  return <Link to="/heroes/$id" params={{ id }} className="block">{body}</Link>;
}

export function Loading() {
  return <main className="flex min-h-dvh items-center justify-center bg-background font-display text-2xl text-muted-foreground">LOADING…</main>;
}
