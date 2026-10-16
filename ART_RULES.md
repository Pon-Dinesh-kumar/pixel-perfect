# SCENE — Art Rules (strict, zero deviation)

One style for every hero, tier and skill: **tactical hero-shooter agent splash art**, like Valorant agent art.

## Style (applies to every image)
1. Stylized semi-realistic, painterly 3D look. Crisp hand-painted textures, no photorealism, no anime line art, no chibi, no comic ink.
2. Bold, clean silhouettes and big readable shapes. Slightly exaggerated heroic proportions.
3. Soft cel-shaded lighting, one key light from upper left, a strong coloured rim light from behind in the hero's accent colour.
4. Matte, smooth skin rendering; graphic, simplified hair clumps; clean armour edges with light wear.
5. Framing: waist-up, three-quarter heroic pose, face toward camera, head in the upper third, centred.
6. Background: flat dark navy (#0a0f1c family) with a few faint geometric shapes in the accent colour. No scenery, no other people.
7. Palette: the hero's 2–3 listed colours plus neutral navy/black/white. No rainbow.
8. Never: text, logos, watermarks, borders, UI, frames, real game characters, blur/bokeh, photo grain.
9. Size: 768×1024 portrait for heroes; skills reuse the hero's own art with an effect overlay.

## Tiers (same person, same face, same pose family)
- **Base**: standard outfit, small glow on the power focus.
- **Ascend**: same outfit upgraded — extra armour pieces, brighter accent trims, stronger glow, energy particles.
- **Apex**: ultimate form — ornate gold-trimmed armour, glowing eyes, big energy aura filling the background.
Face, skin tone, hair, body, and cultural details never change between tiers.

## Prompt template
Every hero image uses the fixed STYLE line from `src/game/artStyle.ts` followed by the hero's `look` fields from `src/game/heroes.ts`. Do not reword the STYLE line per hero.
