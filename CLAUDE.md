---
description: Bonsai CLI - Git worktree workflow tool
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

# Bonsai CLI

Git worktree management CLI built with Bun + TypeScript.

## Architecture

```
src/
  cli.ts           # Entry point, arg parsing, command routing
  commands/        # Command implementations
    init.ts        # Interactive setup wizard (@clack/prompts)
    grow.ts        # Create worktree + run setup + open editor
    prune.ts       # Remove worktree (with dirty check)
    list.ts        # List worktrees
    setup.ts       # Re-run setup commands
    config.ts      # Open config in $EDITOR
    completions.ts # Shell integration (zsh/bash)
  lib/
    config.ts      # TOML config read/write (~/.config/bonsai/<repo>.toml)
    git.ts         # Git operations via Bun.$
    editor.ts      # Editor launching (cursor/code/claude)
    runner.ts      # Command execution with streaming output
```

## Key Implementation Details

### Config Location
- XDG compliant: `$XDG_CONFIG_HOME/bonsai/<repo-slug>.toml` or `~/.config/bonsai/<repo>.toml`
- Repo slug = basename of repo path

### Git Worktrees
- `git worktree add <path> -b <branch> origin/<branch>` for remote-only branches
- `git worktree add <path> <branch>` for existing local branches  
- `git worktree add -b <branch> <path>` for new branches
- Branch `feature/foo` → folder `feature-foo` (sanitized)

### Finding Main Repo from Worktree
```bash
# git rev-parse --show-toplevel returns worktree path, not main repo
# Use --git-common-dir instead:
git_common_dir=$(git rev-parse --git-common-dir)
if [[ "$git_common_dir" == ".git" ]]; then
  # In main repo
else
  # In worktree - git_common_dir is /path/to/main-repo/.git
  repo_name=$(basename "$(dirname "$git_common_dir")")
fi
```

### Shell Integration
- `bonsai switch` needs shell function (subprocess can't cd parent)
- Completions output includes both completion function AND wrapper function
- Must handle both main repo and worktree contexts for config lookup

### Editor $EDITOR Handling
- Split on whitespace: `"cursor --wait"` → `["cursor", "--wait", file]`
- Use `Bun.spawn` with `stdin/stdout/stderr: "inherit"` for terminal editors

### Setup Commands
- Run sequentially, stop on first failure
- Stream output with `stdout: "inherit"` (preserves colors)
- Don't set `FORCE_COLOR=1` - causes OSC 8 hyperlink underlines in npm/yarn

## Dependencies
- `@clack/prompts` - Interactive CLI UI
- `picocolors` - Terminal colors
- `smol-toml` - TOML parsing
- `prettier` - Code formatting (dev dependency)

## Version Management
- Version is dynamically read from `package.json` at runtime via `getVersion()` function
- Reads from `process.cwd()/package.json` (works in both dev and compiled binary contexts)
- Fallback to `"0.1.0"` if package.json can't be read (shouldn't happen in normal operation)
- Single source of truth: update version in `package.json` only

## Code Formatting
- Prettier configured via `.prettierrc` and `.prettierignore`
- Pre-commit hook automatically formats staged files
- Scripts: `bun run format` and `bun run format:check`
- Install hooks: `bun run hooks:install`

## Build
```bash
bun run build              # → dist/bonsai (single binary for current platform)
bun run build:all          # Build for all platforms (darwin-x64, darwin-arm64, linux-x64, linux-arm64)
bun run build:darwin-x64   # macOS Intel
bun run build:darwin-arm64 # macOS Apple Silicon
bun run build:linux-x64    # Linux x64
bun run build:linux-arm64  # Linux ARM64
bun run link               # Symlink to /usr/local/bin
```

## Release Process
- Use `scripts/release.sh` helper script
- Builds binaries for all platforms
- Creates git tag and GitHub release
- See `RELEASE.md` for detailed instructions
