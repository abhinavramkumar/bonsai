import * as p from "@clack/prompts";
import pc from "picocolors";
import { which } from "bun";
import { findConfigForCwd, getConfigPath } from "../lib/config.js";
import { EDITOR_COMMANDS } from "../lib/editor.js";

/**
 * Get the user's preferred editor
 * Checks $EDITOR, $VISUAL, then falls back to common editors
 */
function getEditor(): string {
  // Check environment variables
  if (process.env.EDITOR) return process.env.EDITOR;
  if (process.env.VISUAL) return process.env.VISUAL;

  // Try common editors in order of preference (using native Bun.which)
  const editors = ["code", "cursor", "vim", "nvim", "nano", "vi"];

  for (const editor of editors) {
    if (which(editor) !== null) {
      return editor;
    }
  }

  // Last resort
  return "vi";
}

/**
 * Open the config file in the user's editor
 */
export async function configCommand(): Promise<void> {
  p.intro(pc.bgMagenta(pc.white(" bonsai config ")));

  // Find config (works from both main repo and worktrees)
  const configResult = await findConfigForCwd();
  if (!configResult) {
    p.cancel(`No bonsai config found.\nRun ${pc.cyan("bonsai init")} first.`);
    process.exit(1);
  }

  const configPath = getConfigPath(configResult.repoPath);

  // Prefer bonsai config editor over $EDITOR / $VISUAL
  const editor: string = configResult.config.editor
    ? EDITOR_COMMANDS[configResult.config.editor.name]
    : getEditor();

  p.log.info(`Opening config in ${pc.cyan(editor)}`);
  p.log.info(pc.dim(configPath));

  // Open editor
  try {
    // Split editor command in case it has flags (e.g., "cursor --wait")
    const editorParts = editor.split(/\s+/);
    const proc = Bun.spawn([...editorParts, configPath], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      p.outro("Config saved.");
    } else {
      p.log.warn(`Editor exited with code ${exitCode}`);
      p.outro("Config may not have been saved.");
    }
  } catch (error) {
    p.cancel(`Could not open editor: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
