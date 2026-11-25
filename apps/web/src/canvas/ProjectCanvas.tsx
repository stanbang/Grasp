import { useEffect, useState } from 'react';
import { api, apiFetch } from '../client';
import type { BoardList, BoardSelectionUpdate, BoardSummary, ProjectBoard } from '../types/canvas-contracts';
import type { Document } from '../types/contracts';
import type { SourceSelection } from './board';
import { CanvasBoard } from './CanvasBoard';
import { CanvasInspector } from './CanvasInspector';
import { useProjectBoard } from './use-project-board';

const emptyScene = { cards: [], links: [] };
const ignoreProjectAction = () => {};

function useSharedSelection(id: string, revision: number, objectIds: string[], saved: boolean) {
  const selectionKey = objectIds.join(',');
  useEffect(() => {
    if (!saved) return;
    const controller = new AbortController();
    const selection: BoardSelectionUpdate = {
      baseRevision: revision, objectIds: selectionKey ? selectionKey.split(',') : [],
    };
    function publish() {
      if (document.hidden) return;
      void apiFetch(`/boards/${encodeURIComponent(id)}/selection`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selection), signal: controller.signal,
      }).catch(() => {});
    }
    const first = window.setTimeout(publish, 180);
    const heartbeat = window.setInterval(publish, 10_000);
    document.addEventListener('visibilitychange', publish);
    return () => {
      controller.abort();
      window.clearTimeout(first);
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', publish);
    };
  }, [id, revision, selectionKey, saved]);
}

export function useProjectDirectory(active: boolean, id: string, unlocked: number) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [snapshot, setSnapshot] = useState<ProjectBoard>();
  const [listProblem, setListProblem] = useState('');
  const [boardProblem, setBoardProblem] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    let current = true;
    async function load() {
      const list: BoardSummary[] = [];
      let offset: number | null = 0;
      while (offset !== null && current) {
        const page: BoardList = await api<BoardList>(`/boards?offset=${offset}&limit=100`);
        list.push(...page.boards);
        offset = page.nextOffset;
      }
      if (current) {
        setBoards(list);
        setListProblem('');
      }
    }
    void load().catch(error => { if (current) setListProblem(error.message); });
    return () => { current = false; };
  }, [active, unlocked, attempt]);

  useEffect(() => {
    if (!active || !id) return;
    let current = true;
    void api<ProjectBoard>(`/boards/${encodeURIComponent(id)}`).then(board => {
      if (current) {
        setSnapshot(previous => previous?.id === board.id ? previous : board);
        setBoardProblem('');
      }
    }).catch(error => { if (current) setBoardProblem(error.message); });
    return () => { current = false; };
  }, [active, id, unlocked, attempt]);

  function reset() {
    setBoardProblem('');
    setSnapshot(undefined);
  }

  function remember(board: ProjectBoard) {
    setBoards(previous => [board, ...previous.filter(item => item.id !== board.id)]);
    setSnapshot(board);
    setBoardProblem('');
  }

  return {
    boards, board: snapshot?.id === id ? snapshot : undefined, problem: boardProblem || listProblem, reset, remember,
    retry() {
      setListProblem('');
      setBoardProblem('');
      setAttempt(value => value + 1);
    },
  };
}

export function NewProjectBoard({ onCreate }: { onCreate: (board: ProjectBoard) => void }) {
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState('');
  return <div className="board-empty project-start">
    <h1>New project board</h1>
    <form onSubmit={event => {
      event.preventDefault();
      if (!title.trim() || creating) return;
      setProblem('');
      setCreating(true);
      void api<ProjectBoard>('/boards', { title: title.trim() }).then(onCreate)
        .catch(error => setProblem(error.message)).finally(() => setCreating(false));
    }}>
      <label htmlFor="project-title">Board name</label>
      <input id="project-title" maxLength={96} required value={title} onChange={event => setTitle(event.target.value)} />
      <button type="submit" className="canvas-add-files" disabled={creating || !title.trim()}>
        {creating ? 'Creating board…' : 'Create board'}
      </button>
    </form>
    {problem && <p role="alert">{problem}</p>}
  </div>;
}

export function ProjectCanvas({ initial, theme, documents, onSource }: {
  initial: ProjectBoard;
  theme: 'light' | 'dark';
  documents: Document[];
  onSource: (citation: SourceSelection) => void;
}) {
  const board = useProjectBoard(initial);
  useSharedSelection(initial.id, board.savedRevision, board.session.selected, !board.saving && !board.issue);
  return <div ref={board.root}>
    <CanvasBoard seed={emptyScene} session={board.session} highlight={[]} theme={theme}
      importing={false} presenting={false} onInspect={ignoreProjectAction}
      empty={<div className="board-empty"><h1>{initial.title}</h1><p>Add an object to start this board.</p></div>}
      inspect={(card, link, close) => <CanvasInspector key={card?.id ?? link?.id}
        card={card} link={card ? undefined : link} session={board.session} documents={documents} onClose={close}
        onSource={onSource} onAsk={ignoreProjectAction} onExplore={ignoreProjectAction} onPin={ignoreProjectAction}
        projectBoardId={initial.id} savedRevision={board.savedRevision} />} />
    {board.issue ? <section className="canvas-error project-save-error" aria-label="Board save">
      <span role="alert">{board.conflict?.code === 'staleRevision'
        ? `Board changed to revision ${board.conflict.currentRevision}. Your draft is kept.`
        : `${board.conflict?.message ?? board.issue.message} Your draft is kept.`}</span>
      <div>
        {!board.conflict && <button type="button" onClick={board.retry}>Retry save</button>}
        <button type="button" onClick={board.downloadDraft}>Download draft</button>
        <button type="button" onClick={() => void board.discardDraft()}>Discard draft</button>
      </div>
    </section> : <span className="canvas-provider project-revision" role="status">
      {board.saving ? 'Saving board…' : board.disconnected ? 'Reconnecting to board…' : `Revision ${board.savedRevision}`}
    </span>}
  </div>;
}
