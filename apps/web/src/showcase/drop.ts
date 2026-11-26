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

type SamplePointer = Pick<PointerEvent, "pointerId" | "clientX" | "clientY">;
type SamplePointerDown = SamplePointer & Pick<PointerEvent, "isPrimary" | "button" | "pointerType"> & {
  currentTarget: Pick<HTMLElement, "setPointerCapture">;
};

export function sampleTouchHandlers<Id extends string>(onDrag: (dragging: boolean) => void, onSample: (id: Id) => void) {
  let gesture: { sampleId: Id; start: SamplePointer; dragged: boolean } | null = null;
  let suppressClick = false;

  function reset() {
    if (!gesture) return;
    if (gesture.dragged) suppressClick = true;
    gesture = null;
    onDrag(false);
  }

  return {
    isActive: () => gesture !== null,
    reset,
    pointerDown(event: SamplePointerDown, sampleId: Id) {
      if (!event.isPrimary || event.button !== 0 || gesture) return;
      suppressClick = false;
      if (event.pointerType === "mouse") return;
      const { pointerId, clientX, clientY } = event;
      event.currentTarget.setPointerCapture(pointerId);
      gesture = { sampleId, start: { pointerId, clientX, clientY }, dragged: false };
    },
    pointerMove(event: SamplePointer) {
      if (!gesture || gesture.start.pointerId !== event.pointerId || gesture.dragged) return;
      const { clientX, clientY } = gesture.start;
      if (Math.hypot(event.clientX - clientX, event.clientY - clientY) <= 18) return;
      gesture.dragged = true;
      onDrag(true);
    },
    pointerUp(event: Pick<PointerEvent, "pointerId">) {
      if (!gesture || gesture.start.pointerId !== event.pointerId) return;
      const { dragged, sampleId } = gesture;
      reset();
      if (dragged) onSample(sampleId);
    },
    pointerCancel(event: Pick<PointerEvent, "pointerId">) {
      if (gesture?.start.pointerId === event.pointerId) reset();
    },
    click(event: Pick<MouseEvent, "detail">, sampleId: Id) {
      if (suppressClick && event.detail > 0) {
        suppressClick = false;
        return;
      }
      onSample(sampleId);
    },
  };
}
