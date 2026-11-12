import { create } from "zustand";
import { api } from "./api";
import type { HealthResponse, SampleResponse, SchemaDescription } from "./types/contracts";

export type Panel = "source" | "contracts" | "status" | null;
type LoadState = "idle" | "loading" | "ready" | "error";

interface WorkspaceState {
  panel: Panel;
  returnFocusTo: HTMLElement | null;
  health: HealthResponse | null;
  healthState: LoadState;
  sample: SampleResponse | null;
  sampleState: LoadState;
  sampleError: string;
  schemas: SchemaDescription[];
  schemasState: LoadState;
  schemasError: string;
  selectedSchema: string;
  setPanel: (panel: Panel) => void;
  selectSchema: (name: string) => void;
  loadHealth: () => Promise<void>;
  loadSample: () => Promise<void>;
  loadSchemas: () => Promise<void>;
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed. Check the API and try again.";
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  panel: null,
  returnFocusTo: null,
  health: null,
  healthState: "idle",
  sample: null,
  sampleState: "idle",
  sampleError: "",
  schemas: [],
  schemasState: "idle",
  schemasError: "",
  selectedSchema: "GraphNode",
  setPanel: (panel) => {
    if (panel) {
      const active = document.activeElement;
      const returnFocusTo = get().panel ? get().returnFocusTo
        : active instanceof HTMLElement ? active : null;
      set({ panel, returnFocusTo });
    } else {
      const opener = get().returnFocusTo;
      set({ panel: null, returnFocusTo: null });
      // The canvas becomes visible after React commits the panel change.
      requestAnimationFrame(() => opener?.focus());
    }
  },
  selectSchema: (selectedSchema) => set({ selectedSchema }),
  loadHealth: async () => {
    if (get().healthState === "loading") return;
    set({ healthState: "loading" });
    try {
      set({ health: await api.health(), healthState: "ready" });
    } catch {
      set({ health: null, healthState: "error" });
    }
  },
  loadSample: async () => {
    get().setPanel("source");
    if (get().sampleState === "ready" || get().sampleState === "loading") return;
    set({ sampleState: "loading", sampleError: "" });
    try {
      set({ sample: await api.sample(), sampleState: "ready" });
    } catch (error) {
      set({ sampleState: "error", sampleError: readableError(error) });
    }
  },
  loadSchemas: async () => {
    get().setPanel("contracts");
    if (get().schemasState === "ready" || get().schemasState === "loading") return;
    set({ schemasState: "loading", schemasError: "" });
    try {
      set({ schemas: (await api.schemas()).schemas, schemasState: "ready" });
    } catch (error) {
      set({ schemasState: "error", schemasError: readableError(error) });
    }
  },
}));
