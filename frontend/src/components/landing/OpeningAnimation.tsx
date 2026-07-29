import { memo, useEffect, useState } from "react";

/**
 * A looping hero animation: a five-node agent workflow assembles itself
 * (wordmark -> nodes + edges wire up -> a request pulses through while
 * pseudocode is generated). Pure CSS/SVG + rAF, no animation library.
 */

const W = 1600;
const H = 900;
const NODE_W = 200;
const NODE_H = 104;

const MONO =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

type NodeKind = "trigger" | "llm" | "tool" | "router" | "sink";

const KIND_COLOR: Record<NodeKind, string> = {
  trigger: "hsl(var(--node-trigger))",
  llm: "hsl(var(--node-llm))",
  tool: "hsl(var(--node-tool))",
  router: "hsl(var(--node-router))",
  sink: "hsl(var(--node-sink))",
};

interface SceneNode {
  kind: NodeKind;
  label: string;
  name: string;
  tag?: "entry" | "terminal";
  x: number;
  y: number;
}

interface SceneEdge {
  from: number;
  to: number;
  label: string;
}

const NODES: SceneNode[] = [
  { kind: "trigger", label: "TRIGGER", name: "on_request", tag: "entry", x: 200, y: 470 },
  { kind: "llm", label: "LLM AGENT", name: "reason", x: 520, y: 280 },
  { kind: "router", label: "ROUTER", name: "decide", x: 840, y: 470 },
  { kind: "tool", label: "TOOL CALL", name: "call_tool", x: 1160, y: 280 },
  { kind: "sink", label: "OUTPUT / SINK", name: "return_result", tag: "terminal", x: 1480, y: 470 },
];

const EDGES: SceneEdge[] = [
  { from: 0, to: 1, label: "next" },
  { from: 1, to: 2, label: "next" },
  { from: 2, to: 3, label: "true" },
  { from: 3, to: 4, label: "tool_result" },
];

const CODE_LINES = [
  "def on_request(query):",
  "    result = reason(query)",
  "    if decide(result):",
  "        out = call_tool(result)",
  "    return_result(out)",
];

type Point = { x: number; y: number };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
function smooth01(t: number) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}
// Eases progress through a [start, end] window into 0..1, clamped outside it.
function reveal(p: number, start: number, end: number) {
  return smooth01((p - start) / (end - start));
}
// Windowed bump: 0 outside [start, end], eased up then down inside.
function bump(p: number, start: number, end: number) {
  if (p <= start || p >= end) return 0;
  const local = (p - start) / (end - start);
  return Math.sin(local * Math.PI);
}

function edgePoints(a: SceneNode, b: SceneNode): [Point, Point, Point, Point] {
  const p0 = { x: a.x + NODE_W / 2, y: a.y };
  const p3 = { x: b.x - NODE_W / 2, y: b.y };
  const midX = p0.x + (p3.x - p0.x) / 2;
  return [p0, { x: midX, y: p0.y }, { x: midX, y: p3.y }, p3];
}
function bezierAt(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}
function bezierPath(pts: [Point, Point, Point, Point]) {
  const [p0, p1, p2, p3] = pts;
  return `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`;
}

const GridBG = memo(function GridBG() {
  const lines: JSX.Element[] = [];
  for (let x = 0; x <= W; x += 100) lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} />);
  for (let y = 0; y <= H; y += 100) lines.push(<line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} />);
  return (
    <svg width={W} height={H} className="absolute inset-0">
      <rect x={0} y={0} width={W} height={H} fill="hsl(var(--paper))" />
      <g stroke="hsl(var(--grid-line))" strokeWidth={1} strokeDasharray="2 7" opacity={0.7}>
        {lines}
      </g>
    </svg>
  );
});

function Wordmark({ progress }: { progress: number }) {
  const wordP = reveal(progress, 0.06, 0.42);
  const tagP = reveal(progress, 0.46, 0.66);
  const chipP = reveal(progress, 0.7, 0.86);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
      <foreignObject x={0} y={0} width={W} height={H}>
        <div style={{ position: "relative", width: W, height: H }}>
          <GridBG />
          <div
            style={{
              position: "absolute",
              left: 800,
              top: 380,
              transform: "translate(-50%,-50%)",
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 56,
              color: "hsl(var(--ink))",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              clipPath: `inset(0 ${(1 - wordP) * 100}% 0 0)`,
            }}
          >
            <span style={{ color: "hsl(var(--ink-faint))" }}>[</span> AGENT_FLOW
            <span style={{ color: "hsl(var(--accent-cyan))" }}>.</span>CANVAS{" "}
            <span style={{ color: "hsl(var(--ink-faint))" }}>]</span>
          </div>
          <div
            style={{
              position: "absolute",
              left: 800,
              top: 452,
              transform: "translate(-50%,-50%)",
              fontFamily: MONO,
              fontSize: 20,
              color: "hsl(var(--ink-soft))",
              whiteSpace: "nowrap",
              overflow: "hidden",
              clipPath: `inset(0 ${(1 - tagP) * 100}% 0 0)`,
            }}
          >
            // visual builder for python ai agent workflows
          </div>
          <div
            style={{
              position: "absolute",
              left: 800,
              top: 508,
              transform: "translate(-50%,-50%)",
              opacity: chipP,
              display: "flex",
              gap: 10,
              fontFamily: MONO,
              fontSize: 13,
              color: "hsl(var(--ink-faint))",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ border: "1px solid hsl(var(--grid-line))", padding: "4px 10px" }}>browser-based</span>
            <span style={{ border: "1px solid hsl(var(--grid-line))", padding: "4px 10px" }}>no login</span>
            <span style={{ border: "1px solid hsl(var(--grid-line))", padding: "4px 10px" }}>byo keys</span>
          </div>
        </div>
      </foreignObject>
    </svg>
  );
}

function NodeCard({ node, opacity, offsetY = 0, glow = 0, borderColor }: {
  node: SceneNode;
  opacity: number;
  offsetY?: number;
  glow?: number;
  borderColor?: string;
}) {
  const color = KIND_COLOR[node.kind];
  const border = borderColor ?? "hsl(var(--ink))";
  return (
    <div
      style={{
        position: "absolute",
        left: node.x - NODE_W / 2,
        top: node.y - NODE_H / 2 + offsetY,
        width: NODE_W,
        height: NODE_H,
        background: "linear-gradient(180deg, hsl(0 0% 100%) 0%, hsl(205 60% 96%) 100%)",
        border: `${glow > 0.05 ? 3 : 2}px ${node.tag === "terminal" ? "solid" : "dashed"} ${border}`,
        opacity,
        fontFamily: MONO,
        boxShadow: glow > 0.05 ? `0 0 0 ${2 + glow * 4}px ${border}22` : `0 1px 0 hsl(var(--ink) / 0.05)`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "7px 11px",
          borderBottom: "1px dashed hsl(var(--grid-line))",
        }}
      >
        <span style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: "0.13em" }}>{node.label}</span>
        {node.tag && (
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "2px 5px",
              color: node.tag === "terminal" ? "hsl(var(--paper))" : "hsl(var(--ink))",
              background: node.tag === "terminal" ? "hsl(var(--ink))" : "transparent",
              border: node.tag === "terminal" ? "none" : "1px solid hsl(var(--ink))",
            }}
          >
            {node.tag}
          </span>
        )}
      </div>
      <div style={{ padding: "9px 11px", fontSize: 14, fontWeight: 600, color: "hsl(var(--ink))" }}>{node.name}</div>
    </div>
  );
}

function CornerLogo() {
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        top: 46,
        transform: "translate(0, -50%)",
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: 22,
        color: "hsl(var(--ink))",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "hsl(var(--ink-faint))" }}>[</span> AGENT_FLOW
      <span style={{ color: "hsl(var(--accent-cyan))" }}>.</span>CANVAS{" "}
      <span style={{ color: "hsl(var(--ink-faint))" }}>]</span>
    </div>
  );
}

function Wiring({ progress }: { progress: number }) {
  const introEnd = 0.16;
  const fig = reveal(progress, 0.18, 0.3);
  const introFade = clamp(1 - progress / introEnd, 0, 1);

  const nodeSpans = NODES.map((_, i) => {
    const s = introEnd + i * 0.115;
    return [s, s + 0.16] as const;
  });
  const edgeSpans = EDGES.map((_, i) => {
    const s = nodeSpans[i + 1][0] + 0.04;
    return [s, s + 0.13] as const;
  });

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
      <foreignObject x={0} y={0} width={W} height={H}>
        <div style={{ position: "relative", width: W, height: H }}>
          <GridBG />
          <svg width={W} height={H} className="absolute inset-0">
            {EDGES.map((e, i) => {
              const [s, en] = edgeSpans[i];
              const t = reveal(progress, s, en);
              if (t <= 0) return null;
              const pts = edgePoints(NODES[e.from], NODES[e.to]);
              const d = bezierPath(pts);
              const mid = bezierAt(0.5, ...pts);
              const labelOpacity = reveal(progress, en - 0.02, en + 0.03);
              return (
                <g key={i}>
                  <path
                    d={d}
                    fill="none"
                    stroke="hsl(var(--ink))"
                    strokeWidth={2}
                    style={{ opacity: t }}
                    pathLength={1}
                    strokeDasharray={`${t} ${1 - t}`}
                  />
                  {t > 0.85 && (
                    <g opacity={labelOpacity}>
                      <rect x={mid.x - 34} y={mid.y - 12} width={68} height={20} fill="hsl(var(--paper))" stroke="hsl(var(--grid-line))" />
                      <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontFamily={MONO} fontSize={11} fill="hsl(var(--ink-soft))" letterSpacing="0.05em">
                        {e.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {NODES.map((n, i) => {
            const [s, en] = nodeSpans[i];
            const t = reveal(progress, s, en);
            if (t <= 0) return null;
            return <NodeCard key={i} node={n} opacity={t} offsetY={(1 - t) * -46} />;
          })}

          <div style={{ opacity: introFade }}>
            <CornerLogo />
          </div>
          <div
            style={{
              position: "absolute",
              left: 800,
              top: 452,
              transform: "translate(-50%,-50%)",
              fontFamily: MONO,
              fontSize: 20,
              color: "hsl(var(--ink-soft))",
              whiteSpace: "nowrap",
              opacity: introFade,
            }}
          >
            // visual builder for python ai agent workflows
          </div>

          <div
            style={{
              position: "absolute",
              left: 40,
              bottom: 30,
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: "0.12em",
              color: "hsl(var(--ink-faint))",
              opacity: fig,
            }}
          >
            FIG. 01 — AGENT WORKFLOW
          </div>
        </div>
      </foreignObject>
    </svg>
  );
}

function Pulse({ progress }: { progress: number }) {
  const segs = EDGES.map((e) => edgePoints(NODES[e.from], NODES[e.to]));
  const travelEnd = 0.56;
  const u = clamp(progress / travelEnd, 0, 1);
  const segF = u * segs.length;
  const segIdx = clamp(Math.floor(segF), 0, segs.length - 1);
  const localT = progress >= travelEnd ? 1 : segF - segIdx;
  const pulsePt = bezierAt(clamp(localT, 0, 1), ...segs[segIdx]);
  const entryRamp = reveal(progress, 0, 0.02);
  const pulseOpacity = (progress < travelEnd ? 1 : Math.max(0, 1 - (progress - travelEnd) / 0.06)) * entryRamp;

  const panelP = reveal(progress, 0.56, 0.74);
  const lineStart = 0.72;
  const lineStep = (0.95 - lineStart) / CODE_LINES.length;
  const pulseColor = "hsl(var(--accent-cyan))";

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
      <foreignObject x={0} y={0} width={W} height={H}>
        <div style={{ position: "relative", width: W, height: H }}>
          <GridBG />
          <svg width={W} height={H} className="absolute inset-0">
            {EDGES.map((e, i) => (
              <path key={i} d={bezierPath(segs[i])} fill="none" stroke="hsl(var(--ink))" strokeWidth={2} strokeDasharray="7 6" />
            ))}
            {EDGES.map((e, i) => {
              const mid = bezierAt(0.5, ...segs[i]);
              return (
                <g key={`l${i}`}>
                  <rect x={mid.x - 34} y={mid.y - 12} width={68} height={20} fill="hsl(var(--paper))" stroke="hsl(var(--grid-line))" />
                  <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontFamily={MONO} fontSize={11} fill="hsl(var(--ink-soft))" letterSpacing="0.05em">
                    {e.label}
                  </text>
                </g>
              );
            })}
            {pulseOpacity > 0 && <circle cx={pulsePt.x} cy={pulsePt.y} r={9} fill={pulseColor} opacity={pulseOpacity} />}
          </svg>

          {NODES.map((n, i) => {
            const reachP = (i / segs.length) * travelEnd;
            const litAmt = bump(progress, reachP, reachP + 0.09);
            const border = litAmt > 0.05 ? pulseColor : undefined;
            return <NodeCard key={i} node={n} opacity={1} glow={litAmt} borderColor={border} />;
          })}

          <CornerLogo />
          <div style={{ position: "absolute", left: 40, bottom: 30, fontFamily: MONO, fontSize: 12, letterSpacing: "0.12em", color: "hsl(var(--ink-faint))" }}>
            FIG. 01 — AGENT WORKFLOW
          </div>

          <div
            style={{
              position: "absolute",
              left: 800,
              bottom: 40 - (1 - panelP) * 260,
              transform: "translateX(-50%)",
              width: 720,
              opacity: panelP,
              background: "hsl(220 30% 13%)",
              border: "2px solid hsl(var(--ink))",
              fontFamily: MONO,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: "1px dashed hsl(210 20% 35%)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "hsl(var(--node-trigger))" }} />
              <span style={{ color: "hsl(210 30% 70%)", fontSize: 11, letterSpacing: "0.12em" }}>view pseudocode — python</span>
            </div>
            <div style={{ padding: "14px 16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
              {CODE_LINES.map((line, i) => {
                const ls = lineStart + i * lineStep;
                const lp = reveal(progress, ls, ls + lineStep * 0.8);
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: 15,
                      color: "hsl(205 60% 92%)",
                      whiteSpace: "pre",
                      opacity: lp,
                      transform: `translateX(${(1 - lp) * 10}px)`,
                    }}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </foreignObject>
    </svg>
  );
}

const SCENES = [
  { name: "Wordmark", dur: 4.5, Component: Wordmark },
  { name: "Wiring", dur: 6, Component: Wiring },
  { name: "Pulse", dur: 4.5, Component: Pulse },
] as const;
const TOTAL_DUR = SCENES.reduce((sum, s) => sum + s.dur, 0);

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function OpeningAnimation() {
  const reducedMotion = usePrefersReducedMotion();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (ts: number) => {
      if (last == null) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      setElapsed((e) => (e + dt) % TOTAL_DUR);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  // Static, fully-assembled frame when motion is reduced: no rAF loop runs.
  const clock = reducedMotion ? TOTAL_DUR * 0.94 : elapsed;

  let acc = 0;
  let sceneIndex = SCENES.length - 1;
  let sceneProgress = 1;
  for (let i = 0; i < SCENES.length; i++) {
    if (clock < acc + SCENES[i].dur || i === SCENES.length - 1) {
      sceneIndex = i;
      sceneProgress = clamp((clock - acc) / SCENES[i].dur, 0, 1);
      break;
    }
    acc += SCENES[i].dur;
  }

  const Scene = SCENES[sceneIndex].Component;

  return (
    <div className="relative h-full w-full" role="img" aria-hidden="true">
      <Scene progress={sceneProgress} />
    </div>
  );
}
