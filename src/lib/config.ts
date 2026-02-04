import { homedir } from "os";
import { join, basename, dirname } from "path";
import { mkdir } from "fs/promises";
import { parse, stringify } from "smol-toml";
import { $ } from "bun";

/**
 * Bonsai configuration structure
 */
export interface BonsaiConfig {
  repo: {
    path: string;
    worktree_base: string;
    /** Main branch name; new worktrees are created from latest of this branch. Defaults to "main" if missing in config. */
    main_branch: string;
  };
  editor: {
    name: "cursor" | "vscode" | "claude";
  };
  setup: {
    /** Array of shell commands to run after creating worktree */
    commands: string[];
  };
}

/**
 * Get XDG config directory (POSIX compliant)
 * Uses $XDG_CONFIG_HOME if set, otherwise falls back to ~/.config
 */
function getConfigDir(): string {
  return process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}

/**
 * Get bonsai config directory
 */
function getBonsaiConfigDir(): string {
  return join(getConfigDir(), "bonsai");
}

/**
 * Generate a slug from repo path for config filename
 * e.g., /Users/abhinav/Projects/Work/fermat -> fermat
 */
function getRepoSlug(repoPath: string): string {
  return basename(repoPath);
}

/**
 * Get config file path for a repo
 */
export function getConfigPath(repoPath: string): string {
  const slug = getRepoSlug(repoPath);
  return join(getBonsaiConfigDir(), `${slug}.toml`);
}

/**
 * Check if config exists for a repo
 */
export async function configExists(repoPath: string): Promise<boolean> {
  const configPath = getConfigPath(repoPath);
  return await Bun.file(configPath).exists();
}

/**
 * Load config for a repo
 * Returns null if config doesn't exist
 */
export async function loadConfig(repoPath: string): Promise<BonsaiConfig | null> {
  const configPath = getConfigPath(repoPath);
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  const parsed = parse(content) as unknown as Partial<BonsaiConfig> & {
    repo?: { path?: string; worktree_base?: string; main_branch?: string };
  };
  const repo = parsed.repo;
  return {
    ...parsed,
    repo: {
      path: repo?.path ?? "",
      worktree_base: repo?.worktree_base ?? "",
      main_branch: repo?.main_branch ?? "main",
    },
  } as BonsaiConfig;
}

/**
 * Save config for a repo
 * Creates the config directory if it doesn't exist
 */
export async function saveConfig(config: BonsaiConfig): Promise<void> {
  const configDir = getBonsaiConfigDir();
  const configPath = getConfigPath(config.repo.path);

  // Ensure config directory exists (native fs API, faster than shell)
  await mkdir(configDir, { recursive: true });

  const content = stringify(config);
  await Bun.write(configPath, content);
}

/**
 * Get the main repository path, even when called from a worktree
 * Uses --git-common-dir which points to the main repo's .git directory
 */
async function getMainRepoPath(): Promise<string | null> {
  const commonDir = await $`git rev-parse --git-common-dir`.quiet().nothrow();

  if (commonDir.exitCode !== 0) {
    return null;
  }

  const dir = commonDir.text().trim();

  if (dir === ".git") {
    // We're in the main repo, use --show-toplevel
    const toplevel = await $`git rev-parse --show-toplevel`.quiet().nothrow();
    if (toplevel.exitCode !== 0) {
      return null;
    }
    return toplevel.text().trim();
  }

  // We're in a worktree - dir is an absolute path like /path/to/main-repo/.git
  // The main repo is the parent of the .git directory
  return dirname(dir);
}

/**
 * Find config for current working directory
 * Works from both main repo and worktrees by using --git-common-dir
 */
export async function findConfigForCwd(): Promise<{
  config: BonsaiConfig;
  repoPath: string;
} | null> {
  const repoPath = await getMainRepoPath();

  if (!repoPath) {
    return null;
  }

  const config = await loadConfig(repoPath);

  if (!config) {
    return null;
  }

  return { config, repoPath };
}
