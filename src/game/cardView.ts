import * as Phaser from "phaser";
import { HERO_EFFECTS } from "./heroEffects";
import { HERO_BY_ID, isHeroId, type HeroId } from "./heroes";
import { artKey, foregroundKey, logoKey } from "./heroArt";
import { SKILL_BY_ID, type SkillEffect } from "./skills";
import { skillArtKey } from "./skillArt";
import { heroPower } from "./rules";
import { TIER_LABEL, type Tier } from "./tiers";

export const FONT = "Teko, Rajdhani, sans-serif";
const GOLD = 0xffc23a;

/** Phaser does not remove repeating child tweens when a card is rebuilt. */
function cleanCardTweens(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
  const destroy = container.destroy.bind(container);
  container.destroy = (fromScene?: boolean) => {
    const clean = (object: Phaser.GameObjects.GameObject) => {
      scene.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Container) object.list.forEach(clean);
    };
    clean(container);
    destroy(fromScene);
  };
}

export interface CardView {
  id: string; hero: HeroId; name: string; cost: number; power: number | null; color: number; art: string; logo: string | null;
  sub: string; text: string; trigger: string; skill: boolean; ultimate: boolean; tier: Tier; effect: SkillEffect | null;
}

/** Display data for a hero or skill card. Skill cards use procedural placeholder art (no hero picture). */
export function viewOf(id: string, tierFor: (h: HeroId) => Tier): CardView {
  if (isHeroId(id)) {
    const h = HERO_BY_ID[id], tier = tierFor(id);
    return { id, hero: id, name: h.name, cost: h.cost, power: heroPower(id, tier), color: h.color, art: artKey(id, tier), logo: logoKey(id), sub: h.passive.name, text: h.passive.text, trigger: h.passive.trigger, skill: false, ultimate: false, tier, effect: null };
  }
  const s = SKILL_BY_ID[id];
  if (!s) throw new Error(`Unknown card: ${id}`);
  const tier = tierFor(s.hero);
  const where = s.ultimate ? "Ultimate: drop on ANY carrier." : `Drop on ${HERO_BY_ID[s.hero].name}'s carrier only.`;
  return { id, hero: s.hero, name: s.name, cost: s.cost, power: null, color: HERO_BY_ID[s.hero].color, art: "", logo: null, sub: s.ultimate ? "ULTIMATE SKILL" : "SKILL", text: s.text, trigger: `One use. Created by ${HERO_BY_ID[s.hero].name}. ${where}`, skill: true, ultimate: s.ultimate, tier, effect: s.effect };
}

function addArt(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, x: number, y: number, w: number, h: number, focusTop = 0.03) {
  if (!v.art || !scene.textures.exists(v.art)) return null;
  const img = scene.add.image(0, 0, v.art);
  const tw = img.width, th = img.height;
  const cropH = Math.min(th, tw * (h / w));
  const cropW = cropH * (w / h);
  const cx = (tw - cropW) / 2, cy = th * focusTop;
  img.setCrop(cx, cy, cropW, cropH);
  const sc = w / cropW;
  img.setScale(sc).setOrigin(0, 0).setPosition(x - cx * sc, y - cy * sc);
  c.add(img);
  return img;
}

/** Only transparent character pixels can leave the top/sides; the crop ends inside the bottom frame. */
function addForeground(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, w: number, h: number) {
  if (v.skill || v.tier === "base") return;
  const key = foregroundKey(v.hero, v.tier);
  if (!scene.textures.exists(key)) return;
  const spill = h * 0.03;
  addArt(scene, c, { ...v, art: key }, -w * 0.53, -h / 2 - spill, w * 1.06, h + spill - 3, 0);
}

/** Rarity of a skill card: slot 1 = base, slot 2 = ascend, ultimate = apex. */
const skillRarity = (id: string): Tier => (id.endsWith("-ult") ? "apex" : id.endsWith("-s2") ? "ascend" : "base");

/** Live, rarity-scaled FX layered over painted skill art. Base: soft pulse. Ascend: rising embers + sweep. Apex: rotating sigil, storm sparks, gold flare. */
function skillLiveFx(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, w: number, h: number) {
  const rarity = skillRarity(v.id), col = v.color;
  const cy = -h * 0.08, big = w > 200;
  const glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  for (let k = 5; k > 0; k--) glow.fillStyle(col, 0.07).fillCircle(0, cy, (w * 0.42 * k) / 5);
  c.add(glow);
  scene.tweens.add({ targets: glow, alpha: 0.35, duration: rarity === "base" ? 1600 : 1000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  if (rarity === "base") return;

  const n = (rarity === "apex" ? 18 : 9) * (big ? 2 : 1);
  for (let i = 0; i < n; i++) {
    const p = scene.add.circle(Phaser.Math.Between(-w * 0.42, w * 0.42), h * 0.4, Math.max(1.2, w * (rarity === "apex" ? 0.018 : 0.012)), rarity === "apex" && i % 3 === 0 ? GOLD : col, 1).setBlendMode(Phaser.BlendModes.ADD);
    c.add(p);
    scene.tweens.add({ targets: p, y: -h * 0.48, x: p.x + Phaser.Math.Between(-w * 0.1, w * 0.1), alpha: 0, duration: Phaser.Math.Between(1400, 2400), delay: i * 140, repeat: -1 });
  }
  const sweep = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  sweep.fillStyle(0xffffff, 0.16).fillRect(-w * 0.12, -h / 2, w * 0.14, h);
  sweep.setAngle(18).setX(-w);
  c.add(sweep);
  scene.tweens.add({ targets: sweep, x: w, duration: 2600, repeatDelay: rarity === "apex" ? 400 : 1600, repeat: -1, ease: "Sine.inOut" });
  if (rarity !== "apex") return;

  const sigil = scene.add.container(0, cy);
  const ring = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const R = w * 0.38;
  ring.lineStyle(Math.max(1.5, w * 0.012), GOLD, 0.8).strokeCircle(0, 0, R).lineStyle(1, col, 0.7).strokeCircle(0, 0, R * 0.78);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; ring.lineBetween(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78, Math.cos(a) * R, Math.sin(a) * R); }
  sigil.add(ring);
  c.add(sigil);
  scene.tweens.add({ targets: sigil, angle: 360, duration: 9000, repeat: -1 });
  scene.tweens.add({ targets: ring, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
  const flare = scene.add.circle(0, cy, w * 0.1, GOLD, 0.55).setBlendMode(Phaser.BlendModes.ADD);
  c.add(flare);
  scene.tweens.add({ targets: flare, scale: 1.8, alpha: 0.1, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
}

/** Painted skill art when available (with live FX), else placeholder emblem by effect type. */
function skillArt(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, w: number, h: number) {
  const key = skillArtKey(v.id);
  if (scene.textures.exists(key)) {
    addArt(scene, c, { ...v, art: key }, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 0);
    skillLiveFx(scene, c, v, w, h);
    return;
  }
  const g = scene.add.graphics();
  const col = v.ultimate ? GOLD : v.color;
  g.fillGradientStyle(0x0a0f1c, 0x0a0f1c, v.color, v.color, 1, 1, 0.55, 0.55).fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
  const cy = -h * 0.08, R = w * 0.36;
  const hexP = (r: number) => Array.from({ length: 6 }, (_, k) => ({ x: Math.cos((k / 6) * Math.PI * 2 + Math.PI / 6) * r, y: cy + Math.sin((k / 6) * Math.PI * 2 + Math.PI / 6) * r }));
  g.fillStyle(0x060a14, 0.75).fillPoints(hexP(R), true).lineStyle(Math.max(2, w * 0.03), col, 1).strokePoints(hexP(R), true, true);
  g.lineStyle(1, col, 0.5).strokePoints(hexP(R * 1.18), true, true);
  const s = R * 0.62, lw = Math.max(2, w * 0.045);
  g.lineStyle(lw, 0xffffff, 1).fillStyle(0xffffff, 1);
  switch (v.effect) {
    case "buffOne": case "buffHero": // sword
      g.lineBetween(-s * 0.7, cy + s * 0.7, s * 0.7, cy - s * 0.7);
      g.lineBetween(-s * 0.55, cy + s * 0.15, -s * 0.15, cy + s * 0.55);
      g.fillCircle(-s * 0.78, cy + s * 0.78, lw);
      break;
    case "buffAll": // burst
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.lineBetween(Math.cos(a) * s * 0.25, cy + Math.sin(a) * s * 0.25, Math.cos(a) * s, cy + Math.sin(a) * s); }
      break;
    case "fortify": // shield
      g.strokePoints([{ x: -s * 0.6, y: cy - s * 0.6 }, { x: s * 0.6, y: cy - s * 0.6 }, { x: s * 0.6, y: cy }, { x: 0, y: cy + s * 0.8 }, { x: -s * 0.6, y: cy }], true, true);
      break;
    case "debuffTop": case "debuffAll": // skull
      g.strokeCircle(0, cy - s * 0.1, s * 0.55);
      g.fillCircle(-s * 0.22, cy - s * 0.15, s * 0.13).fillCircle(s * 0.22, cy - s * 0.15, s * 0.13);
      g.lineBetween(-s * 0.25, cy + s * 0.6, s * 0.25, cy + s * 0.6);
      if (v.effect === "debuffAll") g.lineBetween(-s * 0.8, cy - s * 0.8, s * 0.8, cy + s * 0.8);
      break;
  }
  c.add(g);
  scene.tweens.add({ targets: g, alpha: 0.85, duration: 900, yoyo: true, repeat: -1 });
}

function addLogo(scene: Phaser.Scene, c: Phaser.GameObjects.Container, key: string, y: number, maxW: number, maxH: number, x = 0) {
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(x, y, key).setOrigin(0.5, 1);
  img.setScale(Math.min(maxW / img.width, maxH / img.height));
  c.add(img);
  return img;
}

/** Ascend and Apex share the animated hero-colour border. Apex adds hero particles and a hero-matching glow. */
function tierFrame(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, w: number, h: number, r: number, big = false) {
  if (v.tier === "base" || v.skill) return;
  const glow = scene.add.graphics();
  glow.lineStyle(big ? 4 : 2.5, v.color, 0.9).strokeRoundedRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, r + 1);
  // High-tech corner bracket accents
  const cs = Math.max(6, w * 0.12);
  glow.lineStyle(big ? 2.5 : 1.5, 0xffffff, 0.85);
  glow.lineBetween(-w / 2, -h / 2 + cs, -w / 2, -h / 2);
  glow.lineBetween(-w / 2, -h / 2, -w / 2 + cs, -h / 2);
  glow.lineBetween(w / 2 - cs, -h / 2, w / 2, -h / 2);
  glow.lineBetween(w / 2, -h / 2, w / 2, -h / 2 + cs);
  c.add(glow);
  scene.tweens.add({ targets: glow, alpha: 0.45, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });

  if (v.tier !== "apex") return;
  const aura = scene.add.graphics();
  aura.fillGradientStyle(v.color, v.color, v.color, v.color, 0.45, 0.45, 0, 0).fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.35);
  aura.setBlendMode(Phaser.BlendModes.ADD);
  c.add(aura);
  scene.tweens.add({ targets: aura, alpha: 0.35, duration: 1400, yoyo: true, repeat: -1 });

  // Diagonal holographic light sweep
  const sweep = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  sweep.fillGradientStyle(0xffffff, 0xffffff, v.color, v.color, 0.0, 0.35, 0.0, 0.35)
    .fillRect(-w * 0.6, -h / 2, w * 0.3, h);
  sweep.setAngle(20).setAlpha(0.35);
  c.add(sweep);
  scene.tweens.add({ targets: sweep, x: w * 1.2, duration: 2400, repeat: -1, ease: "Sine.inOut" });

}

/** Card for hand and board: art, name logo, cost and power only — no ability text (tap for details). */
export function createCard(scene: Phaser.Scene, v: CardView, w: number, h: number, opts: { enemy?: boolean; power?: number; hidePower?: boolean; concealed?: boolean } = {}) {
  const c = scene.add.container(0, 0);
  cleanCardTweens(scene, c);
  const r = Math.max(4, Math.round(w * 0.08));
  const accent = opts.enemy ? 0xff4a5e : v.ultimate ? GOLD : v.color;
  const b = 2;

  // Layered dark tactical backing & contact shadow
  const base = scene.add.graphics();
  base.fillStyle(0x01040a, 0.6).fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, r);
  base.fillStyle(0x09111e, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  c.add(base);

  if (opts.concealed) {
    if (scene.textures.exists("card-back")) c.add(scene.add.image(0, 0, "card-back").setDisplaySize(w, h));
    c.setSize(w, h); return c;
  }
  if (v.skill) skillArt(scene, c, v, w, h);
  else addArt(scene, c, v, -w / 2 + b, -h / 2 + b, w - b * 2, h - b * 2, 0);

  // Gradient framing & hero-accented border
  const ov = scene.add.graphics();
  ov.fillGradientStyle(0x060c18, 0x060c18, 0x060c18, 0x060c18, 0, 0, 0.92, 0.92).fillRect(-w / 2 + b, h * 0.05, w - b * 2, h / 2 - h * 0.05 - b);
  ov.lineStyle(b, accent, 0.95).strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, v.skill ? r * 2 : r);
  // Sleek inner hairline
  ov.lineStyle(1, 0xffffff, 0.35).strokeRoundedRect(-w / 2 + 2.5, -h / 2 + 2.5, w - 5, h - 5, v.skill ? r * 2 : r);
  c.add(ov);

  tierFrame(scene, c, v, w, h, r);
  addForeground(scene, c, v, w, h);

  // Bottom dark backing for nameplate clarity
  const fade = scene.add.graphics();
  fade.fillGradientStyle(0x060c18, 0x060c18, 0x040812, 0x040812, 0, 0, 0.92, 0.92).fillRect(-w / 2 + b, h * 0.18, w - b * 2, h * 0.32 - b);
  c.add(fade);

  // Hero accent energy rail on bottom
  const rail = scene.add.graphics();
  rail.lineStyle(3, accent, 1).lineBetween(-w / 2 + r + 2, h / 2 - 1.5, w / 2 - r - 2, h / 2 - 1.5);
  rail.lineStyle(1.5, 0xffffff, 0.7).lineBetween(-w * 0.25, h / 2 - 1.5, w * 0.25, h / 2 - 1.5);
  c.add(rail);

  const showPower = v.power !== null && !opts.hidePower;
  if (v.logo && scene.textures.exists(v.logo)) {
    addLogo(scene, c, v.logo, h / 2 - h * 0.09, w * 0.86, h * 0.22, 0);
  } else {
    // Translucent backing pill for hero name
    const pill = scene.add.graphics();
    pill.fillStyle(0x040814, 0.75).fillRoundedRect(-w * 0.44, h / 2 - h * 0.22, w * 0.88, h * 0.16, 4);
    c.add(pill);
    const name = scene.add.text(0, h / 2 - h * 0.14, v.name, {
      fontFamily: FONT,
      fontSize: `${Math.max(11, Math.round(w * 0.15))}px`,
      color: "#f8fafc",
      fontStyle: "900",
      stroke: "#040814",
      strokeThickness: 2.5,
      align: "center",
      wordWrap: { width: w * 0.92 }
    }).setOrigin(0.5);
    if (name.width > w * 0.86) name.setScale((w * 0.86) / name.width);
    c.add(name);
  }

  badges(scene, c, showPower ? v : { ...v, power: null }, w, h, Math.round(w * 0.28), opts.enemy, opts.power);
  c.setSize(w, h);
  return c;
}

/** Compact tactical plates: energy top-left (faceted blue hexagon), power bottom-right; hero name stays centered. */
function badges(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, w: number, h: number, big: number, enemy?: boolean, power?: number) {
  const size = Math.max(22, Math.round(big * 1.05));
  const bx = -w / 2 + size * 0.45, by = -h / 2 + size * 0.42;

  // Tactical hexagonal energy badge (blue faceted plate like reference image)
  const bg = scene.add.graphics();
  const hex = [
    { x: 0, y: -size * 0.52 },
    { x: size * 0.48, y: -size * 0.26 },
    { x: size * 0.48, y: size * 0.26 },
    { x: 0, y: size * 0.52 },
    { x: -size * 0.48, y: size * 0.26 },
    { x: -size * 0.48, y: -size * 0.26 },
  ];
  // Drop shadow
  bg.fillStyle(0x040814, 0.7).fillPoints(hex.map((p) => ({ x: bx + p.x + 1, y: by + p.y + 2 })), true);
  // Outer metallic bezel
  bg.fillStyle(0x0c254a, 1).fillPoints(hex.map((p) => ({ x: bx + p.x, y: by + p.y })), true);
  // Inner blue gradient
  bg.fillGradientStyle(0x1e88e5, 0x1e88e5, 0x0d47a1, 0x0d47a1, 1, 1, 1, 1).fillPoints(hex.map((p) => ({ x: bx + p.x * 0.88, y: by + p.y * 0.88 })), true);
  // Precision electric cyan rim
  bg.lineStyle(1.5, 0x38bdf8, 0.95).strokePoints(hex.map((p) => ({ x: bx + p.x * 0.88, y: by + p.y * 0.88 })), true, true);
  c.add(bg);

  const costTxt = scene.add.text(bx, by, `${v.cost}`, {
    fontFamily: FONT,
    fontSize: `${Math.round(size * 0.82)}px`,
    color: "#ffffff",
    fontStyle: "700",
    stroke: "#061329",
    strokeThickness: 2.5,
  }).setOrigin(0.5);
  c.add(costTxt);

  if (v.power === null) return;
  const px = w / 2 - size * 0.45, py = h / 2 - size * 0.45;
  if (scene.textures.exists("badge-power")) {
    const plate = scene.add.image(px, py, "badge-power").setDisplaySize(size, size);
    if (enemy) plate.setTint(0xff7070);
    c.add(plate);
  } else {
    const pbg = scene.add.graphics();
    const pCol = enemy ? 0xff4a5e : 0xf97316;
    const pDark = enemy ? 0x7f1d1d : 0x7c2d12;
    pbg.fillStyle(0x040814, 0.7).fillPoints(hex.map((p) => ({ x: px + p.x + 1, y: py + p.y + 2 })), true);
    pbg.fillStyle(0x2d1208, 1).fillPoints(hex.map((p) => ({ x: px + p.x, y: py + p.y })), true);
    pbg.fillGradientStyle(pCol, pCol, pDark, pDark, 1, 1, 1, 1).fillPoints(hex.map((p) => ({ x: px + p.x * 0.88, y: py + p.y * 0.88 })), true);
    pbg.lineStyle(1.5, enemy ? 0xfca5a5 : 0xfdba74, 0.95).strokePoints(hex.map((p) => ({ x: px + p.x * 0.88, y: py + p.y * 0.88 })), true, true);
    c.add(pbg);
  }
  const pw = power ?? v.power;
  const txt = enemy ? "#ffffff" : pw > v.power ? "#a0ffcb" : pw < v.power ? "#ffd0d7" : "#ffffff";
  c.add(scene.add.text(px, py + 1, `${pw}`, { fontFamily: FONT, fontSize: `${Math.round(size * 0.82)}px`, color: txt, fontStyle: "700", stroke: "#040814", strokeThickness: 2 }).setOrigin(0.5));
}

/**
 * Marvel Snap-style detail view: large card with frame-break art (Ascend/Apex), name logo,
 * full ability text, gyroscope/pointer tilt parallax. Tap anywhere to close.
 */
export function createDetail(scene: Phaser.Scene, v: CardView, W: number, H: number, opts: { enemy?: boolean; power?: number; note?: string | undefined } = {}) {
  const root = scene.add.container(0, 0).setDepth(500);
  cleanCardTweens(scene, root);
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x050914, 0.88).setInteractive();
  root.add(dim);
  const cw = 420, ch = 600, cx = W / 2, cy = 480;
  const r = 22;
  const accent = opts.enemy ? 0xff4a5e : v.ultimate ? GOLD : v.color;

  // hero-matching backdrop (bigger, pulsing for Apex)
  const back = scene.add.graphics();
  const ar = v.tier === "apex" && !v.skill ? 380 : 300;
  for (let k = 6; k > 0; k--) back.fillStyle(v.color, 0.05 * (7 - k)).fillCircle(cx, cy - 60, (ar * k) / 6);
  back.setBlendMode(Phaser.BlendModes.ADD);
  root.add(back);
  if (v.tier === "apex") scene.tweens.add({ targets: back, alpha: 0.55, duration: 1300, yoyo: true, repeat: -1 });

  const card = scene.add.container(cx, cy);
  root.add(card);
  const bg = scene.add.graphics();
  bg.fillStyle(0x0a0f1c, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, r);
  card.add(bg);

  const artLayer = scene.add.container(0, 0);
  card.add(artLayer);
  if (v.skill) skillArt(scene, artLayer, v, cw, ch);
  else {
    addArt(scene, artLayer, v, -cw / 2 + 3, -ch / 2 + 3, cw - 6, ch - 6, 0);
  }
  const fr = scene.add.graphics();
  fr.fillGradientStyle(0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0, 0, 1, 1).fillRect(-cw / 2 + 3, 60, cw - 6, ch / 2 - 63);
  fr.lineStyle(5, accent, 1).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, r);
  card.add(fr);
  tierFrame(scene, card, v, cw, ch, r, true);
  addForeground(scene, card, v, cw, ch);
  const fade = scene.add.graphics();
  fade.fillGradientStyle(0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0, 0, 0.95, 0.95).fillRect(-cw / 2 + 3, ch * 0.15, cw - 6, ch * 0.35 - 3);
  card.add(fade);
  const rail = scene.add.graphics();
  rail.lineStyle(5, accent, 1).lineBetween(-cw / 2 + r, ch / 2, cw / 2 - r, ch / 2);
  card.add(rail);
  if (v.logo) addLogo(scene, card, v.logo, ch / 2 - ch * 0.09, cw * 0.86, ch * 0.22, 0);
  else card.add(scene.add.text(0, ch / 2 - 80, v.name, { fontFamily: FONT, fontSize: "60px", color: "#ffffff", fontStyle: "700", stroke: "#0a0f1c", strokeThickness: 6, align: "center", wordWrap: { width: cw - 40 } }).setOrigin(0.5));
  if (v.skill && !scene.textures.exists(skillArtKey(v.id))) card.add(scene.add.text(0, -ch / 2 + 30, "SKILL ART COMING", { fontFamily: FONT, fontSize: "22px", color: "#9fb0d8", backgroundColor: "#0a0f1ccc", padding: { x: 8, y: 0 } }).setOrigin(0.5, 0));
  badges(scene, card, v, cw, ch, 92, opts.enemy, opts.power);

  // info panel
  const py = cy + ch / 2 + 40;
  const col = Phaser.Display.Color.IntegerToColor(accent).rgba;
  root.add(scene.add.text(W / 2, py, `${v.sub}${v.skill ? "" : ` · ${TIER_LABEL[v.tier]}`}`, { fontFamily: FONT, fontSize: "36px", color: col, fontStyle: "700" }).setOrigin(0.5, 0));
  const description = scene.add.text(W / 2, py + 44, v.text, { fontFamily: FONT, fontSize: "40px", color: "#ffffff", align: "center", wordWrap: { width: W - 100 } }).setOrigin(0.5, 0);
  root.add(description);
  root.add(scene.add.text(W / 2, py + 52 + description.height, opts.note ? `${v.trigger}\n${opts.note}` : v.trigger, { fontFamily: FONT, fontSize: "28px", color: "#9fb0d8", align: "center", wordWrap: { width: W - 100 } }).setOrigin(0.5, 0));
  root.add(scene.add.text(W / 2, H - 60, "TAP TO CLOSE", { fontFamily: FONT, fontSize: "26px", color: "#6f80a8" }).setOrigin(0.5));

  const tilt = (nx: number, ny: number) => {
    card.setRotation(nx * 0.05);
    card.setY(cy + ny * 8);
  };
  const onMove = (p: Phaser.Input.Pointer) => tilt((p.x / W - 0.5) * 2, (p.y / H - 0.5) * 2);
  const onOrient = (e: DeviceOrientationEvent) => tilt(Phaser.Math.Clamp((e.gamma ?? 0) / 30, -1, 1), Phaser.Math.Clamp(((e.beta ?? 45) - 45) / 30, -1, 1));
  scene.input.on("pointermove", onMove);
  window.addEventListener("deviceorientation", onOrient);
  const close = () => {
    scene.input.off("pointermove", onMove);
    window.removeEventListener("deviceorientation", onOrient);
    scene.tweens.add({ targets: root, alpha: 0, duration: 140, onComplete: () => root.destroy() });
  };
  dim.on("pointerup", close);

  card.setScale(0.5).setAlpha(0);
  scene.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 260, ease: "Back.out" });
  return { root, close };
}
