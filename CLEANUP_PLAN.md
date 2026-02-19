# Bonsai Cleanup Plan: Remove Agent Features

## Goal

Strip out all AI/agent orchestration features to keep Bonsai focused solely on worktree management.

## Files to Remove

### Commands (8 files)

```
src/commands/agent.ts       # Agent routing
src/commands/send.ts        # Agent dispatch
src/commands/status.ts      # Session status
src/commands/logs.ts        # Log viewing
```

### Libraries (4 files)

```
src/lib/ai-tool.ts          # AI tool interface
src/lib/ai-tools/opencode.ts # OpenCode implementation
src/lib/ai-tools/claude.ts   # Claude implementation
src/lib/sessions.ts         # Session tracking
```

### Documentation (keep for reference)

```
SESSION_REDESIGN.md         # Keep - documents research
CONDUCTOR_VS_OPENCODE.md    # Keep - architectural decisions
CLEANUP_PLAN.md            # Keep - this file
```

## CLI Changes

### Remove from Help Text

- `agent` command and examples
- `logs` command and examples
- AI workflow sections

### Remove from Routing

- Case "agent"
- Case "logs"

### Keep These Commands

```
bonsai init           # Setup
bonsai grow           # Create worktree
bonsai list           # List worktrees
bonsai prune          # Remove worktree
bonsai switch         # Change directory (shell function)
bonsai setup          # Run setup commands
bonsai config         # Edit config
bonsai completions    # Shell completions
```

## Config Changes

### Remove from Config Interface

```typescript
// Remove:
ai_tool?: {
  name: string;
  // ... all AI tool config
}
```

### Keep in Config

```typescript
export interface BonsaiConfig {
  repo: {
    path: string;
    worktree_base: string;
  };
  setup?: {
    commands: string[];
  };
  editor?: {
    command: string;
  };
}
```

## Updated README Focus

### New Tagline

"Git worktree workflow tool for clean, isolated branch management"

### Remove Sections

- AI Workflow Management
- Agent Commands
- Session Tracking
- Log Viewing

### Keep/Enhance Sections

- Worktree Creation & Management
- Setup Command Configuration
- Editor Integration
- Shell Integration

## Dependencies to Review

Check if these are still needed after removal:

- None specific to AI features currently

## Migration Notes for Users

### If Users Were Using Agent Features

Create `MIGRATION.md`:

```markdown
# Migration Guide: Bonsai v0.2.0

## Agent Features Removed

As of v0.2.0, all AI agent orchestration features have been removed from Bonsai
to keep it focused on worktree management.

### What Was Removed

- `bonsai agent send`
- `bonsai agent status`
- `bonsai logs`
- Session tracking
- AI tool configuration

### What Remains

All core worktree management:

- `bonsai grow` - Create worktrees
- `bonsai list` - List worktrees
- `bonsai prune` - Remove worktrees
- `bonsai setup` - Run setup commands
- All other worktree commands

### Using OpenCode Directly

You can still use OpenCode with your worktrees:

# Navigate to worktree

cd ~/Projects/myrepo.worktrees/feature-branch

# Start OpenCode

opencode .

# List sessions

opencode session list

# Attach to session

opencode --session <id>
```

## Testing Plan

### Before Removal

1. Run `bun run build` - ensure current build works
2. Test each command that will remain
3. Document current version as "last with agent features"

### After Removal

1. Remove files
2. Update cli.ts routing
3. Update README
4. Run `bun run build` - fix any TypeScript errors
5. Test all remaining commands
6. Update version in package.json (0.1.x → 0.2.0)
7. Create git commit with clear message

## Rollout

### Version Bump

0.1.x (current) → 0.2.0 (breaking change, features removed)

### Commit Message

```
refactor: remove agent orchestration features

BREAKING CHANGE: All AI agent features have been removed to keep Bonsai
focused solely on worktree management.

Removed:
- Agent commands (send, status)
- Log viewing
- Session tracking
- AI tool infrastructure

Users can manage OpenCode sessions directly using native OpenCode commands.

See MIGRATION.md for details.
```

### Release Notes

```markdown
# v0.2.0 - Back to Basics

## Breaking Changes

Removed all AI agent orchestration features. Bonsai now focuses exclusively
on git worktree management.

## Removed

- `bonsai agent send` - use `opencode` directly
- `bonsai agent status` - use `opencode session list`
- `bonsai logs` - use `opencode export` or native attachment

## Migration

See MIGRATION.md for how to use OpenCode directly with your worktrees.

## Why?

OpenCode already has excellent built-in session management, agent orchestration,
and attachment capabilities. Bonsai was duplicating this functionality poorly.

Keeping Bonsai focused on worktrees makes it simpler, more maintainable, and
better at its core purpose.
```
