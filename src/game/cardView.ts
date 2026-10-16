import * as Phaser from "phaser";
import { CARDS, type CardId } from "./cards";

export const FONT = "Teko, Rajdhani, sans-serif";
/** Texture key for a card's illustration. Swap the loaded image to drop in final art. */
export const artKey = (id: CardId) => `art-${id}`;

/** Reusable card component. Origin is centre. */
export function createCard(scene: Phaser.Scene, id: CardId, w: number, h: number, opts: { enemy?: boolean; power?: number; compact?: boolean } = {}) {
  const def = CARDS[id];
  const c = scene.add.container(0, 0);
  const r = Math.max(4, Math.round(w * 0.07));
  const accent = opts.enemy ? 0xff4a5e : def.glow;
  const b = 2; // frame thickness
  const artH = Math.round(h * (opts.compact ? 0.78 : 0.6));

  const base = scene.add.graphics();
  base.fillStyle(0x000000, 0.5).fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, r);
  base.fillStyle(0x0a0f1c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  c.add(base);

  // illustration, cropped to cover the art window
  const img = scene.add.image(0, 0, artKey(id));
  const tw = img.width, th = img.height;
  const aw = w - b * 2, ah = artH - b;
  const cropH = Math.min(th, tw * (ah / aw));
  const cropW = cropH * (aw / ah);
  const cx = (tw - cropW) / 2, cy = th * 0.04;
  img.setCrop(cx, cy, cropW, cropH);
  const sc = aw / cropW;
  img.setScale(sc).setOrigin(0, 0);
  img.setPosition(-w / 2 + b - cx * sc, -h / 2 + b - cy * sc);
  c.add(img);

  // bottom shade + name plate
  const ov = scene.add.graphics();
  ov.fillGradientStyle(0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0x0a0f1c, 0, 0, 0.95, 0.95).fillRect(-w / 2 + b, -h / 2 + artH * 0.55, aw, artH * 0.45);
  ov.fillStyle(0x0a0f1c, 1).fillRect(-w / 2 + b, -h / 2 + artH, aw, h - artH - b);
  ov.fillStyle(accent, 1).fillRect(-w / 2 + b, -h / 2 + artH - 1, aw, 2);
  // frame
  ov.lineStyle(b, accent, 1).strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, r);
  ov.lineStyle(1, 0xffffff, 0.25).strokeRoundedRect(-w / 2 + b + 1, -h / 2 + b + 1, w - b * 2 - 2, h - b * 2 - 2, r - 2);
  c.add(ov);

  const fs = Math.max(11, Math.round(w * 0.15));
  const nameY = opts.compact ? -h / 2 + artH + (h - artH) / 2 + 1 : -h / 2 + artH + 11;
  const name = scene.add.text(opts.compact ? -w * 0.06 : 0, nameY, def.name, {
    fontFamily: FONT, fontSize: `${fs}px`, color: "#f2f5ff", fontStyle: "600",
  }).setOrigin(0.5);
  const maxNameW = opts.compact ? w * 0.6 : w * 0.86;
  if (name.width > maxNameW) name.setScale(maxNameW / name.width);
  c.add(name);
  if (!opts.compact) {
    const pc = Phaser.Display.Color.IntegerToColor(accent).rgba;
    c.add(scene.add.text(0, nameY + 16, def.passive.name, { fontFamily: FONT, fontSize: "14px", color: pc, fontStyle: "600" }).setOrigin(0.5));
    const pt = scene.add.text(-w / 2 + 7, nameY + 26, def.passive.text, { fontFamily: FONT, fontSize: "16px", color: "#dfe7ff" }).setOrigin(0, 0);
    if (pt.width > w - 40) pt.setScale((w - 40) / pt.width);
    c.add(pt);
  }

  // cost hexagon (upper-left)
  const big = Math.round(w * 0.28);
  const hx = -w / 2 + big * 0.42, hy = -h / 2 + big * 0.42, hr = big * 0.5;
  const cg = scene.add.graphics();
  const hex = Array.from({ length: 6 }, (_, k) => ({ x: hx + Math.cos((k / 6) * Math.PI * 2) * hr, y: hy + Math.sin((k / 6) * Math.PI * 2) * hr }));
  cg.fillStyle(0x1b6bff, 1).fillPoints(hex, true).lineStyle(2, 0xdff2ff, 1).strokePoints(hex, true, true);
  c.add(cg);
  c.add(scene.add.text(hx, hy + 2, `${def.cost}`, { fontFamily: FONT, fontSize: `${big}px`, color: "#ffffff", fontStyle: "700" }).setOrigin(0.5));

  // power badge (lower-right)
  const px = w / 2 - big * 0.42, py = h / 2 - big * 0.42, ps = big * 0.46;
  const pg = scene.add.graphics();
  const pcol = opts.enemy ? 0xe0283f : 0xffc23a;
  const dia = [{ x: px, y: py - ps }, { x: px + ps, y: py }, { x: px, y: py + ps }, { x: px - ps, y: py }];
  pg.fillStyle(pcol, 1).fillPoints(dia, true).lineStyle(2, 0xffffff, 1).strokePoints(dia, true, true);
  c.add(pg);
  const pw = opts.power ?? def.power;
  const pcolTxt = pw > def.power ? "#0b7a2e" : pw < def.power ? "#b00020" : opts.enemy ? "#ffffff" : "#1a1206";
  c.add(scene.add.text(px, py + 2, `${pw}`, { fontFamily: FONT, fontSize: `${big}px`, color: pw !== def.power && opts.enemy ? "#ffffff" : pcolTxt, fontStyle: "700" }).setOrigin(0.5));
  if (pw !== def.power) {
    const up = pw > def.power;
    const tag = scene.add.graphics();
    tag.fillStyle(up ? 0x2fd36b : 0xff4a5e, 1).fillCircle(px - ps - 2, py - ps + 2, 5);
    c.add(tag);
  }

  c.setSize(w, h);
  return c;
}
