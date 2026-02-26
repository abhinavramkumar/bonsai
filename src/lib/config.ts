import { homedir } from "os";
import { join, basename, dirname } from "path";
import { mkdir, readdir } from "fs/promises";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { parse, stringify } from "smol-toml";
import { $ } from "bun";
import type { EditorName } from "./editor.ts";

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
    name: EditorName;
  };
  setup: {
    /** Array of shell commands to run after creating worktree */
    commands: string[];
  };
  /** When true, shell integration will cd to the new worktree after \`bonsai grow\` (terminal stays in current dir when false). */
  behavior?: {
    navigate_after_grow?: boolean;
    /**
     * What to do after creating a new worktree via `bonsai grow`:
     * 0 = open editor (legacy default for existing configs)
     * 1 = do nothing (new default for fresh installs)
     */
    post_creation_action?: 0 | 1;
  };
}

/**
 * Preset defaults for optional config keys. Add new keys here when introducing
 * new options; they will be merged into existing configs non-destructively
 * (only missing keys are added, existing values are never overwritten).
 */
/** Optional keys only; used for non-destructive merge into existing configs. */
export const DEFAULT_CONFIG = {
  repo: { main_branch: "main" },
  editor: { name: "cursor" },
  setup: { commands: [] },
  behavior: {
    navigate_after_grow: false,
    post_creation_action: 1, // 0 = open editor, 1 = do nothing
  },
} as unknown as Partial<BonsaiConfig>;

/**
 * Migration defaults for existing configs. This is used to set legacy defaults
 * for configs that existed before new options were introduced. For example,
 * post_creation_action defaults to 0 (open editor) for existing configs to
 * preserve the old behavior, but defaults to 1 (do nothing) for new configs.
 */
export const MIGRATION_DEFAULTS = {
  behavior: {
    post_creation_action: 0, // 0 = open editor (preserve legacy behavior)
  },
} as unknown as Partial<BonsaiConfig>;

/**
 * Deep-merge default values into target. Only sets keys that are missing
 * (undefined); never overwrites existing values. Mutates target.
 */
function defaultsDeep(
  target: Record<string, unknown>,
  defaults: Record<string, unknown>,
  changed: { value: boolean }
): void {
  for (const key of Object.keys(defaults)) {
    const def = defaults[key];
    const cur = target[key];
    if (cur === undefined) {
      target[key] =
        def !== null && typeof def === "object" && !Array.isArray(def) ? { ...def } : def;
      changed.value = true;
    } else if (
      cur !== null &&
      typeof cur === "object" &&
      !Array.isArray(cur) &&
      def !== null &&
      typeof def === "object" &&
      !Array.isArray(def)
    ) {
      defaultsDeep(cur as Record<string, unknown>, def as Record<string, unknown>, changed);
    }
  }
}

/**
 * Merge preset defaults into a partial config. Returns full config and whether
 * any keys were added (so caller can persist).
 * @param parsed - The partial config to merge into
 * @param isMigration - If true, merge MIGRATION_DEFAULTS first (for existing configs)
 */
export function mergeConfigWithDefaults(
  parsed: Partial<BonsaiConfig> & Record<string, unknown>,
  isMigration = false
): {
  config: BonsaiConfig;
  updated: boolean;
} {
  const changed = { value: false };
  const merged = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;

  // For existing configs (migrations), apply migration defaults first to preserve legacy behavior
  if (isMigration) {
    defaultsDeep(merged, MIGRATION_DEFAULTS as Record<string, unknown>, changed);
  }

  // Then apply standard defaults for any still-missing keys
  defaultsDeep(merged, DEFAULT_CONFIG as Record<string, unknown>, changed);
  return {
    config: merged as unknown as BonsaiConfig,
    updated: changed.value,
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
 * Load config for a repo. Merges in preset defaults for any missing keys and
 * writes back if anything was added (non-destructive upgrade).
 * Returns null if config doesn't exist.
 */
export async function loadConfig(repoPath: string): Promise<BonsaiConfig | null> {
  const configPath = getConfigPath(repoPath);
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  const parsed = parse(content) as unknown as Partial<BonsaiConfig> & Record<string, unknown>;
  const { config, updated } = mergeConfigWithDefaults(parsed, true);
  if (updated) {
    await saveConfigToPath(configPath, config);
  }
  return config;
}

/**
 * Save config for a repo
 * Creates the config directory if it doesn't exist
 */
export async function saveConfig(config: BonsaiConfig): Promise<void> {
  const configDir = getBonsaiConfigDir();
  const configPath = getConfigPath(config.repo.path);
  await saveConfigToPath(configPath, config);
}

/**
 * Save config to a specific path. Used when merging defaults into all configs.
 */
export async function saveConfigToPath(path: string, config: BonsaiConfig): Promise<void> {
  const configDir = getBonsaiConfigDir();
  await mkdir(configDir, { recursive: true });
  const content = stringify(config);
  await Bun.write(path, content);
}

/**
 * Load raw config from a file path (for merging defaults into all configs).
 */
export async function loadConfigFromPath(
  path: string
): Promise<(Partial<BonsaiConfig> & Record<string, unknown>) | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return null;
  }
  const content = await file.text();
  const parsed = parse(content) as unknown as Partial<BonsaiConfig> & Record<string, unknown>;
  return parsed;
}

/**
 * List all bonsai config file paths (~/.config/bonsai/*.toml).
 */
export async function listAllConfigPaths(): Promise<string[]> {
  const dir = getBonsaiConfigDir();
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".toml"))
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

/** list all config file paths for merge. */
function listAllConfigPathsSync(): string[] {
  const dir = getBonsaiConfigDir();
  try {
    const names = readdirSync(dir, { withFileTypes: true });
    return names
      .filter((e) => e.isFile() && e.name.endsWith(".toml"))
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

/** load configuration from a path for merge. */
function loadConfigFromPathSync(
  path: string
): (Partial<BonsaiConfig> & Record<string, unknown>) | null {
  try {
    if (!existsSync(path)) return null;
    const content = readFileSync(path, "utf-8");
    return parse(content) as unknown as Partial<BonsaiConfig> & Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Sync write for merge (avoids async hang in upgrade path). */
function saveConfigToPathSync(path: string, config: BonsaiConfig): void {
  const configDir = getBonsaiConfigDir();
  mkdirSync(configDir, { recursive: true });
  const content = stringify(config);
  writeFileSync(path, content, "utf-8");
}

/**
 * Merge preset defaults into every existing config file. Non-destructive:
 * only adds missing keys. Call after upgrade so new defaults are applied.
 * Uses sync I/O so it completes immediately and never hangs on async fs.
 * Skips files that don't look like a valid bonsai config (missing repo.path).
 * Ignores write errors (e.g. EPERM) so upgrade can still exit.
 */
export async function mergeDefaultsIntoAllConfigs(): Promise<void> {
  const paths = listAllConfigPathsSync();
  for (const configPath of paths) {
    try {
      const parsed = loadConfigFromPathSync(configPath);
      if (!parsed?.repo?.path) continue;
      const { config, updated } = mergeConfigWithDefaults(parsed, true);
      if (updated && config.repo?.path) {
        saveConfigToPathSync(configPath, config);
      }
    } catch {
      // Skip if we can't read or write (e.g. permissions); don't block upgrade
    }
  }
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
