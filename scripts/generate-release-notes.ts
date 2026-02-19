/**
 * Generates release notes with changelog from git commits
 * Writes to /tmp/release-notes.md for GitHub release
 * Used by .github/workflows/release.yml
 */
import { $ } from "bun";
import { writeFileSync } from "fs";

const tag = process.env.TAG ?? "";
const title = process.env.PR_TITLE ?? "";
const body = process.env.PR_BODY ?? "";
const bumpType = process.env.BUMP_TYPE ?? "";

interface Commit {
  hash: string;
  message: string;
  type: string;
  scope?: string;
  breaking: boolean;
}

/**
 * Get commits since last release tag
 */
async function getCommitsSinceLastRelease(): Promise<Commit[]> {
  // Get the previous tag
  const tagsResult = await $`git tag --sort=-version:refname`.quiet().nothrow();
  const tags = tagsResult.text().trim().split("\n").filter(Boolean);

  // If we have a previous tag, get commits since then; otherwise get all
  let range = "";
  if (tags.length > 0 && tags[0] !== tag) {
    range = `${tags[0]}..HEAD`;
  } else {
    // No previous tags, get all commits
    range = "HEAD";
  }

  // Get commit log
  const logResult = await $`git log ${range} --pretty=format:%H|%s`.quiet().nothrow();

  if (logResult.exitCode !== 0) {
    return [];
  }

  const lines = logResult.text().trim().split("\n").filter(Boolean);
  const commits: Commit[] = [];

  for (const line of lines) {
    const [hash, message] = line.split("|");
    if (!hash || !message) continue;

    // Skip version bump commits
    if (message.includes("bump version to") || message.includes("release v")) {
      continue;
    }

    // Parse conventional commit format: type(scope): message
    const match = message.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);

    if (match) {
      const [, type, scope, breaking, msg] = match;
      commits.push({
        hash: hash.substring(0, 7),
        message: msg || message,
        type: type || "other",
        scope,
        breaking: !!breaking,
      });
    } else {
      // Not a conventional commit, categorize by keywords
      let type = "other";
      const lowerMsg = message.toLowerCase();

      if (lowerMsg.startsWith("feat") || lowerMsg.includes("add")) {
        type = "feat";
      } else if (lowerMsg.startsWith("fix") || lowerMsg.includes("fix")) {
        type = "fix";
      } else if (lowerMsg.startsWith("docs") || lowerMsg.includes("doc")) {
        type = "docs";
      } else if (lowerMsg.startsWith("chore") || lowerMsg.includes("chore")) {
        type = "chore";
      } else if (lowerMsg.startsWith("refactor") || lowerMsg.includes("refactor")) {
        type = "refactor";
      } else if (lowerMsg.startsWith("test") || lowerMsg.includes("test")) {
        type = "test";
      }

      commits.push({
        hash: hash.substring(0, 7),
        message: message,
        type,
        breaking: lowerMsg.includes("breaking"),
      });
    }
  }

  return commits;
}

/**
 * Group commits by type
 */
function groupCommitsByType(commits: Commit[]): Record<string, Commit[]> {
  const groups: Record<string, Commit[]> = {
    breaking: [],
    feat: [],
    fix: [],
    docs: [],
    refactor: [],
    test: [],
    chore: [],
    other: [],
  };

  for (const commit of commits) {
    if (commit.breaking) {
      groups.breaking!.push(commit);
    } else {
      const type = commit.type || "other";
      if (groups[type]) {
        groups[type]!.push(commit);
      } else {
        groups.other!.push(commit);
      }
    }
  }

  return groups;
}

/**
 * Format commit for markdown
 */
function formatCommit(commit: Commit): string {
  const scope = commit.scope ? `**${commit.scope}:** ` : "";
  return `- ${scope}${commit.message} ([${commit.hash}](../../commit/${commit.hash}))`;
}

/**
 * Generate markdown changelog
 */
function generateChangelog(commits: Commit[]): string {
  const groups = groupCommitsByType(commits);
  const sections: string[] = [];

  const typeLabels: Record<string, string> = {
    breaking: "⚠️ BREAKING CHANGES",
    feat: "✨ Features",
    fix: "🐛 Bug Fixes",
    docs: "📚 Documentation",
    refactor: "♻️ Refactoring",
    test: "✅ Tests",
    chore: "🔧 Chores",
    other: "📦 Other Changes",
  };

  for (const [type, label] of Object.entries(typeLabels)) {
    const typeCommits = groups[type];
    if (typeCommits && typeCommits.length > 0) {
      sections.push(`### ${label}\n`);
      for (const commit of typeCommits) {
        sections.push(formatCommit(commit));
      }
      sections.push(""); // Empty line between sections
    }
  }

  return sections.length > 0 ? sections.join("\n") : "_No changes_";
}

/**
 * Main function to generate release notes
 */
async function main() {
  let notes = `## Release ${tag}\n\n`;

  // Version bump info
  notes += `**Version bump:** ${bumpType}\n\n`;

  // PR title/body if available
  if (title && title !== "Manual release" && title !== "null") {
    notes += `### ${title}\n\n`;
    if (body && body !== "null") {
      notes += `${body}\n\n`;
    }
  }

  // Changelog from commits
  const commits = await getCommitsSinceLastRelease();

  if (commits.length > 0) {
    notes += `## Changelog\n\n`;
    notes += generateChangelog(commits);
    notes += `\n`;
  }

  // Installation instructions
  notes += `## Installation\n\n`;
  notes += `### Download Pre-built Binaries\n\n`;
  notes += `Choose the binary for your platform:\n\n`;
  notes += `- **macOS Intel:** \`bonsai-darwin-x86_64\`\n`;
  notes += `- **macOS Apple Silicon:** \`bonsai-darwin-arm64\`\n`;
  notes += `- **Linux x64:** \`bonsai-linux-x86_64\`\n`;
  notes += `- **Linux ARM64:** \`bonsai-linux-arm64\`\n\n`;
  notes += `Download, make executable, and move to your PATH:\n\n`;
  notes += `\`\`\`bash\n`;
  notes += `chmod +x bonsai-<platform>\n`;
  notes += `sudo mv bonsai-<platform> /usr/local/bin/bonsai\n`;
  notes += `\`\`\`\n\n`;

  // Upgrade command
  notes += `### Upgrade Existing Installation\n\n`;
  notes += `If you already have bonsai installed:\n\n`;
  notes += `\`\`\`bash\n`;
  notes += `bonsai upgrade\n`;
  notes += `\`\`\`\n`;

  writeFileSync("/tmp/release-notes.md", notes);

  // Also output to console for debugging in CI
  console.log("Generated release notes:");
  console.log("---");
  console.log(notes);
  console.log("---");
}

main().catch((error) => {
  console.error("Failed to generate release notes:", error);
  // Write minimal notes on error
  const fallbackNotes = `## Release ${tag}\n\n**Version bump:** ${bumpType}\n\n### Changes\n\n${title}\n\n_See commit history for details_`;
  writeFileSync("/tmp/release-notes.md", fallbackNotes);
  process.exit(1);
});
