import * as p from "@clack/prompts";
import pc from "picocolors";

/**
 * Agent command - manages AI workflows
 * Routes to subcommands: send, status
 */
export async function agentCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === "-h" || subcommand === "--help") {
    showAgentHelp();
    process.exit(0);
  }

  switch (subcommand) {
    case "send":
    case "dispatch":
    case "delegate": {
      // Parse options and worktree name from remaining args
      const remainingArgs = args.slice(1);
      const worktreeName = remainingArgs.find(
        (arg) => !arg.startsWith("--") && !arg.startsWith("-")
      );
      const options = {
        edit: remainingArgs.includes("--edit"),
        attach: remainingArgs.includes("--attach"),
        follow: remainingArgs.includes("--follow") || remainingArgs.includes("-f"),
      };

      const { sendCommand } = await import("./send.js");
      await sendCommand(worktreeName, options);
      break;
    }

    case "status":
    case "list": {
      const remainingArgs = args.slice(1);
      const options = {
        watch: remainingArgs.includes("--watch") || remainingArgs.includes("-w"),
      };

      const { statusCommand } = await import("./status.js");
      await statusCommand(options);
      break;
    }

    default:
      p.cancel(
        `Unknown agent subcommand: ${pc.cyan(subcommand)}\n\nRun ${pc.cyan("bonsai agent --help")} for usage.`
      );
      process.exit(1);
  }
}

/**
 * Show help for agent command
 */
function showAgentHelp(): void {
  console.log(`
${pc.bold("bonsai agent")} - AI workflow management

${pc.dim("Dispatch work to worktrees and manage AI sessions")}

${pc.bold("Usage:")}
  bonsai agent <subcommand> [options]

${pc.bold("Subcommands:")}
  ${pc.cyan("send")} [worktree]     Dispatch work to a worktree with AI ${pc.dim("(aliases: dispatch, delegate)")}
  ${pc.cyan("status")}              Show active AI sessions ${pc.dim("(aliases: list)")}

${pc.bold("Options:")}
  ${pc.dim("-h, --help")}          Show this help message

${pc.bold("Examples:")}
  ${pc.dim("# Interactive worktree picker → prompt → background")}
  $ bonsai agent send

  ${pc.dim("# Direct worktree selection")}
  $ bonsai agent send feature-auth

  ${pc.dim("# Multi-line prompt via $EDITOR")}
  $ bonsai agent send feature-auth --edit

  ${pc.dim("# Interactive mode (not background)")}
  $ bonsai agent send feature-auth --attach

  ${pc.dim("# Background with live output")}
  $ bonsai agent send feature-auth --follow

  ${pc.dim("# Show active AI sessions (telescope UI)")}
  $ bonsai agent status

  ${pc.dim("# Watch mode - auto-refresh status every 3 seconds")}
  $ bonsai agent status --watch

${pc.bold("Send Options:")}
  ${pc.dim("--edit")}              Open $EDITOR for multi-line prompt
  ${pc.dim("--attach")}            Run in interactive mode instead of background
  ${pc.dim("-f, --follow")}        Tail log file after dispatching (background mode only)

${pc.bold("Status Options:")}
  ${pc.dim("-w, --watch")}         Auto-refresh status every 3 seconds

${pc.bold("AI Tools Supported:")}
  - OpenCode (https://opencode.ai)
  - Claude Code (https://claude.ai/download)

${pc.bold("Setup:")}
  Run ${pc.cyan("bonsai init")} to configure your AI tool, or manually edit config:
  
  ${pc.dim("~/.config/bonsai/<repo>.toml")}
  ${pc.dim("[ai_tool]")}
  ${pc.dim('name = "opencode"  # or "claude"')}

${pc.bold("Learn More:")}
  See ${pc.cyan("docs/AI_WORKFLOW.md")} for complete documentation.
`);
}
