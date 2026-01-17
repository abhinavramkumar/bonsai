import * as p from "@clack/prompts";
import pc from "picocolors";
import { findConfigForCwd } from "../lib/config.js";
import { runCommandWithLogs } from "../lib/runner.js";

/**
 * Run setup commands on the current worktree
 * Useful for retrying after a failed setup or setting up an existing worktree
 */
export async function setupCommand(): Promise<void> {
  p.intro(pc.bgBlue(pc.white(" bonsai setup ")));

  // Load config
  const configResult = await findConfigForCwd();
  if (!configResult) {
    p.cancel(
      `No bonsai config found. Run ${pc.cyan("bonsai init")} first.`
    );
    process.exit(1);
  }

  const { config } = configResult;
  const setupCommands = config.setup.commands || [];

  if (setupCommands.length === 0) {
    p.log.warn("No setup commands configured.");
    p.log.info(`Edit your config to add commands: ${pc.dim("~/.config/bonsai/<repo>.toml")}`);
    p.outro("Nothing to run.");
    return;
  }

  // Get current directory as the worktree path
  const worktreePath = process.cwd();

  console.log();
  console.log(pc.bold(`Running ${setupCommands.length} setup command(s)...`));
  console.log(pc.dim(`Working directory: ${worktreePath}`));
  console.log();

  let allSucceeded = true;

  for (let i = 0; i < setupCommands.length; i++) {
    const cmd = setupCommands[i]!;
    console.log(pc.cyan(`━━━ [${i + 1}/${setupCommands.length}] `) + pc.bold(cmd) + pc.cyan(` ━━━`));
    console.log();

    const result = await runCommandWithLogs(cmd, worktreePath);

    console.log();
    if (result.success) {
      console.log(pc.green(`✓ Command completed successfully`));
    } else {
      console.log(pc.red(`✗ Command failed with exit code ${result.exitCode}`));
      allSucceeded = false;

      // Stop on first failure
      if (i < setupCommands.length - 1) {
        console.log();
        console.log(pc.yellow(`Stopping setup. ${setupCommands.length - i - 1} command(s) remaining.`));
        console.log(pc.dim(`Fix the issue and run ${pc.cyan("bonsai setup")} again to retry.`));
      }
      break;
    }
    console.log();
  }

  if (allSucceeded) {
    p.outro(pc.green("Setup completed successfully!"));
  } else {
    p.outro(pc.red("Setup failed. Fix the issue and retry."));
    process.exit(1);
  }
}
