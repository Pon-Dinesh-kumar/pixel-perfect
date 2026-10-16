import * as Phaser from "phaser";
import { BattleScene, H, W, type Assets } from "./BattleScene";

export async function startGame(parent: HTMLElement, assets: Assets) {
  await Promise.race([document.fonts.load('600 24px "Teko"').catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 600))]);
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    transparent: true,
    fps: { target: 60, smoothStep: true },
    render: { antialias: true, roundPixels: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new BattleScene(assets)],
  });
}
