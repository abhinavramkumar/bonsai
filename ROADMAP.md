# Bonsai Roadmap

Prioritized list of features based on user value, implementation complexity, and workflow impact.

## Phase 1: Core Enhancements (High Priority)

### 1. `bonsai sync` - Update worktrees from remote
**Priority:** 🔴 Critical  
**Complexity:** Low  
**Impact:** High

Update worktrees with latest changes from remote. Essential for keeping multiple worktrees in sync.

```bash
bonsai sync <branch>        # Sync specific worktree
bonsai sync --all           # Sync all worktrees
```

**Why first:** Users constantly need to pull latest changes. Currently requires manual `git pull` in each worktree.

---

### 2. `bonsai status` - Detailed worktree information
**Priority:** 🔴 Critical  
**Complexity:** Low  
**Impact:** High

Show comprehensive status of a worktree: branch, commit, uncommitted changes, upstream status, last activity.

```bash
bonsai status <branch>      # Status of specific worktree
bonsai status               # Status of current worktree
```

**Why second:** Users need visibility into worktree state. Helps debug issues and understand what's happening.

---

### 3. Enhanced `bonsai list` output
**Priority:** 🟡 High  
**Complexity:** Low  
**Impact:** Medium

Add verbose mode and filtering options to list command.

```bash
bonsai list --verbose       # Show commit hash, last modified, dirty status
bonsai list --dirty         # Show only worktrees with uncommitted changes
bonsai list --filter <pattern>
```

**Why third:** Improves existing functionality with minimal effort. High user value.

---

### 4. `bonsai prune --all` - Bulk cleanup
**Priority:** 🟡 High  
**Complexity:** Low  
**Impact:** Medium

Remove multiple worktrees at once with safety checks.

```bash
bonsai prune --all          # Prune all worktrees (with confirmation)
bonsai prune --stale       # Remove worktrees for deleted branches
bonsai prune --dry-run     # Preview what would be pruned
```

**Why fourth:** Common workflow need. Users often want to clean up multiple worktrees.

---

## Phase 2: Workflow Improvements (Medium Priority)

### 5. `bonsai grow` enhancements
**Priority:** 🟡 High  
**Complexity:** Low-Medium  
**Impact:** Medium

Add flags to control grow behavior.

```bash
bonsai grow <branch> --no-editor    # Skip opening editor
bonsai grow <branch> --no-setup     # Skip setup commands
bonsai grow <branch> --from <ref>   # Create from specific branch/commit
bonsai grow --interactive           # Interactive branch picker (fzf-style)
```

**Why fifth:** Gives users more control over worktree creation. Interactive picker is high-value UX improvement.

---

### 6. `bonsai branch` - Branch management integration
**Priority:** 🟢 Medium  
**Complexity:** Medium  
**Impact:** Medium

List branches with worktree status indicators.

```bash
bonsai branch               # List all branches, show which have worktrees
bonsai branch --worktrees   # Show only branches with active worktrees
```

**Why sixth:** Helps users understand branch-to-worktree mapping. Useful for discovery.

---

### 7. Configuration improvements
**Priority:** 🟢 Medium  
**Complexity:** Low  
**Impact:** Low-Medium

Better config management and visibility.

```bash
bonsai config --show        # Display config without opening editor
bonsai config --reset       # Reset to defaults
```

**Why seventh:** Low effort, improves UX for config management.

---

## Phase 3: Advanced Features (Lower Priority)

### 8. `bonsai clean` - Maintenance utilities
**Priority:** 🟢 Medium  
**Complexity:** Medium  
**Impact:** Low-Medium

Clean up stale references and orphaned worktrees.

```bash
bonsai clean                # Clean stale worktree references
bonsai clean --orphaned    # Remove worktrees for deleted branches
```

**Why eighth:** Maintenance feature. Useful but not daily workflow.

---

### 9. `bonsai doctor` - Diagnostics
**Priority:** 🟢 Medium  
**Complexity:** Medium  
**Impact:** Low-Medium

Diagnose common issues and suggest fixes.

```bash
bonsai doctor               # Check for common issues
```

**Why ninth:** Helpful for troubleshooting but not core functionality.

---

### 10. Multi-repo support
**Priority:** 🔵 Low  
**Complexity:** High  
**Impact:** Medium

Manage worktrees across multiple repositories.

```bash
bonsai repo <name>          # Switch between repos
bonsai list --all-repos     # List worktrees across all repos
```

**Why tenth:** Complex feature. Most users work with single repo. Lower priority.

---

## Implementation Notes

### Quick Wins (Low complexity, high value)
- `bonsai sync` - Simple git pull wrapper
- `bonsai status` - Git status aggregation
- Enhanced `bonsai list` - Formatting improvements
- `bonsai prune --all` - Loop over existing prune logic

### Medium Effort (Medium complexity, high value)
- `bonsai grow --interactive` - Requires fzf integration or custom picker
- `bonsai branch` - Needs branch listing + worktree correlation
- `bonsai grow --from <ref>` - Additional git worktree options

### Future Considerations
- Self-update mechanism (`bonsai update`)
- Export/import worktree configurations
- Template system for common workflows
- IDE workspace file generation

---

## Success Metrics

Track adoption of new features:
- Usage frequency of new commands
- User feedback/requests
- GitHub issues/feature requests
- Community contributions

---

## Contributing

When implementing features:
1. Follow existing code patterns
2. Add comprehensive error handling
3. Include helpful error messages
4. Update README with examples
5. Consider edge cases (stale refs, missing dirs, etc.)
