# Release Notes Enhancement Summary

## What Was Implemented

Enhanced the GitHub release workflow to automatically generate comprehensive release notes with:

### 1. Changelog from Git Commits
- Parses commits since last release
- Groups by type (features, fixes, docs, etc.)
- Supports conventional commit format
- Links to individual commits

### 2. Categorized Sections
- ⚠️ BREAKING CHANGES
- ✨ Features
- 🐛 Bug Fixes
- 📚 Documentation
- ♻️ Refactoring
- ✅ Tests
- 🔧 Chores
- 📦 Other Changes

### 3. Installation Instructions
- Platform-specific binary download links
- Copy-paste install commands
- Upgrade instructions for existing users

### 4. PR Integration
- Includes PR title and body
- Preserves manual release notes
- Supports version bumping via PR labels

## Files Modified/Created

### Modified
- `scripts/generate-release-notes.ts` - Enhanced with changelog generation

### Created
- `docs/RELEASE_NOTES_EXAMPLE.md` - Example release notes
- `CONTRIBUTING.md` - Contribution guidelines with commit message format

### Existing (Unchanged)
- `.github/workflows/release.yml` - Already configured to use release notes script

## How It Works

1. **PR Merged to Main** → Release workflow triggers
2. **Get Commits** → Fetches commits since last tag
3. **Parse Messages** → Extracts type, scope, breaking changes
4. **Generate Changelog** → Groups and formats commits
5. **Create Release** → Posts to GitHub with formatted notes

## Commit Message Format

To get good release notes, use conventional commits:

```bash
# Features
git commit -m "feat(send): add multi-worktree dispatch"

# Bug fixes
git commit -m "fix(status): handle missing sessions"

# Breaking changes
git commit -m "feat(config)!: migrate to YAML"
```

## Example Release Notes

```markdown
## Release v0.2.0

**Version bump:** minor

## Changelog

### ✨ Features
- **send:** Add AI workflow command ([abc123](link))
- **status:** Add telescope UI ([def456](link))

### 🐛 Bug Fixes
- **init:** Fix AI tool detection ([ghi789](link))

## Installation

### Download Pre-built Binaries
...
```

## Testing

Test locally:

```bash
TAG="v0.2.0" BUMP_TYPE="minor" PR_TITLE="Test" \
  bun run scripts/generate-release-notes.ts

cat /tmp/release-notes.md
```

## Benefits

✅ **Automatic** - No manual changelog maintenance
✅ **Consistent** - Same format every release  
✅ **Detailed** - Links to every commit
✅ **User-Friendly** - Clear installation instructions
✅ **Searchable** - Easy to find specific changes

## Next Steps

1. Use conventional commits for new changes
2. Add PR labels (major/minor/patch) for version control
3. Release notes will automatically improve over time

## Documentation

- Full examples: `docs/RELEASE_NOTES_EXAMPLE.md`
- Contributing guide: `CONTRIBUTING.md`
- GitHub workflow: `.github/workflows/release.yml`
