import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { routerQuestion } from "./evidence";
import { guideStages, guideTopics, replacementExamples } from "./guide-data";
import recorded from "./guide-results.json";
import { loadSample } from "./samples";
import { repository } from "./SourceDialog";
import type { ShowcasePrompt } from "./trace-types";
import "./guide.css";

type Topic = typeof guideTopics[number]["id"];
type TraceState = { status: "loading" | "unavailable" } | { status: "ready"; prompt: ShowcasePrompt };

function CodeLink({ path, children }: { path: string; children: string }) {
  return <a className="guide-link" href={`${repository}/blob/showcase-overhaul/${path}`}>{children}<ExternalLink size={14}/></a>;
}

function Choices<Key extends string>({ label, options, active, choose }: {
  label: string;
  options: readonly { id: Key; label: string }[];
  active: Key;
  choose: (id: Key) => void;
}) {
  return <div className="guide-choices" role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.id} aria-pressed={active === option.id}
      onClick={() => choose(option.id)}>{option.label}</button>)}
  </div>;
}

function TraceQuote({ trace }: { trace: TraceState }) {
  if (trace.status === "ready") {
    const citation = trace.prompt.answer.citations[0];
    return <blockquote className="guide-quote">{citation?.quote}
      <cite>Computer networks · Page {citation?.page}</cite>
    </blockquote>;
  }
  return <p role="status">{trace.status === "loading" ? "Opening the network note…" : "The network example is unavailable. Reload the walkthrough to try again."}</p>;
}

const lanes = [{ id: "prepare", label: "Prepare the notes" }, { id: "question", label: "Answer a question" }] as const;

function Pipeline({ trace }: { trace: TraceState }) {
  const [lane, setLane] = useState<keyof typeof guideStages>("prepare");
  const [selected, setSelected] = useState(0);
  const steps = guideStages[lane];
  const stage = steps[selected] ?? steps[0];
  return <>
    <p>For a general explanation, ask a model directly. For repeated questions about a course, Grasp looks in your notes first so you can check its answer against what the lecturer wrote.</p>
    <Choices label="Pipeline lanes" options={lanes} active={lane} choose={next => { setLane(next); setSelected(0); }} />
    <ol className="guide-steps" aria-label="Pipeline steps">
      {steps.map((step, index) => <li key={step.title}>
        <button type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{step.title}</button>
      </li>)}
    </ol>
    <div className="guide-detail" aria-live="polite">
      <h3>{stage.title}</h3>
      <p className="guide-tools">{stage.tools}</p>
      <p>{stage.description}</p>
      {lane === "question" && <div className="guide-worked-example">
        <p className="guide-question"><strong>Question</strong> {routerQuestion}</p>
        {selected === 1 && <p className="guide-prompt">Answer the question using the supplied passage. If the passage is insufficient, say what is missing.</p>}
        <TraceQuote trace={trace}/>
      </div>}
      <CodeLink path={stage.file}>Inspect the implementation</CodeLink>
    </div>
  </>;
}

const chunkSettings = [{ id: "900", label: "Default chunks" }, { id: "360", label: "Shorter chunks" }] as const;
const rankingSettings = [{ id: "vector", label: "Vector order" }, { id: "vector_then_terms", label: "Reorder by terms" }] as const;

function Tradeoffs() {
  const [size, setSize] = useState<typeof chunkSettings[number]["id"]>("900");
  const [ranking, setRanking] = useState<typeof rankingSettings[number]["id"]>("vector");
  const report = recorded.live;
  const run = report.runs.find(entry => entry.id === `${size}-${ranking}`)!;
  return <>
    <p>Overlap keeps text near boundaries. Shorter chunks can give the model more focused evidence while increasing the number of entries to index. Try the settings from the archived Gemini-embedding experiment.</p>
    <Choices label="Chunk size" options={chunkSettings} active={size} choose={setSize}/>
    <Choices label="Ranking order" options={rankingSettings} active={ranking} choose={setRanking}/>
    <div className="guide-detail" aria-live="polite">
      <h3>{run.chunkSize} characters with up to {run.overlap} overlap</h3>
      <dl className="guide-metrics">
        <div><dt>Expected passage in the first {report.topK} results</dt><dd>{run.hits} of {report.questions} questions</dd></div>
        <div><dt>Indexed chunks</dt><dd>{run.chunks}</dd></div>
        <div><dt>Mean characters returned</dt><dd>{run.meanContextChars.toLocaleString("en-US")}</dd></div>
      </dl>
      <p>Reordering sorts the same candidates locally without another model call. Character count shows how much text retrieval returned. Complete request time and billed cost are still unmeasured.</p>
      <CodeLink path="docs/tradeoffs.md">See the component tradeoffs</CodeLink>
    </div>
  </>;
}

const components = [
  { id: "chunking", label: replacementExamples.chunking.label },
  { id: "ranking", label: replacementExamples.ranking.label },
  { id: "embeddings", label: replacementExamples.embeddings.label },
] as const;

function Adaptation() {
  const [component, setComponent] = useState<keyof typeof replacementExamples>("chunking");
  const example = replacementExamples[component];
  return <>
    <p>Pick one component to change. Keep the other settings fixed so the comparison can tell you what helped.</p>
    <Choices label="Component to replace" options={components} active={component} choose={setComponent}/>
    <div className="guide-detail" aria-live="polite">
      <ol className="guide-checklist">
        <li><strong>Change one part</strong><span>{example.change}</span></li>
        <li><strong>Hold the inputs steady</strong><span>{example.keep}</span></li>
        <li><strong>Measure and decide</strong><span>{example.check}</span></li>
      </ol>
      <CodeLink path={example.file}>Inspect this boundary</CodeLink>
    </div>
  </>;
}

const evaluationModes = [{ id: "live", label: "Archived Gemini" }, { id: "mock", label: "Offline mock" }] as const;
const claims = [
  { id: "forward", text: "A router forwards packets between networks.", supported: true },
  { id: "shortest", text: "A router always selects the shortest route.", supported: false },
] as const;

function Evaluation({ trace }: { trace: TraceState }) {
  const [mode, setMode] = useState<keyof typeof recorded>("live");
  const [selected, setSelected] = useState(0);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const claim = claims[selected] ?? claims[0];
  const report = recorded[mode];
  return <>
    <p>Retrieval evaluation asks whether the expected passage was found. Answer evaluation asks whether the response answers the question and whether the cited text supports its claims.</p>
    <Choices label="Recorded evaluation mode" options={evaluationModes} active={mode} choose={setMode}/>
    <div className="guide-table">
      <table>
        <caption>{report.questions} labelled questions across {report.documents} notes</caption>
        <thead><tr><th scope="col">Chunk setting</th><th scope="col">Order</th><th scope="col">Hit@{report.topK}</th></tr></thead>
        <tbody>{report.runs.map(run => <tr key={run.id}>
          <th scope="row">{run.chunkSize}/{run.overlap}</th>
          <td>{run.ranking === "vector" ? "Vector" : "Then terms"}</td><td>{run.hits}/{report.questions}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="guide-note">The author wrote these cases and used them to inspect the settings. The next test needs unseen notes and a separate review of answer claims.</p>
    <div className="guide-detail">
      <h3>Does the quote support the claim?</h3>
      <TraceQuote trace={trace}/>
      <p className="guide-question"><strong>Claim</strong> {claim.text}</p>
      <div className="guide-choices" role="group" aria-label="Claim verdict">
        <button type="button" aria-pressed={verdict === true} disabled={trace.status !== "ready"} onClick={() => setVerdict(true)}>Supported</button>
        <button type="button" aria-pressed={verdict === false} disabled={trace.status !== "ready"} onClick={() => setVerdict(false)}>Needs more evidence</button>
      </div>
      {verdict !== null && <p className="guide-feedback" role="status">
        {verdict === claim.supported ? "Correct. " : "Look at what the passage actually says. "}
        {claim.supported ? "The quote states the claim directly." : "The quote describes forwarding. It gives no rule for choosing the shortest route."}
      </p>}
      <button className="guide-plain" type="button" onClick={() => { setSelected(1 - selected); setVerdict(null); }}>Try another claim<ArrowRight size={15}/></button>
    </div>
    <CodeLink path="docs/evaluation.md">Read the full evaluation</CodeLink>
  </>;
}

const deployments = [{ id: "replay", label: "Recorded showcase" }, { id: "workspace", label: "Local workspace" }] as const;

function Production() {
  const [mode, setMode] = useState<typeof deployments[number]["id"]>("replay");
  return <>
    <p>The showcase uses public samples. The local workspace handles the owner’s notes. Switch modes here to see where the data goes.</p>
    <Choices label="Deployment modes" options={deployments} active={mode} choose={setMode}/>
    <div className="guide-detail" aria-live="polite">
      <h3>{mode === "replay" ? "Runs in this browser" : "Runs on the owner’s machine"}</h3>
      {mode === "replay" ? <p>React and Vite serve the recorded trace. Suggested answers come from the trace. Typed questions find matching text locally. The drop handler reads no personal files and the demo makes no provider calls.</p>
        : <p>FastAPI and Docker can serve the single-owner workspace. Mock mode stays local. Live mode sends text to Gemini or OpenAI for embeddings, concept extraction and answers. An optional owner token and request limits guard the API.</p>}
      <p className="guide-note">The workspace has health, logs and ingestion events. A shared service would need tenant isolation, monitoring, request latency and provider cost measurements.</p>
      <CodeLink path="docs/deployment.md">Read the deployment boundaries</CodeLink>
    </div>
  </>;
}

export default function RagGuide({ onBack, onTry }: { onBack: () => void; onTry: () => void }) {
  const [topic, setTopic] = useState<Topic>("pipeline");
  const [trace, setTrace] = useState<TraceState>({ status: "loading" });
  const heading = useRef<HTMLHeadingElement>(null);
  const current = guideTopics.find(chapter => chapter.id === topic) ?? guideTopics[0];

  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
    let active = true;
    void loadSample("computer-networks").then(recording => {
      const prompt = recording.prompts.find(entry => entry.question === routerQuestion);
      if (active) setTrace(prompt?.answer.citations.length ? { status: "ready", prompt } : { status: "unavailable" });
    }).catch(() => { if (active) setTrace({ status: "unavailable" }); });
    return () => { active = false; };
  }, []);

  return <div className="guide-shell">
    <header className="guide-header">
      <button type="button" className="guide-plain" onClick={onBack}><ArrowLeft size={17}/>Back to replay</button>
      <button type="button" className="guide-action" disabled={trace.status !== "ready"} onClick={onTry}>Open the router example<ArrowRight size={17}/></button>
    </header>
    <main className="guide-main">
      <div className="guide-intro">
        <h1 tabIndex={-1} ref={heading}>How Grasp works</h1>
        <p>Follow one question from a student’s notes to the passage behind the answer.</p>
      </div>
      <div className="guide-layout">
        <nav className="guide-topics" aria-label="Walkthrough topics">
          {guideTopics.map(chapter => <button type="button" key={chapter.id} aria-current={topic === chapter.id ? "true" : undefined}
            onClick={() => setTopic(chapter.id)}>{chapter.label}</button>)}
        </nav>
        <section className="guide-lesson" aria-labelledby="guide-lesson-title">
          <h2 id="guide-lesson-title">{current.title}</h2>
          {topic === "pipeline" && <Pipeline trace={trace}/>}
          {topic === "tradeoffs" && <Tradeoffs/>}
          {topic === "adapt" && <Adaptation/>}
          {topic === "evaluation" && <Evaluation trace={trace}/>}
          {topic === "production" && <Production/>}
        </section>
      </div>
      <footer className="guide-footer">
        <CodeLink path="docs/course-walkthrough.md">Course notes and sources</CodeLink><CodeLink path="docs/interview-talk-track.md">Interview answers</CodeLink>
      </footer>
    </main>
  </div>;
}
