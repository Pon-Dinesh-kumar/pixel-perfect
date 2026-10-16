import Phaser from "phaser";
import { CARDS } from "./cards";
import { createCard, FONT } from "./cardView";
import {
  canPlay, carrierScore, createGame, MAX_ENERGY, MAX_TURNS, nextTurn, opponentTurn, playCard, result, SLOTS,
  type GameState, type Side,
} from "./rules";

export const W = 720;
export const H = 1280;
const CARRIER_Y = [270, 540, 810];
const SLOT_X = [270, 370, 470];
const SLOT_W = 80, SLOT_H = 100;
const ROW_OFF = 56;
const HAND_Y = 1160, HAND_W = 104, HAND_H = 140;
const HAND_X = [216, 326, 436, 546].map((x) => x - 40);
const LANE_TINT = [0x5fd4ff, 0x9fb8ff, 0xff4a5e];

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

  constructor(private skyUrl: string) { super("battle"); }

  preload() { this.load.image("sky", this.skyUrl); }

  create() {
    this.g = createGame();
    this.drawEnvironment();
    CARRIER_Y.forEach((y, i) => this.drawCarrier(i, y));
    this.drawTopHud();
    this.drawBottomHud();
    this.handLayer = this.add.container(0, 0).setDepth(50);
    this.refresh();
  }

  // ---------- environment ----------
  drawEnvironment() {
    this.bg = this.add.image(W / 2, H / 2, "sky").setDisplaySize(W + 40, H + 40).setDepth(-10);
    const veil = this.add.graphics().setDepth(-9);
    veil.fillGradientStyle(0x0a1530, 0x0a1530, 0x0a1530, 0x0a1530, 0.55, 0.55, 0.05, 0.05).fillRect(0, 0, W, 300);
    veil.fillGradientStyle(0x0a1530, 0x0a1530, 0x0a1530, 0x0a1530, 0.0, 0.0, 0.85, 0.85).fillRect(0, 880, W, 400);
    // drifting clouds layer for parallax
    const clouds = this.add.graphics().setDepth(-8).setAlpha(0.18);
    clouds.fillStyle(0xffffff, 1);
    for (let i = 0; i < 9; i++) clouds.fillEllipse(Phaser.Math.Between(0, W), Phaser.Math.Between(150, 950), Phaser.Math.Between(140, 260), Phaser.Math.Between(26, 50));
    this.tweens.add({ targets: clouds, x: 40, duration: 9000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.bg.x = W / 2 + (p.x / W - 0.5) * -14;
      this.bg.y = H / 2 + (p.y / H - 0.5) * -10;
    });
  }

  drawCarrier(i: number, y: number) {
    const c = this.add.container(0, y).setDepth(10 + i);
    const tint = LANE_TINT[i];
    const g = this.add.graphics();
    const L = 150, R = 660;
    // contact shadow / atmospheric shadow
    g.fillStyle(0x0a1530, 0.28).fillEllipse((L + R) / 2 + 10, 128, R - L + 60, 26);
    // lower hull (keel)
    g.fillStyle(0x1a2338, 1).fillPoints([{ x: L - 20, y: 18 }, { x: R + 30, y: 10 }, { x: R - 20, y: 92 }, { x: L + 40, y: 100 }], true);
    g.fillStyle(0x0f1626, 1).fillPoints([{ x: L + 40, y: 100 }, { x: R - 20, y: 92 }, { x: R - 60, y: 112 }, { x: L + 80, y: 116 }], true);
    // hull panel lines
    g.lineStyle(1, 0x3a4766, 0.8);
    for (let k = 1; k < 6; k++) g.lineBetween(L + k * 85, 20, L + k * 85 + 10, 96);
    // running lights
    for (let k = 0; k < 7; k++) g.fillStyle(tint, 0.9).fillRect(L + 20 + k * 70, 60, 18, 3);
    // deck surface (top plate, slight perspective)
    g.fillStyle(0x2c3650, 1).fillPoints([{ x: L, y: -108 }, { x: R, y: -108 }, { x: R + 30, y: 18 }, { x: L - 20, y: 18 }], true);
    g.fillStyle(0x36425f, 1).fillPoints([{ x: L + 6, y: -104 }, { x: R - 6, y: -104 }, { x: R + 22, y: 12 }, { x: L - 12, y: 12 }], true);
    // deck grid
    g.lineStyle(1, 0x4b5a80, 0.5);
    for (let k = 0; k < 9; k++) {
      const t = k / 8;
      g.lineBetween(L + (R - L) * t, -104, L - 12 + (R + 22 - (L - 12)) * t, 12);
    }
    // centre divider (ownership line)
    g.lineStyle(3, 0xff3b4e, 0.85).lineBetween(L - 4, -46, R + 10, -46);
    g.lineStyle(3, 0x4fb8ff, 0.85).lineBetween(L - 6, -40, R + 12, -40);
    // rim light on deck edge
    g.lineStyle(2, 0xbfe4ff, 0.7).lineBetween(L, -108, R, -108);
    g.lineStyle(2, tint, 0.9).lineBetween(L - 20, 18, R + 30, 18);
    // bridge tower at stern (right)
    g.fillStyle(0x1e2840, 1).fillPoints([{ x: 590, y: -108 }, { x: 650, y: -108 }, { x: 640, y: -138 }, { x: 600, y: -138 }], true);
    g.fillStyle(tint, 0.9).fillRect(606, -130, 28, 4);
    // engines at stern
    g.fillStyle(0x0f1626, 1).fillRect(R + 18, -10, 26, 30);
    g.fillStyle(tint, 0.9).fillRect(R + 40, -6, 8, 22);
    const flame = this.add.rectangle(R + 56, 5, 20, 14, tint, 0.6);
    this.tweens.add({ targets: flame, scaleX: 1.6, alpha: 0.2, duration: 380, yoyo: true, repeat: -1 });
    c.add([g, flame]);

    // lane badge (left)
    const lb = this.add.graphics();
    lb.fillStyle(0x0b1222, 0.88).fillPoints([{ x: 0, y: -40 }, { x: 140, y: -40 }, { x: 120, y: 30 }, { x: 0, y: 30 }], true);
    lb.fillStyle(tint, 1).fillRect(0, -40, 5, 70);
    c.add(lb);
    c.add(this.add.text(16, -42, `0${i + 1}`, { fontFamily: FONT, fontSize: "40px", color: Phaser.Display.Color.IntegerToColor(tint).rgba, fontStyle: "700" }));
    c.add(this.add.text(16, 2, this.g.carriers[i].name, { fontFamily: FONT, fontSize: "18px", color: "#dfe7ff" }));

    // score panel (right side)
    const sp = this.add.graphics();
    sp.fillStyle(0x0b1222, 0.9).fillRoundedRect(560, -100, 52, 108, 8);
    sp.lineStyle(2, 0xffffff, 0.15).strokeRoundedRect(560, -100, 52, 108, 8);
    c.add(sp);
    const o = this.add.text(586, -74, "0", { fontFamily: FONT, fontSize: "34px", color: "#ff6a78", fontStyle: "700" }).setOrigin(0.5);
    const p = this.add.text(586, -14, "0", { fontFamily: FONT, fontSize: "34px", color: "#6fd0ff", fontStyle: "700" }).setOrigin(0.5);
    c.add([o, p]);
    this.scoreText[i] = { o, p };

    // slots
    const fx = this.add.graphics();
    c.add(fx);
    this.slotFx[i] = fx;
    this.slotHit[i] = [];
    for (let s = 0; s < SLOTS; s++) {
      const z = this.add.zone(SLOT_X[s] - 20, -43 + ROW_OFF * 0.0 + 0, SLOT_W, SLOT_H);
      // player row
      z.setPosition(SLOT_X[s] - 20 + 18, -43 + ROW_OFF);
      z.setInteractive({ useHandCursor: true });
      z.on("pointerdown", () => this.tryPlace(i, s));
      c.add(z);
      this.slotHit[i][s] = z;
    }

    // bob — each carrier with its own phase to sell elevation
    this.tweens.add({ targets: c, y: y - 5, duration: 2200 + i * 300, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: i * 400 });
    this.carriers[i] = c;
  }

  slotPos(side: Side, s: number) {
    return { x: SLOT_X[s] - 2, y: side === "player" ? -43 + ROW_OFF : -43 - ROW_OFF + 10 };
  }

  // ---------- HUD ----------
  drawTopHud() {
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(0x0b1222, 0.92).fillPoints([{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: 92 }, { x: 0, y: 92 }], true);
    g.fillStyle(0xff3b4e, 1).fillRect(0, 90, W, 3);
    // opponent avatar placeholder
    g.fillStyle(0x2a1020, 1).fillRoundedRect(W - 96, 10, 76, 72, 10);
    g.fillStyle(0xff3b4e, 1).fillTriangle(W - 58, 22, W - 34, 70, W - 82, 70);
    // player mini avatar
    g.fillStyle(0x102040, 1).fillRoundedRect(20, 10, 76, 72, 10);
    g.fillStyle(0x4fb8ff, 1).fillCircle(58, 46, 22);
    // turn chip
    g.fillStyle(0xffc23a, 1).fillPoints([{ x: W / 2 - 80, y: 0 }, { x: W / 2 + 80, y: 0 }, { x: W / 2 + 60, y: 56 }, { x: W / 2 - 60, y: 56 }], true);
    this.add.text(110, 14, "PLAYER01", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "600" }).setDepth(41);
    this.add.text(W - 110, 14, "RIVAL", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "600" }).setOrigin(1, 0).setDepth(41);
    this.totals = {
      p: this.add.text(110, 44, "", { fontFamily: FONT, fontSize: "24px", color: "#6fd0ff" }).setDepth(41),
      o: this.add.text(W - 110, 44, "", { fontFamily: FONT, fontSize: "24px", color: "#ff6a78" }).setOrigin(1, 0).setDepth(41),
    };
    this.turnText = this.add.text(W / 2, 28, "", { fontFamily: FONT, fontSize: "32px", color: "#1a1206", fontStyle: "700" }).setOrigin(0.5).setDepth(41);
    this.statusText = this.add.text(W / 2, 74, "", { fontFamily: FONT, fontSize: "20px", color: "#dfe7ff" }).setOrigin(0.5).setDepth(41);
  }

  drawBottomHud() {
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(0x0b1222, 0.7).fillRect(0, 1060, W, 220);
    g.fillStyle(0x4fb8ff, 0.9).fillRect(0, 1058, W, 2);
    // energy orb
    this.energyRing = this.add.graphics().setDepth(41);
    this.energyText = this.add.text(70, 1160, "", { fontFamily: FONT, fontSize: "44px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5).setDepth(42);
    this.add.text(70, 1222, "ENERGY", { fontFamily: FONT, fontSize: "18px", color: "#9fb8ff" }).setOrigin(0.5).setDepth(42);

    // end turn button
    const b = this.add.container(650, 1160).setDepth(45);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.4).fillPoints([{ x: -56, y: -38 }, { x: 64, y: -38 }, { x: 56, y: 44 }, { x: -64, y: 44 }], true);
    bg.fillStyle(0xffc23a, 1).fillPoints([{ x: -60, y: -42 }, { x: 60, y: -42 }, { x: 52, y: 40 }, { x: -68, y: 40 }], true);
    b.add(bg);
    b.add(this.add.text(-4, 0, "END\nTURN", { fontFamily: FONT, fontSize: "30px", color: "#1a1206", fontStyle: "700", align: "center", lineSpacing: -10 }).setOrigin(0.5));
    b.setSize(130, 84).setInteractive({ useHandCursor: true });
    b.on("pointerdown", () => this.endTurn());
    b.on("pointerover", () => !this.busy && b.setScale(1.05));
    b.on("pointerout", () => b.setScale(1));
    this.endBtn = b;
  }

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
          fx.fillRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2 + (side === "opponent" ? 0 : 0), SLOT_W, SLOT_H * (side === "opponent" ? 0.9 : 1), 8);
          fx.lineStyle(legal ? 3 : 1.5, side === "player" ? 0x8fd8ff : 0xff8a95, legal ? 1 : 0.45);
          fx.strokeRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H * (side === "opponent" ? 0.9 : 1), 8);
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
    const h = side === "opponent" ? SLOT_H * 0.9 : SLOT_H;
    const card = createCard(this, id, SLOT_W - 6, h - 6, { enemy: side === "opponent" });
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
