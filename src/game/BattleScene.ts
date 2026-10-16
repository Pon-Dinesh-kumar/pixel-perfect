import Phaser from "phaser";
import { CARDS, type CardId } from "./cards";
export interface Assets { sky: string; carrier: string; art: Record<CardId, string> }
import { artKey, createCard, FONT } from "./cardView";
import {
  canPlay, carrierScore, createGame, MAX_ENERGY, MAX_TURNS, nextTurn, opponentTurn, playCard, result, SLOTS,
  type GameState, type Side,
} from "./rules";

export const W = 720;
export const H = 1280;
const CARRIER_Y = [262, 532, 802];
const SLOT_X = [228, 326, 424];
const SLOT_W = 82, SLOT_H = 104;
const ROW_Y = { opponent: -46, player: 40 };
const HAND_Y = 1160, HAND_W = 104, HAND_H = 140;
const HAND_X = [216, 326, 436, 546].map((x) => x - 40);
const LANE_TINT = [0x5fd4ff, 0x7f9dff, 0xff4a5e];
const HUD_BG = 0x0a1020;

export class BattleScene extends Phaser.Scene {
  g!: GameState;
  selected: number | null = null;
  busy = false;
  carriers: Phaser.GameObjects.Container[] = [];
  slotHit: Phaser.GameObjects.Zone[][] = [];
  slotFx: Phaser.GameObjects.Graphics[] = [];
  scoreText: { p: Phaser.GameObjects.Text; o: Phaser.GameObjects.Text }[] = [];
  handLayer!: Phaser.GameObjects.Container;
  energyText!: Phaser.GameObjects.Text;
  energyRing!: Phaser.GameObjects.Graphics;
  turnText!: Phaser.GameObjects.Text;
  statusText!: Phaser.GameObjects.Text;
  endBtn!: Phaser.GameObjects.Container;
  totals!: { p: Phaser.GameObjects.Text; o: Phaser.GameObjects.Text };
  bg!: Phaser.GameObjects.Image;
  overlay?: Phaser.GameObjects.Container;
  placed: Phaser.GameObjects.Container[] = [];

  constructor(private assets: Assets) { super("battle"); }

  preload() {
    this.load.image("sky", this.assets.sky);
    this.load.image("carrier", this.assets.carrier);
    for (const [id, url] of Object.entries(this.assets.art)) this.load.image(artKey(id as CardId), url);
  }

  create() {
    this.g = createGame();
    this.drawEnvironment();
    CARRIER_Y.forEach((y, i) => this.drawCarrier(i, y));
    this.drawTopHud();
    this.drawBottomHud();
    this.handLayer = this.add.container(0, 0).setDepth(50);
    this.refresh();
  }

//ENV//
  // ---------- state → view ----------
  refresh() {
    const g = this.g;
    this.turnText.setText(`TURN ${g.turn}/${MAX_TURNS}`);
    this.statusText.setText(this.busy ? "RIVAL IS PLAYING…" : g.over ? "MATCH OVER" : "YOUR TURN");
    let pt = 0, ot = 0;
    g.carriers.forEach((c, i) => {
      const p = carrierScore(c, "player"), o = carrierScore(c, "opponent");
      pt += p; ot += o;
      this.scoreText[i].p.setText(`${p}`).setAlpha(p >= o ? 1 : 0.55);
      this.scoreText[i].o.setText(`${o}`).setAlpha(o >= p ? 1 : 0.55);
    });
    this.totals.p.setText(`POWER ${pt}`);
    this.totals.o.setText(`POWER ${ot}`);

    // energy ring
    const e = g.player.energy, max = Math.min(g.turn, MAX_ENERGY);
    this.energyRing.clear();
    this.energyRing.fillStyle(0x0b1222, 1).fillCircle(70, 1160, 50);
    this.energyRing.lineStyle(8, 0x223355, 1).strokeCircle(70, 1160, 46);
    if (e > 0) {
      this.energyRing.lineStyle(8, 0x3fa8ff, 1).beginPath()
        .arc(70, 1160, 46, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * e) / Math.max(max, 1)).strokePath();
    }
    this.energyText.setText(`${e}/${max}`);
    this.endBtn.setAlpha(this.busy || g.over ? 0.5 : 1);

    this.drawHand();
    this.drawSlotHighlights();
  }

  drawHand() {
    this.handLayer.removeAll(true);
    this.g.player.hand.forEach((id, idx) => {
      const card = createCard(this, id, HAND_W, HAND_H);
      const sel = this.selected === idx;
      const afford = CARDS[id].cost <= this.g.player.energy && !this.busy && !this.g.over;
      card.setPosition(HAND_X[idx] + 40, HAND_Y + (sel ? -26 : 0)).setScale(sel ? 1.08 : 1).setAlpha(afford ? 1 : 0.5);
      if (sel) {
        const glow = this.add.graphics();
        glow.lineStyle(4, CARDS[id].glow, 1).strokeRoundedRect(-HAND_W / 2 - 4, -HAND_H / 2 - 4, HAND_W + 8, HAND_H + 8, 10);
        card.addAt(glow, 0);
      }
      card.setInteractive({ useHandCursor: true });
      card.on("pointerdown", () => this.selectCard(idx));
      this.handLayer.add(card);
    });
  }

  drawSlotHighlights() {
    this.g.carriers.forEach((c, i) => {
      const fx = this.slotFx[i];
      fx.clear();
      for (let s = 0; s < SLOTS; s++) {
        for (const side of ["opponent", "player"] as Side[]) {
          const { x, y } = this.slotPos(side, s);
          const empty = c[side][s] === null;
          if (!empty) continue;
          const legal = side === "player" && this.selected !== null && canPlay(this.g, "player", this.selected, i, s);
          fx.fillStyle(side === "player" ? 0x4fb8ff : 0xff3b4e, legal ? 0.28 : 0.08);
          fx.fillRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 8);
          fx.lineStyle(legal ? 3 : 1.5, side === "player" ? 0x8fd8ff : 0xff8a95, legal ? 1 : 0.45);
          fx.strokeRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 8);
        }
      }
    });
  }

  // ---------- input ----------
  selectCard(idx: number) {
    if (this.busy || this.g.over) return;
    const id = this.g.player.hand[idx];
    if (CARDS[id].cost > this.g.player.energy) {
      this.flash("NOT ENOUGH ENERGY");
      this.selected = null;
    } else {
      this.selected = this.selected === idx ? null : idx;
    }
    this.refresh();
  }

  tryPlace(carrier: number, slot: number) {
    if (this.busy || this.g.over || this.selected === null) return;
    const idx = this.selected;
    const id = this.g.player.hand[idx];
    if (!canPlay(this.g, "player", idx, carrier, slot)) {
      this.flash(this.g.carriers[carrier].player[slot] ? "SLOT OCCUPIED" : "NOT ENOUGH ENERGY");
      return;
    }
    const from = { x: HAND_X[idx] + 40, y: HAND_Y - 26 };
    playCard(this.g, "player", idx, carrier, slot);
    this.selected = null;
    this.spawnPlaced(id, "player", carrier, slot, from);
    this.refresh();
  }

  spawnPlaced(id: (typeof this.g.player.hand)[number], side: Side, carrier: number, slot: number, fromWorld: { x: number; y: number }) {
    const cont = this.carriers[carrier];
    const { x, y } = this.slotPos(side, slot);
    const card = createCard(this, id, SLOT_W - 6, SLOT_H - 6, { enemy: side === "opponent" });
    card.setPosition(fromWorld.x, fromWorld.y - cont.y).setScale(1.3).setAlpha(0.6);
    cont.add(card);
    this.placed.push(card);
    this.tweens.add({
      targets: card, x, y, scale: 1, alpha: 1, duration: 320, ease: "Back.out",
      onComplete: () => this.impact(cont, x, y, side === "player" ? 0x6fd0ff : 0xff4a5e),
    });
  }

  impact(cont: Phaser.GameObjects.Container, x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 20, color, 0).setStrokeStyle(4, color, 1);
    cont.add(ring);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    for (let k = 0; k < 10; k++) {
      const p = this.add.rectangle(x, y, 3, 12, color, 1).setRotation(Math.random() * Math.PI);
      cont.add(p);
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 30;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 340, onComplete: () => p.destroy() });
    }
    this.cameras.main.shake(80, 0.002);
  }

  flash(msg: string) {
    const t = this.add.text(W / 2, 1040, msg, { fontFamily: FONT, fontSize: "26px", color: "#ffffff", backgroundColor: "#d8233a", padding: { x: 12, y: 2 } })
      .setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: 1020, alpha: 0, delay: 600, duration: 400, onComplete: () => t.destroy() });
  }

  endTurn() {
    if (this.busy || this.g.over) return;
    this.busy = true;
    this.selected = null;
    this.refresh();
    const moves = opponentTurn(this.g);
    moves.forEach((m, k) => {
      this.time.delayedCall(350 + k * 420, () => {
        this.spawnPlaced(m.card, "opponent", m.carrier, m.slot, { x: W - 58, y: 46 });
        this.refresh();
      });
    });
    this.time.delayedCall(450 + moves.length * 420 + 300, () => {
      nextTurn(this.g);
      this.busy = false;
      this.refresh();
      if (this.g.over) this.showResult();
    });
  }

  showResult() {
    const r = result(this.g);
    const o = this.add.container(W / 2, 560).setDepth(100);
    const bg = this.add.graphics();
    const col = r.outcome === "win" ? 0x4fb8ff : r.outcome === "loss" ? 0xff3b4e : 0xffc23a;
    bg.fillStyle(0x0b1222, 0.95).fillRoundedRect(-260, -150, 520, 300, 16);
    bg.lineStyle(4, col, 1).strokeRoundedRect(-260, -150, 520, 300, 16);
    o.add(bg);
    o.add(this.add.text(0, -80, r.outcome === "win" ? "VICTORY" : r.outcome === "loss" ? "DEFEAT" : "DRAW",
      { fontFamily: FONT, fontSize: "84px", color: Phaser.Display.Color.IntegerToColor(col).rgba, fontStyle: "700" }).setOrigin(0.5));
    o.add(this.add.text(0, 0, `CARRIERS WON ${r.won} · LOST ${r.lost}`, { fontFamily: FONT, fontSize: "30px", color: "#dfe7ff" }).setOrigin(0.5));
    const btn = this.add.text(0, 80, "  PLAY AGAIN  ", { fontFamily: FONT, fontSize: "36px", color: "#1a1206", backgroundColor: "#ffc23a", padding: { x: 10, y: 4 }, fontStyle: "700" })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => this.scene.restart());
    o.add(btn);
    o.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 300, ease: "Back.out" });
    this.overlay = o;
  }
}
