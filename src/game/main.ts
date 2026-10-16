import Phaser from "phaser";
import { BattleScene, H, W } from "./BattleScene";

export async function startGame(parent: HTMLElement, skyUrl: string) {
  try { await document.fonts.load('600 24px "Teko"'); } catch { /* fall back */ }
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    transparent: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new BattleScene(skyUrl)],
  });
}
