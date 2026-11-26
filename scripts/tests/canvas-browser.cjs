const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

const base = new URL(process.env.GRASP_TEST_URL ?? 'http://127.0.0.1:5189');
assert.equal(base.hostname, '127.0.0.1', 'Run against a disposable loopback library.');
const evidence = process.env.GRASP_EVIDENCE_DIR ?? 'work/grasp-v2-phase1';
const { chromium } = require(path.resolve(process.env.GRASP_PLAYWRIGHT ?? 'work/grasp-v2-phase1/browser-tools/node_modules/playwright-core'));
const chrome = process.env.GRASP_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function camera(page) {
  return page.locator('.react-flow__viewport').evaluate(element => {
    const transform = new DOMMatrix(getComputedStyle(element).transform);
    return { x: transform.e, y: transform.f, zoom: transform.a };
  });
}

function card(page, title) {
  return page.locator('.react-flow__node').filter({ has: page.getByText(title, { exact: true }) });
}

function button(page, label) {
  return page.getByRole('button', { name: label, exact: true });
}

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

async function assertBoardFits(page) {
  const pane = await page.locator('.board-frame').boundingBox();
  for (const node of await page.locator('.react-flow__node').all()) {
    const box = await node.boundingBox();
    assert.ok(box.x >= pane.x + 24 && box.x + box.width <= pane.x + pane.width - 24, 'Horizontal fit padding');
    assert.ok(box.y >= pane.y + 24 && box.y + box.height <= pane.y + pane.height - 24, 'Vertical fit padding');
  }
}

async function run() {
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    desktop.setDefaultTimeout(5000);
    const pageErrors = [];
    const resources = [];
    desktop.on('pageerror', error => pageErrors.push(error.message));
    desktop.on('request', request => resources.push(request.url()));
    await desktop.goto(base.href);
    await desktop.getByText('Offline mock', { exact: true }).waitFor();
    if (await button(desktop, 'Open sample').isVisible()) {
      await desktop.screenshot({ path: path.join(evidence, 'canvas-empty.png') });
      await button(desktop, 'Open sample').click();
    }
    const retrieval = card(desktop, 'Retrieval practice');
    await retrieval.waitFor();
    await card(desktop, 'memory-and-learning.md').waitFor();
    await assertBoardFits(desktop);
    assert.ok(!resources.some(url => /react-force-graph-3d/.test(url)), '3D is lazy');
    await desktop.screenshot({ path: path.join(evidence, 'canvas-knowledge.png') });
    await desktop.setViewportSize({ width: 1280, height: 720 });
    await button(desktop, 'Fit board').click();
    await assertBoardFits(desktop);
    await desktop.screenshot({ path: path.join(evidence, 'canvas-knowledge-1280.png') });
    await desktop.setViewportSize({ width: 1440, height: 900 });
    await button(desktop, 'Fit board').click();

    const pane = await desktop.locator('.board-frame').boundingBox();
    const anchor = { x: pane.width / 2 + 130, y: pane.height / 2 + 30 };
    const before = await camera(desktop);
    await desktop.mouse.move(pane.x + anchor.x, pane.y + anchor.y);
    await desktop.mouse.wheel(0, -120);
    const zoomed = await camera(desktop);
    assert.ok(zoomed.zoom > before.zoom);
    for (const axis of ['x', 'y']) {
      const world = (anchor[axis] - before[axis]) / before.zoom;
      assert.ok(Math.abs(zoomed[axis] + world * zoomed.zoom - anchor[axis]) <= 2, `Zoom anchor ${axis}`);
    }
    await desktop.mouse.wheel(16, 14);
    const panned = await camera(desktop);
    assert.equal(panned.zoom, zoomed.zoom);
    assert.ok(panned.x < zoomed.x && panned.y < zoomed.y);
    await desktop.keyboard.down('Control');
    await desktop.mouse.wheel(0, -18);
    await desktop.keyboard.up('Control');
    assert.ok((await camera(desktop)).zoom > panned.zoom, 'Pinch-style wheel input zooms');
    await button(desktop, 'Fit board').click();
    await assertBoardFits(desktop);
    console.log('PASS initial fit, anchored zoom and two-axis wheel pan');

    const start = await retrieval.boundingBox();
    await drag(desktop, { x: start.x + 30, y: start.y + 23 }, { x: start.x + 77, y: start.y + 54 });
    const moved = await retrieval.boundingBox();
    assert.ok(moved.x - start.x > 35 && moved.y - start.y > 20, 'Drag changes world position');
    await button(desktop, 'Undo').click();
    assert.ok(Math.abs((await retrieval.boundingBox()).x - start.x) < 2, 'Undo restores the whole drag');
    await button(desktop, 'Redo').click();
    assert.ok(Math.abs((await retrieval.boundingBox()).x - moved.x) < 2, 'Redo restores the whole drag');
    await retrieval.click();
    await retrieval.focus();
    await desktop.keyboard.press('ArrowRight');
    assert.ok((await retrieval.boundingBox()).x > moved.x, 'Keyboard moves selected card');
    const resize = retrieval.locator('.react-flow__resize-control.handle.bottom.right');
    const handle = await resize.boundingBox();
    assert.ok(handle, 'Selected card exposes a resize handle');
    const originalWidth = (await retrieval.boundingBox()).width;
    await drag(desktop, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
      { x: handle.x + 52, y: handle.y + 24 });
    assert.ok((await retrieval.boundingBox()).width > originalWidth + 20, 'Resize changes card width');
    await button(desktop, 'Fit selection').click();
    const selected = await retrieval.boundingBox();
    assert.ok(Math.abs(selected.x + selected.width / 2 - (pane.x + pane.width / 2)) < 2);
    console.log('PASS drag, undo, redo, keyboard move, resize and fit selection');

    const canonicalId = await retrieval.getAttribute('data-id');
    const beforeCancel = await retrieval.boundingBox();
    await desktop.mouse.move(beforeCancel.x + 25, beforeCancel.y + 22);
    await desktop.mouse.down();
    await desktop.mouse.move(beforeCancel.x + 90, beforeCancel.y + 48, { steps: 5 });
    await desktop.locator('.board-frame').dispatchEvent('pointercancel');
    await desktop.mouse.up();
    assert.ok(Math.abs((await retrieval.boundingBox()).x - beforeCancel.x) < 2, 'Cancel restores card position');

    await retrieval.dblclick();
    const inspector = desktop.getByRole('complementary', { name: 'Object inspector' });
    await inspector.getByRole('heading', { name: 'Source passages' }).waitFor();
    const source = inspector.getByRole('button', { name: /\.md · p1/ }).first();
    await source.click();
    const sourceDialog = desktop.getByRole('dialog', { name: 'Source · page 1' });
    await sourceDialog.locator('blockquote').waitFor();
    await sourceDialog.locator('.board-source-name').waitFor();
    const exactQuote = await sourceDialog.locator('blockquote').textContent();
    assert.match(exactQuote, /retrieval/i);
    await button(desktop, 'Close dialog').click();
    await inspector.getByRole('button', { name: 'Ask about this concept' }).click();
    const question = desktop.getByRole('textbox', { name: 'Your question' });
    await question.fill('What is retrieval practice?');
    await button(desktop, 'Ask question').click();
    await button(desktop, 'Source 1 · p1').waitFor();
    assert.ok(await desktop.locator('.conversation-thread').evaluate(thread => {
      const answer = thread.querySelector('h3').getBoundingClientRect();
      const box = thread.getBoundingClientRect();
      return answer.top >= box.top && answer.bottom <= box.bottom;
    }), 'Newest question is visible at the start of its answer');
    await desktop.screenshot({ path: path.join(evidence, 'canvas-questions.png') });
    await button(desktop, 'Close questions').click();
    await button(desktop, 'Explore in 3D').click();
    await desktop.locator('.mindmap-background canvas').first().waitFor();
    await desktop.screenshot({ path: path.join(evidence, 'canvas-3d.png') });
    await button(desktop, 'Return to 2D canvas').click();
    await retrieval.waitFor();
    assert.equal(await retrieval.getAttribute('data-id'), canonicalId);
    assert.ok((await retrieval.getAttribute('class')).split(' ').includes('selected'));
    console.log('PASS source inspection, scoped chat and 2D/3D selection round trip');

    await button(desktop, 'Inspect').click();
    await inspector.getByRole('button', { name: 'Pin passage from page 1' }).first().click();
    await inspector.getByRole('button', { name: 'Open exact passage' }).waitFor();
    assert.equal(await inspector.locator('blockquote').textContent(), exactQuote);
    await inspector.getByRole('button', { name: 'Open exact passage' }).click();
    assert.equal(await sourceDialog.locator('blockquote').textContent(), exactQuote);
    await sourceDialog.getByText('Extracted page with highlighted citation').click();
    assert.equal(await sourceDialog.locator('mark').textContent(), exactQuote);
    await button(desktop, 'Close dialog').click();
    await desktop.screenshot({ path: path.join(evidence, 'canvas-evidence.png') });
    await inspector.getByRole('button', { name: 'Remove from board' }).click();
    assert.equal(await desktop.locator('.board-card--evidence').count(), 0);
    console.log('PASS pinning exact evidence, reopening source and removing the pin');

    await button(desktop, 'Engineering').click();
    const workspace = card(desktop, 'Study workspace');
    const sqlite = card(desktop, 'SQLite');
    await workspace.waitFor();
    await desktop.waitForFunction(() => document.querySelectorAll('[data-board="engineering"] .board-edge--repository').length === 14)
      .catch(async error => {
        console.error(await desktop.locator('[data-board="engineering"]').evaluate(board => ({
          nodes: board.querySelectorAll('.react-flow__node').length,
          edges: [...board.querySelectorAll('.board-edge--repository')].map(edge => edge.getAttribute('data-id')),
        })));
        throw error;
      });
    await assertBoardFits(desktop);
    await desktop.evaluate(() => document.fonts.ready);
    await desktop.screenshot({ path: path.join(evidence, 'canvas-engineering.png') });
    assert.equal(await desktop.locator('.technical-illustration[data-illustration="chroma"]').count(), 1);
    await button(desktop, 'Why a passage ranks').click();
    await inspector.getByText('Illustrative 2D coordinates').waitFor();
    const nearby = await inspector.getByRole('status').textContent();
    await button(desktop, 'Distant passage').click();
    assert.notEqual(await inspector.getByRole('status').textContent(), nearby);
    await desktop.screenshot({ path: path.join(evidence, 'canvas-visualization.png') });
    await button(desktop, 'Close inspector').click();
    await button(desktop, 'Present board').click();
    await button(desktop, 'Exit presentation').waitFor();
    assert.equal(await desktop.getByRole('toolbar', { name: 'Canvas tools' }).count(), 0);
    assert.equal(await desktop.getByRole('link', { name: 'React Flow attribution' }).count(), 1);
    await desktop.screenshot({ path: path.join(evidence, 'canvas-presentation.png') });
    const overviewZoom = (await camera(desktop)).zoom;
    const views = desktop.getByRole('group', { name: 'Presentation views' });
    await views.getByRole('button', { name: 'Answer with evidence' }).click();
    assert.ok((await camera(desktop)).zoom > overviewZoom, 'A presentation path frames a single flow');
    await desktop.keyboard.press('Escape');
    await button(desktop, 'Present board').waitFor();
    await button(desktop, 'Pan').click();
    const still = await camera(desktop);
    await drag(desktop, { x: 86, y: 178 }, { x: 160, y: 214 });
    assert.ok((await camera(desktop)).x > still.x + 60, 'Hand tool pans by dragging the background');
    await button(desktop, 'Select').click();
    await button(desktop, 'Fit board').click();
    await button(desktop, 'Connect objects').click();
    await workspace.click();
    await sqlite.click();
    await desktop.getByRole('textbox', { name: 'Relationship label' }).fill('Reads from');
    await desktop.getByRole('textbox', { name: 'Relationship label' }).press('Tab');
    await desktop.locator('.board-relation-label').filter({ hasText: /^Reads from$/ }).waitFor();
    assert.match(await desktop.locator('.board-inspector-endpoints').innerText(), /Study workspace\s+SQLite/);
    await button(desktop, 'Close inspector').click();
    const firstComponent = await workspace.boundingBox();
    const thirdComponent = await card(desktop, 'Draft the answer').boundingBox();
    await drag(desktop, { x: firstComponent.x - 16, y: firstComponent.y - 14 },
      { x: thirdComponent.x + thirdComponent.width + 16, y: thirdComponent.y + thirdComponent.height + 14 });
    assert.equal(await desktop.locator('.react-flow__node.selected').count(), 3, 'Marquee selects the three processing cards');
    await desktop.keyboard.press('Escape');
    await workspace.click();
    await sqlite.click({ modifiers: ['Shift'] });
    await button(desktop, 'Group selection').click();
    await card(desktop, 'New group').waitFor();
    await button(desktop, 'Inspect').click();
    await button(desktop, 'Ungroup').click();
    assert.equal(await card(desktop, 'New group').count(), 0);
    await button(desktop, 'Add object').click();
    await button(desktop, 'Note').click();
    const title = desktop.getByRole('textbox', { name: 'Title' });
    await title.fill('Storage decision');
    await title.press('Tab');
    await desktop.getByLabel('Annotation style').selectOption('callout');
    const note = card(desktop, 'Storage decision');
    await note.waitFor();
    assert.equal(await note.locator('.board-card').getAttribute('data-note-style'), 'callout');
    const position = await note.boundingBox();
    for (const component of await desktop.locator('.react-flow__node').filter({ has: desktop.locator('.board-card--component') }).all()) {
      const box = await component.boundingBox();
      assert.ok(position.x + position.width <= box.x || position.x >= box.x + box.width ||
        position.y + position.height <= box.y || position.y >= box.y + box.height, 'New note leaves components visible');
    }
    await button(desktop, 'Close inspector').click();
    await button(desktop, 'Fit board').click();
    await button(desktop, 'Connect objects').click();
    await note.click();
    await sqlite.click();
    assert.equal(await desktop.getByLabel('Connection style').inputValue(), 'annotation');
    assert.match(await desktop.locator('.board-edge--authored.board-edge--role-annotation .react-flow__edge-path').getAttribute('d'), /C/);
    await button(desktop, 'Close inspector').click();
    await button(desktop, 'Add object').click();
    await button(desktop, 'Illustration').click();
    const picker = inspector.getByRole('combobox', { name: 'Illustration' });
    assert.equal(await picker.locator('option').count(), 16);
    await picker.selectOption('ocr');
    await card(desktop, 'OCR processing').locator('[data-illustration="ocr"]').waitFor();
    await button(desktop, 'Close inspector').click();
    await button(desktop, 'Fit board').click();
    await button(desktop, 'Use light theme').click();
    await desktop.screenshot({ path: path.join(evidence, 'canvas-engineering-light.png') });
    console.log('PASS authored connector and label, marquee, Shift multi-select, grouping and editing');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await mobile.goto(base.href);
    await card(mobile, 'memory-and-learning.md').waitFor();
    await button(mobile, 'Find objects').click();
    const search = mobile.getByRole('textbox', { name: 'Search objects' });
    await search.fill('missing object');
    await mobile.getByText('No matching objects.').waitFor();
    await search.press('Escape');
    assert.equal(await button(mobile, 'Find objects').getAttribute('aria-expanded'), 'false');
    await button(mobile, 'Find objects').click();
    await search.fill('retrieval practice');
    await button(mobile, 'Retrieval practice').click();
    await mobile.getByRole('complementary', { name: 'Object inspector' }).waitFor();
    const dimensions = await mobile.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }));
    assert.equal(dimensions.width, 390);
    assert.equal(dimensions.scroll, 390);
    assert.ok(dimensions.reduced);
    const mobileCard = await card(mobile, 'Retrieval practice').boundingBox();
    const mobileInspector = await mobile.getByRole('complementary', { name: 'Object inspector' }).boundingBox();
    assert.ok(mobileCard.y + mobileCard.height < mobileInspector.y, 'Selected card fits above the narrow inspector');
    await mobile.screenshot({ path: path.join(evidence, 'canvas-mobile.png') });
    await button(mobile, 'Close inspector').click();
    await button(mobile, 'Engineering').click();
    await mobile.getByRole('heading', { name: 'Inside Grasp' }).waitFor();
    await mobile.screenshot({ path: path.join(evidence, 'canvas-engineering-mobile.png') });
    await button(mobile, 'Present board').click();
    await mobile.getByRole('group', { name: 'Presentation views' }).getByRole('button', { name: 'Index a document' }).click();
    const step = mobile.getByRole('group', { name: 'Path steps' }).getByRole('status');
    assert.equal(await step.textContent(), 'Source document');
    await button(mobile, 'Next step').click();
    assert.equal(await step.textContent(), 'Extracted pages');
    await mobile.screenshot({ path: path.join(evidence, 'canvas-presentation-mobile.png') });
    console.log('PASS 390×844 reduced-motion outline, inspector and no horizontal overflow');

    await button(desktop, 'Knowledge').click();
    const upload = {
      name: 'canvas-phase1-verification.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Whiteboard verification\n\nA concept keeps the source passage when it moves on the board.'),
    };
    await desktop.getByLabel('Select files', { exact: true }).setInputFiles(upload);
    const ready = desktop.getByRole('region', { name: 'File uploads' }).getByRole('listitem').filter({ hasText: upload.name });
    await ready.getByText('Ready', { exact: true }).waitFor();
    await card(desktop, upload.name).waitFor();
    let documents = (await (await desktop.request.get(new URL('/api/documents', base).href)).json()).documents;
    const imported = documents.find(document => document.name === upload.name);
    assert.equal(imported?.status, 'done');
    await desktop.getByLabel('Select files', { exact: true }).setInputFiles(upload);
    await ready.getByText('Ready', { exact: true }).waitFor();
    documents = (await (await desktop.request.get(new URL('/api/documents', base).href)).json()).documents;
    assert.deepEqual(documents.filter(document => document.name === upload.name).map(document => document.id), [imported.id]);
    const removed = await desktop.request.delete(new URL(`/api/documents/${imported.id}`, base).href);
    assert.ok(removed.ok(), 'Disposable upload cleanup');
    console.log('PASS real upload, streamed completion, duplicate identity and removal');

    const fallback = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await fallback.route(/react-force-graph-3d/, route => route.abort());
    await fallback.goto(base.href);
    await card(fallback, 'Retrieval practice').waitFor();
    await button(fallback, 'Explore in 3D').click();
    await fallback.getByRole('alert').getByText('3D could not start').waitFor();
    await button(fallback, 'Open 2D canvas').click();
    await card(fallback, 'Retrieval practice').waitFor();
    console.log('PASS a failed 3D load returns to the 2D workspace');
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
