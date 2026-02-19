import { which } from "bun";
import type { BonsaiConfig } from "./config.js";

/**
 * AI Session metadata
 */
export interface AISession {
  id: string;
  directory: string;
  title?: string;
  lastUpdated?: Date;
}

/**
 * Abstract interface for AI coding assistants
 */
export interface AITool {
  name: string;

  /**
   * Check if this tool is available (installed and in PATH)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Start a new session with a prompt
   * @param worktreePath - Full path to worktree directory
   * @param prompt - User's prompt/task description
   * @param background - Whether to run in background (detached) or interactive
   */
  start(worktreePath: string, prompt: string, background: boolean): Promise<void>;

  /**
   * Whether this tool supports session tracking/management
   */
  supportsSessionTracking(): boolean;

  /**
   * List all sessions (optional - only if tool supports session tracking)
   */
  listSessions?(): Promise<AISession[]>;

  /**
   * Find the most recent session for a specific directory
   */
  findSessionForDirectory?(directory: string): Promise<AISession | null>;

  /**
   * Attach to an existing session (resume interactively)
   */
  attachToSession?(directory: string, sessionId?: string): Promise<void>;
}

/**
 * Factory function to create appropriate AI tool based on config
 */
export async function createAITool(toolConfig: BonsaiConfig["ai_tool"]): Promise<AITool | null> {
  if (!toolConfig || !toolConfig.name) {
    return null;
  }

  switch (toolConfig.name) {
    case "opencode": {
      const { OpenCodeTool } = await import("./ai-tools/opencode.js");
      return new OpenCodeTool();
    }
    case "claude": {
      const { ClaudeTool } = await import("./ai-tools/claude.js");
      return new ClaudeTool();
    }
    default:
      throw new Error(`Unknown AI tool: ${toolConfig.name}`);
  }
}

/**
 * Auto-detect available AI tools on the system
 */
export async function detectAvailableAITools(): Promise<string[]> {
  const tools: string[] = [];

  if (which("opencode")) {
    tools.push("opencode");
  }

  if (which("claude")) {
    tools.push("claude");
  }

  return tools;
}

/**
 * Get display name for an AI tool
 */
export function getAIToolDisplayName(toolName: string): string {
  const names: Record<string, string> = {
    opencode: "OpenCode",
    claude: "Claude Code",
  };
  return names[toolName] ?? toolName;
}

/**
 * Get installation URL for an AI tool
 */
export function getAIToolInstallURL(toolName: string): string {
  const urls: Record<string, string> = {
    opencode: "https://opencode.ai",
    claude: "https://claude.ai/download",
  };
  return urls[toolName] ?? "";
}
