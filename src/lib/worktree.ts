import { $ } from "bun";
import { basename } from "path";
import { stat, readdir } from "fs/promises";
import type { AITool } from "./ai-tool.js";

/**
 * Worktree with additional context for display
 */
export interface WorktreeContext {
  path: string;
  name: string;
  branch: string;
  lastCommitMessage: string;
  lastCommitTime: Date;
  hasActiveSession: boolean;
}

/**
 * Get worktree information with context (branch, commit, session status)
 */
export async function getWorktreeWithContext(
  worktreePath: string,
  aiTool?: AITool | null
): Promise<WorktreeContext> {
  const name = basename(worktreePath);

  // Get current branch
  let branch = "unknown";
  try {
    const branchResult = await $`git -C ${worktreePath} branch --show-current`.quiet().nothrow();
    if (branchResult.exitCode === 0) {
      branch = branchResult.text().trim();
    }
  } catch {
    // Ignore error
  }

  // Get last commit message
  let lastCommitMessage = "";
  try {
    const logResult = await $`git -C ${worktreePath} log -1 --format=%s`.quiet().nothrow();
    if (logResult.exitCode === 0) {
      lastCommitMessage = logResult.text().trim();
    }
  } catch {
    // Ignore error
  }

  // Get last commit time
  let lastCommitTime = new Date(0);
  try {
    const timeResult = await $`git -C ${worktreePath} log -1 --format=%at`.quiet().nothrow();
    if (timeResult.exitCode === 0) {
      const timestamp = parseInt(timeResult.text().trim());
      if (!isNaN(timestamp)) {
        lastCommitTime = new Date(timestamp * 1000);
      }
    }
  } catch {
    // Ignore error
  }

  // Check for active session
  let hasActiveSession = false;
  if (aiTool && aiTool.supportsSessionTracking() && aiTool.findSessionForDirectory) {
    try {
      const session = await aiTool.findSessionForDirectory(worktreePath);
      hasActiveSession = session !== null;
    } catch {
      // Ignore error
    }
  }

  return {
    path: worktreePath,
    name,
    branch,
    lastCommitMessage,
    lastCommitTime,
    hasActiveSession,
  };
}

/**
 * Get all worktrees in a base directory with context
 */
export async function getAllWorktreesWithContext(
  worktreeBase: string,
  aiTool?: AITool | null
): Promise<WorktreeContext[]> {
  try {
    const entries = await readdir(worktreeBase);
    const worktrees: WorktreeContext[] = [];

    for (const entry of entries) {
      const path = `${worktreeBase}/${entry}`;

      try {
        const stats = await stat(path);
        if (stats.isDirectory()) {
          const context = await getWorktreeWithContext(path, aiTool);
          worktrees.push(context);
        }
      } catch {
        // Skip entries that can't be stat'd
        continue;
      }
    }

    // Sort by last commit time (most recent first)
    return worktrees.sort((a, b) => b.lastCommitTime.getTime() - a.lastCommitTime.getTime());
  } catch {
    return [];
  }
}

/**
 * Pick a worktree using fzf with rich context display
 * Returns null if user cancels
 */
export async function pickWorktreeWithFzf(worktrees: WorktreeContext[]): Promise<string | null> {
  if (worktrees.length === 0) {
    return null;
  }

  // Format for fzf display
  // Format: "name│branch│commit-message[🔴]"
  const fzfInput = worktrees
    .map((wt) => {
      const sessionIndicator = wt.hasActiveSession ? " 🔴" : "";
      // Truncate commit message to 50 chars
      const msg =
        wt.lastCommitMessage.length > 50
          ? wt.lastCommitMessage.slice(0, 47) + "..."
          : wt.lastCommitMessage;
      return `${wt.name}│${wt.branch}│${msg}${sessionIndicator}`;
    })
    .join("\n");

  // Write to temp file
  const tmpFile = `/tmp/bonsai-fzf-${Date.now()}.txt`;
  await Bun.write(tmpFile, fzfInput);

  try {
    // Run fzf
    const result = await $`cat ${tmpFile} | fzf \
      --height=60% \
      --reverse \
      --prompt="Select worktree: " \
      --delimiter="│" \
      --with-nth=1,2,3 \
      --preview="echo {2} && echo '' && echo {3}" \
      --preview-window=up:3:wrap`
      .quiet()
      .nothrow();

    // Cleanup
    await $`rm ${tmpFile}`.quiet().nothrow();

    if (result.exitCode !== 0) {
      return null; // User cancelled
    }

    // Extract worktree name (first column)
    const selected = result.text().trim().split("│")[0];
    if (!selected) {
      return null;
    }

    // Find the matching worktree
    const worktree = worktrees.find((wt) => wt.name === selected);
    return worktree?.path ?? null;
  } catch {
    // Cleanup on error
    await $`rm ${tmpFile}`.quiet().nothrow();
    return null;
  }
}
