import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Network, X, Trash2 } from "lucide-react";
import { api, apiFetch, remove } from "./client";
import { IconButton } from "./IconButton";
import type {
  Document,
  Citation,
  Chunk,
  ChunksResponse,
  GraphResponse,
  PageResponse,
} from "./types/contracts";
export function DocumentInspector({
  document,
  citation,
  graph,
  onClose,
  onScope,
  onKnowledge,
  onRemoved,
}: {
  document: Document;
  citation: Citation | null;
  graph: GraphResponse;
  onClose: () => void;
  onScope: () => void;
  onKnowledge: () => void;
  onRemoved: () => void;
}) {
  const [narrow, setNarrow] = useState(
    window.matchMedia("(max-width:700px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width:700px)");
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [chunks, setChunks] = useState<Chunk[]>([]),
    [page, setPage] = useState(citation?.page || 1),
    [text, setText] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const [metadata, setMetadata] = useState({
    pageCount: 1,
    chunkCount: 0,
    contentType: "",
  });
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener = globalThis.document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    let active = true;
    let blob = "";
    setChunks([]);
    setUrl("");
    setError("");
    setPage(citation?.page || 1);
    void api<ChunksResponse>(`/documents/${document.id}/chunks`)
      .then((result) => {
        if (active) setChunks(result.chunks);
      })
      .catch(() => {
        if (active) setError("Source passages could not be loaded.");
      });
    void api<typeof metadata>(`/documents/${document.id}/preview-metadata`)
      .then((value) => {
        if (active) setMetadata(value);
      })
      .catch(() => {});
    if (document.name.toLowerCase().endsWith(".pdf"))
      void apiFetch(`/documents/${document.id}/original`)
        .then(async (response) => {
          blob = URL.createObjectURL(await response.blob());
          if (active) setUrl(blob);
          else URL.revokeObjectURL(blob);
        })
        .catch(() => {
          if (active)
            setError(
              "The original PDF could not be opened. Exact extracted passages remain available.",
            );
        });
    return () => {
      active = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [document.id, citation?.page]);
  useEffect(() => {
    let active = true;
    setText("");
    void api<PageResponse>(`/documents/${document.id}/pages/${page}`)
      .then((value) => {
        if (active) setText(value.text);
      })
      .catch(() => {
        if (active) setText("No extracted text on this page.");
      });
    return () => {
      active = false;
    };
  }, [document.id, page]);
  const quote =
    citation?.quote || chunks.find((chunk) => chunk.page === page)?.text || "";
  const index = text.indexOf(quote);
  function keys(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab" || !window.matchMedia("(max-width:700px)").matches)
      return;
    const controls = Array.from(
      panel.current!.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input,a[href]",
      ),
    );
    const first = controls[0],
      last = controls.at(-1);
    if (
      event.shiftKey &&
      (globalThis.document.activeElement === first ||
        globalThis.document.activeElement === panel.current)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && globalThis.document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  return (
    <aside
      className="document-inspector"
      ref={panel}
      tabIndex={-1}
      aria-label="Document inspector"
      role={narrow ? "dialog" : undefined}
      aria-modal={narrow ? true : undefined}
      onKeyDown={keys}
    >
      <header>
        <span>Source document</span>
        <IconButton icon={X} label="Close inspector" onClick={onClose} />
      </header>
      <div className="inspector-title">
        <h2>{document.name}</h2>
        <p>
          {document.status} · {document.name.split(".").pop()?.toUpperCase()} ·{" "}
          {metadata.chunkCount} chunks · {metadata.pageCount} pages
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      {url && (
        <iframe
          title={`Original PDF page ${page}`}
          className="source-pdf"
          src={`${url}#page=${page}`}
        />
      )}
      <div className="page-controls">
        <IconButton
          icon={ChevronLeft}
          label="Previous page"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        />
        <span>
          {page} / {metadata.pageCount}
        </span>
        <IconButton
          icon={ChevronRight}
          label="Next page"
          disabled={page >= metadata.pageCount}
          onClick={() => setPage(page + 1)}
        />
      </div>
      <section className="inspector-quote">
        <h3>{citation ? "Cited passage" : "Source passage"}</h3>
        <blockquote>{quote}</blockquote>
        <details>
          <summary>Extracted page</summary>
          <pre>
            {quote && index >= 0 ? (
              <>
                {text.slice(0, index)}
                <mark>{quote}</mark>
                {text.slice(index + quote.length)}
              </>
            ) : (
              text
            )}
          </pre>
        </details>
      </section>
      <button className="inspect-knowledge" onClick={onScope}>
        Ask this document
      </button>
      <button className="inspect-knowledge" onClick={onKnowledge}>
        <Network size={16} />
        Explore{" "}
        {
          graph.nodes.filter((node) => node.docIds.includes(document.id)).length
        }{" "}
        associated concepts
      </button>
      <IconButton
        icon={Trash2}
        label="Remove document"
        onClick={() => setConfirm(true)}
      />
      {confirm && (
        <div className="confirmation">
          <p>
            Remove this source and its indexed passages? This cannot be undone.
          </p>
          <button
            onClick={() => {
              void remove(`/documents/${document.id}`)
                .then(onRemoved)
                .catch((value) => setError(String(value)));
            }}
          >
            Confirm removal
          </button>
          <button onClick={() => setConfirm(false)}>Keep source</button>
        </div>
      )}
    </aside>
  );
}
