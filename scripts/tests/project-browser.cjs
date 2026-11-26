const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, mkdirSync } = require('node:fs');
const { once } = require('node:events');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '../..');
const browserTools = process.env.GRASP_PLAYWRIGHT ?? 'work/grasp-v2-phase1/browser-tools/node_modules/playwright-core';
const { chromium } = require(path.resolve(root, browserTools));
const chrome = process.env.GRASP_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const python = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
const evidence = path.resolve(root, process.env.GRASP_EVIDENCE_DIR ?? 'work/grasp-phase2-verification');
const owner = randomUUID();
const agent = randomUUID();
const port = process.env.GRASP_TEST_API_PORT ?? '8031';
assert.match(port, /^\d{4,5}$/);
const base = `http://127.0.0.1:${port}`;

async function request(route, body, token = agent) {
  const response = await fetch(base + '/api' + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`${route} returned ${response.status}: ${await response.text()}`);
  return response.json();
}

async function startApi(directory) {
  const child = spawn(path.join(root, python), [
    '-m', 'uvicorn', 'app.production:application', '--app-dir', 'apps/api',
    '--host', '127.0.0.1', '--port', port,
  ], { cwd: root, env: { ...process.env, MOCK_LLM: '1', DATA_DIR: directory, ACCESS_TOKEN: owner, GRASP_AGENT_TOKEN: agent } });
  let errors = '';
  child.on('error', error => { errors += error.message; });
  child.stderr.on('data', data => { errors += data; });
  child.stdout.resume();
  for (let attempt = 0; attempt < 80 && child.exitCode === null; attempt++) {
    try {
      if ((await request('/health')).status === 'ok') return child;
    } catch {
      await delay(250);
    }
  }
  await stopApi(child);
  throw new Error(`Grasp did not start on port ${port}. ${errors}`);
}

async function stopApi(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  const stopped = once(child, 'exit');
  child.kill();
  await stopped;
}

async function unlock(page) {
  await page.getByLabel('Workspace access token').fill(owner);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await page.getByLabel('Workspace access token').waitFor({ state: 'hidden' });
}

const button = (page, name) => page.getByRole('button', { name, exact: true });
const card = (page, name) => page.locator('.react-flow__node').filter({ has: page.getByText(name, { exact: true }) });
const revision = (page, number) => page.getByText(`Revision ${number}`, { exact: true }).waitFor();
const place = { x: 350, y: 100, width: 228, height: 116 };

async function waitForContext(matches) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const context = await request('/boards/context');
    if (matches(context)) return context;
    await delay(150);
  }
  assert.fail('The browser did not share the expected active board context');
}

async function uploadEvidence() {
  const upload = new FormData();
  upload.append('file', new Blob(['# Source\n\n🧪 A token comes before the target token.']), 'project-evidence.md');
  const response = await fetch(base + '/api/documents', {
    method: 'POST', headers: { Authorization: `Bearer ${owner}` }, body: upload,
  });
  assert.equal(response.status, 202);
  const document = await response.json();
  for (let attempt = 0; attempt < 40; attempt++) {
    const status = await request(`/documents/${document.id}`, undefined, owner);
    if (status.status === 'done') {
      const source = await request(`/documents/${document.id}/pages/1`, undefined, owner);
      const { chunks } = await request(`/documents/${document.id}/chunks`, undefined, owner);
      const prefix = source.text.slice(0, source.text.lastIndexOf('token'));
      const charStart = Array.from(prefix).length;
      const charEnd = charStart + 'token'.length;
      const chunk = chunks.find(item => item.charStart <= charStart && charEnd <= item.charEnd);
      assert.ok(chunk);
      return { prefix, reference: { chunkId: chunk.id, docId: document.id, page: 1, charStart, charEnd } };
    }
    assert.notEqual(status.status, 'error');
    await delay(200);
  }
  throw new Error('The project evidence fixture did not finish indexing.');
}

async function run() {
  mkdirSync(evidence, { recursive: true });
  const directory = mkdtempSync(path.join(evidence, 'library-'));
  let server;
  let browser;
  try {
    server = await startApi(directory);
    browser = await chromium.launch({ executablePath: chrome, headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await unlock(page);
    await button(page, 'Projects').click();
    await page.getByLabel('Board name').fill('Feedback prototype');
    await button(page, 'Create board').click();
    await revision(page, 0);
    const id = new URL(page.url()).searchParams.get('projectBoard');
    assert.ok(id);
    const board = `/boards/${id}`;
    const write = (baseRevision, operations) => request(board + '/ops', { baseRevision, mutationId: randomUUID(), operations });
    const inspector = page.getByRole('complementary', { name: 'Object inspector' });

    await button(page, 'Add object').click();
    await button(page, 'Note').click();
    await revision(page, 1);
    await inspector.getByLabel('Title').fill('Browser note');
    await inspector.getByLabel('Title').press('Tab');
    await revision(page, 2);
    await button(page, 'Close inspector').click();
    const before = await request(board);
    const [noteId] = Object.keys(before.objects);
    assert.equal(before.objects[noteId].title, 'Browser note');
    assert.equal(before.objects[noteId].createdBy, 'user');

    const box = await card(page, 'Browser note').getByText('Browser note', { exact: true }).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 90, y + 55, { steps: 9 });
    await page.mouse.up();
    await revision(page, 3);
    const moved = await request(board);
    assert.notDeepEqual(moved.objects[noteId].placement, before.objects[noteId].placement);
    await button(page, 'Zoom out').click();
    await page.keyboard.press('Escape');
    assert.equal((await request(board)).revision, 3);
    await button(page, 'Undo').click();
    await revision(page, 4);
    assert.deepEqual((await request(board)).objects[noteId].placement, before.objects[noteId].placement);
    await button(page, 'Redo').click();
    await revision(page, 5);
    assert.deepEqual((await request(board)).objects[noteId].placement, moved.objects[noteId].placement);

    const agentObject = { id: 'agent-figure', title: 'Agent illustration', kind: 'illustration', illustration: 'chunks', placement: place };
    const agentEdit = await write(5, [
      { type: 'addObject', object: agentObject },
      { type: 'addConnection', connection: { id: 'agent-arrow', source: 'agent-figure', target: noteId, label: 'Explains' } },
    ]);
    assert.equal(agentEdit.actor, 'agent');
    await card(page, agentObject.title).locator('svg[data-illustration="chunks"]').waitFor();
    await page.locator('.react-flow__edge[data-id="agent-arrow"]').waitFor({ state: 'attached' });
    await revision(page, 6);
    assert.equal(await button(page, 'Undo').isEnabled(), false, 'External updates clear the browser undo history');
    await card(page, agentObject.title).dblclick();
    await inspector.getByText('Added by agent', { exact: true }).waitFor();
    for (let attempt = 0; attempt < 15; attempt++) {
      const selection = await request(board + '/selection');
      if (selection.available) {
        assert.deepEqual(selection.objectIds, [agentObject.id]);
        break;
      }
      assert.ok(attempt < 14, 'Browser selection was not published to the agent');
      await delay(150);
    }
    const active = await waitForContext(value => value.board?.id === id && value.selection?.status === 'selected');
    assert.deepEqual(active.selection.objectIds, [agentObject.id]);
    assert.deepEqual(active.annotationIds, [noteId]);
    const history = (await request(`/boards/context?boardId=${id}&sinceRevision=1`)).changes.revisions;
    assert.ok(history.some(delta => delta.actor === 'user' &&
      delta.objects.some(item => item.id === noteId && item.fields.includes('placement'))));
    assert.ok(history.some(delta => delta.actor === 'agent' &&
      delta.connections.some(item => item.id === 'agent-arrow' && item.change === 'added')));

    const other = await request('/boards', { title: 'Second test board' }, owner);
    const otherPage = await browser.newPage();
    await otherPage.goto(`${base}/?board=project&projectBoard=${other.id}`);
    await unlock(otherPage);
    await revision(otherPage, 0);
    const ambiguous = await waitForContext(value => value.status === 'ambiguousBoard');
    assert.deepEqual(new Set(ambiguous.candidates.map(candidate => candidate.id)), new Set([id, other.id]));
    assert.deepEqual((await request(`/boards/context?boardId=${id}`)).selection.objectIds, [agentObject.id]);
    await button(otherPage, 'Engineering').click();
    await waitForContext(value => value.board?.id === id);
    await otherPage.close();
    console.log('PASS board context reports browser edits and distinguishes two open boards');
    await button(page, 'Close inspector').click();

    await card(page, 'Browser note').dblclick();
    await inspector.getByLabel('Title').fill('Unsaved local title');
    const latest = await write(6, [{ type: 'placeObject', objectId: noteId, placement: { ...place, x: -50 } }]);
    await inspector.getByLabel('Title').press('Tab');
    const conflict = page.getByRole('alert').filter({ hasText: 'Board changed to revision 7. Your draft is kept.' });
    await conflict.waitFor();
    await card(page, 'Unsaved local title').waitFor();
    assert.deepEqual(await request(board), latest.board);
    await page.reload();
    await conflict.waitFor();
    await card(page, 'Unsaved local title').waitFor();
    await button(page, 'Discard draft').click();
    await revision(page, 7);
    await card(page, 'Browser note').waitFor();
    assert.deepEqual(await request(board), latest.board);
    console.log('PASS browser creates and moves a note, undo and redo persist, and an agent batch appears live');
    console.log('PASS stale browser draft survives reload and committed agent changes stay saved');

    await stopApi(server);
    server = await startApi(directory);
    assert.deepEqual(await request(board), latest.board);
    await page.reload();
    await revision(page, 7);
    assert.equal(await page.getByLabel('Workspace access token').isVisible(), false);
    assert.equal(await card(page, 'Browser note').getAttribute('data-id'), noteId);
    await card(page, agentObject.title).waitFor();
    console.log('PASS API restart and browser reload preserve revision, object IDs, geometry and connection');

    const { prefix, reference } = await uploadEvidence();
    await request(board + '/ops', {
      baseRevision: 7, mutationId: randomUUID(), operations: [{ type: 'addObject', object: {
        id: 'selected-span', title: 'Selected source span', kind: 'evidence',
        placement: { ...place, x: 110, y: 260 }, evidence: [reference],
      } }],
    }, owner);
    await revision(page, 8);
    await button(page, 'Fit board').click();
    await card(page, 'Selected source span').dblclick();
    await button(page, 'project-evidence.md · p1').click();
    await page.getByText('Extracted page with highlighted citation', { exact: true }).click();
    const highlighted = page.getByRole('dialog').locator('mark');
    assert.equal(await highlighted.textContent(), 'token');
    assert.equal(await highlighted.evaluate(element => element.previousSibling.textContent), prefix);
    await button(page, 'Close dialog').click();
    await button(page, 'Close inspector').click();
    console.log('PASS project evidence opens the exact repeated quote at its Unicode span');

    await button(page, 'Fit board').click();
    await page.screenshot({ path: path.join(evidence, 'project-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await button(page, 'Fit board').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    const titleBox = await card(page, 'Browser note').getByText('Browser note', { exact: true }).boundingBox();
    assert.ok(titleBox.x >= 0 && titleBox.x + titleBox.width <= 390, 'The note is visible after fitting the narrow canvas');
    await page.screenshot({ path: path.join(evidence, 'project-mobile.png') });

    await page.setViewportSize({ width: 1440, height: 900 });
    await button(page, 'Fit board').click();
    const arrow = page.locator('.react-flow__edge[data-id="agent-arrow"]');
    async function inspectArrow() {
      await page.keyboard.press('Escape');
      await arrow.press('Enter');
      await inspector.getByLabel('Target object').waitFor();
    }
    await inspectArrow();
    const focused = await waitForContext(value => value.selection?.connectionIds?.includes('agent-arrow'));
    assert.deepEqual(focused.selection.objectIds, []);
    await inspector.getByLabel('Target object').selectOption('selected-span');
    await revision(page, 9);
    const corrected = await waitForContext(value => value.board?.revision === 9
      && value.selection?.connectionIds?.includes('agent-arrow'));
    assert.equal(corrected.board.connections['agent-arrow'].target, 'selected-span');
    assert.equal(corrected.board.connections['agent-arrow'].updatedBy, 'user');
    await button(page, 'Add requirement').click();
    await revision(page, 10);
    await inspector.getByLabel('Title').fill('Require a source span');
    await inspector.getByLabel('Title').press('Tab');
    await revision(page, 11);
    await inspector.getByLabel('Requirement decision').selectOption('accepted');
    await revision(page, 12);
    await inspectArrow();
    await inspector.getByRole('button', { name: 'Require a source span', exact: true }).waitFor();
    const attached = await waitForContext(value => value.selection?.connectionIds?.includes('agent-arrow')
      && value.focus?.feedbackIds?.length === 1);
    const [decisionId] = attached.decisionIds;
    assert.deepEqual(attached.focus.feedbackIds, [decisionId]);
    await button(page, 'Remove connection').click();
    await revision(page, 13);
    const afterRemoval = await request(board);
    assert.equal(afterRemoval.objects[decisionId].decidedBy, 'user');
    assert.deepEqual(afterRemoval.objects[decisionId].relatedConnectionIds, []);
    assert.ok(!afterRemoval.connections['agent-arrow']);
    console.log('PASS owner selects and reconnects the same arrow, attaches and decides a requirement, and deletes the arrow without losing the requirement');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await stopApi(server);
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
