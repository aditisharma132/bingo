import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Hand-drawn "creator × brand" scene.
 * The whole illustration draws itself in: a creator holding up a phone on the
 * left and a sharp-looking brand rep with a phone on the right. Both heads and
 * pupils track the cursor, the creator's phone screen fills with messages as
 * you focus each field, and the brand rep throws a thumbs-up at the submit
 * button.
 *
 * Colours come from design tokens via currentColor on each group.
 */

export type ScribeControl = {
  /** index of the focused field, -1 when none */
  focusField: number;
  /** submit button focused */
  buttonFocus: boolean;
  /** timestamp (performance.now) until which the thumbs-up is held */
  hold: number;
};

export function createScribeControl(): ScribeControl {
  return { focusField: -1, buttonFocus: false, hold: 0 };
}

const PW = 380;
const PH = 300;

const FLOOR = 244;

/** brand rep's gesturing arm */
const SHOULDER = { x: 288, y: 106 };
const UPPER = 34;
const FORE = 32;
const THUMB_HAND = { x: 310, y: 96 };
const IDLE_BOX = { x0: 294, x1: 334, y0: 118, y1: 166 };

const HEADS = [
  { pivot: { x: 118, y: 88 }, eye: { x: 118, y: 58 }, spread: 8 },
  { pivot: { x: 262, y: 88 }, eye: { x: 262, y: 58 }, spread: 8 },
];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const decay = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

/** wavy message line on the creator's phone screen */
function screenLine(i: number) {
  const y = 96 + i * 13;
  const lx = 57;
  const rx = i === 2 ? 71 : 79;
  const n = 5;
  const seg = (rx - lx) / n;
  let d = `M ${lx} ${y}`;
  for (let j = 0; j < n; j++) {
    const sx = lx + seg * j;
    d += ` C ${(sx + seg * 0.25).toFixed(1)} ${(y - 2.6).toFixed(1)}, ${(sx + seg * 0.6).toFixed(1)} ${(y + 1.8).toFixed(1)}, ${(sx + seg).toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

type Part = { l: "scene" | "head0" | "head1"; d: string; w: number; tone?: "rule" | "accent" };

const RAW_PARTS: Part[] = [
  // ground
  { l: "scene", d: `M 18 ${FLOOR} H 362`, w: 1.7 },
  { l: "scene", d: `M 62 ${FLOOR + 12} H 190`, w: 0.9, tone: "rule" },
  { l: "scene", d: `M 214 ${FLOOR + 12} H 330`, w: 0.9, tone: "rule" },

  // ---------- creator (left) ----------
  { l: "scene", d: "M 108 80 v 12 M 128 80 v 12", w: 1.6 },
  // hoodie torso
  {
    l: "scene",
    d: "M 118 92 c -15 1 -25 9 -28 21 l -5 44 c -1 6 3 10 8 10 h 50 c 5 0 9 -4 8 -10 l -5 -44 c -3 -12 -13 -20 -28 -21 z",
    w: 2,
  },
  // hood + strings
  { l: "scene", d: "M 104 94 c 5 9 23 9 28 0", w: 1.5 },
  { l: "scene", d: "M 111 100 v 13 M 125 100 v 13", w: 1.3, tone: "accent" },
  { l: "scene", d: "M 100 142 h 36", w: 1.2, tone: "rule" },
  // legs + shoes
  { l: "scene", d: `M 104 167 l -4 66 M 132 167 l 4 66`, w: 1.9 },
  { l: "scene", d: "M 100 233 c -8 1 -11 3 -11 5 h 18 c 1 -2 0 -4 -1 -5 z", w: 1.7 },
  { l: "scene", d: "M 136 233 c 8 1 11 3 11 5 h -18 c -1 -2 0 -4 1 -5 z", w: 1.7 },
  // raised arm holding the phone
  { l: "scene", d: "M 93 108 C 82 112 74 122 72 116", w: 2 },
  { l: "scene", d: "M 72 116 C 70 108 74 102 80 104", w: 2 },
  // hand gripping the phone edge
  { l: "scene", d: "M 80 104 c -6 -2 -10 2 -9 7 c 1 5 6 7 10 5 c 3 -2 3 -5 2 -7", w: 1.5 },
  // free arm resting
  { l: "scene", d: "M 145 112 c 8 14 8 28 4 40", w: 2 },
  // phone (creator)
  {
    l: "scene",
    d: "M 53 74 h 28 a 5 5 0 0 1 5 5 v 48 a 5 5 0 0 1 -5 5 h -28 a 5 5 0 0 1 -5 -5 v -48 a 5 5 0 0 1 5 -5 z",
    w: 2,
  },
  { l: "scene", d: "M 62 79 h 10", w: 1.2, tone: "rule" },
  { l: "scene", d: "M 53 85 h 28 M 53 126 h 28", w: 0.9, tone: "rule" },

  // ---------- brand rep (right) ----------
  { l: "scene", d: "M 253 80 v 10 M 271 80 v 10", w: 1.6 },
  // blazer torso
  {
    l: "scene",
    d: "M 262 90 c -17 1 -27 10 -30 22 l -5 45 c -1 6 3 10 8 10 h 54 c 5 0 9 -4 8 -10 l -5 -45 c -3 -12 -13 -21 -30 -22 z",
    w: 2,
  },
  // collar + lapels
  { l: "scene", d: "M 250 92 L 262 116 L 274 92", w: 1.6 },
  { l: "scene", d: "M 255 90 L 262 104 L 269 90", w: 1.3, tone: "rule" },
  // tie
  { l: "scene", d: "M 262 108 l -4 6 l 4 24 l 4 -24 z", w: 1.5, tone: "accent" },
  // buttons + pocket square
  { l: "scene", d: "M 246 152 h 9", w: 1.2, tone: "accent" },
  { l: "scene", d: "M 240 126 h 8 M 240 138 h 8", w: 1, tone: "rule" },
  // trousers + shoes
  { l: "scene", d: `M 250 167 l -4 66 M 274 167 l 4 66`, w: 1.9 },
  { l: "scene", d: "M 246 233 c -8 1 -11 3 -11 5 h 18 c 1 -2 0 -4 -1 -5 z", w: 1.7 },
  { l: "scene", d: "M 278 233 c 8 1 11 3 11 5 h -18 c -1 -2 0 -4 1 -5 z", w: 1.7 },
  // arm holding a phone at chest
  { l: "scene", d: "M 235 114 c -6 14 -1 26 10 28", w: 2 },
  {
    l: "scene",
    d: "M 243 118 h 15 a 3 3 0 0 1 3 3 v 25 a 3 3 0 0 1 -3 3 h -15 a 3 3 0 0 1 -3 -3 v -25 a 3 3 0 0 1 3 -3 z",
    w: 1.7,
  },
  { l: "scene", d: "M 244 126 h 13 M 244 133 h 13 M 244 140 h 9", w: 0.9, tone: "rule" },

  // ---------- heads ----------
  {
    l: "head0",
    d: "M 118 36 c 13 0 23 10 23 23 c 0 13 -10 23 -23 23 c -13 0 -23 -10 -23 -23 c 0 -13 10 -23 23 -23 z",
    w: 2,
  },
  { l: "head0", d: "M 95 58 c 1 -16 10 -24 23 -24 c 13 0 22 8 23 24 c -8 -8 -15 -11 -23 -11 c -8 0 -15 3 -23 11 z", w: 2 },
  { l: "head0", d: "M 133 34 c 7 -2 10 -8 8 -13", w: 1.5 },
  { l: "head0", d: "M 108 51 q 5 -3 10 -1", w: 1.4 },
  { l: "head0", d: "M 128 50 q 5 -2 9 2", w: 1.4 },
  { l: "head0", d: "M 110 58 m -4.2 0 a 4.2 4.2 0 1 0 8.4 0 a 4.2 4.2 0 1 0 -8.4 0", w: 1.5 },
  { l: "head0", d: "M 126 58 m -4.2 0 a 4.2 4.2 0 1 0 8.4 0 a 4.2 4.2 0 1 0 -8.4 0", w: 1.5 },
  { l: "head0", d: "M 111 71 q 7 6 14 -1", w: 1.6 },

  {
    l: "head1",
    d: "M 262 36 c 13 0 22 10 22 23 c 0 13 -9 23 -22 23 c -13 0 -22 -10 -22 -23 c 0 -13 9 -23 22 -23 z",
    w: 2,
  },
  { l: "head1", d: "M 240 54 c 2 -15 10 -22 22 -22 c 12 0 20 7 22 22 c -7 -10 -22 -8 -27 -2 c -3 -6 -11 -3 -17 2 z", w: 2 },
  { l: "head1", d: "M 254 51 q 5 -3 9 -1", w: 1.4 },
  { l: "head1", d: "M 271 50 q 5 -2 8 2", w: 1.4 },
  { l: "head1", d: "M 254 58 m -4.2 0 a 4.2 4.2 0 1 0 8.4 0 a 4.2 4.2 0 1 0 -8.4 0", w: 1.5 },
  { l: "head1", d: "M 270 58 m -4.2 0 a 4.2 4.2 0 1 0 8.4 0 a 4.2 4.2 0 1 0 -8.4 0", w: 1.5 },
  { l: "head1", d: "M 255 70 q 7 6 14 -1", w: 1.6 },
];

const PARTS = RAW_PARTS.map((p, i) => ({ ...p, i }));
const SCENE_PARTS = PARTS.filter((p) => p.l === "scene");
const HEAD_GROUPS = [PARTS.filter((p) => p.l === "head0"), PARTS.filter((p) => p.l === "head1")];

function toneClass(tone?: "rule" | "accent") {
  if (tone === "rule") return "text-border";
  if (tone === "accent") return "text-primary";
  return "text-foreground";
}

/** two-bone IK; bend picks the elbow side */
function ik(sx: number, sy: number, tx: number, ty: number, l1: number, l2: number, bend: number) {
  const dx = tx - sx;
  const dy = ty - sy;
  const raw = Math.hypot(dx, dy) || 0.001;
  const d = clamp(raw, Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.5);
  const ux = dx / raw;
  const uy = dy / raw;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return {
    hand: { x: sx + ux * d, y: sy + uy * d },
    elbow: { x: sx + ux * a - uy * h * bend, y: sy + uy * a + ux * h * bend },
  };
}

export function DeskScribe({
  fieldRefs,
  buttonRef,
  control,
  className,
}: {
  fieldRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  buttonRef: React.MutableRefObject<HTMLElement | null>;
  control: React.MutableRefObject<ScribeControl>;
  className?: string;
}) {
  const hostRef = useRef<SVGSVGElement | null>(null);
  const rootRef = useRef<SVGGElement | null>(null);
  const slideRef = useRef<SVGGElement | null>(null);
  const headRefs = useRef<(SVGGElement | null)[]>([]);
  const rigRef = useRef<SVGGElement | null>(null);
  const armRef = useRef<SVGPathElement | null>(null);
  const fistRef = useRef<SVGGElement | null>(null);
  const thumbRef = useRef<SVGGElement | null>(null);
  const pupilRefs = useRef<(SVGCircleElement | null)[]>([]);
  const partRefs = useRef<(SVGPathElement | null)[]>([]);
  const scribRefs = useRef<(SVGPathElement | null)[]>([]);
  const lens = useRef({ parts: [] as number[], cum: [] as number[], total: 1, scrib: [1, 1, 1] });
  const [calm, setCalm] = useState(false);

  const S = useRef({
    D: 0,
    hand: { x: 306, y: 132 },
    headRot: [0, 0],
    pupil: { x: 0, y: 0 },
    thumb: 0,
    write: [0, 0, 0],
    seen: [false, false, false],
  }).current;

  const cursor = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onCalm = () => setCalm(mq.matches);
    onCalm();
    mq.addEventListener("change", onCalm);
    cursor.current.x = window.innerWidth * 0.35;
    cursor.current.y = window.innerHeight * 0.5;
    return () => mq.removeEventListener("change", onCalm);
  }, []);

  useLayoutEffect(() => {
    const parts = partRefs.current.map((p) => (p ? p.getTotalLength() : 0));
    const cum: number[] = [];
    let run = 0;
    parts.forEach((l) => {
      cum.push(run);
      run += l;
    });
    lens.current = {
      parts,
      cum,
      total: run || 1,
      scrib: scribRefs.current.map((p) => (p ? p.getTotalLength() : 1)),
    };
    partRefs.current.forEach((p, i) => {
      if (!p) return;
      p.setAttribute("stroke-dasharray", String(parts[i]));
      p.setAttribute("stroke-dashoffset", String(calm ? 0 : parts[i]));
    });
    scribRefs.current.forEach((p, i) => {
      if (!p) return;
      const len = lens.current.scrib[i] ?? 1;
      p.setAttribute("stroke-dasharray", String(len));
      p.setAttribute("stroke-dashoffset", String(len));
    });

    if (calm && rootRef.current && slideRef.current && rigRef.current && armRef.current) {
      rootRef.current.setAttribute("opacity", "1");
      slideRef.current.setAttribute("transform", "translate(0 0)");
      rigRef.current.setAttribute("opacity", "1");
      const { hand, elbow } = ik(SHOULDER.x, SHOULDER.y, 306, 138, UPPER, FORE, -1);
      armRef.current.setAttribute("d", `M ${SHOULDER.x} ${SHOULDER.y} Q ${elbow.x} ${elbow.y} ${hand.x} ${hand.y}`);
      fistRef.current?.setAttribute("transform", `translate(${hand.x} ${hand.y})`);
    }
  }, [calm]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      cursor.current.x = e.clientX;
      cursor.current.y = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (calm) return;
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const L = lens.current;
      const host = hostRef.current;
      const root = rootRef.current;
      if (!host || !root || !slideRef.current || !rigRef.current || !armRef.current) return;

      const box = host.getBoundingClientRect();
      const inView = box.top < window.innerHeight * 0.9 && box.bottom > window.innerHeight * 0.1;

      if (inView) S.D = Math.min(L.total, S.D + (L.total / 1.7) * dt);
      else S.D = Math.max(0, S.D - (L.total / 0.7) * dt);

      if (S.D <= 0) {
        root.setAttribute("opacity", "0");
        return;
      }
      root.setAttribute("opacity", "1");

      const rev = S.D / L.total;
      for (let i = 0; i < partRefs.current.length; i++) {
        const p = partRefs.current[i];
        if (!p) continue;
        const len = L.parts[i] ?? 0;
        const drawn = clamp(S.D - (L.cum[i] ?? 0), 0, len);
        p.setAttribute("stroke-dashoffset", String(len - drawn));
      }
      const slide = 1 - Math.pow(1 - rev, 3);
      slideRef.current.setAttribute(
        "transform",
        `translate(${(-24 * (1 - slide)).toFixed(2)} ${(24 * (1 - slide)).toFixed(2)})`,
      );
      rigRef.current.setAttribute("opacity", clamp((rev - 0.8) / 0.18, 0, 1).toFixed(3));

      // cursor into panel space
      const k = Math.min(box.width / PW, box.height / PH) || 1;
      const ox = box.left + (box.width - PW * k) / 2;
      const oy = box.top + (box.height - PH * k);
      const px = (cursor.current.x - ox) / k;
      const py = (cursor.current.y - oy) / k;

      const btn = buttonRef.current?.getBoundingClientRect() ?? null;
      let approve = control.current.buttonFocus || control.current.hold > now;
      if (btn && !approve) {
        approve =
          cursor.current.x > btn.left - 10 &&
          cursor.current.x < btn.right + 10 &&
          cursor.current.y > btn.top - 10 &&
          cursor.current.y < btn.bottom + 10;
      }

      let field = approve ? -1 : control.current.focusField;
      if (!approve && field < 0) {
        for (let i = 0; i < fieldRefs.current.length; i++) {
          const el = fieldRefs.current[i];
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (
            cursor.current.x > r.left - 12 &&
            cursor.current.x < r.right + 12 &&
            cursor.current.y > r.top - 12 &&
            cursor.current.y < r.bottom + 12
          ) {
            field = i;
            break;
          }
        }
      }
      field = clamp(field, -1, scribRefs.current.length - 1);

      // messages typing onto the creator's phone
      if (!approve && field >= 0) {
        S.write[field] = Math.min(1, (S.write[field] ?? 0) + dt / 0.9);
        S.seen[field] = true;
      }

      S.thumb += ((approve ? 1 : 0) - S.thumb) * decay(dt, 11);

      const handT = approve
        ? THUMB_HAND
        : { x: clamp(px, IDLE_BOX.x0, IDLE_BOX.x1), y: clamp(py, IDLE_BOX.y0, IDLE_BOX.y1) };
      const kHand = decay(dt, approve ? 10 : 6);
      S.hand.x += (handT.x - S.hand.x) * kHand;
      S.hand.y += (handT.y - S.hand.y) * kHand;

      const bend = -1 + 2 * S.thumb;
      const { hand, elbow } = ik(SHOULDER.x, SHOULDER.y, S.hand.x, S.hand.y, UPPER, FORE, bend);
      armRef.current.setAttribute(
        "d",
        `M ${SHOULDER.x} ${SHOULDER.y} Q ${elbow.x.toFixed(1)} ${elbow.y.toFixed(1)} ${hand.x.toFixed(1)} ${hand.y.toFixed(1)}`,
      );
      fistRef.current?.setAttribute("transform", `translate(${hand.x.toFixed(2)} ${hand.y.toFixed(2)})`);
      fistRef.current?.setAttribute("opacity", (1 - S.thumb).toFixed(3));

      const pop = 0.7 + 0.3 * S.thumb + 0.18 * Math.sin(S.thumb * Math.PI);
      thumbRef.current?.setAttribute(
        "transform",
        `translate(${hand.x.toFixed(2)} ${hand.y.toFixed(2)}) scale(${pop.toFixed(3)})`,
      );
      thumbRef.current?.setAttribute("opacity", S.thumb.toFixed(3));

      // heads look at the phone while typing, otherwise at the cursor
      const gaze = field >= 0 ? { x: 66, y: 104 } : { x: px, y: py };
      HEADS.forEach((h, i) => {
        const rotT = clamp((gaze.x - h.pivot.x) * 0.05, -14, 14);
        const dipT = clamp((gaze.y - 70) * 0.03, -2, 6);
        S.headRot[i] = (S.headRot[i] ?? 0) + (rotT - (S.headRot[i] ?? 0)) * decay(dt, 7);
        headRefs.current[i]?.setAttribute(
          "transform",
          `rotate(${(S.headRot[i] ?? 0).toFixed(2)} ${h.pivot.x} ${h.pivot.y}) translate(0 ${dipT.toFixed(2)})`,
        );
      });

      const pupT = { x: clamp((gaze.x - 190) / 190, -1, 1) * 2.2, y: clamp((gaze.y - 60) / 150, -1, 1) * 1.8 };
      S.pupil.x += (pupT.x - S.pupil.x) * decay(dt, 9);
      S.pupil.y += (pupT.y - S.pupil.y) * decay(dt, 9);
      pupilRefs.current.forEach((el, i) => {
        if (!el) return;
        const h = HEADS[Math.floor(i / 2)]!;
        const side = i % 2 === 0 ? -h.spread : h.spread;
        el.setAttribute("cx", (h.eye.x + side + S.pupil.x).toFixed(2));
        el.setAttribute("cy", (h.eye.y + S.pupil.y).toFixed(2));
      });

      for (let i = 0; i < scribRefs.current.length; i++) {
        const p = scribRefs.current[i];
        if (!p || !S.seen[i]) continue;
        p.setAttribute("stroke-dashoffset", String((L.scrib[i] ?? 1) * (1 - (S.write[i] ?? 0))));
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [calm, buttonRef, fieldRefs, control, S]);

  return (
    <svg
      ref={hostRef}
      viewBox={`0 0 ${PW} ${PH}`}
      className={className}
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label="An illustrated creator holding a phone next to a brand representative"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g ref={rootRef} opacity="0">
        <g ref={slideRef}>
          <g>
            {SCENE_PARTS.map((p) => (
              <path
                key={p.i}
                ref={(el) => {
                  partRefs.current[p.i] = el;
                }}
                d={p.d}
                strokeWidth={p.w}
                stroke="currentColor"
                className={toneClass(p.tone)}
              />
            ))}
          </g>

          <g className="text-primary">
            {[0, 1, 2].map((i) => (
              <path
                key={i}
                ref={(el) => {
                  scribRefs.current[i] = el;
                }}
                d={screenLine(i)}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            ))}
          </g>

          {HEAD_GROUPS.map((group, gi) => (
            <g
              key={gi}
              ref={(el) => {
                headRefs.current[gi] = el;
              }}
            >
              {group.map((p) => (
                <path
                  key={p.i}
                  ref={(el) => {
                    partRefs.current[p.i] = el;
                  }}
                  d={p.d}
                  strokeWidth={p.w}
                  stroke="currentColor"
                  className={toneClass(p.tone)}
                />
              ))}
              {[0, 1].map((ei) => (
                <circle
                  key={ei}
                  ref={(el) => {
                    pupilRefs.current[gi * 2 + ei] = el;
                  }}
                  cx={HEADS[gi]!.eye.x + (ei === 0 ? -HEADS[gi]!.spread : HEADS[gi]!.spread)}
                  cy={HEADS[gi]!.eye.y}
                  r="1.9"
                  className="fill-foreground"
                />
              ))}
            </g>
          ))}

          <g ref={rigRef} opacity="0" className="text-foreground">
            <path ref={armRef} d="" stroke="currentColor" strokeWidth="2" fill="none" />
            <g ref={fistRef}>
              <path
                d="M -7 -6 c 5 -5 12 -5 15 1 c 3 6 -1 12 -7 12 c -6 0 -11 -6 -8 -13 z"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
              />
            </g>
            <g ref={thumbRef} opacity="0">
              <path
                d="M -8 6 c 0 -6 3 -10 8 -11 c 5 -1 8 2 8 6 c 0 3 -2 6 -5 7 c -4 1 -8 1 -11 -2 z"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
              />
              <path d="M 0 -5 c 1 -6 4 -9 7 -8 c 3 1 3 6 0 9" stroke="currentColor" strokeWidth="1.6" fill="none" />
              <path d="M -14 -12 l -3 -5 M -4 -16 l 0 -6 M 6 -13 l 4 -5" stroke="currentColor" strokeWidth="1.3" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
