import type { ShowcaseTrace } from "./trace-types";

const samples = {
  "computer-networks": { title: "Computer networks", format: "PDF", load: () => import("./traces/computer-networks.json") },
  "memory-and-learning": { title: "Memory and learning", format: "Markdown", load: () => import("./traces/memory-and-learning.json") },
  "retrieval-review": { title: "Retrieval review", format: "Markdown", load: () => import("./traces/retrieval-review.json") },
};

export type SampleId = keyof typeof samples;
export const sampleIds = Object.keys(samples) as SampleId[];
export const showcaseSamples = samples;

export async function loadSample(id: SampleId): Promise<ShowcaseTrace> {
  const source = await samples[id].load();
  // The exporter and backend tests validate the bundled JSON against this generated contract.
  return source.default as unknown as ShowcaseTrace;
}
