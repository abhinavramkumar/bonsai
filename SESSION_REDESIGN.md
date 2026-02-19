# Session Management Redesign

## Current Problems

1. **No Session ID Tracking**: We spawn `opencode run` but don't capture/track the session ID
2. **Can't Attach/Detach**: No way to jump into a running agent conversation
3. **Custom Session Registry**: We built our own session tracking instead of using OpenCode's native sessions
4. **Log Files Instead of Sessions**: We're tailing log files instead of attaching to live sessions

## OpenCode Native Capabilities

OpenCode already provides everything we need:

### Session Management

```bash
# List all sessions with metadata
opencode session list --format json
# Output: [{id, title, updated, created, projectId, directory}, ...]

# Start with a session ID
opencode --session <id> <directory>

# Continue last session in directory
opencode --continue <directory>

# Export session data
opencode export <session-id>
```

### Session Attachment

```bash
# Start OpenCode in a directory with a prompt
opencode <directory> --prompt "task description"
# This creates a NEW session

# Attach to existing session
opencode <directory> --session <session-id>

# Continue most recent session
opencode <directory> --continue
```

## Proposed Architecture

### 1. Start Agent (Background Mode)

```bash
# Option A: Use opencode with tmux for true background + attach/detach
tmux new-session -d -s "bonsai-{worktree-name}" \
  "opencode {worktree} --prompt '{task}' --title 'Bonsai: {task}'"

# Option B: Use opencode run but capture session ID from output
opencode run --dir {worktree} --format json "{task}" > session.jsonl &
# Parse session ID from first event
```

### 2. Session Registry

**Stop building our own!** Use OpenCode's native session list:

```typescript
// Get all sessions for a directory
const sessions = await $`opencode session list --format json`.json();
const worktreeSessions = sessions.filter((s) => s.directory === worktreePath);

// Most recent session for worktree
const latestSession = worktreeSessions.sort((a, b) => b.updated - a.updated)[0];
```

### 3. Attach to Running Agent

```bash
# Interactive attach - jumps into the conversation
opencode {worktree} --session {session-id}

# Or if using tmux
tmux attach-session -t "bonsai-{worktree-name}"
```

### 4. Status / Logs

```bash
# Show sessions by worktree
opencode session list --format json | jq 'group_by(.directory)'

# Live logs (if using tmux)
tmux capture-pane -t "bonsai-{worktree-name}" -p

# Or export session and show messages
opencode export {session-id} | jq '.messages'
```

## Implementation Plan

### Phase 1: Fix Current Background Mode

1. Use `opencode run --format json` to capture session ID
2. Parse JSON output to extract `session.created` event with session ID
3. Store session ID in our registry (keep existing registry structure for now)
4. Update logs command to use `opencode export` instead of log files

### Phase 2: Enable Attach/Detach

1. Add `bonsai agent attach <worktree>` command
2. List available sessions for that worktree
3. Use `opencode --session <id>` to attach interactively
4. User can naturally exit (Ctrl+D) to detach

### Phase 3: Consider tmux Integration

If users want true background with easy attach/detach:

1. Start agents in named tmux sessions
2. `bonsai logs <worktree>` → `tmux capture-pane`
3. `bonsai agent attach <worktree>` → `tmux attach-session`
4. Detach with standard `Ctrl+B D`

## Key Decisions

### Use OpenCode's Session Management

- ✅ Don't build our own session tracking
- ✅ Use `opencode session list` as source of truth
- ✅ Filter by directory to find worktree sessions

### Session ID Capture

Need to capture session ID when starting background agent:

- `opencode run --format json` outputs events
- Parse `session.created` event to get ID
- Store in registry for quick lookups

### Logs vs Live Sessions

- **Current**: Tail log files (disconnected from session)
- **Better**: Export session messages (`opencode export`)
- **Best**: Attach to live session (`opencode --session`)

## Next Steps

1. Research: Test `opencode run --format json` output format
2. Implement: Capture session ID from background start
3. Implement: Update logs to use `opencode export` or session attachment
4. Implement: Add `bonsai agent attach` command
5. Consider: tmux integration for true detachable sessions

## Questions to Answer

1. Does `opencode run --format json` emit session ID in output?
2. Can we attach to a session started with `opencode run`?
3. Should we use tmux for true background sessions?
4. How do we handle session cleanup/pruning?
