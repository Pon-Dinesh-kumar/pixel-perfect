import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import sceneSkyWebp from "@/assets/scene-sky.webp";
import { HeroCard } from "@/components/HeroCard";
import { Shards, TierBadge } from "@/components/scene";
import { HEROES, HERO_BY_ID, type HeroId } from "@/game/heroes";
import { saveProfile, setDeck, upgrade, upgradeCost, type Profile } from "@/game/profile";

function TopBar({ p }: { p: Profile }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/85 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent font-display text-2xl text-accent-foreground">P1</span>
        <div className="leading-tight"><div className="font-display text-xl">COMMANDER</div><div className="text-xs text-muted-foreground">Sky Arena</div></div>
      </div>
      <Shards n={p.shards} />
    </div>
  );
}

export function MainPage({ p }: { p: Profile }) {
  const [show, setShow] = useState(0);
  const hero = p.deck[show % p.deck.length]!;
  return (
    <div className="relative flex h-full flex-col overflow-hidden px-4 pb-4 pt-3">
      <img
        src={sceneSkyWebp}
        alt=""
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60 select-none z-0"
        style={{ transform: "translate3d(0, 0, 0)", willChange: "transform", backfaceVisibility: "hidden" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
      <div className="relative z-10"><TopBar p={p} /></div>
      <div className="relative z-10 mt-2 text-center font-display text-5xl font-bold tracking-[0.16em]">CITADEL WARS</div>
      <button type="button" onClick={() => setShow((s) => s + 1)} className="relative z-10 mx-auto mt-2 w-[52%] max-w-56" aria-label="Next showcase hero">
        <HeroCard id={hero} tier={p.tiers[hero]} tilt />
      </button>
      <div className="relative z-10 mt-3 text-center text-sm text-muted-foreground">{HERO_BY_ID[hero].name} · tap to change</div>
      <div className="relative z-10 mt-auto space-y-3">
        <div className="grid grid-cols-8 gap-1 rounded-xl border border-border bg-card/80 p-1.5">
          {p.deck.map((id) => <HeroCard key={id} id={id} tier={p.tiers[id]} showStats={false} />)}
        </div>
        <Link to="/battle" className="block rounded-2xl border-b-4 border-primary-foreground/40 bg-primary py-4 text-center font-display text-5xl font-bold tracking-widest text-primary-foreground shadow-lg active:translate-y-0.5 active:border-b-2">
          BATTLE
        </Link>
      </div>
    </div>
  );
}

export function CollectionPage({ p }: { p: Profile }) {
  const [sel, setSel] = useState<HeroId | null>(null);
  const [swap, setSwap] = useState<HeroId | null>(null);
  const found = HEROES.filter((h) => !p.deck.includes(h.id));
  const tapDeck = (id: HeroId) => {
    if (swap) {
      const next = setDeck(p, p.deck.map((d) => (d === id ? swap : d)));
      if (next) { saveProfile(next); toast(`${HERO_BY_ID[swap].name} joined the deck`); }
      setSwap(null);
      return;
    }
    setSel(sel === id ? null : id);
  };
  const doUpgrade = (id: HeroId) => {
    const n = upgrade(p, id);
    if (n) { saveProfile(n); toast(`${HERO_BY_ID[id].name} upgraded!`); } else toast("Not enough shards or already Apex");
  };
  const Pop = ({ id }: { id: HeroId }) => {
    const cost = upgradeCost(p, id);
    return (
      <div className="absolute inset-x-0 -bottom-1 z-20 flex translate-y-full flex-col gap-1 rounded-lg border border-border bg-popover p-1 shadow-xl">
        <Link to="/heroes/$id" params={{ id }} className="rounded bg-secondary py-1 text-center font-display text-lg">INFO</Link>
        {cost !== null && <button type="button" onClick={() => doUpgrade(id)} className="rounded bg-accent py-1 font-display text-lg text-accent-foreground">UPGRADE ◆{cost}</button>}
        {!p.deck.includes(id) && <button type="button" onClick={() => { setSwap(id); setSel(null); }} className="rounded bg-primary py-1 font-display text-lg text-primary-foreground">USE</button>}
      </div>
    );
  };
  const Tile = ({ id }: { id: HeroId }) => (
    <div className="relative">
      <button type="button" onClick={() => (p.deck.includes(id) ? tapDeck(id) : setSel(sel === id ? null : id))} className={`block w-full pt-[16%] ${swap && p.deck.includes(id) ? "animate-pulse" : ""}`}>
        <HeroCard id={id} tier={p.tiers[id]} />
      </button>
      <div className="mt-1 text-center"><TierBadge tier={p.tiers[id]} /></div>
      {sel === id && <Pop id={id} />}
    </div>
  );
  return (
    <div className="no-scrollbar h-full overflow-y-auto px-3 pb-6 pt-3">
      <TopBar p={p} />
      <section className="mt-3 rounded-xl border border-accent/40 bg-card/80 p-2">
        <h2 className="mb-1 text-center font-display text-2xl tracking-widest text-accent">{swap ? `TAP A CARD TO SWAP FOR ${HERO_BY_ID[swap].name}` : "BATTLE DECK"}</h2>
        <div className="grid grid-cols-4 gap-x-2 gap-y-6 pb-8">{p.deck.map((id) => <Tile key={id} id={id} />)}</div>
        {swap && <button type="button" onClick={() => setSwap(null)} className="mx-auto block font-display text-lg text-muted-foreground">CANCEL</button>}
      </section>
      <h2 className="my-3 text-center font-display text-2xl tracking-widest text-muted-foreground">— FOUND CARDS {found.length} —</h2>
      <div className="grid grid-cols-4 gap-x-2 gap-y-6 pb-16">{found.map((h) => <Tile key={h.id} id={h.id} />)}</div>
    </div>
  );
}

export function ComingSoon({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="font-display text-5xl tracking-widest">{title}</div>
      <div className="rounded-full border border-primary px-4 py-1 font-display text-xl tracking-widest text-primary">COMING SOON</div>
      <p className="text-muted-foreground">{line}</p>
    </div>
  );
}
