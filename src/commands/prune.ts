import * as p from "@clack/prompts";
import pc from "picocolors";
import { join, basename } from "path";
import { stat } from "fs/promises";
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
 * Result of pruning a worktree
 */
interface PruneResult {
  worktreeName: string;
  success: boolean;
  forceDelete?: boolean;
  cancelled?: boolean;
  error?: string;
}

/**
 * Remove a worktree for a branch
 * @param branchName - The branch name to remove worktree for (optional, will show selection if not provided)
 */
export async function pruneCommand(branchName?: string): Promise<void> {
  p.intro(pc.bgRed(pc.white(" bonsai prune ")));

  // Load config first (needed for both single and multi-branch flows)
  const configResult = await findConfigForCwd();
  if (!configResult) {
    p.cancel(`No bonsai config found. Run ${pc.cyan("bonsai init")} first.`);
    process.exit(1);
  }

  const { config } = configResult;

  // If no branch name provided, show multi-select interface
  if (!branchName) {
    await pruneMultipleWorktrees(config);
    return;
  }

  // Validate branch name for safety (prevents argument injection)
  const validation = validateBranchName(branchName);
  if (!validation.valid) {
    p.cancel(`Invalid branch name: ${validation.error}`);
    process.exit(1);
  }

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
      forceDelete
        ? pc.yellow("Force deleted (had uncommitted changes)")
        : pc.green("Cleanly removed"),
    ].join("\n"),
    "Worktree pruned"
  );

  p.outro("Worktree successfully removed.");
}

/**
 * Show multi-select interface and prune multiple worktrees
 */
async function pruneMultipleWorktrees(config: any): Promise<void> {
  // Get all worktrees
  const worktrees = await listWorktrees();

  // Filter to only show worktrees in the configured base directory (like list command)
  const filtered = worktrees.filter((wt) => wt.startsWith(config.repo.worktree_base));

  // Sort by last activity (directory mtime, most recent first)
  const bonsaiWorktrees = await Promise.all(
    filtered.map(async (path) => {
      let mtimeMs = 0;
      try {
        const s = await stat(path);
        mtimeMs = s.mtimeMs;
      } catch {
        // Stale or missing path; keep at end
      }
      return { path, mtimeMs };
    })
  ).then((entries) => entries.sort((a, b) => b.mtimeMs - a.mtimeMs).map((e) => e.path));

  if (bonsaiWorktrees.length === 0) {
    p.log.info("No worktrees found.");
    p.log.info(`Run ${pc.cyan("bonsai grow <branch>")} to create one.`);
    p.outro("");
    return;
  }

  // Check status for each worktree to build selection options
  const statusSpinner = p.spinner();
  statusSpinner.start("Checking worktree status");

  const worktreeOptions = await Promise.all(
    bonsaiWorktrees.map(async (worktreePath) => {
      const name = basename(worktreePath);

      try {
        const isClean = await isWorktreeClean(worktreePath);
        const status = await getWorktreeStatus(worktreePath);

        let hint = "clean";
        if (!isClean) {
          const lines = status.split("\n").filter(Boolean);
          const count = lines.length;
          hint = `dirty (${count} file${count !== 1 ? "s" : ""})`;
        }

        return {
          value: worktreePath,
          label: name,
          hint: hint,
        };
      } catch (error) {
        // If we can't check status, still show it but mark as unknown
        return {
          value: worktreePath,
          label: name,
          hint: "status unknown",
        };
      }
    })
  );

  statusSpinner.stop("Status checked");

  // Show multi-select interface
  const selectedWorktrees = await p.multiselect({
    message: "Select worktrees to remove:",
    options: worktreeOptions,
  });

  if (p.isCancel(selectedWorktrees) || selectedWorktrees.length === 0) {
    p.cancel("No worktrees selected.");
    process.exit(0);
  }

  // Process each selected worktree
  const results: PruneResult[] = [];
  for (const worktreePath of selectedWorktrees) {
    await pruneSingleWorktree(worktreePath, basename(worktreePath), results);
  }

  // Show summary
  console.log();
  console.log(pc.bold("Summary:"));

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  if (successful > 0) {
    console.log(
      `${pc.green(`✓ Successfully removed ${successful} worktree${successful !== 1 ? "s" : ""}`)}`
    );
  }

  if (failed > 0) {
    console.log(`${pc.red(`✗ Failed to remove ${failed} worktree${failed !== 1 ? "s" : ""}`)}`);
  }

  p.outro(
    selectedWorktrees.length > 0 ? "Prune operation completed." : "No worktrees were removed."
  );
}

/**
 * Prune a single worktree (extracted from original logic)
 */
async function pruneSingleWorktree(
  worktreePath: string,
  worktreeName: string,
  results: PruneResult[]
): Promise<void> {
  console.log();
  console.log(pc.bold(`Processing: ${worktreeName}`));
  p.log.info(`Worktree: ${pc.dim(worktreePath)}`);

  try {
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
      const lines = status.split("\n").filter(Boolean);
      const formattedLines = lines.map((line) => {
        const statusCode = line.slice(0, 2);
        const filePath = line.slice(3);

        let statusLabel: string;
        let color: (s: string) => string;

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
        results.push({ worktreeName, success: false, cancelled: true });
        p.log.warn(`Skipped ${worktreeName} (cancelled)`);
        return;
      }

      if (!confirm) {
        results.push({ worktreeName, success: false, cancelled: true });
        p.log.warn(`Skipped ${worktreeName} (user declined)`);
        return;
      }

      forceDelete = true;
    }

    // Remove worktree
    const removeSpinner = p.spinner();
    removeSpinner.start("Removing worktree");

    await removeWorktree(worktreePath, forceDelete);
    removeSpinner.stop("Worktree removed");

    results.push({ worktreeName, success: true, forceDelete });
    p.log.success(`${worktreeName} removed${forceDelete ? " (forced)" : ""}`);
  } catch (error) {
    results.push({
      worktreeName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    p.log.error(
      `Failed to remove ${worktreeName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
