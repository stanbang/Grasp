import { useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '../client';
import type { ProjectAsset } from '../types/canvas-contracts';
import type { AuthoredCard, Point } from './board';
import { placeProjectAssets, projectCard } from './project-board';
import type { BoardSession } from './use-board';

export type ImportMethod = 'picker' | 'drop' | 'paste';
export type ImportAssets = (files: File[], method: ImportMethod, position: Point) => void;
type ImportItem = { name: string; message: string; failed?: boolean; retryable?: boolean };
type PendingImport = { file: File; method: ImportMethod; collectionId: string; position: number; anchor: Point };
const maxFiles = 30;

export function assetPath(boardId: string, assetId: string): string {
  return `/boards/${encodeURIComponent(boardId)}/assets/${encodeURIComponent(assetId)}`;
}

function assetCard(asset: ProjectAsset, title: string, anchor: Point): AuthoredCard {
  const dimension = Math.max(asset.width ?? 1, asset.height ?? 1);
  const width = asset.width ? Math.max(132, asset.width / dimension * 340 + 20) : 228;
  const height = asset.height ? Math.max(96, asset.height / dimension * 340 + 38) : 116;
  return projectCard({
    id: crypto.randomUUID(), kind: asset.kind, title: title.trim().slice(0, 96) || asset.name.slice(0, 96),
    placement: {
      x: Math.max(-1_000_000, Math.min(1_000_000, anchor.x)),
      y: Math.max(-1_000_000, Math.min(1_000_000, anchor.y)),
      width, height,
    },
    asset: { assetId: asset.id, page: asset.pageCount != null ? 1 : undefined },
    sizing: 'manual', createdBy: 'user', updatedBy: 'user',
  });
}

export function useProjectAssets(boardId: string, session: BoardSession) {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [working, setWorking] = useState(false);
  const pending = useRef<PendingImport[]>([]);
  const active = useRef<AbortController>();
  const latest = useRef(session);
  latest.current = session;

  useEffect(() => () => active.current?.abort(), []);

  async function upload(entries: PendingImport[]) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setWorking(true);
    const placements: AuthoredCard[] = [];
    function feedback(position: number, message: string, failed = false, retryable = false) {
      if (!controller.signal.aborted) setItems(current => current.map(
        (item, index) => index === position ? { ...item, message, failed, retryable } : item,
      ));
    }
    for (const entry of entries) {
      const { file, collectionId, method, position, anchor } = entry;
      if (controller.signal.aborted) break;
      feedback(position, 'Uploading…');
      try {
        const body = new FormData();
        body.append('file', file);
        const query = new URLSearchParams({ collectionId, position: String(position), method });
        const response = await apiFetch(`/boards/${encodeURIComponent(boardId)}/assets?${query}`,
          { method: 'POST', body, signal: controller.signal });
        const asset = await response.json() as ProjectAsset;
        if (!asset.available) {
          feedback(position, 'The original is unavailable. Import the file again.', true);
          continue;
        }
        placements.push(assetCard(asset, file.name, { x: anchor.x, y: anchor.y + position * 24 }));
        feedback(position, 'Uploaded');
      } catch (error) {
        const retryable = !(error instanceof ApiError) || error.status === 429 || error.status >= 500;
        feedback(position, error instanceof Error ? error.message : 'Could not upload the file.', true, retryable);
      }
    }
    if (!controller.signal.aborted) {
      latest.current.update(board => placeProjectAssets(board, placements));
      setWorking(false);
    }
    active.current = undefined;
  }

  const importFiles: ImportAssets = (files, method, anchor) => {
    if (!files.length) return;
    if (active.current) {
      setItems(current => [...current, ...files.map(file => ({
        name: file.name, message: 'Wait for the current import, then add this file again.', failed: true,
      }))]);
      return;
    }
    const collectionId = crypto.randomUUID();
    pending.current = files.slice(0, maxFiles).map((file, position) => ({ file, collectionId, position, method, anchor }));
    setItems(files.map((file, index) => index < maxFiles ? { name: file.name, message: 'Waiting to upload' }
      : { name: file.name, message: `Import up to ${maxFiles} files at a time.`, failed: true }));
    void upload(pending.current);
  };

  return {
    importFiles, items, working,
    retry(index: number) { const entry = pending.current[index]; if (entry) void upload([entry]); },
    dismiss() { pending.current = []; setItems([]); },
  };
}
