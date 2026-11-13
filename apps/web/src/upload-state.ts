import type { IngestionEvent } from "./types/contracts";
export type UploadState = {
  name: string;
  docId?: string;
  status:
    | "uploading"
    | "queued"
    | "chunking"
    | "extracting"
    | "done"
    | "failed";
  message: string;
  cursor: number;
};
export function updateUpload(
  state: UploadState,
  event: IngestionEvent,
): UploadState {
  if (event.id <= state.cursor) return state;
  if (state.status === "done" || state.status === "failed") return state;
  const status =
    event.type === "complete"
      ? "done"
      : event.type === "error"
        ? "failed"
        : (event.document?.status === "done"
            ? state.status
            : event.document?.status) || state.status;
  const batches =
    event.completedBatches !== undefined && event.totalBatches
      ? ` · ${event.completedBatches} of ${event.totalBatches} source batches`
      : "";
  return {
    ...state,
    docId: event.docId,
    status,
    cursor: event.id,
    message: (event.message || status) + batches,
  };
}
