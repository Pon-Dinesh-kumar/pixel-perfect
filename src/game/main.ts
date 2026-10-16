import Phaser from "phaser";
import { BattleScene, H, W, type Assets } from "./BattleScene";

export async function startGame(parent: HTMLElement, assets: Assets) {
  try { await document.fonts.load('600 24px "Teko"'); } catch { /* fall back */ }
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    transparent: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new BattleScene(assets)],
  });
}
