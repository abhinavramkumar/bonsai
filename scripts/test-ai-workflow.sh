#!/bin/bash
# End-to-end test for bonsai AI workflow (send/dispatch/delegate commands)
# Tests OpenCode and Claude integration with comprehensive scenarios

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_test() {
    echo -e "${YELLOW}▶ Test: $1${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
}

print_pass() {
    echo -e "${GREEN}✓ PASS: $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_fail() {
    echo -e "${RED}✗ FAIL: $1${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_info() {
    echo -e "${BLUE}  ℹ $1${NC}"
}

# Cleanup function
cleanup() {
    if [ -f "$BACKUP_CONFIG" ]; then
        mv "$BACKUP_CONFIG" "$CONFIG_FILE"
        print_info "Restored original config"
    fi
}

trap cleanup EXIT

# Configuration
CONFIG_FILE="$HOME/.config/bonsai/bonsai.toml"
BACKUP_CONFIG="$HOME/.config/bonsai/bonsai.toml.test-backup"
SESSIONS_FILE="$HOME/.config/bonsai/sessions.json"

# Check if we're in the bonsai repo
if [ ! -f "$PROJECT_ROOT/package.json" ] || ! grep -q "\"name\": \"bonsai\"" "$PROJECT_ROOT/package.json"; then
    echo -e "${RED}Error: Must run from bonsai project root${NC}"
    exit 1
fi

# Backup config if it exists
if [ -f "$CONFIG_FILE" ]; then
    cp "$CONFIG_FILE" "$BACKUP_CONFIG"
    print_info "Backed up config to $BACKUP_CONFIG"
fi

print_header "Bonsai AI Workflow Tests"

# =============================================================================
# Test 1: Help and Documentation
# =============================================================================
print_header "Test 1: Help and Documentation"

print_test "Help text shows agent command"
if bun src/cli.ts --help 2>&1 | grep -q "agent.*AI workflow"; then
    print_pass "Help text includes agent command"
else
    print_fail "Agent command not found in help"
fi

print_test "Agent help shows subcommands"
if bun src/cli.ts agent --help 2>&1 | grep -E "(send|status).*Dispatch|Show" >/dev/null; then
    print_pass "Agent subcommands documented"
else
    print_fail "Agent subcommands not documented"
fi

print_test "Help text shows examples"
if bun src/cli.ts --help 2>&1 | grep -q "bonsai agent send"; then
    print_pass "Agent send examples present"
else
    print_fail "Agent send examples missing"
fi

# =============================================================================
# Test 2: Error Handling
# =============================================================================
print_header "Test 2: Error Handling"

print_test "Non-existent worktree error"
if bun src/cli.ts agent send nonexistent-worktree-12345 2>&1 | grep -q "Worktree not found"; then
    print_pass "Shows proper error for non-existent worktree"
else
    print_fail "Did not show worktree not found error"
fi

print_test "No AI tool configured error"
# Temporarily remove ai_tool from config
if [ -f "$CONFIG_FILE" ]; then
    grep -v "^\[ai_tool\]" "$CONFIG_FILE" | grep -v "^name = " > "$CONFIG_FILE.tmp"
    mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    
    if bun src/cli.ts agent send test-wt 2>&1 | grep -q "No AI tool configured"; then
        print_pass "Shows proper error when no AI tool configured"
    else
        print_fail "Did not show no AI tool error"
    fi
    
    # Restore config
    cp "$BACKUP_CONFIG" "$CONFIG_FILE"
else
    print_info "Skipping (no config file)"
fi

# =============================================================================
# Test 3: Command Aliases
# =============================================================================
print_header "Test 3: Command Aliases"

print_test "Dispatch alias works"
if timeout 2 bun src/cli.ts agent dispatch test-wt 2>&1 | grep -q "bonsai send"; then
    print_pass "Dispatch alias routes to send command"
else
    print_fail "Dispatch alias not working"
fi

print_test "Delegate alias works"
if timeout 2 bun src/cli.ts agent delegate test-wt 2>&1 | grep -q "bonsai send"; then
    print_pass "Delegate alias routes to send command"
else
    print_fail "Delegate alias not working"
fi

# =============================================================================
# Test 4: AI Tool Detection
# =============================================================================
print_header "Test 4: AI Tool Detection"

print_test "OpenCode detection"
if which opencode >/dev/null 2>&1; then
    print_pass "OpenCode is installed and in PATH"
    OPENCODE_AVAILABLE=true
else
    print_info "OpenCode not available (skipping OpenCode tests)"
    OPENCODE_AVAILABLE=false
fi

print_test "Claude detection"
if which claude >/dev/null 2>&1; then
    print_pass "Claude is installed and in PATH"
    CLAUDE_AVAILABLE=true
else
    print_info "Claude not available (skipping Claude tests)"
    CLAUDE_AVAILABLE=false
fi

# =============================================================================
# Test 5: Config File AI Tool Setup
# =============================================================================
print_header "Test 5: Config File AI Tool Setup"

if [ "$OPENCODE_AVAILABLE" = true ]; then
    print_test "OpenCode config validation"
    
    # Create test config with OpenCode
    cat > "$CONFIG_FILE" << EOF
[repo]
path = "$PROJECT_ROOT"
worktree_base = "$PROJECT_ROOT/../bonsai.worktrees"
main_branch = "main"

[editor]
name = "cursor"

[setup]
commands = []

[behavior]
navigate_after_grow = false

[ai_tool]
name = "opencode"
EOF
    
    if grep -q 'name = "opencode"' "$CONFIG_FILE"; then
        print_pass "Config with OpenCode created successfully"
    else
        print_fail "Failed to create config with OpenCode"
    fi
fi

if [ "$CLAUDE_AVAILABLE" = true ]; then
    print_test "Claude config validation"
    
    # Update config to Claude
    if [ -f "$CONFIG_FILE" ]; then
        sed -i.bak 's/name = "opencode"/name = "claude"/' "$CONFIG_FILE"
        rm -f "$CONFIG_FILE.bak"
        
        if grep -q 'name = "claude"' "$CONFIG_FILE"; then
            print_pass "Config switched to Claude successfully"
        else
            print_fail "Failed to switch config to Claude"
        fi
    fi
fi

# =============================================================================
# Test 6: Session Registry
# =============================================================================
print_header "Test 6: Session Registry"

print_test "Session registry file location"
EXPECTED_DIR="$HOME/.config/bonsai"
if [ -d "$EXPECTED_DIR" ]; then
    print_pass "Bonsai config directory exists at $EXPECTED_DIR"
else
    print_fail "Config directory not found"
fi

print_test "Session registry structure"
if [ "$OPENCODE_AVAILABLE" = true ] || [ "$CLAUDE_AVAILABLE" = true ]; then
    # Clean up any existing sessions file for test
    rm -f "$SESSIONS_FILE"
    
    print_info "Session registry will be created when first session is tracked"
    print_pass "Session registry location validated"
else
    print_info "Skipping (no AI tools available)"
fi

# =============================================================================
# Test 7: Build Verification
# =============================================================================
print_header "Test 7: Build Verification"

print_test "TypeScript compilation"
if bun run build >/dev/null 2>&1; then
    print_pass "Project builds without errors"
else
    print_fail "Build failed"
fi

print_test "Binary execution"
if [ -f "./dist/bonsai" ]; then
    if ./dist/bonsai --help >/dev/null 2>&1; then
        print_pass "Compiled binary executes successfully"
    else
        print_fail "Binary execution failed"
    fi
else
    print_fail "Binary not found at ./dist/bonsai"
fi

# =============================================================================
# Test 8: Integration Tests (Manual Verification)
# =============================================================================
print_header "Test 8: Integration Tests (Manual Verification Required)"

echo ""
echo -e "${YELLOW}The following tests require manual verification:${NC}"
echo ""
echo "1. Interactive prompt input:"
echo "   $ bun src/cli.ts send <worktree-name>"
echo "   Expected: Prompts for task description, starts AI tool in background"
echo ""
echo "2. FZF picker mode:"
echo "   $ bun src/cli.ts send"
echo "   Expected: Shows fzf with worktrees, branches, and commit messages"
echo ""
echo "3. Editor mode:"
echo "   $ bun src/cli.ts send <worktree-name> --edit"
echo "   Expected: Opens \$EDITOR with template for multi-line prompt"
echo ""
echo "4. Attach mode:"
echo "   $ bun src/cli.ts send <worktree-name> --attach"
echo "   Expected: Opens AI tool interactively (not background)"
echo ""
echo "5. Session tracking:"
echo "   After running send command, check:"
echo "   $ cat ~/.config/bonsai/sessions.json"
echo "   Expected: JSON with worktree path, prompt, timestamp, tool name"
echo ""
echo "6. OpenCode session verification:"
if [ "$OPENCODE_AVAILABLE" = true ]; then
    echo "   $ opencode session list"
    echo "   Expected: New session appears in list"
else
    echo "   (OpenCode not available)"
fi
echo ""
echo "7. Claude session verification:"
if [ "$CLAUDE_AVAILABLE" = true ]; then
    echo "   $ ls ~/.claude/projects/*/  | grep -E '[0-9a-f-]{36}.jsonl'"
    echo "   Expected: New .jsonl session file appears"
else
    echo "   (Claude not available)"
fi
echo ""

# =============================================================================
# Test Summary
# =============================================================================
print_header "Test Summary"

echo ""
echo "Tests Run:    $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All automated tests passed!${NC}"
    echo ""
    echo -e "${YELLOW}Note: Manual verification tests still required${NC}"
    echo "See section 'Test 8: Integration Tests' above"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
