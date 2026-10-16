import * as Phaser from "phaser";
import { HERO_EFFECTS } from "./heroEffects";
import { HERO_BY_ID, isHeroId, type HeroId } from "./heroes";
import { artKey, logoKey } from "./heroArt";
import { SKILL_BY_ID, type SkillEffect } from "./skills";
import { heroPower } from "./rules";
import { TIER_LABEL, type Tier } from "./tiers";

export const FONT = "Teko, Rajdhani, sans-serif";
const GOLD = 0xffc23a;

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
  const s = SKILL_BY_ID[id]!, tier = tierFor(s.hero);
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

/** Placeholder skill art: weapon/ability emblem by effect type, tinted in the hero colour. */
function skillArt(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, w: number, h: number) {
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
  glow.lineStyle(big ? 5 : 3, v.color, 1).strokeRoundedRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, r + 1);
  c.add(glow);
  scene.tweens.add({ targets: glow, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  if (v.tier !== "apex") return;
  const aura = scene.add.graphics();
  aura.fillGradientStyle(v.color, v.color, v.color, v.color, 0.45, 0.45, 0, 0).fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.35);
  aura.setBlendMode(Phaser.BlendModes.ADD);
  c.add(aura);
  scene.tweens.add({ targets: aura, alpha: 0.4, duration: 1400, yoyo: true, repeat: -1 });
  const fx = HERO_EFFECTS[v.hero];
  const count = big ? 12 : 4;
  for (let k = 0; k < count; k++) {
    const p = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const radius = Math.max(2, w * (big ? 0.016 : 0.035));
    const points = Array.from({ length: Math.max(3, fx.sides) }, (_, j) => ({
      x: Math.cos(j / Math.max(3, fx.sides) * Math.PI * 2) * radius,
      y: Math.sin(j / Math.max(3, fx.sides) * Math.PI * 2) * radius * (fx.sides === 2 ? 3 : 1),
    }));
    if (["chakra", "gravity", "clock", "kolam", "tide", "sonic"].includes(fx.motif)) {
      p.lineStyle(Math.max(1, radius * 0.2), v.color).strokePoints(points, true, true);
      if (fx.motif === "clock" || fx.motif === "kolam") p.lineBetween(-radius, 0, radius, 0).lineBetween(0, -radius, 0, radius);
    } else p.fillStyle(v.color).fillPoints(points, true);
    c.add(p);
    const reset = () => p.setPosition(-w / 2 + 6 + (k / count) * (w - 12), h / 2 - 6).setAlpha(0.85).setRotation(k);
    reset();
    scene.tweens.add({ targets: p, y: -h / 2 - 12, x: `+=${fx.drift}`, rotation: `+=${fx.motif === "clock" ? -6.28 : 3.14}`,
      alpha: 0, duration: fx.speed, delay: k * 190, repeat: -1, onRepeat: reset });
  }
}

/** Card for hand and board: art, name logo, cost and power only — no ability text (tap for details). */
export function createCard(scene: Phaser.Scene, v: CardView, w: number, h: number, opts: { enemy?: boolean; power?: number; hidePower?: boolean; concealed?: boolean } = {}) {
  const c = scene.add.container(0, 0);
  const r = Math.max(4, Math.round(w * 0.08));
  const accent = opts.enemy ? 0xff4a5e : v.ultimate ? GOLD : v.color;
  const b = 2;

  const base = scene.add.graphics();
  base.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, r);
  base.fillStyle(0x0a0f1c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  c.add(base);
  if (opts.concealed) {
    const back = scene.add.graphics();
    back.fillStyle(v.color, 0.2).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r);
    back.lineStyle(2, v.color).strokePoints([{ x: 0, y: -h * 0.28 }, { x: w * 0.3, y: 0 }, { x: 0, y: h * 0.28 }, { x: -w * 0.3, y: 0 }], true, true);
    c.add(back);
    c.add(scene.add.text(0, 0, "S", { fontFamily: FONT, fontSize: `${w * 0.5}px`, color: "#f2f5ff" }).setOrigin(0.5));
    c.setSize(w, h); return c;
  }
  if (v.skill) skillArt(scene, c, v, w, h);
  else {
    const spill = v.tier === "base" ? 0 : h * 0.025;
    addArt(scene, c, v, -w / 2 + b - spill * 0.2, -h / 2 + b - spill, w - b * 2 + spill * 0.4, h - b * 2 + spill, 0);
  }

  const ov = scene.add.graphics();
  ov.fillGradientStyle(0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0, 0, 0.95, 0.95).fillRect(-w / 2 + b, h * 0.05, w - b * 2, h / 2 - h * 0.05 - b);
  ov.lineStyle(b, accent, 1).strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, v.skill ? r * 2 : r);
  c.add(ov);
  tierFrame(scene, c, v, w, h, r);

  const showPower = v.power !== null && !opts.hidePower;
  if (v.logo && scene.textures.exists(v.logo)) addLogo(scene, c, v.logo, h / 2 - h * 0.03, w * (showPower ? 0.8 : 0.96), h * 0.24, showPower ? -w * 0.08 : 0);
  else {
    const name = scene.add.text(0, h / 2 - h * 0.11, v.name, { fontFamily: FONT, fontSize: `${Math.max(12, Math.round(w * 0.15))}px`, color: "#f2f5ff", fontStyle: "700", stroke: "#0a0f1c", strokeThickness: 4, align: "center", wordWrap: { width: w * 0.95 } }).setOrigin(0.5);
    if (name.width > w * 0.92) name.setScale((w * 0.92) / name.width);
    c.add(name);
  }

  badges(scene, c, showPower ? v : { ...v, power: null }, w, h, Math.round(w * 0.28), opts.enemy, opts.power);
  c.setSize(w, h);
  return c;
}

/** Cost: angled energy shard notched into the top-left. Power: shield plate at the bottom-right. */
function badges(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, w: number, h: number, big: number, enemy?: boolean, power?: number) {
  const size = big * 1.25;
  const x = -w / 2 + size * 0.3, y = -h / 2 + size * 0.3;
  if (scene.textures.exists("badge-cost")) c.add(scene.add.image(x, y, "badge-cost").setDisplaySize(size, size));
  c.add(scene.add.text(x, y + 1, `${v.cost}`, { fontFamily: FONT, fontSize: `${Math.round(big * 0.9)}px`, color: "#ffffff", fontStyle: "700", stroke: "#0a1a40", strokeThickness: 2 }).setOrigin(0.5));
  if (v.power === null) return;
  const px = w / 2 - size * 0.3, py = h / 2 - size * 0.3;
  if (scene.textures.exists("badge-power")) {
    const plate = scene.add.image(px, py, "badge-power").setDisplaySize(size, size);
    if (enemy) plate.setTint(0xff7070);
    c.add(plate);
  }
  const pw = power ?? v.power;
  const txt = enemy ? "#ffffff" : pw > v.power ? "#0b7a2e" : pw < v.power ? "#b00020" : "#1a1206";
  c.add(scene.add.text(px, py + 1, `${pw}`, { fontFamily: FONT, fontSize: `${Math.round(big * 0.9)}px`, color: txt, fontStyle: "700" }).setOrigin(0.5));
}

/**
 * Marvel Snap-style detail view: large card with frame-break art (Ascend/Apex), name logo,
 * full ability text, gyroscope/pointer tilt parallax. Tap anywhere to close.
 */
export function createDetail(scene: Phaser.Scene, v: CardView, W: number, H: number, opts: { enemy?: boolean; power?: number; note?: string | undefined } = {}) {
  const root = scene.add.container(0, 0).setDepth(500);
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

  const breakOut = v.tier !== "base" && !v.skill ? 16 : 0;
  const artLayer = scene.add.container(0, 0);
  card.add(artLayer);
  if (v.skill) skillArt(scene, artLayer, v, cw, ch);
  else {
    const img = addArt(scene, artLayer, v, -cw / 2 + 3, -ch / 2 + 3 - breakOut, cw - 6, ch - 6 + breakOut, 0.0);
    if (img && breakOut) img.setAlpha(1);
  }
  const fr = scene.add.graphics();
  fr.fillGradientStyle(0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0, 0, 1, 1).fillRect(-cw / 2 + 3, 60, cw - 6, ch / 2 - 63);
  fr.lineStyle(5, accent, 1).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, r);
  card.add(fr);
  tierFrame(scene, card, v, cw, ch, r, true);
  if (v.logo) addLogo(scene, card, v.logo, ch / 2 - 18, cw * 0.78, 140, -cw * 0.07);
  else card.add(scene.add.text(0, ch / 2 - 80, v.name, { fontFamily: FONT, fontSize: "60px", color: "#ffffff", fontStyle: "700", stroke: "#0a0f1c", strokeThickness: 6, align: "center", wordWrap: { width: cw - 40 } }).setOrigin(0.5));
  if (v.skill) card.add(scene.add.text(0, -ch / 2 + 30, "SKILL ART COMING", { fontFamily: FONT, fontSize: "22px", color: "#9fb0d8", backgroundColor: "#0a0f1ccc", padding: { x: 8, y: 0 } }).setOrigin(0.5, 0));
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
    artLayer.setPosition(nx * -14, ny * -10);
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
