/**
 * Writes release notes to /tmp/release-notes.md from env (TAG, PR_TITLE, PR_BODY, BUMP_TYPE).
 * Used by .github/workflows/release.yml so PR content is never interpolated into shell.
 */
import { writeFileSync } from "fs";

const tag = process.env.TAG ?? "";
const title = process.env.PR_TITLE ?? "";
const body = process.env.PR_BODY ?? "";
const bumpType = process.env.BUMP_TYPE ?? "";

let notes = `## Release ${tag}\n\n**Version bump:** ${bumpType}\n\n### Changes\n\n**${title}**`;
if (body && body !== "null") {
  notes += `\n\n${body}`;
}
notes +=
  "\n\n### Binaries\n- macOS Intel (darwin-x86_64)\n- macOS Apple Silicon (darwin-arm64)\n- Linux x64 (linux-x86_64)\n- Linux ARM64 (linux-arm64)";

writeFileSync("/tmp/release-notes.md", notes);
