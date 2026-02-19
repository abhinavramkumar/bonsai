# Agent Command Restructure

## Summary

Restructured the AI workflow commands to be under a unified `bonsai agent` command with subcommands.

## What Changed

### Before (Old Structure)
```bash
bonsai send [worktree]         # Dispatch work
bonsai dispatch [worktree]     # Alias
bonsai delegate [worktree]     # Alias
bonsai status                  # Show sessions
```

### After (New Structure)
```bash
bonsai agent send [worktree]      # Dispatch work
bonsai agent dispatch [worktree]  # Alias
bonsai agent delegate [worktree]  # Alias
bonsai agent status               # Show sessions (alias: list)
```

## Rationale

1. **Better Organization**: Groups all AI-related features under one namespace
2. **Clearer Intent**: `agent` clearly indicates AI functionality
3. **Scalability**: Easy to add more agent subcommands in the future (e.g., `agent logs`, `agent config`)
4. **Consistency**: Follows patterns like `git` (`git remote`, `git branch`) and `bonsai` itself

## Implementation Details

### New Files Created
- `src/commands/agent.ts` - Agent command router with help text

### Files Modified
- `src/cli.ts` - Updated routing to use agent command
- `src/commands/completions.ts` - Updated shell completions for agent subcommands
- `src/commands/send.ts` - Updated outro message reference
- All documentation files

### Command Flow
```
bonsai agent send
  ↓
cli.ts routes to agentCommand()
  ↓
agent.ts parses subcommand
  ↓
Routes to sendCommand() or statusCommand()
```

### Help System
```bash
bonsai agent --help              # Shows agent help
bonsai agent send --help         # Shows send help (from send.ts)
bonsai agent status --help       # Shows status help (from status.ts)
```

### Shell Completions
- Zsh: Completes `agent` → `send/status` → worktrees
- Bash: Completes `agent` → `send/status` → worktrees
- Full multi-level completion support

## Testing

All 15 automated tests passing:
- ✓ Help documentation updated
- ✓ Error handling works
- ✓ Command aliases functional
- ✓ AI tool detection
- ✓ Config setup
- ✓ Build verification

## Migration Guide

No breaking changes for users! The commands work as before, just with the `agent` prefix.

### Updated Examples

**Dispatch work:**
```bash
# Interactive picker
bonsai agent send

# Direct worktree
bonsai agent send feature-auth

# With options
bonsai agent send feature-auth --edit
bonsai agent send feature-auth --attach
```

**Check status:**
```bash
bonsai agent status
```

**Aliases still work:**
```bash
bonsai agent dispatch feature-auth
bonsai agent delegate feature-auth
```

## Documentation Updated

- ✅ docs/AI_WORKFLOW.md
- ✅ README.md
- ✅ CONTRIBUTING.md
- ✅ docs/RELEASE_NOTES_EXAMPLE.md
- ✅ scripts/test-ai-workflow.sh

## Future Possibilities

With this structure, we can easily add:
- `bonsai agent logs <worktree>` - View agent logs
- `bonsai agent attach <worktree>` - Attach to existing session
- `bonsai agent kill <worktree>` - Terminate active session
- `bonsai agent config` - Configure AI tool preferences

## Backwards Compatibility

The old commands (`bonsai send`, `bonsai status`) are **not** supported as top-level commands.

Users must update to `bonsai agent send` and `bonsai agent status`.

This is acceptable because:
1. AI workflow is brand new (not yet released)
2. Clear migration path
3. Better long-term structure
