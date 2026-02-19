import { spawn, which } from "bun";
import { $ } from "bun";
import type { AITool, AISession } from "../ai-tool.js";

/**
 * OpenCode AI tool implementation
 */
export class OpenCodeTool implements AITool {
  name = "opencode";

  async isAvailable(): Promise<boolean> {
    return which("opencode") !== null;
  }

  supportsSessionTracking(): boolean {
    return true;
  }

  async start(worktreePath: string, prompt: string, background: boolean): Promise<void> {
    const args = [worktreePath, "--prompt", prompt];

    if (!background) {
      // Interactive mode - attach to session
      const proc = spawn(["opencode", ...args], {
        cwd: worktreePath,
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });
      await proc.exited;
      return;
    }

    // Background mode - detach process
    const proc = spawn(["opencode", ...args], {
      cwd: worktreePath,
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
      detached: true,
    });

    // Unref so parent process can exit
    proc.unref();
  }

  async listSessions(): Promise<AISession[]> {
    const result = await $`opencode session list`.quiet().nothrow();
    if (result.exitCode !== 0) {
      return [];
    }

    const lines = result.text().trim().split("\n");
    const sessions: AISession[] = [];

    // Skip header (first 2 lines)
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim() === "") continue;

      // Parse table format: "Session ID    Title    Updated"
      // Session IDs start with "ses_"
      const match = line.match(/^(ses_\w+)\s+(.+?)\s{2,}(.+)$/);
      if (match) {
        sessions.push({
          id: match[1]!.trim(),
          title: match[2]!.trim(),
          directory: "", // Will be filled by findSessionForDirectory if needed
          lastUpdated: undefined, // Parse "Updated" string if needed
        });
      }
    }

    return sessions;
  }

  async findSessionForDirectory(directory: string): Promise<AISession | null> {
    const sessions = await this.listSessions();
    if (sessions.length === 0) {
      return null;
    }

    // Check each session to find one matching this directory
    for (const session of sessions) {
      try {
        const exportResult = await $`opencode export ${session.id}`.quiet().nothrow();
        if (exportResult.exitCode === 0) {
          const data = JSON.parse(exportResult.text());
          if (data.info?.directory === directory) {
            return {
              ...session,
              directory: data.info.directory,
            };
          }
        }
      } catch {
        // Skip sessions that can't be exported or parsed
        continue;
      }
    }

    return null;
  }

  async attachToSession(directory: string, sessionId?: string): Promise<void> {
    let args: string[];

    if (sessionId) {
      args = ["--continue", "--session", sessionId];
    } else {
      args = ["--continue"];
    }

    const proc = spawn(["opencode", directory, ...args], {
      cwd: directory,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });

    await proc.exited;
  }
}
