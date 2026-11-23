import { FastForward, Pause, Play, RotateCcw, StepForward } from "lucide-react";
import { finalStep, speeds, stages, type Playback, type Speed } from "./replay";
import type { ShowcaseStage, ShowcaseTrace } from "./trace-types";

function Pages({ trace }: { trace: ShowcaseTrace }) {
  return <div className="document-pages" aria-label="Extracted pages">
    {trace.pages.map(page => <div className="paper" key={page.page}>
      <span>Page {page.page}</span>
      <p>{page.text.trim().slice(0, 155)}…</p>
      <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
    </div>)}
  </div>;
}

function ChunkBoundaries({ trace }: { trace: ShowcaseTrace }) {
  return <div className="chunk-boundaries">
    {trace.pages.map(page => {
      const chunks = trace.chunks.filter(chunk => chunk.page === page.page);
      const length = Array.from(page.text).length;
      return <section key={page.page} aria-label={`Chunks from page ${page.page}`}>
        <h3>Page {page.page}</h3>
        {chunks.map((chunk, index) => {
          const preceding = chunks[index - 1];
          const overlap = preceding ? Math.max(0, preceding.charEnd - chunk.charStart) : 0;
          return <div key={chunk.id} className="chunk-boundary">
            <div className="chunk-track" aria-hidden="true"><i style={{
              marginInlineStart: `${100 * chunk.charStart / length}%`,
              width: `${100 * (chunk.charEnd - chunk.charStart) / length}%`,
            }} /></div>
            <span>{chunk.charStart}–{chunk.charEnd}{overlap > 0 && ` · ${overlap} shared`}</span>
          </div>;
        })}
      </section>;
    })}
  </div>;
}

export function ReplayPanel({ trace, stage, playback, onToggle, onStep, onSkip, onRestart, onSpeed }: {
  trace: ShowcaseTrace;
  stage: ShowcaseStage;
  playback: Playback;
  onToggle: () => void;
  onStep: () => void;
  onSkip: () => void;
  onRestart: () => void;
  onSpeed: (speed: Speed) => void;
}) {
  const details = stages[stage.kind];
  const ready = playback.step === finalStep;
  return <section className={ready ? "replay replay-ready" : "replay"} aria-label="Ingestion replay">
    <div className="replay-copy" aria-live="polite" aria-atomic="true">
      <h2>{details.title}</h2>
      <p>{details.caption}</p>
    </div>
    {!ready && <div className="replay-content" key={stage.kind}>
      {(stage.kind === "pages" || stage.kind === "links") && <div className={stage.kind === "links" ? "pages-fading" : undefined}><Pages trace={trace} /></div>}
      {stage.kind === "text" && <div className="extract-preview" tabIndex={0} aria-label="Extracted text by page">
        {trace.pages.map(page => <section key={page.page}><h3>Page {page.page}</h3><pre>{page.text.trim()}</pre></section>)}
      </div>}
      {stage.kind === "chunks" && <ChunkBoundaries trace={trace} />}
      {(stage.kind === "embeddings" || stage.kind === "concepts" || stage.kind === "links") &&
        <ul className="recorded-lines" aria-label="Recorded processing notes">{stage.lines.map((line, index) => <li key={line} style={{ animationDelay: `${index * 160}ms` }}>{line}</li>)}</ul>}
    </div>}
    <div className="replay-actions">
      {!ready && <>
        <span className="stage-meter" aria-label={`Stage ${playback.step + 1} of ${trace.stages.length}`}>
          {trace.stages.map((entry, index) => <i className={index <= playback.step ? "stage-current" : undefined} key={entry.kind} />)}
        </span>
        {!playback.reduced && <button type="button" onClick={onToggle}>
          {playback.playing ? <Pause size={15} /> : <Play size={15} />}{playback.playing ? "Pause" : "Play"}
        </button>}
        <button type="button" onClick={onStep} aria-label="Next stage" title="Next stage"><StepForward size={16} /></button>
        <button type="button" onClick={onSkip}><FastForward size={16} />Skip</button>
        {!playback.reduced && <label className="replay-speed"><span className="visually-hidden">Replay speed</span>
          <select value={playback.speed} onChange={event => onSpeed(Number(event.target.value) as Speed)}>
            {speeds.map(speed => <option key={speed} value={speed}>{speed}×</option>)}
          </select>
        </label>}
      </>}
      <button type="button" onClick={onRestart}><RotateCcw size={15} />Restart</button>
    </div>
  </section>;
}
