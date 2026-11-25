const paper = 'M16 7h30l12 12v38H16z M46 7v13h12';
const illustrations = {
  document: { label: 'Source document', ink: paper, accent: 'M25 31h18 M25 39h24 M25 47h13 M11 14H6v47h42v-5' },
  pages: { label: 'Extracted pages', ink: 'M8 14h31v39H8z M17 14V8h31v39h-9 M48 14h15v39H48', accent: 'M15 24h17 M15 30h17 M15 36h12 M51 24h7 M51 31h7 M51 37h5' },
  chunks: { label: 'Overlapping chunks', ink: 'M5 13h43v16H5z M16 25h43v16H16z M27 37h43v16H27z', accent: 'M17 27h30 M28 39h30 M12 20h22 M34 47h28' },
  embeddings: { label: 'Numerical embeddings', ink: 'M15 12H8v40h7 M59 12h7v40h-7 M19 48h36', accent: 'M21 40v-9 M29 40V20 M37 40V27 M45 40V16 M53 40V23' },
  similarity: { label: 'Vector space and similarity', ink: 'M9 9v46h55 M17 49l34-32 M17 49l39-18 M17 49l46-6 M28 12l2 1 M41 42l2 1', accent: 'M47 13a16 16 0 0 1 14 24 M51 16h.1 M56 31h.1 M63 43h.1' },
  chroma: { label: 'ChromaDB vector storage', ink: 'M11 16l26-9 26 9-26 9z M11 16v30l26 10 26-10V16 M37 25v31 M11 31l26 10 26-10', accent: 'M18 19l7-2 M27 22l7-2 M42 43l13-5 M42 48l8-3' },
  sqlite: { label: 'SQLite relational storage', ink: 'M13 14c0-8 48-8 48 0s-48 8-48 0v34c0 8 48 8 48 0V14 M13 25c0 8 48 8 48 0 M13 37c0 8 48 8 48 0', accent: 'M24 31v12 M38 33v13 M50 31v12' },
  retrieval: { label: 'Retrieval and ranking', ink: 'M7 14h17 M7 25h17 M7 36h17 M27 14l13 16-13 19 M47 21h20 M47 33h15 M47 45h9', accent: 'M30 30h11 M47 21h20 M47 45h9' },
  generation: { label: 'LLM generation', ink: 'M10 11h27l9 10v30H10z M37 11v10h9 M17 26h19 M17 34h14 M17 42h18 M52 22l13 10-13 10', accent: 'M53 11h8 M57 7v8 M57 53h11' },
  validation: { label: 'Structured output validation', ink: 'M22 11h-6v13l-6 8 6 8v13h6 M53 11h6v13l6 8-6 8v13h-6', accent: 'M26 33l8 8 15-18' },
  citation: { label: 'Source citation', ink: `${paper} M24 26h23 M24 44h25 M24 50h16`, accent: 'M24 32h26v7H24z M12 32H8v7h4' },
  graph: { label: 'Knowledge graph', ink: 'M13 33l20-19 25 5 4 26-28 7-21-19 45-14 M34 52l-1-38 29 31', accent: 'M13 33h.1 M33 14h.1 M58 19h.1 M62 45h.1 M34 52h.1' },
  api: { label: 'API communication', ink: 'M29 10h-9v44h9 M45 10h9v44h-9 M12 25h33l-6-6 M62 39H29l6 6', accent: 'M39 31l6-6 M35 33l-6 6' },
  streaming: { label: 'SSE event streaming', ink: 'M4 33h66l-8-7 M70 33l-8 7 M12 24V15h9v9 M30 24V11h9v13 M48 24v-7h9v7', accent: 'M16 42h2 M34 42h2 M52 42h2' },
  evaluation: { label: 'Evaluation and testing', ink: 'M12 10h50v44H12z M32 21h20 M32 32h14 M32 43h20', accent: 'M19 20l3 3 5-5 M19 41l3 3 5-5 M20 30l5 5 M25 30l-5 5' },
  ocr: { label: 'OCR processing', ink: 'M22 10H10v12 M53 10h12v12 M10 42v12h12 M65 42v12H53 M24 28l5-10 5 10 M26 25h6 M44 19h9 M44 25h9 M23 40h12 M44 40h9 M23 47h12 M44 47h9', accent: 'M7 34h61' },
} as const;

export type Illustration = keyof typeof illustrations;

export const illustrationOptions = (Object.keys(illustrations) as Illustration[]).map(id => ({ id, label: illustrations[id].label }));

export function TechnicalIllustration({ name }: { name: Illustration }) {
  const { ink, accent } = illustrations[name];
  return <svg className="technical-illustration" data-illustration={name} viewBox="0 0 74 64"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ink} />
    <path className="technical-illustration-accent" d={accent} />
  </svg>;
}
