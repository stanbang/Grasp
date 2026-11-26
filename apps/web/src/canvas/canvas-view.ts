import type { BoardLink, BoardScene, Card, Point, Rect } from './board';

export type ViewDetail = 'full' | 'compact' | 'overview';
export type EdgeRoute = { path: string; points: Point[] };
export type EdgeLabel = Point & { text: string; fontSize: number };
type Segment = [Point, Point];

const clearance = 12;
const textGap = 5;
const sides = ['left', 'right', 'top', 'bottom'] as const;
type Side = typeof sides[number];

export function viewDetail(zoom: number): ViewDetail {
  if (zoom >= .82) return 'full';
  return zoom >= .39 ? 'compact' : 'overview';
}

function intersects(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap
    && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
}

function segments(points: Point[]): Segment[] {
  return points.slice(1).map((point, index) => [points[index]!, point]);
}

function intersectsSegment([a, b]: Segment, rect: Rect, gap: number): boolean {
  return Math.min(a.x, b.x) < rect.x + rect.width + gap && Math.max(a.x, b.x) > rect.x - gap
    && Math.min(a.y, b.y) < rect.y + rect.height + gap && Math.max(a.y, b.y) > rect.y - gap;
}

function port(rect: Rect, side: Side, lane: number, stub: number): [Point, Point] {
  const horizontal = side === 'left' || side === 'right';
  const fraction = .5 + Math.max(-.25, Math.min(.25, lane * .08));
  const point = {
    x: rect.x + (horizontal ? side === 'right' ? rect.width : 0 : rect.width * fraction),
    y: rect.y + (horizontal ? rect.height * fraction : side === 'bottom' ? rect.height : 0),
  };
  return [point, {
    x: point.x + (side === 'left' ? -stub : side === 'right' ? stub : 0),
    y: point.y + (side === 'top' ? -stub : side === 'bottom' ? stub : 0),
  }];
}

function roundPath(points: Point[]): string {
  const start = points[0]!;
  let path = `M ${start.x} ${start.y}`;
  for (let index = 1; index < points.length - 1; index++) {
    const [previous, corner, next] = points.slice(index - 1, index + 2) as [Point, Point, Point];
    const radius = Math.min(8, Math.hypot(corner.x - previous.x, corner.y - previous.y) / 2,
      Math.hypot(next.x - corner.x, next.y - corner.y) / 2);
    path += ` L ${corner.x + Math.sign(previous.x - corner.x) * radius} ${corner.y + Math.sign(previous.y - corner.y) * radius}`;
    path += ` Q ${corner.x} ${corner.y} ${corner.x + Math.sign(next.x - corner.x) * radius} ${corner.y + Math.sign(next.y - corner.y) * radius}`;
  }
  const end = points[points.length - 1]!;
  return `${path} L ${end.x} ${end.y}`;
}

function route(source: Card, target: Card, cards: Card[], sourceLane: number, targetLane: number): EdgeRoute {
  const a = source.placement, b = target.placement;
  const obstacles = cards.filter(card => card.id !== source.id && card.id !== target.id).map(card => card.placement);
  const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y);
  const corridor = { x: left, y: top, width: Math.max(a.x + a.width, b.x + b.width) - left,
    height: Math.max(a.y + a.height, b.y + b.height) - top };
  const nearby = obstacles.filter(rect => intersects(rect, corridor, 48));
  const xChannels = nearby.flatMap(rect => [rect.x - clearance - 4, rect.x + rect.width + clearance + 4]).slice(0, 24);
  const yChannels = nearby.flatMap(rect => [rect.y - clearance - 4, rect.y + rect.height + clearance + 4]).slice(0, 24);
  let best: Point[] = [];
  let score = Infinity;
  for (const from of sides) for (const to of sides) {
    const facingGap =
      from === 'right' && to === 'left' ? b.x - a.x - a.width :
      from === 'left' && to === 'right' ? a.x - b.x - b.width :
      from === 'bottom' && to === 'top' ? b.y - a.y - a.height :
      from === 'top' && to === 'bottom' ? a.y - b.y - b.height : 0;
    const stub = facingGap > 0 ? Math.max(2, Math.min(20, facingGap / 3)) : 20;
    const [origin, start] = port(a, from, sourceLane, stub);
    const [tip, end] = port(b, to, targetLane, stub);
    const consider = (bends: Point[]) => {
      const points = [origin, start, ...bends, end, tip].filter((point, index, routePoints) =>
        index === 0 || point.x !== routePoints[index - 1]!.x || point.y !== routePoints[index - 1]!.y);
      const legs = segments(points);
      let cost = legs.length * 9 + legs.reduce((length, [first, last]) =>
        length + Math.abs(first.x - last.x) + Math.abs(first.y - last.y), 0);
      for (let index = 1; index < points.length - 1; index++) {
        const previous = points[index - 1]!, corner = points[index]!, next = points[index + 1]!;
        if ((corner.x - previous.x) * (next.x - corner.x) + (corner.y - previous.y) * (next.y - corner.y) < 0)
          cost += 100_000;
      }
      if (cost >= score) return;
      for (const leg of legs.slice(1, -1)) {
        if (intersectsSegment(leg, a, 1) || intersectsSegment(leg, b, 1)) cost += 100_000;
      }
      for (const rect of obstacles) {
        if (legs.some(leg => intersectsSegment(leg, rect, clearance))) cost += 100_000;
        if (cost >= score) return;
      }
      if (cost < score) { best = points; score = cost; }
    };
    consider([{ x: end.x, y: start.y }]);
    consider([{ x: start.x, y: end.y }]);
    const middleX = (start.x + end.x) / 2;
    const middleY = (start.y + end.y) / 2;
    for (const x of [middleX, ...(score >= 100_000 ? xChannels : [])]) consider([{ x, y: start.y }, { x, y: end.y }]);
    for (const y of [middleY, ...(score >= 100_000 ? yChannels : [])]) consider([{ x: start.x, y }, { x: end.x, y }]);
  }
  return { path: roundPath(best), points: best };
}

export function projectRoutes(scene: BoardScene): Map<string, EdgeRoute> {
  const nodes = scene.cards.filter(card => card.kind !== 'group');
  const byId = new Map(nodes.map(card => [card.id, card]));
  const incident = new Map<string, string[]>();
  for (const link of scene.links) for (const id of [link.source, link.target]) {
    const ids = incident.get(id) ?? [];
    ids.push(link.id);
    incident.set(id, ids);
  }
  const lane = (node: string, connection: string) => {
    const ids = incident.get(node)!;
    return ids.indexOf(connection) - (ids.length - 1) / 2;
  };
  return new Map(scene.links.flatMap(link => {
    const source = byId.get(link.source), target = byId.get(link.target);
    if (!source || !target) return [];
    return [[link.id, route(source, target, nodes, lane(link.source, link.id), lane(link.target, link.id))]];
  }));
}

export function projectLabels(
  scene: BoardScene, routes: Map<string, EdgeRoute>, zoom: number, selectedId?: string,
): Map<string, EdgeLabel> {
  const detail = viewDetail(zoom);
  const byId = new Map(scene.cards.map(card => [card.id, card]));
  const crossGroup = (link: BoardLink) => {
    const source = byId.get(link.source)?.placement.groupId, target = byId.get(link.target)?.placement.groupId;
    return !!(source || target) && source !== target;
  };
  const priority = (link: BoardLink) => link.id === selectedId ? 4 : crossGroup(link) ? 3 : link.role === 'process' ? 2 : 1;
  const ordered = scene.links.filter(link => link.id === selectedId ||
    ((link.role === 'process' || link.role === 'data') && (detail !== 'overview' || priority(link) >= 2)))
    .sort((a, b) => priority(b) - priority(a));
  const occupied = scene.cards.map(({ kind, placement }) => kind === 'group' ? { ...placement, height: 48 } : placement);
  const planned = new Map<string, EdgeLabel>();
  const fontSize = Math.min(64, Math.max(13, 9.5 / zoom));
  for (const link of ordered) {
    if (detail === 'overview' && planned.size >= 8) break;
    const path = routes.get(link.id);
    if (!path) continue;
    const limit = detail === 'overview' ? 21 : detail === 'compact' ? 38 : 80;
    const text = link.label.length > limit ? link.label.slice(0, limit - 1).replace(/\s+\S*$/, '') + '…' : link.label;
    const width = (text.length + 1) * fontSize * .62 + 14;
    const height = fontSize + 8;
    const others = [...routes].flatMap(([id, item]) => id === link.id ? [] : segments(item.points));
    const ranked = segments(path.points).sort((a, b) => Math.hypot(b[1].x - b[0].x, b[1].y - b[0].y)
      - Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y));
    const candidates = ranked.flatMap(([a, b]) => {
      const horizontal = a.y === b.y;
      return [.5, .25, .75].flatMap(fraction => [-1, 1].map(side => ({
        x: a.x + (b.x - a.x) * fraction + (horizontal ? 0 : side * (width / 2 + textGap)),
        y: a.y + (b.y - a.y) * fraction + (horizontal ? side * (height / 2 + textGap) : 0),
      })));
    });
    for (const center of candidates) {
      const rect = { x: center.x - width / 2, y: center.y - height / 2, width, height };
      if (occupied.some(item => intersects(rect, item, textGap))
        || others.some(segment => intersectsSegment(segment, rect, 2))) continue;
      occupied.push(rect);
      planned.set(link.id, { ...center, fontSize, text });
      break;
    }
  }
  return planned;
}
