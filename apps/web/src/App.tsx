import { useEffect, useRef } from "react";
import {
  ArrowDownToLine, ArrowUpRight, BookOpen, Check,
  ChevronRight, Code2, Database, FileText, Layers3, Orbit,
  RefreshCw, SquareArrowOutUpRight, X,
} from "lucide-react";
import { useWorkspace } from "./store";

function HealthIndicator() {
  const { healthState, health, setPanel } = useWorkspace();
  const connected = healthState === "ready" && health?.status === "ok";
  const label = connected ? "Local workspace ready" : healthState === "error"
    ? "API is unavailable" : healthState === "ready" ? "Configuration needs attention" : "Connecting to workspace";
  return (
    <button className="health-button" onClick={() => setPanel("status")} aria-label={`${label}. Open system status`}>
      <span className={`health-dot ${connected ? "connected" : ""}`} />
      <span>{label}</span><ChevronRight size={14} />
    </button>
  );
}

function DocumentRail() {
  const { panel, loadSample } = useWorkspace();
  return (
    <aside className="document-rail" aria-label="Study material">
      <div className="rail-top">
        <div className="flex items-center justify-between gap-3">
          <h2>Source library</h2><Layers3 size={16} aria-hidden="true" />
        </div>
        <p>Your notes stay close.</p>
      </div>
      <div className="sample-group">
        <span className="list-label">Included sample</span>
        <button className={`document-item ${panel === "source" ? "selected" : ""}`} onClick={() => void loadSample()}>
          <span className="file-symbol"><FileText size={18} /></span>
          <span><strong>Memory & learning</strong><small>Markdown · 8 sections</small></span>
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="rail-note">
        <BookOpen size={16} aria-hidden="true" />
        <p>Begin with the sample to see how source notes will sit beside your canvas.</p>
      </div>
      <div className="rail-bottom"><HealthIndicator /><span>Stored on this computer</span></div>
    </aside>
  );
}

function EmptyCanvas() {
  const { loadSample, loadSchemas } = useWorkspace();
  return (
    <section className="canvas" aria-labelledby="canvas-heading">
      <div className="canvas-topline"><span><Orbit size={15} /> Knowledge canvas</span><span>Phase 1 preview</span></div>
      <div className="chart-grid" aria-hidden="true"><div className="chart-ring ring-one" /><div className="chart-ring ring-two" /><div className="chart-axis axis-x" /><div className="chart-axis axis-y" /></div>
      <div className="canvas-welcome">
        <div className="canvas-symbol" aria-hidden="true"><Orbit size={32} strokeWidth={1.2} /></div>
        <h1 id="canvas-heading">Find the connections<br />in your notes.</h1>
        <p>A place to explore ideas, follow the source<br className="desktop-break" /> and check what you understand.</p>
        <button id="canvas-action" className="primary-button" onClick={() => void loadSample()}><BookOpen size={16} /> Read sample notes <ArrowUpRight size={15} /></button>
        <button className="text-button" onClick={() => void loadSchemas()}>Inspect the data contracts <ChevronRight size={14} /></button>
      </div>
      <div className="canvas-bottom"><span><span className="small-cross" aria-hidden="true" /> No documents uploaded</span><span>Interactive graph follows in Phase 3</span></div>
    </section>
  );
}

function LoadingLines() {
  return <div className="loading-lines" role="status" aria-label="Loading"><span /><span /><span /><span /></div>;
}

function ErrorMessage({ message, retry }: { message: string; retry: () => void }) {
  return <div className="request-error" role="alert"><p>{message}</p><button className="secondary-button" onClick={retry}><RefreshCw size={14} /> Try again</button></div>;
}

function NoteContent({ text }: { text: string }) {
  return <div className="note-content">{text.split("\n\n").map((block, index) => {
    if (block.startsWith("# ")) return <h2 key={index}>{block.slice(2)}</h2>;
    if (block.startsWith("## ")) return <h3 key={index}>{block.slice(3)}</h3>;
    return <p key={index}>{block}</p>;
  })}</div>;
}

function SampleReader() {
  const { sample, sampleState, sampleError, loadSample } = useWorkspace();
  if (sampleState === "loading") return <LoadingLines />;
  if (sampleState === "error") return <ErrorMessage message={sampleError} retry={() => void loadSample()} />;
  if (!sample) return null;
  return <>
    <div className="source-metadata"><span>Original sample</span><span>Page 1</span></div>
    <NoteContent text={sample.text} />
    <a className="download-source" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(sample.text)}`} download={sample.name}><ArrowDownToLine size={14} /> Download Markdown</a>
  </>;
}

function ContractInspector() {
  const { schemas, schemasState, schemasError, selectedSchema, selectSchema, loadSchemas } = useWorkspace();
  if (schemasState === "loading") return <LoadingLines />;
  if (schemasState === "error") return <ErrorMessage message={schemasError} retry={() => void loadSchemas()} />;
  const selected = schemas.find((schema) => schema.name === selectedSchema);
  return <div className="contract-inspector">
    <p>These definitions come from the running API. Python and TypeScript use the same contracts.</p>
    <label htmlFor="schema-name">Schema</label>
    <select id="schema-name" value={selectedSchema} onChange={(event) => selectSchema(event.target.value)}>{schemas.map((schema) => <option key={schema.name}>{schema.name}</option>)}</select>
    <pre tabIndex={0} aria-label={`${selectedSchema} JSON schema`}><code>{JSON.stringify(selected?.definition, null, 2)}</code></pre>
    <a className="text-link" href="/api/docs" target="_blank" rel="noreferrer">Open API reference <SquareArrowOutUpRight size={13} /></a>
  </div>;
}

function StatusPanel() {
  const { health, healthState, loadHealth } = useWorkspace();
  const rows = [
    ["SQLite", health?.sqlite === "ok" ? "Connected" : "Unavailable"],
    ["ChromaDB", health?.chroma === "ok" ? "Connected" : "Unavailable"],
    ["Model", health?.llm.provider === "mock" ? "Deterministic mock" : health?.llm.model ?? "Unavailable"],
  ];
  return <div className="status-panel">
    <Database size={24} strokeWidth={1.3} />
    <h2>Local workspace</h2>
    <p>Graph records and vector collections have separate persistent stores on this computer.</p>
    {healthState === "loading" ? <LoadingLines /> : healthState === "error" ? <ErrorMessage message="The API is not responding. Start it with the project launcher, then try again." retry={() => void loadHealth()} /> : <dl>{rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value === "Connected" && <Check size={13} />}{value}</dd></div>)}</dl>}
    {health?.llm.provider === "mock" && <p className="status-note">Mock mode uses local fixtures. Reading the sample does not call an AI provider.</p>}
    {health && !health.llm.configured && <p className="request-error">Set the selected provider key in .env, or use MOCK_LLM=1, then restart the API.</p>}
    <button className="secondary-button" onClick={() => void loadHealth()} disabled={healthState === "loading"}><RefreshCw size={14} /> Check connection</button>
  </div>;
}

function SidePanel() {
  const { panel, setPanel } = useWorkspace();
  const title = panel === "source" ? "Source notes" : panel === "contracts" ? "Data contracts" : "System status";
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (panel) heading.current?.focus(); }, [panel]);
  if (!panel) return null;
  return <aside className="side-panel" aria-labelledby="panel-title">
    <div className="panel-heading"><h2 id="panel-title" ref={heading} tabIndex={-1}>{title}</h2><button className="icon-button" aria-label="Close side panel" onClick={() => { setPanel(null); document.getElementById("canvas-action")?.focus(); }}><X size={17} /></button></div>
    <div className="panel-body">{panel === "source" ? <SampleReader /> : panel === "contracts" ? <ContractInspector /> : <StatusPanel />}</div>
  </aside>;
}

export function App() {
  const { panel, setPanel, loadHealth, loadSample, loadSchemas } = useWorkspace();
  useEffect(() => { void loadHealth(); }, [loadHealth]);
  useEffect(() => {
    const closePanel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panel) {
        setPanel(null);
        document.getElementById("canvas-action")?.focus();
      }
    };
    window.addEventListener("keydown", closePanel);
    return () => window.removeEventListener("keydown", closePanel);
  }, [panel, setPanel]);
  return <div className={`workspace ${panel ? "panel-open" : ""}`}>
    <a className="skip-link" href="#workspace-main">Skip to canvas</a>
    <header className="topbar">
      <div className="workspace-title"><Orbit size={21} strokeWidth={1.4} /><span>Study space</span><span className="title-divider" /><span className="collection-name">Untitled collection</span></div>
      <nav aria-label="Workspace tools"><button className={panel === "source" ? "active" : ""} onClick={() => void loadSample()}><FileText size={15} /><span>Source</span></button><button className={panel === "contracts" ? "active" : ""} onClick={() => void loadSchemas()}><Code2 size={15} /><span>Contracts</span></button></nav>
    </header>
    <main id="workspace-main" className="workspace-body"><DocumentRail /><EmptyCanvas /><SidePanel /></main>
    <footer className="workspace-footer"><span>Notes → connections → understanding</span><a href="https://github.com/stanbang/Grasp" target="_blank" rel="noreferrer">View project <ArrowUpRight size={12} /></a></footer>
  </div>;
}
