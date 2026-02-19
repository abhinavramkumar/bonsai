# README design: critique and pattern

## Critical review of the current bonsai README

### Engagement

- **Tagline** — "Carefully cultivate your branches" is memorable but vague. It doesn’t say _what_ the tool does. Many successful CLIs pair a short metaphor with a concrete one-liner (e.g. fd: "A simple, fast and user-friendly alternative to `find`").
- **Hero visual** — The asset is decorative (bonsai art), not a **demo**. fd and fzf put a screencast/GIF near the top so visitors see the tool in action in the first few seconds. Bonsai has no terminal demo, so the value is explained only in text.
- **No badges** — Ripgrep/fd/fzf use CI, version, and sometimes packaging badges. Their READMEs feel active and maintained; the lack of badges makes the repo feel quieter.
- **Value is buried** — The strong before/after (stash hell vs `grow`/`prune`) lives in "Why bonsai?" after a generic one-liner. The _outcome_ ("Switch context in one command, no stash, no conflict") could be the first thing people read.
- **No comparison** — Ripgrep has "Why should I use" and benchmarks; fd says "alternative to find." Bonsai doesn’t say "alternative to manual worktrees" or "vs. stash/checkout," so the positioning is unclear.

### Ease of understanding / grok

- **Jargon** — "Git worktree workflow CLI" is accurate but "worktree" isn’t universal. A single plain-English line would help (e.g. "One command to spin up a separate folder for a branch, with its own deps and editor.").
- **Order of sections** — Installation comes before Quick Start. Many visitors want to see "what do I run?" before "how do I install?" Popular CLIs often do: what it is → why → install → minimal usage, then deep dives.
- **Density** — The first screen has tagline, description, Why bonsai (with two code blocks), then Installation. Below that, Quick Start, Commands, How grow Works, How prune Works, Configuration, Branch mapping, Editors, Shell integration, Example workflow, Edge cases, Tips, Development, Architecture, Requirements. That’s a lot before someone has decided they care. fd/ripgrep/fzf keep the first scroll to: what, why (bullets), install, one or two usage examples.
- **Implementation detail too early** — "How `grow` Works" and "How `prune` Works" are step-by-step internals. Useful for reference, but they read like design docs. In top CLIs this is either lower in the README or in a separate doc; the first pass is "run this, get that."

### Selling the value proposition

- **Problem stated, outcome understated** — The scenario (urgent bug while on a feature branch) is clear. The payoff ("No stashing. No conflicts. No mental overhead") is good but could be one sharp headline (e.g. "One command to switch context without touching your current branch or editor.").
- **No "who is this for?"** — Maintainers juggling hotfixes, people doing code review on multiple branches, folks who hate stash—none of that is said. A single line would help readers self-identify.
- **Unique combo not summarized** — Bonsai’s differentiator is worktrees + per-worktree setup (e.g. `npm install`) + open editor + shell completions/switch. That combo isn’t stated as a single value prop; it’s spread across init, grow, setup, completions. One "What you get" or "Features" block would tie it together.
- **No "why not" or alternatives** — Ripgrep’s "Why shouldn’t I use ripgrep?" builds trust and sets expectations. Bonsai doesn’t say when to use raw `git worktree` or when bonsai isn’t the right fit.

---

## Pattern used by popular GitHub CLIs (ripgrep, fd, fzf)

### 1. Hero (first screen)

- **Name + one-line description** in plain language (and optionally "alternative to X" or "for people who Y").
- **Badges**: CI, version, license (and packaging if applicable).
- **Demo**: GIF or short screencast (or at least a terminal screenshot) showing one happy path. This is the biggest gap in the current bonsai README.
- **Features / Highlights**: 3–5 outcome-focused bullets (fd/fzf style), not implementation. E.g. "One command to create a branch environment," "Runs your setup (install, migrate) automatically," "Opens in your editor," "Tab-complete branches."

### 2. Value block

- **"Why [tool]?"** or **"The problem"** with a very short before/after (you already have this; it can be tightened and moved up).
- Optional: **"Who it’s for"** in one sentence (e.g. "For maintainers and anyone who switches between branches often.").

### 3. Install

- **One primary method first** (e.g. curl script or Homebrew). Then "Or download from Releases," then other methods.
- Optional: note like "To upgrade later: `bonsai upgrade`."

### 4. Quick start / Usage

- **1–3 commands** that produce a visible result, with minimal commentary.
- Then a link to "Commands" or "Full documentation" for the rest. Keep the first usage block short so people can try immediately.

### 5. Reference (below fold or linked)

- Commands table, configuration, branch mapping, editors, shell integration.
- "How grow/prune works," edge cases, tips, development, architecture.
- **Table of contents** if the README is long (like fzf/ripgrep).

### 6. Trust and boundaries

- Requirements, license.
- Optional: "When to use raw `git worktree`" or "Why not use bonsai?" to set expectations and build trust.

---

## Suggested README structure for bonsai

Use this as a structural template; wording can stay in your voice.

```markdown
# bonsai

[Badges: CI, version, license]

> One command to work on another branch—separate folder, deps, and editor. No stash, no conflict.

A Git worktree CLI that creates a full environment per branch: clone-like directory, setup commands (e.g. npm install), and your editor. For when you need to switch context without touching your current work.

[Optional: 30s terminal GIF or screencast]

## Features

- **One command** — `bonsai grow <branch>` creates the worktree, runs setup, opens the editor.
- **Isolated envs** — Each branch gets its own directory, node_modules, and editor state.
- **No stash** — Your current branch and editor stay untouched.
- **Shell integration** — Tab-complete branches, `bonsai switch` to jump between worktrees.

## Why bonsai?

[Keep your current "problem" + "with bonsai" before/after code blocks; optionally shorten to 3–4 lines each.]

## Installation

[Primary: curl script. Then Homebrew, Releases, from source. Keep shell integration as a short "recommended" note.]

## Quick start

[Minimal 3–5 line snippet: cd repo → bonsai init → bonsai grow feature/foo. One sentence: "Then run bonsai list, bonsai switch, bonsai prune when done."]
[Link: "Full command reference" → #commands]

## Commands

[Existing table]

## Configuration

[Short version: where config lives, one small toml example, link to "Setup commands" if needed.]

---

[Collapsible or "More" section, or separate doc:]

## Reference

- How grow works / How prune works
- Branch → folder mapping
- Supported editors
- Shell integration (completions, switch)
- Example workflow
- Edge cases (already checked out, stale ref, dirty prune)
- Tips

## Development

## Requirements

## License
```

---

## Summary

- **Engagement**: Add a terminal demo (GIF/screencast), badges, and a short Features block; move the value prop (one command, no stash, isolated env) into the first screen.
- **Grok**: Add one plain-English sentence; put Quick start (or at least "try this") before long reference sections; move "How grow/prune works" and edge cases into a Reference / "More" area.
- **Value proposition**: State the unique combo (worktree + setup + editor + completions) in one place; add "who it’s for" and optionally "when not to use" or "vs. raw worktrees."

The current README is accurate and complete; the main improvements are **order** (value and quick start first), **one strong demo** (terminal), and **one clear summary** of what bonsai gives you that raw git worktrees don’t.
