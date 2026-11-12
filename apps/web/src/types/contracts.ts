// Generated from Pydantic by scripts/generate_contracts.py; change the source schema.

export interface Quiz {
  question: string;
  options: [string, string, string];
  answerIndex: number;
}

export interface GraphNode {
  id: string;
  label: string;
  summary: string;
  docIds: Array<string>;
  sourceChunkIds: Array<string>;
  masteryState: "unexplored" | "learning" | "mastered";
  quiz?: Quiz;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationshipLabel: string;
  docIds: Array<string>;
}

export interface Chunk {
  id: string;
  docId: string;
  page: number;
  text: string;
  charStart: number;
  charEnd: number;
}

export interface Document {
  id: string;
  name: string;
  status: "queued" | "chunking" | "extracting" | "done" | "failed";
  uploadedAt: string;
}

export interface Citation {
  chunkId: string;
  docId: string;
  page: number;
  quote: string;
}

export interface ChatResponse {
  answer: string;
  citations: Array<Citation>;
  referencedNodeIds: Array<string>;
}

export interface Progress {
  masteredCount: number;
  exploredCount: number;
  totalNodes: number;
  coveragePercent: number;
  crossDocLinks: number;
}

export interface ProviderCheck {
  configured: boolean;
  provider: "mock" | "openai" | "gemini";
  model: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  phase: 2;
  sqlite: "ok" | "unavailable";
  chroma: "ok" | "unavailable";
  llm: ProviderCheck;
}

export interface SampleResponse {
  name: string;
  text: string;
  contentType: "text/markdown";
}

export interface SchemaDescription {
  name: string;
  definition: Record<string, unknown>;
}

export interface SchemasResponse {
  schemas: Array<SchemaDescription>;
}

export interface DocumentsResponse {
  documents: Array<Document>;
}

export interface ChunksResponse {
  chunks: Array<Chunk>;
}

export interface PageResponse {
  docId: string;
  page: number;
  text: string;
}

export interface GraphResponse {
  nodes: Array<GraphNode>;
  edges: Array<GraphEdge>;
}

export interface IngestionEvent {
  id: number;
  docId: string;
  type: "status" | "node" | "edge" | "complete" | "error";
  document?: Document;
  message?: string;
  completedBatches?: number;
  totalBatches?: number;
  node?: GraphNode;
  edge?: GraphEdge;
  chunkCount?: number;
  nodeCount?: number;
  edgeCount?: number;
}

export interface ChatRequest {
  question: string;
  topK?: number;
}

export interface NodeRequest {
  nodeId: string;
}

export interface Question {
  question: string;
  options: [string, string, string];
}

export interface QuizResponse {
  attemptId: string;
  questions: Array<Question>;
}

export interface GradeRequest {
  attemptId: string;
  answers: [number, number, number];
}

export interface GradeResponse {
  score: number;
  passed: boolean;
  correctAnswers: Array<number>;
  nodeIds: Array<string>;
}
