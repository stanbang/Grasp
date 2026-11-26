import {
  Background, BackgroundVariant, ConnectionMode, MarkerType, Position, ReactFlow, SelectionMode,
  getViewportForBounds, type Connection, type OnEdgesChange, type OnNodesChange, type ReactFlowInstance,
} from '@xyflow/react';
import {
  BoxSelect, ChevronLeft, ChevronRight, Hand, Link2, List, Maximize, Minus, MousePointer2, Plus, Redo2, Scan, Undo2, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CanvasCard, Relation, sides, type CanvasEdge, type CanvasNode } from './CanvasObjects';
import { bounds, groupCards, placeCard, projectBoard, rect, removeAuthored, zoomAt, type AuthoredCard, type AuthoredLink, type BoardLink, type BoardScene, type Card, type Placement } from './board';
import { engineeringPaths } from './engineering-board';
import { projectFeedbackObject, type ProjectFeedback } from './project-board';
import type { BoardSession } from './use-board';

const nodeTypes = { card: CanvasCard };
const edgeTypes = { relation: Relation };
const minimumZoom = 0.15;
const maximumZoom = 3;
const middleDrag = [1];
type NewObject = Omit<AuthoredCard, 'id' | 'placement'>;
export type PinCanvasObject = (object: NewObject, feedback?: ProjectFeedback) => void;
type Tool = 'select' | 'pan' | 'connect';
type PresentationPath = 'overview' | keyof typeof engineeringPaths;
type Instance = ReactFlowInstance<CanvasNode, CanvasEdge>;
export type InspectedLink = BoardLink & { sourceTitle: string; targetTitle: string };

function ports(source: Placement, target: Placement) {
  const x = target.x + target.width / 2 - source.x - source.width / 2;
  const y = target.y + target.height / 2 - source.y - source.height / 2;
  if (Math.abs(y) < 16 && Math.abs(x) > 2.5 * Math.min(source.width, target.width)) {
    return [Position.Bottom, Position.Bottom];
  }
  if (Math.abs(x) < 16 && Math.abs(y) > 2.5 * Math.min(source.height, target.height)) {
    return [Position.Right, Position.Right];
  }
  if (Math.abs(x) >= Math.abs(y)) return x >= 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right];
  return y >= 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom];
}

function connectionHandles(width: number, height: number): CanvasNode['handles'] {
  const centers = {
    [Position.Left]: { x: 0, y: height / 2 },
    [Position.Right]: { x: width, y: height / 2 },
    [Position.Top]: { x: width / 2, y: 0 },
    [Position.Bottom]: { x: width / 2, y: height },
  };
  // Layout already owns node geometry. Explicit ports keep edges mounted across controlled updates.
  return sides.flatMap(position => {
    const bounds = { ...centers[position], position, width: 0, height: 0 };
    return [
      { ...bounds, type: 'source' as const, id: `out-${position}` },
      { ...bounds, type: 'target' as const, id: `in-${position}` },
    ];
  });
}

export function CanvasBoard({ seed, session, highlight, theme, empty, inspect, importing, presenting, onInspect }: {
  seed: BoardScene;
  session: BoardSession;
  highlight: string[];
  theme: 'light' | 'dark';
  importing: boolean;
  presenting: boolean;
  onInspect: () => void;
  empty?: ReactNode;
  inspect: (card: Card | undefined, link: InspectedLink | undefined, close: () => void, pin: PinCanvasObject) => ReactNode;
}) {
  const scene = useMemo(() => projectBoard(seed, session.document), [seed, session.document]);
  const byId = useMemo(() => new Map(scene.cards.map(card => [card.id, card])), [scene.cards]);
  const [tool, setTool] = useState<Tool>('select');
  const [connectFrom, setConnectFrom] = useState<string>();
  const [menu, setMenu] = useState(false);
  const [outline, setOutline] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(session.viewport.current?.zoom ?? 1);
  const [ready, setReady] = useState(false);
  const [presentationPath, setPresentationPath] = useState<PresentationPath>('overview');
  const [presentationStep, setPresentationStep] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const instance = useRef<Instance>();
  const inspectButton = useRef<HTMLButtonElement>(null);
  const outlineButton = useRef<HTMLButtonElement>(null);
  const ignoreGesture = useRef(false);
  const focusAfterInspect = useRef<string>();
  const editingViewport = useRef(session.viewport.current);
  const cardSelection = scene.cards.filter(card => session.selected.includes(card.id));
  const selectedCard = cardSelection.length === 1 ? cardSelection[0] : undefined;
  const selectedLink = scene.links.find(link => session.selectedLinks.includes(link.id));
  const selectedItem = selectedCard ?? selectedLink;
  const showInspector = !presenting && inspectOpen && !!selectedItem;
  const canGroup = cardSelection.filter(card => card.kind !== 'group' && !card.placement.groupId).length > 1;
  const outlineItems = outline ? scene.cards.filter(card => card.title.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const pathSteps = presentationPath === 'overview' ? [] : engineeringPaths[presentationPath];

  function fit(items: Card[], animate = true, alignTop = false) {
    const area = bounds(items);
    const host = frame.current;
    if (!area || !host || !instance.current) return;
    const compact = host.clientWidth <= 740;
    const sheet = compact ? host.parentElement?.querySelector('.board-inspector')?.getBoundingClientRect() : undefined;
    const heightAboveSheet = sheet ? sheet.top - host.getBoundingClientRect().top : 0;
    const top = compact ? 76 : 65;
    const bottom = heightAboveSheet > 180 ? heightAboveSheet - 10 : host.clientHeight - 67;
    const height = Math.max(100, bottom - top);
    const overlay = !compact && items.length === 1 ? host.parentElement?.querySelector('.board-inspector')?.getBoundingClientRect() : undefined;
    const width = host.clientWidth - (overlay ? overlay.width + 24 : 0);
    const fitted = getViewportForBounds(area, width, height, minimumZoom, 1.14, compact ? '24px' : '34px');
    const viewport = { ...fitted, y: alignTop ? top + 36 - area.y * fitted.zoom : fitted.y + top };
    session.viewport.current = viewport;
    setZoom(viewport.zoom);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    void instance.current.setViewport(viewport, { duration: animate && !motion ? 270 : 0 });
  }

  useEffect(() => {
    if (ready && !importing && !session.viewport.current && scene.cards.length) {
      const compact = (frame.current?.clientWidth ?? 0) <= 740;
      const first = scene.cards.find(card => card.kind === 'document') ?? scene.cards[0]!;
      const link = scene.links.find(item => item.origin === 'document' && item.source === first.id);
      const neighbor = link && byId.get(link.target);
      const adjacent = neighbor && Math.abs(neighbor.placement.y - first.placement.y) < 120;
      fit(compact ? adjacent ? [first, neighbor] : [first] : scene.cards, false, compact);
    }
  }, [ready, importing, scene.cards.length]);

  useEffect(() => {
    if (!presenting) {
      const previous = editingViewport.current;
      if (previous && instance.current) void instance.current.setViewport(previous);
      editingViewport.current = undefined;
      return;
    }
    editingViewport.current = session.viewport.current;
    setPresentationPath('overview');
    setPresentationStep(0);
    chooseTool('select');
    setOutline(false);
    setInspectOpen(false);
    setMenu(false);
    session.select([]);
    session.selectLinks([]);
    fit(scene.cards);
  }, [presenting]);

  useEffect(() => {
    if (!showInspector || !selectedCard) return;
    const host = frame.current;
    const panel = host?.parentElement?.querySelector('.board-inspector')?.getBoundingClientRect();
    const object = Array.from(host?.querySelectorAll<HTMLElement>('.react-flow__node') ?? [])
      .find(node => node.dataset.id === selectedCard.id)?.getBoundingClientRect();
    const covered = panel && object && (object.right > panel.left && object.left < panel.right &&
      object.bottom > panel.top && object.top < panel.bottom);
    if (focusAfterInspect.current === selectedCard.id || covered) fit([selectedCard]);
    focusAfterInspect.current = undefined;
  }, [showInspector, selectedCard?.id]);

  useEffect(() => {
    const host = frame.current;
    if (!host) return;
    function wheel(event: WheelEvent) {
      if (!host || !instance.current || !(event.target instanceof Element) ||
          event.target.closest('button, input, textarea, .board-outline, .board-empty')) return;
      event.preventDefault();
      event.stopPropagation();
      const current = instance.current.getViewport();
      const box = host.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1;
      const trackpad = event.deltaMode === 0 && (event.deltaX !== 0 || Math.abs(event.deltaY) < 50);
      const next = trackpad && !event.ctrlKey
        ? { ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }
        : zoomAt(current, { x: event.clientX - box.left, y: event.clientY - box.top },
            Math.max(minimumZoom, Math.min(maximumZoom, current.zoom * Math.exp(-event.deltaY * unit * .002))));
      session.viewport.current = next;
      setZoom(next.zoom);
      void instance.current.setViewport(next);
    }
    host.addEventListener('wheel', wheel, { passive: false, capture: true });
    return () => host.removeEventListener('wheel', wheel, true);
  }, [session.viewport]);

  function begin() {
    ignoreGesture.current = false;
    session.begin();
  }

  function finish() {
    // React Flow reports the terminal position after its drag-stop callback.
    queueMicrotask(() => session.finish());
  }

  const nodes: CanvasNode[] = [...scene.cards].sort((left, right) =>
    Number(right.kind === 'group') - Number(left.kind === 'group')).map(card => {
    const { x, y, width, height, groupId } = card.placement;
    const parent = groupId ? byId.get(groupId)?.placement : undefined;
    const position = parent ? { x: x - parent.x, y: y - parent.y } : { x, y };
    return {
      id: card.id, type: 'card', position, parentId: groupId, width, height, measured: { width, height }, ariaLabel: card.title,
      handles: card.kind === 'group' ? undefined : connectionHandles(width, height),
      selected: session.selected.includes(card.id), draggable: !presenting && tool === 'select', deletable: false,
      selectable: !presenting, connectable: tool === 'connect' && card.kind !== 'group', zIndex: card.kind === 'group' ? -1 : 1,
      data: { card, emphasized: !!card.concept && highlight.includes(card.concept.id),
        connecting: connectFrom === card.id, detail: zoom >= 1.25, resizeStart: begin, resizeEnd: finish,
        presentationContext: presenting && pathSteps.length > 0 && card.id !== pathSteps[presentationStep],
        preview: !presenting && card.visualization ? () => { selection(card.id); openInspection(); } : undefined },
    };
  });
  const edges: CanvasEdge[] = scene.links.map(link => {
    const [autoSource, autoTarget] = ports(byId.get(link.source)!.placement, byId.get(link.target)!.placement);
    const source = link.fromSide ?? autoSource;
    const target = link.toSide ?? autoTarget;
    const role = link.role ?? (link.origin === 'document' ? 'structural' : link.origin === 'authored' ? 'data' : 'structural');
    const markerEnd = { type: MarkerType.Arrow, width: 19, height: 19, color: `var(--board-edge-${role})` };
    const selected = session.selectedLinks.includes(link.id);
    return {
      id: link.id, type: 'relation', source: link.source, target: link.target, deletable: false,
      sourceHandle: `out-${source}`, targetHandle: `in-${target}`, markerEnd,
      ariaLabel: `${byId.get(link.source)!.title} ${link.label} ${byId.get(link.target)!.title}`,
      className: `board-edge board-edge--${link.origin} board-edge--role-${role}`,
      selected, selectable: !presenting, data: { link, showLabel: role !== 'annotation' && role !== 'structural' &&
        (session.document.kind === 'engineering' ? zoom >= .55 : zoom >= .86) },
    };
  });

  const onNodesChange: OnNodesChange<CanvasNode> = changes => {
    const selection = changes.getByType('select');
    if (selection.length) session.select(old => {
      const next = new Set(old);
      for (const change of selection) change.selected ? next.add(change.id) : next.delete(change.id);
      return [...next];
    });
    const moves = changes.getByType('position').filter(change => change.position);
    const resizes = changes.getByType('dimensions').filter(change => change.setAttributes && change.dimensions);
    if (ignoreGesture.current || (!moves.length && !resizes.length)) return;
    session.update(board => {
      const placements = { ...board.placements };
      const get = (id: string) => placements[id] ?? byId.get(id)?.placement;
      let modified = false;
      const movedGroups = new Set(moves.filter(change => byId.get(change.id)?.kind === 'group').map(change => change.id));
      for (const move of moves) {
        const placement = get(move.id);
        if (!placement || !move.position || (placement.groupId && movedGroups.has(placement.groupId))) continue;
        const parent = placement.groupId ? get(placement.groupId) : undefined;
        const x = move.position.x + (parent?.x ?? 0);
        const y = move.position.y + (parent?.y ?? 0);
        if (placement.x === x && placement.y === y) continue;
        placements[move.id] = { ...placement, x, y };
        modified = true;
        if (movedGroups.has(move.id)) for (const card of scene.cards) {
          const child = get(card.id);
          if (child?.groupId === move.id) placements[card.id] = {
            ...child, x: child.x + x - placement.x, y: child.y + y - placement.y,
          };
        }
      }
      for (const change of resizes) {
        const placement = get(change.id);
        if (!placement || !change.dimensions || byId.get(change.id)?.kind === 'group') continue;
        const { width, height } = change.dimensions;
        if (placement.width === width && placement.height === height) continue;
        modified = true;
        placements[change.id] = { ...placement, width, height };
      }
      return modified ? { ...board, placements } : board;
    });
  };

  const onEdgesChange: OnEdgesChange<CanvasEdge> = changes => {
    const selection = changes.getByType('select');
    if (selection.length) session.selectLinks(old => {
      const next = new Set(old);
      for (const change of selection) change.selected ? next.add(change.id) : next.delete(change.id);
      return [...next];
    });
  };

  function validConnection(source: string, target: string) {
    return source !== target && [source, target].every(id => !!byId.get(id) && byId.get(id)?.kind !== 'group') &&
      !scene.links.some(link => link.source === source && link.target === target);
  }

  function connect({ source, target }: Pick<Connection, 'source' | 'target'>) {
    if (!validConnection(source, target)) return;
    const id = crypto.randomUUID();
    session.update(board => ({ ...board, authoredLinks: [...board.authoredLinks, {
      id, source, target, label: byId.get(source)?.kind === 'annotation' ? 'Points to' : 'Related to', origin: 'authored',
      role: byId.get(source)?.kind === 'annotation' ? 'annotation' : 'data',
    }] }));
    session.select([]);
    session.selectLinks([id]);
    setConnectFrom(undefined);
    setTool('select');
    openInspection();
  }

  function selection(id: string) {
    session.select([id]);
    session.selectLinks([]);
    ignoreGesture.current = false;
  }

  function add(object: NewObject, feedback?: ProjectFeedback) {
    const host = frame.current?.getBoundingClientRect();
    if (!host || !instance.current) return;
    const top = instance.current.screenToFlowPosition({ x: host.left + 24, y: host.top + 64 });
    const right = instance.current.screenToFlowPosition({ x: host.right - 24, y: host.bottom - 98 });
    const beside = selectedCard ?? (feedback && selectedLink ? byId.get(selectedLink.source) : undefined);
    const placement = placeCard(scene.cards, rect(top.x, top.y, right.x - top.x, right.y - top.y), beside);
    const id = crypto.randomUUID();
    const card: AuthoredCard = { ...object, id, placement };
    if (feedback) card.projectObject = projectFeedbackObject(card, feedback);
    const noteLink: AuthoredLink | undefined = feedback && 'objectId' in feedback
      && selectedCard?.id === feedback.objectId && selectedCard.kind !== 'group' ? {
        id: crypto.randomUUID(), source: id, target: feedback.objectId,
        label: feedback.kind === 'requirement' ? 'Applies to' : feedback.kind === 'question' ? 'Asks about' : 'Comments on',
        role: 'annotation', origin: 'authored',
      } : undefined;
    session.update(board => ({
      ...board, authoredCards: [...board.authoredCards, card],
      authoredLinks: noteLink ? [...board.authoredLinks, noteLink] : board.authoredLinks,
    }));
    focusAfterInspect.current = id;
    selection(id);
    setMenu(false);
    openInspection();
  }

  function group() {
    const id = crypto.randomUUID();
    session.update(board => groupCards(board, cardSelection, id));
    selection(id);
  }

  function chooseTool(value: Tool) {
    setTool(value);
    setConnectFrom(undefined);
  }

  function closeInspector() {
    setInspectOpen(false);
    requestAnimationFrame(() => (inspectButton.current ?? frame.current)?.focus());
  }

  function openInspection() {
    onInspect();
    setInspectOpen(true);
  }

  function showPresentation(path: PresentationPath, step = 0) {
    setPresentationPath(path);
    setPresentationStep(step);
    if (path === 'overview') { fit(scene.cards); return; }
    const steps = engineeringPaths[path];
    const ids = (frame.current?.clientWidth ?? 0) <= 740 ? steps.slice(step, step + 1) : steps;
    fit(ids.flatMap(id => byId.get(id) ?? []));
  }

  function removeSelected() {
    session.update(board => removeAuthored(board, session.selected, session.selectedLinks));
  }

  return <section className="board-layout" aria-label="Canvas workspace">
    <div ref={frame} tabIndex={-1} className={`board-frame board-frame--${tool}`} data-board={session.document.kind}
      data-presentation-path={presenting ? presentationPath : undefined}
      onPointerCancelCapture={() => { ignoreGesture.current = true; session.cancel(); }}
      onKeyDownCapture={event => {
        if (presenting) return;
        if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return;
        if (event.key === 'Escape') {
          ignoreGesture.current = true;
          session.cancel();
          session.select([]);
          session.selectLinks([]);
          chooseTool('select');
          setMenu(false);
          setOutline(false);
          if (showInspector) closeInspector();
        }
        if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
          event.preventDefault();
          session.restore(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo');
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          removeSelected();
        }
        if (event.key.startsWith('Arrow')) ignoreGesture.current = false;
        if (event.key === 'Enter' && event.target instanceof Element && !event.target.closest('button, a')) {
          const id = event.target.closest('.react-flow__node')?.getAttribute('data-id');
          const linkId = event.target.closest('.react-flow__edge')?.getAttribute('data-id');
          if (tool === 'connect' && id && byId.get(id)?.kind !== 'group') {
            event.preventDefault();
            event.stopPropagation();
            if (connectFrom) connect({ source: connectFrom, target: id });
            else setConnectFrom(id);
          } else if (tool === 'select' && (id || linkId)) {
            event.preventDefault();
            event.stopPropagation();
            if (id) selection(id);
            else if (linkId) { session.select([]); session.selectLinks([linkId]); }
            openInspection();
          }
        }
      }}>
      <ReactFlow<CanvasNode, CanvasEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        className={theme} onInit={value => { instance.current = value; setReady(true); }}
        defaultViewport={session.viewport.current ?? { x: 0, y: 0, zoom: 1 }}
        onMove={(_, viewport) => { session.viewport.current = viewport; setZoom(viewport.zoom); }}
        minZoom={minimumZoom} maxZoom={maximumZoom} zoomOnDoubleClick={false} zoomOnScroll={false}
        nodesFocusable={!presenting} edgesFocusable={!presenting}
        zIndexMode="manual" elevateEdgesOnSelect={false}
        panOnDrag={presenting || tool === 'pan' ? true : middleDrag} panActivationKeyCode="Space"
        selectionOnDrag={!presenting && tool === 'select'} selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift" selectionKeyCode="Shift" deleteKeyCode={null}
        connectionMode={ConnectionMode.Loose} nodesConnectable={tool === 'connect'}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeDragStart={begin} onNodeDragStop={finish} onSelectionDragStart={begin} onSelectionDragStop={finish}
        onConnect={connect} isValidConnection={link => validConnection(link.source, link.target)}
        onNodeClick={(_, node) => {
          if (tool !== 'connect' || node.data.card.kind === 'group') return;
          if (connectFrom) connect({ source: connectFrom, target: node.id });
          else setConnectFrom(node.id);
        }}
        onNodeDoubleClick={(_, node) => { if (!presenting && tool === 'select') { selection(node.id); openInspection(); } }}
        onPaneClick={() => { setInspectOpen(false); setConnectFrom(undefined); setMenu(false); }}>
        <Background variant={BackgroundVariant.Dots} gap={29} size={.8} color="var(--board-dot)" />
      </ReactFlow>
      {!scene.cards.length && empty}
      {!presenting && <div className="board-outline-anchor">
        <button ref={outlineButton} type="button" className="board-icon board-raised" title="Find objects" aria-label="Find objects" aria-expanded={outline} onClick={() => setOutline(!outline)}><List size={18} /></button>
        {outline && <section className="board-outline board-raised" aria-label="Board outline" onKeyDown={event => {
          if (event.key === 'Escape') { setOutline(false); outlineButton.current?.focus(); }
        }}>
          <div className="board-outline-heading"><h2>Objects</h2><button type="button" className="board-icon" aria-label="Close outline" onClick={() => setOutline(false)}><X size={16} /></button></div>
          <input aria-label="Search objects" placeholder="Search objects" value={query} onChange={event => setQuery(event.target.value)} />
          {outlineItems.length === 0 && <p role="status" className="board-outline-empty">No matching objects.</p>}
          <ul>{outlineItems.map(card =>
            <li key={card.id}><button type="button" aria-pressed={session.selected.includes(card.id)} onClick={() => {
              focusAfterInspect.current = card.id;
              selection(card.id);
              setOutline(false);
              openInspection();
            }}>{card.title}</button></li>)}</ul>
        </section>}
      </div>}
      <div className="board-bottom">
        {presenting && <div className="board-presentation" aria-label="Presentation views">
          <div className="board-raised board-presentation-views" role="group" aria-label="Presentation views">
            <button type="button" aria-pressed={presentationPath === 'overview'} onClick={() => showPresentation('overview')}>Overview</button>
            <button type="button" aria-pressed={presentationPath === 'index'} onClick={() => showPresentation('index')}>Index a document</button>
            <button type="button" aria-pressed={presentationPath === 'answer'} onClick={() => showPresentation('answer')}>Answer with evidence</button>
          </div>
          {pathSteps.length > 0 && <div className="board-raised board-presentation-steps" role="group" aria-label="Path steps">
            <button type="button" className="board-icon" aria-label="Previous step" disabled={presentationStep === 0}
              onClick={() => showPresentation(presentationPath, presentationStep - 1)}><ChevronLeft size={18} /></button>
            <span role="status">{byId.get(pathSteps[presentationStep] ?? '')?.title}</span>
            <button type="button" className="board-icon" aria-label="Next step" disabled={presentationStep >= pathSteps.length - 1}
              onClick={() => showPresentation(presentationPath, presentationStep + 1)}><ChevronRight size={18} /></button>
          </div>}
        </div>}
        {!presenting && tool === 'connect' && <p className="board-tool-hint" role="status">{connectFrom ? 'Choose the destination' : 'Choose the first object'}</p>}
        {!presenting && <div className="board-toolbar board-raised" role="toolbar" aria-label="Canvas tools">
          <button type="button" className="board-icon" aria-label="Select" title="Select" aria-pressed={tool === 'select'} onClick={() => chooseTool('select')}><MousePointer2 size={18} /></button>
          <button type="button" className="board-icon" aria-label="Pan" title="Pan" aria-pressed={tool === 'pan'} onClick={() => chooseTool('pan')}><Hand size={18} /></button>
          {scene.cards.filter(card => card.kind !== 'group').length > 1 && <button type="button" className="board-icon" aria-label="Connect objects" title="Connect objects" aria-pressed={tool === 'connect'} onClick={() => chooseTool(tool === 'connect' ? 'select' : 'connect')}><Link2 size={18} /></button>}
          <div className="board-add-anchor">
            <button type="button" className="board-icon" aria-label="Add object" title="Add object" aria-expanded={menu} onClick={() => setMenu(!menu)}><Plus size={20} /></button>
            {menu && <div className="board-add-menu board-raised">
              <button type="button" onClick={() => add({ kind: 'annotation', title: 'New note', description: '' })}>Note</button>
              <button type="button" onClick={() => add({ kind: 'text', title: 'New text', description: '' })}>Text</button>
              <button type="button" onClick={() => add({ kind: 'heading', title: 'New heading', description: '' })}>Heading</button>
              <button type="button" onClick={() => add({ kind: 'illustration', illustration: 'document', title: 'New illustration', description: '' })}>Illustration</button>
              <button type="button" onClick={() => add({ kind: 'explanation', title: 'New explanation', description: '' })}>Explanation</button>
            </div>}
          </div>
          <div className="board-tool-separator" />
          <button type="button" className="board-icon" aria-label="Undo" title="Undo" disabled={!session.canUndo} onClick={() => session.restore('undo')}><Undo2 size={17} /></button>
          <button type="button" className="board-icon" aria-label="Redo" title="Redo" disabled={!session.canRedo} onClick={() => session.restore('redo')}><Redo2 size={17} /></button>
          {canGroup && <button type="button" className="board-icon" aria-label="Group selection" title="Group selection" onClick={group}><BoxSelect size={19} /></button>}
          {selectedItem && <button type="button" ref={inspectButton} className="board-inspect-button" aria-expanded={showInspector}
            onClick={() => showInspector ? closeInspector() : openInspection()}>Inspect</button>}
        </div>}
        <div className="board-zoom board-raised" role="toolbar" aria-label="Canvas view">
          <button type="button" className="board-icon" aria-label="Zoom out" title="Zoom out" onClick={() => void instance.current?.zoomOut()}><Minus size={16} /></button>
          <span aria-label="Zoom level">{Math.round(zoom * 100)}%</span>
          <button type="button" className="board-icon" aria-label="Zoom in" title="Zoom in" onClick={() => void instance.current?.zoomIn()}><Plus size={16} /></button>
          <button type="button" className="board-icon" aria-label="Fit board" title="Fit board" disabled={!scene.cards.length} onClick={() => fit(scene.cards)}><Maximize size={16} /></button>
          {cardSelection.length > 0 && <button type="button" className="board-icon" aria-label="Fit selection" title="Fit selection" onClick={() => fit(cardSelection)}><Scan size={18} /></button>}
        </div>
      </div>
    </div>
    {showInspector && inspect(selectedCard, selectedLink ? {
      ...selectedLink, sourceTitle: byId.get(selectedLink.source)!.title, targetTitle: byId.get(selectedLink.target)!.title,
    } : undefined, closeInspector, add)}
  </section>;
}
