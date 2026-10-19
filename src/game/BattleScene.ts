import * as Phaser from "phaser";
import { BattleAudio } from "./audio";
import { HERO_EFFECTS } from "./heroEffects";
import { artKey, foregroundKey, logoKey } from "./heroArt";
import { createCard, createDetail, FONT, viewOf, type CardView } from "./cardView";
import type { HeroId } from "./heroes";
import { SKILL_BY_ID } from "./skills";
import { getHandCardDimensions, handLayout, nearestIndex, zeroOverlapHandLayout, type HandPos } from "./handLayout";
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
/** Player owns the LEFT half of each deck, rival the RIGHT half. */
const SLOT_X: Record<Side, number[]> = { player: [84, 176, 268], opponent: [452, 544, 636] };
const SLOT_Y = -42;
const SLOT_W = 82, SLOT_H = 112;
const HAND_W = 124, HAND_H = 176;
const CRIMSON = 0xd8233a;
const LANE_TINT = [0x5fd4ff, 0x7f9dff, 0xff6a5e];
const HUD_BG = 0x071120;
const CYAN = 0x00e5ff, CORAL = 0xff5a64, GOLD = 0xffc23a;

type DragSrc = { kind: "hand"; idx: number; uid: number } | { kind: "board"; c: number; s: number; uid: number };
interface Target { kind: "slot"; side: Side; c: number; s: number } 
type DropTarget = Target | { kind: "hand" } | null;

export class BattleScene extends Phaser.Scene {
  get H() { return this.scale.height; }
  get CONTROLS_Y() { return this.H - 52; }
  get HAND_CX() { return W / 2; }
  get HAND_ZONE() { return { x0: 16, x1: W - 16, y0: this.H - 360 }; }
  get UNDO_POS() { return { x: 0, y: this.CONTROLS_Y }; }
  get ENERGY_POS() { return { x: W / 2, y: this.CONTROLS_Y - 20 }; }
  get END_POS() { return { x: W, y: this.CONTROLS_Y }; }

  get CARRIER_Y(): number[] {
    const H = this.H;
    const topY = H > 1350 ? 195 : 170;
    const bottomY = H > 1350 ? H - 360 : H - 280;
    const avail = bottomY - topY;
    const step = avail / 3;
    return [
      Math.round(topY + step * 0.44),
      Math.round(topY + step * 1.44),
      Math.round(topY + step * 2.44),
    ];
  }

  tacticalMenu: Phaser.GameObjects.Container | null = null;
  selectedCardIndex = -1;
  endTurnDown = false;
  undoDown = false;
  handTouch: {
    pointerId: number;
    startX: number;
    startY: number;
    initialIndex: number;
    currentIndex: number;
    mode: "pending" | "swiping" | "dragging";
    startTime: number;
  } | null = null;

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
  undoBtn!: Phaser.GameObjects.Container;
  undoText!: Phaser.GameObjects.Text;
  energyOrbContainer!: Phaser.GameObjects.Container;
  energyGfx!: Phaser.GameObjects.Graphics;
  energyText!: Phaser.GameObjects.Text;
  energyMaxText!: Phaser.GameObjects.Text;
  lastEnergy: number | undefined;
  turnText!: Phaser.GameObjects.Text;
  statusText!: Phaser.GameObjects.Text;
  endBtn!: Phaser.GameObjects.Container;
  endLabel!: Phaser.GameObjects.Text;
  endTurnCounter!: Phaser.GameObjects.Text;
  totals!: { p: Phaser.GameObjects.Text; o: Phaser.GameObjects.Text };
  bg?: Phaser.GameObjects.Image;
  /** Purely visual: where a card should animate in from on next render. */
  animFrom = new Map<number, { x: number; y: number; impact?: boolean }>();
  lastPower = new Map<number, number>();
  lastScores: number[] = [];
  resultSent = false;
  tf = (side: Side) => (h: HeroId) => tierOf(this.g, side, h);
  drag: { src: DragSrc; obj: Phaser.GameObjects.Container; ox: number; oy: number; hover: DropTarget; manual?: boolean } | null = null;

  roundPipsGfx!: Phaser.GameObjects.Graphics;
  timerBgGfx!: Phaser.GameObjects.Graphics;
  remaining = ROUND_SECONDS;
  timerText!: Phaser.GameObjects.Text;
  audio = new BattleAudio();
  constructor(private assets: Assets) { super("battle"); }

  preload() {
    this.g = createGame({ player: this.assets.deck });
    this.load.on("progress", (n: number) => this.assets.onLoad?.(n));
    this.load.on("loaderror", () => this.assets.onError?.());
    this.load.image("carrier", this.assets.carrier);
    const keys = new Set(["badge-cost", "badge-power", "card-back", artKey("aruvi", "base"), artKey("ella", "base")]);
    for (const side of ["player", "opponent"] as Side[]) for (const id of Object.keys(this.g[side].tiers)) {
      if (isHeroId(id)) {
        const tier = tierOf(this.g, side, id);
        keys.add(artKey(id, tier)); keys.add(logoKey(id));
        if (tier !== "base") keys.add(foregroundKey(id, tier));
        for (const s of ["s1", "s2", "ult"]) keys.add(`skill-${id}-${s}`);
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
    this.CARRIER_Y.forEach((y, i) => this.drawCarrier(i, y));
    this.drawTopHud();
    this.drawBottomHud();
    this.handLayer = this.add.container(0, 0).setDepth(50);
    this.setupDrag();
    this.remaining = ROUND_SECONDS;
    this.time.addEvent({ delay: 1000, loop: true, callback: () => {
      if (this.g.phase !== "player") return;
      this.remaining = Math.max(0, this.remaining - 1);
      this.timerText.setText(`${this.remaining}s`).setColor(this.remaining <= 10 ? "#ff4655" : "#38bdf8");
      this.drawTimerWidget();
      if (this.remaining <= 5) this.audio.play("tick");
      if (this.remaining === 0) { if (this.drag) this.finishDrag(null); this.endTurn(); }
    } });
    this.events.once("shutdown", () => { this.audio.destroy(); this.detail?.close(); this.input.removeAllListeners(); this.load.removeAllListeners(); });
    this.refresh();
    this.assets.onReady?.();
  }

  update(time: number) {
    const basePositions = this.CARRIER_Y;
    for (let i = 0; i < this.carriers.length; i++) {
      const c = this.carriers[i];
      const baseY = basePositions[i];
      if (c && baseY !== undefined) {
        c.y = baseY + Math.sin(time * 0.0018 + i * 1.5) * 3.5;
      }
    }
  }

  // ---------- environment ----------
  drawEnvironment() {
    // Animated sky video is hardware-rendered directly behind the transparent canvas
  }

  drawCarrier(i: number, y: number) {
    const c = this.add.container(0, y).setDepth(10 + i);
    const tint = LANE_TINT[i]!;
    const SX = 14, SY = -72, SW = 692;
    const tex = this.textures.get("carrier").getSourceImage() as HTMLImageElement;
    const SH = SW * (tex.height / tex.width);

    const lg = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    c.add(lg);
    this.laneGlow[i] = lg;

    // Carrier ship base artwork (clean without shadow or effects)
    c.add(this.add.image(SX, SY, "carrier").setOrigin(0, 0).setDisplaySize(SW, SH));

    // Deck ownership & docking runway lines (clean sharp guidelines, no ovals)
    const d = this.add.graphics();
    // Runway edge guide lines
    d.lineStyle(2, CYAN, 0.85).lineBetween(48, 14, 308, 14);
    d.lineStyle(2, CORAL, 0.85).lineBetween(412, 14, 672, 14);
    // Clean docking slot boundary markers
    for (let s = 0; s < SLOTS; s++) {
      const px = SLOT_X.player[s]!;
      d.lineStyle(1.5, CYAN, 0.45).strokeRoundedRect(px - SLOT_W / 2, SLOT_Y - SLOT_H / 2, SLOT_W, SLOT_H, 6);
      const ox = SLOT_X.opponent[s]!;
      d.lineStyle(1.5, CORAL, 0.45).strokeRoundedRect(ox - SLOT_W / 2, SLOT_Y - SLOT_H / 2, SLOT_W, SLOT_H, 6);
    }
    c.add(d);

    // Centre score / VS block
    const sp = this.add.graphics();
    sp.fillStyle(HUD_BG, 0.95).fillRoundedRect(317, -72, 86, 86, 12);
    sp.fillStyle(CYAN, 0.22).fillRoundedRect(317, -72, 43, 86, { tl: 12, bl: 12, tr: 0, br: 0 });
    sp.fillStyle(CORAL, 0.22).fillRoundedRect(360, -72, 43, 86, { tl: 0, bl: 0, tr: 12, br: 12 });
    sp.lineStyle(2, 0xffffff, 0.2).strokeRoundedRect(317, -72, 86, 86, 12);
    c.add(sp);
    c.add(this.add.text(360, -76, "VS", { fontFamily: FONT, fontSize: "16px", color: "#ffc23a", fontStyle: "700", backgroundColor: "#0a1020", padding: { x: 5, y: 1 } }).setOrigin(0.5));
    const p = this.add.text(338, -26, "0", { fontFamily: FONT, fontSize: "44px", color: "#7fd8ff", fontStyle: "700" }).setOrigin(0.5);
    const o = this.add.text(382, -26, "0", { fontFamily: FONT, fontSize: "44px", color: "#ff8a8f", fontStyle: "700" }).setOrigin(0.5);
    c.add([p, o]);
    this.scoreText[i] = { p, o };

    // Lane chip above deck
    const col = Phaser.Display.Color.IntegerToColor(tint).rgba;
    const chip = this.add.graphics();
    chip.fillStyle(HUD_BG, 0.88).fillRoundedRect(16, -128, 156, 32, 6);
    chip.fillStyle(tint, 1).fillRect(16, -128, 4, 32);
    c.add(chip);
    c.add(this.add.text(28, -127, `0${i + 1}`, { fontFamily: FONT, fontSize: "28px", color: col, fontStyle: "700" }));
    c.add(this.add.text(64, -123, `${this.g.carriers[i]!.name} LANE`, { fontFamily: FONT, fontSize: "21px", color: "#eef3ff", fontStyle: "600" }));

    const fx = this.add.graphics();
    c.add(fx);
    this.slotFx[i] = fx;
    const layer = this.add.container(0, 0);
    c.add(layer);
    this.cardLayers[i] = layer;

    this.carriers[i] = c;
  }

  // ---------- HUD ----------
  drawTopHud() {
    // 1. Transparent background with soft top atmospheric vignette (no solid black bar)
    const topVeil = this.add.graphics().setDepth(38);
    topVeil.fillGradientStyle(0x040814, 0x040814, 0x040814, 0x040814, 0.5, 0.5, 0, 0).fillRect(0, 0, W, 130);

    const hudGfx = this.add.graphics().setDepth(40);

    // 2. Left Floating Unit: ARUVI (Edge-docked Player Wing)
    const pPlate = [
      { x: 0, y: 4 },
      { x: 244, y: 4 },
      { x: 204, y: 122 },
      { x: 0, y: 122 },
    ];
    hudGfx.fillStyle(0x01050f, 0.75).fillPoints(pPlate.map((p) => ({ x: p.x + 2, y: p.y + 3 })), true);
    hudGfx.fillStyle(0x041326, 0.92).fillPoints(pPlate, true);
    hudGfx.lineStyle(2.5, 0x00e5ff, 0.95).strokePoints(pPlate, true, true);

    // ARUVI Character Avatar Image cropped & framed with full face visible
    const pAvatarX = 58, pAvatarY = 64, pAvatarR = 44;
    // Dark circular aperture with neon borders
    hudGfx.fillStyle(0x020814, 1).fillCircle(pAvatarX, pAvatarY, pAvatarR + 4);
    hudGfx.lineStyle(3, 0x00e5ff, 1).strokeCircle(pAvatarX, pAvatarY, pAvatarR + 2);
    hudGfx.lineStyle(1.5, 0xffffff, 0.8).strokeCircle(pAvatarX, pAvatarY, pAvatarR);

    // Texture image mask with focus centered on face
    const aruviKey = artKey("aruvi", "base");
    if (this.textures.exists(aruviKey)) {
      const pMaskGfx = this.make.graphics({});
      pMaskGfx.fillCircle(pAvatarX, pAvatarY, pAvatarR);
      this.add.image(pAvatarX, pAvatarY - 4, aruviKey)
        .setDisplaySize(148, 210)
        .setOrigin(0.5, 0.14)
        .setDepth(42)
        .setMask(pMaskGfx.createGeometryMask());
    }

    // Player name in big bold typography
    this.add.text(114, 36, "ARUVI", {
      fontFamily: FONT,
      fontSize: "30px",
      color: "#ffffff",
      fontStyle: "900",
      stroke: "#031526",
      strokeThickness: 3,
    }).setDepth(42);

    // Trophy count (replaces power 0)
    this.totals = {
      p: this.add.text(114, 74, "🏆 420", {
        fontFamily: FONT,
        fontSize: "24px",
        color: "#facc15",
        fontStyle: "900",
        stroke: "#031526",
        strokeThickness: 2,
      }).setDepth(42),
      o: this.add.text(W - 114, 74, "🏆 465", {
        fontFamily: FONT,
        fontSize: "24px",
        color: "#facc15",
        fontStyle: "900",
        stroke: "#260209",
        strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(42),
    };

    // 3. Right Floating Unit: ELLA (Edge-docked Rival Wing)
    const oPlate = [
      { x: W - 244, y: 4 },
      { x: W, y: 4 },
      { x: W, y: 122 },
      { x: W - 204, y: 122 },
    ];
    hudGfx.fillStyle(0x0f0105, 0.75).fillPoints(oPlate.map((p) => ({ x: p.x - 2, y: p.y + 3 })), true);
    hudGfx.fillStyle(0x22050d, 0.92).fillPoints(oPlate, true);
    hudGfx.lineStyle(2.5, 0xf43f5e, 0.95).strokePoints(oPlate, true, true);

    // ELLA Character Avatar Image cropped & framed with full face visible
    const oAvatarX = W - 58, oAvatarY = 64, oAvatarR = 44;
    hudGfx.fillStyle(0x140206, 1).fillCircle(oAvatarX, oAvatarY, oAvatarR + 4);
    hudGfx.lineStyle(3, 0xf43f5e, 1).strokeCircle(oAvatarX, oAvatarY, oAvatarR + 2);
    hudGfx.lineStyle(1.5, 0xffffff, 0.8).strokeCircle(oAvatarX, oAvatarY, oAvatarR);

    // Texture image mask with focus centered on face
    const ellaKey = artKey("ella", "base");
    if (this.textures.exists(ellaKey)) {
      const oMaskGfx = this.make.graphics({});
      oMaskGfx.fillCircle(oAvatarX, oAvatarY, oAvatarR);
      this.add.image(oAvatarX, oAvatarY - 4, ellaKey)
        .setDisplaySize(148, 210)
        .setOrigin(0.5, 0.15)
        .setDepth(42)
        .setMask(oMaskGfx.createGeometryMask());
    }

    // Rival name in big bold typography
    this.add.text(W - 114, 36, "ELLA", {
      fontFamily: FONT,
      fontSize: "30px",
      color: "#ffffff",
      fontStyle: "900",
      stroke: "#260209",
      strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(42);

    // 4. Center Command Center: Floating Turn Node & Interactive Badge
    const centerPlate = [
      { x: W / 2 - 92, y: 4 },
      { x: W / 2 + 92, y: 4 },
      { x: W / 2 + 74, y: 100 },
      { x: W / 2 - 74, y: 100 },
    ];
    // Drop shadow & translucent tactical body
    hudGfx.fillStyle(0x000000, 0.7).fillPoints(centerPlate.map((p) => ({ x: p.x, y: p.y + 3 })), true);
    hudGfx.fillStyle(0x09111e, 0.94).fillPoints(centerPlate, true);
    hudGfx.lineStyle(2.5, 0x00e5ff, 0.9).strokePoints(centerPlate, true, true);
    hudGfx.fillStyle(GOLD, 1).fillRect(W / 2 - 70, 97, 140, 3);

    // Interactive hit box for Tactical Menu
    const turnHit = this.add.rectangle(W / 2, 52, 184, 96, 0x000000, 0).setDepth(44).setInteractive({ useHandCursor: true });
    turnHit.on("pointerup", () => this.openTacticalMenu());

    // Big Turn Counter Number (no ROUND text, no settings icon)
    this.turnText = this.add.text(W / 2, 42, `${this.g.turn}/${MAX_TURNS}`, {
      fontFamily: FONT,
      fontSize: "46px",
      color: "#ffffff",
      fontStyle: "900",
      stroke: "#031526",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(42);

    // Segmented Round Meter Pips (6 match turns)
    this.roundPipsGfx = this.add.graphics().setDepth(43);
    this.updateTurnMeter(this.g.turn);

    // 5. Floating Match Timer: Completely transparent background, glowing numbers
    this.timerText = this.add.text(W / 2, 122, `${ROUND_SECONDS}s`, {
      fontFamily: FONT,
      fontSize: "28px",
      color: "#38bdf8",
      fontStyle: "900",
      stroke: "#031526",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(42);
  }

  updateTurnMeter(turn: number) {
    if (!this.roundPipsGfx) return;
    const gfx = this.roundPipsGfx;
    gfx.clear();
    const startX = W / 2 - 55;
    for (let i = 1; i <= MAX_TURNS; i++) {
      const px = startX + (i - 1) * 22;
      const py = 78;
      if (i < turn) {
        // Completed turn: solid cyan diamond
        gfx.fillStyle(CYAN, 0.95);
        gfx.fillPoints([{ x: px, y: py - 7 }, { x: px + 7, y: py }, { x: px, y: py + 7 }, { x: px - 7, y: py }], true);
      } else if (i === turn) {
        // Active turn: glowing gold diamond
        gfx.fillStyle(GOLD, 1);
        gfx.fillPoints([{ x: px, y: py - 8 }, { x: px + 8, y: py }, { x: px, y: py + 8 }, { x: px - 8, y: py }], true);
        gfx.lineStyle(1.5, 0xffffff, 0.95);
        gfx.strokePoints([{ x: px, y: py - 8 }, { x: px + 8, y: py }, { x: px, y: py + 8 }, { x: px - 8, y: py }], true, true);
      } else {
        // Upcoming turn: subtle outline
        gfx.lineStyle(1.5, 0x475569, 0.85);
        gfx.strokePoints([{ x: px, y: py - 6 }, { x: px + 6, y: py }, { x: px, y: py + 6 }, { x: px - 6, y: py }], true, true);
      }
    }
  }

  drawTimerWidget() {}

  openTacticalMenu() {
    if (this.tacticalMenu) return;
    this.audio.play("tick");

    const root = this.add.container(0, 0).setDepth(600);
    const H = this.H;

    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x030712, 0.88).setInteractive();
    root.add(bg);

    const mw = 520, mh = 470;
    const mx = W / 2, my = H / 2;

    const winGfx = this.add.graphics();
    const chamfer = 24;
    const winPoints = [
      { x: -mw / 2 + chamfer, y: -mh / 2 },
      { x: mw / 2, y: -mh / 2 },
      { x: mw / 2, y: mh / 2 - chamfer },
      { x: mw / 2 - chamfer, y: mh / 2 },
      { x: -mw / 2, y: mh / 2 },
      { x: -mw / 2, y: -mh / 2 + chamfer },
    ];
    winGfx.fillStyle(0x000000, 0.75).fillPoints(winPoints.map((p) => ({ x: mx + p.x + 3, y: my + p.y + 6 })), true);
    winGfx.fillStyle(0x09111e, 0.98).fillPoints(winPoints.map((p) => ({ x: mx + p.x, y: my + p.y })), true);
    winGfx.lineStyle(2, 0x00e5ff, 0.9).strokePoints(winPoints.map((p) => ({ x: mx + p.x, y: my + p.y })), true, true);
    winGfx.fillStyle(0x00e5ff, 0.15).fillRect(mx - mw / 2 + chamfer, my - mh / 2, mw - chamfer, 54);
    winGfx.lineStyle(2, 0x00e5ff, 0.8).lineBetween(mx - mw / 2, my - mh / 2 + 54, mx + mw / 2, my - mh / 2 + 54);
    root.add(winGfx);

    const title = this.add.text(mx, my - mh / 2 + 27, "// TACTICAL SETTINGS & MENU", {
      fontFamily: FONT,
      fontSize: "20px",
      color: "#00e5ff",
      fontStyle: "700",
    }).setOrigin(0.5);
    root.add(title);

    const info = this.add.text(mx, my - 130, `TURN: ${this.g.turn}/${MAX_TURNS}  ·  PHASE: ${this.g.phase.toUpperCase()}`, {
      fontFamily: FONT,
      fontSize: "17px",
      color: "#94a3b8",
      fontStyle: "600",
    }).setOrigin(0.5);
    root.add(info);

    // Music toggle button
    const musicBtn = this.add.container(mx, my - 60);
    const mBg = this.add.graphics();
    mBg.fillStyle(0x13233c, 0.9).fillRoundedRect(-180, -24, 360, 48, 8);
    mBg.lineStyle(1.5, 0x38bdf8, 0.8).strokeRoundedRect(-180, -24, 360, 48, 8);
    musicBtn.add(mBg);
    const mText = this.add.text(0, 0, `♫ MUSIC: ${this.audio.enabled ? "ON" : "MUTED"}`, {
      fontFamily: FONT,
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "700",
    }).setOrigin(0.5);
    musicBtn.add(mText);
    musicBtn.setSize(360, 48).setInteractive({ useHandCursor: true });
    musicBtn.on("pointerdown", () => musicBtn.setScale(0.95));
    musicBtn.on("pointerup", async () => {
      musicBtn.setScale(1);
      const on = await this.audio.toggle();
      mText.setText(`♫ MUSIC: ${on ? "ON" : "MUTED"}`);
      this.audio.play("tick");
    });
    root.add(musicBtn);

    // Surrender button
    const forfeitBtn = this.add.container(mx, my + 15);
    const fBg = this.add.graphics();
    fBg.fillStyle(0x38101a, 0.9).fillRoundedRect(-180, -24, 360, 48, 8);
    fBg.lineStyle(1.5, 0xf43f5e, 0.8).strokeRoundedRect(-180, -24, 360, 48, 8);
    forfeitBtn.add(fBg);
    const fText = this.add.text(0, 0, "SURRENDER MATCH", {
      fontFamily: FONT,
      fontSize: "19px",
      color: "#ff8594",
      fontStyle: "700",
    }).setOrigin(0.5);
    forfeitBtn.add(fText);
    forfeitBtn.setSize(360, 48).setInteractive({ useHandCursor: true });
    forfeitBtn.on("pointerdown", () => forfeitBtn.setScale(0.95));
    forfeitBtn.on("pointerup", () => {
      forfeitBtn.setScale(1);
      closeMenu();
      this.g.phase = "over";
      this.showResult();
    });
    root.add(forfeitBtn);

    // Leave to Hub button
    const leaveBtn = this.add.container(mx, my + 85);
    const lBg = this.add.graphics();
    lBg.fillStyle(0x0f172a, 0.9).fillRoundedRect(-180, -24, 360, 48, 8);
    lBg.lineStyle(1.5, 0x64748b, 0.8).strokeRoundedRect(-180, -24, 360, 48, 8);
    leaveBtn.add(lBg);
    const lText = this.add.text(0, 0, "LEAVE TO HUB", {
      fontFamily: FONT,
      fontSize: "19px",
      color: "#cbd5e1",
      fontStyle: "700",
    }).setOrigin(0.5);
    leaveBtn.add(lText);
    leaveBtn.setSize(360, 48).setInteractive({ useHandCursor: true });
    leaveBtn.on("pointerdown", () => leaveBtn.setScale(0.95));
    leaveBtn.on("pointerup", () => {
      leaveBtn.setScale(1);
      closeMenu();
      this.assets.onExit?.();
    });
    root.add(leaveBtn);

    // Resume button
    const resumeBtn = this.add.container(mx, my + 155);
    const rBg = this.add.graphics();
    rBg.fillStyle(0x0284c7, 0.9).fillRoundedRect(-180, -24, 360, 48, 8);
    rBg.lineStyle(1.5, 0x38bdf8, 1).strokeRoundedRect(-180, -24, 360, 48, 8);
    resumeBtn.add(rBg);
    const rText = this.add.text(0, 0, "‹ RESUME MATCH ›", {
      fontFamily: FONT,
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "700",
    }).setOrigin(0.5);
    resumeBtn.add(rText);
    resumeBtn.setSize(360, 48).setInteractive({ useHandCursor: true });
    resumeBtn.on("pointerdown", () => resumeBtn.setScale(0.95));
    resumeBtn.on("pointerup", () => {
      resumeBtn.setScale(1);
      closeMenu();
    });
    root.add(resumeBtn);

    const closeMenu = () => {
      this.audio.play("tick");
      root.destroy();
      this.tacticalMenu = null;
    };
    bg.on("pointerdown", closeMenu);

    this.tacticalMenu = root;
  }

  getEligibleUndo(): { carrier: number; slot: number; card: CardInst } | null {
    if (this.g.phase !== "player") return null;
    for (let i = this.g.pending.length - 1; i >= 0; i--) {
      const d = this.g.pending[i]!;
      if (d.side === "player" && !d.skill && isHeroId(d.card.id)) {
        if (canTakeBack(this.g, d.carrier, d.slot)) {
          return { carrier: d.carrier, slot: d.slot, card: d.card };
        }
      }
    }
    return null;
  }

  handleUndo() {
    const eligible = this.getEligibleUndo();
    if (!eligible) return;
    const { carrier, slot, card } = eligible;
    const slotX = SLOT_X.player[slot]!;
    const slotY = this.carriers[carrier]!.y + SLOT_Y;

    if (takeBack(this.g, carrier, slot)) {
      this.audio.play("undo");
      this.animFrom.set(card.uid, { x: slotX, y: slotY });
      this.refresh();
    }
  }

  drawBottomHud() {
    const H = this.H;
    // Seamless atmospheric bottom vignette without any dividing floor shelf line
    const g = this.add.graphics().setDepth(40);
    g.fillGradientStyle(0x060c1c, 0x060c1c, 0x060c1c, 0x060c1c, 0, 0, 0.4, 0.4).fillRect(0, H - 240, W, 240);

    this.handGlow = this.add.graphics().setDepth(41);

    // -------------------------------------------------------------
    // CONTROL A: SCREEN-EDGE DOCKED UNDO BUTTON (Red, Left Edge)
    // -------------------------------------------------------------
    const undoP = this.UNDO_POS; // { x: 0, y: CONTROLS_Y }
    const ub = this.add.container(undoP.x, undoP.y).setDepth(45);
    const undoPlate = [
      { x: 0, y: -48 },
      { x: 184, y: -48 },
      { x: 228, y: 52 },
      { x: 0, y: 52 },
    ];
    const uGfx = this.add.graphics();
    // Drop shadow
    uGfx.fillStyle(0x020610, 0.75).fillPoints(undoPlate.map((p) => ({ x: p.x + 3, y: p.y + 4 })), true);
    // Dark gunmetal bezel
    uGfx.fillStyle(0x0e1724, 1).fillPoints(undoPlate.map((p) => ({ x: p.x, y: p.y + 1 })), true);
    // Crimson body gradient (Valorant style)
    uGfx.fillGradientStyle(0xf43f5e, 0xf43f5e, 0x881337, 0x881337, 1, 1, 1, 1).fillPoints(undoPlate, true);
    // Top bevel highlight
    uGfx.fillStyle(0xfca5a5, 0.45).fillPoints([
      { x: 0, y: -46 },
      { x: 180, y: -46 },
      { x: 188, y: -26 },
      { x: 0, y: -26 },
    ], true);
    // Outer precision border
    uGfx.lineStyle(2, 0xffa3af, 0.95).strokePoints(undoPlate, true, true);
    // Directional tactical stripes on the slanted wing
    uGfx.lineStyle(1.5, 0xffa3af, 0.6);
    uGfx.lineBetween(186, -38, 196, -16);
    uGfx.lineBetween(196, -14, 206, 12);
    uGfx.lineBetween(206, 14, 218, 38);
    ub.add(uGfx);

    // Curved undo arrow icon
    const uIcon = this.add.graphics();
    uIcon.lineStyle(3.5, 0xffffff, 1);
    uIcon.beginPath();
    uIcon.arc(42, 0, 14, -Math.PI * 0.75, Math.PI * 0.5, false);
    uIcon.strokePath();
    uIcon.fillStyle(0xffffff, 1);
    uIcon.fillTriangle(42 - 11, -11, 42 - 2, -18, 42, -7);
    ub.add(uIcon);

    this.undoText = this.add.text(124, 1, "UNDO", {
      fontFamily: FONT,
      fontSize: "38px",
      color: "#ffffff",
      fontStyle: "900",
      stroke: "#4a041f",
      strokeThickness: 3,
    }).setOrigin(0.5);
    ub.add(this.undoText);

    ub.setSize(228, 100);
    const uHit = this.add.rectangle(114, 2, 228, 100, 0x000000, 0).setInteractive({ useHandCursor: true });
    ub.add(uHit);
    uHit.on("pointerdown", () => {
      if (this.getEligibleUndo()) {
        this.undoDown = true;
        ub.setScale(0.94);
      }
    });
    uHit.on("pointerup", () => {
      ub.setScale(1);
      if (this.undoDown && this.getEligibleUndo()) {
        this.undoDown = false;
        this.handleUndo();
      }
    });
    uHit.on("pointerout", () => {
      this.undoDown = false;
      ub.setScale(1);
    });
    this.undoBtn = ub;

    // -------------------------------------------------------------
    // CONTROL B: FLOATING RADIANITE ENERGY CORE (Electric Blue, Center)
    // -------------------------------------------------------------
    const ep = this.ENERGY_POS;
    const eb = this.add.container(ep.x, ep.y).setDepth(45);

    // Ambient outer glow
    const eGlow = this.add.graphics();
    eGlow.fillStyle(0x00e5ff, 0.18).fillCircle(0, 0, 62);
    eGlow.fillStyle(0x0284c7, 0.28).fillCircle(0, 0, 54);
    eb.add(eGlow);

    // Rotating tactical bracket segments
    const brackets = this.add.graphics();
    brackets.lineStyle(2.5, 0x00e5ff, 0.9);
    for (let b = 0; b < 3; b++) {
      const angle = (b * Math.PI * 2) / 3;
      brackets.beginPath();
      brackets.arc(0, 0, 52, angle - 0.45, angle + 0.45, false);
      brackets.strokePath();
    }
    eb.add(brackets);
    this.tweens.add({ targets: brackets, rotation: 6.28, duration: 16000, repeat: -1, ease: "Linear" });

    this.energyGfx = this.add.graphics();
    eb.add(this.energyGfx);

    // Dual counter-rotating plasma filaments
    const plasmaA = this.add.graphics();
    plasmaA.lineStyle(2, 0x38bdf8, 0.85);
    plasmaA.beginPath(); plasmaA.arc(0, 0, 46, -0.6, 1.2, false); plasmaA.strokePath();
    plasmaA.beginPath(); plasmaA.arc(0, 0, 47, 2.0, 3.8, false); plasmaA.strokePath();
    eb.add(plasmaA);
    this.tweens.add({ targets: plasmaA, rotation: 6.28, duration: 9000, repeat: -1, ease: "Linear" });

    const plasmaB = this.add.graphics();
    plasmaB.lineStyle(1.5, 0xbae6fd, 0.9);
    plasmaB.beginPath(); plasmaB.arc(0, 0, 44, 0.4, 2.2, false); plasmaB.strokePath();
    plasmaB.beginPath(); plasmaB.arc(0, 0, 45, 3.4, 5.2, false); plasmaB.strokePath();
    eb.add(plasmaB);
    this.tweens.add({ targets: plasmaB, rotation: -6.28, duration: 7000, repeat: -1, ease: "Linear" });

    // Just ONE clean, bold number in the center! (No /X)
    this.energyText = this.add.text(0, -2, "", {
      fontFamily: FONT,
      fontSize: "52px",
      color: "#ffffff",
      fontStyle: "900",
      stroke: "#034e7a",
      strokeThickness: 4,
    }).setOrigin(0.5);
    eb.add(this.energyText);

    const eLabel = this.add.text(0, 26, "ENERGY", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#7dd3fc",
      fontStyle: "800",
      stroke: "#032b45",
      strokeThickness: 2,
    }).setOrigin(0.5);
    eb.add(eLabel);

    this.energyOrbContainer = eb;

    // -------------------------------------------------------------
    // CONTROL C: SCREEN-EDGE DOCKED END TURN BUTTON (Right Edge)
    // -------------------------------------------------------------
    const endP = this.END_POS; // { x: W, y: CONTROLS_Y }
    const endb = this.add.container(endP.x, endP.y).setDepth(45);
    const endPlate = [
      { x: -184, y: -48 },
      { x: 0, y: -48 },
      { x: 0, y: 52 },
      { x: -228, y: 52 },
    ];
    const ebg = this.add.graphics();
    // Drop shadow
    ebg.fillStyle(0x020610, 0.75).fillPoints(endPlate.map((p) => ({ x: p.x + 3, y: p.y + 4 })), true);
    // Dark gunmetal bezel
    ebg.fillStyle(0x19081a, 1).fillPoints(endPlate.map((p) => ({ x: p.x, y: p.y + 1 })), true);
    // Crimson to magenta body gradient (Valorant style)
    ebg.fillGradientStyle(0xdb2777, 0xdb2777, 0x831843, 0x831843, 1, 1, 1, 1).fillPoints(endPlate, true);
    // Top bevel highlight
    ebg.fillStyle(0xf472b6, 0.45).fillPoints([
      { x: -180, y: -46 },
      { x: 0, y: -46 },
      { x: 0, y: -26 },
      { x: -188, y: -26 },
    ], true);
    // Inner precision border
    ebg.lineStyle(2, 0xfbcfe8, 0.95).strokePoints(endPlate, true, true);
    // Directional tactical stripes on the slanted wing
    ebg.lineStyle(1.5, 0xfbcfe8, 0.6);
    ebg.lineBetween(-186, -38, -196, -16);
    ebg.lineBetween(-196, -14, -206, 12);
    ebg.lineBetween(-206, 14, -218, 38);
    endb.add(ebg);

    // Active turn halo pulse
    const halo = this.add.graphics();
    halo.lineStyle(2.5, 0xf43f5e, 0.8).strokePoints(endPlate.map((p) => ({ x: p.x * 1.06, y: p.y * 1.15 })), true, true);
    endb.addAt(halo, 0);
    this.tweens.add({ targets: halo, scale: 1.06, alpha: 0, duration: 1200, repeat: -1 });

    this.endLabel = this.add.text(-102, -12, "END TURN", {
      fontFamily: FONT,
      fontSize: "36px",
      color: "#ffffff",
      fontStyle: "900",
      stroke: "#4a041f",
      strokeThickness: 3,
    }).setOrigin(0.5);
    endb.add(this.endLabel);

    this.endTurnCounter = this.add.text(-102, 23, `${this.g.turn}/${MAX_TURNS}`, {
      fontFamily: FONT,
      fontSize: "26px",
      color: "#ffffff",
      fontStyle: "900",
      stroke: "#4a041f",
      strokeThickness: 3,
    }).setOrigin(0.5);
    endb.add(this.endTurnCounter);

    endb.setSize(228, 100);
    const endHit = this.add.rectangle(-114, 2, 228, 100, 0x000000, 0).setInteractive({ useHandCursor: true });
    endb.add(endHit);
    endHit.on("pointerdown", () => {
      if (this.g.phase === "player") {
        this.endTurnDown = true;
        endb.setScale(0.94);
      }
    });
    endHit.on("pointerup", () => {
      endb.setScale(1);
      if (this.endTurnDown && !this.dragged && !this.drag) {
        this.endTurnDown = false;
        this.endTurn();
      }
    });
    endHit.on("pointerout", () => {
      this.endTurnDown = false;
      endb.setScale(1);
    });
    this.endBtn = endb;
  }

  updateUndoState() {
    if (!this.undoBtn) return;
    const eligible = this.getEligibleUndo();
    if (eligible) {
      this.undoBtn.setAlpha(1);
      this.undoBtn.input && (this.undoBtn.input.enabled = true);
    } else {
      this.undoBtn.setAlpha(0.3);
      this.undoBtn.input && (this.undoBtn.input.enabled = false);
    }
  }

  /** Luminous electric blue energy orb display: JUST ONE BIG NUMBER. */
  drawEnergy() {
    const e = this.g.player.energy;
    const gfx = this.energyGfx;
    if (!gfx) return;
    gfx.clear();

    // Drop shadow
    gfx.fillStyle(0x020617, 0.75).fillCircle(1, 2, 48);
    // Deep navy -> bright electric blue core
    gfx.fillGradientStyle(0x0284c7, 0x0284c7, 0x03254c, 0x03254c, 1, 1, 1, 1).fillCircle(0, 0, 46);

    // Inner bright electric-blue aura
    gfx.fillStyle(0x00d4ff, 0.45).fillCircle(0, 0, 40);

    // Curved specular highlight on top
    gfx.lineStyle(3, 0xffffff, 0.65);
    gfx.beginPath(); gfx.arc(0, 0, 38, -Math.PI * 0.75, -Math.PI * 0.25, false); gfx.strokePath();

    // Outer perimeter rim
    gfx.lineStyle(2.5, 0x38bdf8, 0.95).strokeCircle(0, 0, 46);
    gfx.lineStyle(1.5, 0xffffff, 0.65).strokeCircle(0, 0, 44);

    // Show ONLY the single big number!
    this.energyText.setText(`${e}`);

    if (this.lastEnergy !== undefined && this.lastEnergy !== e) {
      this.tweens.add({ targets: this.energyOrbContainer, scale: 1.18, duration: 130, yoyo: true });
      const pulse = this.add.circle(this.ENERGY_POS.x, this.ENERGY_POS.y, 44, CYAN, 0).setStrokeStyle(3, 0x00e5ff, 0.95).setDepth(44);
      this.tweens.add({ targets: pulse, scale: 1.6, alpha: 0, duration: 450, onComplete: () => pulse.destroy() });
      this.audio.play("tick");
    }
    this.lastEnergy = e;
    this.updateUndoState();
  }

  // ---------- state → view ----------
  refresh() {
    const g = this.g;
    this.turnText.setText(`${g.turn}/${MAX_TURNS}`);
    if (this.endTurnCounter) this.endTurnCounter.setText(`${g.turn}/${MAX_TURNS}`);
    this.updateTurnMeter(g.turn);
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
      if (lg) { lg.clear(); if (p !== o) lg.lineStyle(2.5, p > o ? CYAN : CORAL, 0.75).lineBetween(48, 14, 672, 14); }
      st.p.setText(`${p}`).setAlpha(p >= o ? 1 : 0.6);
      st.o.setText(`${o}`).setAlpha(o >= p ? 1 : 0.6);
    });

    this.drawEnergy();
    const active = g.phase === "player";
    this.endBtn.setAlpha(active ? 1 : 0.45);
    this.endLabel.setText(active ? "END TURN" : g.phase === "over" ? "DONE" : "LOCKED");
    this.updateUndoState();

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

          // Grounding pedestal on the carrier flight deck floor (clean lines, no ovals)
          const shadow = this.add.graphics();
          const teamCol = side === "player" ? CYAN : CORAL;
          const cw = SLOT_W - 4;
          const groundY = y + (SLOT_H - 4) / 2;
          shadow.fillStyle(0x000208, 0.9).fillRect(x - cw * 0.44, groundY - 1, cw * 0.88, 3);
          shadow.lineStyle(2, teamCol, 0.85).lineBetween(x - cw * 0.44, groundY, x + cw * 0.44, groundY);
          shadow.lineStyle(1.5, 0xffffff, 0.6).lineBetween(x - cw * 0.22, groundY, x + cw * 0.22, groundY);
          layer.add(shadow);

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
            if (isHeroId(p.id)) this.audio.play("passive", p.id);
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
    if (n === 0) return;

    // Responsive sizing & spacing for 1 to 8 cards with ZERO overlap
    const availableWidth = W - 32;
    const { cardW, cardH } = getHandCardDimensions(n, availableWidth);
    const cardCenterY = (this.H - 140) - cardH / 2;
    const cx = W / 2;

    const pos = zeroOverlapHandLayout(n, cx, cardCenterY, availableWidth, cardW, {
      selectionIndex: this.selectedCardIndex >= 0 ? this.selectedCardIndex : undefined,
      liftY: 26,
      enableCurve: true,
    });

    order.forEach((idx, k) => {
      const inst = hand[idx]!;
      const p = pos[k]!;
      const view = viewOf(inst.id, this.tf("player"));
      const card = createCard(this, view, cardW, cardH);
      const afford = cardCost(inst.id) <= this.g.player.energy && this.g.phase === "player";
      const isSelected = k === this.selectedCardIndex;

      card.setPosition(p.x, p.y).setRotation(p.rot).setAlpha(afford ? 1 : 0.55);
      if (isSelected) card.setScale(1.08);

      card.setData("src", { kind: "hand", idx, uid: inst.uid } satisfies DragSrc);
      card.setData("handCard", true);
      card.setData("view", view);
      card.setData("handIndex", k);

      // Hero-color glowing border accent
      const accentCol = isHeroId(inst.id) ? HERO_BY_ID[inst.id].color : (SKILL_BY_ID[inst.id]!.ultimate ? GOLD : HERO_BY_ID[SKILL_BY_ID[inst.id]!.hero].color);
      const edgeGlow = this.add.graphics();
      edgeGlow.lineStyle(1.5, accentCol, afford ? 0.8 : 0.3).strokeRoundedRect(-cardW / 2 + 1, -cardH / 2 + 1, cardW - 2, cardH - 2, 7);
      card.add(edgeGlow);

      // Selection highlight ring when selected
      if (isSelected) {
        const selGlow = this.add.graphics();
        selGlow.lineStyle(3, 0x00e5ff, 1).strokeRoundedRect(-cardW / 2 - 2, -cardH / 2 - 2, cardW + 4, cardH + 4, 9);
        card.add(selGlow);
      }

      // Unaffordable: muted overlay
      if (!afford && this.g.phase === "player") {
        const dim = this.add.graphics();
        dim.fillStyle(0x060c18, 0.45).fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
        dim.lineStyle(1.5, 0x3e5270, 0.6).strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
        card.add(dim);
      }

      this.handLayer.add(card);
      this.handCards.push({ card, pos: p });

      // Card draw entrance animation
      const from = this.animFrom.get(inst.uid);
      if (from) {
        this.animFrom.delete(inst.uid);
        card.setPosition(from.x, from.y).setScale(0.4).setAlpha(0);
        this.tweens.add({
          targets: card,
          x: p.x,
          y: p.y,
          scale: isSelected ? 1.08 : 1,
          alpha: afford ? 1 : 0.55,
          duration: 380,
          delay: k * 40,
          ease: "Cubic.out",
        });
      }
      this.lastPower.delete(inst.uid);
    });

    if (this.selectedCardIndex >= 0 && this.selectedCardIndex < this.handCards.length) {
      this.handLayer.bringToTop(this.handCards[this.selectedCardIndex]!.card);
    }
  }

  /** Hand card whose non-overlapping bounds contain the world point. */
  handCardAt(x: number, y: number): number {
    const active = this.selectedCardIndex >= 0 ? this.selectedCardIndex : this.peek;
    if (active >= 0 && active < this.handCards.length) {
      const { card } = this.handCards[active]!;
      const inv = card.getWorldTransformMatrix().applyInverse(x, y);
      if (Math.abs(inv.x) <= card.width / 2 + 4 && Math.abs(inv.y) <= card.height / 2 + 8) return active;
    }
    for (let i = 0; i < this.handCards.length; i++) {
      if (i === active) continue;
      const { card } = this.handCards[i]!;
      const inv = card.getWorldTransformMatrix().applyInverse(x, y);
      if (Math.abs(inv.x) <= card.width / 2 + 2 && Math.abs(inv.y) <= card.height / 2 + 6) return i;
    }
    return -1;
  }

  /** Finger-slide peek: recalculates non-overlapping layout with selection at k. */
  setPeek(k: number | null) {
    const targetK = k ?? -1;
    if (targetK === this.peek) return;
    this.peek = targetK;
    const n = this.handCards.length;
    if (n === 0) return;
    const availableWidth = W - 32;
    const { cardW, cardH } = getHandCardDimensions(n, availableWidth);
    const cardCenterY = (this.H - 128) - cardH / 2;

    const pos = zeroOverlapHandLayout(n, W / 2, cardCenterY, availableWidth, cardW, {
      selectionIndex: targetK >= 0 ? targetK : undefined,
      liftY: 26,
      enableCurve: true,
    });

    this.handCards.forEach(({ card }, i) => {
      if (card.parentContainer !== this.handLayer) return;
      const p = pos[i]!;
      const up = i === targetK;
      if (up) this.handLayer.bringToTop(card);
      this.tweens.add({
        targets: card,
        x: p.x,
        y: p.y,
        rotation: p.rot,
        scale: up ? 1.08 : 1,
        duration: 120,
        ease: "Quad.out",
      });
    });

    if (targetK < 0) {
      this.handCards.forEach(({ card }, i) => {
        if (card.parentContainer === this.handLayer) this.handLayer.moveTo(card, i);
      });
    }
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
          const groundY = y + SLOT_H / 2;
          fx.fillStyle(col, hover ? 0.35 : valid ? 0.18 : 0.06).fillRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 6);
          fx.lineStyle(hover ? 2.5 : valid ? 2 : 1, side === "player" ? 0x9fe4ff : 0xffa0a4, valid ? 0.95 : 0.4)
            .strokeRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 6);
          if (hover) fx.lineStyle(2.5, 0xffffff, 0.95).lineBetween(x - SLOT_W / 2 + 2, groundY + 2, x + SLOT_W / 2 - 2, groundY + 2);
        }
      }
    });
    this.handGlow.clear();
    if (d?.src.kind === "board") {
      const hov = d.hover?.kind === "hand";
      const hz = this.HAND_ZONE;
      this.handGlow.fillStyle(CYAN, hov ? 0.22 : 0.1).fillRoundedRect(hz.x0, hz.y0, hz.x1 - hz.x0, this.H - hz.y0, 14);
      this.handGlow.lineStyle(2, CYAN, hov ? 1 : 0.6).strokeRoundedRect(hz.x0, hz.y0, hz.x1 - hz.x0, this.H - hz.y0, 14);
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
      const d = createDetail(this, v, W, this.H, o);
      this.detail = { close: d.close };
      d.root.once("destroy", () => { this.detail = null; });
    });
  }

  // ---------- drag & drop ----------
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
    // Mobile-first touch & gesture handling
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragged = false;
      if (this.g.phase !== "player" || this.detail || this.drag) return;

      // Tap on empty space outside hand zone deselects
      if (p.worldY < this.HAND_ZONE.y0) {
        if (this.selectedCardIndex >= 0) {
          this.selectedCardIndex = -1;
          this.drawHand();
        }
        return;
      }

      // Do not intercept bottom floating controls row or edge-docked buttons (Undo, Energy Orb, End Turn)
      if (p.worldY >= this.H - 110 || (p.worldY >= this.H - 120 && (p.worldX <= 220 || p.worldX >= W - 220))) {
        return;
      }

      const hit = this.handCardAt(p.worldX, p.worldY);
      if (hit >= 0) {
        this.handTouch = {
          pointerId: p.id,
          startX: p.worldX,
          startY: p.worldY,
          initialIndex: hit,
          currentIndex: hit,
          mode: "pending",
          startTime: Date.now(),
        };
        this.setPeek(hit);
      }
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.drag) {
        if (this.drag.manual) this.moveDrag(p);
        return;
      }
      if (this.detail) return;
      if (!this.handTouch || this.handTouch.pointerId !== p.id) {
        // Desktop mouse hover peek
        if (p.worldY >= this.HAND_ZONE.y0 && p.worldY < this.H - 110 && p.worldX > 220 && p.worldX < W - 220) {
          const over = this.handCardAt(p.worldX, p.worldY);
          const target = over >= 0 ? over : nearestIndex(this.handCards.map((h) => h.pos), p.worldX);
          this.setPeek(target >= 0 ? target : null);
        } else if (this.selectedCardIndex < 0) {
          this.setPeek(null);
        }
        return;
      }

      const ht = this.handTouch;
      const dx = p.worldX - ht.startX;
      const dy = p.worldY - ht.startY;

      if (ht.mode === "pending") {
        // Upward drag towards battlefield -> initiate card play drag!
        if (dy < -26) {
          ht.mode = "dragging";
          const hc = this.handCards[ht.currentIndex];
          if (hc) this.beginDrag(hc.card, p);
          return;
        }
        // Horizontal swipe across hand fan -> browsing mode!
        if (Math.abs(dx) > 10) {
          ht.mode = "swiping";
        }
      }

      if (ht.mode === "swiping") {
        // If pulled upward while swiping, transition to card drag!
        if (dy < -38 || p.worldY < this.HAND_ZONE.y0 - 20) {
          ht.mode = "dragging";
          const hc = this.handCards[ht.currentIndex];
          if (hc) this.beginDrag(hc.card, p);
          return;
        }
        // Smooth horizontal browsing
        const overIdx = this.handCardAt(p.worldX, p.worldY);
        const targetIdx = overIdx >= 0 ? overIdx : nearestIndex(this.handCards.map((h) => h.pos), p.worldX);
        if (targetIdx >= 0 && targetIdx !== ht.currentIndex) {
          ht.currentIndex = targetIdx;
          this.setPeek(targetIdx);
        }
      }
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.drag?.manual) {
        this.finishDrag(this.targetAt(p.worldX, p.worldY));
        this.handTouch = null;
        return;
      }
      if (!this.handTouch || this.handTouch.pointerId !== p.id) return;
      const ht = this.handTouch;
      this.handTouch = null;

      const dist = Math.hypot(p.worldX - ht.startX, p.worldY - ht.startY);
      const elapsed = Date.now() - ht.startTime;

      if (ht.mode === "pending" || (dist < 14 && elapsed < 420)) {
        // Clean tap on card!
        const tapped = ht.initialIndex;
        if (this.selectedCardIndex === tapped) {
          // Double tap / tap on already selected card: open detail view
          const hc = this.handCards[tapped];
          if (hc) {
            const d = createDetail(this, hc.card.getData("view") as CardView, W, this.H, {});
            this.detail = { close: d.close };
            d.root.once("destroy", () => { this.detail = null; });
          }
        } else {
          // Select this card!
          this.selectedCardIndex = tapped;
          this.drawHand();
          this.audio.play("select");
        }
      } else if (ht.mode === "swiping") {
        // Swiped across hand and released: select the card under release
        this.selectedCardIndex = ht.currentIndex;
        this.drawHand();
        this.audio.play("select");
      }
    });

    // Board-to-slot drag support
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
    this.input.on("gameout", () => this.drag && this.finishDrag(null));
  }

  targetAt(x: number, y: number): DropTarget {
    const hz = this.HAND_ZONE;
    if (y >= hz.y0 && x >= hz.x0 && x <= hz.x1) return { kind: "hand" };
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
    this.selectedCardIndex = -1;
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
            this.audio.play("cast", HERO_BY_ID[SKILL_BY_ID[id]?.hero ?? "aruvi"].id);
            this.impact(t.c, 360, 80, HERO_BY_ID[SKILL_BY_ID[id]?.hero ?? "aruvi"].color);
            this.floatText("SKILL QUEUED", 360, this.carriers[t.c]?.y ?? 0, "#7fd8ff");
            this.floatText(`-${energyBefore - g.player.energy} ENERGY`, this.ENERGY_POS.x, this.ENERGY_POS.y - 70, "#7fd8ff");
            this.refresh(); return;
          }
        }
        this.animFrom.set(d.src.uid, pos);
      } else if (t?.kind === "slot" && t.side === "player") {
        if (playCard(g, "player", idx, t.c, t.s)) {
          this.audio.play("place", isHeroId(id) ? id : undefined);
          this.animFrom.set(d.src.uid, { ...pos, impact: true });
        }
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
        this.floatText(`+${cost} ENERGY`, this.ENERGY_POS.x, this.ENERGY_POS.y - 70, "#7fd8ff");
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
    if (g.player.energy < energyBefore) this.floatText(`-${energyBefore - g.player.energy} ENERGY`, this.ENERGY_POS.x, this.ENERGY_POS.y - 70, "#7fd8ff");
    this.refresh();
  }

  // ---------- feedback ----------
  heroRevealFx(ci: number, x: number, y: number, v: CardView) {
    const cont = this.carriers[ci]!;
    const fx = HERO_EFFECTS[v.hero] ?? { motif: "chakra", sides: 12, drift: 0 };
    const color = v.color;

    // Expanding shockwave ring
    const ring = this.add.circle(x, y, 18, color, 0).setStrokeStyle(3.5, color, 1);
    cont.add(ring);
    this.tweens.add({ targets: ring, scale: 3.5, alpha: 0, duration: 650, onComplete: () => ring.destroy() });

    // Geometric motif particle burst
    const count = 12;
    for (let k = 0; k < count; k++) {
      const angle = (k / count) * Math.PI * 2;
      const dist = Phaser.Math.Between(45, 95);
      const px = x + Math.cos(angle) * 12;
      const py = y + Math.sin(angle) * 12;

      const p = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      if (fx.motif === "frost") {
        p.fillStyle(0xbae6fd, 1).fillPoints([{ x: 0, y: -6 }, { x: 3, y: 0 }, { x: 0, y: 6 }, { x: -3, y: 0 }], true);
      } else if (fx.motif === "chakra" || fx.motif === "kolam") {
        p.lineStyle(1.5, color, 1).strokePoints([{ x: 0, y: -5 }, { x: 5, y: 0 }, { x: 0, y: 5 }, { x: -5, y: 0 }], true, true);
      } else if (fx.motif === "lightning") {
        p.lineStyle(2, 0xffffff, 1).lineBetween(-4, -6, 0, 0).lineBetween(0, 0, 4, 6);
      } else if (fx.motif === "solar") {
        p.fillStyle(0xffe082, 1).fillPoints([{ x: 0, y: -5 }, { x: 4, y: 0 }, { x: 0, y: 5 }, { x: -4, y: 0 }], true);
      } else {
        p.fillStyle(color, 1).fillRect(-2, -4, 4, 8);
      }
      p.setPosition(px, py);
      cont.add(p);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        rotation: angle + Math.PI,
        alpha: 0,
        duration: Phaser.Math.Between(450, 700),
        ease: "Cubic.out",
        onComplete: () => p.destroy(),
      });
    }
    this.cameras.main.shake(70, 0.0018);
  }

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
    this.audio.play("endTurn");
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
        this.timerText.setText(`${this.remaining}s`).setColor("#38bdf8");
        this.drawTimerWidget();
        this.refresh();
        if (this.g.phase === "over") this.showResult();
        else { this.floatText(`ROUND ${this.g.turn}`, W / 2, 160, "#7fd8ff"); this.audio.play("draw"); }
        return;
      }
      const v = viewOf(d.card.id, this.tf(d.side));
      const x = d.skill ? 360 : SLOT_X[d.side][d.slot] ?? 360;
      const y = (this.carriers[d.carrier]?.y ?? 0) + SLOT_Y;
      const flip = createCard(this, v, SLOT_W, SLOT_H, { concealed: true }).setPosition(x, y).setDepth(90);
      const glint = this.add.graphics().setDepth(91).setBlendMode(Phaser.BlendModes.ADD);
      glint.fillGradientStyle(0xffffff, 0xffffff, v.color, v.color, 0.4, 0.4, 0, 0).fillRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H);
      this.tweens.add({ targets: glint, alpha: 0, duration: 400, onComplete: () => glint.destroy() });
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
        if (!d.skill) this.heroRevealFx(d.carrier, x, SLOT_Y, v);
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
    this.audio.play(r.outcome === "win" ? "victory" : "defeat");
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
