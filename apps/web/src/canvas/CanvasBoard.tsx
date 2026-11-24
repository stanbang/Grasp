import {
  Background, BackgroundVariant, ConnectionMode, MarkerType, Position, ReactFlow, SelectionMode,
  getViewportForBounds, type Connection, type OnEdgesChange, type OnNodesChange, type ReactFlowInstance,
} from '@xyflow/react';
import {
  BoxSelect, Hand, Link2, List, Maximize, Minus, MousePointer2, Plus, Redo2, Scan, Undo2, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CanvasCard, Relation, type CanvasEdge, type CanvasNode } from './CanvasObjects';
import { bounds, groupCards, placeCard, projectBoard, rect, removeAuthored, zoomAt, type BoardLink, type BoardScene, type Card, type Placement } from './board';
import type { BoardSession } from './use-board';

const nodeTypes = { card: CanvasCard };
const edgeTypes = { relation: Relation };
const minimumZoom = 0.15;
const maximumZoom = 3;
const middleDrag = [1];
const markerEnd = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--board-edge)' };
type Tool = 'select' | 'pan' | 'connect';
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

export function CanvasBoard({ seed, session, highlight, theme, empty, inspect, importing }: {
  seed: BoardScene;
  session: BoardSession;
  highlight: string[];
  theme: 'light' | 'dark';
  importing: boolean;
  empty?: ReactNode;
  inspect: (card: Card | undefined, link: InspectedLink | undefined, close: () => void) => ReactNode;
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
  const frame = useRef<HTMLDivElement>(null);
  const instance = useRef<Instance>();
  const inspectButton = useRef<HTMLButtonElement>(null);
  const ignoreGesture = useRef(false);
  const focusAfterInspect = useRef<string>();
  const cardSelection = scene.cards.filter(card => session.selected.includes(card.id));
  const selectedCard = cardSelection.length === 1 ? cardSelection[0] : undefined;
  const selectedLink = scene.links.find(link => session.selectedLinks.includes(link.id));
  const selectedItem = selectedCard ?? selectedLink;
  const showInspector = inspectOpen && !!selectedItem;
  const canGroup = cardSelection.filter(card => card.kind !== 'group' && !card.placement.groupId).length > 1;

  function fit(items: Card[], animate = true) {
    const area = bounds(items);
    const host = frame.current;
    if (!area || !host || !instance.current) return;
    const compact = host.clientWidth < 600;
    const sheet = compact ? host.parentElement?.querySelector('.board-inspector')?.getBoundingClientRect() : undefined;
    const heightAboveSheet = sheet ? sheet.top - host.getBoundingClientRect().top : 0;
    const height = heightAboveSheet > 140 ? heightAboveSheet : host.clientHeight;
    const viewport = getViewportForBounds(area, host.clientWidth, height, minimumZoom, 1.14, compact ? '28px' : '52px');
    session.viewport.current = viewport;
    setZoom(viewport.zoom);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    void instance.current.setViewport(viewport, { duration: animate && !motion ? 270 : 0 });
  }

  useEffect(() => {
    if (ready && !importing && !session.viewport.current && scene.cards.length) {
      const compact = (frame.current?.clientWidth ?? 0) < 600;
      fit(compact ? [scene.cards.find(card => card.kind === 'document') ?? scene.cards[0]!] : scene.cards, false);
    }
  }, [ready, importing, scene.cards.length]);

  useEffect(() => {
    if (!showInspector || !focusAfterInspect.current) return;
    const card = byId.get(focusAfterInspect.current);
    focusAfterInspect.current = undefined;
    if (card) fit([card]);
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
      id: card.id, type: 'card', position, parentId: groupId, width, height, ariaLabel: card.title,
      selected: session.selected.includes(card.id), draggable: tool === 'select', deletable: false,
      connectable: tool === 'connect' && card.kind !== 'group', zIndex: card.kind === 'group' ? -1 : 1,
      data: { card, emphasized: !!card.concept && highlight.includes(card.concept.id),
        connecting: connectFrom === card.id, resizeStart: begin, resizeEnd: finish },
    };
  });
  const edges: CanvasEdge[] = scene.links.map(link => {
    const [source, target] = ports(byId.get(link.source)!.placement, byId.get(link.target)!.placement);
    return {
      id: link.id, type: 'relation', source: link.source, target: link.target, deletable: false,
      sourceHandle: `out-${source}`, targetHandle: `in-${target}`, markerEnd,
      ariaLabel: `${byId.get(link.source)!.title} ${link.label} ${byId.get(link.target)!.title}`,
      className: `board-edge board-edge--${link.origin}`,
      selected: session.selectedLinks.includes(link.id), data: { link },
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
      id, source, target, label: 'Related to', origin: 'authored',
    }] }));
    session.select([]);
    session.selectLinks([id]);
    setConnectFrom(undefined);
    setTool('select');
    setInspectOpen(true);
  }

  function selection(id: string) {
    session.select([id]);
    session.selectLinks([]);
    ignoreGesture.current = false;
  }

  function add(kind: 'annotation' | 'explanation') {
    const host = frame.current?.getBoundingClientRect();
    if (!host || !instance.current) return;
    const top = instance.current.screenToFlowPosition({ x: host.left + 24, y: host.top + 64 });
    const right = instance.current.screenToFlowPosition({ x: host.right - 24, y: host.bottom - 98 });
    const placement = placeCard(scene.cards, rect(top.x, top.y, right.x - top.x, right.y - top.y), selectedCard);
    const id = crypto.randomUUID();
    session.update(board => ({ ...board, authoredCards: [...board.authoredCards, {
      id, kind, title: kind === 'annotation' ? 'New note' : 'New explanation',
      description: '', placement,
    }] }));
    focusAfterInspect.current = id;
    selection(id);
    setMenu(false);
    setInspectOpen(true);
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

  function removeSelected() {
    session.update(board => removeAuthored(board, session.selected, session.selectedLinks));
  }

  return <section className={`board-layout${showInspector ? ' board-layout--inspecting' : ''}`} aria-label="Canvas workspace">
    <div ref={frame} tabIndex={-1} className={`board-frame board-frame--${tool}`} data-board={session.document.kind}
      onPointerCancelCapture={() => { ignoreGesture.current = true; session.cancel(); }}
      onKeyDownCapture={event => {
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
        if (event.key === 'Enter' && tool === 'connect' && event.target instanceof Element) {
          const id = event.target.closest<HTMLElement>('.react-flow__node')?.dataset.id;
          if (!id || byId.get(id)?.kind === 'group') return;
          event.preventDefault();
          event.stopPropagation();
          if (connectFrom) connect({ source: connectFrom, target: id });
          else setConnectFrom(id);
        }
      }}>
      <ReactFlow<CanvasNode, CanvasEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        className={theme} onInit={value => { instance.current = value; setReady(true); }}
        defaultViewport={session.viewport.current ?? { x: 0, y: 0, zoom: 1 }}
        onMove={(_, viewport) => { session.viewport.current = viewport; setZoom(viewport.zoom); }}
        minZoom={minimumZoom} maxZoom={maximumZoom} zoomOnDoubleClick={false} zoomOnScroll={false}
        zIndexMode="manual" elevateEdgesOnSelect={false}
        panOnDrag={tool === 'pan' ? true : middleDrag} panActivationKeyCode="Space"
        selectionOnDrag={tool === 'select'} selectionMode={SelectionMode.Partial}
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
        onNodeDoubleClick={(_, node) => { if (tool === 'select') { selection(node.id); setInspectOpen(true); } }}
        onPaneClick={() => { setInspectOpen(false); setConnectFrom(undefined); setMenu(false); }}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.1} color="var(--board-dot)" />
      </ReactFlow>
      {!scene.cards.length && empty}
      <div className="board-outline-anchor">
        <button type="button" className="board-icon board-raised" title="Find objects" aria-label="Find objects" aria-expanded={outline} onClick={() => setOutline(!outline)}><List size={18} /></button>
        {outline && <section className="board-outline board-raised" aria-label="Board outline">
          <div className="board-outline-heading"><h2>Objects</h2><button type="button" className="board-icon" aria-label="Close outline" onClick={() => setOutline(false)}><X size={16} /></button></div>
          <input aria-label="Search objects" placeholder="Search objects" value={query} onChange={event => setQuery(event.target.value)} />
          <ul>{scene.cards.filter(card => card.title.toLowerCase().includes(query.trim().toLowerCase())).map(card =>
            <li key={card.id}><button type="button" aria-pressed={session.selected.includes(card.id)} onClick={() => {
              focusAfterInspect.current = card.id;
              selection(card.id);
              setOutline(false);
              setInspectOpen(true);
            }}>{card.title}</button></li>)}</ul>
        </section>}
      </div>
      <div className="board-bottom">
        {tool === 'connect' && <p className="board-tool-hint" role="status">{connectFrom ? 'Choose the destination' : 'Choose the first card'}</p>}
        <div className="board-toolbar board-raised" role="toolbar" aria-label="Canvas tools">
          <button type="button" className="board-icon" aria-label="Select" title="Select" aria-pressed={tool === 'select'} onClick={() => chooseTool('select')}><MousePointer2 size={18} /></button>
          <button type="button" className="board-icon" aria-label="Pan" title="Pan" aria-pressed={tool === 'pan'} onClick={() => chooseTool('pan')}><Hand size={18} /></button>
          <button type="button" className="board-icon" aria-label="Connect cards" title="Connect cards" aria-pressed={tool === 'connect'} disabled={scene.cards.filter(card => card.kind !== 'group').length < 2} onClick={() => chooseTool(tool === 'connect' ? 'select' : 'connect')}><Link2 size={18} /></button>
          <div className="board-add-anchor">
            <button type="button" className="board-icon" aria-label="Add object" title="Add object" aria-expanded={menu} onClick={() => setMenu(!menu)}><Plus size={20} /></button>
            {menu && <div className="board-add-menu board-raised">
              <button type="button" onClick={() => add('annotation')}>Note</button>
              <button type="button" onClick={() => add('explanation')}>Explanation</button>
            </div>}
          </div>
          <div className="board-tool-separator" />
          <button type="button" className="board-icon" aria-label="Undo" title="Undo" disabled={!session.canUndo} onClick={() => session.restore('undo')}><Undo2 size={17} /></button>
          <button type="button" className="board-icon" aria-label="Redo" title="Redo" disabled={!session.canRedo} onClick={() => session.restore('redo')}><Redo2 size={17} /></button>
          {canGroup && <button type="button" className="board-icon" aria-label="Group selection" title="Group selection" onClick={group}><BoxSelect size={19} /></button>}
          {selectedItem && <button type="button" ref={inspectButton} className="board-inspect-button" aria-expanded={showInspector} onClick={() => setInspectOpen(!inspectOpen)}>Inspect</button>}
        </div>
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
    } : undefined, closeInspector)}
  </section>;
}
