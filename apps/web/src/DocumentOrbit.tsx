import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { apiFetch } from './client';
import type { Document, ChunksResponse } from './types/contracts';
import './orbit.css';

type OrbitProps = {
  documents: Document[];
  selected: string | null;
  paused: boolean;
  onSelect: (id: string) => void;
  arrivingId?: string | null;
  onArrived?: () => void;
};
type OrbitItem = { object: CSS3DObject; element: HTMLDivElement; slot: number };
type Arrival = { id: string; started: number; origin: Vector3 };

function DocumentCard({ source, selected, onSelect }: { source: Document; selected: boolean; onSelect: () => void }) {
  const [image, setImage] = useState('');
  const card = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!card.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '100px' });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, []);
  const [excerpt, setExcerpt] = useState('');
  const type = source.name.split('.').pop()?.toUpperCase() || 'FILE';
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let objectUrl = '';
    let active = true;
    if (type === 'PDF') {
      void apiFetch(`/documents/${source.id}/thumbnail`, { signal: controller.signal })
        .then(async response => {
          objectUrl = URL.createObjectURL(await response.blob());
          if (active) setImage(objectUrl); else URL.revokeObjectURL(objectUrl);
        }).catch(() => {});
    }
    void apiFetch(`/documents/${source.id}/chunks`, { signal: controller.signal })
      .then(response => response.json() as Promise<ChunksResponse>)
      .then(data => { if (active) setExcerpt(data.chunks[0]?.text.slice(0, 230) || ''); })
      .catch(() => {});
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source.id, type, visible]);
  return <button ref={card} className={`live-document-card ${selected ? 'is-selected' : ''}`} onClick={onSelect} aria-label={`Inspect ${source.name}`} aria-pressed={selected}>
    <div className="live-document-paper" aria-hidden="true">
      {image ? <img src={image} alt="" draggable={false} /> : <><div className="live-paper-type"><FileText size={15} /><span>{type}</span></div><strong>{source.name.replace(/\.[^.]+$/, '')}</strong><p>{excerpt || 'Indexed source document'}</p></>}
    </div>
    <span className="live-document-caption"><FileText size={13} /><span>{source.name}</span><small>{type}</small></span>
    <span className="live-document-tooltip">{source.name} · {type}</span>
  </button>;
}

export function DocumentOrbit({ documents, selected, paused, onSelect, arrivingId = null, onArrived }: OrbitProps) {
  const ready = useMemo(() => documents.filter(source => source.status === 'done'), [documents]);
  const [narrow, setNarrow] = useState(window.matchMedia('(max-width: 760px)').matches);
  const [reduced, setReduced] = useState(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [unsupported, setUnsupported] = useState(!CSS.supports('transform-style', 'preserve-3d'));
  const host = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<string, OrbitItem>());
  const slots = useRef(new Map<string, number>());
  const scene = useRef<Scene | null>(null);
  const hover = useRef(false);
  const latest = useRef({ paused, selected, reduced, arrivingId, onArrived });
  latest.current = { paused, selected, reduced, arrivingId, onArrived };
  const finished = useRef(new Set<string>());
  const list = narrow || unsupported || ready.length > 12;
  const portals = useMemo(() => {
    const ids = new Set(ready.map(source => source.id));
    for (const id of slots.current.keys()) if (!ids.has(id)) slots.current.delete(id);
    return ready.map(source => {
    let item = items.current.get(source.id);
    if (!item) {
      const element = document.createElement('div');
      element.className = 'live-orbit-object';
      if (!slots.current.has(source.id)) {
        const occupied = new Set(slots.current.values());
        let slot = 0;
        while (occupied.has(slot)) slot++;
        slots.current.set(source.id, slot);
      }
      item = { element, object: new CSS3DObject(element), slot: slots.current.get(source.id)! };
      items.current.set(source.id, item);
    }
    return { source, item };
    });
  }, [ready]);

  useEffect(() => {
    const width = window.matchMedia('(max-width: 760px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setNarrow(width.matches); setReduced(motion.matches); };
    width.addEventListener('change', update); motion.addEventListener('change', update);
    return () => { width.removeEventListener('change', update); motion.removeEventListener('change', update); };
  }, []);

  useEffect(() => {
    const ids = new Set(ready.map(source => source.id));
    for (const [id, item] of items.current) {
      if (!ids.has(id)) { item.object.removeFromParent(); item.element.remove(); items.current.delete(id); }
      else scene.current?.add(item.object);
    }
  }, [ready, list]);

  useEffect(() => {
    if (!list || !arrivingId || finished.current.has(arrivingId)) return;
    finished.current.add(arrivingId);
    onArrived?.();
  }, [list, arrivingId, onArrived]);

  useEffect(() => {
    if (list || !host.current) return;
    const container = host.current;
    const world = new Scene();
    scene.current = world;
    const camera = new PerspectiveCamera(45, 1, 1, 5000);
    camera.position.z = 1100;
    let renderer: CSS3DRenderer;
    try { renderer = new CSS3DRenderer(); } catch { setUnsupported(true); return; }
    renderer.domElement.className = 'live-orbit-renderer';
    container.appendChild(renderer.domElement);
    for (const item of items.current.values()) world.add(item.object);
    let width = 800, height = 600, frame = 0, angle = 0, previous = performance.now();
    let arrival: Arrival | null = null;
    const target = new Vector3();
    const updateSize = () => {
      width = container.clientWidth; height = container.clientHeight;
      renderer.setSize(Math.max(width, 1), Math.max(height, 1)); camera.aspect = Math.max(width, 1) / Math.max(height, 1); camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(updateSize); observer.observe(container); updateSize();
    function beginArrival(id: string, now: number): Arrival {
      const anchor = document.querySelector('[data-composer-anchor]')?.getBoundingClientRect();
      const bounds = container.getBoundingClientRect();
      const scale = 2 * camera.position.z * Math.tan(Math.PI / 8) / Math.max(height, 1);
      const x = anchor ? anchor.left + anchor.width / 2 - bounds.left - width / 2 : 0;
      const y = anchor ? height / 2 - (anchor.top + anchor.height / 2 - bounds.top) : -height * .22;
      return { id, started: now, origin: new Vector3(x * scale, y * scale, 100) };
    }
    function render(now: number) {
      if (document.hidden) { frame = 0; return; }
      const state = latest.current;
      const elapsed = Math.min((now - previous) / 1000, .05); previous = now;
      if (!state.paused && !state.reduced && !hover.current) angle += elapsed * .009;
      if (state.arrivingId && !finished.current.has(state.arrivingId) && arrival?.id !== state.arrivingId) arrival = beginArrival(state.arrivingId, now);
      const scale = 2 * camera.position.z * Math.tan(Math.PI / 8) / Math.max(height, 1);
      for (const [id, item] of items.current) {
        const theta = item.slot * 2.399963 + 3.5 + angle;
        const ring = 1 + Math.floor(item.slot / 7) * .14;
        target.set(Math.cos(theta) * width * .37 * scale * ring, (Math.sin(theta) * height * .22 + height * .1) * scale, Math.sin(theta) * 90);
        if (arrival?.id === id) {
          const progress = state.reduced ? 1 : Math.min((now - arrival.started) / 850, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          item.object.position.copy(arrival.origin).lerp(target, eased);
          item.object.position.y += Math.sin(progress * Math.PI) * 75;
          if (progress === 1) { finished.current.add(id); arrival = null; state.onArrived?.(); }
        } else item.object.position.lerp(target, state.reduced ? 1 : .08);
        item.object.rotation.y = Math.cos(theta) * -.08;
        item.object.scale.setScalar(id === state.selected ? 1.04 : 1);
      }
      renderer.render(world, camera);
      frame = requestAnimationFrame(render);
    }
    function visibility() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else if (!frame) { previous = performance.now(); frame = requestAnimationFrame(render); } }
    document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); renderer.domElement.remove(); world.clear(); scene.current = null; };
  }, [list]);

  return <div className={`live-document-orbit ${list ? 'orbit-list' : ''}`} aria-label="Indexed documents" onPointerEnter={() => { hover.current = true; }} onPointerLeave={() => { hover.current = false; }} onFocusCapture={() => { hover.current = true; }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hover.current = false; }}>
    {!list && <><div className="live-orbit-path" /><div className="live-orbit-path live-orbit-path-outer" /><div className="live-orbit-host" ref={host} />{portals.map(({ source, item }) => createPortal(<DocumentCard source={source} selected={selected === source.id} onSelect={() => onSelect(source.id)} />, item.element, source.id))}</>}
    {list && <div className="live-document-grid">{ready.map(source => <DocumentCard key={source.id} source={source} selected={selected === source.id} onSelect={() => onSelect(source.id)} />)}</div>}
    {!ready.length && <p className="orbit-empty">PDF, Markdown and text sources appear here after indexing.</p>}
  </div>;
}
