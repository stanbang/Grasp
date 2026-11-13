import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import type { GraphNode, GraphResponse } from './types/contracts';

const ForceGraph = lazy(() => import('react-force-graph-3d'));

function tooltip(label: string): string {
  return label.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function Mindmap({ graph, highlight, onSelect, active = true }: {
  active?: boolean;
  graph: GraphResponse;
  highlight: string[];
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<ForceGraphMethods>();
  const cache = useRef(new Map<string, GraphNode>());
  const fitted = useRef('');
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [pulse, setPulse] = useState(0);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !highlight.length) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      setPulse(elapsed < 5000 ? Math.sin(elapsed / 500) * 3 : 0);
      if (elapsed >= 5000) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [highlight, reduced]);

  useEffect(() => { const update = () => { if (!active || document.hidden) engine.current?.pauseAnimation(); else engine.current?.resumeAnimation(); }; update(); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, [active]);

  const data = useMemo(() => ({
    nodes: graph.nodes.map(node => {
      const previous = cache.current.get(node.id);
      const value = previous ? Object.assign(previous, node) : { ...node };
      cache.current.set(node.id, value);
      return value;
    }),
    links: graph.edges.map(edge => ({ ...edge })),
  }), [graph]);

  return <div className="mindmap-background" ref={host} aria-label="Interactive document mindmap">
    <Suspense fallback={null}>
      {graph.nodes.length > 0 && <ForceGraph
        ref={engine} graphData={data} width={size.width} height={size.height}
        backgroundColor="#0b1119" showNavInfo={false}
        nodeLabel={node => tooltip(String(node.label))}
        linkLabel={edge => tooltip(String(edge.relationshipLabel))}
        nodeVal={node => highlight.includes(String(node.id)) ? 12 + pulse : 7}
        nodeColor={node => node.masteryState === 'mastered' ? '#d9b66f' : highlight.includes(String(node.id)) || node.masteryState === 'learning' ? '#8ddbcf' : '#627d8b'}
        nodeRelSize={.8} nodeOpacity={1} linkColor={() => '#627d8b'} linkWidth={1} linkOpacity={.7}
        cooldownTicks={reduced ? 0 : 100} warmupTicks={reduced ? 100 : 0}
        linkDirectionalParticles={0} onNodeClick={node => onSelect(String(node.id))}
        onEngineStop={() => {
          if (!active || document.hidden) engine.current?.pauseAnimation();
          const view = `${data.nodes.length}:${size.width}:${size.height}`;
          if (fitted.current !== view) {
            engine.current?.zoomToFit(reduced ? 0 : 800, -Math.min(size.width, size.height) * .25);
            fitted.current = view;
          }
        }}
      />}
    </Suspense>
  </div>;
}
