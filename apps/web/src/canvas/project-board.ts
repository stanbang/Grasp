import type { CanvasBatch, CanvasConnectionData, CanvasObject, CanvasObjectData, ProjectBoard } from '../types/canvas-contracts';
import type { AuthoredCard, AuthoredLink, BoardDocument, Placement } from './board';

export type ProjectFeedbackKind = 'annotation' | 'question' | 'requirement';
export type FeedbackTarget = { objectId: string } | { connectionId: string };
export type ProjectFeedback = { kind: ProjectFeedbackKind } & FeedbackTarget;

export function projectFeedbackObject(card: AuthoredCard, feedback: ProjectFeedback): NonNullable<AuthoredCard['projectObject']> {
  return {
    id: card.id, kind: feedback.kind, title: card.title, description: card.description,
    placement: { ...card.placement, groupId: card.placement.groupId ?? null },
    createdBy: 'user', updatedBy: 'user',
    relatedObjectIds: 'objectId' in feedback ? [feedback.objectId] : [],
    relatedConnectionIds: 'connectionId' in feedback ? [feedback.connectionId] : [],
    requirement: feedback.kind === 'requirement' ? { status: 'proposed' } : null,
    question: feedback.kind === 'question' ? { required: true } : null,
  };
}

export function projectCard(item: CanvasObject): AuthoredCard {
  const { kind, id, title, description, placement, illustration, noteStyle } = item;
  return {
    id, title, description: kind === 'evidence' ? '' : description ?? '',
    kind: kind === 'requirement' || kind === 'question' || kind === 'prototype' ? 'explanation' : kind,
    placement: { ...placement, groupId: placement.groupId ?? undefined },
    illustration: illustration ?? undefined, noteStyle: noteStyle ?? undefined, projectObject: item,
  };
}

export function placeProjectAssets(board: BoardDocument, assets: AuthoredCard[]): BoardDocument {
  if (!assets.length) return board;
  const authoredCards = [...board.authoredCards];
  const margin = 22;
  for (const asset of assets) {
    if (authoredCards.some(item => item.id === asset.id)) continue;
    const occupied = authoredCards.map(item => board.placements[item.id] ?? item.placement);
    const start = asset.placement;
    const placement: Placement = { ...start };
    for (const other of occupied.sort((a, b) => a.y - b.y)) {
      if (
        placement.x < other.x + other.width + margin && placement.x + placement.width + margin > other.x &&
        placement.y < other.y + other.height + margin && placement.y + placement.height + margin > other.y
      ) placement.y = other.y + other.height + margin;
    }
    authoredCards.push({ ...asset, placement });
  }
  return { ...board, authoredCards, schemaVersion: 2 };
}

export function projectDocument(board: ProjectBoard): BoardDocument {
  return {
    kind: 'project', schemaVersion: board.schemaVersion, revision: board.revision, placements: {},
    authoredCards: Object.values(board.objects).map(projectCard),
    authoredLinks: Object.values(board.connections).map(connection => ({
      id: connection.id, source: connection.source, target: connection.target, label: connection.label,
      role: connection.role, origin: 'authored', projectConnection: connection,
    })),
  };
}

function objectData(card: AuthoredCard, board: BoardDocument): CanvasObjectData {
  const details = card.projectObject;
  const placement = board.placements[card.id] ?? card.placement;
  return {
    id: card.id, kind: details?.kind ?? card.kind, title: card.title,
    description: details?.kind === 'evidence' ? details.description ?? '' : card.description,
    placement: { ...placement, groupId: placement.groupId ?? null },
    illustration: card.illustration ?? null, noteStyle: card.noteStyle ?? null,
    canonicalNodeId: details?.canonicalNodeId ?? null, evidence: details?.evidence ?? [],
    relatedObjectIds: details?.relatedObjectIds ?? [], relatedConnectionIds: details?.relatedConnectionIds ?? [],
    sizing: details?.sizing ?? null,
    requirement: details?.requirement ?? null,
    question: details?.question ?? null, prototype: details?.prototype ?? null, asset: details?.asset ?? undefined,
  };
}

function connectionData(link: AuthoredLink): CanvasConnectionData {
  return {
    id: link.id, source: link.source, target: link.target, label: link.label,
    role: link.role ?? 'data', canonicalEdgeId: link.projectConnection?.canonicalEdgeId ?? null,
  };
}

export function boardOperations(previous: BoardDocument, next: BoardDocument): CanvasBatch['operations'] {
  const operations: CanvasBatch['operations'] = [];
  const oldObjects = new Map(previous.authoredCards.map(card => [card.id, objectData(card, previous)]));
  const oldLinks = new Map(previous.authoredLinks.map(link => [link.id, connectionData(link)]));
  const nextObjectIds = new Set(next.authoredCards.map(card => card.id));
  const nextLinkIds = new Set(next.authoredLinks.map(link => link.id));
  for (const edge of oldLinks.values()) {
    if (!nextLinkIds.has(edge.id) && nextObjectIds.has(edge.source) && nextObjectIds.has(edge.target)) {
      operations.push({ type: 'removeConnection', connectionId: edge.id });
    }
  }
  for (const id of oldObjects.keys()) if (!nextObjectIds.has(id)) operations.push({ type: 'removeObject', objectId: id });
  for (const card of next.authoredCards) {
    const object = objectData(card, next);
    const old = oldObjects.get(card.id);
    if (!old) operations.push({ type: 'addObject', object });
    else {
      const { placement, ...content } = object;
      const { placement: oldPlacement, ...oldContent } = old;
      if (JSON.stringify(content) !== JSON.stringify(oldContent)) operations.push({ type: 'updateObject', object });
      else if (JSON.stringify(placement) !== JSON.stringify(oldPlacement)) {
        operations.push({ type: 'placeObject', objectId: object.id, placement });
      }
    }
  }
  for (const link of next.authoredLinks) {
    const connection = connectionData(link);
    const old = oldLinks.get(link.id);
    if (!old) operations.push({ type: 'addConnection', connection });
    else if (JSON.stringify(connection) !== JSON.stringify(old)) operations.push({ type: 'updateConnection', connection });
  }
  return operations;
}
