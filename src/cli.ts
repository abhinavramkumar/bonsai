#!/usr/bin/env bun

import * as p from "@clack/prompts";
import pc from "picocolors";
import { initCommand } from "./commands/init.js";
import { growCommand } from "./commands/grow.js";
import { pruneCommand } from "./commands/prune.js";
import { setupCommand } from "./commands/setup.js";
import { listCommand } from "./commands/list.js";
import { configCommand } from "./commands/config.js";
import { completionsCommand } from "./commands/completions.js";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Get version from package.json
 * Reads from project root (works in both dev and compiled binary contexts)
 */
function getVersion(): string {
  try {
    // Try to read from project root
    const packageJsonPath = join(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    if (pkg.version) {
      return pkg.version;
    }
  } catch {
    // Fallback if package.json can't be read
  }

  // Fallback version (should match package.json, but won't be used in normal operation)
  return "0.1.0";
}

const VERSION = getVersion();

/**
 * Display help message
 */
function showHelp(): void {
  console.log(`
${pc.bold("bonsai")} - Git worktree workflow CLI

${pc.dim("Carefully cultivate your branches")}

${pc.bold("Usage:")}
  bonsai <command> [options]

${pc.bold("Commands:")}
  ${pc.cyan("init")}              Initialize bonsai for current repository
  ${pc.cyan("grow")} <branch>     Create a worktree for a branch ${pc.dim("(alias: add, new)")}
  ${pc.cyan("prune")} <branch>    Remove a worktree ${pc.dim("(alias: rm, remove)")}
  ${pc.cyan("list")}              List all worktrees ${pc.dim("(alias: ls)")}
  ${pc.cyan("switch")} <name>     Switch to a worktree ${pc.dim("(requires shell completions)")}
  ${pc.cyan("setup")}             Run setup commands in current worktree
  ${pc.cyan("config")}            Open config file in $EDITOR
  ${pc.cyan("completions")}       Generate shell completions

${pc.bold("Options:")}
  ${pc.dim("-h, --help")}        Show this help message
  ${pc.dim("-v, --version")}     Show version number

${pc.bold("Examples:")}
  ${pc.dim("# Initialize bonsai in your repo")}
  $ bonsai init

  ${pc.dim("# Create a worktree for a new feature branch")}
  $ bonsai grow feature/user-auth

  ${pc.dim("# Create a worktree from an existing remote branch")}
  $ bonsai grow hotfix/critical-bug

  ${pc.dim("# Remove a worktree (checks for uncommitted changes)")}
  $ bonsai prune feature/user-auth

  ${pc.dim("# Re-run setup commands (e.g., after a failure)")}
  $ bonsai switch feature-auth && bonsai setup

${pc.bold("Config:")}
  Config is stored at ${pc.dim("$XDG_CONFIG_HOME/bonsai/<repo>.toml")}
  (defaults to ${pc.dim("~/.config/bonsai/<repo>.toml")})
`);
}

/**
 * Display version
 */
function showVersion(): void {
  console.log(`bonsai v${VERSION}`);
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Handle flags
  if (!command || command === "-h" || command === "--help") {
    showHelp();
    process.exit(0);
  }

  if (command === "-v" || command === "--version") {
    showVersion();
    process.exit(0);
  }

  // Route commands
  switch (command) {
    case "init":
      await initCommand();
      break;

    case "grow":
    case "add":
    case "new": {
      const branchName = args[1];
      if (!branchName) {
        p.cancel("Missing branch name. Usage: bonsai grow <branch-name>");
        process.exit(1);
      }
      await growCommand(branchName);
      break;
    }

    case "prune":
    case "rm":
    case "remove": {
      const branchName = args[1];
      if (!branchName) {
        p.cancel("Missing branch name. Usage: bonsai prune <branch-name>");
        process.exit(1);
      }
      await pruneCommand(branchName);
      break;
    }

    case "setup":
      await setupCommand();
      break;

    case "list":
    case "ls":
      await listCommand();
      break;

    case "config":
      await configCommand();
      break;

    case "completions": {
      const shell = args[1];
      await completionsCommand(shell);
      break;
    }

    case "switch":
      console.log(pc.yellow("The 'switch' command requires shell integration."));
      console.log();
      console.log("Add this to your shell config:");
      console.log(pc.cyan(`  eval "$(bonsai completions zsh)"`));
      console.log();
      console.log("Then you can use:");
      console.log(pc.cyan(`  bonsai switch <worktree-name>`));
      process.exit(1);

    default:
      console.error(pc.red(`Unknown command: ${command}`));
      console.log(`Run ${pc.cyan("bonsai --help")} for usage information.`);
      process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error(pc.red("Fatal error:"), error.message);
  process.exit(1);
});
