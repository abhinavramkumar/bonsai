import * as p from "@clack/prompts";
import pc from "picocolors";
import { join } from "path";
import { findConfigForCwd } from "../lib/config.js";
import {
  removeWorktree,
  sanitizeBranchName,
  getWorktreeStatus,
  isWorktreeClean,
  listWorktrees,
  validateBranchName,
} from "../lib/git.js";

/**
 * Remove a worktree for a branch
 * @param branchName - The branch name to remove worktree for
 */
export async function pruneCommand(branchName: string): Promise<void> {
  p.intro(pc.bgRed(pc.white(" bonsai prune ")));

  if (!branchName) {
    p.cancel("Branch name is required. Usage: bonsai prune <branch-name>");
    process.exit(1);
  }

  // Validate branch name for safety (prevents argument injection)
  const validation = validateBranchName(branchName);
  if (!validation.valid) {
    p.cancel(`Invalid branch name: ${validation.error}`);
    process.exit(1);
  }

  // Load config
  const configResult = await findConfigForCwd();
  if (!configResult) {
    p.cancel(
      `No bonsai config found. Run ${pc.cyan("bonsai init")} first.`
    );
    process.exit(1);
  }

  const { config } = configResult;

  // Get worktree path
  const folderName = sanitizeBranchName(branchName);
  const worktreePath = join(config.repo.worktree_base, folderName);

  // Check if worktree exists
  const worktrees = await listWorktrees();
  if (!worktrees.includes(worktreePath)) {
    // Also check if the folder exists but isn't a worktree
    const folderExists = await Bun.file(join(worktreePath, ".git")).exists();
    if (!folderExists) {
      p.cancel(
        `Worktree not found: ${pc.dim(worktreePath)}\nMake sure the branch name is correct.`
      );
      process.exit(1);
    }
  }

  p.log.info(`Worktree: ${pc.dim(worktreePath)}`);

  // Check if worktree is clean
  const checkSpinner = p.spinner();
  checkSpinner.start("Checking for uncommitted changes");

  const isClean = await isWorktreeClean(worktreePath);
  const status = await getWorktreeStatus(worktreePath);

  checkSpinner.stop(isClean ? "Worktree is clean" : "Worktree has uncommitted changes");

  let forceDelete = false;

  if (!isClean) {
    // Show changed files
    p.log.warn(pc.yellow("Uncommitted changes detected:"));

    // Parse and display status
    // Git porcelain format: XY filename (where XY is 2-char status, then space, then filename)
    const lines = status.split("\n").filter(Boolean);
    const formattedLines = lines.map((line) => {
      // Status is first 2 chars, filename starts after the space at position 3
      const statusCode = line.slice(0, 2);
      const filePath = line.slice(3);

      let statusLabel: string;
      let color: (s: string) => string;

      // Check both characters - first is index status, second is worktree status
      const indexStatus = statusCode[0];
      const worktreeStatus = statusCode[1];
      const effectiveStatus = worktreeStatus !== " " ? worktreeStatus : indexStatus;

      switch (effectiveStatus) {
        case "M":
          statusLabel = "modified";
          color = pc.yellow;
          break;
        case "A":
          statusLabel = "added";
          color = pc.green;
          break;
        case "D":
          statusLabel = "deleted";
          color = pc.red;
          break;
        case "?":
          statusLabel = "untracked";
          color = pc.gray;
          break;
        case "R":
          statusLabel = "renamed";
          color = pc.blue;
          break;
        case "U":
          statusLabel = "unmerged";
          color = pc.magenta;
          break;
        default:
          statusLabel = statusCode.trim() || "changed";
          color = pc.white;
      }

      return `  ${color(statusLabel.padEnd(10))} ${filePath}`;
    });

    console.log(formattedLines.join("\n"));
    console.log();

    // Ask for confirmation
    const confirm = await p.confirm({
      message: `Force delete worktree with ${lines.length} uncommitted change(s)?`,
      initialValue: false,
    });

    if (p.isCancel(confirm)) {
      p.cancel("Prune cancelled.");
      process.exit(0);
    }

    if (!confirm) {
      p.cancel("Prune cancelled. Commit or stash your changes first.");
      process.exit(0);
    }

    forceDelete = true;
  }

  // Remove worktree
  const removeSpinner = p.spinner();
  removeSpinner.start("Removing worktree");

  try {
    await removeWorktree(worktreePath, forceDelete);
    removeSpinner.stop("Worktree removed");
  } catch (error) {
    removeSpinner.stop("Failed to remove worktree");
    p.cancel(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Summary
  p.note(
    [
      `${pc.dim("Branch:")} ${branchName}`,
      `${pc.dim("Path:")} ${worktreePath}`,
      forceDelete ? pc.yellow("Force deleted (had uncommitted changes)") : pc.green("Cleanly removed"),
    ].join("\n"),
    "Worktree pruned"
  );

  p.outro("Worktree successfully removed.");
}
