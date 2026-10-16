<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Game logic lives in src/game/rules.ts (pure, tested); Phaser rendering in src/game/BattleScene.ts, loaded client-only via dynamic import — keeps rules testable and SSR-safe.
- Board view is rebuilt from GameState on every refresh(); UI objects never hold game state (animations use a uid->from-position hint map) — prevents duplicate/stale cards during drag, take-back and repositioning.
- Hero roster (heroes.ts), skills (skills.ts) and tiers (tiers.ts) are the single data source; battle cards are hero ids or skill ids resolved via rules.ts helpers — no parallel card tables.
- Player progress (shards, tiers, deck) lives in src/game/profile.ts: pure helpers + localStorage store read via useSyncExternalStore (null on server) — keeps SSR safe and logic testable.
- Skill effects are committed once as flat `mod`/`fortify` values at queued reveal time; passives stay recomputed from base power — skills never re-trigger or double-count.
- Battle cards never show ability text (and hand cards never show power); full info lives only in createDetail() opened on tap — keeps the drag-only placement rule clean.
- Hand fan/pile positions come from pure src/game/handLayout.ts (tested); BattleScene only renders them — keeps hand logic testable.
- Home "/" is a 5-page native scroll-snap pager (src/components/HomePages.tsx) with a bottom tab bar; deep-link routes (/collection, /deck, /heroes/$id, /battle) stay intact.

- Deployments are queued in rules.ts and revealed one at a time; unrevealed cards are excluded from every scoring/passive path — animation timing cannot change results.
- Battle preloads only the selected tier art and logos for both match decks; collection art remains independently available — preserves quality while reducing startup traffic.
- heroEffects.ts supplies distinct hero motifs to CSS and Phaser; audio.ts synthesizes opt-in music/SFX client-side — shared identity with no audio downloads.
