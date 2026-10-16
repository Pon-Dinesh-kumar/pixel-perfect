import * as Phaser from "phaser";
import { CARDS, type CardId } from "./cards";
import { artKey, createCard, FONT } from "./cardView";
import {
  canTakeBack, carrierScore, createGame, effectivePower, endPlayerTurn, MAX_ENERGY, MAX_TURNS, moveCard,
  nextTurn, opponentPlayOne, playCard, result, SLOTS, takeBack, type GameState, type Side,
} from "./rules";

export interface Assets { sky: string; carrier: string; art: Record<CardId, string> }

export const W = 720;
export const H = 1280;
const CARRIER_Y = [262, 532, 802];
/** Player owns the LEFT half of each deck, rival the RIGHT half. */
const SLOT_X: Record<Side, number[]> = { player: [112, 186, 260], opponent: [460, 534, 608] };
const SLOT_Y = -18;
const SLOT_W = 68, SLOT_H = 92;
const HAND_Y = 1170, HAND_W = 112, HAND_H = 170;
const HAND_X = [186, 302, 418, 534];
const HAND_ZONE = { x0: 124, x1: 594, y0: 1068 };
const LANE_TINT = [0x5fd4ff, 0x7f9dff, 0xff6a5e];
const HUD_BG = 0x0a1020;
const CYAN = 0x4fc3ff, CORAL = 0xff5a64, GOLD = 0xffc23a;

type DragSrc = { kind: "hand"; idx: number; uid: number } | { kind: "board"; c: number; s: number; uid: number };
interface Target { kind: "slot"; side: Side; c: number; s: number } 
type DropTarget = Target | { kind: "hand" } | null;

export class BattleScene extends Phaser.Scene {
  g!: GameState;
  carriers: Phaser.GameObjects.Container[] = [];
  cardLayers: Phaser.GameObjects.Container[] = [];
  slotFx: Phaser.GameObjects.Graphics[] = [];
  scoreText: { p: Phaser.GameObjects.Text; o: Phaser.GameObjects.Text }[] = [];
  handLayer!: Phaser.GameObjects.Container;
  handGlow!: Phaser.GameObjects.Graphics;
  energyText!: Phaser.GameObjects.Text;
  energyRing!: Phaser.GameObjects.Graphics;
  turnText!: Phaser.GameObjects.Text;
  statusText!: Phaser.GameObjects.Text;
  endBtn!: Phaser.GameObjects.Container;
  endLabel!: Phaser.GameObjects.Text;
  totals!: { p: Phaser.GameObjects.Text; o: Phaser.GameObjects.Text };
  bg!: Phaser.GameObjects.Image;
  /** Purely visual: where a card should animate in from on next render. */
  animFrom = new Map<number, { x: number; y: number; impact?: boolean }>();
  lastPower = new Map<number, number>();
  lastScores: number[] = [];
  drag: { src: DragSrc; obj: Phaser.GameObjects.Container; ox: number; oy: number; hover: DropTarget } | null = null;

  constructor(private assets: Assets) { super("battle"); }

  preload() {
    this.load.image("sky", this.assets.sky);
    this.load.image("carrier", this.assets.carrier);
    for (const [id, url] of Object.entries(this.assets.art)) this.load.image(artKey(id as CardId), url);
  }

  create() {
    this.g = createGame();
    this.carriers = []; this.cardLayers = []; this.slotFx = []; this.scoreText = [];
    this.animFrom.clear(); this.lastPower.clear(); this.lastScores = []; this.drag = null;
    this.input.topOnly = true;
    this.input.dragDistanceThreshold = 4;
    this.drawEnvironment();
    CARRIER_Y.forEach((y, i) => this.drawCarrier(i, y));
    this.drawTopHud();
    this.drawBottomHud();
    this.handLayer = this.add.container(0, 0).setDepth(50);
    this.setupDrag();
    this.refresh();
  }

  // ---------- environment ----------
  drawEnvironment() {
    this.bg = this.add.image(W / 2, H / 2, "sky").setDisplaySize(W + 40, H + 40).setDepth(-10);
    const veil = this.add.graphics().setDepth(-9);
    veil.fillStyle(0x0d1a36, 0.4).fillRect(0, 0, W, H);
    veil.fillGradientStyle(0x060c1c, 0x060c1c, 0x060c1c, 0x060c1c, 0.75, 0.75, 0, 0).fillRect(0, 0, W, 260);
    veil.fillGradientStyle(0x060c1c, 0x060c1c, 0x060c1c, 0x060c1c, 0, 0, 0.92, 0.92).fillRect(0, 860, W, 420);
    veil.fillGradientStyle(0x060c1c, 0x0d1a36, 0x0d1a36, 0x060c1c, 0.5, 0, 0, 0.5).fillRect(0, 0, 140, H);
    veil.fillGradientStyle(0x0d1a36, 0x060c1c, 0x060c1c, 0x0d1a36, 0, 0.5, 0.5, 0).fillRect(W - 140, 0, 140, H);
    const mist = this.add.graphics().setDepth(-8).setAlpha(0.12);
    mist.fillStyle(0xdfeaff, 1);
    for (let i = 0; i < 8; i++) mist.fillEllipse(Phaser.Math.Between(0, W), Phaser.Math.Between(180, 960), Phaser.Math.Between(180, 300), Phaser.Math.Between(22, 40));
    this.tweens.add({ targets: mist, x: 36, duration: 10000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.bg.x = W / 2 + (p.x / W - 0.5) * -14;
      this.bg.y = H / 2 + (p.y / H - 0.5) * -10;
    });
  }

  drawCarrier(i: number, y: number) {
    const c = this.add.container(0, y).setDepth(10 + i);
    const tint = LANE_TINT[i]!;
    const SX = 20, SY = -70, SW = 680;
    const tex = this.textures.get("carrier").getSourceImage() as HTMLImageElement;
    const SH = SW * (tex.height / tex.width);

    const sh = this.add.graphics();
    sh.fillStyle(0x050a18, 0.4).fillEllipse(SX + SW / 2, SY + SH + 30, SW * 0.7, 20);
    sh.fillStyle(tint, 0.16).fillEllipse(SX + SW / 2, SY + SH - 10, SW * 0.55, 24);
    c.add(sh);
    c.add(this.add.image(SX, SY, "carrier").setOrigin(0, 0).setDisplaySize(SW, SH));

    // deck ownership: left half player (cyan), right half rival (coral)
    const d = this.add.graphics();
    d.fillStyle(0x060c1c, 0.35).fillPoints([{ x: 75, y: -53 }, { x: 632, y: -53 }, { x: 670, y: 25 }, { x: 60, y: 25 }], true);
    d.fillStyle(CYAN, 0.12).fillPoints([{ x: 75, y: -53 }, { x: 298, y: -53 }, { x: 298, y: 25 }, { x: 60, y: 25 }], true);
    d.fillStyle(CORAL, 0.12).fillPoints([{ x: 422, y: -53 }, { x: 632, y: -53 }, { x: 670, y: 25 }, { x: 422, y: 25 }], true);
    d.lineStyle(3, CYAN, 0.95).lineBetween(64, 25, 298, 25);
    d.lineStyle(3, CORAL, 0.95).lineBetween(422, 25, 668, 25);
    for (let k = 0; k < 5; k++) d.fillStyle(tint, 0.9).fillRect(120 + k * 100, 66, 26, 3);
    c.add(d);

    // centre score / VS block
    const sp = this.add.graphics();
    sp.fillStyle(HUD_BG, 0.95).fillRoundedRect(304, -60, 112, 76, 12);
    sp.fillStyle(CYAN, 0.22).fillRoundedRect(304, -60, 56, 76, { tl: 12, bl: 12, tr: 0, br: 0 });
    sp.fillStyle(CORAL, 0.22).fillRoundedRect(360, -60, 56, 76, { tl: 0, bl: 0, tr: 12, br: 12 });
    sp.lineStyle(2, 0xffffff, 0.2).strokeRoundedRect(304, -60, 112, 76, 12);
    c.add(sp);
    c.add(this.add.text(360, -66, "VS", { fontFamily: FONT, fontSize: "16px", color: "#ffc23a", fontStyle: "700", backgroundColor: "#0a1020", padding: { x: 4, y: 0 } }).setOrigin(0.5));
    const p = this.add.text(332, -20, "0", { fontFamily: FONT, fontSize: "44px", color: "#7fd8ff", fontStyle: "700" }).setOrigin(0.5);
    const o = this.add.text(388, -20, "0", { fontFamily: FONT, fontSize: "44px", color: "#ff8a8f", fontStyle: "700" }).setOrigin(0.5);
    c.add([p, o]);
    this.scoreText[i] = { p, o };

    // lane chip above deck
    const col = Phaser.Display.Color.IntegerToColor(tint).rgba;
    const chip = this.add.graphics();
    chip.fillStyle(HUD_BG, 0.85).fillRoundedRect(22, -104, 150, 30, 6);
    chip.fillStyle(tint, 1).fillRect(22, -104, 4, 30);
    c.add(chip);
    c.add(this.add.text(34, -103, `0${i + 1}`, { fontFamily: FONT, fontSize: "26px", color: col, fontStyle: "700" }));
    c.add(this.add.text(68, -99, `${this.g.carriers[i]!.name} LANE`, { fontFamily: FONT, fontSize: "20px", color: "#eef3ff", fontStyle: "600" }));

    const fx = this.add.graphics();
    c.add(fx);
    this.slotFx[i] = fx;
    const layer = this.add.container(0, 0);
    c.add(layer);
    this.cardLayers[i] = layer;

    this.tweens.add({ targets: c, y: y - 4, duration: 2200 + i * 300, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: i * 400 });
    this.carriers[i] = c;
  }

  // ---------- HUD ----------
  drawTopHud() {
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(HUD_BG, 0.94).fillRect(0, 0, W, 96);
    g.fillGradientStyle(CYAN, CORAL, CORAL, CYAN, 1, 1, 1, 1).fillRect(0, 96, W, 3);
    g.fillStyle(0x12223f, 1).fillRoundedRect(16, 12, 72, 72, 12).lineStyle(2, CYAN, 1).strokeRoundedRect(16, 12, 72, 72, 12);
    g.fillStyle(CYAN, 0.9).fillCircle(52, 40, 15).fillEllipse(52, 74, 46, 30);
    g.fillStyle(0x3a1220, 1).fillRoundedRect(W - 88, 12, 72, 72, 12).lineStyle(2, CORAL, 1).strokeRoundedRect(W - 88, 12, 72, 72, 12);
    g.fillStyle(CORAL, 0.9).fillCircle(W - 52, 40, 15).fillEllipse(W - 52, 74, 46, 30);
    const tc = [{ x: W / 2 - 76, y: 0 }, { x: W / 2 + 76, y: 0 }, { x: W / 2 + 60, y: 84 }, { x: W / 2 - 60, y: 84 }];
    g.fillStyle(0x161c2e, 1).fillPoints(tc, true).lineStyle(2, GOLD, 1).strokePoints(tc, true, true);
    g.fillStyle(GOLD, 1).fillRect(W / 2 - 60, 80, 120, 4);
    this.add.text(104, 14, "PLAYER01", { fontFamily: FONT, fontSize: "28px", color: "#ffffff", fontStyle: "600" }).setDepth(41);
    this.add.text(W - 104, 14, "RIVAL", { fontFamily: FONT, fontSize: "28px", color: "#ffffff", fontStyle: "600" }).setOrigin(1, 0).setDepth(41);
    this.totals = {
      p: this.add.text(104, 50, "", { fontFamily: FONT, fontSize: "22px", color: "#7fd8ff" }).setDepth(41),
      o: this.add.text(W - 104, 50, "", { fontFamily: FONT, fontSize: "22px", color: "#ff8a8f" }).setOrigin(1, 0).setDepth(41),
    };
    this.add.text(W / 2, 14, "TURN", { fontFamily: FONT, fontSize: "18px", color: "#ffc23a", fontStyle: "600" }).setOrigin(0.5, 0).setDepth(41);
    this.turnText = this.add.text(W / 2, 46, "", { fontFamily: FONT, fontSize: "40px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5).setDepth(41);
    this.statusText = this.add.text(W / 2, 118, "", { fontFamily: FONT, fontSize: "20px", color: "#dfe7ff", backgroundColor: "#0a1020cc", padding: { x: 12, y: 2 } }).setOrigin(0.5).setDepth(41);
  }

  drawBottomHud() {
    const g = this.add.graphics().setDepth(40);
    g.fillGradientStyle(HUD_BG, HUD_BG, HUD_BG, HUD_BG, 0.65, 0.65, 0.98, 0.98).fillRect(0, 1064, W, 216);
    g.fillStyle(CYAN, 0.8).fillRect(0, 1062, W, 2);
    this.handGlow = this.add.graphics().setDepth(41);
    this.energyRing = this.add.graphics().setDepth(41);
    this.energyText = this.add.text(64, 1158, "", { fontFamily: FONT, fontSize: "40px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5).setDepth(42);
    this.add.text(64, 1222, "ENERGY", { fontFamily: FONT, fontSize: "18px", color: "#7fd8ff", fontStyle: "600" }).setOrigin(0.5).setDepth(42);

    const b = this.add.container(656, 1170).setDepth(45);
    const bg = this.add.graphics();
    const shape = [{ x: -50, y: -50 }, { x: 54, y: -50 }, { x: 50, y: 50 }, { x: -54, y: 50 }];
    bg.fillStyle(0x000000, 0.45).fillPoints(shape.map((p) => ({ x: p.x + 3, y: p.y + 6 })), true);
    bg.fillStyle(GOLD, 1).fillPoints(shape, true);
    bg.fillStyle(0xffe08a, 1).fillRect(-50, -50, 104, 6);
    bg.lineStyle(2, 0x6a4a00, 0.6).strokePoints(shape, true, true);
    b.add(bg);
    this.endLabel = this.add.text(0, 2, "END\nTURN", { fontFamily: FONT, fontSize: "32px", color: "#1a1206", fontStyle: "700", align: "center", lineSpacing: -12 }).setOrigin(0.5);
    b.add(this.endLabel);
    b.setSize(108, 100).setInteractive({ useHandCursor: true });
    b.on("pointerdown", () => { if (this.g.phase === "player") b.setScale(0.93).setY(1174); });
    b.on("pointerup", () => { b.setScale(1).setY(1170); this.endTurn(); });
    b.on("pointerout", () => b.setScale(1).setY(1170));
    this.endBtn = b;
  }

  // ---------- state → view ----------
  refresh() {
    const g = this.g;
    this.turnText.setText(`${g.turn}/${MAX_TURNS}`);
    this.statusText.setText(g.phase === "opponent" ? "RIVAL IS PLAYING…" : g.phase === "over" ? "MATCH OVER" : "YOUR TURN · DRAG CARDS TO THE LEFT SIDE");
    let pt = 0, ot = 0;
    g.carriers.forEach((c, i) => {
      const p = carrierScore(c, "player"), o = carrierScore(c, "opponent");
      pt += p; ot += o;
      const st = this.scoreText[i]!;
      if (this.lastScores[i * 2] !== undefined && this.lastScores[i * 2] !== p) this.pulse(st.p);
      if (this.lastScores[i * 2 + 1] !== undefined && this.lastScores[i * 2 + 1] !== o) this.pulse(st.o);
      this.lastScores[i * 2] = p; this.lastScores[i * 2 + 1] = o;
      st.p.setText(`${p}`).setAlpha(p >= o ? 1 : 0.6);
      st.o.setText(`${o}`).setAlpha(o >= p ? 1 : 0.6);
    });
    this.totals.p.setText(`POWER ${pt}`);
    this.totals.o.setText(`POWER ${ot}`);

    const e = g.player.energy, max = energyForDisplay(g.turn);
    this.energyRing.clear();
    this.energyRing.fillStyle(0x0d2550, 1).fillCircle(64, 1158, 50).lineStyle(2, CYAN, 0.5).strokeCircle(64, 1158, 56);
    this.energyRing.lineStyle(8, 0x223355, 1).strokeCircle(64, 1158, 44);
    if (e > 0) {
      this.energyRing.lineStyle(8, CYAN, 1).beginPath()
        .arc(64, 1158, 44, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(e, max)) / Math.max(max, 1)).strokePath();
    }
    this.energyText.setText(`${e}/${max}`);
    const active = g.phase === "player";
    this.endBtn.setAlpha(active ? 1 : 0.45);
    this.endLabel.setText(active ? "END\nTURN" : g.phase === "over" ? "DONE" : "LOCKED");

    this.drawBoard();
    this.drawHand();
    this.drawHighlights();
  }

  drawBoard() {
    this.g.carriers.forEach((c, i) => {
      const layer = this.cardLayers[i]!;
      layer.removeAll(true);
      for (const side of ["player", "opponent"] as Side[]) {
        for (let s = 0; s < SLOTS; s++) {
          const p = c[side][s];
          if (!p) continue;
          const power = effectivePower(c, side, s);
          const card = createCard(this, p.id, SLOT_W - 4, SLOT_H - 4, { enemy: side === "opponent", power, compact: true });
          const x = SLOT_X[side][s]!, y = SLOT_Y;
          card.setPosition(x, y);
          layer.add(card);
          if (side === "player" && !p.locked && this.g.phase === "player") {
            const ring = this.add.graphics();
            ring.lineStyle(2, 0xbff0ff, 0.9).strokeRoundedRect(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H, 7);
            card.addAt(ring, 0);
            this.tweens.add({ targets: ring, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
            card.setInteractive({ useHandCursor: true, draggable: true });
            card.setData("src", { kind: "board", c: i, s, uid: p.uid } satisfies DragSrc);
          }
          const from = this.animFrom.get(p.uid);
          if (from) {
            this.animFrom.delete(p.uid);
            card.setPosition(from.x, from.y - this.carriers[i]!.y).setScale(1.25);
            this.tweens.add({
              targets: card, x, y, scale: 1, duration: 260, ease: "Back.out",
              onComplete: () => from.impact && this.impact(i, x, y, side === "player" ? CYAN : CORAL),
            });
          }
          const prev = this.lastPower.get(p.uid);
          if (prev !== undefined && prev !== power) this.passiveFx(card, power > prev);
          this.lastPower.set(p.uid, power);
        }
      }
    });
  }

  drawHand() {
    this.handLayer.removeAll(true);
    this.g.player.hand.forEach((inst, idx) => {
      const card = createCard(this, inst.id, HAND_W, HAND_H);
      const afford = CARDS[inst.id].cost <= this.g.player.energy && this.g.phase === "player";
      const x = HAND_X[idx]!, y = HAND_Y;
      card.setPosition(x, y).setAlpha(afford ? 1 : 0.55);
      card.setInteractive({ useHandCursor: true, draggable: this.g.phase === "player" });
      card.setData("src", { kind: "hand", idx, uid: inst.uid } satisfies DragSrc);
      card.on("pointerover", () => !this.drag && card.setY(y - 10));
      card.on("pointerout", () => !this.drag && card.setY(y));
      this.handLayer.add(card);
      const from = this.animFrom.get(inst.uid);
      if (from) {
        this.animFrom.delete(inst.uid);
        card.setPosition(from.x, from.y);
        this.tweens.add({ targets: card, x, y, duration: 240, ease: "Cubic.out" });
      }
      this.lastPower.delete(inst.uid);
    });
  }

  drawHighlights() {
    const d = this.drag;
    const handCost = d?.src.kind === "hand" ? CARDS[this.g.player.hand[d.src.idx]!.id].cost : 0;
    this.g.carriers.forEach((c, i) => {
      const fx = this.slotFx[i]!;
      fx.clear();
      for (const side of ["player", "opponent"] as Side[]) {
        for (let s = 0; s < SLOTS; s++) {
          if (c[side][s] !== null && !(d?.src.kind === "board" && d.src.c === i && d.src.s === s && side === "player")) continue;
          const x = SLOT_X[side][s]!, y = SLOT_Y;
          const col = side === "player" ? CYAN : CORAL;
          let valid = false;
          if (d && side === "player" && c.player[s] === null) valid = d.src.kind === "board" || handCost <= this.g.player.energy;
          const hover = valid && d?.hover?.kind === "slot" && d.hover.c === i && d.hover.s === s && d.hover.side === "player";
          fx.fillStyle(col, hover ? 0.45 : valid ? 0.25 : 0.1).fillRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 7);
          fx.lineStyle(hover ? 3 : valid ? 2 : 1.5, side === "player" ? 0x9fe4ff : 0xffa0a4, valid ? 1 : 0.5)
            .strokeRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 7);
        }
      }
    });
    this.handGlow.clear();
    if (d?.src.kind === "board") {
      const hov = d.hover?.kind === "hand";
      this.handGlow.fillStyle(CYAN, hov ? 0.22 : 0.1).fillRoundedRect(HAND_ZONE.x0, HAND_ZONE.y0, HAND_ZONE.x1 - HAND_ZONE.x0, 200, 14);
      this.handGlow.lineStyle(2, CYAN, hov ? 1 : 0.6).strokeRoundedRect(HAND_ZONE.x0, HAND_ZONE.y0, HAND_ZONE.x1 - HAND_ZONE.x0, 200, 14);
    }
  }

  // ---------- drag & drop ----------
  setupDrag() {
    this.input.on("dragstart", (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      if (this.drag || this.g.phase !== "player") return;
      const src = obj.getData("src") as DragSrc | undefined;
      if (!src) return;
      const m = obj.getWorldTransformMatrix();
      const wx = m.tx, wy = m.ty;
      obj.parentContainer?.remove(obj);
      this.add.existing(obj);
      obj.setPosition(wx, wy).setDepth(300).setScale(src.kind === "hand" ? 1.08 : 1.2).setAlpha(1);
      this.drag = { src, obj, ox: wx - p.worldX, oy: wy - p.worldY, hover: null };
      this.drawHighlights();
    });
    this.input.on("drag", (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      if (!this.drag || this.drag.obj !== obj) return;
      obj.setPosition(p.worldX + this.drag.ox, p.worldY + this.drag.oy);
      const t = this.targetAt(p.worldX, p.worldY);
      const same = JSON.stringify(t) === JSON.stringify(this.drag.hover);
      this.drag.hover = t;
      if (!same) this.drawHighlights();
    });
    this.input.on("dragend", (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      if (!this.drag || this.drag.obj !== obj) return;
      this.finishDrag(this.targetAt(p.worldX, p.worldY));
    });
    // safety: release outside canvas / lost pointer
    this.input.on("gameout", () => this.drag && this.finishDrag(null));
  }

  targetAt(x: number, y: number): DropTarget {
    if (y >= HAND_ZONE.y0 && x >= HAND_ZONE.x0 && x <= HAND_ZONE.x1) return { kind: "hand" };
    for (let c = 0; c < 3; c++) {
      const cy = this.carriers[c]!.y + SLOT_Y;
      if (Math.abs(y - cy) > SLOT_H / 2 + 10) continue;
      for (const side of ["player", "opponent"] as Side[])
        for (let s = 0; s < SLOTS; s++) if (Math.abs(x - SLOT_X[side][s]!) <= SLOT_W / 2 + 4) return { kind: "slot", side, c, s };
    }
    return null;
  }

  finishDrag(t: DropTarget) {
    const d = this.drag!;
    this.drag = null;
    const pos = { x: d.obj.x, y: d.obj.y };
    d.obj.destroy();
    const g = this.g;
    let msg: string | null = null;

    if (d.src.kind === "hand") {
      const idx = d.src.idx;
      if (t?.kind === "slot" && t.side === "player") {
        if (playCard(g, "player", idx, t.c, t.s)) this.animFrom.set(d.src.uid, { ...pos, impact: true });
        else msg = g.carriers[t.c]!.player[t.s] ? "SLOT OCCUPIED" : "NOT ENOUGH ENERGY";
      } else if (t?.kind === "slot") msg = "RIVAL SIDE";
      else if (t === null) msg = null;
      if (!(t?.kind === "slot" && t.side === "player" && !msg)) this.animFrom.set(d.src.uid, pos);
    } else {
      const { c, s, uid } = d.src;
      if (t?.kind === "hand" && canTakeBack(g, c, s)) {
        const cost = CARDS[g.carriers[c]!.player[s]!.id].cost;
        takeBack(g, c, s);
        this.animFrom.set(uid, pos);
        this.floatText(`+${cost} ENERGY`, 64, 1090, "#7fd8ff");
      } else if (t?.kind === "slot" && t.side === "player" && moveCard(g, c, s, t.c, t.s)) {
        this.animFrom.set(uid, { ...pos, impact: true });
      } else {
        if (t?.kind === "slot" && t.side === "opponent") msg = "RIVAL SIDE";
        else if (t?.kind === "slot") msg = "SLOT OCCUPIED";
        this.animFrom.set(uid, pos);
      }
    }
    if (msg) this.flash(msg);
    this.refresh();
  }

  // ---------- feedback ----------
  impact(ci: number, x: number, y: number, color: number) {
    const cont = this.carriers[ci]!;
    const ring = this.add.circle(x, y, 20, color, 0).setStrokeStyle(4, color, 1);
    cont.add(ring);
    this.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 340, onComplete: () => ring.destroy() });
    for (let k = 0; k < 8; k++) {
      const p = this.add.rectangle(x, y, 3, 10, color, 1).setRotation(Math.random() * Math.PI);
      cont.add(p);
      const a = Math.random() * Math.PI * 2, dd = 34 + Math.random() * 26;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * dd, y: y + Math.sin(a) * dd, alpha: 0, duration: 300, onComplete: () => p.destroy() });
    }
    this.cameras.main.shake(70, 0.0018);
  }

  passiveFx(card: Phaser.GameObjects.Container, up: boolean) {
    const col = up ? 0x2fd36b : CORAL;
    const glow = this.add.graphics();
    glow.lineStyle(3, col, 1).strokeRoundedRect(-SLOT_W / 2 - 2, -SLOT_H / 2 - 2, SLOT_W + 4, SLOT_H + 4, 8);
    card.add(glow);
    this.tweens.add({ targets: glow, alpha: 0, duration: 600, delay: 150, onComplete: () => glow.destroy() });
  }

  pulse(t: Phaser.GameObjects.Text) {
    this.tweens.add({ targets: t, scale: 1.35, duration: 120, yoyo: true });
  }

  floatText(msg: string, x: number, y: number, color: string) {
    const t = this.add.text(x, y, msg, { fontFamily: FONT, fontSize: "24px", color, fontStyle: "700", stroke: "#0a1020", strokeThickness: 4 }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  flash(msg: string) {
    const t = this.add.text(W / 2, 1036, msg, { fontFamily: FONT, fontSize: "24px", color: "#ffffff", backgroundColor: "#d8233a", padding: { x: 12, y: 2 } })
      .setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: 1018, alpha: 0, delay: 600, duration: 400, onComplete: () => t.destroy() });
  }

  // ---------- turn flow ----------
  endTurn() {
    if (this.drag || !endPlayerTurn(this.g)) return;
    this.refresh();
    const step = () => {
      const m = opponentPlayOne(this.g);
      if (m) {
        this.animFrom.set(m.card.uid, { x: W - 52, y: 46, impact: true });
        this.refresh();
        this.time.delayedCall(450, step);
      } else {
        this.time.delayedCall(350, () => {
          nextTurn(this.g);
          this.refresh();
          if (this.g.phase === "over") this.showResult();
        });
      }
    };
    this.time.delayedCall(350, step);
  }

  showResult() {
    const r = result(this.g);
    const o = this.add.container(W / 2, 560).setDepth(100);
    const bg = this.add.graphics();
    const col = r.outcome === "win" ? CYAN : r.outcome === "loss" ? CORAL : GOLD;
    bg.fillStyle(HUD_BG, 0.95).fillRoundedRect(-260, -150, 520, 300, 16);
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
  }
}

const energyForDisplay = (turn: number) => Math.min(turn, MAX_ENERGY);
