const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('../../apps/web/node_modules/typescript');

const root = path.join(__dirname, '../../apps/web/src/showcase');
function load(module) {
  const source = fs.readFileSync(path.join(root, `${module}.ts`), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports', output)(exports);
  return exports;
}

const replay = load('replay');
const { installShowcaseDropHandlers, sampleTouchHandlers, sampleTransferType } = load('drop');
const { answerFromTrace, routerQuestion } = load('evidence');
const { guideTopics, guideStages } = load('guide-data');
const trace = JSON.parse(fs.readFileSync(path.join(root, 'traces/computer-networks.json'), 'utf8'));

test('the walkthrough draws its comparison numbers from the archived reports', () => {
  const displayed = JSON.parse(fs.readFileSync(path.join(root, 'guide-results.json'), 'utf8'));
  for (const mode of ['live', 'mock']) {
    const reportPath = path.join(__dirname, `../../docs/evaluation-portfolio-${mode}.json`);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const runs = report.runs.map(({ id, chunkSize, overlap, ranking, chunks, meanContextChars, cases }) => ({
      id, chunkSize, overlap, ranking, chunks, meanContextChars, hits: cases.filter(row => row.rank !== null).length,
    }));
    assert.deepEqual(displayed[mode], { documents: Object.keys(report.corpus).length, questions: report.questions, topK: report.topK, runs });
  }
});

test('the walkthrough example opens the original recorded answer and source', () => {
  const prompt = trace.prompts.find(entry => entry.question === routerQuestion);
  assert.ok(prompt);
  assert.deepEqual(answerFromTrace(trace, routerQuestion), prompt.answer);
  assert.ok(prompt.answer.citations.every(citation => trace.chunks.some(chunk => chunk.id === citation.chunkId && chunk.text.includes(citation.quote))));
  assert.deepEqual(guideTopics.map(topic => topic.id), ['pipeline', 'tradeoffs', 'adapt', 'evaluation', 'production']);
  assert.ok([...guideStages.prepare, ...guideStages.question].every(stage => fs.existsSync(path.join(__dirname, '../..', stage.file))));
});

function drag(target, type, dataTransfer) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  target.dispatchEvent(event);
  return event;
}

test('the actual drop listeners reject external files without reading data, items or filenames', () => {
  const target = new EventTarget();
  const observed = [];
  let reads = 0;
  function forbidden() { reads++; throw new Error('A real file must never be read'); }
  const fileTransfer = {
    types: ['Files', sampleTransferType],
    get files() { return forbidden(); },
    get items() { return forbidden(); },
    getData: forbidden,
  };
  const cleanup = installShowcaseDropHandlers(target, ['computer-networks'], {
    onDrag: value => observed.push(value),
    onSample: id => observed.push(id),
    onRejectedFile: () => observed.push('rejected'),
  });
  assert.equal(drag(target, 'dragover', fileTransfer).defaultPrevented, true);
  assert.equal(drag(target, 'drop', fileTransfer).defaultPrevented, true);
  assert.deepEqual(observed, ['files', null, 'rejected']);
  assert.equal(reads, 0);
  cleanup();
  assert.equal(drag(target, 'drop', fileTransfer).defaultPrevented, false);
});

test('sample drops accept only bundled IDs and leave text drops alone', () => {
  const target = new EventTarget();
  const opened = [];
  const cleanup = installShowcaseDropHandlers(target, ['computer-networks'], {
    onDrag() {}, onSample: id => opened.push(id), onRejectedFile() {},
  });
  const sample = id => ({ types: [sampleTransferType], getData: type => {
    assert.equal(type, sampleTransferType);
    return id;
  } });
  drag(target, 'drop', sample('unknown'));
  drag(target, 'drop', sample('computer-networks'));
  const text = drag(target, 'drop', { types: ['text/plain'] });
  assert.equal(text.defaultPrevented, false);
  assert.deepEqual(opened, ['computer-networks']);
  cleanup();
});

function touchSample() {
  const opened = [];
  const overlay = [];
  const captured = [];
  const handlers = sampleTouchHandlers(dragging => overlay.push(dragging), id => opened.push(id));
  function pointer(overrides = {}) {
    return { pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true, clientX: 20, clientY: 40,
      currentTarget: { setPointerCapture: id => captured.push(id) }, ...overrides };
  }
  return { handlers, opened, overlay, captured, pointer };
}

test('touch taps, desktop clicks and keyboard activation open a sample', () => {
  const { handlers, opened, overlay, captured, pointer } = touchSample();
  handlers.pointerDown(pointer(), 'computer-networks');
  handlers.pointerMove(pointer({ clientX: 28 }));
  handlers.pointerUp(pointer());
  assert.deepEqual(opened, []);
  handlers.click({ detail: 1 }, 'computer-networks');
  handlers.pointerDown(pointer({ pointerType: 'mouse' }), 'retrieval-review');
  assert.equal(handlers.isActive(), false);
  handlers.click({ detail: 1 }, 'retrieval-review');
  handlers.click({ detail: 0 }, 'memory-and-learning');
  assert.deepEqual(opened, ['computer-networks', 'retrieval-review', 'memory-and-learning']);
  assert.deepEqual(captured, [1]);
  assert.ok(!overlay.includes(true));
});

test('only the owning pointer can finish a sample drag and its click does not replay twice', () => {
  const { handlers, opened, overlay, captured, pointer } = touchSample();
  handlers.pointerDown(pointer(), 'computer-networks');
  const second = pointer({ pointerId: 2, isPrimary: false, clientX: 80 });
  handlers.pointerDown(second, 'retrieval-review');
  handlers.pointerMove(second);
  assert.deepEqual(overlay, []);
  handlers.pointerMove(pointer({ clientX: 45 }));
  handlers.pointerMove(pointer({ clientX: 60 }));
  handlers.pointerCancel(second);
  handlers.pointerUp(second);
  assert.equal(handlers.isActive(), true);
  assert.deepEqual(opened, []);
  handlers.pointerUp(pointer());
  handlers.click({ detail: 1 }, 'computer-networks');
  assert.deepEqual(opened, ['computer-networks']);
  assert.deepEqual(overlay, [true, false]);
  assert.deepEqual(captured, [1]);
});

test('cancelling a drag clears the overlay and suppresses any late pointer click', () => {
  const { handlers, opened, overlay, pointer } = touchSample();
  handlers.pointerDown(pointer(), 'computer-networks');
  handlers.pointerMove(pointer({ clientX: 60 }));
  handlers.pointerCancel(pointer());
  handlers.pointerUp(pointer());
  handlers.click({ detail: 1 }, 'computer-networks');
  assert.equal(handlers.isActive(), false);
  assert.deepEqual(opened, []);
  assert.deepEqual(overlay, [true, false]);
  handlers.pointerDown(pointer(), 'retrieval-review');
  handlers.pointerUp(pointer());
  handlers.click({ detail: 1 }, 'retrieval-review');
  assert.deepEqual(opened, ['retrieval-review']);
});

test('playback retains elapsed time through pause and speed and supports skip and restart', () => {
  let state = replay.reducePlayback(replay.playbackState(false), { type: 'restart' });
  const total = replay.stages.pages.duration;
  assert.equal(replay.playbackDelay(state, 'pages'), total);
  state = replay.reducePlayback(state, { type: 'toggle' });
  assert.equal(replay.playbackDelay(state, 'pages'), null);
  state = replay.reducePlayback(state, { type: 'setSpeed', speed: 2 });
  state = replay.reducePlayback(state, { type: 'toggle' });
  assert.equal(replay.playbackDelay(state, 'pages', 300), (total - 300) / 2);
  state = replay.reducePlayback(state, { type: 'skip' });
  assert.equal(state.step, replay.finalStep);
  assert.equal(state.playing, false);
  state = replay.reducePlayback(state, { type: 'restart' });
  assert.equal(state.step, 0);
  assert.equal(state.run, 2);
  assert.equal(replay.playbackDelay(state, 'pages'), total / 2);
});

test('reduced motion advances manually and never queues an automatic step', () => {
  let state = replay.reducePlayback(replay.playbackState(true), { type: 'restart' });
  state = replay.reducePlayback(state, { type: 'toggle' });
  assert.equal(replay.playbackDelay(state, 'pages'), null);
  state = replay.reducePlayback(state, { type: 'step' });
  assert.equal(state.step, 1);
  assert.equal(state.playing, false);
});

test('local questions cite exact recorded text and decline when no words match', () => {
  const canned = trace.prompts[0];
  assert.deepEqual(answerFromTrace(trace, canned.question), canned.answer);
  const matched = answerFromTrace(trace, 'Explain the DNS resolver');
  assert.ok(matched.citations.length);
  for (const citation of matched.citations) {
    const chunk = trace.chunks.find(item => item.id === citation.chunkId);
    assert.equal(citation.page, chunk.page);
    assert.ok(chunk.text.includes(citation.quote));
    assert.deepEqual(matched.referencedNodeIds, trace.graph.nodes.filter(node => node.sourceChunkIds.includes(chunk.id)).map(node => node.id));
  }
  assert.deepEqual(answerFromTrace(trace, 'Where do arctic penguins migrate?').citations, []);
});
