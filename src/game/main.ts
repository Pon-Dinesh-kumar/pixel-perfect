import * as Phaser from "phaser";
import { BattleScene, H, W, type Assets } from "./BattleScene";

export async function startGame(parent: HTMLElement, assets: Assets) {
  await Promise.race([document.fonts.load('600 24px "Teko"').catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 600))]);
  const pw = parent.clientWidth || 720;
  const ph = parent.clientHeight || 1280;
  const aspect = ph / pw;
  // Dynamically adapt height for modern tall phone aspect ratios to eliminate bottom dead letterbox void
  const targetH = Math.max(H, Math.min(1600, Math.round(W * Math.max(1.7778, aspect))));

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: targetH,
    transparent: true,
    fps: { target: 60, smoothStep: true },
    render: { antialias: true, roundPixels: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new BattleScene(assets)],
  });
}
