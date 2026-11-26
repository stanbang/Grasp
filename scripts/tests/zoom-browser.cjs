const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtempSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { chromium } = require(path.resolve(__dirname, '../../', process.env.GRASP_PLAYWRIGHT ?? 'work/grasp-v2-phase1/browser-tools/node_modules/playwright-core'));

const root = path.resolve(__dirname, '../..');
const evidence = path.join(root, 'work', 'pre-goal4');
mkdirSync(evidence, { recursive: true });
const directory = mkdtempSync(path.join(evidence, 'library-'));
const port = process.env.GRASP_TEST_API_PORT ?? '8072';
assert.match(port, /^\d{4,5}$/);
const base = 'http://127.0.0.1:' + port;
const owner = 'disposable-owner-' + require('node:crypto').randomUUID();
const server = spawn(path.join(root, '.venv/Scripts/python.exe'), [
  '-m', 'uvicorn', 'app.production:application', '--app-dir', 'apps/api', '--host', '127.0.0.1', '--port', port,
], { env: { ...process.env, DATA_DIR: directory, MOCK_LLM: '1', ACCESS_TOKEN: owner, GRASP_AGENT_TOKEN: '' }, stdio: 'ignore' });

async function post(route, body) {
  const response = await fetch(base + '/api' + route, { method: 'POST',
    headers: { Authorization: 'Bearer ' + owner, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw Error(route + ': ' + response.status);
  return response.json();
}

async function checkDenseBoard(page) {
  const { id } = await post('/boards', { title: 'Dense project fixture' });
  const objectCount = 160;
  const cards = Array.from({ length: objectCount }, (_, index) => ({ type: 'addObject', object: {
    id: 'part-' + index, kind: 'explanation', title: 'Component ' + index,
    description: 'Collects and validates the input before sending it to the next stage.',
    placement: { x: index % 20 * 280, y: Math.floor(index / 20) * 182, width: 200, height: 104 },
  } }));
  await post('/boards/' + id + '/ops', { baseRevision: 0, mutationId: 'dense-cards', operations: cards });
  const connections = cards.flatMap((_, index) => [1, 20].flatMap(step =>
    index + step < objectCount && (step !== 1 || index % 20 !== 19) ? [{ type: 'addConnection', connection: {
      id: 'path-' + index + '-' + step, source: 'part-' + index, target: 'part-' + (index + step),
      label: step === 1 ? 'Forwards checked data' : 'Aggregates output', role: 'process',
    } }] : []));
  await post('/boards/' + id + '/ops', { baseRevision: 1, mutationId: 'dense-links', operations: connections.slice(0, 240) });
  await page.goto(base + '/?board=project&projectBoard=' + id);
  await page.getByText('Revision 2', { exact: true }).waitFor();
  assert.equal(await page.locator('.react-flow__node').count(), objectCount);
  await page.getByRole('button', { name: 'Fit board', exact: true }).click();
  const sample = page.evaluate(() => new Promise(resolve => {
    const gaps = [];
    const start = performance.now();
    let last = start;
    function frame(time) {
      gaps.push(time - last);
      last = time;
      if (time - start < 1000) requestAnimationFrame(frame);
      else resolve(gaps.sort((a,b) => a-b)[Math.floor(gaps.length * .95)]);
    }
    requestAnimationFrame(frame);
  }));
  await page.mouse.move(720, 550);
  await page.keyboard.down('Control');
  for (let index = 0; index < 3; index++) {
    await page.mouse.wheel(0, -160);
    await page.mouse.wheel(0, 160);
  }
  await page.keyboard.up('Control');
  const p95 = await sample;
  await page.getByText('Revision 2', { exact: true }).waitFor();
  console.log('Dense canvas: ' + objectCount + ' cards, 240 connections, p95 frame interval ' + p95.toFixed(1) + ' ms');
  assert.ok(p95 < 100, 'The dense canvas remained responsive during the interaction');
}

async function run() {
  for (let attempt = 0; ; attempt++) {
    if (await fetch(base + '/api/health').then(r => r.ok).catch(() => false)) break;
    if (attempt === 60) throw Error('fixture unavailable');
    await delay(200);
  }
  const { id } = await post('/boards', { title: 'Wallet Intelligence Dashboard' });
  const sections = [
    ['collection', 'Activity collection', 0, 0, ['Wallet event collector', 'Token balance index', 'Transaction import']],
    ['analysis', 'Signals and risk', 565, 0, ['Wallet profile service', 'Risk scoring pipeline', 'Exposure classifier']],
    ['product', 'Dashboard and delivery', 0, 490, ['Dashboard API', 'Portfolio dashboard', 'Alert subscriptions']],
    ['review', 'Review and recovery', 565, 490, ['Signal review queue', 'Human review', 'Activity audit trail']],
  ];
  const operations = [];
  for (const [key, title, x, y, members] of sections) {
    operations.push({type:'addObject', object:{id:key,kind:'group',title,placement:{x,y,width:520,height:415}}});
    members.forEach((name, index) => operations.push({type:'addObject',object:{
      id:key+'-'+index,kind:'explanation',title:name,
      description:index===0 ? 'Reads wallet activity and collects the records needed to build a consistent view.\nAuditable events preserve a record of where each decision came from.\nReview incomplete events before making them visible on the dashboard.\nSave an explanation of which sources were missing.' : 'Maintains the current state and sends a clear result to the next component.',
      placement:{x:x+22+index%2*244,y:y+55+Math.floor(index/2)*175,width:220,height:146,groupId:key},
    }}));
  }
  for (const [index, [source,target,label]] of [
    ['collection-0','collection-1','Indexes token balances'],
    ['collection-1','analysis-0','Streams indexed wallet activity'],
    ['collection-2','analysis-1','Replays imported transactions'],
    ['analysis-0','analysis-2','Evaluates wallet exposure'],
    ['analysis-2','product-0','Serves risk and exposure'],
    ['product-0','product-1','Displays current portfolio'],
    ['product-1','product-2','Subscribes to changes'],
    ['analysis-1','review-0','Escalates unverified signals'],
    ['review-0','review-1','Requests review'],
    ['review-1','review-2','Records review outcome'],
  ].entries()) operations.push({type:'addConnection',connection:{id:'flow-'+index,source,target,label,role:'process'}});
  await post('/boards/'+id+'/ops',{baseRevision:0,mutationId:'fixture',operations});
  const profile = path.join(directory, 'browser');
  const launch = () => chromium.launchPersistentContext(profile, {
    executablePath: process.env.GRASP_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce',
  });
  let browser = await launch();
  try {
    let page = browser.pages()[0];
    const url = base+'/?board=project&projectBoard='+id;
    await page.goto(url);
    const gate = page.getByLabel('Workspace access token');
    await gate.fill(owner);
    await page.getByRole('button',{name:'Unlock',exact:true}).click();
    await page.getByText('Revision 1',{exact:true}).waitFor();
    const [session] = (await browser.cookies(base + '/api/boards')).filter(cookie => cookie.name.startsWith('grasp-owner-'));
    assert.ok(session?.httpOnly && session.sameSite === 'Strict' && session.value !== owner);
    await page.reload();
    await page.getByText('Revision 1', { exact: true }).waitFor();
    assert.equal(await gate.isVisible(), false);
    const secondTab = await browser.newPage();
    await secondTab.goto(url);
    await secondTab.getByText('Revision 1', { exact: true }).waitFor();
    await secondTab.close();
    await browser.close();
    browser = await launch();
    page = browser.pages()[0];
    await page.goto(url);
    await page.getByText('Revision 1', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Workspace access token').isVisible(), false);
    console.log('PASS owner session survives reload, another tab and a browser process restart');
    const frame = await page.locator('.board-frame').boundingBox();
    await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2);
    const zoom = async (name, value) => {
      const previous = await page.locator('.board-zoom [aria-label="Zoom level"]').textContent();
      const delta = Math.log(parseInt(previous)/100/value)/.002;
      if (Math.abs(delta) >= 30) {
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, delta);
        await page.keyboard.up('Control');
      }
      await page.waitForFunction(expected => Math.abs(parseInt(document.querySelector('.board-zoom [aria-label="Zoom level"]').textContent)/100-expected)<.015, value);
      await page.screenshot({path:path.join(evidence, 'after-' + name + '.png')});
      const data = await page.evaluate(() => {
        const title = document.querySelector('[data-id="collection-0"] .board-object-title');
        const body = document.querySelector('[data-id="collection-0"] p');
        const viewport = document.querySelector('.react-flow__viewport');
        const scale = new DOMMatrix(getComputedStyle(viewport).transform).a;
        const box = item => item.getBoundingClientRect();
        const labels = [...document.querySelectorAll('.board-relation-label')].map(box);
        const cards = [...document.querySelectorAll('.react-flow__node')].filter(item => !item.querySelector('.board-card--group')).map(box);
        const overlaps = (a,b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        return {zoom:scale, titles: [...document.querySelectorAll('.board-object-title')].filter(item => getComputedStyle(item).visibility === 'visible').length,
          labels: labels.length,
          labelsOverlap: labels.some((label, index) => [...cards, ...labels.slice(0, index)].some(other => overlaps(label, other))),
          titlePixels:parseFloat(getComputedStyle(title).fontSize)*scale,
          bodyClamp:body ? getComputedStyle(body).webkitLineClamp : null,
          bodyClips:body ? body.clientHeight < body.scrollHeight : null, detail: title.closest('.board-card').dataset.viewDetail};
      });
      console.log(name, data);
      return data;
    };
    const normal = await zoom('normal', 1);
    const medium = await zoom('medium', .55);
    const minZoom = Number(await page.locator('.board-frame').getAttribute('data-minimum-zoom'));
    const overview = await zoom('overview', minZoom);
    assert.equal(normal.bodyClamp, 'none');
    assert.equal(normal.bodyClips, false);
    assert.ok(normal.labels > 0 && medium.labels > 0 && overview.labels > 0);
    assert.ok(!normal.labelsOverlap && !medium.labelsOverlap && !overview.labelsOverlap);
    assert.ok(medium.titlePixels >= 9.5 && overview.titles >= 4);
    assert.equal(overview.detail, 'overview');
    const outline = page.getByRole('button', { name: 'Find objects', exact: true });
    await outline.click();
    const search = page.getByRole('textbox', { name: 'Search objects' });
    await search.fill('Wallet event collector');
    await page.getByRole('button', { name: 'Wallet event collector', exact: true }).click();
    const inspector = page.getByRole('complementary', { name: 'Object inspector' });
    await inspector.getByRole('heading', { name: 'Wallet event collector' }).waitFor();
    assert.match(await inspector.getByRole('textbox', { name: 'Text' }).inputValue(), /which sources were missing/);
    await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
    await outline.click();
    await search.fill('Indexes token balances');
    await page.getByRole('button', { name: /Indexes token balances/ }).click();
    assert.equal(await inspector.getByLabel('Relationship label').inputValue(), 'Indexes token balances');
    await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
    await page.getByText('Revision 1', { exact: true }).waitFor();
    console.log('PASS both object and connection details are recoverable from the overview without changing the revision');

    await checkDenseBoard(page);
    await page.getByRole('button', { name: 'Workspace options' }).click();
    await page.getByRole('button', { name: 'Sign out of this browser', exact: true }).click();
    await page.getByLabel('Workspace access token').waitFor();
    await page.reload();
    await page.getByLabel('Workspace access token').waitFor();
    console.log('PASS explicit logout survives a reload');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode=1; }).finally(async () => {
  if (server.exitCode === null) { const stopped=once(server,'exit');server.kill();await stopped; }
});
