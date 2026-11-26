import { create } from 'zustand';
import type { Document, GraphNode, GraphEdge } from './types/contracts';
export type StudyGraph = {
    nodes: GraphNode[];
    edges: GraphEdge[];
};
export const useStudyGraph = create<{
    graph: StudyGraph;
    documents: Document[];
    setLibrary: (graph: StudyGraph, documents: Document[]) => void;
    upsertDocument: (document: Document) => void;
}>((set) => ({
    graph: { nodes: [], edges: [] },
    documents: [],
    setLibrary: (graph, documents) => set({ graph, documents }),
    upsertDocument: document => set(state => {
        const found = state.documents.some(item => item.id === document.id);
        return { documents: found ? state.documents.map(item => item.id === document.id ? document : item)
            : [...state.documents, document] };
    }),
}));
