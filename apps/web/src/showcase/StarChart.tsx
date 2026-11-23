import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import type { GraphEdge } from "../types/contracts";
import type { View } from "./OrbitEngine";
import type { ShowcasePoint, ShowcaseStage, ShowcaseTrace } from "./trace-types";

const OrbitEngine = lazy(() => import("./OrbitEngine"));
const initialView: View = { angle: 0, scale: 1 };

class OrbitBoundary extends Component<{ children: ReactNode; onUnavailable: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function canUseWebGL(): boolean {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory && memory < 4) return false;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
  context?.getExtension("WEBGL_lose_context")?.loseContext();
  return !!context;
}

const backgroundStars = Array.from({ length: 62 }, (_, index) => ({
  x: (index * 137 + 49) % 1000,
  y: (index * 111 + 27) % 560,
  r: index % 11 === 0 ? 1.7 : 0.8,
}));

function FlatChart({ positions, links, view, highlighted, selected, onSelect, entering }: {
  positions: ShowcasePoint[];
  links: GraphEdge[];
  view: View;
  highlighted: string[];
  selected: string | null;
  onSelect?: (id: string) => void;
  entering: boolean;
}) {
  const stars = positions.map(point => {
    const [x, y, z] = point.xyz;
    return { id: point.id, x: 500 + (x * Math.cos(view.angle) + z * Math.sin(view.angle)) * 222 * view.scale,
      y: 273 + y * 152 * view.scale + z * 19 };
  });
  const byId = new Map(stars.map(star => [star.id, star]));
  return <svg viewBox="0 0 1000 560" className={`flat-chart${entering ? " chart-arriving" : ""}`} aria-hidden="true">
    {links.map(link => {
      const start = byId.get(link.source);
      const end = byId.get(link.target);
      return start && end && <line key={link.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} pathLength={1} />;
    })}
    {stars.map(star => {
      const active = highlighted.includes(star.id) || selected === star.id;
      return <g key={star.id} className={active ? "chart-star-active" : ""}>
        {active && <circle className="chart-halo" cx={star.x} cy={star.y} r={13} />}
        <circle className="chart-star" cx={star.x} cy={star.y} r={active ? 5 : 3.5}/>
        {onSelect && <circle className="chart-target" cx={star.x} cy={star.y} r={18} onClick={() => onSelect(star.id)} />}
      </g>;
    })}
  </svg>;
}

export function StarChart({ trace, stage, highlighted, selected, reduced, onSelect }: {
  trace: ShowcaseTrace | null;
  stage?: ShowcaseStage["kind"];
  highlighted: string[];
  selected: string | null;
  reduced: boolean;
  onSelect: (id: string) => void;
}) {
  const [view, setView] = useState(initialView);
  const [prefer2D, setPrefer2D] = useState(false);
  const [webGL, setWebGL] = useState<boolean | null>(null);
  const fallback = useCallback(() => setWebGL(false), []);
  const ready = !!trace && stage === "ready";
  const readyFor3D = ready && !reduced && !prefer2D;
  useEffect(() => {
    if (readyFor3D && webGL === null) setWebGL(canUseWebGL());
  }, [readyFor3D, webGL]);

  const interactive = stage === "links" || ready;
  const positions = (stage === "embeddings" ? trace?.chunkPositions :
    stage === "concepts" || interactive ? trace?.conceptPositions : undefined) ?? [];
  const flat = <FlatChart positions={positions} links={interactive ? trace?.graph.edges ?? [] : []} view={view}
    highlighted={highlighted} selected={selected} onSelect={interactive ? onSelect : undefined}
    entering={stage === "embeddings" || stage === "links"} />;

  return <>
    <div className="star-chart" aria-hidden="true">
      <svg viewBox="0 0 1000 560" className="chart-paper">
        <path d="M150 273h700M500 48v450" />
        <circle cx="500" cy="273" r="146"/><circle cx="500" cy="273" r="220"/>
        {backgroundStars.map(({ x, y, r }) => <circle key={x} className="sky-point" cx={x} cy={y} r={r} />)}
      </svg>
      {trace && readyFor3D && webGL ? <OrbitBoundary onUnavailable={fallback}>
        <Suspense fallback={flat}><OrbitEngine graph={trace.graph} positions={trace.conceptPositions} view={view}
          highlighted={highlighted} selected={selected} reduced={reduced} onSelect={onSelect} onUnavailable={fallback} /></Suspense>
      </OrbitBoundary> : flat}
    </div>
    {ready && <div className="chart-controls" role="group" aria-label="Star map view">
      <button type="button" aria-label="Rotate left" onClick={() => setView(previous => ({ ...previous, angle: previous.angle - Math.PI / 8 }))}><RotateCcw size={17}/></button>
      <button type="button" aria-label="Rotate right" onClick={() => setView(previous => ({ ...previous, angle: previous.angle + Math.PI / 8 }))}><RotateCw size={17}/></button>
      <button type="button" aria-label="Zoom out" disabled={view.scale <= 0.6} onClick={() => setView(previous => ({ ...previous, scale: Math.max(0.6, previous.scale - 0.2) }))}><Minus size={17}/></button>
      <button type="button" aria-label="Zoom in" disabled={view.scale >= 1.8} onClick={() => setView(previous => ({ ...previous, scale: Math.min(1.8, previous.scale + 0.2) }))}><Plus size={17}/></button>
      {webGL && !reduced && <button type="button" className="view-switch" onClick={() => setPrefer2D(!prefer2D)}>{prefer2D ? "Use 3D map" : "Use 2D map"}</button>}
    </div>}
  </>;
}
