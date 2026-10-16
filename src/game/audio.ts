import { HERO_EFFECTS } from "./heroEffects";
import type { HeroId } from "./heroes";

/** Original synthesized soundtrack and SFX: no network downloads or autoplay. */
export class BattleAudio {
  private context: AudioContext | null = null;
  private music: ReturnType<typeof setInterval> | null = null;
  private beat = 0;
  enabled = false;
  async toggle() {
    if (!this.context) this.context = new AudioContext();
    await this.context.resume();
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.music = setInterval(() => {
        const notes = [98, 147, 196, 130.81, 98, 164.81, 146.83, 110];
        this.tone(notes[this.beat++ % notes.length] ?? 98, 0.7, "sine", 0.035);
      }, 750);
    } else if (this.music) { clearInterval(this.music); this.music = null; }
    return this.enabled;
  }
  private tone(hz: number, seconds: number, wave: OscillatorType, volume: number, end = hz) {
    const c = this.context;
    if (!c || !this.enabled) return;
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = wave; osc.frequency.setValueAtTime(hz, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), c.currentTime + seconds);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + seconds);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(); osc.stop(c.currentTime + seconds);
  }
  play(kind: "reveal" | "cast" | "draw" | "destroy" | "tick" | "result", hero?: HeroId) {
    const pitch = hero ? HERO_EFFECTS[hero].pitch : 440;
    if (kind === "reveal") { this.tone(pitch / 2, 0.22, "triangle", 0.12, pitch); this.tone(pitch * 1.5, 0.35, "sine", 0.07); }
    if (kind === "cast") this.tone(pitch, 0.42, "sawtooth", 0.045, pitch * 3);
    if (kind === "draw") this.tone(600, 0.18, "sine", 0.05, 1200);
    if (kind === "destroy") this.tone(pitch, 0.3, "triangle", 0.09, 45);
    if (kind === "tick") this.tone(900, 0.06, "sine", 0.04);
    if (kind === "result") [1, 1.25, 1.5].forEach((n) => this.tone(392 * n, 0.9, "triangle", 0.04));
  }
  destroy() { if (this.music) clearInterval(this.music); void this.context?.close(); this.context = null; }
}