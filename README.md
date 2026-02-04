<div align="center">

# 🪴 bonsai

<img src="assets/ai-art-sample-2.png" alt="bonsai logo" width="600"/>

_Carefully cultivate your branches._

One command to work on another branch—separate folder, deps, and editor. No stash, no conflict.

[![Release](https://github.com/abhinavramkumar/bonsai/actions/workflows/release.yml/badge.svg)](https://github.com/abhinavramkumar/bonsai/actions/workflows/release.yml)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/abhinavramkumar/bonsai)](https://github.com/abhinavramkumar/bonsai/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

A Git worktree CLI that creates a full environment per branch: a dedicated directory, your setup commands (e.g. `npm install`), and your editor. For when you need to switch context without touching your current work.

**Who it's for:** Maintainers juggling hotfixes, anyone who switches between branches often, or anyone who's tired of `git stash` dance.

## Features

- **One command** — `bonsai grow <branch>` creates the worktree, runs setup, and opens your editor.
- **Isolated envs** — Each branch gets its own directory, `node_modules`, build artifacts, and editor state.
- **No stash** — Your current branch and editor stay untouched; no conflicts, no mental overhead.
- **Shell integration** — Tab-complete branches; `bonsai switch` to jump between worktrees.

## Why bonsai?

**The problem:** You're deep in a feature branch when an urgent bug comes in. The usual dance:

```bash
git stash
git checkout main
git pull
git checkout -b hotfix/urgent
# ... fix the bug ...
git checkout feature/my-work
git stash pop
# Hope nothing conflicts...
```

**With bonsai:**

```bash
bonsai grow hotfix/urgent
# Fix bug in a completely isolated environment
# Your feature branch is untouched, editor still open
bonsai prune hotfix/urgent
```

Each worktree is a fully independent working directory. No stashing. No conflicts.

## Installation

**Quick install** (latest release binary):

```bash
curl -fsSL https://raw.githubusercontent.com/abhinavramkumar/bonsai/main/install.sh | sh
```

Upgrade later: `bonsai upgrade`. Or download manually from [GitHub Releases](https://github.com/abhinavramkumar/bonsai/releases).

**Homebrew (macOS/Linux):**

```bash
brew install abhinavramkumar/bonsai/bonsai
```

**From source** (requires [Bun](https://bun.sh)):

```bash
git clone https://github.com/abhinavramkumar/bonsai.git
cd bonsai
bun install
bun run build
sudo cp ./dist/bonsai /usr/local/bin/
```

**Shell integration** (recommended for tab completion and `bonsai switch`):

```bash
bonsai completions
# Interactive setup — adds to ~/.zshrc or ~/.bashrc
```

Or add to your shell config: `eval "$(bonsai completions zsh)"` (or `bash`).

## Quick start

```bash
cd ~/Projects/myapp
bonsai init
bonsai grow feature/auth
```

That fetches the branch, creates a worktree (e.g. `myapp.worktrees/feature-auth`), runs your setup commands, and opens your editor. Use `bonsai list`, `bonsai switch <name>` to jump between worktrees, `bonsai open` (or `bonsai bloom`) to open the current worktree in your configured editor, and `bonsai prune <branch>` when done.

[Full command reference](#commands) below.

## Commands

| Command                 | Aliases        | Description                                      |
| ----------------------- | -------------- | ------------------------------------------------ |
| `bonsai init`           |                | Interactive setup wizard for current repo        |
| `bonsai grow <branch>`  | `add`, `new`   | Create worktree, run setup, open editor          |
| `bonsai prune <branch>` | `rm`, `remove` | Remove worktree (prompts if uncommitted changes) |
| `bonsai list`           | `ls`           | List all worktrees                               |
| `bonsai switch <name>`  |                | cd to worktree _(requires shell completions)_    |
| `bonsai open`           | `bloom`        | Open current worktree in configured editor       |
| `bonsai setup`          |                | Re-run setup commands in current worktree        |
| `bonsai config`         |                | Open config in `$EDITOR`                         |
| `bonsai completions`    |                | Install shell integration                        |
| `bonsai upgrade`        |                | Install or upgrade to latest release             |

## Configuration

Config lives at `~/.config/bonsai/<repo-name>.toml` (XDG compliant). Edit with `bonsai config` or directly:

```toml
[repo]
path = "/Users/you/Projects/myapp"
worktree_base = "/Users/you/Projects/myapp.worktrees"
main_branch = "main"  # new worktrees are created from latest of this branch

[editor]
name = "cursor"  # cursor | vscode | claude | goland | rust-rover | webstorm | pycharm

[setup]
commands = [
  "npm install",
  "cp .env.example .env",
  "npm run db:migrate"
]

# When true, your terminal will cd into the new worktree after \`bonsai grow\` (requires shell integration).
# When false, you stay in your current directory; the editor still opens the new worktree.
[behavior]
navigate_after_grow = false
```

Setup commands run sequentially in the new worktree (streamed output, fail-fast). Run `bonsai setup` to retry. See [Setup commands](#setup-commands) for more examples.

**Terminal vs. editor:** By default, after `bonsai grow` your terminal stays in the current branch; only the editor opens the new worktree. Set `[behavior] navigate_after_grow = true` if you want the shell to cd into the new worktree automatically (requires [shell integration](#shell-integration)).

---

## Reference

### How `grow` works

**TL;DR:** You run `bonsai grow <branch>` once; bonsai creates a separate folder for that branch, runs your setup (e.g. `npm install`), and opens your editor. You don't run git worktree or IDE setup yourself - the steps below are what bonsai does automatically.

When you run `bonsai grow feature/auth`:

1. **Validates** the branch name (rejects invalid characters, names starting with `-`)
2. **Fetches** latest from remote (`git fetch --all --prune`)
3. **Detects** branch status: remote-only → tracks `origin/...`, existing local → uses it, else creates from current HEAD
4. **Checks** if branch is already checked out elsewhere (errors or offers to prune stale refs)
5. **Creates** the worktree at `<worktree_base>/feature-auth`
6. **Opens** your configured editor
7. **Runs** setup commands sequentially (stops on first failure)

### How `prune` works

**TL;DR:** When you're done with a worktree, run `bonsai prune <branch>` once. Bonsai removes that worktree folder safely (and prompts if you have uncommitted changes). The branch stays in git - only the extra working directory is removed. The steps below are what happens under the hood.

When you run `bonsai prune feature/auth`:

1. **Finds** the worktree at `<worktree_base>/feature-auth`
2. **Checks** for uncommitted changes (`git status --porcelain`)
3. **If dirty:** Shows changed files and asks for confirmation
4. **Removes** the worktree (`git worktree remove`)

The branch itself is **not deleted** — only the worktree directory.

### Setup commands

- **Streamed output** with colors preserved
- **Fail-fast** — stops on first non-zero exit code
- **Retryable** — run `bonsai setup` to retry after fixing issues
- Compound commands (`cmd1; cmd2`) fail properly

Examples:

```toml
# Node.js
commands = ["npm install", "npm run build"]

# Python
commands = ["python -m venv .venv", "source .venv/bin/activate && pip install -e ."]

# Monorepo
commands = [
  "npm install",
  "cd packages/frontend && npm install",
  "cd packages/backend && pip install -r requirements.txt"
]

# Env files
commands = ["cp .env.example .env", "cp .env.test.example .env.test"]
```

### Branch → folder mapping

Branch names are sanitized for folder names (slashes → dashes):

| Branch                | Folder                |
| --------------------- | --------------------- |
| `feature/user-auth`   | `feature-user-auth`   |
| `hotfix/critical-bug` | `hotfix-critical-bug` |
| `release/v2.0`        | `release-v2.0`        |
| `my-branch`           | `my-branch`           |

### Supported editors

| Editor      | CLI Command  | Config Value |
| ----------- | ------------ | ------------ |
| Cursor      | `cursor`     | `cursor`     |
| VS Code     | `code`       | `vscode`     |
| Claude Code | `claude`     | `claude`     |
| GoLand      | `goland`     | `goland`     |
| RustRover   | `rust-rover` | `rust-rover` |
| WebStorm    | `webstorm`   | `webstorm`   |
| PyCharm     | `pycharm`    | `pycharm`    |

The editor opens immediately after worktree creation (doesn't wait for setup to complete).

### Shell integration

Running `bonsai completions` adds:

- **Tab completion** for all commands
- **Branch completion** for `grow` (local and remote)
- **Worktree completion** for `prune` and `switch`
- **`bonsai switch`** to cd into worktrees (requires shell integration; a subprocess can't change the parent shell's directory)
- **Optional: cd after `grow`** — if `[behavior] navigate_after_grow = true`, the shell will cd into the new worktree after a successful `bonsai grow` so your terminal session follows the new branch

```bash
bonsai grow feat<TAB>   # completes to feature/...
bonsai prune <TAB>      # shows existing worktrees
bonsai switch <TAB>      # shows existing worktrees
```

### Example workflow

```bash
# Morning: start feature work
cd ~/Projects/myapp
bonsai grow feature/payments

# Afternoon: urgent hotfix
bonsai grow hotfix/security-fix
# New editor window; feature worktree untouched

# Fix bug, commit, push, merge...
bonsai prune hotfix/security-fix

# Back to feature (with shell completions)
bonsai switch feature-payments
bonsai open     # or bonsai bloom — open current worktree in configured editor
```

### Edge cases

**Branch already checked out elsewhere**

```
Branch feature/auth is already checked out at:
  /Users/you/Projects/myapp.worktrees/feature-auth

Either use that worktree or check out a different branch there first.
```

**Stale worktree reference** (directory deleted manually)

```
Branch feature/auth has a stale worktree reference at:
  .../myapp.worktrees/old-path (directory no longer exists)

? Prune stale worktree references and continue? (Y/n)
```

**Uncommitted changes on prune**

```
Uncommitted changes detected:
  modified   src/index.ts
  added      src/new-file.ts
  untracked  temp.log

? Force delete worktree with 3 uncommitted change(s)? (y/N)
```

### Tips

- **Keep worktree base outside your repo** — Default `<repo>.worktrees` keeps things organized.
- **Use descriptive branch names** — They become folder names; `bonsai list` stays readable.
- **Add `.worktrees` to global gitignore** — Avoid accidentally committing worktree dirs.
- **Setup commands should be idempotent** — They may run again via `bonsai setup`.

---

## Development

```bash
bun run dev -- --help    # Run without compiling
bun run build            # Compile to ./dist/bonsai
bun run typecheck        # Type check
bun run format           # Format with Prettier
bun run format:check     # Check formatting
bun run hooks:install   # Install git pre-commit hook
bun run link             # Symlink to /usr/local/bin (for testing)
bun run unlink           # Remove symlink
```

Debug upgrade flow: `BONSAI_UPGRADE_DEBUG=1 bonsai upgrade`

**Git hooks:** Pre-commit hook formats staged files. Install: `bun run hooks:install` or `./scripts/install-hooks.sh`.

**Architecture:**

```
src/
  cli.ts              # Entry point, command routing
  commands/
    init.ts           # Interactive setup wizard
    grow.ts           # Create worktree + setup + editor
    prune.ts          # Remove worktree with safety checks
    list.ts           # List worktrees
    open.ts           # Open current worktree in configured editor
    setup.ts          # Re-run setup commands
    config.ts         # Open config in $EDITOR
    completions.ts    # Shell integration (zsh/bash)
  lib/
    config.ts         # TOML config management
    git.ts            # Git operations
    editor.ts         # Editor launching
    runner.ts         # Command execution with streaming
```

## Requirements

| Requirement | Details                                                            |
| ----------- | ------------------------------------------------------------------ |
| **OS**      | macOS, Linux                                                       |
| **Git**     | 2.5+ (worktree support)                                            |
| **Runtime** | [Bun](https://bun.sh) (for building from source)                   |
| **Editor**  | Cursor, VS Code, Claude Code, GoLand, RustRover, WebStorm, PyCharm |

## License

MIT
