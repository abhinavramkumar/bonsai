import { mergeDefaultsIntoAllConfigs } from "../lib/config.js";

const DEBUG = process.env.BONSAI_UPGRADE_DEBUG === "1";

function debug(msg: string): void {
  if (DEBUG) {
    process.stderr.write(`[bonsai:upgrade] ${msg}\n`);
  }
}

/**
 * Upgrade bonsai to the latest release by re-running the install script,
 * then merge any new preset defaults into existing config files (non-destructive).
 *
 * Process chain (why it can appear to hang):
 * 1. We spawn: sh -c 'curl -fsSL <url> | sh'
 * 2. curl fetches install.sh from main (raw.githubusercontent.com)
 * 3. The second sh runs that script. The script installs the new binary to e.g. /usr/local/bin/bonsai
 * 4. If the script on the URL is OLD, it then runs "bonsai --version" to verify
 * 5. That runs the newly installed binary. If that binary hangs (e.g. pre-lazy-load release), the script never exits
 * 6. So our proc.exited never fires. Fix: push install.sh so the URL script no longer runs the binary.
 */
export async function upgradeCommand(): Promise<void> {
  const installUrl = "https://raw.githubusercontent.com/abhinavramkumar/bonsai/main/install.sh";

  debug("spawning install script");
  const proc = Bun.spawn(["sh", "-c", `curl -fsSL "${installUrl}" | sh`], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  debug("waiting for install script to exit...");
  const exitCode = await proc.exited;
  debug(`install script exited with code ${exitCode}`);
  if (exitCode !== 0) {
    process.exit(exitCode ?? 1);
  }

  debug("merging defaults into configs...");
  await mergeDefaultsIntoAllConfigs();
  debug("done merging, exiting");
  process.exit(0);
}
