import { rect, type BoardLink, type BoardScene, type Card } from './board';

const api = 'apps/api/app/';
const cards: Card[] = [
  { id: 'title', kind: 'heading', title: 'Inside Grasp', description: 'How a document becomes an answer you can check.',
    placement: rect(0, 0, 570, 96) },
  { id: 'ingestion-section', kind: 'heading', title: 'Index a document', description: '', placement: rect(0, 135, 260, 38) },
  { id: 'parse-region', kind: 'group', title: 'Page text', description: 'Text extraction and chunking preserve the original page number.',
    placement: rect(171, 169, 363, 152) },
  { id: 'source', kind: 'illustration', illustration: 'document', title: 'Source document', description: 'Upload a PDF, Markdown or text file.',
    sourcePath: `${api}document_routes.py`, placement: rect(0, 208, 126, 89) },
  { id: 'pages', kind: 'illustration', illustration: 'pages', title: 'Extracted pages', description: 'Read PDF page text. With OCR enabled, scanned pages can be recognized from images.',
    sourcePath: `${api}parsing.py`, placement: { ...rect(193, 208, 122, 89), groupId: 'parse-region' } },
  { id: 'chunks', kind: 'illustration', illustration: 'chunks', title: 'Text chunks', description: 'Overlapping passages keep page-local character offsets.',
    sourcePath: `${api}parsing.py`, placement: { ...rect(383, 208, 126, 89), groupId: 'parse-region' } },
  { id: 'embed', kind: 'component', illustration: 'embeddings', title: 'Embed text', description: 'Convert chunks into numerical vectors.',
    sourcePath: `${api}ingestion.py`, placement: rect(596, 201, 176, 102) },
  { id: 'chroma', kind: 'illustration', illustration: 'chroma', title: 'ChromaDB', description: 'Stores embeddings and searches within the selected document scope.',
    sourcePath: `${api}storage.py`, placement: rect(864, 208, 122, 89) },
  { id: 'sqlite', kind: 'illustration', illustration: 'sqlite', title: 'SQLite', description: 'Stores document and chunk records, graph provenance and saved conversations.',
    sourcePath: `${api}storage.py`, placement: rect(1080, 208, 118, 89) },
  { id: 'offset-note', kind: 'annotation', noteStyle: 'underline', title: 'Keep the page number',
    description: 'So quotes lead back here.', placement: rect(36, 359, 260, 74) },
  { id: 'similarity', kind: 'visualization', illustration: 'similarity', title: 'Why a passage ranks',
    description: 'Compare a query with candidate passages in a simplified two-dimensional example.',
    placement: rect(795, 378, 186, 96), visualization: {
      exampleLabel: 'Illustrative 2D coordinates', query: { id: 'query', label: 'Query', x: 76, y: 66 },
      candidates: [{ id: 'near', label: 'Nearby passage', x: 107, y: 42 }, { id: 'far', label: 'Distant passage', x: 184, y: 81 }],
    } },
  { id: 'questions-section', kind: 'heading', title: 'Answer with evidence', description: '', placement: rect(0, 451, 280, 40) },
  { id: 'client', kind: 'component', illustration: 'api', title: 'Study workspace', description: 'Send a scoped question to FastAPI.',
    sourcePath: `${api}study_routes.py`, placement: rect(0, 516, 178, 105) },
  { id: 'retrieve', kind: 'component', illustration: 'retrieval', title: 'Rank passages', description: 'Search within scope and load the matching text.',
    sourcePath: `${api}retrieval.py`, placement: rect(258, 516, 199, 105) },
  { id: 'generate', kind: 'component', illustration: 'generation', title: 'Draft the answer', description: 'Give the model the question and retrieved passages.',
    sourcePath: `${api}study_routes.py`, placement: rect(548, 516, 192, 105) },
  { id: 'validate', kind: 'component', illustration: 'validation', title: 'Validate output', description: 'Check the schema and exact quotes.',
    sourcePath: `${api}study_routes.py`, placement: rect(825, 516, 178, 105) },
  { id: 'cite', kind: 'illustration', illustration: 'citation', title: 'Source citation', description: 'Return the quote, document, page and chunk ID. Open a source from the Knowledge canvas to see the exact passage.',
    sourcePath: 'apps/web/src/WorkspaceDialogs.tsx', placement: rect(1072, 520, 126, 92) },
  { id: 'support-note', kind: 'annotation', noteStyle: 'plain', title: 'No supporting passage?',
    description: 'Say what is missing.', placement: rect(92, 657, 232, 68) },
];

const links: Array<Omit<BoardLink, 'id' | 'origin'>> = [
  { source: 'source', target: 'pages', label: 'extracts', role: 'process' },
  { source: 'pages', target: 'chunks', label: 'splits', role: 'process' },
  { source: 'chunks', target: 'embed', label: 'embeds', role: 'process' },
  { source: 'embed', target: 'chroma', label: 'indexes', role: 'data' },
  { source: 'chunks', target: 'sqlite', label: 'stores text and offsets', role: 'data', fromSide: 'top', toSide: 'top' },
  { source: 'offset-note', target: 'pages', label: 'Explains page provenance', role: 'annotation', fromSide: 'top', toSide: 'bottom' },
  { source: 'client', target: 'retrieve', label: 'asks', role: 'process' },
  { source: 'retrieve', target: 'generate', label: 'supplies text', role: 'data' },
  { source: 'generate', target: 'validate', label: 'returns draft', role: 'process' },
  { source: 'validate', target: 'cite', label: 'cites', role: 'data' },
  { source: 'support-note', target: 'retrieve', label: 'Explains unsupported questions', role: 'annotation', fromSide: 'right', toSide: 'bottom' },
  { source: 'similarity', target: 'retrieve', label: 'Illustrates vector similarity', role: 'annotation', fromSide: 'bottom', toSide: 'top' },
  { source: 'retrieve', target: 'chroma', label: 'searches vectors', role: 'data', fromSide: 'top', toSide: 'bottom', routeY: 335 },
  { source: 'retrieve', target: 'sqlite', label: 'loads source text', role: 'data', fromSide: 'top', toSide: 'bottom', routeY: 365 },
];

export const engineeringScene: BoardScene = {
  cards,
  links: links.map(link => ({ ...link, id: `architecture:${link.source}:${link.target}`, origin: 'repository' })),
};

export const engineeringPaths = {
  index: ['source', 'pages', 'chunks', 'embed', 'chroma', 'sqlite'],
  answer: ['client', 'retrieve', 'generate', 'validate', 'cite'],
};
