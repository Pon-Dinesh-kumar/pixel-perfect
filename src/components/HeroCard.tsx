import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HERO_BY_ID, type HeroId } from "@/game/heroes";
import { heroArt, heroLogo } from "@/game/heroArt";
import { heroPower } from "@/game/rules";
import type { Tier } from "@/game/tiers";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/**
 * Snap-style hero card. Ascend/Apex get an animated spinning frame and frame-break art
 * (the hero spills above the top edge). `tilt` enables gyroscope (or pointer) 3D tilt.
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
  const breakOut = tier === "apex" ? 16 : tier === "ascend" ? 10 : 0; // % of card height
  const style = { "--hero": hex(h.color), transform: `perspective(900px) rotateX(${rot.x}deg) rotateY(${rot.y}deg)` } as CSSProperties;

  return (
    <div ref={ref} onPointerMove={onPointer} onPointerLeave={() => setRot({ x: 0, y: 0 })} onClick={needPerm ? askPerm : undefined}
      className={`@container relative aspect-[3/4] transition-transform duration-150 ease-out [transform-style:preserve-3d] ${className}`} style={style}>
      {/* frame */}
      <div className={`absolute inset-0 rounded-xl p-[3px] ${tier === "apex" ? "frame-apex" : tier === "ascend" ? "frame-ascend" : ""}`}
        style={tier === "base" ? { background: "var(--hero)" } : undefined}>
        <div className="h-full w-full rounded-[10px] bg-background" />
      </div>
      {/* art inside frame */}
      <div className="absolute inset-[3px] overflow-hidden rounded-[10px]">
        <img src={heroArt(id, tier)} alt={h.name} className="h-full w-full object-cover object-top" style={{ transform: `translate(${rot.y * -0.6}px, ${rot.x * 0.6}px) scale(1.06)` }} />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background to-transparent" />
      </div>
      {/* frame break: same art spilling above the top edge, faded around the head */}
      {upgraded && (
        <img src={heroArt(id, tier)} alt="" aria-hidden
          className="pointer-events-none absolute inset-x-[3px] w-[calc(100%-6px)] object-cover object-top"
          style={{
            top: `-${breakOut}%`, height: `calc(${100 + breakOut}% - 3px)`,
            transform: `translate(${rot.y * -1.2}px, ${rot.x * 1.2}px) translateZ(30px) scale(1.06)`,
            WebkitMaskImage: `radial-gradient(ellipse 34% ${breakOut + 14}% at 50% ${breakOut + 2}%, #000 70%, transparent 100%)`,
            maskImage: `radial-gradient(ellipse 34% ${breakOut + 14}% at 50% ${breakOut + 2}%, #000 70%, transparent 100%)`,
          }} />
      )}
      {/* name logo */}
      <img src={heroLogo(id)} alt={h.name} className="absolute inset-x-[4%] bottom-[2%] mx-auto max-h-[24%] w-[92%] object-contain drop-shadow-lg" style={{ transform: "translateZ(40px)" }} />
      {showStats && (
        <>
          <span className="absolute left-[3%] top-[2%] flex aspect-square w-[24%] items-center justify-center rounded-full border-2 border-foreground bg-secondary font-display text-[15cqw] leading-none" style={{ transform: "translateZ(40px)" }}>{h.cost}</span>
          <span className="absolute right-[3%] top-[2%] flex aspect-square w-[24%] rotate-45 items-center justify-center rounded-md border-2 border-foreground bg-primary" style={{ transform: "translateZ(40px) rotate(45deg)" }}>
            <span className="-rotate-45 font-display text-[15cqw] leading-none text-primary-foreground">{heroPower(id, tier)}</span>
          </span>
        </>
      )}
      {needPerm && <span className="absolute inset-x-0 -bottom-7 text-center text-xs text-muted-foreground">Tap card to enable tilt</span>}
    </div>
  );
}
