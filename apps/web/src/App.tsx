import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
const ForceGraph3D = lazy(() => import('react-force-graph-3d'));
import type { ForceGraphMethods } from 'react-force-graph-3d';
import { Orbit, Upload, BookOpen, MessageCircle, RotateCcw } from 'lucide-react';
import { useStudyGraph } from './study-store';
import type { GraphNode, Chunk, ChatResponse, Progress, QuizResponse as Quiz } from './types/contracts';
type Graph = import('./study-store').StudyGraph;
async function request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch('/api' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(String(error.detail || 'Request failed.'));
    }
    return response.json() as Promise<T>;
}
export function App() {
    const { graph, setGraph } = useStudyGraph();
    const [selected, setSelected] = useState<GraphNode | null>(null);
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const [tab, setTab] = useState<'source' | 'chat' | 'quiz'>('source');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState<ChatResponse | null>(null);
    const [highlight, setHighlight] = useState<string[]>([]);
    const [quote, setQuote] = useState('');
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [answers, setAnswers] = useState<number[]>([-1, -1, -1]);
    const [grade, setGrade] = useState<{
        score: number;
        passed: boolean;
        correctAnswers: number[];
    } | null>(null);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('Connecting to local workspace');
    const [size, setSize] = useState({ width: 700, height: 600 });
    const [sourceLoading, setSourceLoading] = useState(false);
    const [names, setNames] = useState<Record<string, string>>({});
    const [mode, setMode] = useState('mock');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [pulse, setPulse] = useState(0);
    useEffect(() => { if (reduced)
        return; const timer = setInterval(() => setPulse(Date.now() / 400), 120); return () => clearInterval(timer); }, [reduced]);
    const selection = useRef(0);
    const host = useRef<HTMLDivElement>(null);
    const streams = useRef<Set<EventSource>>(new Set());
    async function refresh() {
        const [data, p] = await Promise.all([request<Graph>('/graph'), request<Progress>('/progress')]);
        const docs = await request<{
            documents: {
                id: string;
                name: string;
            }[];
        }>('/documents');
        setNames(Object.fromEntries(docs.documents.map(d => [d.id, d.name])));
        const health = await request<{
            llm: {
                provider: string;
            };
        }>('/health');
        setMode(health.llm.provider);
        setGraph(data);
        setProgress(p);
        setStatus('Local workspace ready');
        setSelected(old => old ? data.nodes.find(n => n.id === old.id) || null : null);
    }
    useEffect(() => { void refresh().catch(e => setError(String(e))); return () => streams.current.forEach(s => s.close()); }, []);
    useEffect(() => { if (!host.current)
        return; const observer = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (rect)
        setSize({ width: rect.width, height: rect.height }); }); observer.observe(host.current); return () => observer.disconnect(); }, []);
    async function choose(node: GraphNode) {
        const version = ++selection.current;
        setChunks([]);
        setSourceLoading(true);
        setSelected(node);
        setTab('source');
        setQuote('');
        setQuiz(null);
        setGrade(null);
        const results = await Promise.all(node.docIds.map(id => request<{
            chunks: Chunk[];
        }>(`/documents/${id}/chunks`))).catch(error=>{if(version===selection.current)setSourceLoading(false);throw error;});
        if (version !== selection.current)
            return;
        setSourceLoading(false);
        document.querySelector('.study-panel')?.scrollIntoView({ block: 'nearest' });
        setChunks(results.flatMap(r => r.chunks).filter(c => node.sourceChunkIds.includes(c.id)));
        await request('/nodes/explore', { nodeId: node.id });
        await refresh();
    }
    async function upload(file: File) {
        setError('');
        setStatus('Uploading ' + file.name);
        const form = new FormData();
        form.append('file', file);
        const response = await fetch('/api/documents', { method: 'POST', body: form });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail);
        }
        const document = await response.json() as {
            id: string;
        };
        await new Promise<void>((resolve, reject) => {
            const stream = new EventSource(`/api/documents/${document.id}/events`);
            streams.current.add(stream);
            const timeout = setTimeout(() => { close(); reject(new Error('Processing took too long. Refresh to check document status.')); }, 180000);
            const close = () => { clearTimeout(timeout); stream.close(); streams.current.delete(stream); };
            stream.addEventListener('status', event => setStatus((JSON.parse((event as MessageEvent).data) as {
                message: string;
            }).message));
            stream.addEventListener('node', event => { const n = JSON.parse((event as MessageEvent).data).node as GraphNode; setGraph(g => ({ ...g, nodes: [...g.nodes.filter(old => old.id !== n.id), n] })); });
            stream.addEventListener('edge', event => { const edge = JSON.parse((event as MessageEvent).data).edge as import('./types/contracts').GraphEdge; setGraph(g => ({ ...g, edges: [...g.edges.filter(old => old.id !== edge.id), edge] })); });
            stream.addEventListener('complete', () => { close(); resolve(); });
            stream.addEventListener('error', event => { if (event instanceof MessageEvent) {
                close();
                reject(new Error(JSON.parse(event.data).message));
            }
            else {
                close();
                reject(new Error('Connection interrupted. Refresh to reload stored results.'));
            } });
        });
        await refresh();
    }
    async function run(action: () => Promise<void>) { setBusy(true); setError(''); try {
        await action();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } }
    async function demo() { await request('/demo', {}); await refresh(); }
    const graphRef=useRef<ForceGraphMethods>();
    const fitted=useRef(-1);
    const cache = useRef(new Map<string, GraphNode>());
    const data = useMemo(() => ({ nodes: graph.nodes.map(n => { const old = cache.current.get(n.id); const value = old ? Object.assign(old, n) : { ...n }; cache.current.set(n.id, value); return value; }), links: graph.edges.map(e => ({ ...e })) }), [graph]);
    return <div className="study-app">

    <header className="study-header"><div className="study-brand"><Orbit size={23}/><strong>Study space</strong><span>Knowledge canvas</span></div><div className="header-actions"><button onClick={() => void run(demo)} disabled={busy}><BookOpen size={16}/> Sample graph</button><label className="upload-control"><Upload size={16}/> Add notes<input aria-label="Upload notes" type="file" accept=".pdf,.md,.txt" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file)
        void run(() => upload(file)); e.target.value = ''; }}/></label></div></header>

    <div className="study-layout"><aside className="concept-library"><h2>Your concepts <span>{graph.nodes.length}</span></h2><p>Follow an idea back to its source.</p><div className="concept-list">{graph.nodes.map(n => <button key={n.id} aria-current={selected?.id === n.id ? 'true' : undefined} className={selected?.id === n.id ? 'chosen' : ''} onClick={() => void run(() => choose(n))}><i className={n.masteryState}/><span>{n.label}</span>{n.docIds.length > 1 && <small>{n.docIds.length} sources</small>}</button>)}</div><div className="coverage"><strong>{progress?.masteredCount || 0} mastered</strong><span>{progress?.exploredCount || 0} of {progress?.totalNodes || 0} explored</span><progress aria-label="Concept coverage" max="100" value={progress?.coveragePercent || 0}/><small>{progress?.crossDocLinks || 0} cross-document connections</small></div></aside>

    <main className="graph-space" ref={host}><div className="graph-caption"><span>Connections in your notes</span><small>Drag to orbit · Scroll to zoom · Click a concept</small></div>{graph.nodes.length ? <Suspense fallback={<p>Loading the 3D canvas · </p>}><ForceGraph3D ref={graphRef} onEngineStop={()=>{if(fitted.current!==graph.nodes.length){graphRef.current?.zoomToFit(reduced?0:700,50);fitted.current=graph.nodes.length;}}} width={size.width} height={size.height} graphData={data} backgroundColor="#0b1119" showNavInfo={false} nodeLabel="label" nodeResolution={20} nodeVal={n => highlight.includes(String(n.id)) ? 14 + (reduced ? 0 : Math.sin(pulse) * 4) : 5} nodeColor={n => n.masteryState === 'mastered' ? '#d9b66f' : highlight.includes(String(n.id)) ? '#e7fff9' : n.masteryState === 'learning' ? '#8ddbcf' : '#526c82'} nodeOpacity={.9} linkColor={() => '#3e6671'} linkWidth={.7} linkLabel="relationshipLabel" cooldownTicks={reduced ? 0 : 100} warmupTicks={reduced ? 100 : 0} linkDirectionalParticles={reduced ? 0 : 1} linkDirectionalParticleSpeed={.002} onNodeClick={n => void run(() => choose(n as GraphNode))} enableNodeDrag/></Suspense> : <div className="graph-empty"><Orbit size={48}/><h1>Find the connections<br />in your notes.</h1><p>Add a document or start with the sample.</p><button onClick={() => void run(demo)}>Open sample graph</button></div>}<div className="graph-status" role="status">{busy ? 'Working · ' : ''}{status}<button aria-label="Refresh workspace" onClick={() => void run(refresh)}><RotateCcw size={15}/></button></div></main>

    <aside className="study-panel"><nav>{(['source', 'chat', 'quiz'] as const).map(t => <button key={t} aria-pressed={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t === 'source' ? 'Source notes' : t === 'chat' ? 'Ask your notes' : 'Check understanding'}</button>)}</nav><div className="study-panel-body">{error && <p role="alert" className="request-error">{error}</p>}

    {tab === 'source' && <>{quote ? <><h2>Cited passage</h2><blockquote>{quote}</blockquote><button onClick={() => setQuote('')}>Back to concept</button></> : selected ? <><span className="state-label">{selected.masteryState}</span><h1>{selected.label}</h1><p>{selected.summary}</p><h3>Source passages</h3>{sourceLoading && <p role='status'>Loading source passages · </p>}{chunks.map(c => <article key={c.id}><small>{names[c.docId] || 'Document'} · Page {c.page}</small><blockquote>{c.text}</blockquote></article>)}<h3>Related concepts</h3>{graph.edges.filter(e => e.source === selected.id || e.target === selected.id).map(e => { const n = graph.nodes.find(n => n.id === (e.source === selected.id ? e.target : e.source)); return n && <button key={e.id} onClick={() => void run(() => choose(n))}>{n.label} →</button>; })}</> : <div className="panel-welcome"><BookOpen size={30}/><h2>Every idea has a source.</h2><p>Select a concept to read its passages, explore related ideas or check your understanding.</p><small>{mode === 'mock' ? 'Deterministic mock mode  ·  No API key needed' : `${mode} provider enabled`}</small></div>}</>}

    {tab === 'chat' && <><MessageCircle size={26}/><h2>Ask your notes</h2><p>{mode==='mock'?'Mock mode shows retrieved source excerpts. Configure a provider for generated answers.':'Answers cite passages from your uploaded documents.'}</p><form onSubmit={e => { e.preventDefault(); void run(async () => { const result = await request<ChatResponse>('/chat', { question }); setAnswer(result); setHighlight(result.referencedNodeIds); await refresh(); }); }}><label htmlFor="question">Your question</label><textarea id="question" value={question} onChange={e => setQuestion(e.target.value)} required placeholder="How does retrieval practice help learning?"/><button disabled={busy || !question.trim()}>Find an answer</button></form>{answer && <article><p className="answer-text">{answer.answer}</p>{answer.citations.map((c, i) => <button key={c.chunkId} onClick={() => { setQuote(`${names[c.docId] || 'Document'}  ·  Page ${c.page}\n\n${c.quote}`); setTab('source'); }}>Source {i + 1} · {names[c.docId] || 'Document'} · Page {c.page} ↗</button>)}</article>}</>}

    {tab === 'quiz' && <><h2>Check understanding</h2><p>{selected ? `Three questions using ${selected.label} and its source context.` : 'Choose a concept on the canvas first.'}</p><button disabled={!selected || busy} onClick={() => void run(async () => { setQuiz(await request<Quiz>('/quiz', { nodeId: selected!.id })); setAnswers([-1, -1, -1]); setGrade(null); })}>Start a quiz</button>{quiz && <form onSubmit={e => { e.preventDefault(); void run(async () => { setGrade(await request('/quiz/grade', { attemptId: quiz.attemptId, answers })); await refresh(); }); }}>{quiz.questions.map((q, i) => <fieldset key={i}><legend>{i + 1}. {q.question}</legend>{q.options.map((option, j) => <label key={j}><input type="radio" name={`q${i}`} checked={answers[i] === j} disabled={!!grade} onChange={() => setAnswers(old => old.map((v, k) => k === i ? j : v))}/>{option}</label>)}{grade && <small>Correct answer: {q.options[grade.correctAnswers[i]!]}</small>}</fieldset>)}<button disabled={busy || answers.includes(-1) || !!grade}>Submit answers</button></form>}{grade && <p role="status">{grade.score}/3 · {grade.passed ? 'Concept mastered.' : 'Keep learning and try a new quiz.'}</p>}</>}

    </div></aside></div><footer className="study-footer">{mode === 'mock' ? 'Mock mode  ·  Notes stay on this computer.' : `${mode} mode  ·  Selected text is sent to your provider.`} <a href="https://github.com/stanbang/Grasp">View project ↗</a></footer></div>;
}
