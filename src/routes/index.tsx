import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Layers, Map, ShoppingBag, Swords, Users } from "lucide-react";
import { Loading, useProfile } from "@/components/scene";
import { CollectionPage, ComingSoon, MainPage } from "@/components/HomePages";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Citadel Wars — Carrier Card Battler" },
      { name: "description", content: "Collect 20 heroes, upgrade them to Apex, build an 8-hero deck and battle across three sky carriers." },
      { property: "og:title", content: "Citadel Wars — Carrier Card Battler" },
      { property: "og:description", content: "Collect 20 heroes, upgrade them to Apex, build an 8-hero deck and battle across three sky carriers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const TABS = [
  { key: "shop", label: "SHOP", Icon: ShoppingBag },
  { key: "cards", label: "CARDS", Icon: Layers },
  { key: "battle", label: "BATTLE", Icon: Swords },
  { key: "community", label: "SOCIAL", Icon: Users },
  { key: "pve", label: "PVE", Icon: Map },
] as const;
const MAIN = 2;

function Home() {
  const p = useProfile();
  const pager = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(MAIN);

  useEffect(() => {
    const el = pager.current;
    if (el) el.scrollLeft = el.clientWidth * MAIN;
  }, [p !== null]);

  const go = (i: number) => {
    setTab(i);
    pager.current?.scrollTo({ left: pager.current.clientWidth * i, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = pager.current;
    if (el) setTab(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (!p) return <Loading />;
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background text-foreground">
      <h1 className="sr-only">Citadel Wars</h1>
      <div ref={pager} onScroll={onScroll} className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain">
        <section className="h-full w-full shrink-0 snap-center"><ComingSoon title="SHOP" line="Hero bundles, shard packs and skins." /></section>
        <section className="h-full w-full shrink-0 snap-center"><CollectionPage p={p} /></section>
        <section className="h-full w-full shrink-0 snap-center"><MainPage p={p} /></section>
        <section className="h-full w-full shrink-0 snap-center"><ComingSoon title="COMMUNITY" line="Clans, friends and chat." /></section>
        <section className="h-full w-full shrink-0 snap-center"><ComingSoon title="PVE" line="Story missions across the sky carriers." /></section>
      </div>
      <nav className="grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ key, label, Icon }, i) => {
          const on = tab === i;
          return (
            <button key={key} type="button" onClick={() => go(i)} aria-label={label} aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center justify-end gap-0.5 py-1.5 transition-all duration-200 ${on ? "-mt-4 rounded-t-xl bg-secondary text-primary" : "text-muted-foreground"}`}>
              <Icon className={`transition-all duration-200 ${on ? "h-9 w-9" : "h-6 w-6"}`} />
              <span className={`font-display tracking-wider ${on ? "text-lg" : "text-sm"}`}>{label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}
