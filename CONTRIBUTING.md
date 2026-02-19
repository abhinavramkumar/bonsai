# Contributing to Bonsai

Thank you for your interest in contributing to bonsai! This guide will help you get started.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- Git
- A bonsai-compatible project to test with

### Getting Started

```bash
# Clone the repository
git clone https://github.com/abhinavramkumar/bonsai.git
cd bonsai

# Install dependencies
bun install

# Build the project
bun run build

# Run in development mode
bun src/cli.ts --help

# Run tests
./scripts/test-ai-workflow.sh
```

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for clear and automated release notes.

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **refactor**: Code refactoring (no functional changes)
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (dependencies, CI, etc.)
- **perf**: Performance improvements
- **style**: Code style changes (formatting, etc.)

### Examples

```bash
# Simple feature
git commit -m "feat(send): add multi-worktree dispatch support"

# Bug fix with scope
git commit -m "fix(status): handle missing session files gracefully"

# Documentation
git commit -m "docs: add AI workflow examples to README"

# Breaking change (note the !)
git commit -m "feat(config)!: migrate to YAML format"

# With detailed body
git commit -m "feat(ai-tools): add Cursor integration

- Implement Cursor adapter
- Add session tracking via file watcher
- Update documentation
- Add integration tests

Closes #42"
```

### Why This Matters

Good commit messages help us:

1. **Generate Release Notes** - Automatically categorize changes
2. **Track Changes** - Understand what changed and why
3. **Version Bumping** - Determine semantic versioning (major/minor/patch)

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clear, focused commits
- Follow existing code style
- Add tests if applicable
- Update documentation

### 3. Test Your Changes

```bash
# Build and test
bun run build
./scripts/test-ai-workflow.sh

# Manual testing
bun src/cli.ts <your-command>
```

### 4. Submit Pull Request

- Push your branch to GitHub
- Create a PR against `main`
- Fill out the PR template
- Add appropriate labels (see below)

### PR Labels

Labels control version bumping in releases:

- `major` - Breaking changes (v1.0.0 → v2.0.0)
- `minor` - New features (v1.0.0 → v1.1.0)
- `patch` - Bug fixes (v1.0.0 → v1.0.1)

If no label is provided, `patch` is assumed.

## Release Process

Releases are automated via GitHub Actions when PRs are merged to `main`:

1. **PR Merged** → Triggers release workflow
2. **Version Bumped** → Based on PR labels or commit messages
3. **Binaries Built** → For all platforms (macOS, Linux)
4. **Release Notes Generated** → From commits and PR description
5. **GitHub Release Created** → With binaries and changelog

### Release Notes

The release notes are automatically generated from:

- Git commits between releases
- PR title and description
- Conventional commit messages

Example output:

```markdown
## Release v0.2.0

**Version bump:** minor

### Add AI workflow system

## Changelog

### ✨ Features

- **send:** Add bonsai agent send command
- **status:** Add telescope UI

### 🐛 Bug Fixes

- **init:** Fix AI tool detection

## Installation

[Download instructions...]
```

See [RELEASE_NOTES_EXAMPLE.md](docs/RELEASE_NOTES_EXAMPLE.md) for more examples.

## Code Style

We use Prettier for code formatting:

```bash
# Format code
bun run format

# Check formatting
bun run format:check
```

Pre-commit hooks automatically format staged files.

## Testing

### Automated Tests

```bash
# Run test suite
./scripts/test-ai-workflow.sh
```

### Manual Testing

Test your changes with a real repository:

```bash
cd ~/Projects/test-project
bun /path/to/bonsai/src/cli.ts <command>
```

### Test Checklist

- [ ] Command executes without errors
- [ ] Error messages are clear and helpful
- [ ] Help text is accurate
- [ ] Shell completions work
- [ ] Config changes are backward compatible
- [ ] Binaries compile for all platforms

## Project Structure

```
bonsai/
├── src/
│   ├── cli.ts                 # Main entry point
│   ├── commands/              # Command implementations
│   │   ├── init.ts
│   │   ├── grow.ts
│   │   ├── send.ts
│   │   ├── status.ts
│   │   └── ...
│   └── lib/                   # Shared utilities
│       ├── config.ts
│       ├── git.ts
│       ├── ai-tool.ts
│       └── ...
├── scripts/                   # Build and utility scripts
├── docs/                      # Documentation
├── .github/workflows/         # CI/CD
└── tests/                     # Test files (future)
```

## Adding a New Command

1. Create `src/commands/your-command.ts`
2. Implement the command function
3. Add routing in `src/cli.ts`
4. Update help text
5. Add shell completions in `src/commands/completions.ts`
6. Document in README.md
7. Add tests

## Adding a New AI Tool

1. Create `src/lib/ai-tools/your-tool.ts`
2. Implement the `AITool` interface
3. Add to factory in `src/lib/ai-tool.ts`
4. Update config types
5. Add detection logic
6. Document in `docs/AI_WORKFLOW.md`
7. Add tests

## Questions?

- **Issues:** [GitHub Issues](https://github.com/abhinavramkumar/bonsai/issues)
- **Discussions:** [GitHub Discussions](https://github.com/abhinavramkumar/bonsai/discussions)

## License

By contributing to bonsai, you agree that your contributions will be licensed under the MIT License.
