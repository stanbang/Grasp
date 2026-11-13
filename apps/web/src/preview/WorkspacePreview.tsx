import { useEffect, useRef, useState } from 'react';
import { type LucideIcon, ArrowUp, ArrowUpRight, Check, ChevronLeft, ChevronRight, FileText, FolderOpen, Maximize2, MessageSquare, Network, Orbit, Paperclip, Pause, Play, RotateCcw, Settings2, X } from 'lucide-react';

import { installFileDropHandlers } from '../folder-upload';

type PreviewState = 'empty' | 'processing' | 'orbit' | 'answer' | 'inspector';
type View = 'documents' | 'knowledge';
type SampleDocument = { id: string; name: string; type: string; title: string; subtitle: string; excerpt: string; sourcePath?: string; };
const samples: SampleDocument[] = [
  { id: 'memory', name: 'Memory and learning.pdf', type: 'PDF', title: 'Memory and learning', subtitle: 'How we remember, revisit and connect ideas.', excerpt: 'Retrieval practice means trying to recall an idea before looking at the answer.', sourcePath: 'samples/memory-and-learning.md' },
  { id: 'review', name: 'Retrieval review.md', type: 'MD', title: 'Retrieval review', subtitle: 'Recall first. Check the source. Notice what is missing.', excerpt: 'Close the notes and explain an idea before checking the source.', sourcePath: 'samples/retrieval-review.md' },
  { id: 'practice', name: 'Study practice.txt', type: 'TXT', title: 'Study practice', subtitle: 'Short sessions, useful feedback and worked examples.', excerpt: 'Try explaining a worked example before reading the steps again.' },
];
const states: { id: PreviewState; label: string }[] = [
  { id: 'empty', label: 'Empty' }, { id: 'processing', label: 'Processing' },
  { id: 'orbit', label: 'Orbit' }, { id: 'answer', label: 'Cited answer' }, { id: 'inspector', label: 'Inspector' },
];

type Icon = LucideIcon;
function IconButton({ icon: Glyph, label, onClick, pressed }: { icon: Icon; label: string; onClick: () => void; pressed?: boolean }) {
  const id = `tip-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return <span className="preview-icon-wrap"><button className="preview-icon" aria-label={label} aria-describedby={id} aria-pressed={pressed} onClick={onClick}><Glyph size={18} strokeWidth={1.6} aria-hidden /></button><span role="tooltip" id={id} className="preview-tooltip">{label}</span></span>;
}

function PaperPreview({ document, compact = false }: { document: SampleDocument; compact?: boolean }) {
  return <div className={`paper-preview ${compact ? 'paper-compact' : ''}`} aria-hidden="true">
    <div className="paper-topline"><span>GRASP / STUDY NOTES</span><FileText size={12} /></div>
    <h3>{document.title}</h3><p>{document.subtitle}</p><div className="paper-rule" />
    <h4>{document.id === 'memory' ? 'Retrieval practice' : 'A note worth revisiting'}</h4>
    <p>{document.excerpt}</p>
    <div className="paper-lines"><i /><i /><i /><i /></div><span className="paper-page">1</span>
  </div>;
}

function OrbitalField({ visible, selected, paused, onSelect, view }: { visible: boolean; selected: string; paused: boolean; onSelect: (id: string) => void; view: View }) {
  return <div className={`orbital-field ${visible ? 'has-documents' : ''} ${paused ? 'is-paused' : ''}`}>
    <div className="orbital-path path-near" /><div className="orbital-path path-far" />
    <span className="orbit-point point-a" /><span className="orbit-point point-b" /><span className="orbit-point point-c" />
    {visible && view === 'documents' && <div className="document-orbit" aria-label="Sample document orbit">
      {samples.map((document, index) => <button key={document.id} className={`orbit-document slot-${index} ${selected === document.id ? 'document-selected' : ''}`} onClick={() => onSelect(document.id)} aria-label={`Inspect sample ${document.name}`} aria-pressed={selected === document.id}>
        <PaperPreview document={document} compact /><span className="document-caption"><FileText size={13} /><span>{document.name}</span><small>{document.type}</small></span><span className="document-hover">Open document <ArrowUpRight size={13} /></span>
      </button>)}
    </div>}
    {visible && view === 'knowledge' && <div className="knowledge-proposal" aria-label="Sample knowledge connections">
      <svg viewBox="0 0 900 500" aria-hidden="true"><path d="M180 170L410 100L670 180L480 330L180 170M410 100L480 330M480 330L760 370" /></svg>
      {['Working memory', 'Retrieval practice', 'Feedback', 'Long-term memory', 'Worked examples'].map((label, index) => <button key={label} className={`concept-proposal concept-${index}`} onClick={() => onSelect(index === 4 ? 'review' : 'memory')}><span />{label}</button>)}
    </div>}
  </div>;
}

function ProcessingPreview() {
  return <div className="processing-preview" role="status" aria-live="polite">
    <div className="processing-loop"><div className="processing-track" /><div className="processing-arc" /><div className="processing-paper"><PaperPreview document={samples[0]!} compact /></div></div>
    <h2>Indexing sources and extracting concepts</h2><p>Memory and learning.pdf</p><small>Example SSE state · indeterminate until a terminal event</small>
  </div>;
}

function Composer({ state, onCitation, onAnswer, onUpload }: { state: PreviewState; onCitation: () => void; onAnswer: () => void; onUpload: () => void }) {
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const hasAnswer = state === 'answer' || state === 'inspector';
  useEffect(() => { if (input.current) { input.current.style.height = 'auto'; input.current.style.height = `${Math.min(input.current.scrollHeight, 120)}px`; } }, [draft]);
  return <section className={`research-conversation ${hasAnswer ? 'with-answer' : ''}`} aria-label="Sample document conversation">
    {hasAnswer && <div className="preview-thread"><p className="sample-question">How does retrieval practice help me study?</p><article><div className="answer-mark"><Orbit size={18} /><span>Sample grounded answer</span></div><p>Try to recall an idea before reopening your notes. Then compare your answer with the source to find missing or mistaken details.</p><button className="named-citation" onClick={onCitation}><FileText size={14} /><span>Memory and learning</span><span>p. 1</span><ArrowUpRight size={13} /></button></article></div>}
    <div className="research-composer">
      <div className="composer-scope"><span className="scope-indicator" />{state === 'empty' ? 'Add a source to begin' : 'Ask across all sample sources'}<span>{state === 'empty' ? 'PDF · MD · TXT' : '3 sample sources'}</span></div>
      <label htmlFor="preview-question">{state === 'empty' ? 'drop folder to get started' : 'what question would you like to ask'}</label>
      <textarea ref={input} id="preview-question" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if(event.key === 'Enter' && !event.shiftKey && state !== 'empty' && draft.trim()) { event.preventDefault(); onAnswer(); } }} placeholder={state === 'empty' ? 'Add notes, then follow your questions.' : 'Ask about your documents…'} rows={1} />
      <div className="composer-actions"><div>{state === 'empty' ? <><button className="labelled-upload" onClick={onUpload}><Paperclip size={15} />Preview file upload</button><button className="labelled-upload" onClick={onUpload}><FolderOpen size={15} />Preview folder upload</button></> : <><IconButton icon={Paperclip} label="Preview document upload" onClick={onUpload} /><IconButton icon={FolderOpen} label="Preview folder upload" onClick={onUpload} /></>}<span>{state === 'empty' ? 'Drop files anywhere' : 'Answers stay linked to their sources'}</span></div><span className="preview-icon-wrap"><button className="preview-send" aria-label="Show sample cited answer" aria-describedby="sample-send-tip" disabled={state === 'empty' || !draft.trim()} onClick={onAnswer}><ArrowUp size={19} /></button><span role="tooltip" id="sample-send-tip" className="preview-tooltip">Show sample cited answer</span></span></div>
    </div><p className="composer-note">{state === 'empty' ? 'Your sources will appear around this space.' : 'Enter to send · Shift + Enter for a new line'}</p>
  </section>;
}

function Inspector({ document, citationActive, onClose, onKnowledge }: { document: SampleDocument; citationActive: boolean; onClose: () => void; onKnowledge: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(window.matchMedia('(max-width:700px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width:700px)');
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update);
    panel.current?.focus();
    return () => media.removeEventListener('change', update);
  }, []);
  function containFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (!narrow || event.key !== 'Tab') return;
    const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (globalThis.document.activeElement === first || globalThis.document.activeElement === panel.current)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && globalThis.document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }
  return <aside className="document-inspector" ref={panel} tabIndex={-1} aria-label="Sample document inspector" role={narrow ? 'dialog' : undefined} aria-modal={narrow ? true : undefined} onKeyDown={containFocus}>
    <header><span><FileText size={16} /> Source document</span><IconButton icon={X} label="Close inspector" onClick={onClose} /></header>
    <div className="inspector-title"><h2>{document.name}</h2><p><span><Check size={13} /> Indexed sample</span><span>{document.type}</span></p></div>
    <div className="inspector-paper"><PaperPreview document={document} /></div>
    <div className="page-controls"><span aria-hidden="true"><ChevronLeft size={17} /></span><span>Sample page 1</span><span aria-hidden="true"><ChevronRight size={17} /></span></div>
    <section className="inspector-quote"><h3>{citationActive ? 'Cited passage' : 'Document excerpt'}</h3><blockquote>{document.excerpt}</blockquote><p>{document.sourcePath ? `Exact excerpt from ${document.sourcePath}.` : 'Illustrative sample excerpt.'} The page above is a design mockup, not a PDF render.</p></section>
    <button className="inspect-knowledge" onClick={onKnowledge}><Network size={16} /> Explore associated concepts <ArrowUpRight size={14} /></button>
  </aside>;
}

export function WorkspacePreview() {
  const [state, setState] = useState<PreviewState>('orbit');
  const [view, setView] = useState<View>('documents');
  const [selected, setSelected] = useState('');
  const [paused, setPaused] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [citationActive, setCitationActive] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const topbar = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  useEffect(() => installFileDropHandlers(window, () => setNotice('This design preview does not upload files. Use Open working app to import your document.'), setDragging), []);
  const hasDocuments = state !== 'empty' && state !== 'processing';
  useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') setInspector(false); }
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width:700px)');
    function update() {
      if (topbar.current) topbar.current.inert = inspector && media.matches;
      if (canvas.current) canvas.current.inert = inspector && media.matches;
    }
    update(); media.addEventListener('change', update);
    if (!inspector && opener.current?.isConnected) opener.current.focus();
    return () => { media.removeEventListener('change', update); if (topbar.current) topbar.current.inert = false; if (canvas.current) canvas.current.inert = false; };
  }, [inspector]);
  function rememberOpener() { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }
  function chooseState(next: PreviewState) { if(next === 'inspector') rememberOpener(); else opener.current = null; setCitationActive(next === 'inspector'); setState(next); setInspector(next === 'inspector'); setSelected(next === 'inspector' ? 'memory' : ''); setNotice(''); }
  function inspect(id: string) { rememberOpener(); setCitationActive(false); setSelected(id); setInspector(true); }
  function citation() { rememberOpener(); setCitationActive(true); setState('answer'); setSelected('memory'); setInspector(true); }
  return <div className="design-preview">
    <nav className="preview-review-bar" aria-label="Design preview states"><span><span className="preview-label">Design preview</span><span className="preview-disclaimer">Sample states · no uploads or AI calls</span></span><div>{states.map(item => <button key={item.id} aria-pressed={state === item.id} onClick={() => chooseState(item.id)}>{item.label}</button>)}</div><a href="/">Open working app <ArrowUpRight size={12} /></a></nav>
    <div className={`proposed-workspace ${inspector ? 'inspector-open' : ''} ${state === 'answer' || state === 'inspector' ? 'answer-visible' : ''}`}>
      <header className="workspace-topbar" ref={topbar}><div className="workspace-wordmark"><Orbit size={23} /><span>grasp</span><span className="workspace-divider" /><small>Personal workspace</small></div>
        <div className="view-switch" aria-label="Visualization view"><button aria-pressed={view === 'documents'} onClick={() => setView('documents')}><Orbit size={15} /> Documents</button><button aria-pressed={view === 'knowledge'} onClick={() => setView('knowledge')}><Network size={15} /> Knowledge</button></div>
        <div className="workspace-utilities"><IconButton icon={MessageSquare} label="Preview new conversation" onClick={() => chooseState('orbit')} /><IconButton icon={Settings2} label="About this design preview" onClick={() => setNotice('This is the Phase 1 state preview. Real ingestion, saved conversations and mastery remain available in the working app.')} /></div>
      </header>
      <main ref={canvas} className="proposed-canvas" aria-label="Document research workspace">
        <OrbitalField visible={hasDocuments} selected={selected} paused={paused || inspector} onSelect={inspect} view={view} />
        {state === 'processing' ? <ProcessingPreview /> : <Composer state={state} onCitation={citation} onAnswer={() => setState('answer')} onUpload={() => chooseState('processing')} />}
        {notice && <div className="preview-notice" role="status"><p>{notice}</p><button onClick={() => setNotice('')}>Dismiss</button></div>}
        <div className="canvas-navigation"><span>{hasDocuments ? '3 sample documents' : 'Your document workspace'}</span><div><IconButton icon={paused ? Play : Pause} label={paused ? 'Resume orbit' : 'Pause orbit'} onClick={() => setPaused(!paused)} pressed={paused} /><IconButton icon={RotateCcw} label="Reset preview selection" onClick={() => { setSelected(''); setInspector(false); }} /><IconButton icon={Maximize2} label="Focus sample document" onClick={() => { if (hasDocuments) inspect(selected || 'memory'); else setNotice('Select Orbit to inspect the sample documents.'); }} /></div></div>
      </main>
      {inspector && <Inspector citationActive={citationActive} document={samples.find(doc => doc.id === selected) || samples[0]!} onClose={() => setInspector(false)} onKnowledge={() => { setView('knowledge'); setInspector(false); }} />}
    </div>
    {dragging && <div className="preview-drop" role="status"><Paperclip size={28} /><p>File drops stay on this page</p><span>Upload integration begins in Phase 2.</span></div>}
  </div>;
}
