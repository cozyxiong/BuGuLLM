import React, { useCallback, useEffect, useRef, useState } from "react";
import brainArt from "@/media/learning/brain.png";
import malletArt from "@/media/learning/mallet.png";
import { playKnockSfx, unlockKnockSfx } from "./knockSfx";
import "./ReleasePlay.css";

const MALLET_KEYFRAMES = [
  { transform: "rotate(-28deg)", offset: 0, easing: "cubic-bezier(0.33, 0, 0.2, 1)" },
  { transform: "rotate(-4deg)", offset: 0.2, easing: "cubic-bezier(0.7, 0, 0.84, 0)" },
  { transform: "rotate(-56deg)", offset: 0.38, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  { transform: "rotate(-40deg)", offset: 0.52, easing: "cubic-bezier(0.33, 1, 0.68, 1)" },
  { transform: "rotate(-50deg)", offset: 0.66 },
  { transform: "rotate(-28deg)", offset: 1 },
];

function spawnFloat(id) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 62 + Math.random() * 28;
  return {
    id,
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist - 8,
    rot: (Math.random() - 0.5) * 24,
    size: 11 + Math.random() * 3.5,
  };
}

export default function ReleasePlay() {
  const seq = useRef(0);
  const malletRef = useRef(null);
  const malletAnim = useRef(null);
  const hitTimer = useRef(0);
  const sparkTimer = useRef(0);
  const [floats, setFloats] = useState([]);
  const [hitting, setHitting] = useState(false);
  const [spark, setSpark] = useState(false);
  const [striking, setStriking] = useState(false);

  useEffect(() => () => {
    window.clearTimeout(hitTimer.current);
    window.clearTimeout(sparkTimer.current);
    malletAnim.current?.cancel();
  }, []);

  const knock = useCallback(() => {
    unlockKnockSfx();

    const node = malletRef.current;
    if (node) {
      malletAnim.current?.cancel();
      setStriking(true);
      const anim = node.animate(MALLET_KEYFRAMES, {
        duration: 520,
        easing: "linear",
        fill: "none",
      });
      malletAnim.current = anim;
      anim.onfinish = () => {
        if (malletAnim.current === anim) setStriking(false);
      };
    }

    const id = ++seq.current;
    window.setTimeout(() => {
      playKnockSfx();
      setHitting(false);
      setSpark(false);
      requestAnimationFrame(() => {
        setHitting(true);
        setSpark(true);
        window.clearTimeout(hitTimer.current);
        window.clearTimeout(sparkTimer.current);
        hitTimer.current = window.setTimeout(() => setHitting(false), 420);
        sparkTimer.current = window.setTimeout(() => setSpark(false), 380);
      });
      setFloats((prev) => [...prev, spawnFloat(id)]);
      window.setTimeout(() => {
        setFloats((prev) => prev.filter((f) => f.id !== id));
      }, 1450);
    }, 185);
  }, []);

  return (
    <div className="learn-muyu mx-auto select-none">
      <button
        type="button"
        className="learn-muyu__stage"
        onClick={knock}
        aria-label="叮！灵光乍现，智力 + 1"
      >
        {floats.map((f) => (
          <span
            key={f.id}
            className="learn-muyu__float"
            style={{
              left: `calc(50% + ${f.x}px)`,
              top: `calc(50% + ${f.y}px)`,
              fontSize: `${f.size}px`,
              transform: `translate(-50%, -50%) rotate(${f.rot}deg)`,
            }}
          >
            智力 + 1
          </span>
        ))}
        <span className={`learn-muyu__brain ${hitting ? "is-hit" : ""}`}>
          <img src={brainArt} alt="" />
        </span>
        <span className={`learn-muyu__spark ${spark ? "is-on" : ""}`} />
        <span
          ref={malletRef}
          className={`learn-mallet ${striking ? "is-striking" : ""}`}
          aria-hidden
        >
          <img src={malletArt} alt="" />
        </span>
      </button>
      <p className="learn-muyu__hint">
        <em>叮！</em>灵光乍现，智力 + 1
      </p>
    </div>
  );
}
