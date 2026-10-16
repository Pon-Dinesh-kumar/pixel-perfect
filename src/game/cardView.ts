import * as Phaser from "phaser";
import { HERO_BY_ID, isHeroId, type HeroId } from "./heroes";
import { artKey } from "./heroArt";
import { SKILL_BY_ID } from "./skills";
import { heroPower } from "./rules";
import type { Tier } from "./tiers";

export const FONT = "Teko, Rajdhani, sans-serif";

export interface CardView {
  name: string; cost: number; power: number | null; color: number; art: string;
  sub: string; text: string; skill: boolean; ultimate: boolean; tier: Tier;
}

/** Display data for a hero or skill card. Skill cards use their hero's tier art as a placeholder. */
export function viewOf(id: string, tierFor: (h: HeroId) => Tier): CardView {
  if (isHeroId(id)) {
    const h = HERO_BY_ID[id], tier = tierFor(id);
    return { name: h.name, cost: h.cost, power: heroPower(id, tier), color: h.color, art: artKey(id, tier), sub: h.passive.name, text: h.passive.text, skill: false, ultimate: false, tier };
  }
  const s = SKILL_BY_ID[id]!, tier = tierFor(s.hero);
  return { name: s.name, cost: s.cost, power: null, color: HERO_BY_ID[s.hero].color, art: artKey(s.hero, tier), sub: s.ultimate ? "ULTIMATE SKILL" : "SKILL", text: s.text, skill: true, ultimate: s.ultimate, tier };
}

/** Reusable card component. Origin is centre. */
export function createCard(scene: Phaser.Scene, v: CardView, w: number, h: number, opts: { enemy?: boolean; power?: number; compact?: boolean } = {}) {
  const c = scene.add.container(0, 0);
  const r = Math.max(4, Math.round(w * 0.07));
  const accent = opts.enemy ? 0xff4a5e : v.ultimate ? 0xffc23a : v.color;
  const b = v.tier === "apex" ? 3 : 2;
  const artH = Math.round(h * (opts.compact ? 0.78 : 0.6));

  const base = scene.add.graphics();
  base.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, r);
  base.fillStyle(0x0a0f1c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  c.add(base);

  if (scene.textures.exists(v.art)) {
    const img = scene.add.image(0, 0, v.art);
    const tw = img.width, th = img.height;
    const aw = w - b * 2, ah = artH - b;
    const cropH = Math.min(th, tw * (ah / aw)) * (v.skill ? 0.6 : 1);
    const cropW = cropH * (aw / ah);
    const cx = (tw - cropW) / 2, cy = th * (v.skill ? 0.12 : 0.04);
    img.setCrop(cx, cy, cropW, cropH);
    const sc = aw / cropW;
    img.setScale(sc).setOrigin(0, 0);
    img.setPosition(-w / 2 + b - cx * sc, -h / 2 + b - cy * sc);
    c.add(img);
  }

  const ov = scene.add.graphics();
  const aw = w - b * 2;
  if (v.skill) {
    // skill overlay: tinted glass + diagonal energy streaks
    ov.fillStyle(v.color, 0.28).fillRect(-w / 2 + b, -h / 2 + b, aw, artH - b);
    ov.lineStyle(2, 0xffffff, 0.35);
    for (let k = -2; k < 4; k++) ov.lineBetween(-w / 2 + k * w * 0.3, -h / 2 + artH, -w / 2 + k * w * 0.3 + artH * 0.6, -h / 2 + b);
  }
  ov.fillGradientStyle(0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0, 0, 0.95, 0.95).fillRect(-w / 2 + b, -h / 2 + artH * 0.55, aw, artH * 0.45);
  ov.fillStyle(0x0a0f1c, 1).fillRect(-w / 2 + b, -h / 2 + artH, aw, h - artH - b);
  ov.fillStyle(accent, 1).fillRect(-w / 2 + b, -h / 2 + artH - 1, aw, 2);
  ov.lineStyle(b, accent, 1).strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, v.skill ? r * 2 : r);
  ov.lineStyle(1, 0xffffff, 0.25).strokeRoundedRect(-w / 2 + b + 1, -h / 2 + b + 1, w - b * 2 - 2, h - b * 2 - 2, Math.max(2, r - 2));
  c.add(ov);

  const fs = Math.max(11, Math.round(w * (v.skill ? 0.12 : 0.15)));
  const nameY = opts.compact ? -h / 2 + artH + (h - artH) / 2 + 1 : -h / 2 + artH + 11;
  const name = scene.add.text(opts.compact ? -w * 0.06 : 0, nameY, v.name, { fontFamily: FONT, fontSize: `${fs}px`, color: "#f2f5ff", fontStyle: "600" }).setOrigin(0.5);
  const maxNameW = opts.compact ? w * 0.6 : w * 0.86;
  if (name.width > maxNameW) name.setScale(maxNameW / name.width);
  c.add(name);
  if (!opts.compact) {
    const pc = Phaser.Display.Color.IntegerToColor(accent).rgba;
    const sub = scene.add.text(0, nameY + 16, v.sub, { fontFamily: FONT, fontSize: "14px", color: pc, fontStyle: "600" }).setOrigin(0.5);
    if (sub.width > w - 10) sub.setScale((w - 10) / sub.width);
    c.add(sub);
    const pt = scene.add.text(0, nameY + 26, v.text, { fontFamily: FONT, fontSize: "16px", color: "#dfe7ff", align: "center", wordWrap: { width: (w - 12) * 1.25 } }).setOrigin(0.5, 0).setScale(0.8);
    c.add(pt);
  }

  const big = Math.round(w * 0.28);
  const hx = -w / 2 + big * 0.42, hy = -h / 2 + big * 0.42, hr = big * 0.5;
  const cg = scene.add.graphics();
  const hex = Array.from({ length: 6 }, (_, k) => ({ x: hx + Math.cos((k / 6) * Math.PI * 2) * hr, y: hy + Math.sin((k / 6) * Math.PI * 2) * hr }));
  cg.fillStyle(v.skill ? 0x8a3bff : 0x1b6bff, 1).fillPoints(hex, true).lineStyle(2, 0xdff2ff, 1).strokePoints(hex, true, true);
  c.add(cg);
  c.add(scene.add.text(hx, hy + 2, `${v.cost}`, { fontFamily: FONT, fontSize: `${big}px`, color: "#ffffff", fontStyle: "700" }).setOrigin(0.5));

  if (v.power !== null) {
    const px = w / 2 - big * 0.42, py = h / 2 - big * 0.42, ps = big * 0.46;
    const pg = scene.add.graphics();
    const pcol = opts.enemy ? 0xe0283f : 0xffc23a;
    const dia = [{ x: px, y: py - ps }, { x: px + ps, y: py }, { x: px, y: py + ps }, { x: px - ps, y: py }];
    pg.fillStyle(pcol, 1).fillPoints(dia, true).lineStyle(2, 0xffffff, 1).strokePoints(dia, true, true);
    c.add(pg);
    const pw = opts.power ?? v.power;
    const txt = opts.enemy ? "#ffffff" : pw > v.power ? "#0b7a2e" : pw < v.power ? "#b00020" : "#1a1206";
    c.add(scene.add.text(px, py + 2, `${pw}`, { fontFamily: FONT, fontSize: `${big}px`, color: txt, fontStyle: "700" }).setOrigin(0.5));
    if (pw !== v.power) {
      const tag = scene.add.graphics();
      tag.fillStyle(pw > v.power ? 0x2fd36b : 0xff4a5e, 1).fillCircle(px - ps - 2, py - ps + 2, 5);
      c.add(tag);
    }
  }
  if (v.tier !== "base" && !v.skill) {
    const t = scene.add.text(w / 2 - 4, -h / 2 + 4, v.tier === "apex" ? "★★" : "★", { fontFamily: FONT, fontSize: `${Math.max(10, Math.round(w * 0.12))}px`, color: "#ffd76a" }).setOrigin(1, 0);
    c.add(t);
  }

  c.setSize(w, h);
  return c;
}
