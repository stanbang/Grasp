import type { Citation, Document, GraphNode, GraphResponse } from '../types/contracts';
import type { CanvasConnection, CanvasEvidenceRef, CanvasObject } from '../types/canvas-contracts';
import type { Illustration } from './TechnicalIllustration';
import type { SimilarityPlot } from './CanvasVisualization';

export type BoardKind = 'knowledge' | 'engineering' | 'project';
export type SourceSelection = Citation & { sourceSpan?: Pick<CanvasEvidenceRef, 'charStart' | 'charEnd'> };
export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type Placement = Rect & { groupId?: string };
export type ObjectKind = 'concept' | 'document' | 'component' | 'explanation' | 'annotation' | 'group'
  | 'heading' | 'text' | 'illustration' | 'evidence' | 'visualization';
export type NoteStyle = 'plain' | 'underline' | 'callout';
export type LinkRole = 'structural' | 'data' | 'process' | 'annotation';
export type Card = {
  id: string;
  kind: ObjectKind;
  title: string;
  description: string;
  placement: Placement;
  concept?: GraphNode;
  document?: Document;
  sourcePath?: string;
  message?: string;
  illustration?: Illustration;
  noteStyle?: NoteStyle;
  evidence?: Citation;
  visualization?: SimilarityPlot;
  prominence?: 'primary' | 'secondary';
  projectObject?: CanvasObject;
};

export type BoardLink = {
  id: string;
  source: string;
  target: string;
  label: string;
  origin: 'semantic' | 'document' | 'repository' | 'authored';
  canonicalId?: string;
  docIds?: string[];
  role?: LinkRole;
  fromSide?: 'left' | 'right' | 'top' | 'bottom';
  toSide?: 'left' | 'right' | 'top' | 'bottom';
  routeY?: number;
};

export type BoardScene = { cards: Card[]; links: BoardLink[] };
export type AuthoredCard = Pick<Card, 'id' | 'title' | 'description' | 'placement' | 'illustration' | 'noteStyle' | 'evidence'> & {
  kind: 'explanation' | 'annotation' | 'group' | 'heading' | 'text' | 'illustration' | 'evidence';
  projectObject?: CanvasObject;
};
export type AuthoredLink = Pick<BoardLink, 'id' | 'source' | 'target' | 'label' | 'role'> & {
  origin: 'authored';
  projectConnection?: CanvasConnection;
};
export type BoardDocument = {
  schemaVersion: 1;
  kind: BoardKind;
  revision: number;
  placements: Record<string, Placement>;
  authoredCards: AuthoredCard[];
  authoredLinks: AuthoredLink[];
};

const cardWidth = 228;
const cardHeight = 116;
const conceptColumn = 312;
const conceptRow = 137;
const sourceColumn = 310;

export const conceptObjectId = (id: string) => `concept:${id}`;
export const documentObjectId = (id: string) => `document:${id}`;

export function emptyBoard(kind: BoardKind): BoardDocument {
  return { schemaVersion: 1, kind, revision: 0, placements: {}, authoredCards: [], authoredLinks: [] };
}

export function rect(x: number, y: number, width = cardWidth, height = cardHeight): Rect {
  return { x, y, width, height };
}

export function bounds(cards: readonly Card[]): Rect | null {
  if (!cards.length) return null;
  const left = Math.min(...cards.map(card => card.placement.x));
  const top = Math.min(...cards.map(card => card.placement.y));
  return rect(left, top,
    Math.max(...cards.map(({ placement }) => placement.x + placement.width)) - left,
    Math.max(...cards.map(({ placement }) => placement.y + placement.height)) - top,
  );
}

export function placeCard(cards: Card[], visible: Rect, beside?: Card): Rect {
  const padding = 22;
  const fits = (candidate: Rect) =>
    candidate.x >= visible.x && candidate.y >= visible.y &&
    candidate.x + candidate.width <= visible.x + visible.width &&
    candidate.y + candidate.height <= visible.y + visible.height &&
    cards.every(({ placement }) => candidate.x + candidate.width + padding <= placement.x ||
      candidate.x >= placement.x + placement.width + padding ||
      candidate.y + candidate.height + padding <= placement.y ||
      candidate.y >= placement.y + placement.height + padding);

  if (beside) {
    const { x, y, width, height } = beside.placement;
    const near = [rect(x + width + padding, y), rect(x - cardWidth - padding, y),
      rect(x, y + height + padding), rect(x, y - cardHeight - padding)].find(fits);
    if (near) return near;
  }
  const center = rect(visible.x + (visible.width - cardWidth) / 2, visible.y + (visible.height - cardHeight) / 2);
  if (fits(center) || !cards.length) return center;
  const available: Rect[] = [];
  for (let y = visible.y; y + cardHeight <= visible.y + visible.height; y += cardHeight / 2) {
    for (let x = visible.x; x + cardWidth <= visible.x + visible.width; x += cardWidth / 2) {
      const candidate = rect(x, y);
      if (fits(candidate)) available.push(candidate);
    }
  }
  const closest = available.sort((a, b) =>
    Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y))[0];
  const occupied = bounds(cards);
  return closest ?? (occupied ? rect(occupied.x + occupied.width + padding * 2, center.y) : center);
}

function conceptOrder(graph: GraphResponse): GraphNode[] {
  const nodes = [...graph.nodes].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map(nodes.map(node => [node.id, 0]));
  for (const link of graph.edges) {
    if (!byId.has(link.source) || !byId.has(link.target)) continue;
    const links = outgoing.get(link.source) ?? new Set<string>();
    if (!links.has(link.target)) incoming.set(link.target, incoming.get(link.target)! + 1);
    links.add(link.target);
    outgoing.set(link.source, links);
  }
  const seen = new Set<string>();
  const order: GraphNode[] = [];
  for (const node of [...nodes.filter(node => incoming.get(node.id) === 0), ...nodes]) {
    const pending = [node.id];
    for (let index = 0; index < pending.length; index++) {
      const id = pending[index]!;
      if (seen.has(id)) continue;
      seen.add(id);
      order.push(byId.get(id)!);
      const neighbors = [...(outgoing.get(id) ?? [])];
      neighbors.sort((left, right) => byId.get(left)!.label.localeCompare(byId.get(right)!.label));
      for (const neighbor of neighbors) {
        const count = incoming.get(neighbor)! - 1;
        incoming.set(neighbor, count);
        if (count === 0) pending.push(neighbor);
      }
    }
  }
  return order;
}

export function knowledgeScene(graph: GraphResponse, documents: readonly Document[]): BoardScene {
  const nodes = conceptOrder(graph);
  const sortedDocuments = [...documents].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const knownDocuments = new Set(sortedDocuments.map(document => document.id));
  const bySource = new Map<string, GraphNode[]>();
  const shared: GraphNode[] = [];
  const remaining: GraphNode[] = [];
  for (const concept of nodes) {
    const ids = concept.docIds.filter(id => knownDocuments.has(id));
    if (ids.length > 1) shared.push(concept);
    else if (ids[0]) {
      const members = bySource.get(ids[0]) ?? [];
      members.push(concept);
      bySource.set(ids[0], members);
    } else remaining.push(concept);
  }
  const related = new Set(graph.edges.filter(edge => !/^appears alongside$/i.test(edge.relationshipLabel.trim()))
    .flatMap(edge => [edge.source, edge.target]));
  const cards: Card[] = [];
  const links: BoardLink[] = graph.edges.map(edge => ({
    id: `relation:${edge.id}`, source: conceptObjectId(edge.source), target: conceptObjectId(edge.target),
    label: edge.relationshipLabel, canonicalId: edge.id, origin: 'semantic', docIds: edge.docIds,
    role: /^appears alongside$/i.test(edge.relationshipLabel.trim()) ? 'structural' : 'data',
  }));
  let y = 0;
  function addCluster(members: GraphNode[], x: number) {
    members.forEach((concept, index) => {
      const main = index === 0 || related.has(concept.id);
      cards.push({
        id: conceptObjectId(concept.id), kind: 'concept', title: concept.label,
        description: concept.summary, concept, prominence: main ? 'primary' : 'secondary',
        placement: rect(x + (index % 3) * conceptColumn, y + Math.floor(index / 3) * conceptRow,
          main ? 246 : 222, main ? 108 : 85),
      });
    });
    y += Math.max(1, Math.ceil(members.length / 3)) * conceptRow + 48;
  }
  for (const document of sortedDocuments) {
    const id = documentObjectId(document.id);
    const members = bySource.get(document.id) ?? [];
    cards.push({ id, kind: 'document', title: document.name, description: '', document, illustration: 'document',
      placement: rect(0, y) });
    const representative = members[0] ?? shared.find(node => node.docIds.includes(document.id));
    if (representative) links.push({
      id: `source:${document.id}`, source: id, target: conceptObjectId(representative.id),
      label: 'source for', origin: 'document', docIds: [document.id],
    });
    addCluster(members, sourceColumn);
  }
  if (shared.length) {
    cards.push({ id: 'heading:shared', kind: 'heading', title: 'Shared concepts', description: '', placement: rect(0, y, 245, 42) });
    addCluster(shared, sourceColumn);
  }
  if (remaining.length) addCluster(remaining, sortedDocuments.length ? sourceColumn : 0);
  return { cards, links };
}

export function projectBoard(seed: BoardScene, board: BoardDocument): BoardScene {
  const liveSources = new Set(seed.cards.flatMap(card => card.document ? [card.document.id] : []));
  const objects = [...seed.cards, ...board.authoredCards.filter(card => !card.evidence || liveSources.has(card.evidence.docId))];
  const groups = new Set(objects.filter(card => card.kind === 'group').map(card => card.id));
  const cards = objects.map(card => {
    const placement = board.placements[card.id] ?? card.placement;
    return placement.groupId && !groups.has(placement.groupId)
      ? { ...card, placement: { ...placement, groupId: undefined } }
      : placement === card.placement ? card : { ...card, placement };
  });
  const ids = new Set(cards.map(card => card.id));
  return {
    cards,
    links: [...seed.links, ...board.authoredLinks].filter(link => ids.has(link.source) && ids.has(link.target)),
  };
}

export function groupCards(board: BoardDocument, cards: Card[], id: string): BoardDocument {
  const members = cards.filter(card => card.kind !== 'group' && !card.placement.groupId);
  const area = bounds(members);
  if (members.length < 2 || !area) return board;
  const group: AuthoredCard = { id, kind: 'group', title: 'New group', description: '',
    placement: rect(area.x - 28, area.y - 54, area.width + 56, area.height + 82) };
  const placements = { ...board.placements };
  for (const member of members) placements[member.id] = { ...member.placement, groupId: id };
  return { ...board, placements, authoredCards: [...board.authoredCards, group] };
}

export function removeAuthored(board: BoardDocument, cardIds: readonly string[], linkIds: readonly string[]): BoardDocument {
  const remove = new Set(board.authoredCards.filter(card => cardIds.includes(card.id)).map(card => card.id));
  const remainingLinks = board.authoredLinks.filter(link =>
    !linkIds.includes(link.id) && !remove.has(link.source) && !remove.has(link.target));
  if (!remove.size && remainingLinks.length === board.authoredLinks.length) return board;
  const placements = { ...board.placements };
  for (const [id, placement] of Object.entries(placements)) {
    if (remove.has(id)) delete placements[id];
    else if (placement.groupId && remove.has(placement.groupId)) placements[id] = { ...placement, groupId: undefined };
  }
  const remainingLinkIds = new Set(remainingLinks.map(link => link.id));
  const authoredCards = board.authoredCards.filter(card => !remove.has(card.id)).map(card => {
    const details = card.projectObject;
    if (!details) return card;
    const relatedObjectIds = details.relatedObjectIds?.filter(id => !remove.has(id));
    const relatedConnectionIds = details.relatedConnectionIds?.filter(id => remainingLinkIds.has(id));
    if (relatedObjectIds?.length === details.relatedObjectIds?.length
      && relatedConnectionIds?.length === details.relatedConnectionIds?.length) return card;
    return { ...card, projectObject: { ...details, relatedObjectIds, relatedConnectionIds } };
  });
  return { ...board, placements, authoredCards, authoredLinks: remainingLinks };
}

export function zoomAt(viewport: Point & { zoom: number }, anchor: Point, zoom: number) {
  const ratio = zoom / viewport.zoom;
  return { x: anchor.x - (anchor.x - viewport.x) * ratio, y: anchor.y - (anchor.y - viewport.y) * ratio, zoom };
}
