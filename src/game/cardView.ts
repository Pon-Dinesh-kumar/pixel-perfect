import * as Phaser from "phaser";
import { HERO_BY_ID, isHeroId, type HeroId } from "./heroes";
import { artKey, logoKey } from "./heroArt";
import { SKILL_BY_ID } from "./skills";
import { heroPower } from "./rules";
import { TIER_LABEL, type Tier } from "./tiers";

export const FONT = "Teko, Rajdhani, sans-serif";
const GOLD = 0xffc23a;

export interface CardView {
  id: string; hero: HeroId; name: string; cost: number; power: number | null; color: number; art: string; logo: string | null;
  sub: string; text: string; trigger: string; skill: boolean; ultimate: boolean; tier: Tier;
}

/** Display data for a hero or skill card. Skill cards use their hero's tier art as a placeholder. */
export function viewOf(id: string, tierFor: (h: HeroId) => Tier): CardView {
  if (isHeroId(id)) {
    const h = HERO_BY_ID[id], tier = tierFor(id);
    return { id, hero: id, name: h.name, cost: h.cost, power: heroPower(id, tier), color: h.color, art: artKey(id, tier), logo: logoKey(id), sub: h.passive.name, text: h.passive.text, trigger: h.passive.trigger, skill: false, ultimate: false, tier };
  }
  const s = SKILL_BY_ID[id]!, tier = tierFor(s.hero);
  return { id, hero: s.hero, name: s.name, cost: s.cost, power: null, color: HERO_BY_ID[s.hero].color, art: artKey(s.hero, tier), logo: null, sub: s.ultimate ? "ULTIMATE SKILL" : "SKILL", text: s.text, trigger: `One use. Created by ${HERO_BY_ID[s.hero].name}. Drop on a carrier.`, skill: true, ultimate: s.ultimate, tier };
}

function addArt(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, x: number, y: number, w: number, h: number, focusTop = 0.03) {
  if (!scene.textures.exists(v.art)) return null;
  const img = scene.add.image(0, 0, v.art);
  const tw = img.width, th = img.height;
  const zoom = v.skill ? 0.6 : 1;
  const cropH = Math.min(th, tw * (h / w)) * zoom;
  const cropW = cropH * (w / h);
  const cx = (tw - cropW) / 2, cy = th * (v.skill ? 0.12 : focusTop);
  img.setCrop(cx, cy, cropW, cropH);
  const sc = w / cropW;
  img.setScale(sc).setOrigin(0, 0).setPosition(x - cx * sc, y - cy * sc);
  c.add(img);
  return img;
}

function addLogo(scene: Phaser.Scene, c: Phaser.GameObjects.Container, key: string, y: number, maxW: number, maxH: number) {
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(0, y, key).setOrigin(0.5, 1);
  img.setScale(Math.min(maxW / img.width, maxH / img.height));
  c.add(img);
  return img;
}

/** Animated tier frame: Ascend pulses in the hero colour, Apex adds a travelling gold spark. */
function tierFrame(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, w: number, h: number, r: number) {
  if (v.tier === "base" || v.skill) return;
  const glow = scene.add.graphics();
  const col = v.tier === "apex" ? GOLD : v.color;
  glow.lineStyle(v.tier === "apex" ? 4 : 3, col, 1).strokeRoundedRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, r + 1);
  c.add(glow);
  scene.tweens.add({ targets: glow, alpha: 0.35, duration: v.tier === "apex" ? 600 : 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  if (v.tier === "apex") {
    const spark = scene.add.circle(0, 0, Math.max(2, w * 0.035), 0xffffff, 1);
    c.add(spark);
    const per = 2 * (w + h);
    scene.tweens.addCounter({
      from: 0, to: per, duration: 2200, repeat: -1,
      onUpdate: (tw) => {
        const d = tw.getValue() ?? 0;
        const [px, py] = d < w ? [d - w / 2, -h / 2] : d < w + h ? [w / 2, d - w - h / 2] : d < 2 * w + h ? [w / 2 - (d - w - h), h / 2] : [-w / 2, h / 2 - (d - 2 * w - h)];
        spark.setPosition(px, py);
      },
    });
  }
}

/** Card for hand and board: art, name logo, cost and power only — no ability text (tap for details). */
export function createCard(scene: Phaser.Scene, v: CardView, w: number, h: number, opts: { enemy?: boolean; power?: number } = {}) {
  const c = scene.add.container(0, 0);
  const r = Math.max(4, Math.round(w * 0.08));
  const accent = opts.enemy ? 0xff4a5e : v.ultimate ? GOLD : v.color;
  const b = 2;

  const base = scene.add.graphics();
  base.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, r);
  base.fillStyle(0x0a0f1c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  c.add(base);
  addArt(scene, c, v, -w / 2 + b, -h / 2 + b, w - b * 2, h - b * 2);

  const ov = scene.add.graphics();
  if (v.skill) {
    ov.fillStyle(v.color, 0.3).fillRect(-w / 2 + b, -h / 2 + b, w - b * 2, h - b * 2);
    ov.lineStyle(2, 0xffffff, 0.3);
    for (let k = -2; k < 4; k++) ov.lineBetween(-w / 2 + k * w * 0.3, h / 2, -w / 2 + k * w * 0.3 + h * 0.6, -h / 2 + b);
  }
  ov.fillGradientStyle(0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0, 0, 0.95, 0.95).fillRect(-w / 2 + b, h * 0.05, w - b * 2, h / 2 - h * 0.05 - b);
  ov.lineStyle(b, accent, 1).strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, v.skill ? r * 2 : r);
  c.add(ov);
  tierFrame(scene, c, v, w, h, r);

  if (v.logo && scene.textures.exists(v.logo)) addLogo(scene, c, v.logo, h / 2 - h * 0.03, w * 0.96, h * 0.26);
  else {
    const name = scene.add.text(0, h / 2 - h * 0.1, v.name, { fontFamily: FONT, fontSize: `${Math.max(12, Math.round(w * 0.16))}px`, color: "#f2f5ff", fontStyle: "700", stroke: "#0a0f1c", strokeThickness: 4, align: "center" }).setOrigin(0.5);
    if (name.width > w * 0.9) name.setScale((w * 0.9) / name.width);
    c.add(name);
  }

  const big = Math.round(w * 0.3);
  badges(scene, c, v, w, h, big, opts.enemy, opts.power);
  c.setSize(w, h);
  return c;
}

function badges(scene: Phaser.Scene, c: Phaser.GameObjects.Container, v: CardView, w: number, h: number, big: number, enemy?: boolean, power?: number) {
  const hx = -w / 2 + big * 0.5, hy = -h / 2 + big * 0.5, hr = big * 0.52;
  const cg = scene.add.graphics();
  const hex = Array.from({ length: 6 }, (_, k) => ({ x: hx + Math.cos((k / 6) * Math.PI * 2) * hr, y: hy + Math.sin((k / 6) * Math.PI * 2) * hr }));
  cg.fillStyle(v.skill ? 0x8a3bff : 0x1b6bff, 1).fillPoints(hex, true).lineStyle(2, 0xdff2ff, 1).strokePoints(hex, true, true);
  c.add(cg);
  c.add(scene.add.text(hx, hy + 2, `${v.cost}`, { fontFamily: FONT, fontSize: `${big}px`, color: "#ffffff", fontStyle: "700" }).setOrigin(0.5));
  if (v.power === null) return;
  const px = w / 2 - big * 0.5, py = -h / 2 + big * 0.5, ps = big * 0.52;
  const pg = scene.add.graphics();
  const dia = [{ x: px, y: py - ps }, { x: px + ps, y: py }, { x: px, y: py + ps }, { x: px - ps, y: py }];
  pg.fillStyle(enemy ? 0xe0283f : GOLD, 1).fillPoints(dia, true).lineStyle(2, 0xffffff, 1).strokePoints(dia, true, true);
  c.add(pg);
  const pw = power ?? v.power;
  const txt = enemy ? "#ffffff" : pw > v.power ? "#0b7a2e" : pw < v.power ? "#b00020" : "#1a1206";
  c.add(scene.add.text(px, py + 2, `${pw}`, { fontFamily: FONT, fontSize: `${big}px`, color: txt, fontStyle: "700" }).setOrigin(0.5));
}

/**
 * Marvel Snap-style detail view: large card with frame-break art (Ascend/Apex), name logo,
 * full ability text, gyroscope/pointer tilt parallax. Tap anywhere to close.
 */
export function createDetail(scene: Phaser.Scene, v: CardView, W: number, H: number, opts: { enemy?: boolean; power?: number; note?: string | undefined } = {}) {
  const root = scene.add.container(0, 0).setDepth(500);
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x050914, 0.86).setInteractive();
  root.add(dim);
  const cw = 420, ch = 600, cx = W / 2, cy = 470;
  const card = scene.add.container(cx, cy);
  root.add(card);
  const r = 22;
  const accent = opts.enemy ? 0xff4a5e : v.tier === "apex" || v.ultimate ? GOLD : v.color;

  const bg = scene.add.graphics();
  bg.fillStyle(v.color, 0.25).fillCircle(0, -40, 300);
  bg.fillStyle(0x0a0f1c, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, r);
  card.add(bg);

  // frame break: upgraded art spills above the top frame edge
  const breakOut = v.tier !== "base" && !v.skill ? (v.tier === "apex" ? 110 : 70) : 0;
  const artLayer = scene.add.container(0, 0);
  card.add(artLayer);
  const img = addArt(scene, artLayer, v, -cw / 2 + 3, -ch / 2 + 3 - breakOut, cw - 6, ch - 6 + breakOut, 0.0);
  if (img) {
    const m = scene.make.graphics({}, false);
    m.fillStyle(0xffffff).fillRoundedRect(cx - cw / 2 + 3, cy - ch / 2 + 3, cw - 6, ch - 6, r - 2);
    if (breakOut) m.fillEllipse(cx, cy - ch / 2 + 40, cw * 0.62, breakOut * 2 + 80);
    img.setMask(m.createGeometryMask());
  }
  const fr = scene.add.graphics();
  fr.fillGradientStyle(0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0, 0, 1, 1).fillRect(-cw / 2 + 3, 60, cw - 6, ch / 2 - 63);
  fr.lineStyle(5, accent, 1).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, r);
  card.add(fr);
  tierFrame(scene, card, v, cw, ch, r);
  if (v.logo) addLogo(scene, card, v.logo, ch / 2 - 18, cw * 0.9, 150);
  else card.add(scene.add.text(0, ch / 2 - 70, v.name, { fontFamily: FONT, fontSize: "64px", color: "#ffffff", fontStyle: "700", stroke: "#0a0f1c", strokeThickness: 6 }).setOrigin(0.5));
  badges(scene, card, v, cw, ch, 96, opts.enemy, opts.power);

  // info panel
  const py = cy + ch / 2 + 40;
  const col = Phaser.Display.Color.IntegerToColor(accent).rgba;
  root.add(scene.add.text(W / 2, py, `${v.sub}${v.skill ? "" : ` · ${TIER_LABEL[v.tier]}`}`, { fontFamily: FONT, fontSize: "36px", color: col, fontStyle: "700" }).setOrigin(0.5, 0));
  root.add(scene.add.text(W / 2, py + 44, v.text, { fontFamily: FONT, fontSize: "40px", color: "#ffffff", align: "center", wordWrap: { width: W - 100 } }).setOrigin(0.5, 0));
  root.add(scene.add.text(W / 2, py + 100, opts.note ? `${v.trigger}\n${opts.note}` : v.trigger, { fontFamily: FONT, fontSize: "28px", color: "#9fb0d8", align: "center", wordWrap: { width: W - 100 } }).setOrigin(0.5, 0));
  root.add(scene.add.text(W / 2, H - 60, "TAP TO CLOSE", { fontFamily: FONT, fontSize: "26px", color: "#6f80a8" }).setOrigin(0.5));

  // tilt: device gyroscope when available, pointer otherwise
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
