<div align="center">

# 🪴 bonsai

<img src="assets/ai-art-sample-2.png" alt="bonsai logo" width="600"/>

_Carefully cultivate your branches._

[![Release](https://github.com/abhinavramkumar/bonsai/actions/workflows/release.yml/badge.svg)](https://github.com/abhinavramkumar/bonsai/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

Git worktree management CLI. Work on multiple branches simultaneously—no stash, no conflict.

One command creates a worktree with its own directory, dependencies, and editor instance.

## Quick Start

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/abhinavramkumar/bonsai/main/install.sh | sh

# Setup
cd ~/Projects/myapp
bonsai init

# Create worktree
bonsai grow feature/auth
# → Creates worktree, runs npm install, opens editor
```

## Why?

You're deep in a feature when an urgent bug comes in:

```bash
# Without bonsai
git stash
git checkout main
git pull
git checkout -b hotfix/urgent
# ... fix ...
git checkout feature/my-work
git stash pop  # 🤞

# With bonsai
bonsai grow hotfix/urgent
# → Isolated environment, feature branch untouched
```

## Core Commands

| Command                 | Description                           |
| ----------------------- | ------------------------------------- |
| `bonsai init`           | Setup config for current repo         |
| `bonsai grow <branch>`  | Create worktree + run setup + open    |
| `bonsai prune [branch]` | Remove worktree(s) (multi-select)     |
| `bonsai list`           | List worktrees                        |
| `bonsai switch <name>`  | cd to worktree (requires completions) |
| `bonsai open`           | Open current worktree in editor       |
| `bonsai completions`    | Install shell integration             |

See [docs/](docs/) for AI workflow, full reference, and examples.

## Configuration

Config: `~/.config/bonsai/<repo>.toml`

```toml
[repo]
path = "/Users/you/Projects/myapp"
worktree_base = "/Users/you/Projects/myapp.worktrees"
main_branch = "main"  # new worktrees are created from latest of this branch

[editor]
name = "cursor"  # cursor | vscode | claude | goland | rust-rover | webstorm | pycharm

[setup]
commands = ["npm install", "cp .env.example .env"]

[behavior]
navigate_after_grow = false  # when true, terminal cd's into worktree after grow (requires shell integration)
```

Edit: `bonsai config`

---

## Installation

**Binary:**

```bash
curl -fsSL https://raw.githubusercontent.com/abhinavramkumar/bonsai/main/install.sh | sh
```

**Homebrew:**

```bash
brew install abhinavramkumar/bonsai/bonsai
```

**From source:**

```bash
git clone https://github.com/abhinavramkumar/bonsai.git
cd bonsai
bun install && bun run build
sudo cp ./dist/bonsai /usr/local/bin/
```

**Shell completions:**

```bash
bonsai completions  # Interactive setup
```

---

**Requirements:** macOS/Linux, Git 2.5+

**License:** MIT — See [CONTRIBUTING.md](CONTRIBUTING.md) and [ROADMAP.md](ROADMAP.md)
