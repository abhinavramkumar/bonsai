import * as p from "@clack/prompts";
import pc from "picocolors";
import { join, basename } from "path";
import { spawn } from "bun";
import { stat } from "fs/promises";
import { findConfigForCwd } from "../lib/config.js";
import { createAITool, getAIToolDisplayName, getAIToolInstallURL } from "../lib/ai-tool.js";
import { trackSession } from "../lib/sessions.js";
import { getAllWorktreesWithContext, pickWorktreeWithFzf } from "../lib/worktree.js";

/**
 * Options for send command
 */
export interface SendOptions {
  edit?: boolean; // Open $EDITOR for multi-line prompt
  attach?: boolean; // Attach interactively instead of background
}

/**
 * Template for editor prompt input
 */
const EDITOR_TEMPLATE = `# Task for {worktreeName}
# 
# Enter your prompt below. Lines starting with # are ignored.
# 
# Example prompts:
#   - Add unit tests for the authentication module
#   - Refactor the API client to use async/await
#   - Fix the bug where users can't log out
#   - Update documentation for the new feature

`;

/**
 * Get prompt from user via $EDITOR
 */
async function getPromptFromEditor(worktreeName: string): Promise<string | null> {
  const template = EDITOR_TEMPLATE.replace("{worktreeName}", worktreeName);
  const tmpFile = `/tmp/bonsai-prompt-${Date.now()}.md`;

  // Write template to temp file
  await Bun.write(tmpFile, template);

  // Open in $EDITOR
  const editor = process.env.EDITOR || process.env.VISUAL || "vim";
  const editorArgs = editor.split(/\s+/);
  const editorCmd = editorArgs[0]!;
  const editorFlags = editorArgs.slice(1);

  const proc = spawn([editorCmd, ...editorFlags, tmpFile], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  await proc.exited;

  // Read the result
  const file = Bun.file(tmpFile);
  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();

  // Parse out comments and empty lines
  const lines = content.split("\n");
  const promptLines = lines.filter((line) => !line.trim().startsWith("#") && line.trim() !== "");

  const prompt = promptLines.join("\n").trim();

  // Cleanup
  try {
    await Bun.$`rm ${tmpFile}`.quiet();
  } catch {
    // Ignore cleanup errors
  }

  return prompt || null;
}

/**
 * Send/dispatch command - dispatch work to a worktree with AI coding assistant
 * @param worktreeName - Optional worktree name (skips picker if provided)
 * @param options - Command options
 */
export async function sendCommand(worktreeName?: string, options?: SendOptions): Promise<void> {
  p.intro(pc.bgGreen(pc.black(" bonsai send ")));

  // Load config
  const configResult = await findConfigForCwd();
  if (!configResult) {
    p.cancel(`No bonsai config found. Run ${pc.cyan("bonsai init")} first.`);
    process.exit(1);
  }

  const { config } = configResult;

  // Check if AI tool is configured
  if (!config.ai_tool || !config.ai_tool.name) {
    p.cancel(
      `No AI tool configured.\n\n` +
        `Run ${pc.cyan("bonsai init")} to set up an AI coding assistant,\n` +
        `or manually edit your config to add ${pc.cyan("ai_tool")} section.`
    );
    process.exit(1);
  }

  // Create AI tool instance
  const aiTool = await createAITool(config.ai_tool);
  if (!aiTool) {
    p.cancel(`Failed to initialize AI tool: ${config.ai_tool.name}`);
    process.exit(1);
  }

  const toolDisplayName = getAIToolDisplayName(aiTool.name);

  // Check if tool is available
  if (!(await aiTool.isAvailable())) {
    const installUrl = getAIToolInstallURL(aiTool.name);
    p.cancel(
      `${toolDisplayName} is not installed or not in PATH.\n\n` +
        `Install ${toolDisplayName}:\n` +
        `  ${pc.cyan(installUrl)}\n\n` +
        `Or choose a different tool by editing your config:\n` +
        `  ${pc.cyan("bonsai config")}`
    );
    process.exit(1);
  }

  // Get worktree path
  let worktreePath: string | null = null;

  if (worktreeName) {
    // Worktree name provided - validate it exists
    worktreePath = join(config.repo.worktree_base, worktreeName);

    try {
      const stats = await stat(worktreePath);
      if (!stats.isDirectory()) {
        throw new Error("Not a directory");
      }
    } catch {
      p.cancel(
        `Worktree not found: ${pc.dim(worktreePath)}\n\n` +
          `Run ${pc.cyan("bonsai list")} to see available worktrees.`
      );
      process.exit(1);
    }
  } else {
    // No worktree specified - use fzf picker
    const spinner = p.spinner();
    spinner.start("Loading worktrees");

    const worktrees = await getAllWorktreesWithContext(config.repo.worktree_base, aiTool);

    spinner.stop("Loaded worktrees");

    if (worktrees.length === 0) {
      p.cancel(
        `No worktrees found.\n\n` + `Create one with ${pc.cyan("bonsai grow <branch-name>")}`
      );
      process.exit(1);
    }

    // Check if fzf is available
    const hasFzf = Bun.which("fzf") !== null;
    if (!hasFzf) {
      p.cancel(
        `fzf is required for interactive worktree selection.\n\n` +
          `Install fzf:\n` +
          `  ${pc.cyan("brew install fzf")}  ${pc.dim("(macOS)")}\n` +
          `  ${pc.cyan("apt install fzf")}   ${pc.dim("(Linux)")}\n\n` +
          `Or specify a worktree directly:\n` +
          `  ${pc.cyan("bonsai send <worktree-name>")}`
      );
      process.exit(1);
    }

    worktreePath = await pickWorktreeWithFzf(worktrees);

    if (!worktreePath) {
      p.cancel("Cancelled");
      process.exit(0);
    }
  }

  const selectedWorktreeName = basename(worktreePath);
  p.log.info(`Worktree: ${pc.cyan(selectedWorktreeName)}`);

  // Get prompt from user
  let prompt: string | null = null;

  if (options?.edit) {
    // Use $EDITOR for multi-line prompt
    const editorSpinner = p.spinner();
    editorSpinner.start("Opening editor");
    editorSpinner.stop("Editor opened");

    prompt = await getPromptFromEditor(selectedWorktreeName);

    if (!prompt) {
      p.cancel("No prompt provided");
      process.exit(0);
    }
  } else {
    // Use inline prompt via @clack/prompts
    const promptResult = await p.text({
      message: `What should I work on in ${pc.cyan(selectedWorktreeName)}?`,
      placeholder: "e.g., add unit tests for authentication",
      validate: (value) => {
        if (!value || value.trim() === "") {
          return "Prompt cannot be empty";
        }
      },
    });

    if (p.isCancel(promptResult)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    prompt = promptResult as string;
  }

  // Show what we're about to do
  p.log.info(`Prompt: ${pc.dim(prompt.split("\n")[0])}`);
  if (prompt.split("\n").length > 1) {
    p.log.info(`${pc.dim("(multi-line prompt)")}`);
  }

  const background = !options?.attach;
  const mode = background ? "background" : "interactive";
  p.log.info(`Mode: ${pc.dim(mode)}`);

  console.log();

  // Start AI tool
  const spinner = p.spinner();
  spinner.start(`Starting ${toolDisplayName} session`);

  try {
    await aiTool.start(worktreePath, prompt, background);
    spinner.stop(`${toolDisplayName} session started`);
  } catch (error) {
    spinner.stop(`Failed to start ${toolDisplayName}`);
    p.cancel(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Track session in registry
  try {
    await trackSession({
      worktreePath,
      worktreeName: selectedWorktreeName,
      prompt,
      startedAt: new Date().toISOString(),
      toolName: aiTool.name,
    });
  } catch {
    // Don't fail if registry tracking fails
  }

  // Output message
  console.log();

  if (background) {
    p.note(
      [
        `${pc.dim("Worktree:")} ${selectedWorktreeName}`,
        `${pc.dim("Tool:")} ${toolDisplayName}`,
        `${pc.dim("Mode:")} Background`,
      ].join("\n"),
      "Dispatched"
    );

    p.outro(
      `${toolDisplayName} is working in the background.\n` +
        `Check progress with ${pc.cyan("bonsai agent status")}`
    );
  } else {
    p.outro("Session ended");
  }
}
