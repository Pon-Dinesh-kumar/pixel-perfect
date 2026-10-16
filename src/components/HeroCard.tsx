import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HERO_BY_ID, type HeroId } from "@/game/heroes";
import { heroArt, heroLogo } from "@/game/heroArt";
import { heroPower } from "@/game/rules";
import type { Tier } from "@/game/tiers";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/**
 * Snap-style hero card. Ascend and Apex share the animated border and frame-break art
 * (head and shoulders step out above the frame with a soft edge). Apex adds hero particles
 * and a hero-coloured backdrop glow. `tilt` enables gyroscope (or pointer) 3D tilt.
 */
export function HeroCard({ id, tier, tilt = false, showStats = true, className = "" }: { id: HeroId; tier: Tier; tilt?: boolean; showStats?: boolean; className?: string }) {
  const h = HERO_BY_ID[id];
  const ref = useRef<HTMLDivElement>(null);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [needPerm, setNeedPerm] = useState(false);

  useEffect(() => {
    if (!tilt) return;
    const onOrient = (e: DeviceOrientationEvent) => {
      const g = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 25));
      const b = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 25));
      setRot({ x: -b * 12, y: g * 14 });
    };
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (DOE && typeof DOE.requestPermission === "function") setNeedPerm(true);
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [tilt]);

  const onPointer = (e: React.PointerEvent) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setRot({ x: -((e.clientY - r.top) / r.height - 0.5) * 18, y: ((e.clientX - r.left) / r.width - 0.5) * 22 });
  };
  const askPerm = async () => {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    try { await DOE.requestPermission?.(); } catch { /* denied */ }
    setNeedPerm(false);
  };

  const upgraded = tier !== "base";
  const breakOut = tier === "apex" ? 22 : tier === "ascend" ? 15 : 0; // % of card height
  const style = { "--hero": hex(h.color), transform: `perspective(900px) rotateX(${rot.x}deg) rotateY(${rot.y}deg)` } as CSSProperties;
  const mask = `radial-gradient(ellipse 50% ${breakOut + 26}% at 50% ${breakOut + 16}%, #000 58%, transparent 100%)`;

  return (
    <div ref={ref} onPointerMove={onPointer} onPointerLeave={() => setRot({ x: 0, y: 0 })} onClick={needPerm ? askPerm : undefined}
      className={`@container relative aspect-[3/4] transition-transform duration-150 ease-out [transform-style:preserve-3d] ${className}`} style={style}>
      {tier === "apex" && <div aria-hidden className="apex-aura pointer-events-none absolute -inset-[12%] rounded-full" />}
      <div className={`absolute inset-0 rounded-xl p-[3px] ${upgraded ? "frame-ascend" : ""}`} style={upgraded ? undefined : { background: "var(--hero)" }}>
        <div className="h-full w-full rounded-[10px] bg-background" />
      </div>
      <div className="absolute inset-[3px] overflow-hidden rounded-[10px]">
        <img src={heroArt(id, tier)} alt={h.name} className="h-full w-full object-cover object-top" style={{ transform: `translate(${rot.y * -0.6}px, ${rot.x * 0.6}px) scale(1.06)` }} />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background to-transparent" />
      </div>
      {upgraded && (
        <img src={heroArt(id, tier)} alt="" aria-hidden
          className="pointer-events-none absolute inset-x-[3px] w-[calc(100%-6px)] object-cover object-top"
          style={{
            top: `-${breakOut}%`, height: `calc(${100 + breakOut}% - 3px)`,
            transform: `translate(${rot.y * -1.2}px, ${rot.x * 1.2}px) translateZ(30px) scale(1.06)`,
            WebkitMaskImage: mask, maskImage: mask,
          }} />
      )}
      {tier === "apex" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="apex-spark" style={{ left: `${8 + ((i * 37) % 84)}%`, animationDelay: `${(i * 0.37) % 3}s`, animationDuration: `${2.4 + (i % 4) * 0.5}s` }} />
          ))}
        </div>
      )}
      <img src={heroLogo(id)} alt={h.name} className={`absolute bottom-[2%] max-h-[24%] object-contain drop-shadow-lg ${showStats ? "left-[2%] w-[78%]" : "inset-x-[4%] mx-auto w-[92%]"}`} style={{ transform: "translateZ(40px)" }} />
      {showStats && (
        <>
          <span className="badge-cost absolute -left-[3%] -top-[3%] flex h-[29%] w-[24%] items-center justify-center font-display text-[17cqw] font-bold leading-none text-foreground" style={{ transform: "translateZ(40px)" }}>{h.cost}</span>
          <span className="badge-power absolute -bottom-[3%] -right-[3%] flex h-[28%] w-[25%] items-center justify-center pb-[3%] font-display text-[17cqw] font-bold leading-none text-primary-foreground" style={{ transform: "translateZ(40px)" }}>{heroPower(id, tier)}</span>
        </>
      )}
      {needPerm && <span className="absolute inset-x-0 -bottom-7 text-center text-xs text-muted-foreground">Tap card to enable tilt</span>}
    </div>
  );
}
