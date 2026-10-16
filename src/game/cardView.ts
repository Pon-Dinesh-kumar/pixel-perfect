import Phaser from "phaser";
import { CARDS, type CardId } from "./cards";

export const FONT = "Teko, Rajdhani, sans-serif";

/** Reusable card component. Width/height in px; origin is centre. */
export function createCard(scene: Phaser.Scene, id: CardId, w: number, h: number, opts: { enemy?: boolean } = {}) {
  const def = CARDS[id];
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const r = Math.round(w * 0.08);
  const frame = opts.enemy ? 0xff3b4e : def.glow;

  // drop shadow
  g.fillStyle(0x000000, 0.45).fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, r);
  // outer frame
  g.fillStyle(frame, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  // art panel
  g.fillStyle(0x0b1222, 1).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r - 2);
  g.fillStyle(def.color, 0.85).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.62, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });
  // diagonal slash for graphic energy
  g.fillStyle(0xffffff, 0.12).fillTriangle(-w / 2 + 3, -h / 2 + h * 0.5, w / 2 - 3, -h / 2 + 3, w / 2 - 3, -h / 2 + h * 0.2);
  g.fillStyle(0x000000, 0.25).fillTriangle(-w / 2 + 3, -h / 2 + h * 0.65, w / 2 - 3, -h / 2 + h * 0.3, w / 2 - 3, -h / 2 + h * 0.65);
  c.add(g);

  // icon (placeholder for future hero art)
  const ig = scene.add.graphics();
  const s = w * 0.2;
  const iy = -h / 2 + h * 0.33;
  ig.fillStyle(0xffffff, 0.95).lineStyle(2, 0x0b1222, 0.6);
  if (def.icon === "shield") {
    ig.fillPoints([{ x: -s, y: iy - s }, { x: s, y: iy - s }, { x: s, y: iy }, { x: 0, y: iy + s * 1.2 }, { x: -s, y: iy }], true);
  } else if (def.icon === "blade") {
    ig.fillPoints([{ x: -s * 0.3, y: iy + s }, { x: s * 0.9, y: iy - s * 1.1 }, { x: s * 0.3, y: iy + s }], true);
    ig.fillPoints([{ x: s * 0.3, y: iy + s }, { x: -s * 0.9, y: iy - s * 1.1 }, { x: -s * 0.3, y: iy + s }], true);
  } else if (def.icon === "wing") {
    ig.fillPoints([{ x: 0, y: iy + s }, { x: -s * 1.2, y: iy - s }, { x: -s * 0.2, y: iy - s * 0.2 }, { x: 0, y: iy - s * 1.2 }, { x: s * 0.2, y: iy - s * 0.2 }, { x: s * 1.2, y: iy - s }], true);
  } else {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? s * 0.45 : s * 1.2;
      pts.push({ x: Math.cos(a) * rr, y: iy + Math.sin(a) * rr });
    }
    ig.fillPoints(pts, true);
  }
  c.add(ig);

  const big = Math.round(w * 0.3);
  const name = scene.add.text(0, h / 2 - h * 0.25, def.name, {
    fontFamily: FONT, fontSize: `${Math.round(w * 0.17)}px`, color: "#ffffff", fontStyle: "600", align: "center",
  }).setOrigin(0.5);
  if (name.width > w - 8) name.setScale((w - 8) / name.width);
  c.add(name);

  // cost badge
  const cb = scene.add.graphics();
  cb.fillStyle(0x1f6fff, 1).lineStyle(2, 0xffffff, 1);
  cb.fillCircle(-w / 2 + big * 0.45, -h / 2 + big * 0.45, big * 0.48).strokeCircle(-w / 2 + big * 0.45, -h / 2 + big * 0.45, big * 0.48);
  c.add(cb);
  c.add(scene.add.text(-w / 2 + big * 0.45, -h / 2 + big * 0.5, `${def.cost}`, { fontFamily: FONT, fontSize: `${big}px`, color: "#ffffff", fontStyle: "700" }).setOrigin(0.5));

  // power badge
  const pb = scene.add.graphics();
  pb.fillStyle(opts.enemy ? 0xd8233a : 0xffc23a, 1).lineStyle(2, 0xffffff, 1);
  const px = w / 2 - big * 0.45, py = h / 2 - big * 0.45;
  pb.fillRoundedRect(px - big * 0.48, py - big * 0.48, big * 0.96, big * 0.96, 4).strokeRoundedRect(px - big * 0.48, py - big * 0.48, big * 0.96, big * 0.96, 4);
  c.add(pb);
  c.add(scene.add.text(px, py + 2, `${def.power}`, { fontFamily: FONT, fontSize: `${big}px`, color: opts.enemy ? "#ffffff" : "#1a1206", fontStyle: "700" }).setOrigin(0.5));

  c.setSize(w, h);
  return c;
}
