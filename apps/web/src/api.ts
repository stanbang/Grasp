import type { HealthResponse, SampleResponse, SchemasResponse } from "./types/contracts";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    throw new Error(`The API returned ${response.status}. Check the API terminal and try again.`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => getJson<HealthResponse>("/health"),
  sample: () => getJson<SampleResponse>("/samples/study-note"),
  schemas: () => getJson<SchemasResponse>("/schemas"),
};
