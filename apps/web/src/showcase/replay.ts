import type { ShowcaseStage } from "./trace-types";

export const stages = {
  pages: { title: "Read the pages", caption: "The document opens into its source pages.", duration: 1900 },
  text: { title: "Extract the text", caption: "The extracted text is the reference for every source quote.", duration: 2700 },
  chunks: { title: "Find passage boundaries", caption: "Chunks keep their page and character offsets. Overlap carries text across boundaries.", duration: 3400 },
  embeddings: { title: "Index the chunks", caption: "Each chunk has a mock embedding. Its projected position makes it drawable.", duration: 2700 },
  concepts: { title: "Extract concepts", caption: "The offline extractor uses source headings and links each concept to its chunks.", duration: 2800 },
  links: { title: "Connect the concepts", caption: "The links in this mock run follow the order of concepts in the note.", duration: 2300 },
  ready: { title: "Explore the map", caption: "Select a star or ask a question to find a passage.", duration: 0 },
} satisfies Record<ShowcaseStage["kind"], { title: string; caption: string; duration: number }>;

export const speeds = [0.5, 1, 2] as const;
export type Speed = typeof speeds[number];
export type Playback = { step: number; run: number; playing: boolean; speed: Speed; reduced: boolean };

type PlaybackAction =
  | { type: "restart" | "toggle" | "step" | "skip" }
  | { type: "setSpeed"; speed: Speed }
  | { type: "setMotion"; reduced: boolean };

export const finalStep = Object.keys(stages).length - 1;

export function playbackState(reduced: boolean): Playback {
  return { step: 0, run: 0, playing: false, speed: 1, reduced };
}

export function reducePlayback(state: Playback, action: PlaybackAction): Playback {
  switch (action.type) {
    case "restart": return { ...state, step: 0, run: state.run + 1, playing: !state.reduced };
    case "skip": return { ...state, step: finalStep, playing: false };
    case "toggle": return state.reduced || state.step === finalStep ? state : { ...state, playing: !state.playing };
    case "step": {
      const step = Math.min(state.step + 1, finalStep);
      return { ...state, step, playing: step < finalStep && state.playing };
    }
    case "setSpeed": return { ...state, speed: action.speed };
    case "setMotion": return { ...state, reduced: action.reduced, playing: !action.reduced && state.playing };
  }
}

export function playbackDelay(state: Playback, stage: ShowcaseStage["kind"], elapsed = 0): number | null {
  return state.playing && !state.reduced && state.step < finalStep ? Math.max(0, stages[stage].duration - elapsed) / state.speed : null;
}
