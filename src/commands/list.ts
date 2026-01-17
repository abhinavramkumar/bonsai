import * as p from "@clack/prompts";
import pc from "picocolors";
import { findConfigForCwd } from "../lib/config.js";
import { listWorktrees } from "../lib/git.js";
import { basename } from "path";

/**
 * List all worktrees for the current repository
 */
export async function listCommand(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" bonsai list ")));

  // Load config
  const configResult = await findConfigForCwd();
  if (!configResult) {
    p.cancel(
      `No bonsai config found. Run ${pc.cyan("bonsai init")} first.`
    );
    process.exit(1);
  }

  const { config } = configResult;

  // Get all worktrees
  const worktrees = await listWorktrees();

  // Filter to only show worktrees in the configured base directory
  const bonsaiWorktrees = worktrees.filter((wt) =>
    wt.startsWith(config.repo.worktree_base)
  );

  // Also show the main repo
  const mainRepo = worktrees.find((wt) => wt === config.repo.path);

  if (bonsaiWorktrees.length === 0) {
    p.log.info("No worktrees found.");
    p.log.info(`Run ${pc.cyan("bonsai grow <branch>")} to create one.`);
    p.outro("");
    return;
  }

  console.log();
  console.log(pc.bold(`Worktrees (${bonsaiWorktrees.length}):`));
  console.log();

  for (const wt of bonsaiWorktrees) {
    const name = basename(wt);
    // Convert folder name back to likely branch name (- to /)
    const likelyBranch = name.replace(/-/g, "/");
    console.log(`  ${pc.cyan("●")} ${pc.bold(name)}`);
    console.log(`    ${pc.dim(wt)}`);
  }

  if (mainRepo) {
    console.log();
    console.log(pc.dim(`Main repo: ${mainRepo}`));
  }

  p.outro(`Run ${pc.cyan("bonsai prune <branch>")} to remove a worktree.`);
}
