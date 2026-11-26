import { useState } from 'react';

type PlotPoint = { id: string; label: string; x: number; y: number };
export type SimilarityPlot = {
  exampleLabel: string;
  query: PlotPoint;
  candidates: PlotPoint[];
};

export function CanvasVisualization({ plot }: { plot: SimilarityPlot }) {
  const [activeId, setActiveId] = useState(plot.candidates[0]?.id);
  const active = plot.candidates.find(point => point.id === activeId);
  return <section className="board-visualization" aria-label="Vector space example">
    <p>{plot.exampleLabel}</p>
    <svg viewBox="0 0 230 125" role="img" aria-label={active ? `Query and ${active.label}` : 'Query coordinates'}>
      <path className="board-plot-axis" d="M22 14v91h186 M22 60h186 M84 14v91 M146 14v91" />
      {active && <path className="board-plot-distance" d={`M${plot.query.x} ${plot.query.y}L${active.x} ${active.y}`} />}
      {plot.candidates.map(point => <circle key={point.id} cx={point.x} cy={point.y} r="5"
        className={activeId === point.id ? 'board-plot-selected' : 'board-plot-point'} />)}
      <circle cx={plot.query.x} cy={plot.query.y} r="6" className="board-plot-query" />
      <text x={plot.query.x + 10} y={plot.query.y + 17}>Query</text>
    </svg>
    <div className="board-plot-options" role="group" aria-label="Compare a candidate">
      {plot.candidates.map(point => <button key={point.id} type="button" aria-pressed={activeId === point.id}
        onClick={() => setActiveId(point.id)}>{point.label}</button>)}
    </div>
    {active && <p role="status">Example distance: {Math.hypot(active.x - plot.query.x, active.y - plot.query.y).toFixed(1)} diagram units.</p>}
  </section>;
}
