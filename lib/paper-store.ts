import type { PaperState } from "./paper-types";
import seed from "./paper-state.json";

const g = globalThis as unknown as { __paper?: PaperState };

export function setPaper(data: PaperState) {
  g.__paper = data;
}

export function getPaper(): PaperState {
  return g.__paper ?? (seed as PaperState);
}
