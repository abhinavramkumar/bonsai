# Creating a GitHub Release

This guide walks you through creating a GitHub release with platform-specific binaries.

## Prerequisites

- Bun installed
- Git repository set up
- GitHub CLI (`gh`) installed (optional, but recommended)

## Step 1: Build binaries for all platforms

Build binaries for all supported platforms:

```bash
bun run build:all
```

This creates:
- `dist/bonsai-darwin-x86_64` (macOS Intel)
- `dist/bonsai-darwin-arm64` (macOS Apple Silicon)
- `dist/bonsai-linux-x86_64` (Linux x64)
- `dist/bonsai-linux-arm64` (Linux ARM64)

## Step 2: Update version

Update the version in `package.json`:

```bash
# Edit package.json and bump version
# Or use npm version patch/minor/major
```

## Step 3: Create a git tag

```bash
git add .
git commit -m "Release v1.0.0"  # Use your version
git tag v1.0.0  # Use your version
git push origin main
git push origin v1.0.0
```

## Step 4: Create GitHub Release

### Option A: Using GitHub CLI (recommended)

```bash
gh release create v1.0.0 \
  dist/bonsai-darwin-x86_64 \
  dist/bonsai-darwin-arm64 \
  dist/bonsai-linux-x86_64 \
  dist/bonsai-linux-arm64 \
  --title "v1.0.0" \
  --notes "Release notes here"
```

### Option B: Using GitHub Web UI

1. Go to https://github.com/abhinavramkumar/bonsai/releases/new
2. Select the tag you just created (e.g., `v1.0.0`)
3. Add release title: `v1.0.0`
4. Add release notes describing what's new
5. Upload all four binaries:
   - `bonsai-darwin-x86_64`
   - `bonsai-darwin-arm64`
   - `bonsai-linux-x86_64`
   - `bonsai-linux-arm64`
6. Click "Publish release"

## Step 5: Verify installation

Test the install script:

```bash
# Test locally (modify install.sh to point to your test release)
curl -fsSL https://raw.githubusercontent.com/abhinavramkumar/bonsai/main/install.sh | sh
```

## Notes

- Binary names must match the pattern `bonsai-<platform>` for the install script to work
- The install script detects platform automatically
- Users can install with: `curl -fsSL https://raw.githubusercontent.com/abhinavramkumar/bonsai/main/install.sh | sh`
