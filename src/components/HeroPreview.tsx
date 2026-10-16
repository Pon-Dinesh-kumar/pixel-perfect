import { useRef, useState } from "react";
import { FlipHorizontal2, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroCard } from "./HeroCard";
import type { HeroId } from "@/game/heroes";
import type { Tier } from "@/game/tiers";

export function HeroPreview({ id, tier }: { id: HeroId; tier: Tier }) {
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; angle: number } | null>(null);
  return <>
    <div className="touch-pan-y" onPointerDownCapture={(e) => {
      start.current = { x: e.clientX, angle: rotation };
      e.currentTarget.setPointerCapture(e.pointerId); setDragging(true);
    }} onPointerMoveCapture={(e) => {
      if (start.current) setRotation(start.current.angle + (e.clientX - start.current.x) * 1.25);
    }} onPointerUpCapture={() => { start.current = null; setDragging(false); }} onPointerCancel={() => { start.current = null; setDragging(false); }}>
      <HeroCard id={id} tier={tier} tilt rotation={rotation} rotating={dragging} />
    </div>
    <div className="mt-5 flex justify-center gap-3">
      <Button variant="outline" size="icon" title="Flip card" aria-label="Flip card" onClick={() => setRotation((r) => r + 180)}><FlipHorizontal2 /></Button>
      <Button variant="outline" size="icon" title="Rotate 360 degrees" aria-label="Rotate 360 degrees" onClick={() => setRotation((r) => r + 360)}><RotateCw /></Button>
      <Button variant="ghost" size="icon" title="Reset rotation" aria-label="Reset rotation" onClick={() => setRotation(0)}><RotateCcw /></Button>
    </div>
  </>;
}