export const sampleTransferType = "application/x-grasp-showcase-sample";

export function dropKind(transfer: Pick<DataTransfer, "types">): "files" | "sample" | null {
  if (transfer.types.some(type => type.toLowerCase() === "files")) return "files";
  return transfer.types.includes(sampleTransferType) ? "sample" : null;
}

export function readDrop(transfer: Pick<DataTransfer, "types" | "getData">, knownSamples: readonly string[]) {
  const kind = dropKind(transfer);
  if (kind === "files") return { kind } as const;
  if (kind !== "sample") return null;
  const id = transfer.getData(sampleTransferType);
  return knownSamples.includes(id) ? { kind, id } as const : null;
}

export function installShowcaseDropHandlers<Id extends string>(target: EventTarget, known: readonly Id[], callbacks: {
  onDrag: (kind: ReturnType<typeof dropKind>) => void;
  onSample: (id: Id) => void;
  onRejectedFile: () => void;
}): () => void {
  function dragOver(event: Event) {
    const { dataTransfer } = event as DragEvent;
    if (!dataTransfer) return;
    const kind = dropKind(dataTransfer);
    if (!kind) return;
    event.preventDefault();
    dataTransfer.dropEffect = "copy";
    callbacks.onDrag(kind);
  }
  function drop(event: Event) {
    const { dataTransfer } = event as DragEvent;
    if (!dataTransfer || !dropKind(dataTransfer)) return;
    event.preventDefault();
    callbacks.onDrag(null);
    const dropped = readDrop(dataTransfer, known);
    if (dropped?.kind === "sample") callbacks.onSample(dropped.id as Id);
    else if (dropped?.kind === "files") callbacks.onRejectedFile();
  }
  function leave(event: Event) {
    if (!(event as DragEvent).relatedTarget) callbacks.onDrag(null);
  }
  target.addEventListener("dragover", dragOver);
  target.addEventListener("drop", drop);
  target.addEventListener("dragleave", leave);
  return () => {
    target.removeEventListener("dragover", dragOver);
    target.removeEventListener("drop", drop);
    target.removeEventListener("dragleave", leave);
  };
}
