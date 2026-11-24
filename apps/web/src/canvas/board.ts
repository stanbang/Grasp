import type { Document, GraphNode, GraphResponse } from '../types/contracts';

export type BoardKind = 'knowledge' | 'engineering';
export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type Placement = Rect & { groupId?: string };
export type ObjectKind = 'concept' | 'document' | 'component' | 'explanation' | 'annotation' | 'group';
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
};

export type BoardLink = {
  id: string;
  source: string;
  target: string;
  label: string;
  origin: 'semantic' | 'document' | 'repository' | 'authored';
  canonicalId?: string;
  docIds?: string[];
};

export type BoardScene = { cards: Card[]; links: BoardLink[] };
type AuthoredCard = Pick<Card, 'id' | 'title' | 'description' | 'placement'> & {
  kind: 'explanation' | 'annotation' | 'group';
};
type AuthoredLink = Pick<BoardLink, 'id' | 'source' | 'target' | 'label'> & { origin: 'authored' };
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
const conceptColumn = 350;
const conceptRow = 175;
const sourceColumn = 328;

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
  const home = sortedDocuments.length ? sourceColumn : 0;
  const cards: Card[] = nodes.map((concept, index) => {
    const row = Math.floor(index / 3);
    const column = row % 2 ? 2 - index % 3 : index % 3;
    return {
      id: conceptObjectId(concept.id), kind: 'concept', title: concept.label,
      description: concept.summary, concept, placement: rect(home + column * conceptColumn, row * conceptRow),
    };
  });
  const links: BoardLink[] = graph.edges.map(edge => ({
    id: `relation:${edge.id}`, source: conceptObjectId(edge.source), target: conceptObjectId(edge.target),
    label: edge.relationshipLabel, canonicalId: edge.id, origin: 'semantic', docIds: edge.docIds,
  }));
  sortedDocuments.forEach((document, index) => {
    const id = documentObjectId(document.id);
    cards.push({ id, kind: 'document', title: document.name, description: '', document,
      placement: rect(0, index * conceptRow) });
    const representative = nodes.find(node => node.docIds.includes(document.id));
    if (representative) links.push({
      id: `source:${document.id}`, source: id, target: conceptObjectId(representative.id),
      label: 'source for', origin: 'document', docIds: [document.id],
    });
  });
  return { cards, links };
}

export function projectBoard(seed: BoardScene, board: BoardDocument): BoardScene {
  const groups = new Set(board.authoredCards.filter(card => card.kind === 'group').map(card => card.id));
  const cards = [...seed.cards, ...board.authoredCards].map(card => {
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
  return { ...board, placements, authoredCards: board.authoredCards.filter(card => !remove.has(card.id)), authoredLinks: remainingLinks };
}

export function zoomAt(viewport: Point & { zoom: number }, anchor: Point, zoom: number) {
  const ratio = zoom / viewport.zoom;
  return { x: anchor.x - (anchor.x - viewport.x) * ratio, y: anchor.y - (anchor.y - viewport.y) * ratio, zoom };
}
