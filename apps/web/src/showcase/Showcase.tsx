import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type DragEvent, type FormEvent, type PointerEvent } from "react";
import { ArrowRight, ArrowUp, AudioLines, BookOpen, CircleHelp, FileText, PanelLeft, X } from "lucide-react";
import type { ChatResponse, Citation, GraphNode } from "../types/contracts";
import { installShowcaseDropHandlers, sampleTransferType } from "./drop";
import { answerFromTrace, quoteCitation, routerQuestion } from "./evidence";
import logo from "./favicon.svg";
import { finalStep, playbackDelay, playbackState, reducePlayback } from "./replay";
import { ReplayPanel } from "./ReplayPanel";
import { loadSample, sampleIds, showcaseSamples, type SampleId } from "./samples";
import { repository, SourceDialog } from "./SourceDialog";
import { StarChart } from "./StarChart";
import type { ShowcaseTrace } from "./trace-types";

type Turn = { id: number; question: string; response: ChatResponse };
type TouchDrag = { id: SampleId; x: number; y: number };
const motionQuery = "(prefers-reduced-motion: reduce)";
const emptyHighlights: string[] = [];
const RagGuide = lazy(() => import("./RagGuide"));

function guideRequested() {
  return new URLSearchParams(window.location.search).get("view") === "guide";
}

function Answer({ answer, animate, onCitation }: { answer: ChatResponse; animate: boolean; onCitation: (citation: Citation) => void }) {
  const [displayed, setDisplayed] = useState(animate ? "" : answer.answer);
  useEffect(() => {
    if (!animate) { setDisplayed(answer.answer); return; }
    const characters = Array.from(answer.answer);
    let visible = 0;
    const timer = window.setInterval(() => {
      visible += 8;
      setDisplayed(characters.slice(0, visible).join(""));
      if (visible >= characters.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [answer, animate]);

  const finished = displayed === answer.answer;
  return <div className="answer">
    {answer.citations.length > 0 && <span className="answer-label">Source excerpt</span>}
    <p aria-hidden={!finished}>{displayed || "Finding a passage…"}</p>
    <span className="visually-hidden" role="status">{animate && (finished ? answer.answer : "Showing the result.")}</span>
    {finished && answer.citations.length > 0 && <div className="citations">
      {answer.citations.map(citation => <button type="button" key={citation.chunkId} onClick={() => onCitation(citation)}><BookOpen size={15} />Page {citation.page}<ArrowRight size={13} /></button>)}
    </div>}
  </div>;
}

function ConceptCard({ trace, concept, onConcept, onCitation, onClose }: {
  trace: ShowcaseTrace;
  concept: GraphNode;
  onConcept: (id: string) => void;
  onCitation: (citation: Citation) => void;
  onClose: () => void;
}) {
  const source = trace.chunks.find(chunk => concept.sourceChunkIds.includes(chunk.id));
  const citation = source && quoteCitation(source, concept.label);
  const adjacent = trace.graph.edges
    .filter(edge => edge.source === concept.id || edge.target === concept.id)
    .map(edge => edge.source === concept.id ? edge.target : edge.source);
  const neighbors = trace.graph.nodes.filter(node => adjacent.includes(node.id));

  return <aside className="concept-card" aria-label="Selected concept">
    <div className="concept-heading"><h2>{concept.label}</h2><button type="button" aria-label="Close concept" onClick={onClose}><X size={17}/></button></div>
    {concept.summary !== citation?.quote && <p>{concept.summary}</p>}
    {citation && <><blockquote>{citation.quote}</blockquote><button className="source-link" type="button" onClick={() => onCitation(citation)}><BookOpen size={15}/>View page {citation.page}<ArrowRight size={14}/></button></>}
    {neighbors.length > 0 && <div className="neighbor-list"><h3>Connected concepts</h3>{neighbors.map(node =>
      <button type="button" key={node.id} onClick={() => onConcept(node.id)}>{node.label}</button>)}</div>}
  </aside>;
}

export function Showcase() {
  const [guideOpen, setGuideOpen] = useState(guideRequested);
  const [trace, setTrace] = useState<ShowcaseTrace | null>(null);
  const [loading, setLoading] = useState<SampleId | null>(null);
  const [sample, setSample] = useState<SampleId | null>(null);
  const [playback, dispatch] = useReducer(reducePlayback, false, () => playbackState(matchMedia(motionQuery).matches));
  const [drop, setDrop] = useState<"files" | "sample" | null>(null);
  const [notice, setNotice] = useState("");
  const [question, setQuestion] = useState("");
  const [historyVisible, setHistoryVisible] = useState(false);
  const [turnsBySample, setTurnsBySample] = useState<Partial<Record<SampleId, Turn[]>>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [citation, setCitation] = useState<Citation | null>(null);
  const sequence = useRef(0);
  const turnId = useRef(0);
  const clock = useRef({ step: 0, run: 0, elapsed: 0 });
  const touch = useRef<TouchDrag | null>(null);
  const suppressClick = useRef(false);
  const newestTurn = useRef<HTMLDivElement>(null);
  const guideButton = useRef<HTMLButtonElement>(null);
  const returning = useRef(false);
  const stage = trace?.stages[playback.step];
  const ready = !!trace && playback.step === finalStep;
  const turns = sample ? turnsBySample[sample] ?? [] : [];
  const last = turns.at(-1);

  useEffect(() => {
    const preference = matchMedia(motionQuery);
    const changed = (event: MediaQueryListEvent) => dispatch({ type: "setMotion", reduced: event.matches });
    preference.addEventListener("change", changed);
    return () => preference.removeEventListener("change", changed);
  }, []);

  useEffect(() => {
    const syncGuide = () => {
      const open = guideRequested();
      returning.current = !open;
      setDrop(null);
      setGuideOpen(open);
    };
    window.addEventListener("popstate", syncGuide);
    return () => window.removeEventListener("popstate", syncGuide);
  }, []);

  useEffect(() => {
    if (guideOpen || !returning.current) return;
    guideButton.current?.focus();
    returning.current = false;
  }, [guideOpen]);

  useEffect(() => {
    if (!stage || guideOpen) return;
    if (clock.current.step !== playback.step || clock.current.run !== playback.run) {
      clock.current = { step: playback.step, run: playback.run, elapsed: 0 };
    }
    const delay = playbackDelay(playback, stage.kind, clock.current.elapsed);
    if (delay === null) return;
    const started = performance.now();
    const timer = window.setTimeout(() => dispatch({ type: "step" }), delay);
    return () => {
      window.clearTimeout(timer);
      clock.current.elapsed += (performance.now() - started) * playback.speed;
    };
  }, [stage, playback, guideOpen]);

  useEffect(() => {
    if (last) newestTurn.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [last]);

  const addTurn = useCallback((id: SampleId, recording: ShowcaseTrace, value: string) => {
    const turn = { id: ++turnId.current, question: value, response: answerFromTrace(recording, value) };
    setTurnsBySample(previous => ({ ...previous, [id]: [...(previous[id] ?? []), turn] }));
    setQuestion("");
    setSelected(null);
  }, []);

  const startSample = useCallback(async (id: SampleId, example?: string) => {
    const request = ++sequence.current;
    setLoading(id);
    setDrop(null);
    setNotice("");
    try {
      const loaded = await loadSample(id);
      if (request !== sequence.current) return;
      setTrace(loaded);
      setSample(id);
      setSelected(null);
      setCitation(null);
      setQuestion("");
      dispatch({ type: example ? "skip" : "restart" });
      if (example) addTurn(id, loaded, example);
    } catch {
      if (request === sequence.current) setNotice("The sample didn’t load. Select it again to retry.");
    } finally {
      if (request === sequence.current) setLoading(null);
    }
  }, [addTurn]);

  useEffect(() => installShowcaseDropHandlers(window, sampleIds, {
    onDrag: setDrop,
    onSample: id => { if (!guideOpen) void startSample(id); },
    onRejectedFile: () => setNotice("This demo only opens the bundled samples. Choose one below to replay it."),
  }), [guideOpen, startSample]);

  function beginDrag(event: DragEvent<HTMLButtonElement>, id: SampleId) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(sampleTransferType, id);
    setDrop("sample");
  }

  function beginTouch(event: PointerEvent<HTMLButtonElement>, id: SampleId) {
    suppressClick.current = false;
    if (event.pointerType === "mouse") return;
    touch.current = { id, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function draggedTouch(event: PointerEvent<HTMLButtonElement>): boolean {
    return !!touch.current && Math.hypot(event.clientX - touch.current.x, event.clientY - touch.current.y) > 18;
  }

  function endTouch(event: PointerEvent<HTMLButtonElement>) {
    if (touch.current && draggedTouch(event)) {
      suppressClick.current = true;
      void startSample(touch.current.id);
    }
    touch.current = null;
    setDrop(null);
  }

  function ask(value: string) {
    if (!sample || !trace || !ready || loading) return;
    const text = value.trim();
    if (!text) return;
    addTurn(sample, trace, text);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }

  function showGuide(open: boolean) {
    const url = new URL(window.location.href);
    if (open) {
      url.searchParams.set("view", "guide");
      window.history.pushState({ graspGuide: true }, "", url);
    } else if (window.history.state?.graspGuide) {
      window.history.back();
      return;
    } else {
      url.searchParams.delete("view");
      window.history.replaceState(null, "", url);
    }
    returning.current = !open;
    setDrop(null);
    setGuideOpen(open);
  }

  if (guideOpen) return <Suspense fallback={<p className="guide-loading" role="status">Opening the walkthrough…</p>}>
    <RagGuide onBack={() => showGuide(false)} onTry={() => {
      showGuide(false);
      void startSample("computer-networks", routerQuestion);
    }}/>
  </Suspense>;

  const guideEntry = <button type="button" className="guide-entry" ref={guideButton} aria-label="How Grasp works" onClick={() => showGuide(true)}>
    <BookOpen size={17}/><span>How Grasp works</span><ArrowRight size={15} className="guide-entry-arrow"/>
  </button>;

  const highlighted = ready ? last?.response.referencedNodeIds ?? emptyHighlights : emptyHighlights;
  const concept = trace?.graph.nodes.find(node => node.id === selected);

  const paused = !!trace && !ready && !playback.reduced && !playback.playing;
  return <main className={`showcase${playback.reduced ? " showcase-reduced" : ""}${ready ? " showcase-ready" : ""}${paused ? " showcase-paused" : ""}`}
    style={{ "--replay-pace": 1 / playback.speed } as CSSProperties}>
    <StarChart key={trace?.id ?? "sky"} trace={trace} stage={stage?.kind} highlighted={highlighted} selected={selected} reduced={playback.reduced} onSelect={setSelected} />
    <header className="showcase-header">
      <div className="header-leading">
        <button type="button" className="header-icon" aria-label="Question history" aria-expanded={historyVisible} aria-controls="question-history" onClick={() => setHistoryVisible(!historyVisible)}><PanelLeft size={19} /></button>
        <span className="showcase-wordmark">Grasp</span>
      </div>
      <div className="header-actions">
        {trace && guideEntry}
        <button type="button" aria-pressed={playback.reduced} onClick={() => dispatch({ type: "setMotion", reduced: !playback.reduced })}><AudioLines size={16}/><span>Reduced motion</span></button>
        {import.meta.env.BASE_URL === "/" ? <a href="../">Open local workspace<ArrowRight size={15}/></a> : <a href={repository}>Project on GitHub<ArrowRight size={15}/></a>}
      </div>
    </header>

    <aside id="question-history" className="history" hidden={!historyVisible}>
      <div className="history-heading"><h2>Question history</h2><button type="button" onClick={() => setHistoryVisible(false)} aria-label="Close question history"><X size={18}/></button></div>
      {turns.length ? <ol>{turns.map(turn => <li key={turn.id}><button type="button" onClick={() => {
        document.getElementById(`question-${turn.id}`)?.scrollIntoView({ block: "nearest" });
        setHistoryVisible(false);
      }}>{turn.question}</button></li>)}</ol> : <p>Questions you ask about this sample appear here.</p>}
    </aside>

    <div className="showcase-center">
      {!trace && <section className="intro">
        <div className="intro-emblem" aria-hidden="true"><img src={logo} alt="" width="35" height="35" /></div>
        <h1>drop folder to get started</h1>
        <p>Replay a sample note as it becomes a map of concepts.</p>
        {guideEntry}
      </section>}
      {trace && <h1 className="visually-hidden">Grasp showcase</h1>}

      {trace && stage && <ReplayPanel trace={trace} stage={stage} playback={playback}
        onToggle={() => dispatch({ type: "toggle" })} onStep={() => dispatch({ type: "step" })}
        onSkip={() => dispatch({ type: "skip" })} onRestart={() => { setSelected(null); dispatch({ type: "restart" }); }}
        onSpeed={speed => dispatch({ type: "setSpeed", speed })} />}
      {loading && <p className="loading-note" role="status">Opening {showcaseSamples[loading].title}…</p>}
    </div>

    {ready && trace && <details className="concept-index">
      <summary>Concepts <span>{trace.graph.nodes.length}</span></summary>
      <ul>{trace.graph.nodes.map(node => <li key={node.id}><button type="button" aria-pressed={selected === node.id} onClick={() => setSelected(node.id)}>{node.label}</button></li>)}</ul>
    </details>}
    {ready && trace && concept && <ConceptCard trace={trace} concept={concept} onConcept={setSelected} onCitation={setCitation} onClose={() => setSelected(null)} />}

    <section className="showcase-chat" aria-label="Ask about the sample">
      {ready && turns.length > 0 && <div className="message-list" aria-label="Conversation" tabIndex={0}>
        {turns.map(turn => <article className="message" id={`question-${turn.id}`} key={turn.id}>
          <h2>{turn.question}</h2>
          <Answer answer={turn.response} animate={turn === last && !playback.reduced} onCitation={setCitation} />
        </article>)}
        <div ref={newestTurn} />
      </div>}
      {ready && trace && !turns.length && <div className="suggestions" aria-label="Suggested prompts">
        {trace.prompts.map(prompt => <button type="button" className="suggestion" key={prompt.question} onClick={() => ask(prompt.question)}><CircleHelp size={16}/>{prompt.question}</button>)}
      </div>}
      <p className="drop-notice" role="status">{notice}</p>
      <div className="sample-strip" aria-label="Bundled notes">
        {sampleIds.map(id => <button type="button" key={id} aria-pressed={sample === id} draggable
          onDragStart={event => beginDrag(event, id)} onDragEnd={() => setDrop(null)}
          onPointerDown={event => beginTouch(event, id)} onPointerMove={event => { if (draggedTouch(event)) setDrop("sample"); }}
          onPointerUp={endTouch} onPointerCancel={() => { touch.current = null; setDrop(null); }}
          onClick={event => {
            if (suppressClick.current && event.detail > 0) { suppressClick.current = false; return; }
            void startSample(id);
          }}><FileText size={17}/><span>{showcaseSamples[id].title}<small>{showcaseSamples[id].format}</small></span></button>)}
      </div>
      <form className="showcase-composer" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="showcase-question">Ask about the sample</label>
        <textarea id="showcase-question" rows={1} maxLength={600} value={question} disabled={!ready || !!loading}
          placeholder={ready ? "Ask about this sample…" : trace ? "Questions open after the replay…" : "Choose or drag a sample to ask a question…"}
          onChange={event => setQuestion(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(question); }
          }}/>
        <button type="submit" className="send-question" aria-label="Ask question" disabled={!ready || !question.trim() || !!loading}><ArrowUp size={19}/></button>
      </form>
      <footer className="showcase-footer"><a href={repository}>Recorded from a real run of the pipeline</a><span>Mock mode · Bundled notes only</span></footer>
    </section>

    {drop && <div className="drop-screen" aria-hidden="true"><div>
      <FileText size={32} strokeWidth={1.2}/><strong>{drop === "sample" ? "Release to replay the note" : "Choose a bundled sample"}</strong>
      <span>{drop === "sample" ? "Watch its pages become a constellation." : "Personal files stay on your device."}</span>
    </div></div>}
    {trace && citation && <SourceDialog trace={trace} citation={citation} onClose={() => setCitation(null)} />}
  </main>;
}
