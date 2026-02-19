# Bonsai AI Workflow

Bonsai supports dispatching work to worktrees using AI coding assistants (OpenCode or Claude Code). This allows you to work on multiple branches in parallel by delegating tasks to AI.

## Quick Start

```bash
# Dispatch work to a worktree
bonsai agent send feature-auth "add unit tests for authentication"

# Show active AI sessions (telescope-like interface)
bonsai agent status

# Interactive worktree picker
bonsai agent send

# Multi-line prompt via $EDITOR
bonsai agent send feature-auth --edit

# Interactive mode (not background)
bonsai agent send feature-auth --attach
```

## Setup

### 1. Install an AI Coding Assistant

Choose one:

- **OpenCode**: https://opencode.ai
- **Claude Code**: https://claude.ai/download

### 2. Configure Bonsai

Run `bonsai init` to set up your repository. The wizard will:

- Auto-detect available AI tools (OpenCode, Claude)
- Let you choose if multiple are installed
- Add `ai_tool` section to your config

Or manually edit `~/.config/bonsai/<repo>.toml`:

```toml
[ai_tool]
name = "opencode"  # or "claude"
```

## Commands

### `bonsai agent send [worktree] [options]`

Dispatch work to a worktree with an AI coding assistant.

**Aliases:** `dispatch`, `delegate`

**Usage:**

```bash
# Interactive worktree picker → prompt
bonsai agent send

# Direct worktree selection → prompt
bonsai agent send feature-auth

# With multi-line prompt via $EDITOR
bonsai agent send feature-auth --edit

# Interactive mode (attach to session)
bonsai agent send feature-auth --attach
```

**Options:**

- `--edit` - Open $EDITOR for multi-line prompt input
- `--attach` - Run in interactive mode instead of background

**Workflow:**

1. Selects worktree (via argument or fzf picker)
2. Prompts for task description
3. Starts AI tool in background (or interactive with `--attach`)
4. Tracks session in registry
5. Returns immediately (background) or waits (interactive)

### `bonsai agent status`

Show active AI sessions in an interactive telescope-like interface.

**Features:**

- Lists all tracked sessions
- Shows active/inactive status (● green = active, ○ red = inactive)
- Displays prompt preview and time ago
- Interactive selection for details
- Actions: Refresh, Clean up stale sessions, Remove from tracking

**Usage:**

```bash
bonsai agent status
```

**Navigation:**

- Arrow keys to select session
- Enter to view details
- Actions menu for session management
- ↻ Refresh to reload status
- 🗑 Clean up to remove inactive sessions

**Session Details:**

- Worktree name and path
- Status (active/inactive)
- AI tool name
- Started time
- Full prompt text
- Session ID (if available)
- Last updated time

## How It Works

### Session Tracking

Bonsai maintains a session registry at `~/.config/bonsai/sessions.json`:

```json
{
  "/path/to/worktree": {
    "worktreePath": "/path/to/worktree",
    "worktreeName": "feature-auth",
    "prompt": "add unit tests for authentication",
    "startedAt": "2026-02-19T14:30:00.000Z",
    "toolName": "opencode"
  }
}
```

### Background Mode (Default)

When you run `bonsai agent send` without `--attach`:

1. AI tool starts in a detached process
2. Command returns immediately
3. Session runs in background
4. Check progress with `bonsai agent status`

### Interactive Mode (`--attach`)

When you run `bonsai agent send --attach`:

1. AI tool starts in foreground
2. Terminal attaches to session
3. You can interact with the AI
4. Command blocks until session ends

## FZF Picker

When running `bonsai agent send` without specifying a worktree, an fzf picker shows:

```
> Select worktree:
  feature-auth       │ feature/auth       │ Add login endpoint 🔴
  docs-update        │ docs/readme        │ Update installation guide
  bugfix-tests       │ bugfix/test-fail   │ Fix flaky test
```

- **Column 1:** Worktree folder name
- **Column 2:** Git branch name
- **Column 3:** Last commit message
- **🔴 Indicator:** Has active AI session

**Requirements:**

- fzf must be installed (`brew install fzf` or `apt install fzf`)

## AI Tool Support

### OpenCode

**Features:**

- ✅ Background mode
- ✅ Interactive mode
- ✅ Session tracking via `opencode session list`
- ✅ Session details (title, updated time)
- ✅ Resume specific sessions

**Session Management:**

- Sessions tracked via OpenCode CLI
- `opencode session list` shows all sessions
- `opencode export <id>` provides session details

### Claude Code

**Features:**

- ✅ Background mode
- ✅ Interactive mode
- ✅ Session tracking via filesystem
- ⚠️ Limited session details (no titles)
- ✅ Resume most recent session

**Session Management:**

- Sessions stored in `~/.claude/projects/<path>/`
- Each session is a UUID.jsonl file
- `claude --continue` resumes most recent

## Switching Between Tools

Edit your config file:

```bash
bonsai config
```

Change the `ai_tool.name`:

```toml
[ai_tool]
name = "claude"  # or "opencode"
```

Save and exit. Next `bonsai agent send` will use the new tool.

## Examples

### Parallel Development

```bash
# Dispatch multiple tasks to different worktrees
bonsai agent send feature-auth "add OAuth integration"
bonsai agent send feature-ui "update login page styles"
bonsai agent send bugfix-db "fix connection pool leak"

# Check on all of them
bonsai agent status
```

### Complex Multi-Line Prompts

```bash
bonsai agent send feature-api --edit
```

Editor opens with template:

```markdown
# Task for feature-api

#

# Enter your prompt below. Lines starting with # are ignored.

Create a new REST API endpoint for user preferences.

Requirements:

- POST /api/users/:id/preferences
- Accept JSON body with preference keys
- Validate against schema
- Store in database
- Return updated preferences
- Add tests for all cases
```

### Monitor and Manage Sessions

```bash
# View all sessions
bonsai agent status

# Navigate to a session
# → Shows details (prompt, status, timestamps)

# Clean up inactive sessions
# → Select "🗑 Clean up stale"

# Remove specific session
# → Select session → Actions → Remove from tracking
```

## Troubleshooting

### "No AI tool configured"

Run `bonsai init` or manually add to config:

```toml
[ai_tool]
name = "opencode"
```

### "OpenCode/Claude is not installed"

Install the tool:

- OpenCode: https://opencode.ai
- Claude: https://claude.ai/download

Verify it's in PATH:

```bash
which opencode  # or which claude
```

### "fzf required for interactive worktree selection"

Install fzf:

```bash
# macOS
brew install fzf

# Linux
apt install fzf
```

Or specify worktree directly:

```bash
bonsai agent send <worktree-name>
```

### Background Process Not Starting

Try interactive mode to see errors:

```bash
bonsai agent send <worktree> --attach
```

### Sessions Not Showing in Status

Check if sessions file exists:

```bash
cat ~/.config/bonsai/sessions.json
```

If missing, sessions will be tracked after first `bonsai agent send`.

## Testing

Run comprehensive tests:

```bash
./scripts/test-ai-workflow.sh
```

This validates:

- Help documentation
- Error handling
- Command aliases
- AI tool detection
- Config file setup
- Build verification

Manual integration tests are documented in the script output.

## Architecture

### File Structure

```
src/lib/
  ai-tool.ts              # Interface and factory
  ai-tools/
    opencode.ts          # OpenCode implementation
    claude.ts            # Claude implementation
  sessions.ts            # Session registry management
  worktree.ts            # Worktree context utilities

src/commands/
  send.ts                # Dispatch command
  status.ts              # Status/telescope interface
```

### Extension

To add a new AI tool:

1. Implement `AITool` interface in `src/lib/ai-tools/`
2. Add to factory in `src/lib/ai-tool.ts`
3. Update config type in `src/lib/config.ts`
4. Add detection in `detectAvailableAITools()`

## Future Enhancements

Potential future features:

- [ ] `bonsai attach <worktree>` - Quick attach to existing session
- [ ] Session logs/history
- [ ] Multi-worktree dispatch (send same task to multiple)
- [ ] Session templates/presets
- [ ] Integration with bonsai prune (warn about active sessions)
- [ ] Session cost tracking (for API-based tools)
- [ ] Custom AI tools via config
