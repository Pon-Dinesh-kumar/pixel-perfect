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
  ensureContext() {
    if (!this.context && typeof window !== "undefined" && (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AC();
    }
    if (this.context && this.context.state === "suspended") {
      void this.context.resume();
    }
  }

  play(kind: "reveal" | "cast" | "draw" | "destroy" | "tick" | "result" | "select" | "place" | "undo" | "endTurn" | "passive" | "victory" | "defeat", hero?: HeroId) {
    this.ensureContext();
    const pitch = hero ? HERO_EFFECTS[hero].pitch : 440;
    if (kind === "reveal") {
      this.tone(pitch / 2, 0.22, "triangle", 0.12, pitch);
      this.tone(pitch * 1.5, 0.35, "sine", 0.08);
      this.tone(pitch * 2, 0.15, "triangle", 0.04, pitch * 0.8);
    } else if (kind === "cast") {
      this.tone(pitch, 0.42, "sawtooth", 0.05, pitch * 3);
      this.tone(pitch * 0.5, 0.3, "sine", 0.08, pitch * 1.5);
    } else if (kind === "draw") {
      this.tone(520, 0.14, "sine", 0.05, 1100);
    } else if (kind === "select") {
      this.tone(880, 0.08, "triangle", 0.06, 1320);
      this.tone(1760, 0.05, "sine", 0.03);
    } else if (kind === "place") {
      this.tone(180, 0.22, "triangle", 0.14, 60);
      this.tone(740, 0.09, "sine", 0.08, 440);
    } else if (kind === "undo") {
      this.tone(330, 0.18, "sine", 0.08, 165);
      this.tone(440, 0.12, "triangle", 0.04, 220);
    } else if (kind === "endTurn") {
      this.tone(260, 0.18, "sawtooth", 0.06, 520);
      this.tone(660, 0.25, "triangle", 0.08, 880);
    } else if (kind === "passive") {
      this.tone(pitch * 0.75, 0.18, "sine", 0.06, pitch);
      this.tone(pitch * 1.25, 0.22, "triangle", 0.05, pitch * 1.5);
    } else if (kind === "destroy") {
      this.tone(pitch, 0.3, "triangle", 0.09, 45);
    } else if (kind === "tick") {
      this.tone(900, 0.06, "sine", 0.04);
    } else if (kind === "result" || kind === "victory") {
      [1, 1.25, 1.5, 2].forEach((n, i) => {
        setTimeout(() => this.tone(392 * n, 0.6, "triangle", 0.06), i * 110);
      });
    } else if (kind === "defeat") {
      [1.5, 1.25, 1, 0.75].forEach((n, i) => {
        setTimeout(() => this.tone(220 * n, 0.5, "sawtooth", 0.05), i * 130);
      });
    }
  }

  destroy() {
    if (this.music) clearInterval(this.music);
    void this.context?.close();
    this.context = null;
  }
}