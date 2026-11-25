import { ArrowRight, ArrowUpRight, FileText, MessageSquare, Pin, Ungroup, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../client';
import type { ChunksResponse, Citation, Document } from '../types/contracts';
import { removeAuthored, type AuthoredCard, type Card } from './board';
import { CanvasVisualization } from './CanvasVisualization';
import { illustrationOptions } from './TechnicalIllustration';
import type { InspectedLink } from './CanvasBoard';
import type { BoardSession } from './use-board';

const sourceBase = 'https://github.com/stanbang/Grasp/blob/98f8cda/';
const linkRoles = { structural: 'Context', data: 'Data flow', process: 'Processing', annotation: 'Annotation' };

function Passages({ card, documents, onSource, onPin }: {
  card: Card;
  documents: Document[];
  onSource: (citation: Citation) => void;
  onPin: (citation: Citation) => void;
}) {
  const ids = card.concept?.docIds ?? (card.document?.status === 'done' ? [card.document.id] : []);
  const chunks = card.concept?.sourceChunkIds;
  const isDocument = !!card.document;
  const key = ids.join(',');
  const sourceKey = chunks?.join(',') ?? '';
  const [sources, setSources] = useState<Citation[]>([]);
  const [status, setStatus] = useState<'waiting' | 'ready' | 'error'>('waiting');

  useEffect(() => {
    if (!key) return;
    let active = true;
    const allowed = new Set(sourceKey.split(','));
    void Promise.all(key.split(',').map(id => api<ChunksResponse>(`/documents/${id}/chunks`)))
      .then(results => {
        if (!active) return;
        setSources(results.flatMap(result => result.chunks)
          .filter(chunk => isDocument || allowed.has(chunk.id))
          .map(chunk => ({ chunkId: chunk.id, docId: chunk.docId, page: chunk.page, quote: chunk.text })));
        setStatus('ready');
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [key, sourceKey, isDocument]);

  if (!key) return null;
  return <section className="board-passages">
    <h3>Source passages</h3>
    {status === 'waiting' && <p role="status">Loading passages…</p>}
    {status === 'error' && <p role="alert">Could not load the source passages.</p>}
    {status === 'ready' && !sources.length && <p>No source passages are available.</p>}
    {sources.map(source => <div className="board-passage" key={source.chunkId}>
      <div className="board-passage-actions">
        <button type="button" onClick={() => onSource(source)}>
          <FileText size={15} /><span>{documents.find(doc => doc.id === source.docId)?.name ?? 'Source'} · p{source.page}</span><ArrowUpRight size={14} />
        </button>
        <button type="button" className="board-icon" aria-label={`Pin passage from page ${source.page}`} title="Pin passage to canvas"
          onClick={() => onPin(source)}><Pin size={16} /></button>
      </div>
      <blockquote>{source.quote}</blockquote>
    </div>)}
  </section>;
}

export function CanvasInspector({ card, link, session, documents, onClose, onSource, onAsk, onExplore, onPin }: {
  card?: Card;
  link?: InspectedLink;
  session: BoardSession;
  documents: Document[];
  onClose: () => void;
  onSource: (citation: Citation) => void;
  onAsk: (card: Card) => void;
  onExplore: (id: string) => void;
  onPin: (citation: Citation) => void;
}) {
  const conceptId = card?.concept?.id;
  const explored = card?.concept?.masteryState;
  const draft = session.document.authoredCards.find(item => item.id === card?.id);
  const ownedLink = link?.origin === 'authored';
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (conceptId && explored === 'unexplored') onExplore(conceptId);
  }, [conceptId, explored]);
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, []);

  function editCard(fields: Partial<Pick<AuthoredCard, 'title' | 'description' | 'illustration' | 'noteStyle'>>) {
    if (!draft) return;
    session.update(board => ({ ...board, authoredCards: board.authoredCards.map(item =>
      item.id === draft.id ? { ...item, ...fields } : item) }));
  }

  function editLink(value: string) {
    const label = value.trim();
    if (!link || !label || label === link.label) return;
    session.update(board => ({ ...board, authoredLinks: board.authoredLinks.map(item =>
      item.id === link.id ? { ...item, label } : item) }));
  }

  function remove() {
    onClose();
    session.update(board => removeAuthored(board, card ? [card.id] : [], link ? [link.id] : []));
    session.select([]);
    session.selectLinks([]);
  }

  return <aside className={`board-inspector${card?.concept || card?.document ? ' board-inspector--evidence' : ''}`} aria-label="Object inspector" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
  }}>
    <header><h2>{card?.title ?? 'Connection'}</h2><button ref={closeButton} className="board-icon" type="button" aria-label="Close inspector" onClick={onClose}><X size={18} /></button></header>
    <div className="board-inspector-body">
      {card?.evidence ? <>
        <button type="button" className="board-inspector-action" onClick={() => onSource(card.evidence!)}><FileText size={16} /> Open exact passage</button>
        <blockquote className="board-evidence-quote">{card.evidence.quote}</blockquote>
        <button type="button" className="board-inspector-action" onClick={remove}>Remove from board</button>
      </> : draft ? <>
        <label>Title<input key={draft.title} defaultValue={draft.title} maxLength={96} onBlur={event => {
          const title = event.target.value.trim();
          if (title && title !== draft.title) editCard({ title });
          else event.target.value = draft.title;
        }} /></label>
        {draft.kind !== 'group' && <label>Text<textarea key={draft.description} defaultValue={draft.description} maxLength={4000} rows={5}
          onBlur={event => { if (event.target.value !== draft.description) editCard({ description: event.target.value }); }} /></label>}
        {draft.kind === 'annotation' && <label>Annotation style<select value={draft.noteStyle ?? 'plain'} onChange={event => {
          const style = event.target.value;
          if (style === 'plain' || style === 'underline' || style === 'callout') editCard({ noteStyle: style });
        }}><option value="plain">Handwritten</option><option value="underline">Underlined</option><option value="callout">Callout</option></select></label>}
        {draft.kind === 'illustration' && <label>Illustration<select value={draft.illustration} onChange={event => {
          const illustration = illustrationOptions.find(option => option.id === event.target.value);
          if (illustration) editCard({ illustration: illustration.id, ...(draft.title === 'New illustration' ? { title: illustration.label } : {}) });
        }}>{illustrationOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
        <button type="button" className="board-inspector-action" onClick={remove}>{draft.kind === 'group' ? <><Ungroup size={16} /> Ungroup</> : 'Remove object'}</button>
      </> : card && <>
        {card.description && <p>{card.description}</p>}
        {card.visualization && <CanvasVisualization plot={card.visualization} />}
        {card.sourcePath && <a className="board-code-link" href={sourceBase + card.sourcePath} target="_blank" rel="noreferrer">
          <code>{card.sourcePath}</code><ArrowUpRight size={15} />
        </a>}
        {(card.concept || card.document?.status === 'done') && <>
          <button type="button" className="board-inspector-action" onClick={() => onAsk(card)}><MessageSquare size={16} />
            {card.concept ? 'Ask about this concept' : 'Ask this document'}
          </button>
          <Passages key={card.id} card={card} documents={documents} onSource={onSource} onPin={onPin} />
        </>}
      </>}
      {link && !card && <>
        <p className="board-inspector-endpoints"><span>{link.sourceTitle}</span><ArrowRight size={15} aria-label="to" /><span>{link.targetTitle}</span></p>
        {ownedLink ? <>
          <label>Relationship label<input key={link.label} defaultValue={link.label} maxLength={96}
            onBlur={event => {
              if (event.target.value.trim()) editLink(event.target.value);
              else event.target.value = link.label;
            }} /></label>
          <label>Connection style<select value={link.role ?? 'data'} onChange={event => {
            const role = event.target.value;
            if (role === 'data' || role === 'process' || role === 'annotation') session.update(board => ({
              ...board, authoredLinks: board.authoredLinks.map(item => item.id === link.id ? { ...item, role } : item),
            }));
          }}><option value="data">Data flow</option><option value="process">Processing</option><option value="annotation">Curved annotation arrow</option></select></label>
          <button type="button" className="board-inspector-action" onClick={remove}>Remove connection</button>
        </> : <>
          <p>{link.label}</p>
          {link.role && <p className="board-connection-role">{linkRoles[link.role]}</p>}
          {!!link.docIds?.length && <ul>{link.docIds.map(id => <li key={id}>{documents.find(doc => doc.id === id)?.name ?? id}</li>)}</ul>}
        </>}
      </>}
    </div>
  </aside>;
}
