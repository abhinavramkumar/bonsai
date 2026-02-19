# Conductor + Bonsai vs OpenCode Native: Architecture Decision

## TL;DR: What OpenCode Already Has

OpenCode **already has built-in agent orchestration** via:

- **Primary agents** (build, plan) - switchable with Tab key
- **Subagents** (general, explore) - invokable with `@mention` or automatically by primary agents
- **Task tool** - primary agents can delegate work to subagents, creating child sessions
- **Session navigation** - cycle between parent and child sessions with `<Leader>+Right/Left`
- **Session management** - full session tracking, attachment, continuation

**You don't need Conductor or custom orchestration.** OpenCode already does this natively.

## What OpenCode Provides Out of the Box

### 1. Agent Types

| Type         | Purpose                       | Invocation                                   | Examples               |
| ------------ | ----------------------------- | -------------------------------------------- | ---------------------- |
| **Primary**  | Main agents you interact with | Tab key to switch                            | build, plan            |
| **Subagent** | Specialized workers           | `@mention` or auto-invoked by primary agents | general, explore       |
| **Hidden**   | Internal workers              | Only via Task tool from other agents         | Custom internal agents |

### 2. Built-in Orchestration Flow

```
You (in build mode):
  "Research authentication patterns and then implement OAuth"

build agent:
  1. Invokes @explore subagent: "Find existing auth patterns"
  2. explore creates child session, searches codebase, returns findings
  3. Invokes @general subagent: "Research OAuth2 best practices"
  4. general creates child session, researches, returns plan
  5. build implements the OAuth based on research
```

**Navigation:**

- You're in build session (parent)
- Press `<Leader>+Right` → jump to explore session (child 1)
- Press `<Leader>+Right` → jump to general session (child 2)
- Press `<Leader>+Right` → back to build session (parent)

### 3. Session Hierarchy

```
Parent Session (build)
  ├── Child Session 1 (explore subagent)
  ├── Child Session 2 (general subagent)
  └── Child Session 3 (another subagent)
```

All tracked automatically by OpenCode with:

- `opencode session list` - see all sessions
- `--session <id>` - attach to specific session
- `<Leader>+Right/Left` - navigate between related sessions

### 4. Permission Control

You can control which agents can invoke which subagents:

```json
{
  "agent": {
    "orchestrator": {
      "mode": "primary",
      "permission": {
        "task": {
          "*": "deny", // Block all by default
          "orchestrator-*": "allow", // Allow my workers
          "general": "ask" // Ask permission for general
        }
      }
    }
  }
}
```

## What Bonsai Should Actually Do

### Current Role (Wrong Direction)

- ❌ Building custom session tracking
- ❌ Managing agent dispatch
- ❌ Creating log files instead of using sessions
- ❌ Custom status command

### Correct Role (Worktree-Aware Layer)

Bonsai should be a **thin orchestration layer** that:

✅ **Maps worktrees to OpenCode sessions**

```bash
# Bonsai knows: feature-auth worktree → session ses_abc123
bonsai agent status
# Shows: feature-auth | active | last updated 5m ago

bonsai agent attach feature-auth
# Runs: opencode --session ses_abc123
```

✅ **Configures agents per worktree**

```toml
# ~/.config/bonsai/fermat.toml
[ai_tool]
name = "opencode"

[ai_tool.agents.feature]
agent = "build"
model = "anthropic/claude-sonnet-4"

[ai_tool.agents.bugfix]
agent = "plan"  # Read-only for bug investigation
model = "anthropic/claude-haiku-4"
```

✅ **Git workflow integration**

```bash
bonsai grow feature-auth
# Creates worktree, optionally starts OpenCode session

bonsai agent send feature-auth
# Starts OpenCode in that worktree with configured agent
```

✅ **Worktree cleanup integration**

```bash
bonsai prune feature-auth
# Warns if OpenCode session still active
# Option to close session before pruning
```

## Architecture Comparison

### Option A: Custom Conductor (What We Were Building)

```
User → Bonsai → Custom Session Registry → Custom Logs → OpenCode (as tool)
                ↓
           Custom Agent Management
           Custom Status Tracking
           Custom Attachment Logic
```

**Problems:**

- Duplicates OpenCode's session management
- Custom registry can get out of sync
- More code to maintain
- Missing OpenCode's native features (navigation, hierarchy, etc.)

### Option B: OpenCode Native (Recommended)

```
User → Bonsai (thin layer) → OpenCode Sessions
                              ↓
                         Native Agent System
                         Native Session Tracking
                         Native Child Sessions
                         Native Navigation
```

**Benefits:**

- Let OpenCode handle all session/agent complexity
- Bonsai just maps worktrees → sessions
- Use `opencode session list` as source of truth
- Natural integration with OpenCode workflows
- Less code, more features

## Recommended Implementation

### 1. Minimal Bonsai Session Tracking

```typescript
// Just store the mapping
interface WorktreeSession {
  worktreePath: string;
  worktreeName: string;
  sessionId: string; // OpenCode session ID
  startedAt: string;
}

// Source of truth is OpenCode
async function getActiveSession(worktreePath: string) {
  const sessions = await $`opencode session list --format json`.json();
  return sessions.find((s) => s.directory === worktreePath);
}
```

### 2. Bonsai Commands Become Thin Wrappers

```bash
# bonsai agent send <worktree>
# → opencode --dir <worktree> --prompt <task> --agent <configured-agent>
# → Extract session ID from output
# → Store in registry

# bonsai agent status
# → opencode session list --format json
# → Filter by worktree base directory
# → Display with worktree names

# bonsai agent attach <worktree>
# → Look up session ID for worktree
# → opencode --session <id>
# → User naturally in OpenCode, can use Tab, @mention, etc.

# bonsai logs <worktree>
# → Look up session ID
# → opencode export <id> | format output
# OR tail the OpenCode log file if user wants live logs
```

### 3. Agent Configuration in Bonsai Config

```toml
# ~/.config/bonsai/myrepo.toml
[repo]
path = "/Users/me/myrepo"
worktree_base = "/Users/me/myrepo.worktrees"

[ai_tool]
name = "opencode"
default_agent = "build"

# Agent configs that Bonsai passes to OpenCode
[ai_tool.agents.build]
model = "anthropic/claude-sonnet-4"
temperature = 0.3

[ai_tool.agents.plan]
model = "anthropic/claude-haiku-4"
temperature = 0.1
```

When starting OpenCode:

```bash
opencode --agent build --model anthropic/claude-sonnet-4 ...
```

### 4. Leverage OpenCode's Orchestration

**User wants parallel work:**

```
User in OpenCode (in worktree):
  "@general research OAuth2 best practices"
  "@explore find our existing auth code"

OpenCode handles:
  - Creating child sessions for each subagent
  - Running them (could be parallel internally)
  - Returning results to parent session
  - Session hierarchy and navigation
```

**Bonsai's role:** None! User is just using OpenCode naturally.

## What About Conductor?

**Conductor is redundant** because OpenCode already has:

- ✅ Agent orchestration (primary + subagents)
- ✅ Task delegation (Task tool)
- ✅ Session hierarchy (parent/child)
- ✅ Session navigation (<Leader>+Right/Left)
- ✅ Permission controls (who can invoke what)

**When you might need Conductor:**

- If you were building a custom AI system from scratch
- If you needed orchestration features OpenCode doesn't have
- If you wanted to orchestrate across multiple AI tools (OpenCode + Claude Code + Custom)

**For Bonsai's use case:**
You're just managing worktrees with OpenCode. OpenCode already handles everything else. Conductor would add complexity with no benefit.

## Migration Path

### Phase 1: Stop Building Custom Conductor ✅

- Don't build custom agent dispatch
- Don't build custom session management
- Don't build custom orchestration

### Phase 2: Make Bonsai a Thin Layer ⏳

1. Store only: `worktree → session ID mapping`
2. Use `opencode session list` as source of truth
3. Commands become OpenCode wrappers

### Phase 3: Clean Up 🔮

1. Remove custom session registry (use OpenCode's)
2. Remove log file tailing (use `opencode export` or native attach)
3. Keep only worktree-specific logic

## Final Recommendation

**Do NOT build Conductor into Bonsai.**

**DO:**

1. Use OpenCode's native agent system
2. Use OpenCode's native session management
3. Make Bonsai commands thin wrappers around OpenCode CLI
4. Let users naturally use OpenCode features (Tab, @mention, <Leader>+Right/Left)

**Bonsai's value:**

- Maps worktrees to sessions
- Integrates with git workflow (grow/prune)
- Configures OpenCode per-worktree
- Provides convenience commands for worktree+session management

**OpenCode's value:**

- Everything else (agents, sessions, orchestration, navigation, tools, permissions)

This keeps Bonsai focused and maintainable while leveraging OpenCode's full power.
