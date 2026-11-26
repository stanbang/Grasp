import { ArrowRight, ArrowUpRight, FileText, MessageSquare, Pin, Ungroup, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../client';
import type { CanvasObject, CanvasObjectContext, CanvasRequirement } from '../types/canvas-contracts';
import type { ChunksResponse, Citation, Document } from '../types/contracts';
import { removeAuthored, type AuthoredCard, type Card, type SourceSelection } from './board';
import { CanvasVisualization } from './CanvasVisualization';
import { illustrationOptions } from './TechnicalIllustration';
import type { InspectedLink, PinCanvasObject } from './CanvasBoard';
import type { FeedbackTarget, ProjectFeedbackKind } from './project-board';
import type { BoardSession } from './use-board';

const sourceBase = 'https://github.com/stanbang/Grasp/blob/98f8cda/';
const linkRoles = { structural: 'Context', data: 'Data flow', process: 'Processing', annotation: 'Annotation' };
const feedbackNames = { annotation: 'note', question: 'question', requirement: 'requirement' } as const;
const feedbackKinds: ProjectFeedbackKind[] = ['annotation', 'question', 'requirement'];

function Passages({ card, documents, onSource, onPin }: {
  card: Card;
  documents: Document[];
  onSource: (citation: SourceSelection) => void;
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

function ProjectObjectContext({ boardId, objectId, revision, onSource }: {
  boardId: string;
  objectId: string;
  revision: number;
  onSource: (citation: SourceSelection) => void;
}) {
  const [context, setContext] = useState<CanvasObjectContext>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void api<CanvasObjectContext>(`/boards/${encodeURIComponent(boardId)}/objects/${encodeURIComponent(objectId)}/context`)
      .then(result => { if (active) { setContext(result); setFailed(false); } })
      .catch(() => { if (active) { setContext(undefined); setFailed(true); } });
    return () => { active = false; };
  }, [boardId, objectId, revision]);
  if (failed) return <p role="alert">Could not load the saved object context.</p>;
  if (!context) return null;
  const object = context.object;
  return <>
    <p>{object.createdBy === 'agent' ? 'Added by agent' : 'Added by user'}
      {object.updatedBy !== object.createdBy && (object.updatedBy === 'agent' ? ' · Edited by agent' : ' · Edited by user')}</p>
    {object.requirement && <section>
      <h3>Requirement</h3>
      <p>{object.requirement.status === 'accepted' ? 'Accepted by user' : object.requirement.status === 'rejected' ? 'Rejected by user' : 'Proposed'}</p>
      {!!object.requirement.acceptanceCriteria?.length && <ul>
        {object.requirement.acceptanceCriteria.map((criterion, index) => <li key={index}>{criterion}</li>)}
      </ul>}
    </section>}
    {object.question && <section>
      <h3>{object.question.required ? 'Required question' : 'Question'}</h3>
      <p>{object.answer ? `User answer: ${object.answer.text}` : 'Awaiting an answer'}</p>
    </section>}
    {object.prototype && <section>
      <h3>Prototype revision {object.prototype.revision}</h3><p>{object.prototype.entryPoint}</p>
    </section>}
    {context.canonicalConcept && <p>Linked concept: {context.canonicalConcept.label}</p>}
    {!!context.relatedObjects.length && <section><h3>Related objects</h3>
      <ul>{context.relatedObjects.map(item => <li key={item.id}>{item.title}</li>)}</ul>
    </section>}
    {!!context.evidence.length && <section className="board-passages"><h3>Source passages</h3>
      {context.evidence.map(({ reference, available, quote, sourceName }) =>
        <div className="board-passage" key={`${reference.chunkId}:${reference.charStart}:${reference.charEnd}`}>
          {available && quote !== null ? <>
            <div className="board-passage-actions"><button type="button" onClick={() => onSource({
              chunkId: reference.chunkId, docId: reference.docId, page: reference.page, quote, sourceSpan: reference,
            })}><FileText size={15} /><span>{sourceName} · p{reference.page}</span><ArrowUpRight size={14} /></button></div>
            <blockquote>{quote}</blockquote>
          </> : <p>Source passage unavailable · p{reference.page}</p>}
        </div>)}
    </section>}
  </>;
}

export function CanvasInspector({ card, link, session, documents, onClose, onSource, onAsk, onExplore, onPin,
  projectBoardId, savedRevision, onAddProjectFeedback }: {
  card?: Card;
  link?: InspectedLink;
  session: BoardSession;
  documents: Document[];
  onClose: () => void;
  onSource: (citation: SourceSelection) => void;
  onAsk: (card: Card) => void;
  onExplore: (id: string) => void;
  onPin: (citation: Citation) => void;
  projectBoardId?: string;
  savedRevision?: number;
  onAddProjectFeedback?: PinCanvasObject;
}) {
  const conceptId = card?.concept?.id;
  const explored = card?.concept?.masteryState;
  const draft = session.document.authoredCards.find(item => item.id === card?.id);
  const ownedLink = link?.origin === 'authored';
  const { authoredCards, authoredLinks } = session.document;
  const editEndpoints = projectBoardId && link && ownedLink
    && !authoredLinks.find(item => item.id === link.id)?.projectConnection?.canonicalEdgeId;
  const attachedFeedback = link ? authoredCards.filter(item => item.projectObject?.relatedConnectionIds?.includes(link.id)) : [];
  const availableFeedback = link ? authoredCards.filter(({ projectObject: item }) =>
    item && feedbackKinds.some(kind => kind === item.kind)
    && !item.relatedConnectionIds?.includes(link.id) && (item.relatedConnectionIds?.length ?? 0) < 20) : [];
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

  function reconnect(end: 'source' | 'target', id: string) {
    if (!link) return;
    session.update(board => ({ ...board, authoredLinks: board.authoredLinks.map(item =>
      item.id === link.id ? { ...item, [end]: id } : item) }));
  }

  function changeFeedback(id: string, changes: Partial<Pick<CanvasObject, 'relatedConnectionIds' | 'requirement'>>) {
    session.update(board => ({ ...board, authoredCards: board.authoredCards.map(item =>
      item.id === id && item.projectObject ? { ...item, projectObject: { ...item.projectObject, ...changes } } : item) }));
  }

  function attachFeedback(id: string) {
    const item = availableFeedback.find(candidate => candidate.id === id)?.projectObject;
    if (link && item) changeFeedback(item.id, { relatedConnectionIds: [...(item.relatedConnectionIds ?? []), link.id] });
  }

  function feedbackActions(target: FeedbackTarget) {
    return onAddProjectFeedback && <section aria-label="Add feedback">
      {feedbackKinds.map(kind => <button type="button" key={kind} className="board-inspector-action"
        onClick={() => onAddProjectFeedback({
          kind: kind === 'annotation' ? 'annotation' : 'explanation', title: `New ${feedbackNames[kind]}`, description: '',
        }, { ...target, kind })}>Add {feedbackNames[kind]}</button>)}
    </section>;
  }

  function endpointOptions(end: 'source' | 'target', edge: InspectedLink) {
    const opposite = end === 'source' ? edge.target : edge.source;
    return authoredCards.filter(item => item.kind !== 'group' && item.id !== opposite
      && !authoredLinks.some(other => other.id !== edge.id && other[end] === item.id
        && (end === 'source' ? other.target : other.source) === opposite));
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
        {draft.kind !== 'group' && !(projectBoardId && draft.kind === 'evidence') && <label>Text<textarea key={draft.description} defaultValue={draft.description} maxLength={4000} rows={5}
          onBlur={event => { if (event.target.value !== draft.description) editCard({ description: event.target.value }); }} /></label>}
        {draft.kind === 'annotation' && <label>Annotation style<select value={draft.noteStyle ?? 'plain'} onChange={event => {
          const style = event.target.value;
          if (style === 'plain' || style === 'underline' || style === 'callout') editCard({ noteStyle: style });
        }}><option value="plain">Handwritten</option><option value="underline">Underlined</option><option value="callout">Callout</option></select></label>}
        {draft.kind === 'illustration' && <label>Illustration<select value={draft.illustration} onChange={event => {
          const illustration = illustrationOptions.find(option => option.id === event.target.value);
          if (illustration) editCard({ illustration: illustration.id, ...(draft.title === 'New illustration' ? { title: illustration.label } : {}) });
        }}>{illustrationOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
        {draft.projectObject?.requirement && <label>Requirement decision
          <select value={draft.projectObject.requirement.status ?? 'proposed'} onChange={event => changeFeedback(draft.id, {
            requirement: { ...draft.projectObject?.requirement, status: event.target.value as CanvasRequirement['status'] },
          })}>
            <option value="proposed">Proposed</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>}
        {authoredLinks.filter(edge => draft.projectObject?.relatedConnectionIds?.includes(edge.id)).map(edge =>
          <section key={edge.id}><h3>Attached connection</h3><p>{edge.label}</p>
            <button type="button" className="board-inspector-action" onClick={() => changeFeedback(draft.id, {
              relatedConnectionIds: draft.projectObject?.relatedConnectionIds?.filter(id => id !== edge.id) ?? [],
            })}>Detach feedback</button>
          </section>)}
        {feedbackActions({ objectId: draft.id })}
        {projectBoardId && draft.projectObject && savedRevision !== undefined && <ProjectObjectContext
          boardId={projectBoardId} objectId={draft.id} revision={savedRevision} onSource={onSource} />}
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
          {editEndpoints && (['source', 'target'] as const).map(end => <label key={end}>
            {end === 'source' ? 'Source object' : 'Target object'}
            <select value={link[end]} onChange={event => reconnect(end, event.target.value)}>
              {endpointOptions(end, link).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>)}
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
          {attachedFeedback.length > 0 && <section><h3>Attached feedback</h3><ul>
            {attachedFeedback.map(item => <li key={item.id}><button type="button" className="board-inspector-action"
              onClick={() => { session.select([item.id]); session.selectLinks([]); }}>{item.title}</button></li>)}
          </ul></section>}
          {availableFeedback.length > 0 && <label>Attach existing feedback
            <select value="" onChange={event => attachFeedback(event.target.value)}>
              <option value="">Choose feedback</option>
              {availableFeedback.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>}
          {feedbackActions({ connectionId: link.id })}
        </> : <>
          <p>{link.label}</p>
          {link.role && <p className="board-connection-role">{linkRoles[link.role]}</p>}
          {!!link.docIds?.length && <ul>{link.docIds.map(id => <li key={id}>{documents.find(doc => doc.id === id)?.name ?? id}</li>)}</ul>}
        </>}
      </>}
    </div>
  </aside>;
}
