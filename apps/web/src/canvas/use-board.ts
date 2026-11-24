import { useRef, useState } from 'react';
import type { Viewport } from '@xyflow/react';
import { emptyBoard, type BoardDocument, type BoardKind } from './board';

const historyLimit = 60;
type Update = (board: BoardDocument) => BoardDocument;

export function useBoard(kind: BoardKind) {
  const [document, render] = useState(() => emptyBoard(kind));
  const current = useRef(document);
  const history = useRef({ undo: [] as BoardDocument[], redo: [] as BoardDocument[] });
  const gesture = useRef<BoardDocument | null>(null);
  const viewport = useRef<Viewport>();
  const [selected, select] = useState<string[]>([]);
  const [selectedLinks, selectLinks] = useState<string[]>([]);

  function show(next: BoardDocument) {
    current.current = next;
    render(next);
  }

  function commit(previous: BoardDocument, next: BoardDocument) {
    const versions = history.current;
    versions.undo = [...versions.undo.slice(1 - historyLimit), previous];
    versions.redo = [];
    show({ ...next, revision: current.current.revision + 1 });
  }

  function update(change: Update) {
    const previous = current.current;
    const next = change(previous);
    if (previous === next) return;
    if (gesture.current) show(next);
    else commit(previous, next);
  }

  function begin() {
    gesture.current ??= current.current;
  }

  function finish() {
    const previous = gesture.current;
    gesture.current = null;
    if (previous && previous !== current.current) commit(previous, current.current);
  }

  function cancel() {
    if (!gesture.current) return;
    const previous = gesture.current;
    gesture.current = null;
    show(previous);
  }

  function restore(direction: 'undo' | 'redo') {
    if (gesture.current) return;
    const versions = history.current;
    const previous = versions[direction].pop();
    if (!previous) return;
    versions[direction === 'undo' ? 'redo' : 'undo'].push(current.current);
    show({ ...previous, revision: current.current.revision + 1 });
  }

  return {
    document, selected, select, selectedLinks, selectLinks, viewport,
    update, begin, finish, cancel, restore,
    canUndo: history.current.undo.length > 0, canRedo: history.current.redo.length > 0,
  };
}

export type BoardSession = ReturnType<typeof useBoard>;
