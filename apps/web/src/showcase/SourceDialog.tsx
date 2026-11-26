import { useEffect, useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import type { Citation } from "../types/contracts";
import type { ShowcaseTrace } from "./trace-types";

export const repository = "https://github.com/stanbang/Grasp";

export function SourceDialog({ trace, citation, onClose }: { trace: ShowcaseTrace; citation: Citation; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);

  const page = trace.pages.find(source => source.page === citation.page);
  const chunk = trace.chunks.find(source => source.id === citation.chunkId);
  const quoteStart = chunk && chunk.charStart + Array.from(chunk.text.slice(0, chunk.text.indexOf(citation.quote))).length;
  const characters = Array.from(page?.text ?? "");
  const quoteEnd = quoteStart === undefined ? undefined : quoteStart + Array.from(citation.quote).length;
  const sourceHref = new URL(`${repository}/blob/showcase-overhaul/${trace.sourcePath}`);

  return <dialog className="source-dialog" aria-labelledby="source-title" ref={ref} onClose={onClose}>
    <header>
      <div><h2 id="source-title">{trace.title}</h2><p>{trace.fileName} · Page {citation.page}</p></div>
      <button type="button" aria-label="Close source" onClick={() => ref.current?.close()}><X size={19} /></button>
    </header>
    <blockquote>{citation.quote}</blockquote>
    <details open>
      <summary>Extracted page</summary>
      <pre>{quoteStart !== undefined && quoteEnd !== undefined ? <>
        {characters.slice(0, quoteStart).join("")}<mark>{characters.slice(quoteStart, quoteEnd).join("")}</mark>{characters.slice(quoteEnd).join("")}
      </> : page?.text}</pre>
    </details>
    <a href={sourceHref.toString()} target="_blank" rel="noreferrer">View the sample note in the repository <ArrowUpRight size={14} /></a>
  </dialog>;
}
