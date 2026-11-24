import {
  BaseEdge, EdgeLabelRenderer, Handle, NodeResizer, Position, getBezierPath, getSmoothStepPath,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from '@xyflow/react';
import { Box, Check, FileText, Layers3, Lightbulb, StickyNote, Workflow } from 'lucide-react';
import { memo } from 'react';
import type { BoardLink, Card } from './board';

type CardData = {
  card: Card;
  emphasized: boolean;
  connecting: boolean;
  resizeStart: () => void;
  resizeEnd: () => void;
};
export type CanvasNode = Node<CardData, 'card'>;
export type CanvasEdge = Edge<{ link: BoardLink }, 'relation'>;

const icons = { concept: Box, document: FileText, component: Workflow, explanation: Lightbulb, annotation: StickyNote, group: Layers3 };
export const sides = [Position.Left, Position.Right, Position.Top, Position.Bottom];

export const CanvasCard = memo(function CanvasCard({ data, selected, isConnectable }: NodeProps<CanvasNode>) {
  const { card } = data;
  const Icon = icons[card.kind];
  const group = card.kind === 'group';
  const mastered = card.concept?.masteryState === 'mastered';
  const sourceCount = card.concept?.docIds.length;
  return <div className={`board-card board-card--${card.kind}${data.emphasized ? ' board-card--emphasized' : ''}${data.connecting ? ' board-card--connecting' : ''}`}>
    <NodeResizer isVisible={selected && !group} minWidth={164} minHeight={88}
      maxWidth={760} maxHeight={560} onResizeStart={data.resizeStart} onResizeEnd={data.resizeEnd} />
    <div className="board-card-heading">
      <Icon size={17} aria-hidden />
      <strong title={card.title}>{card.title}</strong>
      {mastered && <Check className="board-mastered" size={17} aria-label="Mastered" />}
    </div>
    {card.description.trim() && card.description.trim() !== card.title && <p>{card.description}</p>}
    {card.document && <span className="board-card-detail">{card.document.status === 'done' ? 'Ready to read' : card.document.status}</span>}
    {card.message && <span className="board-card-detail">{card.message}</span>}
    {sourceCount !== undefined && <span className="board-card-detail">{sourceCount} {sourceCount === 1 ? 'source' : 'sources'}</span>}
    {!group && sides.flatMap(side => [
      <Handle key={`in-${side}`} position={side} type="target" id={`in-${side}`} isConnectable={isConnectable} />,
      <Handle key={`out-${side}`} position={side} type="source" id={`out-${side}`} isConnectable={isConnectable} />,
    ])}
  </div>;
});

export function Relation({ data, selected, id, markerEnd, ...points }: EdgeProps<CanvasEdge>) {
  const link = data?.link;
  const [path, x, y] = link?.origin === 'semantic' && points.sourcePosition !== points.targetPosition
    ? getBezierPath({ ...points, curvature: 0.14 })
    : getSmoothStepPath({ ...points, borderRadius: 12, offset: 22 });
  return <>
    <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={22} />
    {link && <EdgeLabelRenderer>
      <span className={`board-relation-label${selected ? ' board-relation-label--selected' : ''}`}
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }} title={link.label}>
        {link.label}
      </span>
    </EdgeLabelRenderer>}
  </>;
}
