"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import { SIZES, type CardConfig, type CardSlot } from "@/lib/cards/types";
import { Card } from "./Card";

export interface CardPreviewProps {
  config: CardConfig;
  slots: CardSlot[];
  id?: string;
  /** Max CSS width the preview may take. Scales down to fit its container by default. */
  maxWidth?: number;
  className?: string;
  radius?: number;
}

/**
 * Renders the card at its true pixel size inside a scaled wrapper so exports
 * stay crisp while the preview fits any container.
 */
export const CardPreview = forwardRef<HTMLDivElement, CardPreviewProps>(function CardPreview({ config, slots, id, maxWidth, className, radius = 28 }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const size = SIZES[config.size];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const available = Math.min(el.clientWidth, maxWidth ?? Infinity);
      setScale(Math.min(1, available / size.w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size.w, maxWidth]);

  return (
    <div ref={containerRef} className={className} style={{ width: "100%" }}>
      <div style={{ width: size.w * scale, height: size.h * scale, position: "relative" }}>
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: size.w,
            height: size.h,
            borderRadius: radius / scale,
            overflow: "hidden",
            boxShadow: "0 30px 60px -30px rgba(28,25,23,0.45), 0 0 0 1px rgba(28,25,23,0.06)",
          }}
        >
          <Card ref={ref} config={config} slots={slots} id={id} />
        </div>
      </div>
    </div>
  );
});
