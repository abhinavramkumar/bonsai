import { homedir } from "os";
import { join } from "path";
import { mkdir } from "fs/promises";

/**
 * Session entry in the registry
 */
export interface SessionEntry {
  worktreePath: string;
  worktreeName: string;
  prompt: string;
  startedAt: string; // ISO 8601 timestamp
  toolName: string; // "opencode" or "claude"
}

/**
 * Session registry - maps worktree path to session entry
 */
export interface SessionRegistry {
  [worktreePath: string]: SessionEntry;
}

/**
 * Get the path to the sessions registry file
 */
function getSessionsPath(): string {
  const configDir = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(configDir, "bonsai", "sessions.json");
}

/**
 * Load the session registry from disk
 */
export async function loadRegistry(): Promise<SessionRegistry> {
  const sessionsPath = getSessionsPath();

  try {
    const file = Bun.file(sessionsPath);
    if (!(await file.exists())) {
      return {};
    }

    const content = await file.text();
    return JSON.parse(content);
  } catch {
    // If corrupted, return empty registry
    return {};
  }
}

/**
 * Save the session registry to disk
 */
export async function saveRegistry(registry: SessionRegistry): Promise<void> {
  const sessionsPath = getSessionsPath();

  // Ensure directory exists
  const configDir = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  const bonsaiDir = join(configDir, "bonsai");
  await mkdir(bonsaiDir, { recursive: true });

  // Write with pretty formatting
  await Bun.write(sessionsPath, JSON.stringify(registry, null, 2));
}

/**
 * Track a new session in the registry
 */
export async function trackSession(entry: SessionEntry): Promise<void> {
  const registry = await loadRegistry();
  registry[entry.worktreePath] = entry;
  await saveRegistry(registry);
}

/**
 * Get session entry for a specific worktree
 */
export async function getSession(worktreePath: string): Promise<SessionEntry | null> {
  const registry = await loadRegistry();
  return registry[worktreePath] ?? null;
}

/**
 * Remove a session from the registry
 */
export async function removeSession(worktreePath: string): Promise<void> {
  const registry = await loadRegistry();
  delete registry[worktreePath];
  await saveRegistry(registry);
}

/**
 * Get all tracked sessions
 */
export async function getAllSessions(): Promise<SessionEntry[]> {
  const registry = await loadRegistry();
  return Object.values(registry);
}
