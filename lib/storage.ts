import type { Workspace } from "./types";

const KEY = "desk.workspaces";

function canUse() {
  return typeof window !== "undefined";
}

export function loadWorkspaces(): Workspace[] {
  if (!canUse()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Workspace[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWorkspaces(list: Workspace[]) {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertWorkspace(workspace: Workspace) {
  const list = loadWorkspaces();
  const index = list.findIndex((item) => item.id === workspace.id);
  const next =
    index === -1
      ? [workspace, ...list]
      : list.map((item) => (item.id === workspace.id ? workspace : item));
  saveWorkspaces(next);
  return next;
}

export function deleteWorkspace(id: string) {
  const next = loadWorkspaces().filter((item) => item.id !== id);
  saveWorkspaces(next);
  return next;
}

export function getWorkspace(id: string) {
  return loadWorkspaces().find((item) => item.id === id) ?? null;
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
