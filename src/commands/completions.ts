import * as p from "@clack/prompts";
import pc from "picocolors";
import { homedir } from "os";
import { join } from "path";

const SHELL_INTEGRATION = `
# ===== bonsai shell integration =====
# Added by: bonsai completions
# Provides: tab completion + bonsai switch command

# Get the main repo name (works from worktrees too)
_bonsai_repo_slug() {
    local git_common_dir repo_path
    git_common_dir=\$(git rev-parse --git-common-dir 2>/dev/null)
    if [[ -z "\$git_common_dir" || "\$git_common_dir" == ".git" ]]; then
        # In main repo
        basename "\$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null
    else
        # In a worktree - git-common-dir points to main repo's .git
        basename "\$(dirname "\$git_common_dir")" 2>/dev/null
    fi
}

_bonsai_complete() {
    local commands="init grow add new prune rm remove list ls open bloom setup config switch completions"
    
    if [[ \${#words[@]} -eq 2 ]]; then
        _describe 'commands' "(
            init:'Initialize bonsai for current repository'
            grow:'Create a worktree for a branch'
            add:'Create a worktree (alias for grow)'
            new:'Create a worktree (alias for grow)'
            prune:'Remove a worktree'
            rm:'Remove a worktree (alias for prune)'
            remove:'Remove a worktree (alias for prune)'
            list:'List all worktrees'
            ls:'List all worktrees (alias)'
            switch:'Switch to a worktree'
            open:'Open current worktree in configured editor'
            bloom:'Open current worktree in configured editor (alias for open)'
            setup:'Run setup commands'
            config:'Open config in editor'
            completions:'Shell completions'
        )"
    elif [[ \${#words[@]} -eq 3 ]]; then
        case "\${words[2]}" in
            grow|add|new)
                local branches
                branches=(\${(f)"$(git branch -a 2>/dev/null | sed 's/^[* ]*//' | sed 's|remotes/origin/||' | sort -u)"})
                _describe 'branches' branches
                ;;
            prune|rm|remove|switch)
                local repo_slug config_file worktree_base
                repo_slug=\$(_bonsai_repo_slug)
                config_file="\${XDG_CONFIG_HOME:-\$HOME/.config}/bonsai/\${repo_slug}.toml"
                if [[ -f "\$config_file" ]]; then
                    worktree_base=\$(grep 'worktree_base' "\$config_file" | sed 's/.*= *"\\(.*\\)"/\\1/')
                    if [[ -d "\$worktree_base" ]]; then
                        local worktrees
                        worktrees=(\${(f)"\$(ls -t "\$worktree_base" 2>/dev/null)"})
                        _describe 'worktrees' worktrees
                    fi
                fi
                ;;
            completions)
                _describe 'shells' "(zsh bash)"
                ;;
        esac
    fi
}
compdef _bonsai_complete bonsai

bonsai() {
    if [[ "\$1" == "switch" ]]; then
        local repo_slug config_file worktree_base target_dir worktree_name
        repo_slug=\$(_bonsai_repo_slug)
        config_file="\${XDG_CONFIG_HOME:-\$HOME/.config}/bonsai/\${repo_slug}.toml"

        if [[ ! -f "\$config_file" ]]; then
            echo "No bonsai config found. Run 'bonsai init' first." >&2
            return 1
        fi

        worktree_base=\$(grep 'worktree_base' "\$config_file" | sed 's/.*= *"\\(.*\\)"/\\1/')

        if [[ -z "\$2" ]]; then
            # No argument - use fzf if available, otherwise show error
            if command -v fzf &>/dev/null && [[ -d "\$worktree_base" ]]; then
                # List worktrees sorted by modification time (most recent first)
                worktree_name=\$(ls -t "\$worktree_base" 2>/dev/null | fzf --height=40% --reverse --prompt="Switch to worktree: ")
                if [[ -z "\$worktree_name" ]]; then
                    return 0  # User cancelled fzf
                fi
            else
                echo "Usage: bonsai switch <worktree-name>" >&2
                return 1
            fi
        else
            worktree_name="\$2"
        fi

        # Validate worktree name - reject path traversal and absolute paths
        if [[ "\$worktree_name" == *".."* || "\$worktree_name" == /* || "\$worktree_name" == *"/"* ]]; then
            echo "Invalid worktree name: must be a simple name without path separators" >&2
            return 1
        fi

        target_dir="\${worktree_base}/\$worktree_name"
        if [[ -d "\$target_dir" ]]; then
            cd "\$target_dir" || return 1
            echo "🌳 \$target_dir"
            return 0
        else
            echo "Worktree not found: \$target_dir" >&2
            return 1
        fi
    elif [[ "\$1" == "grow" || "\$1" == "add" || "\$1" == "new" ]] && [[ -n "\$2" ]]; then
        local nav_file ret
        nav_file=\$(mktemp)
        BONSAI_NAVIGATE_FILE="\$nav_file" command bonsai "\$@"
        ret=\$?
        if [[ \$ret -eq 0 && -f "\$nav_file" && -s "\$nav_file" ]]; then
            local target_dir
            target_dir=\$(cat "\$nav_file")
            cd "\$target_dir" && echo "🌳 \$target_dir"
        fi
        rm -f "\$nav_file"
        return \$ret
    else
        command bonsai "\$@"
    fi
}
# ===== end bonsai =====
`;

const BASH_INTEGRATION = `
# ===== bonsai shell integration =====
# Added by: bonsai completions
# Provides: tab completion + bonsai switch command

# Get the main repo name (works from worktrees too)
_bonsai_repo_slug() {
    local git_common_dir
    git_common_dir=\$(git rev-parse --git-common-dir 2>/dev/null)
    if [[ -z "\$git_common_dir" || "\$git_common_dir" == ".git" ]]; then
        # In main repo
        basename "\$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null
    else
        # In a worktree - git-common-dir points to main repo's .git
        basename "\$(dirname "\$git_common_dir")" 2>/dev/null
    fi
}

_bonsai_complete() {
    local cur prev commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    commands="init grow add new prune rm remove list ls open bloom setup config switch completions"

    case "\${prev}" in
        grow|add|new)
            local branches
            branches=\$(git branch -a 2>/dev/null | sed 's/^[* ]*//' | sed 's|remotes/origin/||' | sort -u)
            COMPREPLY=( \$(compgen -W "\${branches}" -- "\${cur}") )
            return 0
            ;;
        prune|rm|remove|switch)
            local repo_slug config_file worktree_base worktrees
            repo_slug=\$(_bonsai_repo_slug)
            config_file="\${XDG_CONFIG_HOME:-\$HOME/.config}/bonsai/\${repo_slug}.toml"
            if [[ -f "\$config_file" ]]; then
                worktree_base=\$(grep 'worktree_base' "\$config_file" | sed 's/.*= *"\\(.*\\)"/\\1/')
                if [[ -d "\$worktree_base" ]]; then
                    worktrees=\$(ls -t "\$worktree_base" 2>/dev/null)
                    COMPREPLY=( \$(compgen -W "\${worktrees}" -- "\${cur}") )
                fi
            fi
            return 0
            ;;
        completions)
            COMPREPLY=( \$(compgen -W "bash zsh" -- "\${cur}") )
            return 0
            ;;
        bonsai)
            COMPREPLY=( \$(compgen -W "\${commands}" -- "\${cur}") )
            return 0
            ;;
    esac
    COMPREPLY=( \$(compgen -W "\${commands}" -- "\${cur}") )
}
complete -F _bonsai_complete bonsai

bonsai() {
    if [[ "\$1" == "switch" ]]; then
        local repo_slug config_file worktree_base target_dir worktree_name
        repo_slug=\$(_bonsai_repo_slug)
        config_file="\${XDG_CONFIG_HOME:-\$HOME/.config}/bonsai/\${repo_slug}.toml"

        if [[ ! -f "\$config_file" ]]; then
            echo "No bonsai config found. Run 'bonsai init' first." >&2
            return 1
        fi

        worktree_base=\$(grep 'worktree_base' "\$config_file" | sed 's/.*= *"\\(.*\\)"/\\1/')

        if [[ -z "\$2" ]]; then
            # No argument - use fzf if available, otherwise show error
            if command -v fzf &>/dev/null && [[ -d "\$worktree_base" ]]; then
                # List worktrees sorted by modification time (most recent first)
                worktree_name=\$(ls -t "\$worktree_base" 2>/dev/null | fzf --height=40% --reverse --prompt="Switch to worktree: ")
                if [[ -z "\$worktree_name" ]]; then
                    return 0  # User cancelled fzf
                fi
            else
                echo "Usage: bonsai switch <worktree-name>" >&2
                return 1
            fi
        else
            worktree_name="\$2"
        fi

        # Validate worktree name - reject path traversal and absolute paths
        if [[ "\$worktree_name" == *".."* || "\$worktree_name" == /* || "\$worktree_name" == *"/"* ]]; then
            echo "Invalid worktree name: must be a simple name without path separators" >&2
            return 1
        fi

        target_dir="\${worktree_base}/\$worktree_name"
        if [[ -d "\$target_dir" ]]; then
            cd "\$target_dir" || return 1
            echo "🌳 \$target_dir"
            return 0
        else
            echo "Worktree not found: \$target_dir" >&2
            return 1
        fi
    elif [[ "\$1" == "grow" || "\$1" == "add" || "\$1" == "new" ]] && [[ -n "\$2" ]]; then
        local nav_file ret
        nav_file=\$(mktemp)
        BONSAI_NAVIGATE_FILE="\$nav_file" command bonsai "\$@"
        ret=\$?
        if [[ \$ret -eq 0 && -f "\$nav_file" && -s "\$nav_file" ]]; then
            local target_dir
            target_dir=\$(cat "\$nav_file")
            cd "\$target_dir" && echo "🌳 \$target_dir"
        fi
        rm -f "\$nav_file"
        return \$ret
    else
        command bonsai "\$@"
    fi
}
# ===== end bonsai =====
`;

const MARKER = "# ===== bonsai shell integration =====";

/**
 * Check if bonsai integration already exists in a file
 */
async function hasExistingIntegration(filePath: string): Promise<boolean> {
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return false;
    const content = await file.text();
    return content.includes(MARKER);
  } catch {
    return false;
  }
}

/**
 * Append integration to shell config
 */
async function appendToFile(filePath: string, content: string): Promise<void> {
  const file = Bun.file(filePath);
  let existing = "";
  if (await file.exists()) {
    existing = await file.text();
  }
  await Bun.write(filePath, existing + "\n" + content);
}

/**
 * Generate shell completions
 */
export async function completionsCommand(shell?: string): Promise<void> {
  // If no shell specified, show interactive setup
  if (!shell) {
    p.intro(pc.bgBlue(pc.white(" bonsai completions ")));

    const selectedShell = await p.select({
      message: "Select your shell",
      options: [
        { value: "zsh", label: "Zsh", hint: "~/.zshrc" },
        { value: "bash", label: "Bash", hint: "~/.bashrc" },
        { value: "print", label: "Just print the script", hint: "I'll add it manually" },
      ],
    });

    if (p.isCancel(selectedShell)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    if (selectedShell === "print") {
      const whichShell = await p.select({
        message: "Which shell script?",
        options: [
          { value: "zsh", label: "Zsh" },
          { value: "bash", label: "Bash" },
        ],
      });

      if (p.isCancel(whichShell)) {
        p.cancel("Cancelled");
        process.exit(0);
      }

      console.log();
      console.log(whichShell === "zsh" ? SHELL_INTEGRATION : BASH_INTEGRATION);
      p.outro("Copy the above to your shell config.");
      return;
    }

    const configFile =
      selectedShell === "zsh" ? join(homedir(), ".zshrc") : join(homedir(), ".bashrc");

    // Check for existing integration
    if (await hasExistingIntegration(configFile)) {
      p.log.warn(`Bonsai integration already exists in ${pc.dim(configFile)}`);

      const reinstall = await p.confirm({
        message: "Remove and reinstall?",
        initialValue: false,
      });

      if (p.isCancel(reinstall) || !reinstall) {
        p.outro("No changes made.");
        return;
      }

      // Remove existing integration
      const file = Bun.file(configFile);
      const content = await file.text();
      const cleaned = content.replace(
        /\n# ===== bonsai shell integration =====[\s\S]*?# ===== end bonsai =====\n?/g,
        ""
      );
      await Bun.write(configFile, cleaned);
      p.log.info("Removed existing integration");
    }

    // Confirm append
    const confirm = await p.confirm({
      message: `Add bonsai integration to ${pc.cyan(configFile)}?`,
      initialValue: true,
    });

    if (p.isCancel(confirm) || !confirm) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    // Append to file
    const integration = selectedShell === "zsh" ? SHELL_INTEGRATION : BASH_INTEGRATION;
    await appendToFile(configFile, integration);

    p.log.success(`Added to ${pc.dim(configFile)}`);

    p.note(`source ${configFile}\n\n` + `${pc.dim("Or restart your terminal")}`, "To activate now");

    p.outro("Done! Tab completion and 'bonsai switch' are ready.");
    return;
  }

  // Direct shell argument - just print the script
  switch (shell.toLowerCase()) {
    case "bash":
      console.log(BASH_INTEGRATION);
      break;
    case "zsh":
      console.log(SHELL_INTEGRATION);
      break;
    default:
      console.error(pc.red(`Unknown shell: ${shell}`));
      console.log(`Supported: ${pc.cyan("bash")}, ${pc.cyan("zsh")}`);
      process.exit(1);
  }
}
