import * as p from "@clack/prompts";
import pc from "picocolors";
import { join } from "path";
import { findConfigForCwd } from "../lib/config.js";
import {
  createWorktree,
  sanitizeBranchName,
  branchExists,
  isRemoteOnlyBranch,
  fetchRemote,
  validateBranchName,
  findWorktreeForBranch,
  pruneStaleWorktrees,
} from "../lib/git.js";
import { openInEditor, getEditorDisplayName } from "../lib/editor.js";
import { runCommandWithLogs } from "../lib/runner.js";

/**
 * Create a new worktree for a branch
 * @param branchName - The branch name to create worktree for
 */
export async function growCommand(branchName: string): Promise<void> {
  p.intro(pc.bgGreen(pc.black(" bonsai grow ")));

  if (!branchName) {
    p.cancel("Branch name is required. Usage: bonsai grow <branch-name>");
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
    p.cancel(`No bonsai config found. Run ${pc.cyan("bonsai init")} first.`);
    process.exit(1);
  }

  const { config } = configResult;

  // Sanitize branch name for folder
  const folderName = sanitizeBranchName(branchName);
  const worktreePath = join(config.repo.worktree_base, folderName);

  // Check if worktree folder already exists
  const folderExists = await Bun.file(worktreePath).exists();
  if (folderExists) {
    p.cancel(
      `Worktree folder already exists: ${pc.dim(worktreePath)}\nUse a different branch name or remove the existing worktree.`
    );
    process.exit(1);
  }

  // Show what we're about to do
  p.log.info(`Branch: ${pc.cyan(branchName)}`);
  p.log.info(`Folder: ${pc.dim(worktreePath)}`);

  // Fetch latest from remote
  const fetchSpinner = p.spinner();
  fetchSpinner.start("Fetching latest from remote");
  try {
    await fetchRemote();
    fetchSpinner.stop("Fetched latest from remote");
  } catch {
    fetchSpinner.stop("Could not fetch from remote (continuing anyway)");
  }

  // Check if branch exists
  const exists = await branchExists(branchName);
  const isRemote = await isRemoteOnlyBranch(branchName);

  const mainBranch = config.repo.main_branch ?? "main";

  if (exists) {
    if (isRemote) {
      p.log.info(`Tracking remote branch: ${pc.cyan(`origin/${branchName}`)}`);
    } else {
      p.log.info(`Using existing local branch: ${pc.cyan(branchName)}`);
    }
  } else {
    p.log.info(`Creating new branch ${pc.cyan(branchName)} from latest ${pc.cyan(mainBranch)}`);
  }

  // Check if branch is already checked out in another worktree
  const existingWorktree = await findWorktreeForBranch(branchName);
  if (existingWorktree) {
    if (existingWorktree.exists) {
      // Worktree exists - user needs to handle it
      p.cancel(
        `Branch ${pc.cyan(branchName)} is already checked out at:\n` +
          `  ${pc.dim(existingWorktree.path)}\n\n` +
          `Either use that worktree or check out a different branch there first.`
      );
      process.exit(1);
    } else {
      // Stale worktree reference - offer to prune
      p.log.warn(
        `Branch ${pc.cyan(branchName)} has a stale worktree reference at:\n` +
          `  ${pc.dim(existingWorktree.path)} ${pc.red("(directory no longer exists)")}`
      );

      const shouldPrune = await p.confirm({
        message: "Prune stale worktree references and continue?",
        initialValue: true,
      });

      if (p.isCancel(shouldPrune) || !shouldPrune) {
        p.cancel("Cancelled. Run `git worktree prune` manually to clean up stale references.");
        process.exit(0);
      }

      const pruneSpinner = p.spinner();
      pruneSpinner.start("Pruning stale worktree references");
      try {
        await pruneStaleWorktrees();
        pruneSpinner.stop("Pruned stale worktree references");
      } catch (error) {
        pruneSpinner.stop("Failed to prune");
        p.cancel(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }
  }

  // Create worktree
  const createSpinner = p.spinner();
  createSpinner.start("Creating worktree");

  const startPoint = `origin/${mainBranch}`;

  try {
    await createWorktree(worktreePath, branchName, { startPoint });
    createSpinner.stop("Worktree created");
  } catch (error) {
    createSpinner.stop("Failed to create worktree");
    p.cancel(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const setupCommands = config.setup.commands || [];
  const editorName = config.editor.name;
  const editorDisplayName = getEditorDisplayName(editorName);

  // Open editor immediately (don't wait for setup)
  const editorSpinner = p.spinner();
  editorSpinner.start(`Opening ${editorDisplayName}`);

  try {
    await openInEditor(editorName, worktreePath);
    editorSpinner.stop(`Opened ${editorDisplayName}`);
  } catch {
    editorSpinner.stop(`Could not open ${editorDisplayName}`);
    p.log.warn(
      `${pc.yellow("Warning:")} Could not open editor. You can manually open: ${pc.dim(worktreePath)}`
    );
  }

  // Summary (before setup so user knows worktree is ready)
  p.note(
    [
      `${pc.dim("Branch:")} ${branchName}`,
      `${pc.dim("Path:")} ${worktreePath}`,
      `${pc.dim("Editor:")} ${editorDisplayName}`,
    ].join("\n"),
    "Worktree created"
  );

  // Run setup commands if configured
  let setupFailed = false;

  if (setupCommands.length > 0) {
    console.log();
    console.log(
      pc.bgYellow(pc.black(" SETUP RUNNING ")) +
        pc.yellow(` ${setupCommands.length} command(s) - please wait...`)
    );
    console.log(pc.dim(`Working directory: ${worktreePath}`));
    console.log();

    for (let i = 0; i < setupCommands.length; i++) {
      const cmd = setupCommands[i]!;
      console.log(
        pc.cyan(`━━━ [${i + 1}/${setupCommands.length}] `) + pc.bold(cmd) + pc.cyan(` ━━━`)
      );
      console.log();

      const result = await runCommandWithLogs(cmd, worktreePath);

      console.log();
      if (result.success) {
        console.log(pc.green(`✓ Command completed successfully`));
      } else {
        console.log(pc.red(`✗ Command failed with exit code ${result.exitCode}`));
        setupFailed = true;

        // Stop on first failure
        if (i < setupCommands.length - 1) {
          console.log();
          console.log(
            pc.yellow(`Stopping setup. ${setupCommands.length - i - 1} command(s) remaining.`)
          );
          console.log(pc.dim(`Run ${pc.cyan(`bonsai setup`)} from the worktree to retry.`));
        }
        break;
      }
      console.log();
    }

    // Final setup status
    console.log();
    if (setupFailed) {
      console.log(
        pc.bgRed(pc.white(" SETUP FAILED ")) +
          ` Run ${pc.cyan("bonsai setup")} in the worktree to retry.`
      );
    } else {
      console.log(pc.bgGreen(pc.black(" SETUP COMPLETE ")) + " Your worktree is ready!");
    }
  }

  // When shell integration runs grow with BONSAI_NAVIGATE_FILE set, write path so shell can cd (if behavior.navigate_after_grow)
  const navFile = process.env.BONSAI_NAVIGATE_FILE;
  if (navFile && config.behavior?.navigate_after_grow) {
    await Bun.write(navFile, worktreePath);
  }

  p.outro(`Happy coding! Run ${pc.cyan(`bonsai prune ${branchName}`)} when done.`);
}
