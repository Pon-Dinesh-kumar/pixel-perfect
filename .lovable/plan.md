# SCENE Iteration 4 — Hero Collection, Upgrades, Skills, Deck Builder, Test Battle

## Roster (20 heroes, 5+ Tamil)
Keep the roster numbering and archetypes. Replace 4 entries with new Tamil heroes from Tamil Nadu:
- 1 ARUVI (Madurai) — Energy Duelist (unchanged identity)
- 9 KAVIN (Chennai) — Time Tactician (replaces LUKA)
- 12 MEENAL (Thanjavur) — Mind Architect (replaces RAJ)
- 14 SENTHIL (Rameswaram) — Aqua Ranger (replaces NILA)
- 19 THAMARAI (Coimbatore / Nilgiris) — Wind Striker (replaces LUCAS)
Each gets its own face, hair, costume, palette and cultural details (no ARUVI copies). All 20 have original names, designs and powers.

## Artwork (60 illustrations + skill art)
- For each hero: write a character reference spec, generate the Base portrait, then create Ascend and Apex by editing from the Base image (same face, hair, costume; stronger pose, lighting, energy).
- Skill cards: 3 per hero, themed effect art (60). Produced after hero art, in batches.
- Frames, names, cost, power and text are drawn by code, never baked into images.
- Any missing image shows a labelled placeholder; a manifest lists each hero/skill image and whether it is final.
- Art is produced in batches across several turns; the game is playable throughout with placeholders.

## Screens
- **Collection** (`/collection`): grid of all 20, search, filters (tier, archetype, nation), tier frames, count.
- **Hero detail** (`/hero/$id`): large art, Base/Ascend/Apex previews, passive, 3 skill cards with lock states, Upgrade button, Add/Remove deck.
- **Deck builder** (`/deck`): pick exactly 8 unique heroes, slots strip, Clear, Save, Start Test Battle (disabled with "N slots left").
- **Test battle** (`/battle`): existing three-carrier Phaser battle using the saved deck, with Exit to Collection.
- Home page gets a menu linking to these.

## Rules
- Upgrades: test currency "Shards" (start with plenty; Ascend 1, Apex 2 per hero). Tiers change art and skill unlocks only; power/cost unchanged.
- Skills: Base 1 skill, Ascend 2, Apex 3 (incl. ultimate). Generated into hand the first time that hero is placed each match (once per hero per match). Played by drag onto a carrier/target, validated, energy spent, resolved once, reveal animation, then removed. Invalid drop returns it free.
- Take-back rule: a hero can't be taken back once any of its skills has been played; if taken back earlier, its unplayed skills leave the hand. Shown as a lock icon/message.
- Skill effects are applied as battle-only modifiers on placed cards (e.g. +N power, move-and-buff, carrier-wide buffs, enemy debuffs), included in scoring.
- 20 distinct passives built from a small set of real rule kinds (conditional bonus, ally synergy, alone bonus, enemy debuff, adjacency, carrier-lead, end-of-turn growth, etc.), all computed from board state so no double-counting.
- Deck: 8 heroes; hand size and draw rules unchanged. Opponent uses a fixed 8-hero test deck, random legal plays (now including skills).

## Persistence
Local browser storage: tiers, shards, saved deck. Validated on load with safe defaults. Battle state is never saved.

## Technical section
- `src/game/heroes.ts` (roster + passives), `src/game/skills.ts` (skill defs + effects), `src/game/tiers.ts`, `src/game/assets.ts` (manifest), `src/game/collection.ts` (persistence/upgrade), `src/game/deck.ts` (validation). `rules.ts` extended: hand holds hero or skill cards, modifiers per placed uid, skill generation tracking.
- Card frames as a React component (collection) and Phaser `createCard` (battle), both reading the same data.
- Art under `src/assets/heroes/{id}/{base,ascend,apex}.jpg`, `src/assets/skills/{id}/{skill-1,skill-2,ultimate}.jpg`, loaded via `import.meta.glob` so missing files fall back to placeholders.
- Tests: rules for tiers/unlocks, skill generation once, skill vanish and no energy on invalid, take-back restriction, deck validation (8, no dupes, 9th rejected), existing tests kept.

## Order
A data → B card frames → C collection/detail/upgrades → D deck builder → E battle integration → F tests and browser checks. Art batches run alongside; first batch = all 20 Base portraits.
