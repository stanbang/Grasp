import { useRef, useState } from 'react';
import type { Viewport } from '@xyflow/react';
import { emptyBoard, type BoardDocument, type BoardKind } from './board';

const historyLimit = 60;
type Update = (board: BoardDocument) => BoardDocument;
type BoardEdit = { previous: BoardDocument; next: BoardDocument; restoreRevision?: number };
type BoardPersistence = { initial: BoardDocument; save: (edit: BoardEdit) => boolean };

export function useBoard(kind: BoardKind, persistence?: BoardPersistence) {
  const [document, render] = useState(() => persistence?.initial ?? emptyBoard(kind));
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
    const revised = { ...next, revision: previous.revision + 1 };
    if (persistence && !persistence.save({ previous, next: revised })) {
      if (current.current !== previous) show(previous);
      return;
    }
    const versions = history.current;
    versions.undo = [...versions.undo.slice(1 - historyLimit), previous];
    versions.redo = [];
    show(revised);
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
    const target = versions[direction].at(-1);
    if (!target) return;
    const previous = current.current;
    const next = { ...target, revision: previous.revision + 1 };
    if (persistence && !persistence.save({ previous, next, restoreRevision: target.revision })) return;
    versions[direction].pop();
    versions[direction === 'undo' ? 'redo' : 'undo'].push(current.current);
    show(next);
  }

  function adopt(next: BoardDocument, expectedRevision: number, resetHistory: boolean) {
    if (gesture.current || current.current.revision !== expectedRevision) return false;
    show(next);
    if (resetHistory) history.current = { undo: [], redo: [] };
    select(ids => ids.filter(id => next.authoredCards.some(card => card.id === id)));
    selectLinks(ids => ids.filter(id => next.authoredLinks.some(link => link.id === id)));
    return true;
  }

  return {
    document, selected, select, selectedLinks, selectLinks, viewport,
    update, begin, finish, cancel, restore, adopt,
    canUndo: history.current.undo.length > 0, canRedo: history.current.redo.length > 0,
  };
}

export type BoardSession = ReturnType<typeof useBoard>;
