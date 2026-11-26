import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../client';
import type { CanvasAssetRef, ProjectAsset } from '../types/canvas-contracts';
import { assetPath } from './project-assets';

const indexStatus = {
  queued: 'Waiting to index', chunking: 'Reading the document', extracting: 'Indexing the document',
  done: 'Indexed in Knowledge', failed: 'Text indexing failed',
};

export function ProjectAssetDetails({ boardId, source, onPage }: {
  boardId: string;
  source: CanvasAssetRef;
  onPage: (page: number) => void;
}) {
  const path = assetPath(boardId, source.assetId);
  const [asset, setAsset] = useState<ProjectAsset>();
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let current = true;
    let timer: number | undefined;
    async function load() {
      try {
        const result = await api<ProjectAsset>(path);
        if (!current) return;
        setAsset(result);
        if (result.indexStatus && ['queued', 'chunking', 'extracting'].includes(result.indexStatus)) {
          timer = window.setTimeout(load, 1600);
        }
      } catch (error) {
        if (current) setProblem(error instanceof Error ? error.message : 'Could not read the asset.');
      }
    }
    void load();
    return () => { current = false; window.clearTimeout(timer); };
  }, [path]);

  async function share(shared: boolean) {
    if (!asset) return;
    setSaving(true);
    setProblem('');
    setAsset({ ...asset, shared });
    try {
      setAsset(await api<ProjectAsset>(`${path}/sharing`, { shared }, 'PUT'));
    } catch (error) {
      setAsset(current => current && { ...current, shared: asset.shared });
      setProblem(error instanceof Error ? error.message : 'Could not change asset sharing.');
    } finally {
      setSaving(false);
    }
  }

  const pdf = asset?.mediaType === 'application/pdf';
  const page = source.page ?? 1;
  const original = `/api${path}/original${pdf ? `#page=${page}` : ''}`;
  return <section className="board-asset-details" aria-label="Source asset">
    {asset && <>
      {asset.width && asset.height ? <p>{asset.width} × {asset.height} px</p> : null}
      {asset.indexStatus && <p>{indexStatus[asset.indexStatus]}</p>}
      {asset.available ? <>
        {pdf && <label>PDF page
          <select value={page} onChange={event => onPage(Number(event.target.value))}>
            {Array.from({ length: asset.pageCount ?? 1 }, (_, index) => index + 1)
              .map(number => <option key={number} value={number}>{number}</option>)}
          </select>
        </label>}
        <a className="board-inspector-action" target="_blank" rel="noreferrer" href={original}>
          {pdf ? 'Open PDF page' : 'Open original'} <ArrowUpRight size={15} aria-hidden />
        </a>
        <label className="board-asset-sharing">
          <input type="checkbox" checked={asset.shared} disabled={saving}
            onChange={event => void share(event.currentTarget.checked)} />
          Share this asset with the agent on this board
        </label>
      </> : <p>The original file is unavailable.</p>}
    </>}
    {!asset && !problem && <p role="status">Loading asset…</p>}
    {problem && <p role="alert">{problem}</p>}
  </section>;
}
