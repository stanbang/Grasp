import {
  BaseEdge, EdgeLabelRenderer, Handle, NodeResizer, Position, getBezierPath, getSmoothStepPath,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from '@xyflow/react';
import { ArrowUpRight, Check, Quote } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { BoardLink, Card } from './board';
import type { EdgeLabel, EdgeRoute, ViewDetail } from './canvas-view';
import { TechnicalIllustration } from './TechnicalIllustration';

type CardData = {
  card: Card;
  emphasized: boolean;
  connecting: boolean;
  detail: boolean;
  view?: ViewDetail;
  titleFits?: boolean;
  presentationContext: boolean;
  preview?: () => void;
  inspect?: () => void;
  resizeStart: () => void;
  resizeEnd: () => void;
};
export type CanvasNode = Node<CardData, 'card'>;
export type CanvasEdge = Edge<{ link: BoardLink; showLabel: boolean; route?: EdgeRoute; label?: EdgeLabel }, 'relation'>;

export const sides = [Position.Left, Position.Right, Position.Top, Position.Bottom];

export const CanvasCard = memo(function CanvasCard({ data, selected, isConnectable }: NodeProps<CanvasNode>) {
  const { card } = data;
  const group = card.kind === 'group';
  const content = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const element = content.current;
    if (!element || data.view !== 'full' || group) return;
    const measure = () => setHasMore(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [data.view, group, card.title, card.description]);
  const caption = card.kind === 'illustration' || card.kind === 'visualization';
  const mastered = card.concept?.masteryState === 'mastered';
  const sourceCount = card.concept?.docIds.length;
  const Title = card.kind === 'heading' ? card.id === 'title' ? 'h1' : 'h2' : 'strong';
  const showDescription = card.kind !== 'concept' || selected || data.detail;
  const important = card.projectObject?.requirement?.status === 'accepted' ? 'Accepted requirement'
    : card.projectObject?.question && !card.projectObject.answer ? 'Open question' : undefined;
  const description = data.view === 'compact' ? card.description.split(/\n|(?<=[.!?])\s/)[0] : card.description;
  return <div className={`board-card board-card--${card.kind}${card.prominence ? ` board-card--${card.prominence}` : ''}${data.emphasized ? ' board-card--emphasized' : ''}${data.connecting ? ' board-card--connecting' : ''}`}
    data-note-style={card.noteStyle} data-board-title={card.id === 'title' ? 'true' : undefined}
    data-view-detail={data.view} data-title-fits={data.titleFits}
    data-presentation-context={data.presentationContext || undefined}>
    <NodeResizer isVisible={selected && !group} minWidth={Math.min(164, card.placement.width)} minHeight={Math.min(88, card.placement.height)}
      maxWidth={760} maxHeight={560} onResizeStart={data.resizeStart} onResizeEnd={data.resizeEnd} />
    <div ref={content} className={data.view ? 'board-card-content' : 'board-card-contents'}>
    {caption && card.illustration && <TechnicalIllustration name={card.illustration} />}
    <div className="board-card-heading">
      {!caption && card.illustration && <TechnicalIllustration name={card.illustration} />}
      {card.kind === 'evidence' && <Quote size={16} aria-hidden />}
      {data.preview ? <button className="board-preview-button nodrag nopan" type="button" onClick={event => {
        event.stopPropagation();
        data.preview?.();
      }}>{card.title}<ArrowUpRight size={14} aria-hidden /></button> : <Title className="board-object-title" title={card.title}>{card.title}</Title>}
      {mastered && <Check className="board-mastered" size={17} aria-label="Mastered" />}
    </div>
    {showDescription && (!caption || data.view) && !group && data.view !== 'overview'
      && description?.trim() && description.trim() !== card.title && <p>{description}</p>}
    {important && data.titleFits && <span className="board-card-detail board-decision">{important}</span>}
    {card.document && <span className="board-card-detail">{card.document.status === 'done' ? 'Ready to read' : card.document.status}</span>}
    {card.message && <span className="board-card-detail">{card.message}</span>}
    {sourceCount !== undefined && (selected || data.detail) && <span className="board-card-detail">{sourceCount} {sourceCount === 1 ? 'source' : 'sources'}</span>}
    </div>
    {data.view === 'full' && !group && hasMore && data.inspect && <button type="button" className="board-card-more nodrag nopan"
      aria-label={`Read full text for ${card.title}`} onClick={event => { event.stopPropagation(); data.inspect?.(); }}>
      Full text
    </button>}
    {!group && sides.flatMap(side => [
      <Handle key={`in-${side}`} position={side} type="target" id={`in-${side}`} isConnectable={isConnectable} />,
      <Handle key={`out-${side}`} position={side} type="source" id={`out-${side}`} isConnectable={isConnectable} />,
    ])}
  </div>;
});

export function Relation({ data, selected, id, markerEnd, ...points }: EdgeProps<CanvasEdge>) {
  const link = data?.link;
  const route = data?.route;
  const label = data?.label;
  const curve = link?.role === 'annotation' || link?.origin === 'semantic' && points.sourcePosition !== points.targetPosition;
  const [path, x, y] = curve ? getBezierPath({ ...points, curvature: link?.role === 'annotation' ? .48 : .14 })
    : getSmoothStepPath({ ...points, centerY: link?.routeY, borderRadius: 12,
      offset: points.sourcePosition === points.targetPosition ? (link?.origin === 'repository' ? 63 : 33) : 20 });
  return <>
    <BaseEdge id={id} path={route?.path ?? path} markerEnd={markerEnd} interactionWidth={22} />
    {link && (route ? label : selected || data?.showLabel) && <EdgeLabelRenderer>
      <span className={`board-relation-label${selected ? ' board-relation-label--selected' : ''}`}
        data-edge-id={id} style={{ fontSize: label?.fontSize,
          transform: `translate(-50%, -50%) translate(${label?.x ?? x}px, ${label?.y ?? y - 9}px)` }} title={link.label}>
        {label?.text ?? link.label}
      </span>
    </EdgeLabelRenderer>}
  </>;
}
