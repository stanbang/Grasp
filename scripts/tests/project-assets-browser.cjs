const assert = require('node:assert/strict');
const { execFile, execFileSync, spawn } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { mkdirSync, mkdtempSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { promisify } = require('node:util');

const root = path.resolve(__dirname, '../..');
const work = path.join(root, 'work', 'goal4-assets-browser');
const { chromium } = require(path.resolve(root,
  process.env.GRASP_PLAYWRIGHT ?? 'work/grasp-v2-phase1/browser-tools/node_modules/playwright-core'));
const chrome = process.env.GRASP_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const python = path.join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const owner = randomUUID();
const agent = randomUUID();
const port = process.env.GRASP_TEST_API_PORT ?? '8074';
assert.match(port, /^\d{4,5}$/);
const base = 'http://127.0.0.1:' + port;

async function stop(server) {
  if (!server || server.exitCode !== null) return;
  const exited = once(server, 'exit');
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/t', '/f', '/pid', String(server.pid)], { stdio: 'ignore' });
  } else {
    server.kill();
  }
  await exited;
}

async function start(directory) {
  const server = spawn(python, ['-m', 'uvicorn', 'app.production:application', '--app-dir', 'apps/api',
    '--host', '127.0.0.1', '--port', port], {
    cwd: root, env: { ...process.env, DATA_DIR: directory, MOCK_LLM: '1', OCR_ENABLED: '0',
      GRASP_AGENT_SOURCE_DOC_IDS: '', ACCESS_TOKEN: owner, GRASP_AGENT_TOKEN: agent },
  });
  let log = '';
  server.stdout.on('data', message => { log += message; });
  server.stderr.on('data', message => { log += message; });
  for (let attempt = 0; attempt < 80 && server.exitCode === null; attempt++) {
    if (await fetch(base + '/api/health', { signal: AbortSignal.timeout(1500) }).then(response => response.ok).catch(() => false)) {
      return server;
    }
    await delay(200);
  }
  await stop(server);
  throw Error('Fixture API did not start. ' + log);
}

async function request(route, options = {}, token = owner) {
  const response = await fetch(base + '/api' + route, {
    ...options, headers: { Authorization: 'Bearer ' + token, ...options.headers },
    signal: AbortSignal.timeout(3000),
  });
  assert.ok(response.ok, `${route} returned ${response.status}. ${response.ok ? '' : await response.text()}`);
  return response;
}

async function post(route, body, token = owner) {
  const result = await request(route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, token);
  return result.json();
}

async function freshCodexRun(command, directory, boardId) {
  const agentPython = path.join(root, process.platform === 'win32' ? '.venv-mcp/Scripts/python.exe' : '.venv-mcp/bin/python');
  const prompt = `Use the grasp MCP tools only for this disposable acceptance board ${boardId}.
Read get_board_context and identify the saved, selected image object by its asset reference.
In one apply_canvas_operations batch, add a single annotation titled "Codex verified the asset record"
and set its relatedObjectIds to the selected image object ID. Use automatic placement.
Read back the same board and report the saved revision. Keep every existing object.
Check metadata only. Do not use the shell, browse, open files or claim to have inspected pixels.`;
  const run = promisify(execFile)(command, [
    'exec', '--ignore-user-config', '--ephemeral', '--sandbox', 'read-only', '--skip-git-repo-check', '--json',
    '-c', 'mcp_servers.grasp.command=' + JSON.stringify(agentPython),
    '-c', 'mcp_servers.grasp.args=["-m","grasp_agent","mcp","serve"]',
    '-c', 'mcp_servers.grasp.env_vars=["GRASP_AGENT_TOKEN","GRASP_API_URL","GRASP_WEB_URL","GRASP_ENV_FILE"]',
    '-c', 'mcp_servers.grasp.enabled_tools=["get_board_context","apply_canvas_operations"]',
    '-c', 'mcp_servers.grasp.tools.apply_canvas_operations.approval_mode="approve"',
    '-c', 'mcp_servers.grasp.required=true', prompt,
  ], {
    cwd: directory, windowsHide: true, timeout: 75_000, maxBuffer: 512 * 1024,
    env: { ...process.env, GRASP_AGENT_TOKEN: agent, GRASP_API_URL: base + '/api', GRASP_WEB_URL: base,
      GRASP_ENV_FILE: path.join(directory, '.env') },
  });
  run.child.stdin.end();
  await run;
}

async function run() {
  mkdirSync(work, { recursive: true });
  const runDirectory = mkdtempSync(path.join(work, 'run-'));
  const fixtures = path.join(runDirectory, 'fixtures');
  const library = path.join(runDirectory, 'library');
  execFileSync(python, ['scripts/project-asset-fixtures.py', fixtures], { cwd: root });
  let server = await start(library);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: chrome, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 },
      permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const { id } = await post('/boards', { title: 'Asset acceptance' });
    const board = '/boards/' + id;
    const read = async token => (await request(board, {}, token)).json();
    const revision = number => page.getByText('Revision ' + number, { exact: true }).waitFor();
    const canvas = page.locator('[data-project-file-drop]');
    const card = name => page.locator('.react-flow__node').filter({ has: page.getByText(name, { exact: true }) });
    const contents = name => readFileSync(path.join(fixtures, name));

    await page.goto(base + '/?board=project&projectBoard=' + id);
    await page.getByLabel('Workspace access token').fill(owner);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await revision(0);

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import files', exact: true }).click();
    const picked = ['wide.png', 'shapes.webp', 'two-pages.pdf', 'notes.md', 'notes.txt', 'corrupt.png', 'unsupported.svg'];
    await (await chooser).setFiles(picked.map(name => path.join(fixtures, name)));
    await revision(1);
    const imported = page.getByRole('region', { name: 'Project imports' });
    await imported.locator('[data-status="failed"]').filter({ hasText: 'corrupt.png' }).waitFor();
    await imported.locator('[data-status="failed"]').filter({ hasText: 'unsupported.svg' }).waitFor();
    for (const name of picked.slice(0, 5)) await card(name).waitFor();
    assert.equal(Object.keys((await read()).objects).length, 5);

    let uploads = 0;
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().includes('/assets?collectionId=')) uploads++;
    });
    let injected = false;
    await page.route('**' + board + '/ops', async route => {
      if (!injected && route.request().postDataJSON().operations.some(
        operation => operation.type === 'addObject' && operation.object.title === 'portrait.jpg',
      )) {
        injected = true;
        await post(board + '/ops', { baseRevision: 1, mutationId: 'concurrent-edit', operations: [{
          type: 'addObject', object: { id: 'agent-edit', kind: 'annotation', title: 'Concurrent agent edit',
            placement: { x: 320, y: 150, width: 210, height: 112 } },
        }] }, agent);
      }
      await route.continue();
    });
    await canvas.evaluate((element, bytes) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([Uint8Array.from(bytes)], 'portrait.jpg', { type: 'image/jpeg' }));
      const box = element.getBoundingClientRect();
      for (const type of ['dragover', 'drop']) {
        element.dispatchEvent(new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true,
          clientX: box.left + 240, clientY: box.top + 180 }));
      }
    }, [...contents('portrait.jpg')]);
    await page.getByText('Board changed to revision 2. Your draft is kept.').waitFor();
    const placedDraft = await page.evaluate(() => {
      const key = Object.keys(sessionStorage).find(name => name.startsWith('grasp-project-draft:'));
      return JSON.parse(sessionStorage.getItem(key)).batches[0].operations[0].object.asset.assetId;
    });
    await page.getByRole('button', { name: 'Retry asset placements' }).click();
    await revision(3);
    assert.equal(uploads, 1, 'Only one upload was needed when placement retried');
    const afterRetry = await read();
    assert.equal(Object.values(afterRetry.objects).find(item => item.title === 'portrait.jpg').asset.assetId, placedDraft);
    assert.ok(afterRetry.objects['agent-edit']);

    await page.evaluate(async bytes => {
      const image = new Blob([Uint8Array.from(bytes)], { type: 'image/png' });
      window.copiedAssetDigest = new Promise(resolve => {
        document.addEventListener('paste', async event => {
          const copied = event.clipboardData.files[0];
          if (!copied) { resolve(null); return; }
          const hash = await crypto.subtle.digest('SHA-256', await copied.arrayBuffer());
          resolve(Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join(''));
        }, { once: true });
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
    }, [...contents('wide.png')]);
    await canvas.focus();
    await page.keyboard.press('Control+v');
    await revision(4);
    assert.equal(uploads, 2);
    const withPaste = await read();
    const pngObjects = Object.values(withPaste.objects).filter(item => item.kind === 'image' && item.title.endsWith('.png'));
    assert.equal(pngObjects.length, 2);
    const [pasted] = pngObjects.filter(item => !(item.id in afterRetry.objects));
    const clipboardDigest = await page.evaluate(() => window.copiedAssetDigest);
    assert.equal(clipboardDigest?.length, 64, 'The paste event supplied image bytes');

    await page.getByRole('button', { name: 'Fit board', exact: true }).click();
    for (const name of ['wide.png', 'shapes.webp', 'portrait.jpg']) {
      const image = card(name).locator('img');
      await image.waitFor();
      await page.waitForFunction(alt =>
        [...document.images].some(image => image.alt === alt && image.complete && image.naturalWidth > 0), name);
    }
    const pngCard = pngObjects.find(item => item.title === 'wide.png');
    const pngPath = board + '/assets/' + pngCard.asset.assetId;
    assert.equal((await fetch(base + '/api' + pngPath + '/preview', {
      headers: { Authorization: 'Bearer ' + agent },
    })).status, 404);
    await card('wide.png').dblclick();
    const share = page.getByRole('checkbox', { name: 'Share this asset with the agent on this board' });
    async function setShare(shared) {
      const saved = page.waitForResponse(response => response.url().endsWith(pngPath + '/sharing'));
      await share.click();
      assert.equal((await (await saved).json()).shared, shared);
      await page.waitForFunction(expected => document.querySelector('.board-asset-sharing input')?.checked === expected, shared);
    }
    await setShare(true);
    assert.equal((await read(agent)).objects[pngCard.id].title, 'wide.png');
    await setShare(false);
    assert.equal((await read(agent)).objects[pngCard.id].title, 'Private source');
    await page.getByRole('button', { name: 'Close inspector' }).click();
    await page.getByRole('button', { name: 'Fit board', exact: true }).click();

    await card('two-pages.pdf').dblclick();
    await page.getByLabel('PDF page').selectOption('2');
    await revision(5);
    const pdf = page.getByRole('link', { name: 'Open PDF page' });
    const pdfLink = await pdf.getAttribute('href');
    assert.match(pdfLink, /\/original#page=2$/);
    const response = await context.request.get(base + pdfLink);
    assert.equal(response.headers()['content-type'], 'application/pdf');
    assert.equal(createHash('sha256').update(await response.body()).digest('hex'),
      createHash('sha256').update(contents('two-pages.pdf')).digest('hex'));
    const seen = context.waitForEvent('page');
    await pdf.click();
    const pdfTab = await seen;
    await pdfTab.waitForURL(url => url.hash === '#page=2');
    await pdfTab.close();

    const beforeRestart = await read();
    await stop(server);
    server = await start(library);
    await page.reload();
    await revision(5);
    assert.deepEqual(await read(), beforeRestart);
    const pastedRoute = board + '/assets/' + pasted.asset.assetId;
    const pasteAsset = await (await request(pastedRoute)).json();
    assert.deepEqual([pasteAsset.width, pasteAsset.height], [420, 230]);
    assert.equal(pasteAsset.digest, clipboardDigest);
    const pastedOriginal = await (await request(pastedRoute + '/original')).arrayBuffer();
    assert.equal(createHash('sha256').update(Buffer.from(pastedOriginal)).digest('hex'), clipboardDigest);
    for (const name of ['wide.png', 'shapes.webp', 'portrait.jpg', 'notes.md', 'notes.txt', 'two-pages.pdf']) {
      const item = Object.values(beforeRestart.objects).find(item => item.title === name);
      const assetRoute = board + '/assets/' + item.asset.assetId;
      const asset = await (await request(assetRoute)).json();
      const original = await (await request(assetRoute + '/original')).arrayBuffer();
      const digest = createHash('sha256').update(contents(name)).digest('hex');
      assert.equal(createHash('sha256').update(Buffer.from(original)).digest('hex'), digest);
      assert.equal(asset.digest, digest);
    }
    assert.equal(Object.values(beforeRestart.objects).find(item => item.title === 'two-pages.pdf').asset.page, 2);
    console.log('PASS picker, multi-file errors, drop, Ctrl+V, decoded previews, grant and revoke, PDF page 2 and restart');
    console.log('PASS stale placement reused the asset ID and preserved the intervening agent edit');

    if (process.env.GRASP_CODEX_ACCEPTANCE) {
      await card('wide.png').dblclick();
      await setShare(true);
      const contextRoute = '/boards/context?boardId=' + id;
      for (let attempt = 0; ; attempt++) {
        const current = await (await request(contextRoute, {}, agent)).json();
        if (current.selection?.objectIds.includes(pngCard.id)) break;
        assert.ok(attempt < 20, 'The browser did not publish the image selection');
        await delay(150);
      }
      await freshCodexRun(process.env.GRASP_CODEX_ACCEPTANCE, runDirectory, id);
      await revision(6);
      await card('Codex verified the asset record').waitFor({ state: 'attached' });
      const updated = await read();
      const note = Object.values(updated.objects).find(item => item.title === 'Codex verified the asset record');
      assert.equal(note.createdBy, 'agent');
      assert.deepEqual(note.relatedObjectIds, [pngCard.id]);
      console.log('PASS fresh Codex CLI read the permitted image metadata over stdio and its note appeared in the same browser tab');
    }
  } finally {
    await browser?.close();
    await stop(server);
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
