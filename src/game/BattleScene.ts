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
const HAND_Y = 1166, HAND_W = 106, HAND_H = 142;
const HAND_X = [190, 302, 414, 526].map((x) => x - 40);
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

  // ---------- environment ----------
  drawEnvironment() {
    this.bg = this.add.image(W / 2, H / 2, "sky").setDisplaySize(W + 40, H + 40).setDepth(-10);
    const veil = this.add.graphics().setDepth(-9);
    // overall haze knocks back background contrast
    veil.fillStyle(0x0d1a36, 0.32).fillRect(0, 0, W, H);
    veil.fillGradientStyle(0x060c1c, 0x060c1c, 0x060c1c, 0x060c1c, 0.75, 0.75, 0, 0).fillRect(0, 0, W, 260);
    veil.fillGradientStyle(0x060c1c, 0x060c1c, 0x060c1c, 0x060c1c, 0, 0, 0.92, 0.92).fillRect(0, 860, W, 420);
    // soft vignette at sides to frame the board
    veil.fillGradientStyle(0x060c1c, 0x0d1a36, 0x0d1a36, 0x060c1c, 0.55, 0, 0, 0.55).fillRect(0, 0, 160, H);
    veil.fillGradientStyle(0x0d1a36, 0x060c1c, 0x060c1c, 0x0d1a36, 0, 0.55, 0.55, 0).fillRect(W - 160, 0, 160, H);
    // drifting mist for parallax depth
    const mist = this.add.graphics().setDepth(-8).setAlpha(0.14);
    mist.fillStyle(0xdfeaff, 1);
    for (let i = 0; i < 8; i++) mist.fillEllipse(Phaser.Math.Between(0, W), Phaser.Math.Between(180, 960), Phaser.Math.Between(180, 300), Phaser.Math.Between(22, 40));
    this.tweens.add({ targets: mist, x: 36, duration: 10000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.bg.x = W / 2 + (p.x / W - 0.5) * -14;
      this.bg.y = H / 2 + (p.y / H - 0.5) * -10;
      mist.y = (p.y / H - 0.5) * -6;
    });
  }

  drawCarrier(i: number, y: number) {
    const c = this.add.container(0, y).setDepth(10 + i);
    const tint = LANE_TINT[i];
    const SX = 88, SY = -36, SW = 610;
    const tex = this.textures.get("carrier").getSourceImage() as HTMLImageElement;
    const SH = SW * (tex.height / tex.width);

    // atmospheric drop shadow far below + underside glow in lane colour
    const sh = this.add.graphics();
    sh.fillStyle(0x050a18, 0.35).fillEllipse(SX + SW / 2, SY + SH + 26, SW * 0.8, 22);
    sh.fillStyle(tint, 0.18).fillEllipse(SX + SW / 2, SY + SH - 18, SW * 0.6, 26);
    c.add(sh);

    const hull = this.add.image(SX, SY, "carrier").setOrigin(0, 0).setDisplaySize(SW, SH);
    c.add(hull);
    // lane colour wash on hull (additive, restrained)
    const wash = this.add.image(SX, SY, "carrier").setOrigin(0, 0).setDisplaySize(SW, SH)
      .setTintFill(tint).setAlpha(0.12).setBlendMode(Phaser.BlendModes.ADD);
    c.add(wash);

    // deck: darken surface so cards pop, ownership line across it
    const d = this.add.graphics();
    d.lineStyle(3, 0xff4a5e, 0.9).lineBetween(170, -3, 470, -3);
    d.lineStyle(3, 0x4fc3ff, 0.9).lineBetween(170, 2, 470, 2);
    // edge lights along hull in lane colour
    for (let k = 0; k < 6; k++) d.fillStyle(tint, 0.95).fillRect(170 + k * 64, SY + SH * 0.66, 22, 3);
    c.add(d);
    const thr = this.add.ellipse(SX + SW - 4, SY + SH * 0.48, 26, 46, tint, 0.55).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: thr, scaleX: 1.6, alpha: 0.2, duration: 420, yoyo: true, repeat: -1 });
    c.add(thr);

    // lane badge (left, over bow)
    const lb = this.add.graphics();
    lb.fillStyle(HUD_BG, 0.9).fillPoints([{ x: 0, y: -26 }, { x: 128, y: -26 }, { x: 112, y: 34 }, { x: 0, y: 34 }], true);
    lb.fillStyle(tint, 1).fillRect(0, -26, 4, 60);
    lb.lineStyle(1, tint, 0.5).lineBetween(128, -26, 112, 34);
    c.add(lb);
    const col = Phaser.Display.Color.IntegerToColor(tint).rgba;
    c.add(this.add.text(14, -30, `0${i + 1}`, { fontFamily: FONT, fontSize: "40px", color: col, fontStyle: "700" }));
    c.add(this.add.text(56, -16, this.g.carriers[i].name.replace(" LANE", ""), { fontFamily: FONT, fontSize: "20px", color: "#eef3ff", fontStyle: "600" }));
    c.add(this.add.text(56, 4, "LANE", { fontFamily: FONT, fontSize: "15px", color: "#8ea3cc" }));

    // score column (right of slots)
    const sp = this.add.graphics();
    sp.fillStyle(HUD_BG, 0.92).fillRoundedRect(486, -88, 56, 172, 10);
    sp.fillStyle(0xff4a5e, 0.2).fillRoundedRect(486, -88, 56, 86, { tl: 10, tr: 10, bl: 0, br: 0 });
    sp.fillStyle(0x4fc3ff, 0.2).fillRoundedRect(486, -2, 56, 86, { tl: 0, tr: 0, bl: 10, br: 10 });
    sp.lineStyle(2, 0xffffff, 0.18).strokeRoundedRect(486, -88, 56, 172, 10);
    c.add(sp);
    const o = this.add.text(514, -46, "0", { fontFamily: FONT, fontSize: "40px", color: "#ff7a86", fontStyle: "700" }).setOrigin(0.5);
    const p = this.add.text(514, 42, "0", { fontFamily: FONT, fontSize: "40px", color: "#7fd8ff", fontStyle: "700" }).setOrigin(0.5);
    c.add([o, p]);
    this.scoreText[i] = { o, p };

    const fx = this.add.graphics();
    c.add(fx);
    this.slotFx[i] = fx;
    this.slotHit[i] = [];
    for (let s = 0; s < SLOTS; s++) {
      const { x, y: sy } = this.slotPos("player", s);
      const z = this.add.zone(x, sy, SLOT_W, SLOT_H).setInteractive({ useHandCursor: true });
      z.on("pointerdown", () => this.tryPlace(i, s));
      c.add(z);
      this.slotHit[i][s] = z;
    }

    this.tweens.add({ targets: c, y: y - 5, duration: 2200 + i * 300, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: i * 400 });
    this.carriers[i] = c;
  }

  slotPos(side: Side, s: number) {
    return { x: SLOT_X[s], y: ROW_Y[side] };
  }

  // ---------- HUD ----------
  drawTopHud() {
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(HUD_BG, 0.94).fillRect(0, 0, W, 96);
    g.fillGradientStyle(0x4fc3ff, 0xff4a5e, 0xff4a5e, 0x4fc3ff, 1, 1, 1, 1).fillRect(0, 96, W, 3);
    // player panel
    g.fillStyle(0x12223f, 1).fillRoundedRect(16, 12, 72, 72, 12);
    g.lineStyle(2, 0x4fc3ff, 1).strokeRoundedRect(16, 12, 72, 72, 12);
    g.fillStyle(0x4fc3ff, 0.9).fillCircle(52, 40, 15).fillEllipse(52, 74, 46, 30);
    // opponent panel
    g.fillStyle(0x3a1220, 1).fillRoundedRect(W - 88, 12, 72, 72, 12);
    g.lineStyle(2, 0xff4a5e, 1).strokeRoundedRect(W - 88, 12, 72, 72, 12);
    g.fillStyle(0xff4a5e, 0.9).fillCircle(W - 52, 40, 15).fillEllipse(W - 52, 74, 46, 30);
    // turn chip
    const tc = [{ x: W / 2 - 76, y: 0 }, { x: W / 2 + 76, y: 0 }, { x: W / 2 + 60, y: 84 }, { x: W / 2 - 60, y: 84 }];
    g.fillStyle(0x161c2e, 1).fillPoints(tc, true);
    g.lineStyle(2, 0xffc23a, 1).strokePoints(tc, true, true);
    g.fillStyle(0xffc23a, 1).fillRect(W / 2 - 60, 80, 120, 4);
    this.add.text(104, 14, "PLAYER01", { fontFamily: FONT, fontSize: "28px", color: "#ffffff", fontStyle: "600" }).setDepth(41);
    this.add.text(W - 104, 14, "RIVAL", { fontFamily: FONT, fontSize: "28px", color: "#ffffff", fontStyle: "600" }).setOrigin(1, 0).setDepth(41);
    this.totals = {
      p: this.add.text(104, 50, "", { fontFamily: FONT, fontSize: "22px", color: "#7fd8ff" }).setDepth(41),
      o: this.add.text(W - 104, 50, "", { fontFamily: FONT, fontSize: "22px", color: "#ff7a86" }).setOrigin(1, 0).setDepth(41),
    };
    this.add.text(W / 2, 14, "TURN", { fontFamily: FONT, fontSize: "18px", color: "#ffc23a", fontStyle: "600" }).setOrigin(0.5, 0).setDepth(41);
    this.turnText = this.add.text(W / 2, 46, "", { fontFamily: FONT, fontSize: "40px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5).setDepth(41);
    this.statusText = this.add.text(W / 2, 118, "", { fontFamily: FONT, fontSize: "20px", color: "#dfe7ff", backgroundColor: "#0a1020cc", padding: { x: 12, y: 2 } }).setOrigin(0.5).setDepth(41);
  }

  drawBottomHud() {
    const g = this.add.graphics().setDepth(40);
    g.fillGradientStyle(HUD_BG, HUD_BG, HUD_BG, HUD_BG, 0.6, 0.6, 0.98, 0.98).fillRect(0, 1064, W, 216);
    g.fillStyle(0x4fc3ff, 0.8).fillRect(0, 1062, W, 2);
    this.energyRing = this.add.graphics().setDepth(41);
    this.energyText = this.add.text(66, 1158, "", { fontFamily: FONT, fontSize: "42px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5).setDepth(42);
    this.add.text(66, 1226, "ENERGY", { fontFamily: FONT, fontSize: "18px", color: "#7fd8ff", fontStyle: "600" }).setOrigin(0.5).setDepth(42);

    const b = this.add.container(652, 1160).setDepth(45);
    const bg = this.add.graphics();
    const shape = [{ x: -54, y: -46 }, { x: 58, y: -46 }, { x: 54, y: 46 }, { x: -58, y: 46 }];
    bg.fillStyle(0x000000, 0.45).fillPoints(shape.map((p) => ({ x: p.x + 3, y: p.y + 6 })), true);
    bg.fillStyle(0xffc23a, 1).fillPoints(shape, true);
    bg.fillStyle(0xffe08a, 1).fillRect(-54, -46, 112, 6);
    bg.lineStyle(2, 0x6a4a00, 0.6).strokePoints(shape, true, true);
    b.add(bg);
    b.add(this.add.text(0, 2, "END\nTURN", { fontFamily: FONT, fontSize: "32px", color: "#1a1206", fontStyle: "700", align: "center", lineSpacing: -12 }).setOrigin(0.5));
    b.setSize(116, 92).setInteractive({ useHandCursor: true });
    b.on("pointerdown", () => { if (!this.busy && !this.g.over) b.setScale(0.93).setY(1164); });
    b.on("pointerup", () => { b.setScale(1).setY(1160); this.endTurn(); });
    b.on("pointerout", () => b.setScale(1).setY(1160));
    this.endBtn = b;
  }

  // ---------- state → view ----------
  refresh() {
    const g = this.g;
    this.turnText.setText(`${g.turn}/${MAX_TURNS}`);
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
    this.energyRing.fillStyle(0x0d2550, 1).fillCircle(66, 1158, 50).lineStyle(2, 0x4fc3ff, 0.5).strokeCircle(66, 1158, 56);
    this.energyRing.lineStyle(8, 0x223355, 1).strokeCircle(66, 1158, 44);
    if (e > 0) {
      this.energyRing.lineStyle(8, 0x4fc3ff, 1).beginPath()
        .arc(66, 1158, 44, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * e) / Math.max(max, 1)).strokePath();
    }
    this.energyText.setText(`${e}/${max}`);
    this.endBtn.setAlpha(this.busy || g.over ? 0.45 : 1);

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
