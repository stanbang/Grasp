import { fixture } from './fixture.js';
import { sceneFor } from './boards.js';

const icons = {
  grasp: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  present: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 8 5 3-5 3zM9 21h6m-3-4v4"/>',
  select: '<path d="m5 3 13 10-6 1-2 6L5 3Z"/>',
  hand: '<path d="M7 12V8a1.5 1.5 0 0 1 3 0v3-5a1.5 1.5 0 0 1 3 0v5-3a1.5 1.5 0 0 1 3 0v4-2a1.5 1.5 0 0 1 3 0v5c0 4-2 6-6 6-3 0-5-2-6-4l-2-3a1.5 1.5 0 0 1 2-2Z"/>',
  text: '<path d="M4 7V4h16v3M12 4v16m-4 0h8"/>',
  note: '<path d="M5 3h14a2 2 0 0 1 2 2v10l-6 6H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm10 18v-6h6"/>',
  undo: '<path d="m9 6-5 5 5 5M4 11h9a5 5 0 0 1 5 5v2"/>',
  redo: '<path d="m15 6 5 5-5 5m5-5h-9a5 5 0 0 0-5 5v2"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14m-7-7v14"/>',
  fit: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  file: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); });

const byId = id => document.getElementById(id);
const desk = byId('desk');
const surface = byId('surface');
const world = byId('world');
const objectLayer = byId('objects');
const edgeLayer = byId('edges');
const inspector = byId('inspector');
const outline = byId('outline');
const menu = byId('board-menu');
const marquee = byId('marquee');
const selectionTools = byId('selection-tools');
const params = new URLSearchParams(location.search);
const direction = ['a', 'b', 'c'].includes(params.get('direction')) ? params.get('direction') : 'a';
let board = params.get('board') === 'knowledge' ? 'knowledge' : 'engineering';
let tool = 'select';
let presenting = false;
let space = false;
let returnFocus;
let gesture;
let suppressedClickUntil = 0;
const selected = new Set();
let selectedLink;
const sessions = new Map();
let camera;
let scene;
let objectById;

const html = value => String(value ?? '').replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
const clamp = (number, low, high) => Math.min(high, Math.max(low, number));
const geometry = object => `left:${object.x}px;top:${object.y}px;width:${object.width}px;height:${object.height}px`;
const moveObject = (object, element) => { element.style.left = `${object.x}px`; element.style.top = `${object.y}px`; };
const isInteractive = target => target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]');

function viewSession(value) {
  if (!sessions.has(value)) {
    sessions.set(value, { data: sceneFor(direction, value), camera: null, undo: [], redo: [] });
  }
  return sessions.get(value);
}

function syncCamera() {
  world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
  byId('zoom-level').value = `${Math.round(camera.zoom * 100)}%`;
  desk.dataset.detail = String(camera.zoom >= 1.25);
  surface.style.setProperty('--grid-size', `${Math.max(14, 25 * camera.zoom)}px`);
  surface.style.setProperty('--grid-x', `${camera.x}px`);
  surface.style.setProperty('--grid-y', `${camera.y}px`);
  selectionPosition();
}

function zoomBy(amount, x = surface.clientWidth / 2, y = surface.clientHeight / 2) {
  const zoom = clamp(camera.zoom * amount, .2, 2.8);
  const ratio = zoom / camera.zoom;
  camera.x = x - (x - camera.x) * ratio;
  camera.y = y - (y - camera.y) * ratio;
  camera.zoom = zoom;
  syncCamera();
}

function fit(objects = []) {
  const width = surface.clientWidth;
  const height = surface.clientHeight;
  const left = objects.length ? Math.min(...objects.map(object => object.x)) : 0;
  const top = objects.length ? Math.min(...objects.map(object => object.y)) : 0;
  const right = objects.length ? Math.max(...objects.map(object => object.x + object.width)) : 1190;
  const bottom = objects.length ? Math.max(...objects.map(object => object.y + object.height)) : 678;
  const narrow = width < 620;
  const usableWidth = !inspector.hidden && !narrow ? Math.max(width - inspector.offsetWidth - 45, 300) : width;
  const usableHeight = !inspector.hidden && narrow ? Math.max(inspector.offsetTop, 150) : height;
  const marginX = narrow ? 20 : 95;
  const marginY = narrow ? 80 : 105;
  const zoom = clamp(Math.min((usableWidth - marginX * 2) / Math.max(right - left, 1),
    (usableHeight - marginY * 2) / Math.max(bottom - top, 1)), .2, objects.length ? 1.55 : 1.15);
  camera.zoom = zoom;
  camera.x = (usableWidth - (right + left) * zoom) / 2;
  camera.y = (usableHeight - (bottom + top) * zoom) / 2;
  viewSession(board).camera = camera;
  syncCamera();
}

function worldPoint(x, y) {
  return { x: (x - camera.x) / camera.zoom, y: (y - camera.y) / camera.zoom };
}

function port(object, side) {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  switch (side) {
    case 'l': return { x: object.x - 5, y: cy, nx: -1, ny: 0 };
    case 'r': return { x: object.x + object.width + 5, y: cy, nx: 1, ny: 0 };
    case 't': return { x: cx, y: object.y - 5, nx: 0, ny: -1 };
    default: return { x: cx, y: object.y + object.height + 5, nx: 0, ny: 1 };
  }
}

function connection(relation) {
  const from = objectById.get(relation.source);
  const to = objectById.get(relation.target);
  if (!from || !to) return null;
  const dx = to.x + to.width / 2 - from.x - from.width / 2;
  const dy = to.y + to.height / 2 - from.y - from.height / 2;
  const [outputSide, inputSide, fraction = .5, corridor] = relation.route ??
    (Math.abs(dx) > Math.abs(dy) * .87 ? (dx > 0 ? ['r', 'l'] : ['l', 'r']) : (dy > 0 ? ['b', 't'] : ['t', 'b']));
  const start = port(from, outputSide);
  const end = port(to, inputSide);
  const x = (start.x + end.x) / 2;
  const y = (start.y + end.y) / 2;
  if (corridor) {
    const [laneX, laneY] = corridor;
    return { d: `M${start.x},${start.y} H${laneX} V${laneY} H${end.x} V${end.y}`,
      x: (laneX + end.x) / 2, y: laneY - 8 };
  }
  if (relation.kind === 'adjacency' && direction !== 'b') {
    const gap = Math.hypot(end.x - start.x, end.y - start.y);
    const distance = Math.min(gap * .43, 105);
    return {
      d: `M${start.x},${start.y} C${start.x + start.nx * distance},${start.y + start.ny * distance} ${end.x + end.nx * distance},${end.y + end.ny * distance} ${end.x},${end.y}`,
      x, y: y - 9,
    };
  }
  if (outputSide === inputSide) {
    if (start.nx) {
      const lane = start.nx > 0 ? Math.max(start.x, end.x) + 34 : Math.min(start.x, end.x) - 34;
      return { d: `M${start.x},${start.y} H${lane} V${end.y} H${end.x}`, x: lane + 6, y: y - 7 };
    }
    const lane = start.ny > 0 ? Math.max(start.y, end.y) + 21 : Math.min(start.y, end.y) - 21;
    return { d: `M${start.x},${start.y} V${lane} H${end.x} V${end.y}`, x, y: lane - 7 };
  }
  if (start.nx && end.nx) {
    const lane = start.x + (end.x - start.x) * fraction;
    if (Math.abs(start.y - end.y) < 8) return { d: `M${start.x},${start.y} L${end.x},${end.y}`, x, y: y - 9 };
    return { d: `M${start.x},${start.y} H${lane} V${end.y} H${end.x}`, x: lane, y: y - 8 };
  }
  if (start.ny && end.ny) {
    const lane = start.y + (end.y - start.y) * fraction;
    return { d: `M${start.x},${start.y} V${lane} H${end.x} V${end.y}`, x, y: lane - 8 };
  }
  return start.nx
    ? { d: `M${start.x},${start.y} H${end.x} V${end.y}`, x, y: start.y - 10 }
    : { d: `M${start.x},${start.y} V${end.y} H${end.x}`, x, y: end.y - 10 };
}

function edgeMarkup(relation) {
  const route = connection(relation);
  if (!route) return '';
  const active = selectedLink === relation.id || selected.has(relation.source) || selected.has(relation.target);
  if (direction === 'c' && board === 'knowledge' && relation.kind === 'dependency' && !active) return '';
  const label = relation.kind === 'flow' || active;
  const description = `${objectById.get(relation.source).title} · ${relation.title} · ${objectById.get(relation.target).title}`;
  return `<g class="edge edge--${relation.kind}" data-link="${html(relation.id)}" data-active="${active}" aria-label="${html(description)}">
    <title>${html(description)}</title>
    <path class="edge-line" d="${route.d}"/>
    <path class="edge-hit" d="${route.d}"/>
    ${label ? `<text class="edge-label" x="${route.x}" y="${route.y}" text-anchor="middle">${html(relation.title)}</text>` : ''}
  </g>`;
}

function drawEdges() {
  edgeLayer.innerHTML = `<defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path class="arrow-tip" d="M1 1 9 5 1 9z"/></marker>
    <marker id="weak-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path class="weak-arrow-tip" d="M1 1 9 5 1 9z"/></marker>
  </defs>${scene.links.map(edgeMarkup).join('')}`;
}

function overview(object) {
  if (object.id === 'upload') return 'PDF, Markdown, TXT';
  if (object.id === 'index') return 'Chunk embeddings';
  if (object.id === 'store') return 'Pages, chunks, graph';
  if (object.id === 'rank') return 'Resolve matching chunks to source text.';
  if (object.id === 'question' && board === 'engineering') return 'Choose the sources.';
  if (object.id === 'recall') return 'Recall an idea before checking the answer.';
  if (object.kind === 'concept' && object.summary === object.title) return '';
  return object.summary;
}

function drawObjects() {
  objectById = new Map(scene.objects.map(object => [object.id, object]));
  objectLayer.innerHTML = scene.objects.map(object => `<button type="button" class="object object--${object.kind}" data-id="${html(object.id)}"
    aria-label="${html(object.title)}" aria-pressed="${selected.has(object.id)}" style="${geometry(object)}">
    ${object.kind === 'document' ? `<span class="object-icon" data-icon="file" aria-hidden="true">${icon('file')}</span>` : ''}
    <strong class="object-title">${html(object.title)}</strong>
    ${overview(object) ? `<span class="object-text">${html(overview(object))}</span>` : ''}
  </button>`).join('');
  syncSelection();
}

function selectionPosition() {
  if (!selected.size || !inspector.hidden || presenting || gesture?.moving) {
    selectionTools.hidden = true;
    return;
  }
  const primary = objectById?.get([...selected][0]);
  if (!primary) return;
  const x = primary.x * camera.zoom + camera.x;
  const y = primary.y * camera.zoom + camera.y;
  if (x > surface.clientWidth || x + primary.width * camera.zoom < 0 ||
      y > surface.clientHeight || y + primary.height * camera.zoom < 0) {
    selectionTools.hidden = true;
    return;
  }
  selectionTools.hidden = false;
  const above = y - 55;
  selectionTools.style.left = `${clamp(x, 10, surface.clientWidth - selectionTools.offsetWidth - 10)}px`;
  selectionTools.style.top = `${clamp(above > 66 ? above : y + primary.height * camera.zoom + 9, 66, surface.clientHeight - 65)}px`;
  byId('inspect-selection').hidden = selected.size !== 1;
}

function syncSelection() {
  objectLayer.querySelectorAll('.object').forEach(node => node.setAttribute('aria-pressed', String(selected.has(node.dataset.id))));
  drawEdges();
  selectionPosition();
  byId('undo').disabled = !viewSession(board).undo.length;
  byId('redo').disabled = !viewSession(board).redo.length;
}

function setBoard(value) {
  board = value;
  desk.dataset.board = value;
  const session = viewSession(value);
  scene = session.data;
  camera = session.camera ?? { x: 0, y: 0, zoom: 1 };
  selected.clear();
  selectedLink = undefined;
  closeInspector(false);
  outline.hidden = true;
  setMenu(false);
  byId('board-name').textContent = value === 'engineering' ? 'Engineering' : 'Knowledge';
  document.querySelectorAll('[data-board]').forEach(button => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-current', String(button.dataset.board === value));
  });
  document.querySelectorAll('[data-direction]').forEach(anchor => {
    if (anchor.tagName === 'A') {
      anchor.href = `?direction=${anchor.dataset.direction}&board=${value}`;
      if (anchor.dataset.direction === direction) anchor.setAttribute('aria-current', 'page');
    }
  });
  const url = new URL(location.href);
  url.searchParams.set('direction', direction);
  url.searchParams.set('board', value);
  history.replaceState(null, '', url);
  byId('regions').innerHTML = `<div class="board-title"><h1>${html(scene.title)}</h1><p>${html(scene.caption)}</p></div>${
    scene.regions.map(([title, x, y, width, height]) =>
      `<section class="region" style="${geometry({ x, y, width, height })}"><h2>${html(title)}</h2></section>`).join('')
  }`;
  drawObjects();
  if (session.camera) syncCamera();
  else fit();
}

function setMenu(open) {
  menu.hidden = !open;
  byId('board-menu-toggle').setAttribute('aria-expanded', String(open));
}

function setTool(value) {
  tool = value;
  surface.dataset.tool = value;
  document.querySelectorAll('[data-tool]').forEach(button => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
  });
}

function renderOutline() {
  const query = byId('find').value.toLowerCase().trim();
  const entries = scene.objects.filter(object => object.title.toLowerCase().includes(query));
  byId('outline-list').innerHTML = entries.length
    ? entries.map(object => `<li><button type="button" data-find-id="${html(object.id)}">${html(object.title)}</button></li>`).join('')
    : '<li>No matching objects.</li>';
}

function showInspector(title, markup) {
  if (inspector.hidden) returnFocus = document.activeElement;
  byId('inspect-title').textContent = title;
  byId('inspect-content').innerHTML = markup;
  inspector.hidden = false;
  byId('close-inspector').focus({ preventScroll: true });
  selectionPosition();
}

function closeInspector(restore = true) {
  if (inspector.hidden) return;
  inspector.hidden = true;
  if (restore) {
    const fallback = objectLayer.querySelector(`[data-id="${CSS.escape([...selected][0] ?? '')}"]`) ?? surface;
    const target = returnFocus?.isConnected && returnFocus.getClientRects().length ? returnFocus : fallback;
    target.focus({ preventScroll: true });
  }
  selectionPosition();
}

function sourcePage(document, mark = false) {
  const text = document.page;
  const index = mark ? text.indexOf(fixture.quote) : -1;
  const excerpt = index < 0 ? html(text) :
    `${html(text.slice(0, index))}<mark>${html(fixture.quote)}</mark>${html(text.slice(index + fixture.quote.length))}`;
  showInspector(document.name, `<p class="meta">Extracted page 1</p><div class="source-page">${excerpt}</div>`);
  if (mark) inspector.querySelector('mark')?.scrollIntoView({ block: 'center' });
}

function exactEvidence() {
  showInspector('Exact source passage', `<p class="meta">memory-and-learning.md · page ${fixture.page}</p>
    <blockquote>${html(fixture.quote)}</blockquote><button type="button" class="source-action" data-inspect="page">Read in context</button>`);
}

function inspectObject(object) {
  if (!object) return;
  if (object.kind === 'evidence') return exactEvidence();
  if (object.kind === 'document') return sourcePage(fixture.documents.find(document => document.id === object.docId));
  if (object.id === 'question' && board === 'knowledge') {
    showInspector(object.title, `<p class="meta">Recorded answer · memory-and-learning.md</p>
      <p>${html(fixture.answer)}</p><button type="button" class="source-action" data-inspect="passage">Source 1 · page ${fixture.page}</button>`);
    return;
  }
  if (object.editable) {
    showInspector(object.title, `<form id="edit-object" data-edit-id="${html(object.id)}">
      <label>Title<input name="title" maxlength="80" value="${html(object.title)}" required></label>
      <label>Text<textarea name="summary" maxlength="400" rows="4">${html(object.summary)}</textarea></label>
      <button type="submit" class="source-action">Save</button>
    </form>`);
    byId('edit-object').elements.title.focus({ preventScroll: true });
    byId('edit-object').elements.title.select();
    return;
  }
  const docs = fixture.documents.filter(document => object.docIds?.includes(document.id));
  showInspector(object.title, `
    ${object.summary ? `<p>${html(object.summary)}</p>` : ''}
    ${object.url ? `<a href="${html(object.url)}" target="_blank" rel="noreferrer">View implementation ↗</a>` : ''}
    ${object.id === 'recall' ? '<button type="button" class="source-action" data-inspect="passage">Open exact passage</button><button type="button" class="source-action" data-inspect="answer">See recorded answer</button>' : ''}
    ${docs.map(document => `<button type="button" class="source-action" data-open-doc="${html(document.id)}">${html(document.name)}</button>`).join('')}
  `);
}

function inspectLink(relation) {
  selected.clear();
  selectedLink = relation.id;
  const from = objectById.get(relation.source);
  const to = objectById.get(relation.target);
  showInspector(relation.title, `<p>${html(from.title)} → ${html(to.title)}</p>${
    relation.kind === 'adjacency' ? '<p class="meta">Source adjacency from the demo graph.</p>' : ''}`);
  syncSelection();
}

function selectObject(id, extend = false) {
  selectedLink = undefined;
  if (!extend) selected.clear();
  if (extend && selected.has(id)) selected.delete(id);
  else selected.add(id);
  syncSelection();
}

function remember(before = structuredClone(scene.objects)) {
  const session = viewSession(board);
  session.undo.push(before);
  if (session.undo.length > 30) session.undo.shift();
  session.redo = [];
}

function restore(direction) {
  const session = viewSession(board);
  const next = session[direction].pop();
  if (!next) return;
  session[direction === 'undo' ? 'redo' : 'undo'].push(structuredClone(scene.objects));
  scene.objects = next;
  selected.clear();
  closeInspector(false);
  drawObjects();
}

function addObject(kind) {
  remember();
  const center = worldPoint(surface.clientWidth / 2, surface.clientHeight / 2);
  const width = kind === 'text' ? 220 : 195;
  const height = kind === 'text' ? 70 : 105;
  const initial = { x: center.x - width / 2, y: center.y - height / 2 };
  const possibilities = [[0, 0], [0, 145], [0, -145], [250, 0], [-250, 0], [250, 145], [-250, 145]];
  const position = possibilities.map(([x, y]) => ({ x: initial.x + x, y: initial.y + y })).find(point =>
    scene.objects.every(object => point.x + width + 12 < object.x || point.x > object.x + object.width + 12 ||
      point.y + height + 12 < object.y || point.y > object.y + object.height + 12));
  const object = {
    id: crypto.randomUUID(), kind, title: kind === 'text' ? 'Untitled text' : 'Untitled note', summary: '',
    x: position?.x ?? Math.max(...scene.objects.map(item => item.x + item.width)) + 45,
    y: position?.y ?? initial.y, width, height, editable: true,
  };
  scene.objects.push(object);
  selected.clear();
  selected.add(object.id);
  selectedLink = undefined;
  drawObjects();
  inspectObject(object);
  fit([object]);
}

function rectangle(x, y, originX, originY) {
  return { x: Math.min(x, originX), y: Math.min(y, originY), width: Math.abs(x - originX), height: Math.abs(y - originY) };
}

surface.addEventListener('pointerdown', event => {
  if (presenting || event.button > 1 || event.target.closest('.edge-hit')) return;
  const element = event.target.closest('.object');
  const pan = event.button === 1 || event.pointerType === 'touch' && !element || tool === 'pan' || space;
  const mode = pan ? 'pan' : element ? 'drag' : 'marquee';
  if (mode === 'drag') {
    if (!selected.has(element.dataset.id) || event.shiftKey) selectObject(element.dataset.id, event.shiftKey);
  } else if (mode === 'marquee' && !event.shiftKey) {
    selected.clear();
    selectedLink = undefined;
    closeInspector(false);
    syncSelection();
  }
  const captured = mode === 'drag' ? element : surface;
  captured.focus({ preventScroll: true });
  captured.setPointerCapture(event.pointerId);
  gesture = {
    pointerId: event.pointerId, captured, mode, x: event.clientX, y: event.clientY, moving: false,
    camera: { ...camera }, objects: mode === 'drag' ? structuredClone(scene.objects) : [],
    initialSelection: [...selected],
  };
  if (mode === 'pan') surface.dataset.panning = 'true';
  event.preventDefault();
});

surface.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (!gesture.moving && Math.hypot(dx, dy) < 4) return;
  gesture.moving = true;
  if (gesture.mode === 'pan') {
    camera.x = gesture.camera.x + dx;
    camera.y = gesture.camera.y + dy;
    syncCamera();
  } else if (gesture.mode === 'drag') {
    for (const start of gesture.objects) {
      if (!selected.has(start.id)) continue;
      const object = objectById.get(start.id);
      object.x = start.x + dx / camera.zoom;
      object.y = start.y + dy / camera.zoom;
      moveObject(object, objectLayer.querySelector(`[data-id="${CSS.escape(start.id)}"]`));
    }
    drawEdges();
    selectionPosition();
  } else {
    const box = rectangle(event.clientX, event.clientY, gesture.x, gesture.y);
    marquee.hidden = false;
    marquee.style.cssText = geometry(box);
    const topLeft = worldPoint(box.x, box.y);
    const bottomRight = worldPoint(box.x + box.width, box.y + box.height);
    selected.clear();
    gesture.initialSelection.forEach(id => selected.add(id));
    scene.objects.forEach(object => {
      if (object.x <= bottomRight.x && object.y <= bottomRight.y &&
          object.x + object.width >= topLeft.x && object.y + object.height >= topLeft.y) selected.add(object.id);
    });
    syncSelection();
  }
});

function finishGesture(event, cancel = false) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const active = gesture;
  gesture = undefined;
  if (active.captured.hasPointerCapture(event.pointerId)) active.captured.releasePointerCapture(event.pointerId);
  marquee.hidden = true;
  surface.dataset.panning = 'false';
  if (active.moving) suppressedClickUntil = performance.now() + 225;
  if (active.mode === 'drag' && active.moving) {
    if (cancel) {
      scene.objects = active.objects;
      drawObjects();
    } else remember(active.objects);
  }
  if (cancel && active.mode === 'pan') {
    Object.assign(camera, active.camera);
    syncCamera();
  }
  syncSelection();
}

surface.addEventListener('pointerup', event => finishGesture(event));
surface.addEventListener('pointercancel', event => finishGesture(event, true));
surface.addEventListener('dblclick', event => {
  const object = event.target.closest('.object');
  if (!object || tool !== 'select' && !presenting || performance.now() < suppressedClickUntil) return;
  selectObject(object.dataset.id);
  inspectObject(objectById.get(object.dataset.id));
});
surface.addEventListener('click', event => {
  if (performance.now() < suppressedClickUntil) return;
  const link = event.target.closest('[data-link]');
  if (link) inspectLink(scene.links.find(relation => relation.id === link.dataset.link));
  const object = event.target.closest('.object');
  if (object && event.detail === 0) {
    selectObject(object.dataset.id);
    inspectObject(objectById.get(object.dataset.id));
  }
});

surface.addEventListener('wheel', event => {
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientHeight : 1;
  const twoAxis = event.deltaMode === 0 && (event.deltaX !== 0 || Math.abs(event.deltaY) < 50);
  if (twoAxis && !event.ctrlKey) {
    camera.x -= event.deltaX;
    camera.y -= event.deltaY;
    syncCamera();
  } else zoomBy(Math.exp(-event.deltaY * unit * .002), event.clientX, event.clientY);
}, { passive: false });

function presentation(value) {
  presenting = value;
  desk.dataset.presenting = String(value);
  byId('leave-presentation').hidden = !value;
  selected.clear();
  selectedLink = undefined;
  closeInspector(false);
  setMenu(false);
  fit();
  syncSelection();
  byId(value ? 'leave-presentation' : 'present').focus({ preventScroll: true });
}

byId('board-menu-toggle').addEventListener('click', () => setMenu(menu.hidden));
menu.querySelectorAll('[data-board]').forEach(button => button.addEventListener('click', () => setBoard(button.dataset.board)));
byId('open-outline').addEventListener('click', () => {
  setMenu(false);
  outline.hidden = false;
  byId('find').value = '';
  renderOutline();
  byId('find').focus();
});
byId('close-outline').addEventListener('click', () => { outline.hidden = true; byId('board-menu-toggle').focus(); });
byId('find').addEventListener('input', renderOutline);
byId('outline-list').addEventListener('click', event => {
  const button = event.target.closest('[data-find-id]');
  if (!button) return;
  outline.hidden = true;
  const object = objectById.get(button.dataset.findId);
  selectObject(object.id);
  fit([object]);
  objectLayer.querySelector(`[data-id="${CSS.escape(object.id)}"]`).focus({ preventScroll: true });
});
document.querySelectorAll('button[data-tool]').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)));
byId('zoom-in').addEventListener('click', () => zoomBy(1.2));
byId('zoom-out').addEventListener('click', () => zoomBy(1 / 1.2));
byId('fit-board').addEventListener('click', () => fit());
byId('fit-selection').addEventListener('click', () => fit([...selected].map(id => objectById.get(id))));
byId('inspect-selection').addEventListener('click', () => inspectObject(objectById.get([...selected][0])));
byId('add-text').addEventListener('click', () => addObject('text'));
byId('add-note').addEventListener('click', () => addObject('note'));
byId('undo').addEventListener('click', () => restore('undo'));
byId('redo').addEventListener('click', () => restore('redo'));
byId('present').addEventListener('click', () => presentation(true));
byId('leave-presentation').addEventListener('click', () => presentation(false));
byId('close-inspector').addEventListener('click', () => closeInspector());
byId('inspect-content').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button?.dataset.inspect === 'passage') exactEvidence();
  if (button?.dataset.inspect === 'answer') inspectObject(objectById.get('question'));
  if (button?.dataset.inspect === 'page') sourcePage(fixture.documents.find(document => document.id === fixture.sourceDocId), true);
  if (button?.dataset.openDoc) sourcePage(fixture.documents.find(document => document.id === button.dataset.openDoc));
});
byId('inspect-content').addEventListener('submit', event => {
  const form = event.target;
  if (form.id !== 'edit-object') return;
  event.preventDefault();
  const object = objectById.get(form.dataset.editId);
  const data = new FormData(form);
  const title = data.get('title').trim();
  if (!title) return;
  remember();
  object.title = title;
  object.summary = data.get('summary').trim();
  drawObjects();
  closeInspector();
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!inspector.hidden) closeInspector();
    else if (!outline.hidden) { outline.hidden = true; byId('board-menu-toggle').focus(); }
    else if (!menu.hidden) { setMenu(false); byId('board-menu-toggle').focus(); }
    else if (presenting) presentation(false);
    else { selected.clear(); selectedLink = undefined; syncSelection(); }
    return;
  }
  if (isInteractive(event.target) || presenting) return;
  if (event.code === 'Space' && !event.target.closest('button, a')) { space = true; event.preventDefault(); }
  if (event.key.toLowerCase() === 'v') setTool('select');
  if (event.key.toLowerCase() === 'h') setTool('pan');
  if (event.key.toLowerCase() === 'f') fit(event.shiftKey ? [...selected].map(id => objectById.get(id)) : []);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    restore(event.shiftKey ? 'redo' : 'undo');
  }
  const element = event.target.closest('.object');
  if (element && event.key.startsWith('Arrow')) {
    event.preventDefault();
    const object = objectById.get(element.dataset.id);
    const step = event.shiftKey ? 24 : 8;
    remember();
    object.x += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    object.y += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    moveObject(object, element);
    syncSelection();
  }
});
window.addEventListener('keyup', event => { if (event.code === 'Space') space = false; });
window.addEventListener('blur', () => { space = false; });
window.addEventListener('resize', () => fit());

desk.dataset.direction = direction;
setTool(tool);
setBoard(board);
