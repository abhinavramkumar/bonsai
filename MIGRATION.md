# Migration Guide: Bonsai v0.2.0

## Agent Features Removed

As of **v0.2.0**, all AI agent orchestration features have been removed from Bonsai to keep it focused solely on git worktree management.

## What Was Removed

### Commands

- `bonsai agent send` - Dispatch work to AI agents
- `bonsai agent status` - Show active AI sessions
- `bonsai logs` - View/tail AI session logs

### Configuration

- `ai_tool` section in config files
- Session tracking registry
- AI tool abstractions (OpenCode/Claude integration)

## What Remains

All core worktree management features:

| Command                  | Description                            |
| ------------------------ | -------------------------------------- |
| `bonsai init`            | Initialize bonsai for a repository     |
| `bonsai grow <branch>`   | Create a worktree                      |
| `bonsai list`            | List all worktrees                     |
| `bonsai prune [branch]`  | Remove worktree(s)                     |
| `bonsai switch <branch>` | Switch to worktree (shell integration) |
| `bonsai open`            | Open current worktree in editor        |
| `bonsai setup`           | Re-run setup commands                  |
| `bonsai config`          | Edit configuration                     |
| `bonsai completions`     | Generate shell completions             |

## Using OpenCode Directly

You can still use OpenCode (or any AI tool) with your worktrees. Bonsai just manages the worktrees themselves now.

### Basic Workflow

```bash
# Create a worktree with bonsai
bonsai grow feature-auth

# Navigate to it (if you have shell integration)
bonsai switch feature-auth

# Start OpenCode in that worktree
opencode .

# When done, remove the worktree
bonsai prune feature-auth
```

### OpenCode Session Management

OpenCode has excellent built-in session management:

```bash
# List all OpenCode sessions
opencode session list

# Attach to a specific session
opencode --session ses_abc123

# Continue last session in current directory
opencode --continue

# Export session data
opencode export ses_abc123
```

### Multi-Worktree Workflow

```bash
# Create multiple worktrees
bonsai grow feature-auth
bonsai grow feature-payments
bonsai grow bugfix-validation

# Start OpenCode in each (in separate terminal tabs/tmux)
cd ~/myrepo.worktrees/feature-auth && opencode .
cd ~/myrepo.worktrees/feature-payments && opencode .
cd ~/myrepo.worktrees/bugfix-validation && opencode .

# Check all active sessions
opencode session list

# Jump between them by attaching to session IDs
opencode --session ses_abc123
```

## Why This Change?

### Focus

Bonsai is excellent at worktree management. OpenCode is excellent at AI session management. Keeping concerns separate makes both tools simpler and more maintainable.

### Duplication

OpenCode already has:

- Session tracking and management
- Agent orchestration (primary agents + subagents)
- Session attachment/detachment
- Session hierarchy and navigation
- Permission controls

Bonsai was duplicating these features poorly instead of leveraging OpenCode's native capabilities.

### Complexity

Removing agent features reduced Bonsai's codebase by ~40% and eliminated several complex dependencies.

## Future

If you need advanced agent orchestration (managing multiple AI sessions, intervening at will, coordinating work across worktrees), consider:

1. **Use OpenCode's native features** - Tab to switch agents, @mention subagents, navigate session hierarchy
2. **Wait for dedicated orchestrator** - A focused tool for AI orchestration may be built separately
3. **Build custom scripts** - OpenCode's CLI is scriptable (`opencode session list`, `opencode run`, etc.)

## Feedback

If you have questions or concerns about this change, please open an issue on GitHub.
