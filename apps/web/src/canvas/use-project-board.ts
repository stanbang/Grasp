import { useEffect, useRef, useState } from 'react';
import { api, apiFetch, ApiError } from '../client';
import type { AddObject, BoardCommit, BoardConflict, CanvasBatch, ProjectBoard } from '../types/canvas-contracts';
import type { BoardDocument } from './board';
import { boardOperations, placeProjectAssets, projectCard, projectDocument } from './project-board';
import { useBoard } from './use-board';

type Draft = { document: BoardDocument; batches: CanvasBatch[] };
const pollInterval = 1500;

function readDraft(key: string): Draft | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Draft | null;
    if (value?.document?.kind === 'project' && Array.isArray(value.batches) && value.batches.length) return value;
  } catch {
    // Browser storage is optional; the open canvas still retains the draft.
  }
}

export function useProjectBoard(initial: ProjectBoard) {
  const path = `/boards/${encodeURIComponent(initial.id)}`;
  const draftKey = `grasp-project-draft:${initial.id}`;
  const [recovered] = useState(() => readDraft(draftKey));
  const [batches, setBatches] = useState(recovered?.batches ?? []);
  const pending = useRef(batches);
  const draft = useRef(recovered?.document);
  const [saved, setSaved] = useState(initial);
  const [issue, setIssue] = useState<Error>();
  const [disconnected, setDisconnected] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  function replaceQueue(next: CanvasBatch[]) {
    pending.current = next;
    setBatches(next);
    try {
      if (next.length && draft.current) {
        sessionStorage.setItem(draftKey, JSON.stringify({ document: draft.current, batches: next }));
      } else {
        sessionStorage.removeItem(draftKey);
      }
    } catch {
      // Retain in-memory edits when the browser cannot store another draft.
    }
  }

  const session = useBoard('project', {
    initial: recovered?.document ?? projectDocument(initial),
    save({ previous, next, restoreRevision }) {
      const operations: CanvasBatch['operations'] = restoreRevision === undefined
        ? boardOperations(previous, next)
        : [{ type: 'restoreRevision', revision: restoreRevision }];
      if (!operations.length) return false;
      draft.current = next;
      replaceQueue([...pending.current, {
        baseRevision: previous.revision, mutationId: crypto.randomUUID(), operations,
      }]);
      return true;
    },
  });
  const latest = useRef({ saved, session });
  latest.current = { saved, session };
  const first = batches[0];

  useEffect(() => {
    if (!first || issue) return;
    let active = true;
    void api<BoardCommit>(`${path}/ops`, first).then(receipt => {
      if (!active) return;
      setSaved(receipt.board);
      replaceQueue(pending.current.slice(1));
    }).catch(error => {
      if (active) setIssue(error instanceof Error ? error : new Error('Could not save the board.'));
    });
    return () => { active = false; };
  }, [first, issue, path]);

  useEffect(() => {
    let painted: ProjectBoard = initial;
    let request: AbortController | undefined;
    function editingField() {
      const focused = document.activeElement;
      return focused?.matches('.board-inspector input, .board-inspector textarea, .board-inspector select')
        && root.current?.contains(focused);
    }

    async function sync() {
      if (request || pending.current.length || document.hidden || editingField()) return;
      const head = latest.current.saved;
      if (head !== painted) {
        if (!latest.current.session.adopt(projectDocument(head), head.revision, false)) return;
        painted = head;
      }
      const controller = new AbortController();
      request = controller;
      try {
        const response = await apiFetch(`${path}?afterRevision=${head.revision}`, { signal: controller.signal });
        const remote = response.status === 204 ? null : await response.json() as ProjectBoard;
        if (controller.signal.aborted) return;
        setDisconnected(false);
        if (remote && !pending.current.length && !editingField() && latest.current.saved === head
          && latest.current.session.adopt(projectDocument(remote), head.revision, true)) {
          painted = remote;
          setSaved(remote);
        }
      } catch {
        if (!controller.signal.aborted) setDisconnected(true);
      } finally {
        request = undefined;
      }
    }

    const timer = window.setInterval(() => void sync(), pollInterval);
    const wake = () => void sync();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      request?.abort();
    };
  }, [initial, path]);

  async function discardDraft() {
    const base = session.document.revision;
    try {
      const current = await api<ProjectBoard>(path);
      if (!latest.current.session.adopt(projectDocument(current), base, true)) return;
      draft.current = undefined;
      replaceQueue([]);
      setSaved(current);
      setIssue(undefined);
      setDisconnected(false);
    } catch (error) {
      setIssue(error instanceof Error ? error : new Error('Could not load the saved board.'));
    }
  }

  function downloadDraft() {
    if (!draft.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({
      boardId: initial.id, document: draft.current, batches: pending.current,
    }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `grasp-${initial.id}-draft.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function retryAssetPlacements() {
    const queued = pending.current;
    const operations = queued.flatMap(batch => batch.operations);
    const additions = operations.filter((operation): operation is AddObject => operation.type === 'addObject' && !!operation.object.asset);
    if (!additions.length || additions.length !== operations.length) return;
    const base = latest.current.session.document.revision;
    try {
      const head = await api<ProjectBoard>(path);
      if (pending.current !== queued || !latest.current.session.adopt(projectDocument(head), base, true)) return;
      draft.current = undefined;
      replaceQueue([]);
      setSaved(head);
      setIssue(undefined);
      const assets = additions.map(operation => projectCard({
        ...operation.object, createdBy: 'user', updatedBy: 'user',
      }));
      latest.current.session.update(board => placeProjectAssets(board, assets));
    } catch (error) {
      setIssue(error instanceof Error ? error : new Error('Could not load the saved board.'));
    }
  }

  const conflict = issue instanceof ApiError && issue.status === 409
    ? issue.detail as BoardConflict : undefined;
  return {
    root, session, savedRevision: saved.revision, saving: batches.length > 0 && !issue,
    issue, conflict, disconnected, discardDraft, downloadDraft, retry: () => setIssue(undefined),
    retryAssetPlacements,
    canRetryAssetPlacements: batches.length > 0 && batches.every(batch => batch.operations.every(
      operation => operation.type === 'addObject' && !!operation.object.asset,
    )),
  };
}
