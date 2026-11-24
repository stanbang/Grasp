const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('../../apps/web/node_modules/typescript');

function load(module) {
  const source = fs.readFileSync(path.join(__dirname, '../../apps/web/src', module), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function('exports', outputText)(exports);
  return exports;
}

const { emptyBoard, knowledgeScene, projectBoard, groupCards, removeAuthored, placeCard, rect, zoomAt } = load('canvas/board.ts');
const { updateUpload } = load('upload-state.ts');
const fixture = require('../../samples/demo-graph.json');

test('the canvas maps canonical nodes, relations and source scope without changing the graph', () => {
  const scene = knowledgeScene(fixture.graph, fixture.documents);
  const concepts = scene.cards.filter(card => card.kind === 'concept');
  assert.equal(concepts.length, fixture.graph.nodes.length);
  for (const node of fixture.graph.nodes) {
    const card = concepts.find(card => card.id === `concept:${node.id}`);
    assert.equal(card.concept, node);
    assert.equal(card.concept.sourceChunkIds, node.sourceChunkIds);
  }
  for (const edge of fixture.graph.edges) {
    const link = scene.links.find(link => link.canonicalId === edge.id);
    assert.equal(link.source, `concept:${edge.source}`);
    assert.equal(link.target, `concept:${edge.target}`);
    assert.equal(link.docIds, edge.docIds);
  }
  assert.deepEqual(knowledgeScene({ nodes: [...fixture.graph.nodes].reverse(), edges: [...fixture.graph.edges].reverse() }, fixture.documents).cards, scene.cards);
});

test('grouping and ungrouping leave world positions and canonical bindings in place', () => {
  const board = emptyBoard('knowledge');
  const seed = knowledgeScene(fixture.graph, fixture.documents);
  const members = seed.cards.slice(0, 2);
  const grouped = groupCards(board, members, 'new-group');
  const projected = projectBoard(seed, grouped);
  for (const member of members) {
    const card = projected.cards.find(card => card.id === member.id);
    assert.deepEqual(card.placement, { ...member.placement, groupId: 'new-group' });
  }
  const ungrouped = projectBoard(seed, removeAuthored(grouped, ['new-group'], []));
  assert.deepEqual(JSON.parse(JSON.stringify(ungrouped)), JSON.parse(JSON.stringify(seed)));
  assert.deepEqual(board.placements, {});
});

test('layout changes survive a refresh and dangling visual links are hidden', () => {
  const { cards, links } = knowledgeScene(fixture.graph, fixture.documents);
  const [first, second] = cards;
  const initialX = first.placement.x;
  const changed = {
    ...emptyBoard('knowledge'),
    placements: { [first.id]: { ...first.placement, x: -710 } },
    authoredLinks: [{ id: 'annotation', source: first.id, target: second.id, label: 'Practice', origin: 'authored' }],
  };
  const result = projectBoard({ cards: cards.filter(card => card.id !== second.id), links }, changed);
  assert.equal(result.cards.find(card => card.id === first.id).placement.x, -710);
  assert.ok(!result.links.some(link => link.source === second.id || link.target === second.id));
  assert.equal(first.placement.x, initialX);
});

test('new notes stay clear of occupied space, including when the viewport is full', () => {
  const occupied = { id: 'busy', kind: 'component', title: 'API', description: '', placement: rect(0, 0) };
  assert.deepEqual(placeCard([occupied], rect(0, 0, 600, 400), occupied), rect(250, 0));
  assert.ok(placeCard([occupied], rect(0, 0)).x > occupied.placement.width);
});

test('zoom keeps the same world coordinates under the anchor through multiple zoom levels', () => {
  const screenPoint = { x: 386, y: 234 };
  const initial = { x: -118, y: 560, zoom: 0.5 };
  let viewport = initial;
  for (const zoom of [0.25, 0.5, 1, 2, 3]) {
    viewport = zoomAt(viewport, screenPoint, zoom);
    for (const axis of ['x', 'y']) {
      const expected = (screenPoint[axis] - initial[axis]) / initial.zoom;
      assert.ok(Math.abs((screenPoint[axis] - viewport[axis]) / zoom - expected) < 1e-9);
    }
  }
});

test('upload updates ignore replayed events and preserve terminal state', () => {
  const upload = { name: 'notes.md', status: 'queued', cursor: 1, message: 'Queued' };
  const event = { id: 2, docId: 'note', type: 'status', document: { status: 'extracting' }, message: 'Reading', completedBatches: 0, totalBatches: 2 };
  const extracting = updateUpload(upload, event);
  assert.equal(extracting.message, 'Reading · 0 of 2 source batches');
  assert.equal(updateUpload(extracting, event), extracting);
  const done = updateUpload(extracting, { id: 3, docId: 'note', type: 'complete' });
  assert.equal(done.status, 'done');
  assert.equal(updateUpload(done, { id: 4, docId: 'note', type: 'error' }), done);
});
