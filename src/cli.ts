#!/usr/bin/env bun

import * as p from "@clack/prompts";
import pc from "picocolors";
import { readFileSync } from "fs";
import { join } from "path";

/** Injected at build time when compiling the release binary; undefined in dev */
declare const BONSAI_BUILD_VERSION: string | undefined;

/**
 * Version of this binary: from build inject (installed) or repo package.json (dev).
 * Never uses cwd so the reported version is always "this binary's version".
 */
function getVersion(): string {
  if (typeof BONSAI_BUILD_VERSION === "string" && BONSAI_BUILD_VERSION) {
    return BONSAI_BUILD_VERSION;
  }
  try {
    const packageJsonPath = join(import.meta.dir, "..", "package.json");
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    if (pkg.version) return pkg.version;
  } catch {
    // e.g. file moved or not in repo
  }
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
  ${pc.cyan("prune")} [branch]    Remove a worktree ${pc.dim("(alias: rm, remove)")}
  ${pc.cyan("list")}              List all worktrees ${pc.dim("(alias: ls)")}
  ${pc.cyan("agent")} <cmd>       AI workflow management ${pc.dim("(send, status)")}
  ${pc.cyan("switch")} <name>     Switch to a worktree ${pc.dim("(requires shell completions)")}
  ${pc.cyan("open")}              Open current worktree in configured editor ${pc.dim("(alias: bloom)")}
  ${pc.cyan("setup")}             Run setup commands in current worktree
  ${pc.cyan("config")}            Open config file in $EDITOR
  ${pc.cyan("completions")}       Generate shell completions
  ${pc.cyan("upgrade")}           Install or upgrade to latest release

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

  ${pc.dim("# Remove multiple worktrees (interactive selection)")}
  $ bonsai prune

  ${pc.dim("# Open current worktree in configured editor")}
  $ bonsai switch feature-auth && bonsai open

  ${pc.dim("# Re-run setup commands (e.g., after a failure)")}
  $ bonsai switch feature-auth && bonsai setup

  ${pc.dim("# AI workflow - dispatch work to worktrees")}
  $ bonsai agent send              ${pc.dim("(interactive picker)")}
  $ bonsai agent send feature-auth ${pc.dim("(direct)")}
  $ bonsai agent status            ${pc.dim("(show active sessions)")}

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

  if (command === "-v" || command === "--version" || command === "version") {
    showVersion();
    process.exit(0);
  }

  // Route commands (dynamic import so --version/--help never load config or git)
  switch (command) {
    case "init": {
      const { initCommand } = await import("./commands/init.js");
      await initCommand();
      break;
    }

    case "grow":
    case "add":
    case "new": {
      const branchName = args[1];
      if (!branchName) {
        p.cancel("Missing branch name. Usage: bonsai grow <branch-name>");
        process.exit(1);
      }
      const { growCommand } = await import("./commands/grow.js");
      await growCommand(branchName);
      break;
    }

    case "prune":
    case "rm":
    case "remove": {
      const branchName = args[1]; // Optional now
      const { pruneCommand } = await import("./commands/prune.js");
      await pruneCommand(branchName);
      break;
    }

    case "open":
    case "bloom": {
      const { openCommand } = await import("./commands/open.js");
      await openCommand();
      break;
    }

    case "setup": {
      const { setupCommand } = await import("./commands/setup.js");
      await setupCommand();
      break;
    }

    case "list":
    case "ls": {
      const { listCommand } = await import("./commands/list.js");
      await listCommand();
      break;
    }

    case "config": {
      const { configCommand } = await import("./commands/config.js");
      await configCommand();
      break;
    }

    case "completions": {
      const shell = args[1];
      const { completionsCommand } = await import("./commands/completions.js");
      await completionsCommand(shell);
      break;
    }

    case "upgrade": {
      const { upgradeCommand } = await import("./commands/upgrade.js");
      await upgradeCommand();
      break;
    }

    case "agent": {
      const { agentCommand } = await import("./commands/agent.js");
      await agentCommand(args.slice(1));
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
