import * as p from "@clack/prompts";
import pc from "picocolors";
import { mkdir, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { mergeDefaultsIntoAllConfigs } from "../lib/config.js";

const GITHUB_REPO = "abhinavramkumar/bonsai";
const INSTALL_DIR = process.env.BONSAI_INSTALL_DIR ?? "/usr/local/bin";
const BINARY_NAME = "bonsai";

/**
 * Map Node platform/arch to release asset name (e.g. darwin-arm64)
 */
function getPlatform(): string {
  const platform = process.platform;
  const arch = process.arch === "x64" ? "x86_64" : process.arch;
  if (platform === "darwin" || platform === "linux") {
    return `${platform}-${arch}`;
  }
  throw new Error(`Unsupported platform: ${platform}-${process.arch}`);
}

/**
 * Fetch latest release tag from GitHub API
 */
async function getLatestVersion(): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { "User-Agent": "bonsai-cli" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch latest release: ${res.status}`);
  }
  const data = (await res.json()) as { tag_name?: string };
  const version = data.tag_name?.replace(/^v/, "") ?? null;
  if (!version) {
    throw new Error("Could not determine latest version");
  }
  return version;
}

/**
 * Upgrade bonsai to the latest release by downloading the binary and installing it,
 * then merging any new preset defaults into existing config files (non-destructive).
 */
export async function upgradeCommand(): Promise<void> {
  p.intro(pc.bgBlue(pc.white(" bonsai upgrade ")));

  const platform = getPlatform();
  p.log.info(`Platform: ${pc.cyan(platform)}`);

  const versionSpinner = p.spinner();
  versionSpinner.start("Fetching latest version");
  let version: string;
  try {
    version = await getLatestVersion();
    versionSpinner.stop(`Latest version: ${pc.cyan(`v${version}`)}`);
  } catch (error) {
    versionSpinner.stop("Failed to fetch latest version");
    p.cancel(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const downloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${BINARY_NAME}-${platform}`;

  const downloadSpinner = p.spinner();
  downloadSpinner.start(`Downloading bonsai v${version} for ${platform}...`);
  let buffer: ArrayBuffer;
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status}`);
    }
    buffer = await res.arrayBuffer();
    downloadSpinner.stop("Download complete");
  } catch (error) {
    downloadSpinner.stop("Download failed");
    p.cancel(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const tmpPath = join(tmpdir(), `bonsai-${process.pid}`);
  try {
    await writeFile(tmpPath, Buffer.from(buffer), { mode: 0o700 });
  } catch (error) {
    p.cancel(
      `Could not write temp file: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  const destPath = join(INSTALL_DIR, BINARY_NAME);
  try {
    const { access } = await import("fs/promises");
    await access(INSTALL_DIR).catch(async () => {
      p.log.info(`Creating directory ${pc.dim(INSTALL_DIR)}...`);
      await mkdir(INSTALL_DIR, { recursive: true });
    });
  } catch (error) {
    p.cancel(
      `Could not create install directory: ${error instanceof Error ? error.message : String(error)}`
    );
    await unlink(tmpPath).catch(() => {});
    process.exit(1);
  }

  const { copyFile, access, chmod } = await import("fs/promises");
  let needSudo = false;
  try {
    await access(INSTALL_DIR, 2); // W_OK
  } catch {
    needSudo = true;
  }

  try {
    if (needSudo) {
      p.log.info(`Installing to ${pc.dim(INSTALL_DIR)} ${pc.yellow("(requires sudo)")}...`);
      const proc = Bun.spawn(["sudo", "cp", tmpPath, destPath], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      const code = await proc.exited;
      await unlink(tmpPath).catch(() => {});
      if (code !== 0) {
        p.cancel("Installation failed.");
        process.exit(code ?? 1);
      }
      const chmodProc = Bun.spawn(["sudo", "chmod", "755", destPath], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      await chmodProc.exited;
    } else {
      await copyFile(tmpPath, destPath);
      await chmod(destPath, 0o755);
    }
    await unlink(tmpPath).catch(() => {});
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    p.cancel(`Could not install binary: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  p.log.success(`Installed bonsai to ${pc.cyan(destPath)}`);
  p.log.success(
    `bonsai v${version} is ready. Run ${pc.cyan(`${BINARY_NAME} --version`)} to confirm.`
  );

  p.log.info("Merging config defaults...");
  await mergeDefaultsIntoAllConfigs();

  p.outro(pc.green("Upgrade complete."));
  process.exit(0);
}
