import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Box, FilePlus2, FolderOpen, Layers3, LayoutPanelTop, MessageSquare, Moon, Presentation, Settings, Sun, Workflow, X } from 'lucide-react';
import { CanvasBoard } from './canvas/CanvasBoard';
import { CanvasInspector } from './canvas/CanvasInspector';
import { ExplorerBoundary } from './canvas/ExplorerBoundary';
import { NewProjectBoard, ProjectCanvas, useProjectDirectory } from './canvas/ProjectCanvas';
import { conceptObjectId, knowledgeScene, type BoardKind, type Card, type SourceSelection } from './canvas/board';
import { engineeringScene } from './canvas/engineering-board';
import { useBoard } from './canvas/use-board';
import { ConceptView, SourceView, WorkspaceSettings } from './WorkspaceDialogs';
import { api, apiFetch, ApiError, documentEvents, setAccessToken } from './client';
import { droppedFiles, isSupportedNote, installFileDropHandlers } from './folder-upload';
import { useStudyGraph } from './study-store';
import { updateUpload, type UploadState } from './upload-state';
import type { ChatResponse, Conversation, Document, DocumentsResponse, GraphResponse, HealthResponse, Turn, Turns } from './types/contracts';

const Mindmap = lazy(() => import('./Mindmap').then(module => ({ default: module.Mindmap })));

function savedConversation(): string | null {
  try { return localStorage.getItem('grasp-conversation'); }
  catch { return null; }
}

function requestedBoard(): BoardKind {
  const board = new URLSearchParams(window.location.search).get('board');
  return board === 'engineering' || board === 'project' ? board : 'knowledge';
}

export function App() {
  const { graph, documents, setLibrary, upsertDocument } = useStudyGraph();
  const knowledge = useBoard('knowledge');
  const engineering = useBoard('engineering');
  const [workspace, setWorkspace] = useState<BoardKind>(requestedBoard);
  const [projectId, setProjectId] = useState(() => new URLSearchParams(window.location.search).get('projectBoard') ?? '');
  const [accessVersion, setAccessVersion] = useState(0);
  const project = useProjectDirectory(workspace === 'project', projectId, accessVersion);
  const [presenting, setPresenting] = useState(false);
  const [render3D, setRender3D] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversation, setConversation] = useState<string | null>(savedConversation);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [reading, setReading] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [provider, setProvider] = useState<HealthResponse['llm']['provider']>();
  const [highlight, setHighlight] = useState<string[]>([]);
  const [scope, setScope] = useState<string[]>([]);
  const [scopeEmpty, setScopeEmpty] = useState(false);
  const [citation, setCitation] = useState<SourceSelection | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [locked, setLocked] = useState(false);
  const [token, setToken] = useState('');
  const [readyCount, setReadyCount] = useState(0);
  const generation = useRef(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const questionButton = useRef<HTMLButtonElement>(null);
  const presentationButton = useRef<HTMLButtonElement>(null);
  const exitPresentationButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const importLock = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  const latestDrop = useRef<(transfer: DataTransfer) => Promise<void>>(async () => {});
  const thread = useRef<HTMLDivElement>(null);
  const latestTurn = useRef<HTMLElement>(null);
  const activeBoard = workspace === 'knowledge' ? knowledge : engineering;
  const knowledgeSeed = useMemo(() => knowledgeScene(graph, documents), [graph, documents]);

  function remember(id: string | null) {
    setConversation(id);
    try {
      if (id) localStorage.setItem('grasp-conversation', id);
      else localStorage.removeItem('grasp-conversation');
    } catch {
      // The server conversation still works when browser storage is unavailable.
    }
  }

  function changePresentation(value: boolean) {
    setPresenting(value);
    requestAnimationFrame(() => (value ? exitPresentationButton : presentationButton).current?.focus());
  }

  function failure(value: unknown) {
    if (value instanceof ApiError && value.status === 401) setLocked(true);
    setError(value instanceof Error ? value.message : String(value));
  }

  async function refresh() {
    const [data, health, library] = await Promise.all([
      api<GraphResponse>('/graph'), api<HealthResponse>('/health'), api<DocumentsResponse>('/documents'),
    ]);
    setLibrary(data, library.documents);
    setProvider(health.llm.provider);
  }

  async function openConversation(id: string, showQuestions = true) {
    generation.current++;
    const result = await api<Turns>(`/conversations/${id}`);
    remember(id);
    setTurns(result.turns);
    setScope([]);
    setScopeEmpty(false);
    if (showQuestions) {
      setWorkspace('knowledge');
      setQuestionOpen(true);
    }
  }

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
    void refresh().then(async () => {
      const saved = savedConversation();
      if (!saved) return;
      try { await openConversation(saved, requestedBoard() === 'knowledge'); }
      catch (issue) {
        if (issue instanceof ApiError && issue.status === 404) remember(null);
        else throw issue;
      }
    }).catch(failure);
    return () => controllers.current.forEach(controller => controller.abort());
  }, []);

  useEffect(() => {
    if (workspace === 'knowledge' && questionOpen) textarea.current?.focus();
  }, [workspace, questionOpen]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (workspace === 'knowledge') url.searchParams.delete('board');
    else url.searchParams.set('board', workspace);
    if (workspace === 'project' && projectId) url.searchParams.set('projectBoard', projectId);
    else url.searchParams.delete('projectBoard');
    window.history.replaceState(window.history.state, '', url);
  }, [workspace, projectId]);

  useEffect(() => {
    const top = latestTurn.current?.offsetTop ?? 0;
    thread.current?.scrollTo({ top: Math.max(0, top - 16), behavior: 'instant' });
  }, [turns, workspace, questionOpen]);

  useEffect(() => installFileDropHandlers(window, transfer => { void latestDrop.current(transfer); }, setDragging), []);

  function changeUpload(index: number, update: (upload: UploadState) => UploadState) {
    setUploads(items => items.map((item, itemIndex) => itemIndex === index ? update(item) : item));
  }

  async function importFiles(files: File[], readErrors: string[] = []) {
    if (busy || loadingSample || importLock.current) {
      setError('Wait for the current workspace operation to finish.');
      return;
    }
    const notes = files.filter(isSupportedNote);
    if (!notes.length) {
      setError(readErrors.join(' ') || 'Add a PDF, Markdown or TXT document.');
      return;
    }

    generation.current++;
    setWorkspace('knowledge');
    setRender3D(false);
    importLock.current = true;
    setReading(true);
    setError('');
    setTurns([]);
    remember(null);
    setScope([]);
    setScopeEmpty(false);
    setReadyCount(0);
    setUploads(notes.map(file => ({ name: file.name, status: 'uploading', cursor: 0, message: 'Waiting to upload' })));

    let failures = readErrors.length;
    const imported: string[] = [];
    try {
      for (const [index, file] of notes.entries()) {
        const controller = new AbortController();
        controllers.current.add(controller);
        changeUpload(index, state => ({ ...state, message: 'Uploading' }));
        try {
          const form = new FormData();
          form.append('file', file);
          const response = await apiFetch('/documents', { method: 'POST', body: form, signal: controller.signal });
          const document = await response.json() as Document;
          upsertDocument(document);
          changeUpload(index, state => ({ ...state, docId: document.id, status: 'queued', message: 'Queued' }));
          await documentEvents(document.id, event => {
            changeUpload(index, state => updateUpload(state, event));
            if (event.document) upsertDocument(event.document);
          }, controller.signal);
          imported.push(document.id);
          setScope([...new Set(imported)]);
          setReadyCount(imported.length);
          await refresh();
        } catch (issue) {
          failures++;
          changeUpload(index, state => state.status === 'failed' ? state : {
            ...state, status: 'failed', message: issue instanceof Error ? issue.message : 'Upload failed.',
          });
          if (issue instanceof ApiError && issue.status === 401) failure(issue);
        } finally {
          controllers.current.delete(controller);
        }
      }
      setScopeEmpty(imported.length === 0);
      if (failures) setError(`${failures} files or folder entries could not be read. Add them again to retry.`);
    } finally {
      importLock.current = false;
      setReading(false);
    }
  }

  latestDrop.current = async transfer => {
    try {
      const result = await droppedFiles(transfer);
      await importFiles(result.files, result.errors);
    } catch (issue) {
      failure(issue);
    }
  };

  async function ask() {
    const value = question.trim();
    if (busy || !value || (reading && readyCount === 0) || scopeEmpty) return;
    const requestGeneration = generation.current;
    const draft = question;
    setBusy(true);
    setError('');
    try {
      let id = conversation;
      if (!id) {
        const created = await api<Conversation>('/conversations', {});
        id = created.id;
        remember(id);
      }
      const response = await api<ChatResponse>('/chat', { question: value, conversationId: id, docIds: scope });
      if (requestGeneration !== generation.current) return;
      setTurns(previous => [...previous, { id: Date.now(), question: value, response, createdAt: new Date().toISOString() }]);
      setQuestion(current => current === draft ? '' : current);
      setHighlight(response.referencedNodeIds);
      await refresh();
    } catch (issue) {
      failure(issue);
    } finally {
      setBusy(false);
      textarea.current?.focus();
    }
  }

  function startConversation() {
    generation.current++;
    remember(null);
    setTurns([]);
    setQuestion('');
    setScope([]);
    setScopeEmpty(false);
    setHighlight([]);
    setError('');
    textarea.current?.focus();
  }

  function askAbout(card: Card) {
    setScope(card.concept?.docIds ?? (card.document ? [card.document.id] : []));
    setScopeEmpty(false);
    if (card.concept) setQuestion(current => current || `Explain ${card.title}.`);
    setQuestionOpen(true);
    requestAnimationFrame(() => textarea.current?.focus());
  }

  async function demo() {
    setLoadingSample(true);
    setError('');
    try {
      await api('/demo', {});
      await refresh();
      startConversation();
    } catch (issue) {
      failure(issue);
    } finally {
      setLoadingSample(false);
    }
  }

  function changeWorkspace(value: BoardKind) {
    setWorkspace(value);
    setRender3D(false);
  }

  function explore(id: string) {
    void api('/nodes/explore', { nodeId: id }).then(refresh).catch(failure);
  }

  const working = reading || busy || loadingSample;
  const chosenConcept = graph.nodes.find(node => node.id === selectedConcept);
  const scopeNames = scope.map(id => documents.find(document => document.id === id)?.name ?? 'Selected source');
  const emphasized = [...highlight, ...knowledge.selected.filter(id => id.startsWith('concept:')).map(id => id.slice(8))];
  const visibleKnowledge = useMemo(() => {
    if (!uploads.length) return knowledgeSeed;
    const uploadByDocument = new Map(uploads.filter(upload => upload.docId).map(upload => [upload.docId, upload]));
    return {
      ...knowledgeSeed,
      cards: knowledgeSeed.cards.map(card => {
        const upload = card.document && uploadByDocument.get(card.document.id);
        return upload && upload.status !== 'done' ? { ...card, message: upload.message } : card;
      }),
    };
  }, [knowledgeSeed, uploads]);

  return <div className="canvas-workspace" data-theme={theme} data-presenting={presenting}
    onKeyDown={event => { if (event.key === 'Escape' && presenting) changePresentation(false); }}>
    <header className="canvas-header">
      {!presenting && <div className="canvas-location">
        <div className="canvas-brand"><Layers3 size={19} aria-hidden /><span>Grasp</span></div>
        <nav className="canvas-workspaces" aria-label="Workspaces">
          <button type="button" aria-pressed={workspace === 'knowledge'} onClick={() => changeWorkspace('knowledge')}><Box size={15} /><span>Knowledge</span></button>
          <button type="button" aria-pressed={workspace === 'engineering'} onClick={() => changeWorkspace('engineering')}><Workflow size={15} /><span>Engineering</span></button>
          <button type="button" aria-pressed={workspace === 'project'} onClick={() => changeWorkspace('project')}><LayoutPanelTop size={15} /><span>Projects</span></button>
        </nav>
      </div>}
      <div className="canvas-header-actions">
        {presenting ? <button ref={exitPresentationButton} type="button" className="canvas-text-button" onClick={() => changePresentation(false)}><X size={17} /> Exit presentation</button> : <>
        {workspace === 'knowledge' && <>
          <button type="button" ref={questionButton} className="canvas-text-button" aria-label="Questions" aria-expanded={questionOpen} title="Questions" onClick={() => setQuestionOpen(!questionOpen)}><MessageSquare size={17} /><span>Questions</span></button>
          <button type="button" className="canvas-text-button" aria-label={render3D ? 'Return to 2D canvas' : 'Explore in 3D'} title={render3D ? 'Return to 2D canvas' : 'Explore in 3D'} disabled={!graph.nodes.length} onClick={() => setRender3D(!render3D)}><Box size={17} /><span>{render3D ? '2D' : '3D'}</span></button>
          <button type="button" className="board-icon" aria-label="Choose folder" title="Choose folder" disabled={working} onClick={() => folderInput.current?.click()}><FolderOpen size={18} /></button>
          {(visibleKnowledge.cards.length > 0 || knowledge.document.authoredCards.length > 0) &&
            <button type="button" className="canvas-add-files" aria-label="Add documents" title="Add documents" disabled={working} onClick={() => fileInput.current?.click()}><FilePlus2 size={17} /><span>Add documents</span></button>}
        </>}
        {workspace === 'engineering' && <button ref={presentationButton} type="button" className="canvas-text-button" aria-label="Present board" title="Present board" onClick={() => changePresentation(true)}><Presentation size={17} /><span>Present</span></button>}
        {workspace === 'project' && <select className="project-picker" aria-label="Project boards" value={projectId} onChange={event => {
          project.reset();
          setProjectId(event.target.value);
        }}>
          <option value="">New board</option>
          {projectId && !project.boards.some(board => board.id === projectId) &&
            <option value={projectId}>{project.board?.title ?? 'Selected board'}</option>}
          {project.boards.map(board => <option key={board.id} value={board.id}>{board.title}</option>)}
        </select>}
        <button type="button" className="board-icon" aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} title={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
        <button type="button" className="board-icon" aria-label="Workspace options" title="Workspace options" disabled={working} onClick={() => setSettings(true)}><Settings size={17} /></button>
        </>}
      </div>
    </header>
    <input ref={fileInput} className="hidden-file" tabIndex={-1} aria-label="Select files" type="file" multiple accept=".pdf,.md,.txt" onChange={event => {
      void importFiles(Array.from(event.target.files ?? []));
      event.target.value = '';
    }} />
    <input ref={folderInput} className="hidden-file" tabIndex={-1} aria-label="Select folder" type="file" multiple onChange={event => {
      void importFiles(Array.from(event.target.files ?? []));
      event.target.value = '';
    }} />

    <main className={`canvas-main${workspace === 'knowledge' && questionOpen ? ' canvas-main--asking' : ''}`}>
      <div className="canvas-content">
        {workspace === 'project' ? <>
          {project.board ? <ProjectCanvas key={project.board.id} initial={project.board} theme={theme} documents={documents} onSource={setCitation} />
            : !projectId ? <NewProjectBoard onCreate={board => {
                project.remember(board);
                setProjectId(board.id);
              }} />
            : !project.problem && <p className="canvas-loading" role="status">Loading board…</p>}
          {project.problem && !locked && <div className="canvas-error" role="alert">
            <span>{project.problem}</span><button type="button" onClick={project.retry}>Retry</button>
          </div>}
        </> : render3D && workspace === 'knowledge' ? <div className="canvas-three">
          <ExplorerBoundary onReturn={() => setRender3D(false)}>
            <Suspense fallback={<p className="canvas-loading" role="status">Loading 3D explorer…</p>}>
              <Mindmap graph={graph} highlight={emphasized} onSelect={id => {
                knowledge.select([conceptObjectId(id)]);
                knowledge.selectLinks([]);
                setSelectedConcept(id);
                explore(id);
              }} />
            </Suspense>
          </ExplorerBoundary>
        </div> : <CanvasBoard key={workspace} seed={workspace === 'knowledge' ? visibleKnowledge : engineeringScene}
          session={activeBoard} highlight={workspace === 'knowledge' ? highlight : []} theme={theme} presenting={presenting}
          onInspect={() => { if (workspace === 'knowledge') setQuestionOpen(false); }}
          importing={workspace === 'knowledge' && (reading || loadingSample)}
          empty={workspace === 'knowledge' && <div className="board-empty">
            <div className="board-empty-symbol"><Layers3 size={28} strokeWidth={1.5} /></div>
            <h1>Knowledge canvas</h1>
            <p>Add documents to see how their ideas connect.</p>
            <div>
              <button type="button" className="canvas-add-files" disabled={working} onClick={() => fileInput.current?.click()}><FilePlus2 size={17} /> Add documents</button>
              {provider === 'mock' && <button type="button" disabled={working} onClick={() => void demo()}>{loadingSample ? 'Opening sample…' : 'Open sample'}</button>}
            </div>
          </div>}
          inspect={(card, link, close, pin) => <CanvasInspector key={card?.id ?? link?.id}
            card={card} link={card ? undefined : link} session={activeBoard} documents={documents} onClose={close}
            onSource={setCitation} onAsk={item => { close(); askAbout(item); }} onExplore={explore} onPin={source => pin({
              kind: 'evidence', title: `${documents.find(document => document.id === source.docId)?.name ?? 'Source'} · p${source.page}`,
              description: source.quote, evidence: source,
            })} />} />}

        {workspace === 'knowledge' && uploads.length > 0 && <section className="canvas-uploads" aria-label="File uploads">
          <header><h2>{reading ? 'Importing documents' : 'Import results'}</h2>{!reading && <button type="button" className="board-icon" aria-label="Dismiss import results" onClick={() => setUploads([])}><X size={14} /></button>}</header>
          <ul aria-live="polite">{uploads.map((upload, index) => <li key={index} data-status={upload.status}>
            <strong>{upload.name}</strong><span>{upload.status === 'done' ? 'Ready' : upload.message}</span>
          </li>)}</ul>
        </section>}
        {workspace === 'knowledge' && provider && <span className="canvas-provider">{provider === 'mock' ? 'Offline mock' : `Live · ${provider}`}</span>}
        {error && !locked && <div className="canvas-error" role="alert"><span>{error}</span><button type="button" className="board-icon" aria-label="Dismiss message" onClick={() => setError('')}><X size={15} /></button></div>}
      </div>
      {workspace === 'knowledge' && questionOpen && <section className="canvas-questions" aria-label="Document questions" onKeyDown={event => {
        if (event.key === 'Escape') {
          setQuestionOpen(false);
          questionButton.current?.focus();
        }
      }}>
        <header><h2>Questions</h2><button type="button" disabled={working} onClick={startConversation}>New</button>
          <button type="button" className="board-icon" aria-label="Close questions" onClick={() => { setQuestionOpen(false); questionButton.current?.focus(); }}><X size={17} /></button></header>
        <div className="question-scope">
          <span>{scopeEmpty ? 'No ready sources in this scope' : scope.length ? scopeNames.join(', ') : 'All ready sources'}</span>
          {scope.length > 0 && <button type="button" disabled={working} onClick={() => { setScope([]); setScopeEmpty(false); }}>Use all</button>}
        </div>
        <div className="conversation-thread" ref={thread} aria-live="polite">
          {turns.map((turn, index) => <article key={turn.id} ref={index === turns.length - 1 ? latestTurn : undefined}><h3>{turn.question}</h3><p>{turn.response.answer}</p><div className="source-buttons">
            {turn.response.citations.map((source, index) => <button key={`${source.chunkId}:${index}`} onClick={() => setCitation(source)}>Source {index + 1} · p{source.page}</button>)}
          </div></article>)}
          {busy && <p role="status">Reading the relevant passages…</p>}
        </div>
        <form onSubmit={event => { event.preventDefault(); void ask(); }}>
          <div className="composer">
            <textarea ref={textarea} aria-label="Your question" value={question} onChange={event => setQuestion(event.target.value)}
              placeholder="Ask about your documents…" maxLength={2000} onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(); }
              }} />
            <button aria-label="Ask question" disabled={busy || !question.trim() || (reading && readyCount === 0) || scopeEmpty}><ArrowUp size={19} /></button>
          </div>
        </form>
      </section>}
    </main>

    {dragging && <div className="drop-indicator"><FilePlus2 size={32} /><span>Drop to add documents</span></div>}
    {chosenConcept && <ConceptView node={chosenConcept} graph={graph} onSelect={id => { setSelectedConcept(id); explore(id); }}
      onClose={() => setSelectedConcept(null)} onSource={source => { setSelectedConcept(null); setCitation(source); }} />}
    {citation && <SourceView citation={citation} sourceName={documents.find(document => document.id === citation.docId)?.name}
      onClose={() => setCitation(null)} />}
    {settings && <WorkspaceSettings onClose={() => setSettings(false)} onRefresh={refresh} onConversation={openConversation}
      onConversationRemoved={id => {
        if (id === conversation) startConversation();
      }}
      onDocumentChanged={(oldId, newId) => {
        generation.current++;
        if (!scope.includes(oldId)) return;
        const next = [...new Set(scope.flatMap(id => id === oldId ? (newId ? [newId] : []) : [id]))];
        setScope(next);
        setScopeEmpty(next.length === 0);
        if (!next.length) setError('The active source was removed. Add notes or start a new conversation.');
      }} />}
    {locked && <div className="access-gate"><form onSubmit={event => {
      event.preventDefault();
      setAccessToken(token);
      void refresh().then(async () => {
        if (conversation) await openConversation(conversation, workspace === 'knowledge');
        setAccessVersion(value => value + 1);
        setLocked(false);
        setError('');
      }).catch(failure);
    }}><h2>Open your workspace</h2><label htmlFor="access-token">Workspace access token</label>
      <input id="access-token" type="password" value={token} onChange={event => setToken(event.target.value)} required />
      <button>Unlock</button>{error && <p role="alert">{error}</p>}</form></div>}
  </div>;
}
