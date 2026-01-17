import { spawn, which } from "bun";

/**
 * Supported editors
 */
export type EditorName = "cursor" | "vscode" | "claude";

/**
 * Editor CLI commands
 * These are the standard CLI commands for each editor on macOS/Linux
 */
const EDITOR_COMMANDS: Record<EditorName, string> = {
  cursor: "cursor",
  vscode: "code",
  claude: "claude",
} as const;

/**
 * Check if an editor CLI is available in PATH
 * Uses Bun.which() - native API, faster than spawning `which` command
 */
export async function isEditorAvailable(editor: EditorName): Promise<boolean> {
  const cmd = EDITOR_COMMANDS[editor];
  const path = which(cmd);
  return path !== null;
}

/**
 * Open a folder in the specified editor
 * Uses Bun.spawn() - more explicit than shell template
 */
export async function openInEditor(editor: EditorName, folderPath: string): Promise<void> {
  const cmd = EDITOR_COMMANDS[editor];
  const proc = spawn([cmd, folderPath], {
    stdout: "inherit",
    stderr: "inherit",
  });
  await proc.exited;
}

/**
 * Get the display name for an editor
 */
export function getEditorDisplayName(editor: EditorName): string {
  const names: Record<EditorName, string> = {
    cursor: "Cursor",
    vscode: "VS Code",
    claude: "Claude Code",
  };
  return names[editor];
}
