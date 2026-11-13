import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { api, apiFetch, remove } from './client';
import type { Citation, PageResponse, DocumentsResponse, GraphResponse, GraphNode, Chunk, ChunksResponse, QuizResponse, GradeResponse } from './types/contracts';

export function ConceptView({ node, graph, onSelect, onSource, onClose }: {
    node: GraphNode; graph: GraphResponse; onSelect: (id: string) => void;
    onSource: (citation: Citation) => void; onClose: () => void;
}) {
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        setChunks([]);
        setError('');
        void Promise.all(node.docIds.map(id => api<ChunksResponse>(`/documents/${id}/chunks`)))
            .then(results => { if (active) setChunks(results.flatMap(result => result.chunks).filter(chunk => node.sourceChunkIds.includes(chunk.id))); })
            .catch(() => { if (active) setError('The source passages could not be loaded.'); });
        return () => { active = false; };
    }, [node.id, node.sourceChunkIds]);
    const related = new Set(graph.edges.filter(edge => edge.source === node.id || edge.target === node.id).flatMap(edge => [edge.source, edge.target]));
    return <Modal title={node.label} onClose={onClose}>
        <p>{node.summary}</p><p className="quiet">{node.masteryState}</p>
        {error && <p role="alert">{error}</p>}
        {chunks.map(chunk => <div key={chunk.id}><blockquote>{chunk.text}</blockquote><button onClick={() => onSource({chunkId: chunk.id, docId: chunk.docId, page: chunk.page, quote: chunk.text})}>Read source · page {chunk.page}</button></div>)}
        <h3>Related concepts</h3><div className="source-buttons">{graph.nodes.filter(other => other.id !== node.id && related.has(other.id)).map(other => <button key={other.id} onClick={() => onSelect(other.id)}>{other.label}</button>)}</div>
    </Modal>;
}
export function Modal({ title, onClose, children }: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => { dialog.current?.showModal(); const element = dialog.current; return () => element?.close(); }, []);
    return <dialog ref={dialog} className="workspace-dialog" onCancel={onClose} aria-label={title}><header><h2>{title}</h2><button aria-label="Close dialog" onClick={onClose}><X size={18}/></button></header>{children}</dialog>;
}
export function SourceView({ citation, onClose }: {
    citation: Citation;
    onClose: () => void;
}) {
    const [page, setPage] = useState<PageResponse | null>(null);
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    useEffect(() => { let active = true; let objectUrl = ''; void api<PageResponse>(`/documents/${citation.docId}/pages/${citation.page}`).then(value => { if (active)
        setPage(value); }).catch(() => { if (active)
        setError('The source has been removed. The cited quote below is preserved with the conversation.'); }); void apiFetch(`/documents/${citation.docId}/original`).then(async (response) => { if (response.headers.get('content-type')?.includes('pdf')) {
        objectUrl = URL.createObjectURL(await response.blob());
        if (active)
            setUrl(objectUrl);
        else
            URL.revokeObjectURL(objectUrl);
    } }).catch(() => { }); return () => { active = false; if (objectUrl)
        URL.revokeObjectURL(objectUrl); }; }, [citation]);
    const index = page?.text.indexOf(citation.quote) ?? -1;
    return <Modal title={`Source · page ${citation.page}`} onClose={onClose}>{error && <p role="status">{error}</p>}{url && <iframe title="Original PDF page" src={`${url}#page=${citation.page}`} className="source-pdf"/>}<blockquote>{citation.quote}</blockquote>{page && <details><summary>Extracted page with highlighted citation</summary><pre>{index >= 0 ? <>{page.text.slice(0, index)}<mark>{citation.quote}</mark>{page.text.slice(index + citation.quote.length)}</> : page.text}</pre></details>}</Modal>;
}
function LearningCheck({ onRefresh }: {
    onRefresh: () => Promise<void>;
}) {
    const [nodes, setNodes] = useState<GraphResponse['nodes']>([]);
    const [selected, setSelected] = useState('');
    const [quiz, setQuiz] = useState<QuizResponse | null>(null);
    const [answers, setAnswers] = useState([-1, -1, -1]);
    const [result, setResult] = useState<GradeResponse | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { void api<GraphResponse>('/graph').then(graph => setNodes(graph.nodes)).catch(e => setError(String(e))); }, []);
    async function generate() { setBusy(true); setError(''); try {
        setQuiz(await api<QuizResponse>('/quiz', { nodeId: selected }));
        setAnswers([-1, -1, -1]);
        setResult(null);
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } }
    async function submit() { if (!quiz)
        return; setBusy(true); setError(''); try {
        setResult(await api<GradeResponse>('/quiz/grade', { attemptId: quiz.attemptId, answers }));
        await onRefresh();
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } }
    return <details><summary>Check understanding</summary><label htmlFor="quiz-concept">Concept</label><select id="quiz-concept" value={selected} onChange={e => { setSelected(e.target.value); setQuiz(null); setResult(null); }}><option value="">Choose a concept</option>{nodes.map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select><button disabled={!selected || busy} onClick={() => void generate()}>Start three questions</button>{error && <p role="alert">{error}</p>}{quiz && <form onSubmit={e => { e.preventDefault(); void submit(); }}>{quiz.questions.map((question, i) => <fieldset key={i}><legend>{question.question}</legend>{question.options.map((option, j) => <label className="quiz-option" key={j}><input type="radio" name={'answer' + i} checked={answers[i] === j} disabled={!!result} onChange={() => setAnswers(previous => previous.map((old, k) => k === i ? j : old))}/>{option}</label>)}{result && <p>Correct answer: {question.options[result.correctAnswers[i]!]}</p>}</fieldset>)}<button disabled={busy || answers.includes(-1) || !!result}>Submit</button>{result && <p role="status">{result.score}/3 · {result.passed ? 'Mastered' : 'Keep learning and try again'}</p>}</form>}</details>;
}
export function WorkspaceSettings({ onClose, onRefresh, onConversation, onConversationRemoved, onDocumentChanged }: {
    onClose: () => void;
    onRefresh: () => Promise<void>;
    onConversation: (id: string) => Promise<void>;
    onConversationRemoved: (id: string) => void;
    onDocumentChanged: (oldId: string, newId?: string) => void;
}) {
    const [documents, setDocuments] = useState<DocumentsResponse['documents']>([]);
    const [sessions, setSessions] = useState<{
        id: string;
        title: string;
    }[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState<string | null>(null);
    async function load() { const [docs, conversations] = await Promise.all([api<DocumentsResponse>('/documents'), api<{
            conversations: {
                id: string;
                title: string;
            }[];
        }>('/conversations')]); setDocuments(docs.documents); setSessions(conversations.conversations); }
    useEffect(() => { void load().catch(e => setError(String(e))); }, []);
    async function action(run: () => Promise<void>) { setBusy(true); setError(''); try {
        await run();
        await load();
        await onRefresh();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } }
    return <Modal title="Workspace options" onClose={onClose}>{error && <p role="alert">{error}</p>}<LearningCheck onRefresh={onRefresh}/><h3>Saved conversations</h3>{sessions.map(session => <div className="management-row" key={session.id}><button disabled={busy} onClick={() => void action(async () => { await onConversation(session.id); onClose(); })}>{session.title}</button><button disabled={busy} onClick={() => setConfirm('conversation:' + session.id)}>Remove</button></div>)}<h3>Source management</h3>{documents.map(doc => <div className="management-row" key={doc.id}><span>{doc.name}<small>{doc.status}</small></span><div><button disabled={busy || !['done', 'failed'].includes(doc.status)} onClick={() => void action(async () => { const replacement = await api<DocumentsResponse['documents'][number]>(`/documents/${doc.id}/reindex`, {}); if (replacement.status === 'failed')
        throw new Error('Re-indexing failed; the original document was kept.'); onDocumentChanged(doc.id, replacement.id); })}>Re-index</button><label className="file-action">Replace<input type="file" accept=".pdf,.md,.txt" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file)
        void action(async () => { const form = new FormData(); form.append('file', file); const response = await apiFetch(`/documents/${doc.id}`, { method: 'PUT', body: form }); const replacement = await response.json() as DocumentsResponse['documents'][number]; if (replacement.status === 'failed')
            throw new Error('Replacement failed; the original document was kept.'); onDocumentChanged(doc.id, replacement.id); }); }}/></label><button disabled={busy || !['done', 'failed'].includes(doc.status)} onClick={() => setConfirm('document:' + doc.id)}>Remove</button></div></div>)}{confirm && <section className="confirmation"><p>Remove this {confirm.startsWith('document:') ? 'document and its indexed passages' : 'saved conversation'}? This cannot be undone.</p><button disabled={busy} onClick={() => void action(async () => { const [kind, id] = confirm.split(':'); const removed = await remove(kind === 'document' ? `/documents/${id}` : `/conversations/${id}`); if (id) {
        if (kind === 'document')
            onDocumentChanged(id);
        else
            onConversationRemoved(id);
    } setConfirm(null); if (removed.cleanupPending)
        setError('Removed from the workspace. File/vector cleanup is queued and retried when the API restarts.'); })}>Confirm removal</button><button onClick={() => setConfirm(null)}>Keep it</button></section>}<p className="quiet">Sources and conversations stay on this server. Live mode sends selected passages to the configured AI provider. Scanned PDFs use local OCR when enabled.</p></Modal>;
}
