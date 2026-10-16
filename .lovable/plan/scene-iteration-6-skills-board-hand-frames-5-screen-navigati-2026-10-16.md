# SCENE iteration 6 — skills, board, hand, frames, 5-screen navigation

## 1. Skill cards
- Rule: skills appear in hand once their hero is placed. Normal skills can only be dropped on that hero's carrier; Ultimates on any carrier. Invalid carriers stay dark while dragging.
- Placeholder art: no hero picture. A shared "ability" placeholder: hex emblem + icon by effect type (sword = buff, shield = fortify, skull = debuff, burst = buff all), tinted in the hero colour, with a "SKILL ART COMING" tag in the detail view. No new images generated.

## 2. Hand with many cards — "Fan + Peek"
- Up to 5 cards: flat row. 6+ cards: cards fan out in an arc and overlap; pressing and sliding a finger across the fan lifts the card under it (like flicking through a hand of real cards). Release = tap (detail view); drag upward = pick it up to place.
- Skill cards stack into a small "skill pile" next to their hero colour, with a count badge; tapping the pile spreads it open.

## 3. Bigger battleground
- Canvas fills the full phone height; HUD squeezed into a slim top bar (turn, energy, scores).
- Carriers become wide horizontal lanes taking ~65% of the screen; slots larger. Hand docks at the bottom, partly tucked below the edge, rising when touched.
- End-turn button becomes a large round button on the right of the hand.

## 4. Dynamic environment
- Layered moving sky: drifting cloud layers at different speeds, slow-moving light rays, floating dust, occasional distant ships passing, carriers gently bobbing. Lane glows in its winner's colour (blue/red).

## 5. Card frames
- Ascend: animated border (kept). Apex: same Ascend border, no gold border; instead hero-coloured particles (embers/frost/petals by hero) rising around the card and a hero-matching glowing backdrop behind the art.
- Frame break redo: instead of an ellipse at the head, the whole upper body (head + shoulders, ~top 35% of art) spills above the frame with a soft fade at the sides, so it reads as the character stepping out. Ascend smaller break, Apex bigger.

## 6. Cost and power badges
- Cost: a slim angled energy shard in the top-left corner, notched into the frame.
- Power: a bold shield-shaped plate at the bottom-right, overlapping the name logo edge, gold for yours, red for rival, green/red number when changed.
- Applied to battle cards, detail view and collection tiles alike.

## 7. Five screens with swipe
- Bottom bar with 5 icons: Shop, Collection, Battle (centre, raised), Community, PvE. Swipe left/right between pages with snap, the active icon grows and lifts like Clash Royale.
- Battle (main): top bar with profile + shards, big hero showcase in the middle, large yellow BATTLE button, deck preview of 8 mini cards.
- Collection: "Battle Deck" panel with 8 cards at top (tap to swap), then "Found Cards" grid; tap a card for Info / Upgrade / Use buttons popover.
- Shop, Community, PvE: styled "Coming soon" pages.
- Existing /collection, /deck and /heroes/$id keep working (deep links); /battle stays the full-screen match.

## Technical details
- rules.ts: canPlay checks skill target carrier = hero's carrier unless `ultimate`; new tests for both rules.
- New `src/routes/index.tsx` hosts a swipe pager (CSS scroll-snap + pointer handling, no new library); tab state in search param `?tab=`.
- BattleScene: new layout constants, hand fan logic in a pure helper (`handLayout(n)`) with a test; background layers as Phaser tile sprites/tweens.
- cardView.ts: new badge drawing, apex particle emitter, revised frame-break mask; HeroCard.tsx mirrors it in CSS.
