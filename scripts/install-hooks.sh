#!/bin/bash
# Install git hooks for the bonsai project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo "Installing git hooks..."

# Create pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/sh
# Pre-commit hook to format code with Prettier

# Get list of staged TypeScript/JavaScript files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx|json)$' || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Format staged files
echo "Formatting staged files with Prettier..."
echo "$STAGED_FILES" | xargs bunx prettier --write

# Stage the formatted files
echo "$STAGED_FILES" | xargs git add

exit 0
EOF

chmod +x "$HOOKS_DIR/pre-commit"

echo "✓ Pre-commit hook installed"
echo ""
echo "The hook will automatically format your code before each commit."
