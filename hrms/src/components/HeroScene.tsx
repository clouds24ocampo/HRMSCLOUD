"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

type FieldProps = { calm: boolean; paused: boolean };

// Loads the WebGL field only when the browser supports it. Without WebGL the CSS glow behind it is enough.
// Pauses rendering while scrolled out of view. Reduced-motion users get one still frame.
export function HeroScene({ className = "" }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [Field, setField] = useState<ComponentType<FieldProps> | null>(null);
  const [calm, setCalm] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!document.createElement("canvas").getContext("webgl")) return;
    import("./QuantumField").then((m) => {
      setCalm(matchMedia("(prefers-reduced-motion: reduce)").matches);
      setField(() => m.default);
    });
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPaused(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return <div ref={box} className={className}>{Field && <Field calm={calm} paused={paused} />}</div>;
}
