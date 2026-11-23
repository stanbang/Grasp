// Generated from Pydantic by scripts/generate_contracts.py; change the source schema.

import type { ChatResponse, Chunk, GraphResponse, PageResponse } from "../types/contracts";

export interface ShowcaseStage {
  kind: "pages" | "text" | "chunks" | "embeddings" | "concepts" | "links" | "ready";
  lines: Array<string>;
  durationMs: number | null;
}

export interface ShowcasePoint {
  id: string;
  xyz: [number, number, number];
}

export interface ShowcasePrompt {
  question: string;
  answer: ChatResponse;
}

export interface ShowcaseTrace {
  version: 1;
  mode: "mock";
  id: string;
  title: string;
  fileName: string;
  sourcePath: string;
  sourceSha256: string;
  embeddingIdentity: "mock-sha256-256-v1";
  chunkSize: number;
  chunkOverlap: number;
  pages: Array<PageResponse>;
  chunks: Array<Chunk>;
  chunkPositions: Array<ShowcasePoint>;
  conceptPositions: Array<ShowcasePoint>;
  graph: GraphResponse;
  stages: Array<ShowcaseStage>;
  prompts: Array<ShowcasePrompt>;
}
