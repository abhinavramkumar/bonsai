import { spawn, which } from "bun";
import { homedir } from "os";
import { join } from "path";
import { readdir, stat } from "fs/promises";
import type { AITool, AISession } from "../ai-tool.js";

/**
 * Claude Code AI tool implementation
 */
export class ClaudeTool implements AITool {
  name = "claude";

  async isAvailable(): Promise<boolean> {
    return which("claude") !== null;
  }

  supportsSessionTracking(): boolean {
    return true;
  }

  async start(worktreePath: string, prompt: string, background: boolean): Promise<void> {
    if (!background) {
      // Interactive mode
      const proc = spawn(["claude", prompt], {
        cwd: worktreePath,
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });
      await proc.exited;
      return;
    }

    // Background mode - use shell wrapper to properly detach
    // Claude must be run from the target directory
    // Escape quotes in prompt
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    const shellCmd = `cd "${worktreePath}" && nohup claude "${escapedPrompt}" </dev/null >/dev/null 2>&1 &`;

    const proc = spawn(["bash", "-c", shellCmd], {
      detached: true,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });

    proc.unref();
  }

  async listSessions(): Promise<AISession[]> {
    const claudeDir = join(homedir(), ".claude", "projects");
    const sessions: AISession[] = [];

    try {
      const projects = await readdir(claudeDir);

      for (const projectDir of projects) {
        const projectPath = join(claudeDir, projectDir);

        try {
          const files = await readdir(projectPath);

          // Find .jsonl session files (UUID format)
          const sessionFiles = files.filter(
            (f) => f.endsWith(".jsonl") && f.match(/^[0-9a-f-]{36}\.jsonl$/)
          );

          // Decode directory path (Claude uses dashes instead of slashes, starting with -)
          const directory = this.decodeProjectPath(projectDir);

          for (const sessionFile of sessionFiles) {
            const sessionId = sessionFile.replace(".jsonl", "");
            const sessionPath = join(projectPath, sessionFile);

            try {
              const stats = await stat(sessionPath);

              sessions.push({
                id: sessionId.substring(0, 8), // Show first 8 chars for display
                directory,
                lastUpdated: stats.mtime,
              });
            } catch {
              // Skip sessions that can't be stat'd
              continue;
            }
          }
        } catch {
          // Skip projects that can't be read
          continue;
        }
      }

      // Sort by last updated (most recent first)
      return sessions.sort(
        (a, b) => (b.lastUpdated?.getTime() ?? 0) - (a.lastUpdated?.getTime() ?? 0)
      );
    } catch {
      return [];
    }
  }

  async findSessionForDirectory(directory: string): Promise<AISession | null> {
    const sessions = await this.listSessions();
    const matches = sessions.filter((s) => s.directory === directory);

    if (matches.length === 0) {
      return null;
    }

    // Return most recent session for this directory
    return matches[0]!;
  }

  async attachToSession(directory: string, sessionId?: string): Promise<void> {
    let args: string[];

    if (sessionId) {
      // Resume specific session (need full UUID, not truncated)
      // This is a limitation - we only store first 8 chars
      // For now, just use --continue which resumes most recent
      args = ["--continue"];
    } else {
      args = ["--continue"];
    }

    const proc = spawn(["claude", ...args], {
      cwd: directory,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });

    await proc.exited;
  }

  /**
   * Decode Claude's project directory path format
   * Claude uses: -Users-abhinav-Projects-... (leading dash, dashes for slashes)
   */
  private decodeProjectPath(projectDir: string): string {
    if (projectDir.startsWith("-")) {
      // Remove leading dash and replace remaining dashes with slashes
      return "/" + projectDir.slice(1).replace(/-/g, "/");
    }
    return projectDir;
  }
}
