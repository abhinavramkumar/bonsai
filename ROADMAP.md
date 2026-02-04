# Roadmap

What we're working toward—and what's on the back burner.

---

## Up next

**`bonsai sync`** — Pull latest in one or all worktrees. Right now you have to `git pull` in each worktree yourself; this would wrap that.

```bash
bonsai sync <branch>     # one worktree
bonsai sync --all       # all of them
```

**`bonsai status`** — Show what’s going on in a worktree: branch, commit, dirty files, upstream. No more guessing.

```bash
bonsai status            # current worktree
bonsai status feature/foo
```

**Better `bonsai list`** — Verbose mode (commit, last modified, dirty), and filter by pattern or only dirty worktrees.

```bash
bonsai list --verbose
bonsai list --dirty
bonsai list --filter "feature/*"
```

**`bonsai prune --all`** — Prune multiple worktrees at once, with confirmation. Plus `--stale` for deleted branches, `--dry-run` to preview.

---

## Then

**`bonsai grow` tweaks** — More control: `--no-editor`, `--no-setup`, `--from <ref>`, and an interactive branch picker. Also: grow from a PR in one shot (e.g. `bonsai grow pr/123`) for review workflows.

**`bonsai run <branch> -- <cmd>`** — Run a command in that worktree without leaving your shell. Handy for scripts and CI (e.g. “test every worktree”).

**`bonsai branch`** — List branches and show which ones have worktrees. Clears up the branch ↔ folder mapping.

**Config UX** — `bonsai config --show` and `--reset` so you can inspect or reset without opening the file.

**Repo-level config** — Optional `.bonsai.toml` (or similar) in the repo root that merges with your global config. Teams can commit shared setup and main_branch so everyone gets the same behavior.

**Hooks** — Optional `post_grow` / `pre_prune` (and friends) in config so you can run your own scripts at key moments.

---

## Later

**`bonsai clean`** — Fix stale worktree refs and remove worktrees for deleted branches.

**`bonsai doctor`** — Basic diagnostics: common problems and suggested fixes.

**Merged-branch hint** — In `list` / `status`, optionally say “this branch is merged into main, maybe prune it.” Opt-in so it doesn’t get in the way.

**Multi-repo** — Switch context across repos, list worktrees for all of them. Heavier lift; most people stick to one repo for now.

---

## README and docs

We want the first screen to sell the tool: one clear line, a short terminal demo (GIF or screencast), and badges (CI, version, license). Quick start before long reference; “How grow/prune works” and edge cases can live in a Reference section or separate doc. Add a line on who it’s for and when you might *not* use bonsai (e.g. raw worktrees). Details in `docs/README-DESIGN.md`.

---

## Backlog / maybe

- Presets (e.g. `bonsai grow --preset review <branch>` with different setup)
- Export/import config so you can share setups across machines
- Generate a VS Code/Cursor workspace file that points at all worktrees
- Windows (paths and git differ; we’d consider it if people ask)

---

## Contributing

When you work on a feature: follow existing patterns, handle errors and edge cases (stale refs, missing dirs), and update the README where it matters.
