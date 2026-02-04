import * as p from "@clack/prompts";
import pc from "picocolors";
import { findConfigForCwd } from "../lib/config.js";
import { getEditorDisplayName, openInEditor } from "../lib/editor.js";
import { getRepoRoot } from "../lib/git.js";

/**
 * Open the current worktree (or main repo) in the configured editor
 */
export async function openCommand(): Promise<void> {
  const toplevel = await getRepoRoot();
  if (!toplevel) {
    p.cancel("Not inside a git repository.");
    process.exit(1);
  }

  const configResult = await findConfigForCwd();
  if (!configResult) {
    p.cancel(`No bonsai config found.\nRun ${pc.cyan("bonsai init")} first.`);
    process.exit(1);
  }

  const editorName = configResult.config.editor.name;
  const editorDisplayName = getEditorDisplayName(editorName);

  try {
    await openInEditor(editorName, toplevel);
    p.outro(`Opened ${editorDisplayName}`);
  } catch (error) {
    p.cancel(`Could not open editor: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
