import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph, { type ForceGraphMethods } from "react-force-graph-3d";
import type { GraphResponse } from "../types/contracts";
import type { ShowcasePoint } from "./trace-types";

export type View = { angle: number; scale: number };

export default function OrbitEngine({ graph, positions, highlighted, selected, view, reduced, onSelect, onUnavailable }: {
  graph: GraphResponse;
  positions: ShowcasePoint[];
  highlighted: string[];
  selected: string | null;
  view: View;
  reduced: boolean;
  onSelect: (id: string) => void;
  onUnavailable: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<ForceGraphMethods>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    const lost = () => onUnavailable();
    observer.observe(target);
    target.addEventListener("webglcontextlost", lost, true);
    return () => {
      observer.disconnect();
      target.removeEventListener("webglcontextlost", lost, true);
    };
  }, [onUnavailable]);

  useEffect(() => {
    if (!highlighted.length || reduced) return;
    let steps = 0;
    const timer = window.setInterval(() => {
      setPulse(++steps % 2 === 1);
      if (steps === 6) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [highlighted, reduced]);

  useEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    const distance = (size.width < 660 ? 860 : 590) / view.scale;
    engine.current?.cameraPosition({ x: Math.sin(view.angle) * distance, y: 28, z: Math.cos(view.angle) * distance }, { x: 0, y: 0, z: 0 }, reduced ? 0 : 500);
  }, [size.height, size.width, view, reduced]);

  const data = useMemo(() => {
    const coords = new Map(positions.map(point => [point.id, point.xyz]));
    return {
      nodes: graph.nodes.map(node => {
        const [x, y, z] = (coords.get(node.id) ?? [0, 0, 0]).map(value => value * 110);
        return { ...node, x, y, z, fx: x, fy: y, fz: z };
      }),
      links: graph.edges.map(edge => ({ ...edge })),
    };
  }, [graph, positions]);

  return <div ref={host} className="orbit-engine" aria-hidden="true">
    {size.width > 0 && size.height > 0 && <ForceGraph
      ref={engine} graphData={data} width={size.width} height={size.height}
      backgroundColor="rgba(0, 0, 0, 0)" showNavInfo={false} controlType="orbit"
      enableNodeDrag={false} cooldownTicks={0} warmupTicks={0}
      nodeLabel={node => node.label.replace(/[<>&]/g, "")}
      nodeColor={node => node.id === selected || highlighted.includes(String(node.id)) ? "#8ddbcf" : "#7297a7"}
      nodeVal={node => highlighted.includes(String(node.id)) ? 12 + (pulse && !reduced ? 7 : 0) : node.id === selected ? 16 : 6}
      nodeRelSize={2} nodeResolution={10} nodeOpacity={1} linkColor={() => "#6d98a8"} linkWidth={1} linkOpacity={0.52}
      onNodeClick={node => onSelect(String(node.id))}
    />}
  </div>;
}
