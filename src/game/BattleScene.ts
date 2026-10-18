import * as Phaser from "phaser";
import { BattleAudio } from "./audio";
import { HERO_EFFECTS } from "./heroEffects";
import { artKey, foregroundKey, logoKey } from "./heroArt";
import { createCard, createDetail, FONT, viewOf, type CardView } from "./cardView";
import type { HeroId } from "./heroes";
import { SKILL_BY_ID } from "./skills";
import { handLayout, nearestIndex, type HandPos } from "./handLayout";
import { HERO_BY_ID, isHeroId } from "./heroes";
import {
  beginReveal, revealNext, ROUND_SECONDS, opponentTurn, canMove, canTakeBack, cardCost, energyForTurn, carrierScore, createGame, effectivePower, endPlayerTurn, isSkill, MAX_ENERGY, MAX_TURNS, moveCard,
  nextTurn, opponentPlayOne, playCard, result, skillBlock, SLOTS, takeBack, tierOf, type DeckEntry, type GameState, type Outcome, type Side,
} from "./rules";

export interface Assets {
  sky: string; carrier: string; art: Record<string, string>; deck: DeckEntry[];
  onLoad?: (progress: number) => void; onReady?: () => void; onError?: () => void; onResult?: (o: Outcome) => void; onExit?: () => void;
}

export const W = 720;
export const H = 1280;
const CARRIER_Y = [270, 565, 860];
/** Player owns the LEFT half of each deck, rival the RIGHT half. */
const SLOT_X: Record<Side, number[]> = { player: [70, 166, 262], opponent: [458, 554, 650] };
const SLOT_Y = -24;
const SLOT_W = 90, SLOT_H = 122;
const HAND_Y = 1090, HAND_W = 118, HAND_H = 178;
const HAND_CX = 346, HAND_SPAN = 380;
const HAND_ZONE = { x0: 150, x1: 560, y0: 990 };
const ENERGY_POS = { x: 84, y: 1160 };
const END_POS = { x: 632, y: 1160 };
const DECK_POS = { x: 566, y: 1150 };
const CRIMSON = 0xd8233a;
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
  laneGlow: Phaser.GameObjects.Graphics[] = [];
  handCards: { card: Phaser.GameObjects.Container; pos: HandPos }[] = [];
  peek = -1;
  scoreText: { p: Phaser.GameObjects.Text; o: Phaser.GameObjects.Text }[] = [];
  handLayer!: Phaser.GameObjects.Container;
  handGlow!: Phaser.GameObjects.Graphics;
  energyText!: Phaser.GameObjects.Text;
  energyRing!: Phaser.GameObjects.Graphics;
  deckGfx!: Phaser.GameObjects.Graphics;
  deckText!: Phaser.GameObjects.Text;
  lastEnergy: number | undefined;
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
  resultSent = false;
  tf = (side: Side) => (h: HeroId) => tierOf(this.g, side, h);
  drag: { src: DragSrc; obj: Phaser.GameObjects.Container; ox: number; oy: number; hover: DropTarget; manual?: boolean } | null = null;

  remaining = ROUND_SECONDS;
  timerText!: Phaser.GameObjects.Text;
  audio = new BattleAudio();
  constructor(private assets: Assets) { super("battle"); }

  preload() {
    this.g = createGame({ player: this.assets.deck });
    this.load.on("progress", (n: number) => this.assets.onLoad?.(n));
    this.load.on("loaderror", () => this.assets.onError?.());
    this.load.image("sky", this.assets.sky);
    this.load.image("carrier", this.assets.carrier);
    const keys = new Set(["badge-cost", "badge-power", "card-back"]);
    for (const side of ["player", "opponent"] as Side[]) for (const id of Object.keys(this.g[side].tiers)) {
      if (isHeroId(id)) {
        const tier = tierOf(this.g, side, id);
        keys.add(artKey(id, tier)); keys.add(logoKey(id));
        if (tier !== "base") keys.add(foregroundKey(id, tier));
      }
    }
    for (const key of keys) { const url = this.assets.art[key]; if (url && !this.textures.exists(key)) this.load.image(key, url); }
  }

  create() {
    this.audio = new BattleAudio();
    this.resultSent = false;
    this.carriers = []; this.cardLayers = []; this.slotFx = []; this.scoreText = []; this.laneGlow = []; this.handCards = [];
    this.animFrom.clear(); this.lastPower.clear(); this.lastScores = []; this.drag = null;
    this.input.topOnly = true;
    this.input.dragDistanceThreshold = 4;
    this.drawEnvironment();
    CARRIER_Y.forEach((y, i) => this.drawCarrier(i, y));
    this.drawTopHud();
    this.drawBottomHud();
    this.handLayer = this.add.container(0, 0).setDepth(50);
    this.setupDrag();
    this.remaining = ROUND_SECONDS;
    this.time.addEvent({ delay: 1000, loop: true, callback: () => {
      if (this.g.phase !== "player") return;
      this.remaining = Math.max(0, this.remaining - 1);
      this.timerText.setText(`${this.remaining}s`).setColor(this.remaining <= 10 ? "#ff5a64" : "#dfe7ff");
      if (this.remaining <= 5) this.audio.play("tick");
      if (this.remaining === 0) { if (this.drag) this.finishDrag(null); this.endTurn(); }
    } });
    this.events.once("shutdown", () => { this.audio.destroy(); this.detail?.close(); this.input.removeAllListeners(); this.load.removeAllListeners(); });
    this.refresh();
    this.assets.onReady?.();
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
    this.dynamicSky();
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.bg.x = W / 2 + (p.x / W - 0.5) * -14;
      this.bg.y = H / 2 + (p.y / H - 0.5) * -10;
    });
  }

  /** Living sky: light rays, drifting cloud layers, rising dust and distant ships. */
  dynamicSky() {
    const rays = this.add.graphics().setDepth(-7).setBlendMode(Phaser.BlendModes.ADD);
    for (let k = 0; k < 4; k++) rays.fillStyle(0x9fd8ff, 0.05).fillTriangle(120 + k * 160, -40, 40 + k * 160, H, 200 + k * 160, H);
    this.tweens.add({ targets: rays, alpha: 0.35, duration: 4000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const layers = [{ n: 5, a: 0.08, sp: 60000, sc: 1.4 }, { n: 6, a: 0.13, sp: 34000, sc: 1 }, { n: 4, a: 0.18, sp: 20000, sc: 0.7 }];
    layers.forEach((L, li) => {
      for (let k = 0; k < L.n; k++) {
        const y = Phaser.Math.Between(140, 1000);
        const cl = this.add.ellipse(Phaser.Math.Between(-200, W + 200), y, 260 * L.sc, 46 * L.sc, 0xdfeaff, L.a).setDepth(-8 + li * 0.1);
        const go = () => this.tweens.add({ targets: cl, x: W + 260, duration: L.sp * ((W + 260 - cl.x) / (W + 520)), onComplete: () => { cl.x = -260; go(); } });
        go();
      }
    });
    for (let k = 0; k < 26; k++) {
      const d = this.add.circle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), Phaser.Math.FloatBetween(1, 2.6), 0xcfe8ff, 0.6).setDepth(-6).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: d, y: d.y - 300, alpha: 0, duration: Phaser.Math.Between(5000, 9000), repeat: -1, delay: Phaser.Math.Between(0, 5000), onRepeat: () => { d.y = Phaser.Math.Between(400, H); d.alpha = 0.6; } });
    }
    const ship = this.add.graphics().setDepth(-7.5).setAlpha(0.5);
    ship.fillStyle(0x0a1530, 1).fillTriangle(-40, 0, 40, -6, 40, 6).fillRect(-10, -14, 20, 6);
    ship.fillStyle(0xff8a5e, 1).fillCircle(42, 0, 3);
    const fly = () => {
      ship.setPosition(-80, Phaser.Math.Between(160, 900)).setScale(Phaser.Math.FloatBetween(0.5, 1));
      this.tweens.add({ targets: ship, x: W + 80, y: `-=${Phaser.Math.Between(20, 80)}`, duration: Phaser.Math.Between(14000, 22000), delay: Phaser.Math.Between(2000, 8000), onComplete: fly });
    };
    fly();
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
    const lg = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    c.add(lg);
    this.laneGlow[i] = lg;
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
    sp.fillStyle(HUD_BG, 0.95).fillRoundedRect(312, -66, 96, 84, 12);
    sp.fillStyle(CYAN, 0.22).fillRoundedRect(312, -66, 48, 84, { tl: 12, bl: 12, tr: 0, br: 0 });
    sp.fillStyle(CORAL, 0.22).fillRoundedRect(360, -66, 48, 84, { tl: 0, bl: 0, tr: 12, br: 12 });
    sp.lineStyle(2, 0xffffff, 0.2).strokeRoundedRect(312, -66, 96, 84, 12);
    c.add(sp);
    c.add(this.add.text(360, -72, "VS", { fontFamily: FONT, fontSize: "16px", color: "#ffc23a", fontStyle: "700", backgroundColor: "#0a1020", padding: { x: 4, y: 0 } }).setOrigin(0.5));
    const p = this.add.text(336, -22, "0", { fontFamily: FONT, fontSize: "44px", color: "#7fd8ff", fontStyle: "700" }).setOrigin(0.5);
    const o = this.add.text(384, -22, "0", { fontFamily: FONT, fontSize: "44px", color: "#ff8a8f", fontStyle: "700" }).setOrigin(0.5);
    c.add([p, o]);
    this.scoreText[i] = { p, o };

    // lane chip above deck
    const col = Phaser.Display.Color.IntegerToColor(tint).rgba;
    const chip = this.add.graphics();
    chip.fillStyle(HUD_BG, 0.85).fillRoundedRect(22, -124, 150, 30, 6);
    chip.fillStyle(tint, 1).fillRect(22, -124, 4, 30);
    c.add(chip);
    c.add(this.add.text(34, -123, `0${i + 1}`, { fontFamily: FONT, fontSize: "26px", color: col, fontStyle: "700" }));
    c.add(this.add.text(68, -119, `${this.g.carriers[i]!.name} LANE`, { fontFamily: FONT, fontSize: "20px", color: "#eef3ff", fontStyle: "600" }));

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
    this.timerText = this.add.text(W - 30, 118, `${ROUND_SECONDS}s`, { fontFamily: FONT, fontSize: "24px", color: "#dfe7ff" }).setOrigin(1, 0.5).setDepth(41);
    const sound = this.add.text(28, 118, "♫ OFF", { fontFamily: FONT, fontSize: "24px", color: "#dfe7ff" }).setOrigin(0, 0.5).setDepth(41).setInteractive({ useHandCursor: true });
    sound.on("pointerup", async () => { sound.setText(await this.audio.toggle() ? "♫ ON" : "♫ OFF"); });
    this.statusText = this.add.text(W / 2, 118, "", { fontFamily: FONT, fontSize: "20px", color: "#dfe7ff", backgroundColor: "#0a1020cc", padding: { x: 12, y: 2 } }).setOrigin(0.5).setDepth(41);
  }

  drawBottomHud() {
    // Tactical rail: dark translucent plate, soft top fade, cyan glow left, red glow right.
    const g = this.add.graphics().setDepth(40);
    g.fillGradientStyle(HUD_BG, HUD_BG, HUD_BG, HUD_BG, 0, 0, 0.55, 0.55).fillRect(0, 960, W, 80);
    g.fillGradientStyle(HUD_BG, HUD_BG, HUD_BG, HUD_BG, 0.55, 0.55, 0.92, 0.92).fillRect(0, 1040, W, 240);
    g.fillGradientStyle(CYAN, CYAN, CYAN, CYAN, 0.16, 0, 0.1, 0).fillRect(0, 1040, 190, 240);
    g.fillGradientStyle(CRIMSON, CRIMSON, CRIMSON, CRIMSON, 0, 0.14, 0, 0.08).fillRect(W - 190, 1040, 190, 240);
    g.fillStyle(CYAN, 0.35).fillRect(0, 1038, W, 2);
    g.fillStyle(0xffffff, 0.06).fillRect(0, 1042, W, 1);
    this.handGlow = this.add.graphics().setDepth(41);
    this.energyRing = this.add.graphics().setDepth(41);
    this.deckGfx = this.add.graphics().setDepth(41);
    this.energyText = this.add.text(ENERGY_POS.x, ENERGY_POS.y, "", { fontFamily: FONT, fontSize: "38px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5).setDepth(42);
    this.add.text(ENERGY_POS.x, ENERGY_POS.y + 56, "ENERGY", { fontFamily: FONT, fontSize: "17px", color: "#7fd8ff", fontStyle: "600" }).setOrigin(0.5).setDepth(42);
    this.deckText = this.add.text(DECK_POS.x, DECK_POS.y + 28, "", { fontFamily: FONT, fontSize: "22px", color: "#bfeaff", fontStyle: "700" }).setOrigin(0.5).setDepth(42);

    // End Turn: crimson angled plate.
    const b = this.add.container(END_POS.x, END_POS.y).setDepth(45);
    const bg = this.add.graphics();
    const plate = [{ x: -62, y: -34 }, { x: 44, y: -34 }, { x: 62, y: 0 }, { x: 44, y: 34 }, { x: -62, y: 34 }, { x: -44, y: 0 }];
    bg.fillStyle(0x000000, 0.4).fillPoints(plate.map((p) => ({ x: p.x + 3, y: p.y + 5 })), true);
    bg.fillStyle(0x5a0d18, 1).fillPoints(plate.map((p) => ({ x: p.x, y: p.y + 4 })), true);
    bg.fillStyle(CRIMSON, 1).fillPoints(plate, true);
    bg.fillStyle(0xff7a86, 0.5).fillPoints([{ x: -56, y: -28 }, { x: 40, y: -28 }, { x: 52, y: -6 }, { x: -46, y: -6 }], true);
    bg.lineStyle(2, 0xffb3ba, 0.85).strokePoints(plate, true, true);
    b.add(bg);
    const halo = this.add.graphics();
    halo.lineStyle(2, CRIMSON, 0.7).strokePoints(plate.map((p) => ({ x: p.x * 1.18, y: p.y * 1.3 })), true, true);
    b.addAt(halo, 0);
    this.tweens.add({ targets: halo, scale: 1.08, alpha: 0, duration: 1200, repeat: -1 });
    this.endLabel = this.add.text(-2, 1, "END TURN", { fontFamily: FONT, fontSize: "30px", color: "#ffffff", fontStyle: "700" }).setOrigin(0.5);
    b.add(this.endLabel);
    b.setSize(124, 68).setInteractive({ useHandCursor: true });
    b.on("pointerdown", () => { if (this.g.phase === "player") b.setScale(0.92); });
    b.on("pointerup", () => { b.setScale(1); if (!this.dragged) this.endTurn(); });
    b.on("pointerout", () => b.setScale(1));
    this.endBtn = b;
  }

  /** Cyan angular energy gauge with per-point ticks and a change pulse. */
  drawEnergy() {
    const e = this.g.player.energy, max = energyForDisplay(this.g.turn);
    const { x, y } = ENERGY_POS;
    const ring = this.energyRing;
    ring.clear();
    ring.fillStyle(0x081426, 0.95).fillCircle(x, y, 42);
    ring.lineStyle(2, CYAN, 0.45).strokeCircle(x, y, 46);
    ring.lineStyle(7, 0x1a2c4e, 1).strokeCircle(x, y, 36);
    if (e > 0) {
      ring.lineStyle(7, CYAN, 1).beginPath()
        .arc(x, y, 36, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(e, max)) / Math.max(max, 1)).strokePath();
    }
    for (let k = 0; k < max; k++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * k) / Math.max(max, 1);
      ring.fillStyle(k < e ? 0xbfeaff : 0x223355, 1).fillCircle(x + Math.cos(a) * 36, y + Math.sin(a) * 36, 2.5);
    }
    this.energyText.setText(`${e}/${max}`);
    if (this.lastEnergy !== undefined && this.lastEnergy !== e) {
      this.tweens.add({ targets: this.energyText, scale: 1.25, duration: 130, yoyo: true });
      const pulse = this.add.circle(x, y, 42, CYAN, 0).setStrokeStyle(3, CYAN, 0.9).setDepth(41);
      this.tweens.add({ targets: pulse, scale: 1.5, alpha: 0, duration: 500, onComplete: () => pulse.destroy() });
    }
    this.lastEnergy = e;
    // Deck indicator: stacked-card glyph + remaining count.
    const d = this.deckGfx;
    d.clear();
    const dx = DECK_POS.x, dy = DECK_POS.y;
    d.fillStyle(0x0d1a36, 0.95).fillRoundedRect(dx - 26, dy - 34, 52, 76, 8);
    d.lineStyle(1.5, 0x3a5a8a, 0.8).strokeRoundedRect(dx - 26, dy - 34, 52, 76, 8);
    d.fillStyle(0x16264a, 1).fillRoundedRect(dx - 14, dy - 26, 28, 38, 4);
    d.fillStyle(0x1d3462, 1).fillRoundedRect(dx - 11, dy - 22, 28, 38, 4);
    d.fillStyle(0x24427a, 1).fillRoundedRect(dx - 8, dy - 18, 28, 38, 4);
    d.lineStyle(1.5, CYAN, 0.7).strokeRoundedRect(dx - 8, dy - 18, 28, 38, 4);
    this.deckText.setText(`${this.g.player.deck.length}`);
  }

  // ---------- state → view ----------
  refresh() {
    const g = this.g;
    this.turnText.setText(`${g.turn}/${MAX_TURNS}`);
    this.statusText.setText(g.phase === "reveal" ? "REVEALING…" : g.phase === "opponent" ? "RIVAL PLANNING…" : g.phase === "over" ? "MATCH OVER" : "DEPLOYMENT");
    let pt = 0, ot = 0;
    g.carriers.forEach((_c, i) => {
      const p = carrierScore(g, i, "player"), o = carrierScore(g, i, "opponent");
      pt += p; ot += o;
      const st = this.scoreText[i]!;
      const oldP = this.lastScores[i * 2], oldO = this.lastScores[i * 2 + 1];
      if (oldP !== undefined && oldO !== undefined && Math.sign(oldP - oldO) !== Math.sign(p - o) && p !== o) {
        this.floatText(p > o ? "CARRIER LEAD" : "RIVAL LEAD", 360, (this.carriers[i]?.y ?? 0) + 92, p > o ? "#7fd8ff" : "#ff8892");
      }
      if (this.lastScores[i * 2] !== undefined && this.lastScores[i * 2] !== p) this.pulse(st.p);
      if (this.lastScores[i * 2 + 1] !== undefined && this.lastScores[i * 2 + 1] !== o) this.pulse(st.o);
      this.lastScores[i * 2] = p; this.lastScores[i * 2 + 1] = o;
      const lg = this.laneGlow[i];
      if (lg) { lg.clear(); if (p !== o) lg.fillStyle(p > o ? CYAN : CORAL, 0.28).fillEllipse(360, 30, 640, 90); }
      st.p.setText(`${p}`).setAlpha(p >= o ? 1 : 0.6);
      st.o.setText(`${o}`).setAlpha(o >= p ? 1 : 0.6);
    });
    this.totals.p.setText(`POWER ${pt}`);
    this.totals.o.setText(`POWER ${ot}`);

    this.drawEnergy();
    const active = g.phase === "player";
    this.endBtn.setAlpha(active ? 1 : 0.45);
    this.endLabel.setText(active ? "END TURN" : g.phase === "over" ? "DONE" : "LOCKED");

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
          const power = effectivePower(this.g, i, side, s);
          const card = createCard(this, viewOf(p.id, this.tf(side)), SLOT_W - 4, SLOT_H - 4, { enemy: side === "opponent", power, concealed: !p.revealed });
          const x = SLOT_X[side][s]!, y = SLOT_Y;
          card.setPosition(x, y);
          layer.add(card);
          if (p.revealed || side === "player") this.tappable(card, viewOf(p.id, this.tf(side)), { enemy: side === "opponent", power, note: p.mod ? `Skill effects: ${p.mod > 0 ? "+" : ""}${p.mod}` : undefined });
          if (side === "player" && canMove(this.g, i, s)) {
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
              targets: card, x, y, scale: 1, duration: 420, ease: "Cubic.out",
              onComplete: () => from.impact && this.impact(i, x, y, side === "player" ? CYAN : CORAL),
            });
          }
          const prev = this.lastPower.get(p.uid);
          if (prev !== undefined && prev !== power) {
            this.passiveFx(card, power > prev);
            this.floatText(`${power > prev ? "+" : ""}${power - prev}`, x, (this.carriers[i]?.y ?? 0) + y - 30, power > prev ? "#a0ffcb" : "#ff8892");
          }
          this.lastPower.set(p.uid, power);
        }
      }
      const queued = this.g.pending.filter((d) => d.skill && d.carrier === i);
      queued.forEach((d, k) => {
        const v = viewOf(d.card.id, this.tf(d.side));
        const card = createCard(this, v, 46, 62, { concealed: true });
        card.setPosition(210 + k * 52, 80); layer.add(card);
      });
    });
  }

  /** Display order: heroes first, then skill cards piled by hero. Returns original hand indices. */
  handOrder(): number[] {
    const h = this.g.player.hand;
    const idx = h.map((_, i) => i);
    const key = (i: number) => { const id = h[i]!.id; return isHeroId(id) ? "0" : `1${SKILL_BY_ID[id]!.hero}`; };
    return idx.sort((a, b) => key(a).localeCompare(key(b)) || a - b);
  }

  drawHand() {
    this.handLayer.removeAll(true);
    this.handCards = [];
    this.peek = -1;
    const hand = this.g.player.hand, order = this.handOrder();
    const n = hand.length;
    const w = n > 7 ? 104 : HAND_W, hh = Math.round(w * (HAND_H / HAND_W));
    const items = order.map((i) => ({ key: `${hand[i]!.uid}`, group: isHeroId(hand[i]!.id) ? null : SKILL_BY_ID[hand[i]!.id]!.hero }));
    const pos = handLayout(items, HAND_CX, HAND_Y, HAND_SPAN, w);
    order.forEach((idx, k) => {
      const inst = hand[idx]!;
      const p = pos[k]!;
      const card = createCard(this, viewOf(inst.id, this.tf("player")), w, hh, { hidePower: true });
      const afford = cardCost(inst.id) <= this.g.player.energy && this.g.phase === "player";
      card.setPosition(p.x, p.y).setRotation(p.rot).setAlpha(afford ? 1 : 0.55);
      card.setInteractive({ useHandCursor: true });
      card.setData("src", { kind: "hand", idx, uid: inst.uid } satisfies DragSrc);
      card.setData("handCard", true);
      card.setData("view", viewOf(inst.id, this.tf("player")));
      // unaffordable: restrained dim + muted outline
      if (!afford && this.g.phase === "player") {
        const dim = this.add.graphics();
        dim.lineStyle(2, 0x5a6a8a, 0.7).strokeRoundedRect(-w / 2, -hh / 2, w, hh, 8);
        card.add(dim);
      }
      if (!isHeroId(inst.id) && items[k]!.group !== items[k - 1]?.group) {
        const cnt = items.filter((it) => it.group === items[k]!.group).length;
        if (cnt > 1) {
          const tag = this.add.text(0, -hh / 2 - 12, `${HERO_BY_ID[SKILL_BY_ID[inst.id]!.hero].name} ×${cnt}`, { fontFamily: FONT, fontSize: "18px", color: "#ffffff", backgroundColor: "#5a2fb0", padding: { x: 5, y: 0 } }).setOrigin(0.5);
          card.add(tag);
        }
      }
      this.handLayer.add(card);
      this.handCards.push({ card, pos: p });
      const from = this.animFrom.get(inst.uid);
      if (from) {
        this.animFrom.delete(inst.uid);
        card.setPosition(from.x, from.y).setScale(0.5).setAlpha(1);
        const trail = this.add.graphics().setDepth(65);
        trail.lineStyle(3, HERO_BY_ID[viewOf(inst.id, this.tf("player")).hero].color, 0.8);
        trail.lineBetween(from.x, from.y, p.x, p.y);
        this.tweens.add({ targets: trail, alpha: 0, duration: 900, onComplete: () => trail.destroy() });
        this.tweens.add({ targets: card, x: p.x, y: p.y, scale: 1, duration: 760, delay: k * 60, ease: "Cubic.out" });
      }
      this.lastPower.delete(inst.uid);
    });
  }

  /** Topmost hand card whose bounds contain the world point (respects fan stacking). */
  handCardAt(x: number, y: number): number {
    for (let i = this.handCards.length - 1; i >= 0; i--) {
      const { card } = this.handCards[i]!;
      const m = card.getWorldTransformMatrix();
      const inv = m.applyInverse(x, y);
      if (Math.abs(inv.x) <= card.width / 2 && Math.abs(inv.y) <= card.height / 2) return i;
    }
    return -1;
  }

  /** Finger-slide peek: the card under the pointer lifts and grows; the rest settle. */
  setPeek(x: number | null) {
    const k = x === null ? -1 : nearestIndex(this.handCards.map((h) => h.pos), x);
    if (k === this.peek) return;
    this.peek = k;
    this.handCards.forEach(({ card, pos }, i) => {
      if (card.parentContainer !== this.handLayer) return;
      const up = i === k;
      if (up) this.handLayer.bringToTop(card);
      this.tweens.add({ targets: card, y: up ? pos.y - 46 : pos.y, rotation: up ? 0 : pos.rot, scale: up ? 1.22 : 1, duration: 120, ease: "Quad.out" });
    });
    if (k < 0) this.handCards.forEach(({ card }, i) => { if (card.parentContainer === this.handLayer) this.handLayer.moveTo(card, i); });
  }

  drawHighlights() {
    const d = this.drag;
    const handId = d?.src.kind === "hand" ? this.g.player.hand[d.src.idx]!.id : null;
    const handCost = handId ? cardCost(handId) : 0;
    this.g.carriers.forEach((c, i) => {
      const fx = this.slotFx[i]!;
      fx.clear();
      if (handId && isSkill(handId)) {
        const ok = handCost <= this.g.player.energy && skillBlock(this.g, "player", handId, i) === null;
        const hov = ok && d?.hover?.kind === "slot" && d.hover.c === i;
        const col = SKILL_BY_ID[handId]!.ultimate ? GOLD : 0xb07bff;
        fx.fillStyle(col, hov ? 0.35 : ok ? 0.16 : 0.04).fillRoundedRect(18, SLOT_Y - SLOT_H / 2 - 8, 684, SLOT_H + 16, 12);
        fx.lineStyle(hov ? 3 : 2, col, ok ? 1 : 0.25).strokeRoundedRect(18, SLOT_Y - SLOT_H / 2 - 8, 684, SLOT_H + 16, 12);
        return;
      }
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
      this.handGlow.fillStyle(CYAN, hov ? 0.22 : 0.1).fillRoundedRect(HAND_ZONE.x0, HAND_ZONE.y0, HAND_ZONE.x1 - HAND_ZONE.x0, H - HAND_ZONE.y0, 14);
      this.handGlow.lineStyle(2, CYAN, hov ? 1 : 0.6).strokeRoundedRect(HAND_ZONE.x0, HAND_ZONE.y0, HAND_ZONE.x1 - HAND_ZONE.x0, H - HAND_ZONE.y0, 14);
    }
  }

  // ---------- tap = details (drag is the only way to place) ----------
  dragged = false;
  detail: { close: () => void } | null = null;
  tappable(card: Phaser.GameObjects.Container, v: CardView, o: { enemy?: boolean; power?: number; note?: string | undefined }) {
    if (!card.input) card.setInteractive({ useHandCursor: true });
    card.on("pointerdown", () => { this.dragged = false; });
    card.on("pointerup", () => {
      if (this.dragged || this.drag || this.detail) return;
      const d = createDetail(this, v, W, H, o);
      this.detail = { close: d.close };
      d.root.once("destroy", () => { this.detail = null; });
    });
  }

  // ---------- drag & drop ----------
  /** Hand touch in progress: resolves to a tap (detail) or a deliberate drag. */
  pendingHand: { i: number; x: number; y: number } | null = null;

  beginDrag(obj: Phaser.GameObjects.Container, p: Phaser.Input.Pointer) {
    const src = obj.getData("src") as DragSrc | undefined;
    if (!src) return;
    this.dragged = true;
    const m = obj.getWorldTransformMatrix();
    const wx = m.tx, wy = m.ty;
    obj.parentContainer?.remove(obj);
    this.add.existing(obj);
    obj.setPosition(wx, wy).setRotation(0).setDepth(300).setScale(src.kind === "hand" ? 1.08 : 1.2).setAlpha(1);
    this.audio.play("draw");
    this.drag = { src, obj, ox: wx - p.worldX, oy: wy - p.worldY, hover: null, manual: src.kind === "hand" };
    this.setPeek(null);
    this.drawHighlights();
  }

  /** Shared drag-move logic for both Phaser-dragged (board) and manual (hand) drags. */
  moveDrag(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d) return;
    d.obj.setPosition(p.worldX + d.ox, p.worldY + d.oy);
    const t = this.targetAt(p.worldX, p.worldY);
    const same = JSON.stringify(t) === JSON.stringify(d.hover);
    d.hover = t;
    if (!same) this.drawHighlights();
  }

  setupDrag() {
    // Deterministic hand hit testing: the topmost card under the finger wins.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pendingHand = null;
      this.dragged = false;
      if (this.g.phase !== "player" || this.detail || this.drag) return;
      if (p.worldY < HAND_ZONE.y0) return;
      const i = this.handCardAt(p.worldX, p.worldY);
      if (i >= 0) this.pendingHand = { i, x: p.worldX, y: p.worldY };
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.drag?.manual) { this.finishDrag(this.targetAt(p.worldX, p.worldY)); this.pendingHand = null; return; }
      const ph = this.pendingHand;
      this.pendingHand = null;
      if (!ph || this.dragged || this.drag || this.detail) return;
      if (Math.hypot(p.worldX - ph.x, p.worldY - ph.y) > 12) return;
      const hc = this.handCards[ph.i];
      if (!hc) return;
      const d = createDetail(this, hc.card.getData("view") as CardView, W, H, {});
      this.detail = { close: d.close };
      d.root.once("destroy", () => { this.detail = null; });
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.drag) { if (this.drag.manual) this.moveDrag(p); return; }
      if (this.detail) return;
      if (this.pendingHand) {
        const ph = this.pendingHand;
        if (p.worldY < HAND_ZONE.y0 - 30 || Math.hypot(p.worldX - ph.x, p.worldY - ph.y) > 14) {
          this.pendingHand = null;
          const hc = this.handCards[ph.i];
          if (hc) this.beginDrag(hc.card, p);
          return;
        }
      }
      this.setPeek(p.worldY >= HAND_ZONE.y0 && p.worldX >= HAND_ZONE.x0 - 40 && p.worldX <= HAND_ZONE.x1 + 20 ? p.worldX : null);
    });
    this.input.on("dragstart", (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      if (this.drag || this.detail || this.g.phase !== "player") return;
      this.beginDrag(obj, p);
    });
    this.input.on("drag", (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      if (!this.drag || this.drag.obj !== obj || this.drag.manual) return;
      this.moveDrag(p);
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
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const pos = { x: d.obj.x, y: d.obj.y };
    d.obj.destroy();
    const g = this.g;
    const energyBefore = g.player.energy;
    let msg: string | null = null;

    if (d.src.kind === "hand") {
      const idx = d.src.idx;
      const id = g.player.hand[idx]!.id;
      if (isSkill(id)) {
        if (t?.kind === "slot") {
          const block = skillBlock(g, "player", id, t.c);
          if (cardCost(id) > g.player.energy) msg = "NOT ENOUGH ENERGY";
          else if (block) msg = block;
           else if (playCard(g, "player", idx, t.c, t.s)) {
             this.impact(t.c, 360, 80, HERO_BY_ID[SKILL_BY_ID[id]?.hero ?? "aruvi"].color);
             this.floatText("SKILL QUEUED", 360, this.carriers[t.c]?.y ?? 0, "#7fd8ff");
             this.floatText(`-${energyBefore - g.player.energy} ENERGY`, ENERGY_POS.x, ENERGY_POS.y - 70, "#7fd8ff");
             this.refresh(); return;
           }
        }
        this.animFrom.set(d.src.uid, pos);
      } else if (t?.kind === "slot" && t.side === "player") {
        if (playCard(g, "player", idx, t.c, t.s)) this.animFrom.set(d.src.uid, { ...pos, impact: true });
        else msg = g.carriers[t.c]!.player[t.s] ? "SLOT OCCUPIED" : "NOT ENOUGH ENERGY";
      } else if (t?.kind === "slot") msg = "RIVAL SIDE";
      else if (t === null) msg = null;
      if (!isSkill(id) && !(t?.kind === "slot" && t.side === "player" && !msg)) this.animFrom.set(d.src.uid, pos);
    } else {
      const { c, s, uid } = d.src;
      if (t?.kind === "hand" && canTakeBack(g, c, s)) {
        const cost = g.carriers[c]!.player[s]!.cost;
        takeBack(g, c, s);
        this.animFrom.set(uid, pos);
        this.floatText(`+${cost} ENERGY`, ENERGY_POS.x, ENERGY_POS.y - 70, "#7fd8ff");
      } else if (t?.kind === "slot" && t.side === "player" && moveCard(g, c, s, t.c, t.s)) {
        this.animFrom.set(uid, { ...pos, impact: true });
      } else {
        if (t?.kind === "hand") msg = "SKILL USED · HERO LOCKED IN";
        else if (t?.kind === "slot" && t.side === "opponent") msg = "RIVAL SIDE";
        else if (t?.kind === "slot") msg = "SLOT OCCUPIED";
        this.animFrom.set(uid, pos);
      }
    }
    if (msg) this.flash(msg);
    if (g.player.energy < energyBefore) this.floatText(`-${energyBefore - g.player.energy} ENERGY`, ENERGY_POS.x, ENERGY_POS.y - 70, "#7fd8ff");
    this.refresh();
  }

  // ---------- feedback ----------
  impact(ci: number, x: number, y: number, color: number) {
    const cont = this.carriers[ci]!;
    const ring = this.add.circle(x, y, 20, color, 0).setStrokeStyle(4, color, 1);
    cont.add(ring);
    this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    for (let k = 0; k < 8; k++) {
      const p = this.add.rectangle(x, y, 3, 10, color, 1).setRotation(Math.random() * Math.PI);
      cont.add(p);
      const a = Math.random() * Math.PI * 2, dd = 34 + Math.random() * 26;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * dd, y: y + Math.sin(a) * dd, alpha: 0, duration: 680, onComplete: () => p.destroy() });
    }
    this.cameras.main.shake(70, 0.0018);
  }

  passiveFx(card: Phaser.GameObjects.Container, up: boolean) {
    const col = up ? 0x2fd36b : CORAL;
    const glow = this.add.graphics();
    glow.lineStyle(3, col, 1).strokeRoundedRect(-SLOT_W / 2 - 2, -SLOT_H / 2 - 2, SLOT_W + 4, SLOT_H + 4, 8);
    card.add(glow);
    this.tweens.add({ targets: glow, alpha: 0, duration: 950, delay: 200, onComplete: () => glow.destroy() });
  }

  skillFx(ci: number, name: string, color: number, id?: string) {
    const cont = this.carriers[ci]!;
    const sk = id ? SKILL_BY_ID[id] : undefined;
    if (sk) {
      const fx = HERO_EFFECTS[sk.hero];
      for (let k = 0; k < 14; k++) {
        const a = k / 14 * Math.PI * 2;
        const p = this.add.rectangle(360, SLOT_Y, sk.anim === "slash" ? 4 : 8, sk.anim === "shards" ? 24 : 8, color).setRotation(a);
        cont.add(p);
        this.tweens.add({ targets: p, x: 360 + Math.cos(a) * 220, y: SLOT_Y + Math.sin(a) * 70, angle: fx.drift * 3, alpha: 0, duration: 1000 + k * 20, onComplete: () => p.destroy() });
      }
    }
    const ring = this.add.circle(360, SLOT_Y, 40, color, 0.15).setStrokeStyle(5, color, 1);
    cont.add(ring);
    this.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 1100, onComplete: () => ring.destroy() });
    const t = this.add.text(360, cont.y - 92, name, { fontFamily: FONT, fontSize: "34px", color: "#ffffff", fontStyle: "700", stroke: Phaser.Display.Color.IntegerToColor(color).rgba, strokeThickness: 6 }).setOrigin(0.5).setDepth(70);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, delay: 850, duration: 700, onComplete: () => t.destroy() });
    this.cameras.main.shake(90, 0.003);
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
    this.detail?.close();
    opponentTurn(this.g);
    beginReveal(this.g);
    this.refresh();
    this.floatText("REVEAL PHASE", W / 2, 160, "#7fd8ff");
    const step = () => {
      const d = this.g.pending[0];
      if (!d) {
        const handBefore = new Set(this.g.player.hand.map((c) => c.uid));
        nextTurn(this.g); this.remaining = ROUND_SECONDS;
        for (const c of this.g.player.hand) if (!handBefore.has(c.uid)) this.animFrom.set(c.uid, { x: W - 40, y: 990 });
        this.timerText.setText(`${this.remaining}s`);
        this.refresh();
        if (this.g.phase === "over") this.showResult();
        else { this.floatText(`ROUND ${this.g.turn}`, W / 2, 160, "#7fd8ff"); this.audio.play("draw"); }
        return;
      }
      const v = viewOf(d.card.id, this.tf(d.side));
      const x = d.skill ? 360 : SLOT_X[d.side][d.slot] ?? 360;
      const y = (this.carriers[d.carrier]?.y ?? 0) + SLOT_Y;
      const flip = createCard(this, v, SLOT_W, SLOT_H, { concealed: true }).setPosition(x, y).setDepth(90);
      const spotlight = this.add.graphics().setDepth(85);
      spotlight.lineStyle(3, v.color, 0.9).strokeRoundedRect(x - SLOT_W * 0.6, y - SLOT_H * 0.6, SLOT_W * 1.2, SLOT_H * 1.2, 8);
      this.tweens.add({ targets: spotlight, alpha: 0, duration: 1600, onComplete: () => spotlight.destroy() });
      this.tweens.add({ targets: flip, scaleX: 0, scaleY: 1.3, delay: 240, duration: 400, ease: "Sine.in", onComplete: () => {
        flip.destroy();
        const handBefore = new Set(this.g.player.hand.map((c) => c.uid));
        const scoresBefore = this.g.carriers.map((_c, ci) => ({ player: carrierScore(this.g, ci, "player"), opponent: carrierScore(this.g, ci, "opponent") }));
        revealNext(this.g);
        for (const c of this.g.player.hand) if (!handBefore.has(c.uid)) this.animFrom.set(c.uid, { x, y });
        this.refresh();
        const face = createCard(this, v, SLOT_W, SLOT_H, { enemy: d.side === "opponent" }).setPosition(x, y).setScale(0, 1.3).setDepth(90);
        this.audio.play(d.skill ? "cast" : "reveal", v.hero);
        if (!d.skill && d.side === "player") this.audio.play("draw", v.hero);
        this.tweens.add({ targets: face, scaleX: 1.3, scaleY: 1.3, duration: 440, ease: "Sine.out", onComplete: () => {
          if (d.skill) {
            this.skillFx(d.carrier, v.name, v.color, d.card.id);
            for (const side of ["player", "opponent"] as Side[]) {
              const oldScore = scoresBefore[d.carrier]?.[side] ?? 0;
              const delta = carrierScore(this.g, d.carrier, side) - oldScore;
              if (delta) {
                const tx = side === "player" ? 165 : 555;
                const tether = this.add.graphics().setDepth(92);
                tether.lineStyle(4, v.color, 0.9).lineBetween(x, y, tx, y);
                this.tweens.add({ targets: tether, alpha: 0, duration: 1100, onComplete: () => tether.destroy() });
                this.floatText(`${delta > 0 ? "+" : ""}${delta} POWER`, tx, y - 65, delta > 0 ? "#a0ffcb" : "#ff8892");
              }
            }
            this.audio.play("destroy", v.hero);
            this.tweens.add({ targets: face, alpha: 0, scale: 0.2, angle: 25, delay: 450, duration: 650, onComplete: () => face.destroy() });
          } else {
            this.impact(d.carrier, x, SLOT_Y, v.color);
            this.tweens.add({ targets: face, scale: 1, delay: 400, duration: 350, ease: "Cubic.inOut", onComplete: () => face.destroy() });
          }
        } });
        this.time.delayedCall(d.skill ? 2000 : 1550, step);
      } });
    };
    this.time.delayedCall(500, step);
  }

  showResult() {
    const r = result(this.g);
    this.audio.play("result");
    if (!this.resultSent) { this.resultSent = true; this.assets.onResult?.(r.outcome); }
    const o = this.add.container(W / 2, 560).setDepth(100);
    const bg = this.add.graphics();
    const col = r.outcome === "win" ? CYAN : r.outcome === "loss" ? CORAL : GOLD;
    bg.fillStyle(HUD_BG, 0.95).fillRoundedRect(-260, -150, 520, 300, 16);
    bg.lineStyle(4, col, 1).strokeRoundedRect(-260, -150, 520, 300, 16);
    o.add(bg);
    o.add(this.add.text(0, -80, r.outcome === "win" ? "VICTORY" : r.outcome === "loss" ? "DEFEAT" : "DRAW",
      { fontFamily: FONT, fontSize: "84px", color: Phaser.Display.Color.IntegerToColor(col).rgba, fontStyle: "700" }).setOrigin(0.5));
    o.add(this.add.text(0, 0, `CARRIERS WON ${r.won} · LOST ${r.lost}`, { fontFamily: FONT, fontSize: "30px", color: "#dfe7ff" }).setOrigin(0.5));
    const btn = this.add.text(this.assets.onExit ? -110 : 0, 80, " PLAY AGAIN ", { fontFamily: FONT, fontSize: "36px", color: "#1a1206", backgroundColor: "#ffc23a", padding: { x: 10, y: 4 }, fontStyle: "700" })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => this.scene.restart());
    o.add(btn);
    if (this.assets.onExit) {
      const menu = this.add.text(110, 80, " MENU ", { fontFamily: FONT, fontSize: "36px", color: "#ffffff", backgroundColor: "#24345c", padding: { x: 10, y: 4 }, fontStyle: "700" })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      menu.on("pointerdown", () => this.assets.onExit?.());
      o.add(menu);
    }
    if (r.outcome !== "loss") o.add(this.add.text(0, 124, `+${r.outcome === "win" ? 3 : 1} SHARDS`, { fontFamily: FONT, fontSize: "24px", color: "#ffd76a" }).setOrigin(0.5));
    o.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 300, ease: "Back.out" });
  }
}

const energyForDisplay = energyForTurn;
