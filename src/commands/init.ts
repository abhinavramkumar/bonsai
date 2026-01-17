import * as p from "@clack/prompts";
import pc from "picocolors";
import { saveConfig, configExists, getConfigPath, type BonsaiConfig } from "../lib/config.js";
import { isGitRepo, getRepoRoot } from "../lib/git.js";
import { isEditorAvailable, type EditorName } from "../lib/editor.js";

/**
 * Initialize bonsai configuration for a repository
 * Interactive wizard that collects repo settings
 */
export async function initCommand(): Promise<void> {
  p.intro(pc.bgGreen(pc.black(" bonsai init ")));

  // Check if we're in a git repo
  if (!(await isGitRepo())) {
    p.cancel("Not inside a git repository. Please run this command from within a git repo.");
    process.exit(1);
  }

  const repoRoot = await getRepoRoot();
  if (!repoRoot) {
    p.cancel("Could not determine git repository root.");
    process.exit(1);
  }

  // Check if config already exists
  if (await configExists(repoRoot)) {
    const configPath = getConfigPath(repoRoot);
    const overwrite = await p.confirm({
      message: `Config already exists at ${pc.dim(configPath)}. Overwrite?`,
      initialValue: false,
    });

    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
  }

  // Collect configuration
  const config = await p.group(
    {
      repoPath: () =>
        p.text({
          message: "Git repository path",
          initialValue: repoRoot,
          validate: (value) => {
            if (!value) return "Repository path is required";
            return undefined;
          },
        }),

      worktreeBase: () =>
        p.text({
          message: "Worktree base directory",
          placeholder: `${repoRoot}.worktrees`,
          initialValue: `${repoRoot}.worktrees`,
          validate: (value) => {
            if (!value) return "Worktree base directory is required";
            return undefined;
          },
        }),

      editor: () =>
        p.select({
          message: "Editor to open worktrees",
          options: [
            { value: "cursor", label: "Cursor", hint: "cursor CLI" },
            { value: "vscode", label: "VS Code", hint: "code CLI" },
            { value: "claude", label: "Claude Code", hint: "claude CLI" },
          ],
          initialValue: "cursor",
        }),

      setupCommands: () =>
        p.text({
          message: "Setup commands (comma-separated, optional)",
          placeholder: "bun install, cp .env.example .env",
          defaultValue: "",
        }),
    },
    {
      onCancel: () => {
        p.cancel("Setup cancelled.");
        process.exit(0);
      },
    }
  );

  // Validate editor is available
  const editorAvailable = await isEditorAvailable(config.editor as EditorName);
  if (!editorAvailable) {
    p.log.warn(
      `${pc.yellow("Warning:")} ${config.editor} CLI not found in PATH. You may need to install it.`
    );
  }

  // Parse setup commands (comma-separated)
  const setupCommandsRaw = (config.setupCommands as string) || "";
  const setupCommands = setupCommandsRaw
    .split(",")
    .map((cmd) => cmd.trim())
    .filter(Boolean);

  // Build config object
  const bonsaiConfig: BonsaiConfig = {
    repo: {
      path: config.repoPath as string,
      worktree_base: config.worktreeBase as string,
    },
    editor: {
      name: config.editor as EditorName,
    },
    setup: {
      commands: setupCommands,
    },
  };

  // Save config
  const s = p.spinner();
  s.start("Saving configuration");

  try {
    await saveConfig(bonsaiConfig);
    s.stop("Configuration saved");
  } catch (error) {
    s.stop("Failed to save configuration");
    p.cancel(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Show summary
  const configPath = getConfigPath(config.repoPath as string);
  p.note(
    [
      `${pc.dim("Config file:")} ${configPath}`,
      `${pc.dim("Worktree base:")} ${config.worktreeBase}`,
      `${pc.dim("Editor:")} ${config.editor}`,
      setupCommands.length > 0
        ? `${pc.dim("Setup commands:")} ${setupCommands.length} command(s)`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
    "Configuration"
  );

  p.outro(
    `Done! Run ${pc.cyan("bonsai grow <branch-name>")} to create a worktree.`
  );
}
