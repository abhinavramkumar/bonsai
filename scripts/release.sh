#!/bin/bash
# Release helper script for bonsai
# Builds binaries for all platforms and prepares for GitHub release

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

echo -e "${GREEN}bonsai release helper${NC}"
echo "===================="
echo "Current version: ${VERSION}"
echo ""

# Confirm version
read -p "Is this the version you want to release? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please update version in package.json first"
    exit 1
fi

TAG="v${VERSION}"

# Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag $TAG already exists${NC}"
    exit 1
fi

# Build all binaries
echo -e "${YELLOW}Building binaries for all platforms...${NC}"
bun run build:all

# Verify binaries exist
BINARIES=(
    "dist/bonsai-darwin-x86_64"
    "dist/bonsai-darwin-arm64"
    "dist/bonsai-linux-x86_64"
    "dist/bonsai-linux-arm64"
)

for binary in "${BINARIES[@]}"; do
    if [ ! -f "$binary" ]; then
        echo -e "${RED}Error: Binary not found: $binary${NC}"
        exit 1
    fi
    echo "✓ $binary ($(du -h "$binary" | cut -f1))"
done

echo ""
echo -e "${GREEN}All binaries built successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the binaries locally"
echo "2. Commit and push changes:"
echo "   git add ."
echo "   git commit -m \"Release $TAG\""
echo "   git tag $TAG"
echo "   git push origin main"
echo "   git push origin $TAG"
echo ""
echo "3. Create GitHub release:"
echo "   gh release create $TAG \\"
for binary in "${BINARIES[@]}"; do
    echo "     $binary \\"
done
echo "     --title \"$TAG\" \\"
echo "     --notes \"Release notes\""
echo ""
echo "Or use the GitHub web UI:"
echo "https://github.com/abhinavramkumar/bonsai/releases/new"
