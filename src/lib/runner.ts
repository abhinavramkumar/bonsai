import { spawn } from "bun";

/**
 * Run a shell command with live streaming output to stdout
 * Inherits parent's TTY settings for proper color support
 * Uses set -e to fail fast on first error in compound commands
 */
export async function runCommandWithLogs(
  command: string,
  cwd: string
): Promise<{ success: boolean; exitCode: number }> {
  // Wrap with set -e to ensure compound commands (cmd1; cmd2) fail on first error
  const proc = spawn(["bash", "-c", `set -e; ${command}`], {
    cwd,
    stdout: "inherit", // Stream directly to parent stdout
    stderr: "inherit", // Stream directly to parent stderr
    env: {
      ...process.env,
      // Disable hyperlinks which cause underlines in some terminals
      // Yarn and npm use OSC 8 hyperlinks that show as underlines
      NO_HYPERLINKS: "1",
      TERM_PROGRAM: process.env.TERM_PROGRAM,
    },
  });

  const exitCode = await proc.exited;

  return { success: exitCode === 0, exitCode };
}
