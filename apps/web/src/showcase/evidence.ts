import type { ChatResponse, Chunk, Citation } from "../types/contracts";
import type { ShowcaseTrace } from "./trace-types";

export const routerQuestion = "What does a router do?";

const stopWords = new Set("about all and are can could does explain for from have how into more note notes please should tell that the their them there this what when where which who why will with would".split(" "));

function terms(text: string): Set<string> {
  return new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(word => word.length >= 2 && !stopWords.has(word)));
}

export function exactExcerpt(chunk: Chunk, query = ""): string {
  const candidates = chunk.text.split(/(?<=[.!?])\s+|\n(?=\s*#)/u)
    .map(sentence => sentence.trim()).filter(sentence => sentence.length > 12);
  const questionTerms = terms(query);
  const score = (sentence: string) => [...terms(sentence)].filter(term => questionTerms.has(term)).length;
  const best = candidates.sort((left, right) => score(right) - score(left))[0];
  return Array.from(best ?? chunk.text.trim()).slice(0, 340).join("");
}

export function quoteCitation(chunk: Chunk, question = ""): Citation {
  return { chunkId: chunk.id, docId: chunk.docId, page: chunk.page, quote: exactExcerpt(chunk, question) };
}

export function answerFromTrace(trace: ShowcaseTrace, question: string): ChatResponse {
  const normalized = (value: string) => value.trim().toLocaleLowerCase().replace(/[?.!]+$/u, "").trim();
  const recorded = trace.prompts.find(prompt => normalized(prompt.question) === normalized(question));
  if (recorded) return recorded.answer;

  const queryTerms = terms(question);
  const candidates = trace.chunks.map(chunk => ({
    chunk,
    matches: [...terms(chunk.text)].filter(term => queryTerms.has(term)).length,
  })).sort((left, right) => right.matches - left.matches);
  const match = candidates[0];
  if (!match?.matches) return {
    answer: "I couldn’t find a matching passage in this sample. Try a term from the note or choose a suggested question.",
    citations: [],
    referencedNodeIds: [],
  };
  const citation = quoteCitation(match.chunk, question);
  return {
    answer: citation.quote,
    citations: [citation],
    referencedNodeIds: trace.graph.nodes.filter(node => node.sourceChunkIds.includes(match.chunk.id)).map(node => node.id),
  };
}
