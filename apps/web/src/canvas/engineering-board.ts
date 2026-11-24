import { rect, type BoardScene, type Card } from './board';

const components: [string, string, string, string, number, number][] = [
  ['client', 'Study workspace', 'Imports documents and renders the graph, questions and exact citations.', 'apps/web/src/App.tsx', 0, 0],
  ['api', 'FastAPI', 'Validates requests and exposes graph, chat, file and ingestion event routes.', 'apps/api/app/main.py', 340, 0],
  ['ingest', 'Ingestion worker', 'Reads pages, chunks the text and extracts source-linked concepts.', 'apps/api/app/ingestion.py', 680, 0],
  ['sqlite', 'SQLite', 'Stores documents, source spans, conversations and committed graph records.', 'apps/api/app/storage.py', 0, 210],
  ['retrieve', 'Grounded retrieval', 'Resolves ranked chunks and validates citations against exact source text.', 'apps/api/app/study_routes.py', 340, 210],
  ['chroma', 'Chroma', 'Indexes chunk embeddings and searches within the selected document scope.', 'apps/api/app/retrieval.py', 680, 210],
];

const relations = [
  ['client', 'api', 'calls'],
  ['api', 'ingest', 'queues'],
  ['api', 'retrieve', 'routes questions'],
  ['ingest', 'chroma', 'indexes'],
  ['retrieve', 'chroma', 'searches'],
  ['retrieve', 'sqlite', 'resolves passages'],
];

export const engineeringScene: BoardScene = {
  cards: components.map(([id, title, description, sourcePath, x, y]): Card => ({
    id, title, description, sourcePath, kind: 'component', placement: rect(x, y, 238, 120),
  })),
  links: relations.map(([source, target, label], index) => ({
    id: `architecture:${index}`, source: source!, target: target!, label: label!, origin: 'repository',
  })),
};
