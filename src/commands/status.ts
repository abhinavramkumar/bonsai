import * as p from "@clack/prompts";
import pc from "picocolors";
import { findConfigForCwd } from "../lib/config.js";
import { createAITool } from "../lib/ai-tool.js";
import { getAllSessions, removeSession } from "../lib/sessions.js";
import type { SessionEntry } from "../lib/sessions.js";
import type { AISession } from "../lib/ai-tool.js";

/**
 * Enhanced session entry with AI tool session info
 */
interface EnhancedSessionEntry extends SessionEntry {
  aiSession: AISession | null;
  isActive: boolean;
}

/**
 * Status command options
 */
export interface StatusOptions {
  watch?: boolean; // Auto-refresh every few seconds
}

/**
 * Status command - show active AI sessions in a telescope-like interface
 */
export async function statusCommand(options?: StatusOptions): Promise<void> {
  // If watch mode, run in a loop with refresh
  if (options?.watch) {
    return watchStatusCommand();
  }

  p.intro(pc.bgMagenta(pc.black(" bonsai status ")));

  // Load config
  const configResult = await findConfigForCwd();
  if (!configResult) {
    p.cancel(`No bonsai config found. Run ${pc.cyan("bonsai init")} first.`);
    process.exit(1);
  }

  const { config } = configResult;

  // Load tracked sessions from registry
  const spinner = p.spinner();
  spinner.start("Loading sessions");

  const registrySessions = await getAllSessions();

  if (registrySessions.length === 0) {
    spinner.stop("No sessions found");
    p.log.info("No sessions tracked yet.");
    p.outro(`Run ${pc.cyan("bonsai send")} to dispatch work to a worktree.`);
    return;
  }

  // Create AI tool instance to check actual session status
  const aiTool = await createAITool(config.ai_tool);

  if (!aiTool) {
    spinner.stop("Loaded sessions");
    // Just show registry without live status
    displaySessionsSimple(registrySessions);
    return;
  }

  // Enrich sessions with AI tool status
  const enhancedSessions: EnhancedSessionEntry[] = [];

  for (const session of registrySessions) {
    let aiSession: AISession | null = null;
    let isActive = false;

    if (aiTool.supportsSessionTracking() && aiTool.findSessionForDirectory) {
      try {
        aiSession = await aiTool.findSessionForDirectory(session.worktreePath);
        isActive = aiSession !== null;
      } catch {
        // Ignore errors, mark as inactive
      }
    }

    enhancedSessions.push({
      ...session,
      aiSession,
      isActive,
    });
  }

  spinner.stop("Loaded sessions");

  // Display telescope-like interface
  await displaySessionsInteractive(enhancedSessions, aiTool.name);
}

/**
 * Display sessions in a simple table format (when AI tool doesn't support tracking)
 */
function displaySessionsSimple(sessions: SessionEntry[]): void {
  console.log();
  console.log(pc.bold(`Tracked Sessions (${sessions.length}):`));
  console.log();

  for (const session of sessions) {
    const startedAt = new Date(session.startedAt);
    const timeAgo = getTimeAgo(startedAt);

    console.log(`  ${pc.cyan("●")} ${pc.bold(session.worktreeName)}`);
    console.log(`    ${pc.dim("Prompt:")} ${session.prompt.split("\n")[0]}`);
    if (session.prompt.split("\n").length > 1) {
      console.log(`    ${pc.dim("(multi-line prompt)")}`);
    }
    console.log(`    ${pc.dim("Tool:")} ${session.toolName}`);
    console.log(`    ${pc.dim("Started:")} ${timeAgo}`);
    console.log();
  }

  p.outro(`Sessions tracked in registry. Live status not available.`);
}

/**
 * Display sessions in interactive telescope-like interface
 */
async function displaySessionsInteractive(
  sessions: EnhancedSessionEntry[],
  toolName: string
): Promise<void> {
  // Build options for select
  const options = sessions.map((session) => {
    const status = session.isActive ? pc.green("●") : pc.red("○");
    const timeAgo = getTimeAgo(new Date(session.startedAt));
    const promptPreview =
      session.prompt.length > 50 ? session.prompt.substring(0, 47) + "..." : session.prompt;

    return {
      value: session.worktreePath,
      label: `${status} ${session.worktreeName}`,
      hint: `${promptPreview} • ${timeAgo}`,
    };
  });

  // Add actions
  options.push(
    { value: "refresh", label: pc.dim("↻ Refresh"), hint: "Reload session status" },
    { value: "cleanup", label: pc.dim("🗑 Clean up stale"), hint: "Remove inactive sessions" }
  );

  console.log();
  console.log(
    `${pc.bold("Active Sessions")} (${sessions.filter((s) => s.isActive).length}/${sessions.length})`
  );
  console.log();

  const selected = await p.select({
    message: "Select a session for details (or action)",
    options,
  });

  if (p.isCancel(selected)) {
    p.outro("Cancelled");
    return;
  }

  // Handle actions
  if (selected === "refresh") {
    // Recursively call status command to refresh
    return statusCommand();
  }

  if (selected === "cleanup") {
    await cleanupStaleSessions(sessions);
    return statusCommand(); // Refresh after cleanup
  }

  // Show detailed view of selected session
  const session = sessions.find((s) => s.worktreePath === selected);
  if (session) {
    await showSessionDetail(session, toolName);

    // Ask what to do next
    const action = await p.select({
      message: "Actions",
      options: [
        { value: "back", label: "← Back to list" },
        { value: "remove", label: "Remove from tracking" },
        { value: "exit", label: "Exit" },
      ],
    });

    if (p.isCancel(action)) {
      p.outro("Cancelled");
      return;
    }

    if (action === "back") {
      return statusCommand(); // Show list again
    }

    if (action === "remove") {
      await removeSession(session.worktreePath);
      p.log.success(`Removed ${session.worktreeName} from tracking`);
      return statusCommand(); // Refresh list
    }

    p.outro("Done");
  }
}

/**
 * Show detailed view of a single session
 */
async function showSessionDetail(session: EnhancedSessionEntry, toolName: string): Promise<void> {
  const startedAt = new Date(session.startedAt);
  const timeAgo = getTimeAgo(startedAt);
  const status = session.isActive ? pc.green("Active") : pc.red("Inactive");

  // Use plain console.log instead of p.note to avoid box-drawing artifacts
  console.log();
  console.log(pc.bold(pc.underline("Session Details")));
  console.log();
  console.log(`  ${pc.dim("Worktree:")} ${pc.bold(session.worktreeName)}`);
  console.log(`  ${pc.dim("Path:")} ${session.worktreePath}`);
  console.log(`  ${pc.dim("Status:")} ${status}`);
  console.log(`  ${pc.dim("Tool:")} ${toolName}`);
  console.log(`  ${pc.dim("Started:")} ${startedAt.toLocaleString()} (${timeAgo})`);
  console.log();
  console.log(`  ${pc.dim("Prompt:")}`);
  console.log(`  ${session.prompt.split("\n").join("\n  ")}`);

  if (session.aiSession) {
    console.log();
    console.log(`  ${pc.dim("Session ID:")} ${session.aiSession.id}`);
    if (session.aiSession.title) {
      console.log(`  ${pc.dim("Title:")} ${session.aiSession.title}`);
    }
    if (session.aiSession.lastUpdated) {
      const updated =
        typeof session.aiSession.lastUpdated === "string"
          ? session.aiSession.lastUpdated
          : getTimeAgo(session.aiSession.lastUpdated);
      console.log(`  ${pc.dim("Last Updated:")} ${updated}`);
    }
  }
  console.log();
}

/**
 * Clean up sessions that are no longer active
 */
async function cleanupStaleSessions(sessions: EnhancedSessionEntry[]): Promise<void> {
  const staleSessions = sessions.filter((s) => !s.isActive);

  if (staleSessions.length === 0) {
    p.log.info("No stale sessions to clean up");
    return;
  }

  const confirm = await p.confirm({
    message: `Remove ${staleSessions.length} stale session(s) from tracking?`,
    initialValue: true,
  });

  if (p.isCancel(confirm) || !confirm) {
    return;
  }

  for (const session of staleSessions) {
    await removeSession(session.worktreePath);
  }

  p.log.success(`Removed ${staleSessions.length} stale session(s)`);
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Watch mode - continuously refresh session status
 */
async function watchStatusCommand(): Promise<void> {
  // Load config once
  const configResult = await findConfigForCwd();
  if (!configResult) {
    console.error(`No bonsai config found. Run ${pc.cyan("bonsai init")} first.`);
    process.exit(1);
  }

  const { config } = configResult;

  // Create AI tool instance
  const aiTool = await createAITool(config.ai_tool);
  if (!aiTool) {
    console.error(`Failed to initialize AI tool: ${config.ai_tool?.name}`);
    process.exit(1);
  }

  // Clear screen and show header
  const clearScreen = () => {
    process.stdout.write("\x1b[2J\x1b[H");
  };

  // Handle Ctrl+C gracefully
  let shouldExit = false;
  process.on("SIGINT", () => {
    shouldExit = true;
    console.log();
    console.log(pc.dim("Exiting watch mode..."));
    process.exit(0);
  });

  // Refresh loop
  while (!shouldExit) {
    clearScreen();

    // Show header
    console.log(pc.bold(pc.bgMagenta(pc.black(" bonsai status --watch "))));
    console.log();
    console.log(pc.dim(`Refreshing every 3 seconds... Press ${pc.bold("Ctrl+C")} to exit`));
    console.log();

    // Load sessions
    const registrySessions = await getAllSessions();

    if (registrySessions.length === 0) {
      console.log(pc.dim("No sessions tracked yet."));
      console.log(pc.dim(`Run ${pc.cyan("bonsai agent send")} to dispatch work to a worktree.`));
    } else {
      // Enrich sessions with AI tool status
      const enhancedSessions: EnhancedSessionEntry[] = [];

      for (const session of registrySessions) {
        let aiSession: AISession | null = null;
        let isActive = false;

        if (aiTool.supportsSessionTracking() && aiTool.findSessionForDirectory) {
          try {
            aiSession = await aiTool.findSessionForDirectory(session.worktreePath);
            isActive = aiSession !== null;
          } catch {
            // Ignore errors, mark as inactive
          }
        }

        enhancedSessions.push({
          ...session,
          aiSession,
          isActive,
        });
      }

      // Display summary
      const activeSessions = enhancedSessions.filter((s) => s.isActive);
      console.log(
        pc.bold(
          `Active Sessions: ${pc.green(activeSessions.length.toString())}/${enhancedSessions.length}`
        )
      );
      console.log();

      // Display each session
      for (const session of enhancedSessions) {
        const status = session.isActive ? pc.green("●") : pc.dim("○");
        const timeAgo = getTimeAgo(new Date(session.startedAt));
        const promptPreview =
          session.prompt.length > 60 ? session.prompt.substring(0, 57) + "..." : session.prompt;

        console.log(`${status} ${pc.bold(session.worktreeName)} ${pc.dim(`(${timeAgo})`)}`);
        console.log(`  ${pc.dim(promptPreview)}`);

        if (session.aiSession?.title) {
          console.log(`  ${pc.dim("Title:")} ${session.aiSession.title}`);
        }

        console.log();
      }
    }

    // Wait 3 seconds before next refresh
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
