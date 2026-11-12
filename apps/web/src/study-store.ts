import { create } from 'zustand';
import type { GraphNode, GraphEdge } from './types/contracts';
export type StudyGraph = {
    nodes: GraphNode[];
    edges: GraphEdge[];
};
export const useStudyGraph = create<{
    graph: StudyGraph;
    setGraph: (value: StudyGraph | ((old: StudyGraph) => StudyGraph)) => void;
}>((set) => ({
    graph: { nodes: [], edges: [] },
    setGraph: value => set(state => ({ graph: typeof value === 'function' ? value(state.graph) : value })),
}));
