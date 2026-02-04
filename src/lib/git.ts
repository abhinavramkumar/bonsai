import { $ } from "bun";
import { stat } from "fs/promises";

/**
 * Validation result for branch names
 */
export interface BranchValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a branch name for safety
 * Prevents argument injection (names starting with -) and invalid characters
 * @param branch - The branch name to validate
 * @returns Validation result with error message if invalid
 */
export function validateBranchName(branch: string): BranchValidationResult {
  if (!branch || branch.trim() === "") {
    return { valid: false, error: "Branch name cannot be empty" };
  }

  if (branch.startsWith("-")) {
    return {
      valid: false,
      error: "Branch name cannot start with '-' (would be interpreted as a git flag)",
    };
  }

  // Allow alphanumeric, dots, underscores, slashes, and hyphens (standard git branch chars)
  if (!/^[A-Za-z0-9._\/-]+$/.test(branch)) {
    return {
      valid: false,
      error: "Branch name contains invalid characters (allowed: letters, numbers, . _ / -)",
    };
  }

  // Disallow consecutive dots (git restriction)
  if (branch.includes("..")) {
    return { valid: false, error: "Branch name cannot contain '..'" };
  }

  // Disallow ending with .lock (git restriction)
  if (branch.endsWith(".lock")) {
    return { valid: false, error: "Branch name cannot end with '.lock'" };
  }

  return { valid: true };
}

/**
 * Check if we're inside a git repository
 */
export async function isGitRepo(): Promise<boolean> {
  const result = await $`git rev-parse --is-inside-work-tree`.quiet().nothrow();
  return result.exitCode === 0;
}

/**
 * Get the root path of the current git repository
 */
export async function getRepoRoot(): Promise<string | null> {
  const result = await $`git rev-parse --show-toplevel`.quiet().nothrow();
  if (result.exitCode !== 0) {
    return null;
  }
  return result.text().trim();
}

/**
 * Check if a branch exists (local or remote)
 */
export async function branchExists(branch: string): Promise<boolean> {
  // Check local branch
  const local = await $`git rev-parse --verify ${branch}`.quiet().nothrow();
  if (local.exitCode === 0) {
    return true;
  }

  // Check remote branch (origin)
  const remote = await $`git rev-parse --verify origin/${branch}`.quiet().nothrow();
  return remote.exitCode === 0;
}

/**
 * Check if a branch exists only on remote (not local)
 */
export async function isRemoteOnlyBranch(branch: string): Promise<boolean> {
  const local = await $`git rev-parse --verify ${branch}`.quiet().nothrow();
  const remote = await $`git rev-parse --verify origin/${branch}`.quiet().nothrow();
  return local.exitCode !== 0 && remote.exitCode === 0;
}

/**
 * Git operation error with structured information
 */
export class GitError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string
  ) {
    super(message);
    this.name = "GitError";
  }
}

/**
 * Detect which default main branch exists on remote (for init questionnaire default).
 * Tries origin/main, then origin/master.
 * @returns Short branch name (e.g. "main" or "master") or null if neither exists
 */
export async function getDefaultMainBranchName(): Promise<string | null> {
  for (const candidate of ["origin/main", "origin/master"]) {
    const ok = await $`git rev-parse --verify ${candidate}`.quiet().nothrow();
    if (ok.exitCode === 0) return candidate.replace("origin/", "");
  }
  return null;
}

export interface CreateWorktreeOptions {
  /** When creating a new branch, use this ref as start point (e.g. origin/main). Required when branch does not exist. */
  startPoint?: string;
}

/**
 * Create a worktree for a branch
 * - If branch exists (local or remote), attach to it
 * - If branch doesn't exist, create new branch from options.startPoint (must be provided)
 * @throws {GitError} If worktree creation fails
 */
export async function createWorktree(
  worktreePath: string,
  branch: string,
  options?: CreateWorktreeOptions
): Promise<void> {
  const exists = await branchExists(branch);
  const isRemoteOnly = await isRemoteOnlyBranch(branch);

  let result;
  if (isRemoteOnly) {
    // Track remote branch
    result = await $`git worktree add ${worktreePath} -b ${branch} origin/${branch}`
      .quiet()
      .nothrow();
  } else if (exists) {
    // Attach to existing local branch
    result = await $`git worktree add ${worktreePath} ${branch}`.quiet().nothrow();
  } else {
    const startPoint = options?.startPoint;
    if (!startPoint) {
      throw new GitError(
        "Cannot create new branch: main branch start point not configured. Run bonsai init and set the main branch.",
        -1,
        ""
      );
    }
    result = await $`git worktree add -b ${branch} ${worktreePath} ${startPoint}`.quiet().nothrow();
  }

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    throw new GitError(
      `Failed to create worktree: ${stderr || "unknown error"}`,
      result.exitCode,
      stderr
    );
  }
}

/**
 * Remove a worktree
 * @param force - Force removal even if worktree is dirty
 * @throws {GitError} If worktree removal fails
 */
export async function removeWorktree(worktreePath: string, force: boolean = false): Promise<void> {
  const result = force
    ? await $`git worktree remove --force ${worktreePath}`.quiet().nothrow()
    : await $`git worktree remove ${worktreePath}`.quiet().nothrow();

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    throw new GitError(
      `Failed to remove worktree: ${stderr || "unknown error"}`,
      result.exitCode,
      stderr
    );
  }
}

/**
 * Get the status of a worktree (uncommitted changes)
 * Returns empty string if clean, otherwise returns the porcelain status output
 * @throws {GitError} If status check fails (e.g., invalid path)
 */
export async function getWorktreeStatus(worktreePath: string): Promise<string> {
  const result = await $`git -C ${worktreePath} status --porcelain`.quiet().nothrow();
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    throw new GitError(
      `Failed to get worktree status: ${stderr || "unknown error"}`,
      result.exitCode,
      stderr
    );
  }
  return result.text().trim();
}

/**
 * Check if a worktree is clean (no uncommitted changes)
 */
export async function isWorktreeClean(worktreePath: string): Promise<boolean> {
  const status = await getWorktreeStatus(worktreePath);
  return status === "";
}

/**
 * List all worktrees for the current repo
 * @throws {GitError} If listing fails (e.g., not in a git repo)
 */
export async function listWorktrees(): Promise<string[]> {
  const result = await $`git worktree list --porcelain`.quiet().nothrow();
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    throw new GitError(
      `Failed to list worktrees: ${stderr || "unknown error"}`,
      result.exitCode,
      stderr
    );
  }

  const lines = result.text().split("\n");
  const worktrees: string[] = [];

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      worktrees.push(line.replace("worktree ", ""));
    }
  }

  return worktrees;
}

/**
 * Sanitize branch name for use as folder name
 * Converts slashes to dashes: feature/auth -> feature-auth
 */
export function sanitizeBranchName(branch: string): string {
  return branch.replace(/\//g, "-");
}

/**
 * Info about a worktree that has a branch checked out
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  exists: boolean; // Whether the worktree directory actually exists on disk
}

/**
 * Check if a directory exists on disk
 * Uses fs.stat which is faster than spawning a shell process
 */
async function directoryExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a branch is already checked out in any worktree
 * Returns info about the worktree if found, null otherwise
 */
export async function findWorktreeForBranch(branch: string): Promise<WorktreeInfo | null> {
  const result = await $`git worktree list --porcelain`.quiet().nothrow();
  if (result.exitCode !== 0) {
    return null;
  }

  const lines = result.text().split("\n");
  let currentPath: string | null = null;
  let currentBranch: string | null = null;

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      currentPath = line.replace("worktree ", "");
    } else if (line.startsWith("branch refs/heads/")) {
      currentBranch = line.replace("branch refs/heads/", "");

      // Check if this is the branch we're looking for
      if (currentBranch === branch && currentPath) {
        const exists = await directoryExists(currentPath);
        return { path: currentPath, branch: currentBranch, exists };
      }
    } else if (line === "") {
      // Reset for next worktree entry
      currentPath = null;
      currentBranch = null;
    }
  }

  return null;
}

/**
 * Prune stale worktree references (worktrees whose directories no longer exist)
 * @throws {GitError} If pruning fails
 */
export async function pruneStaleWorktrees(): Promise<void> {
  const result = await $`git worktree prune`.quiet().nothrow();
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    throw new GitError(
      `Failed to prune stale worktrees: ${stderr || "unknown error"}`,
      result.exitCode,
      stderr
    );
  }
}

/**
 * Fetch latest from remote
 * @throws {GitError} If fetch fails (e.g., network error, no remote)
 */
export async function fetchRemote(): Promise<void> {
  const result = await $`git fetch --all --prune`.quiet().nothrow();
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    throw new GitError(
      `Failed to fetch from remote: ${stderr || "unknown error"}`,
      result.exitCode,
      stderr
    );
  }
}
