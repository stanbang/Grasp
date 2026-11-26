// Generated from Pydantic by scripts/generate_contracts.py; change the source schema.

export interface CanvasPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  groupId?: string | null;
}

export interface CanvasEvidenceRef {
  chunkId: string;
  docId: string;
  page: number;
  charStart: number;
  charEnd: number;
}

export interface CanvasRequirement {
  status?: "proposed" | "accepted" | "rejected";
  acceptanceCriteria?: Array<string>;
}

export interface CanvasQuestion {
  required?: boolean;
}

export interface CanvasAnswer {
  text: string;
  answeredBy: "user";
  answeredAt: string;
}

export interface CanvasPrototype {
  previewId: string;
  revision: number;
  digest: string;
  entryPoint: string;
  requirementIds?: Array<string>;
}

export interface CanvasObjectData {
  id: string;
  kind: "explanation" | "annotation" | "group" | "heading" | "text" | "illustration" | "evidence" | "requirement" | "question" | "prototype";
  title: string;
  description?: string;
  placement: CanvasPlacement;
  illustration?: "document" | "pages" | "chunks" | "embeddings" | "similarity" | "chroma" | "sqlite" | "retrieval" | "generation" | "validation" | "citation" | "graph" | "api" | "streaming" | "evaluation" | "ocr" | null;
  noteStyle?: "plain" | "underline" | "callout" | null;
  canonicalNodeId?: string | null;
  evidence?: Array<CanvasEvidenceRef>;
  relatedObjectIds?: Array<string>;
  relatedConnectionIds?: Array<string>;
  requirement?: CanvasRequirement | null;
  question?: CanvasQuestion | null;
  prototype?: CanvasPrototype | null;
}

export interface CanvasObject {
  id: string;
  kind: "explanation" | "annotation" | "group" | "heading" | "text" | "illustration" | "evidence" | "requirement" | "question" | "prototype";
  title: string;
  description?: string;
  placement: CanvasPlacement;
  illustration?: "document" | "pages" | "chunks" | "embeddings" | "similarity" | "chroma" | "sqlite" | "retrieval" | "generation" | "validation" | "citation" | "graph" | "api" | "streaming" | "evaluation" | "ocr" | null;
  noteStyle?: "plain" | "underline" | "callout" | null;
  canonicalNodeId?: string | null;
  evidence?: Array<CanvasEvidenceRef>;
  relatedObjectIds?: Array<string>;
  relatedConnectionIds?: Array<string>;
  requirement?: CanvasRequirement | null;
  question?: CanvasQuestion | null;
  prototype?: CanvasPrototype | null;
  createdBy: "user" | "agent";
  updatedBy: "user" | "agent";
  answer?: CanvasAnswer | null;
  decidedBy?: "user" | null;
}

export interface CanvasConnectionData {
  id: string;
  source: string;
  target: string;
  label: string;
  role?: "structural" | "data" | "process" | "annotation";
  canonicalEdgeId?: string | null;
}

export interface CanvasConnection {
  id: string;
  source: string;
  target: string;
  label: string;
  role?: "structural" | "data" | "process" | "annotation";
  canonicalEdgeId?: string | null;
  createdBy: "user" | "agent";
  updatedBy: "user" | "agent";
}

export interface CreateBoard {
  title: string;
}

export interface BoardSummary {
  id: string;
  projectId: string;
  schemaVersion: 1;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: "user" | "agent";
}

export interface BoardList {
  boards: Array<BoardSummary>;
  nextOffset: number | null;
}

export interface ProjectBoard {
  id: string;
  projectId: string;
  schemaVersion: 1;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: "user" | "agent";
  objects: Record<string, CanvasObject>;
  connections: Record<string, CanvasConnection>;
}

export interface AddObject {
  type: "addObject";
  object: CanvasObjectData;
}

export interface UpdateObject {
  type: "updateObject";
  object: CanvasObjectData;
}

export interface PlaceObject {
  type: "placeObject";
  objectId: string;
  placement: CanvasPlacement;
}

export interface RemoveObject {
  type: "removeObject";
  objectId: string;
}

export interface AddConnection {
  type: "addConnection";
  connection: CanvasConnectionData;
}

export interface UpdateConnection {
  type: "updateConnection";
  connection: CanvasConnectionData;
}

export interface RemoveConnection {
  type: "removeConnection";
  connectionId: string;
}

export interface AnswerQuestion {
  type: "answerQuestion";
  objectId: string;
  text: string;
}

export interface RestoreRevision {
  type: "restoreRevision";
  revision: number;
}

export interface CanvasBatch {
  baseRevision: number;
  mutationId: string;
  operations: Array<AddObject | UpdateObject | PlaceObject | RemoveObject | AddConnection | UpdateConnection | RemoveConnection | AnswerQuestion | RestoreRevision>;
  expandFromObjectId?: string | null;
}

export interface BoardCommit {
  boardId: string;
  baseRevision: number;
  revision: number;
  mutationId: string;
  actor: "user" | "agent";
  committedAt: string;
  board: ProjectBoard;
}

export interface BoardConflict {
  code: "staleRevision" | "mutationIdReused";
  message: string;
  currentRevision: number;
}

export interface BoardConflictResponse {
  detail: BoardConflict;
}

export interface CanvasEvidenceContext {
  reference: CanvasEvidenceRef;
  available: boolean;
  quote: string | null;
  sourceName: string | null;
}

export interface CanvasConceptContext {
  id: string;
  label: string;
  summary: string;
  docIds: Array<string>;
  sourceChunkIds: Array<string>;
}

export interface CanvasRelationshipContext {
  id: string;
  source: string;
  target: string;
  relationshipLabel: string;
  docIds: Array<string>;
}

export interface CanvasObjectContext {
  boardId: string;
  revision: number;
  object: CanvasObject;
  connections: Array<CanvasConnection>;
  relatedObjects: Array<CanvasObject>;
  evidence: Array<CanvasEvidenceContext>;
  canonicalConcept: CanvasConceptContext | null;
  canonicalRelationships: Array<CanvasRelationshipContext>;
}

export interface BoardSelectionUpdate {
  baseRevision: number;
  objectIds: Array<string>;
  connectionIds?: Array<string>;
}

export interface BoardSelection {
  boardId: string;
  revision: number;
  available: boolean;
  objectIds: Array<string>;
  connectionIds: Array<string>;
}

export interface BoardPresenceUpdate {
  tabId: string;
  sequence: number;
  baseRevision: number;
  objectIds: Array<string> | null;
  connectionIds?: Array<string>;
}

export interface BoardContextSelection {
  status: "selected" | "empty" | "unavailable" | "stale" | "ambiguous";
  objectIds: Array<string>;
  connectionIds: Array<string>;
}

export interface BoardFocus {
  objectIds: Array<string>;
  connectionIds: Array<string>;
  feedbackIds: Array<string>;
}

export interface BoardItemChange {
  id: string;
  label: string;
  kind: string;
  change: "added" | "modified" | "removed";
  fields: Array<string>;
  classification: "visual" | "semantic" | "mixed";
}

export interface BoardConnectionState {
  source: string;
  sourceTitle: string;
  target: string;
  targetTitle: string;
  label: string;
  role: "structural" | "data" | "process" | "annotation";
}

export interface BoardConnectionChange {
  id: string;
  label: string;
  kind: string;
  change: "added" | "modified" | "removed";
  fields: Array<string>;
  classification: "visual" | "semantic" | "mixed";
  before: BoardConnectionState | null;
  after: BoardConnectionState | null;
}

export interface BoardRevisionChanges {
  revision: number;
  actor: "user" | "agent";
  objects: Array<BoardItemChange>;
  connections: Array<BoardConnectionChange>;
}

export interface BoardChanges {
  fromRevision: number;
  throughRevision: number;
  revisions: Array<BoardRevisionChanges>;
  nextSinceRevision: number | null;
}

export interface BoardContext {
  status: "ready" | "noActiveBoard" | "ambiguousBoard";
  candidates: Array<BoardSummary>;
  board: ProjectBoard | null;
  selection: BoardContextSelection | null;
  focus: BoardFocus | null;
  annotationIds: Array<string>;
  requirementIds: Array<string>;
  proposalIds: Array<string>;
  decisionIds: Array<string>;
  changes: BoardChanges | null;
}

export interface KnowledgeSearch {
  query: string;
  docIds: Array<string>;
  topK?: number;
}

export interface KnowledgeHit {
  rank: number;
  sourceName: string;
  reference: CanvasEvidenceRef;
  excerpt: string;
}

export interface KnowledgeResults {
  mode: "mock" | "live";
  results: Array<KnowledgeHit>;
}
