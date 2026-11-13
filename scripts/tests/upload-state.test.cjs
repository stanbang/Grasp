const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../apps/web/node_modules/typescript');
const source = fs.readFileSync(path.join(__dirname, '../../apps/web/src/upload-state.ts'), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const api = {};
new Function('exports', output)(api);

const initial = () => ({ name: 'Memory and learning.pdf', status: 'uploading', message: 'Uploading document', cursor: 0 });
const event = (id, type, values = {}) => ({ id, type, docId: 'document-a', ...values });

test('replayed and out-of-order SSE events do not regress a job', () => {
  const extracting = api.updateUpload(initial(), event(9, 'status', { document: { status: 'extracting' } }));
  assert.strictEqual(api.updateUpload(extracting, event(8, 'status', { document: { status: 'queued' } })), extracting);
  assert.strictEqual(api.updateUpload(extracting, event(9, 'error', { message: 'Replayed error' })), extracting);
});

test('only a complete event releases a successful processing state', () => {
  const extracting = api.updateUpload(initial(), event(1, 'status', { document: { status: 'extracting' } }));
  const statusOnly = api.updateUpload(extracting, event(2, 'status', { document: { status: 'done' } }));
  assert.notEqual(statusOnly.status, 'done');
  const complete = api.updateUpload(statusOnly, event(3, 'complete', { document: { status: 'done' }, message: 'Ready to explore' }));
  assert.equal(complete.status, 'done');
  assert.equal(complete.message, 'Ready to explore');
});

test('failure remains terminal even if a later success arrives', () => {
  const failed = api.updateUpload(initial(), event(3, 'error', { message: 'The PDF could not be read.' }));
  assert.equal(failed.status, 'failed');
  assert.equal(failed.message, 'The PDF could not be read.');
  assert.strictEqual(api.updateUpload(failed, event(4, 'complete', { document: { status: 'done' } })), failed);
});

test('completed jobs ignore later status and graph replay', () => {
  const complete = api.updateUpload(initial(), event(3, 'complete', { document: { status: 'done' } }));
  assert.strictEqual(api.updateUpload(complete, event(4, 'status', { document: { status: 'extracting' } })), complete);
  assert.strictEqual(api.updateUpload(complete, event(5, 'node')), complete);
});

test('source-batch counts remain counts rather than a document percentage', () => {
  const state = api.updateUpload(initial(), event(2, 'status', {
    document: { status: 'extracting' }, message: 'Extracted a source batch.', completedBatches: 1, totalBatches: 8,
  }));
  assert.match(state.message, /1 of 8 source batches/);
  assert.doesNotMatch(state.message, /%/);
  const noTotal = api.updateUpload(initial(), event(3, 'status', { document: { status: 'extracting' }, completedBatches: 0, totalBatches: 0 }));
  assert.doesNotMatch(noTotal.message, /NaN|Infinity|%/);
});

test('server identity and original filename survive the full job lifecycle', () => {
  let state = initial();
  for (const [id, status] of [[1, 'queued'], [2, 'chunking'], [3, 'extracting']]) {
    state = api.updateUpload(state, event(id, 'status', { document: { status, name: 'Untrusted replacement name.pdf' } }));
    assert.equal(state.name, 'Memory and learning.pdf');
    assert.equal(state.docId, 'document-a');
  }
  state = api.updateUpload(state, event(4, 'complete', { document: { status: 'done' } }));
  assert.equal(state.name, 'Memory and learning.pdf');
  assert.equal(state.docId, 'document-a');
});
