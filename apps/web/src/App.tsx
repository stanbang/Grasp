import { useEffect, useRef, useState } from 'react';
import { ArrowUp, FolderOpen, Orbit, Paperclip, Plus, Settings } from 'lucide-react';
import { Mindmap } from './Mindmap';
import { ConceptView, SourceView, WorkspaceSettings } from './WorkspaceDialogs';
import { api, apiFetch, ApiError, documentEvents, setAccessToken } from './client';
import { droppedFiles, isSupportedNote, installFileDropHandlers } from './folder-upload';
import { useStudyGraph } from './study-store';
import type { ChatResponse, Citation, GraphResponse } from './types/contracts';
type Turn = {
    id: number;
    question: string;
    response: ChatResponse;
    createdAt: string;
};
type Conversation = {
    id: string;
    title: string;
};
function savedConversation(): string | null { try {
    return localStorage.getItem('grasp-conversation');
}
catch {
    return null;
} }
export function App() {
    const { graph, setGraph } = useStudyGraph();
    const [started, setStarted] = useState(false);
    const [question, setQuestion] = useState('');
    const [turns, setTurns] = useState<Turn[]>([]);
    const [conversation, setConversation] = useState<string | null>(savedConversation);
    const [busy, setBusy] = useState(false);
    const [reading, setReading] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);
    const [mode, setMode] = useState('mock');
    const [highlight, setHighlight] = useState<string[]>([]);
    const [scope, setScope] = useState<string[]>([]);
    const [citation, setCitation] = useState<Citation | null>(null);
    const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
    const [settings, setSettings] = useState(false);
    const [locked, setLocked] = useState(false);
    const [token, setToken] = useState('');
    const [readyCount, setReadyCount] = useState(0);
    const generation = useRef(0);
    const [scopeEmpty, setScopeEmpty] = useState(false);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const folderInput = useRef<HTMLInputElement>(null);
    const importLock = useRef(false);
    const controllers = useRef(new Set<AbortController>());
    const latestDrop = useRef<(transfer: DataTransfer) => Promise<void>>(async () => { });
    const thread = useRef<HTMLDivElement>(null);
    function remember(id: string | null) { setConversation(id); try {
        if (id)
            localStorage.setItem('grasp-conversation', id);
        else
            localStorage.removeItem('grasp-conversation');
    }
    catch { /* Private browsing can deny storage; the server conversation still works. */ } }
    function failure(value: unknown) { if (value instanceof ApiError && value.status === 401)
        setLocked(true); setError(value instanceof Error ? value.message : String(value)); }
    async function refresh() { const [data, health] = await Promise.all([api<GraphResponse>('/graph'), api<{
            llm: {
                provider: string;
            };
        }>('/health')]); setGraph(data); setMode(health.llm.provider); }
    async function openConversation(id: string) { generation.current++; setScopeEmpty(false); const result = await api<{
        turns: Turn[];
    }>(`/conversations/${id}`); remember(id); setTurns(result.turns); setStarted(true); setScope([]); }
    useEffect(() => { folderInput.current?.setAttribute('webkitdirectory', ''); void refresh().then(async () => { const saved = savedConversation(); if (saved) {
        try {
            await openConversation(saved);
        }
        catch (e) {
            if (e instanceof ApiError && e.status === 404)
                remember(null);
            else
                throw e;
        }
    } }).catch(failure); return () => controllers.current.forEach(c => c.abort()); }, []);
    useEffect(() => { if (started)
        textarea.current?.focus(); }, [started]);
    useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: 'instant' }); }, [turns, busy]);
    useEffect(() => installFileDropHandlers(window, transfer => { void latestDrop.current(transfer); }, setDragging), []);
    async function importFiles(files: File[], readErrors: string[] = []) {
        if (busy) {
            setError('Wait for the current answer before adding files.');
            return;
        }
        if (importLock.current) {
            setError('Wait for the current files to finish.');
            return;
        }
        const notes = files.filter(isSupportedNote);
        if (!notes.length) {
            setError(readErrors.join(' ') || 'Drop a PDF, Markdown or TXT document.');
            return;
        }
        generation.current++;
        setScopeEmpty(false);
        importLock.current = true;
        setReading(true);
        setStarted(true);
        setError('');
        setTurns([]);
        remember(null);
        setScope([]);
        setReadyCount(0);
        let failures = readErrors.length;
        const imported: string[] = [];
        try {
            for (const [index, file] of notes.entries()) {
                setStatus(`Reading files ${index + 1} of ${notes.length}`);
                const controller = new AbortController();
                controllers.current.add(controller);
                try {
                    const form = new FormData();
                    form.append('file', file);
                    const response = await apiFetch('/documents', { method: 'POST', body: form, signal: controller.signal });
                    const document = await response.json() as {
                        id: string;
                    };
                    await documentEvents(document.id, event => { if (event.type === 'node' && event.node) {
                        const node = event.node;
                        setGraph(old => ({ ...old, nodes: [...old.nodes.filter(n => n.id !== node.id), node] }));
                    } if (event.type === 'edge' && event.edge) {
                        const edge = event.edge;
                        setGraph(old => ({ ...old, edges: [...old.edges.filter(e => e.id !== edge.id), edge] }));
                    } }, controller.signal);
                    imported.push(document.id);
                    setScope([...imported]);
                    setReadyCount(imported.length);
                    await refresh();
                }
                catch (e) {
                    failures++;
                    failure(e);
                }
                finally {
                    controllers.current.delete(controller);
                }
            }
            setStatus(`${imported.length} of ${notes.length} files ready`);
            setScopeEmpty(imported.length === 0);
            if (failures)
                setError(`${failures} files or folder entries could not be read. ${imported.length ? 'Ready sources are available; drop the failed files again to retry.' : 'No sources were imported. Drop a readable document to retry.'}`);
        }
        finally {
            importLock.current = false;
            setReading(false);
        }
    }
    latestDrop.current = async (transfer) => { try {
        const result = await droppedFiles(transfer);
        await importFiles(result.files, result.errors);
    }
    catch (e) {
        failure(e);
    } };
    async function ask() { if (busy || !question.trim() || (reading && readyCount === 0) || scopeEmpty)
        return; const requestGeneration = generation.current; const draft = question; setBusy(true); setError(''); const value = question.trim(); try {
        let id = conversation;
        if (!id) {
            const created = await api<Conversation>('/conversations', {});
            id = created.id;
            remember(id);
        }
        const response = await api<ChatResponse>('/chat', { question: value, conversationId: id, docIds: scope });
        if (requestGeneration !== generation.current)
            return;
        setTurns(old => [...old, { id: Date.now(), question: value, response, createdAt: new Date().toISOString() }]);
        setQuestion(current => current === draft ? '' : current);
        setHighlight(response.referencedNodeIds);
        await refresh();
    }
    catch (e) {
        failure(e);
    }
    finally {
        setBusy(false);
        textarea.current?.focus();
    } }
    async function demo() { setBusy(true); try {
        await api('/demo', {});
        await refresh();
        setStarted(true);
        remember(null);
        setTurns([]);
        setScope([]);
    }
    catch (e) {
        failure(e);
    }
    finally {
        setBusy(false);
    } }
    return <div className={`minimal-workspace ${started ? 'question-open' : 'entry-open'}`}><Mindmap graph={graph} highlight={highlight} onSelect={id => { setSelectedConcept(id); void api('/nodes/explore', {nodeId: id}).then(refresh).catch(failure); }}/><header className="minimal-header"><span><Orbit size={23}/> Study space</span><div><button aria-label="Add files" onClick={() => fileInput.current?.click()} disabled={reading || busy}><Paperclip size={18}/></button><button aria-label="Choose folder" onClick={() => folderInput.current?.click()} disabled={reading || busy}><FolderOpen size={18}/></button>{started && <button aria-label="New conversation" disabled={busy || reading} onClick={() => { generation.current++; setScopeEmpty(false); remember(null); setTurns([]); setQuestion(''); setScope([]); textarea.current?.focus(); }}><Plus size={18}/></button>}<button aria-label="Workspace options" disabled={busy || reading} onClick={() => setSettings(true)}><Settings size={18}/></button></div></header>
    <input ref={fileInput} className="hidden-file" tabIndex={-1} aria-label="Select files" type="file" multiple accept=".pdf,.md,.txt" onChange={e => { void importFiles(Array.from(e.target.files || [])); e.target.value = ''; }}/><input ref={folderInput} className="hidden-file" tabIndex={-1} aria-label="Select folder" type="file" multiple onChange={e => { void importFiles(Array.from(e.target.files || [])); e.target.value = ''; }}/>
    {!started ? <main className="minimal-entry"><Orbit size={34}/><h1>drop folder to get started</h1><p>Drop a file or folder here.<br />Your mindmap and questions stay on this page.</p><button onClick={() => fileInput.current?.click()}>Choose a file</button><small>PDF · Markdown · TXT</small><div><button disabled={busy} onClick={() => void demo()}>Try the sample</button>{graph.nodes.length > 0 && <button onClick={() => setStarted(true)}>Continue with saved notes</button>}</div>{error && <p role="alert" className="minimal-error">{error}</p>}</main> : <main className="question-stage"><section className="question-card" aria-label="Document questions">{(turns.length > 0 || busy) && <div className="conversation-thread" ref={thread} aria-live="polite">{turns.map(turn => <article key={turn.id}><h2>{turn.question}</h2><p>{turn.response.answer}</p><div className="source-buttons">{turn.response.citations.map((source, index) => <button key={source.chunkId} onClick={() => setCitation(source)}>Source {index + 1} · p{source.page}</button>)}</div></article>)}{busy && <p role="status">Reading the relevant passages…</p>}</div>}<form onSubmit={e => { e.preventDefault(); void ask(); }}><label htmlFor="question">what question would you like to ask</label><div className="composer"><textarea ref={textarea} id="question" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about your documents…" maxLength={2000} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void ask();
    } }}/><button aria-label="Ask question" disabled={busy || !question.trim() || (reading && readyCount === 0) || scopeEmpty}><ArrowUp size={19}/></button></div></form>{status && <p className="import-status" role="status">{status}</p>}{error && <p role="alert" className="minimal-error">{error}</p>}</section></main>}
    {dragging && <div className="drop-indicator"><Paperclip size={32}/><span>Drop here to ask your documents</span></div>}<footer className="minimal-footer">{mode === 'mock' ? 'Offline mock · Responses show retrieved excerpts' : `${mode} · Answers use your selected sources`}</footer>
    {selectedConcept && graph.nodes.some(node => node.id === selectedConcept) && <ConceptView node={graph.nodes.find(node => node.id === selectedConcept)!} graph={graph} onSelect={setSelectedConcept} onClose={() => setSelectedConcept(null)} onSource={source => {setSelectedConcept(null); setCitation(source); }}/>}{citation && <SourceView citation={citation} onClose={() => setCitation(null)}/>} {settings && <WorkspaceSettings onClose={() => setSettings(false)} onRefresh={refresh} onConversation={openConversation} onConversationRemoved={id => { if (id === conversation) {
        generation.current++;
        remember(null);
        setTurns([]);
    } }} onDocumentChanged={(oldId, newId) => { generation.current++; if (scope.includes(oldId)) {
        const next = scope.filter(id => id !== oldId);
        if (newId)
            next.push(newId);
        setScope(next);
        setScopeEmpty(next.length === 0);
        if (!next.length)
            setError('The active source was removed. Add notes or start a new conversation to use the remaining workspace.');
    } }}/>}
    {locked && <div className="access-gate"><form onSubmit={e => { e.preventDefault(); setAccessToken(token); void refresh().then(async () => { if (conversation)
        await openConversation(conversation); setLocked(false); setError(''); }).catch(failure); }}><h2>Open your workspace</h2><label htmlFor="access-token">Workspace access token</label><input id="access-token" type="password" value={token} onChange={e => setToken(e.target.value)} required/><button>Unlock</button>{error && <p role="alert">{error}</p>}</form></div>}
    </div>;
}
