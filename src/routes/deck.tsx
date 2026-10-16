import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { HEROES, HERO_BY_ID, type HeroId } from "@/game/heroes";
import { DECK_SIZE } from "@/game/rules";
import { saveProfile } from "@/game/profile";
import { HeroTile, Loading, Screen, useProfile } from "@/components/scene";

export const Route = createFileRoute("/deck")({
  head: () => ({
    meta: [
      { title: "Deck Builder — SCENE" },
      { name: "description", content: "Build your SCENE battle deck from exactly 8 unique heroes." },
      { property: "og:title", content: "Deck Builder — SCENE" },
      { property: "og:description", content: "Build your SCENE battle deck from exactly 8 unique heroes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Deck,
});

function Deck() {
  const p = useProfile();
  if (!p) return <Loading />;
  const full = p.deck.length === DECK_SIZE;
  const toggle = (id: HeroId) => {
    if (p.deck.includes(id)) return saveProfile({ ...p, deck: p.deck.filter((x) => x !== id) });
    if (full) return toast.error("Deck is full. Tap a hero in your deck to remove it.");
    saveProfile({ ...p, deck: [...p.deck, id] });
  };
  const avg = p.deck.length ? (p.deck.reduce((s, id) => s + HERO_BY_ID[id].cost, 0) / p.deck.length).toFixed(1) : "–";
  return (
    <Screen title="DECK" right={<span className={`font-display text-2xl ${full ? "text-primary" : "text-destructive"}`}>{p.deck.length}/{DECK_SIZE}</span>}>
      <p className="mb-2 text-sm text-muted-foreground">Exactly {DECK_SIZE} different heroes. Tap to remove. Average cost {avg}. Saved automatically.</p>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {Array.from({ length: DECK_SIZE }, (_, i) => {
          const id = p.deck[i];
          return id ? <HeroTile key={id} id={id} tier={p.tiers[id]} onClick={() => toggle(id)} />
            : <div key={`e${i}`} className="aspect-[3/4] rounded-lg border-2 border-dashed border-border" />;
        })}
      </div>
      {full ? (
        <Link to="/battle" className="mb-6 block rounded-lg bg-primary py-3 text-center font-display text-3xl tracking-widest text-primary-foreground">TEST BATTLE</Link>
      ) : (
        <p className="mb-6 rounded-lg border border-destructive py-3 text-center font-display text-2xl text-destructive">ADD {DECK_SIZE - p.deck.length} MORE TO BATTLE</p>
      )}
      <div className="mb-2 font-display text-xl tracking-wide">ALL HEROES</div>
      <div className="grid grid-cols-4 gap-2">
        {HEROES.filter((h) => !p.deck.includes(h.id)).map((h) => <HeroTile key={h.id} id={h.id} tier={p.tiers[h.id]} onClick={() => toggle(h.id)} />)}
      </div>
    </Screen>
  );
}
