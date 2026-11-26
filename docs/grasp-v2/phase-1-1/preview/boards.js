import { fixture } from './fixture.js';

const item = (id, kind, title, summary, url) => ({ id, kind, title, summary, url });
const link = (id, source, target, title, kind = 'flow') => ({ id, source, target, title, kind });
const repo = 'https://github.com/stanbang/Grasp/blob/8cd9582/';

const engineering = {
  title: 'From document to grounded answer',
  caption: 'Ingestion, retrieval, and exact citations in GRASP.',
  objects: [
    item('upload', 'component', 'Upload', 'FastAPI accepts PDF, Markdown and text.', 'apps/api/app/document_routes.py'),
    item('parse', 'component', 'Extract & chunk', 'Keep page numbers and exact character offsets.', 'apps/api/app/parsing.py'),
    item('index', 'storage', 'Chroma', 'Index chunk embeddings.', 'apps/api/app/ingestion.py'),
    item('store', 'storage', 'SQLite', 'Store exact pages, chunks and graph records.', 'apps/api/app/storage.py'),
    item('question', 'text', 'Scoped question', 'Search the selected documents.', 'apps/api/app/study_routes.py'),
    item('rank', 'component', 'Ranked evidence', 'Resolve matches to committed source chunks.', 'apps/api/app/retrieval.py'),
    item('answer', 'explanation', 'Cited answer', 'Validate each quote before showing the answer.', 'apps/api/app/study_routes.py'),
    item('passage', 'evidence', 'memory-and-learning.md', fixture.quote),
    item('rule', 'note', 'A match is a candidate', 'The quoted passage must come from a committed source chunk.'),
  ],
  links: [
    link('upload-parse', 'upload', 'parse', 'extracts'),
    link('parse-index', 'parse', 'index', 'indexes'),
    link('parse-store', 'parse', 'store', 'commits'),
    link('index-rank', 'index', 'rank', 'matches', 'dependency'),
    link('store-rank', 'store', 'rank', 'source text', 'dependency'),
    link('question-rank', 'question', 'rank', 'retrieves'),
    link('rank-answer', 'rank', 'answer', 'grounds'),
    link('answer-passage', 'answer', 'passage', 'cites'),
  ],
};

const keys = {
  'Memory and learning': 'memory', 'Working memory': 'working', 'Long-term memory': 'long',
  'Retrieval practice': 'recall', 'Spaced practice': 'spaced', Feedback: 'feedback',
  'Worked examples': 'example', 'Concept maps': 'maps', 'Checking understanding': 'check',
  'Source references': 'refs',
};
const byCanonicalId = new Map(fixture.graph.nodes.map(node => [node.id, keys[node.label]]));
const knowledge = {
  title: 'Memory and learning',
  caption: 'A concept map from two original GRASP study notes.',
  objects: [
    ...fixture.graph.nodes.map(node => ({
      ...item(keys[node.label], node.label === 'Retrieval practice' ? 'primary' : 'concept', node.label, node.summary),
      canonicalId: node.id, docIds: node.docIds, sourceChunkIds: node.sourceChunkIds,
    })),
    ...fixture.documents.map(document => ({
      ...item(document.name === 'memory-and-learning.md' ? 'memory-doc' : 'review-doc', 'document', document.name, document.description),
      docId: document.id, page: 1,
    })),
    item('passage', 'evidence', 'memory-and-learning.md', fixture.quote),
    item('question', 'text', fixture.question, 'Recorded answer'),
  ],
  links: [
    ...fixture.graph.edges.map(edge => ({
      ...link(edge.id, byCanonicalId.get(edge.source), byCanonicalId.get(edge.target), edge.relationshipLabel, 'adjacency'),
      canonicalId: edge.id, docIds: edge.docIds,
    })),
    link('memory-doc-memory', 'memory-doc', 'memory', 'source for', 'dependency'),
    link('review-doc-memory', 'review-doc', 'memory', 'source for', 'dependency'),
    link('recall-passage', 'recall', 'passage', 'exact passage'),
  ],
};

// World coordinates for three authored presentations of the same objects.
const layouts = {
  a: {
    engineering: {
      regions: [['Ingestion', 32, 153, 742, 212], ['Retrieval', 32, 415, 1125, 240]],
      objects: {
        upload: [58, 226, 176, 85], parse: [281, 214, 201, 104], index: [574, 207, 161, 64],
        store: [574, 286, 161, 62], question: [56, 501, 178, 68], rank: [303, 482, 205, 106],
        answer: [631, 474, 219, 112], passage: [910, 472, 224, 134], rule: [838, 205, 262, 112],
      },
      routes: { 'index-rank': ['r','t',0.5,[750,394]], 'store-rank': ['b','t',0.67], 'answer-passage': ['r','l'] },
    },
    knowledge: {
      regions: [['Memory', 254, 167, 426, 227], ['Study methods', 254, 426, 574, 234]],
      objects: {
        'memory-doc': [34, 205, 176, 82], 'review-doc': [34, 330, 176, 82], memory: [286, 221, 183, 57],
        working: [493, 221, 155, 57], long: [494, 311, 155, 53], recall: [282, 483, 254, 98],
        spaced: [567, 475, 111, 58], feedback: [690, 568, 108, 55], example: [699, 467, 106, 52],
        maps: [282, 598, 100, 50], check: [406, 598, 133, 50], refs: [563, 596, 112, 50],
        passage: [879, 474, 248, 137], question: [877, 290, 264, 81],
      },
      routes: { 'recall-passage': ['t','t'], 'review-doc-memory': ['r','l'] },
    },
  },
  b: {
    engineering: {
      regions: [['Ingestion', 40, 151, 1104, 210], ['Retrieval', 40, 411, 1104, 231]],
      objects: {
        upload: [70, 224, 198, 89], parse: [348, 218, 208, 97], index: [650, 224, 180, 83],
        store: [915, 224, 196, 83], question: [70, 493, 195, 77], rank: [346, 481, 206, 105],
        answer: [647, 480, 194, 105], passage: [885, 468, 226, 133], rule: [748, 34, 368, 87],
      },
      routes: { 'parse-store': ['t','t'], 'store-rank': ['b','t',0.4], 'index-rank': ['b','t',0.65] },
    },
    knowledge: {
      regions: [['Sources', 39, 162, 214, 482], ['Concept map', 286, 162, 563, 482], ['Evidence', 879, 162, 265, 482]],
      objects: {
        'memory-doc': [57, 226, 176, 82], 'review-doc': [57, 333, 176, 82], memory: [318, 223, 180, 57],
        working: [563, 219, 149, 57], long: [646, 311, 171, 55], recall: [318, 334, 236, 91],
        spaced: [599, 432, 106, 51], feedback: [718, 433, 102, 51], example: [574, 518, 100, 49],
        maps: [318, 520, 94, 47], check: [426, 521, 128, 47], refs: [690, 525, 127, 47],
        passage: [899, 344, 223, 145], question: [896, 226, 221, 79],
      },
      routes: { 'recall-passage': ['r','l'] },
    },
  },
  c: {
    engineering: {
      regions: [['Index the documents', 38, 159, 571, 316], ['Retrieve the passage', 38, 503, 571, 150], ['Answer & evidence', 650, 159, 511, 494]],
      objects: {
        upload: [62, 227, 176, 77], parse: [323, 211, 224, 101], index: [66, 364, 164, 65],
        store: [328, 366, 206, 68], question: [62, 560, 173, 61], rank: [334, 553, 230, 82],
        answer: [678, 229, 234, 109], passage: [683, 431, 438, 158], rule: [929, 232, 197, 123],
      },
      routes: { 'parse-index': ['b','t'], 'rank-answer': ['r','l',0.61], 'answer-passage': ['b','t',0.5] },
    },
    knowledge: {
      regions: [['Map the ideas', 35, 161, 692, 494], ['Read the source', 760, 161, 391, 494]],
      objects: {
        'memory-doc': [784, 222, 194, 92], 'review-doc': [995, 222, 134, 92], memory: [67, 230, 198, 56],
        working: [297, 216, 162, 57], long: [511, 218, 166, 56], recall: [113, 360, 276, 105],
        spaced: [444, 341, 113, 55], feedback: [571, 402, 105, 53], example: [452, 470, 111, 53],
        maps: [68, 552, 111, 55], check: [201, 553, 142, 54], refs: [366, 551, 122, 55],
        passage: [785, 368, 332, 149], question: [787, 544, 324, 81],
      },
      routes: { 'recall-passage': ['r','l',0.82], 'memory-doc-memory': ['t','t'], 'review-doc-memory': ['t','t'] },
    },
  },
};

export function sceneFor(direction, board) {
  const current = board === 'knowledge' ? knowledge : engineering;
  const geometry = layouts[direction][board];
  return {
    title: current.title,
    caption: current.caption,
    regions: geometry.regions,
    objects: current.objects.map(object => {
      const [x, y, width, height] = geometry.objects[object.id];
      return { ...object, x, y, width, height, url: object.url ? repo + object.url : undefined };
    }),
    links: current.links.map(relation => ({ ...relation, route: geometry.routes[relation.id] })),
  };
}
