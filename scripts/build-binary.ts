#!/usr/bin/env bun
/**
 * Build the bonsai binary with version injected from package.json.
 * Usage: bun run scripts/build-binary.ts [bun build args...]
 * Example: bun run scripts/build-binary.ts --compile --target=bun-darwin-arm64 --outfile ./dist/bonsai-darwin-arm64
 */

import { readFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dir, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const version = pkg.version ?? "0.1.0";

const args = [
  "build",
  join(root, "src/cli.ts"),
  "--define",
  `BONSAI_BUILD_VERSION="${version}"`,
  ...process.argv.slice(2),
];

const proc = Bun.spawn(["bun", ...args], {
  cwd: root,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(await proc.exited);
