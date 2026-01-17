#!/bin/sh
# bonsai installer
# Downloads and installs the bonsai binary from GitHub releases

set -e

GITHUB_REPO="abhinavramkumar/bonsai"
INSTALL_DIR="${BONSAI_INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="bonsai"

# Detect OS and architecture
detect_platform() {
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"
  
  case "$ARCH" in
    x86_64)
      ARCH="x86_64"
      ;;
    arm64|aarch64)
      ARCH="arm64"
      ;;
    *)
      echo "Error: Unsupported architecture: $ARCH"
      exit 1
      ;;
  esac
  
  case "$OS" in
    darwin)
      OS="darwin"
      ;;
    linux)
      OS="linux"
      ;;
    *)
      echo "Error: Unsupported OS: $OS"
      exit 1
      ;;
  esac
  
  PLATFORM="${OS}-${ARCH}"
}

# Get latest release version
get_latest_version() {
  if command -v curl >/dev/null 2>&1; then
    VERSION=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
  elif command -v wget >/dev/null 2>&1; then
    VERSION=$(wget -qO- "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
  else
    echo "Error: curl or wget is required"
    exit 1
  fi
  
  if [ -z "$VERSION" ]; then
    echo "Error: Could not determine latest version"
    exit 1
  fi
  
  echo "$VERSION"
}

# Download and install binary
install_binary() {
  VERSION="$1"
  PLATFORM="$2"
  
  DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${VERSION}/bonsai-${PLATFORM}"
  
  echo "Downloading bonsai ${VERSION} for ${PLATFORM}..."
  
  TMP_DIR=$(mktemp -d)
  trap "rm -rf $TMP_DIR" EXIT
  
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "${TMP_DIR}/bonsai" "$DOWNLOAD_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "${TMP_DIR}/bonsai" "$DOWNLOAD_URL"
  else
    echo "Error: curl or wget is required"
    exit 1
  fi
  
  chmod +x "${TMP_DIR}/bonsai"
  
  # Check if install directory exists and is writable
  if [ ! -d "$INSTALL_DIR" ]; then
    echo "Creating directory $INSTALL_DIR..."
    sudo mkdir -p "$INSTALL_DIR"
  fi
  
  if [ -w "$INSTALL_DIR" ]; then
    cp "${TMP_DIR}/bonsai" "${INSTALL_DIR}/${BINARY_NAME}"
  else
    echo "Installing to $INSTALL_DIR (requires sudo)..."
    sudo cp "${TMP_DIR}/bonsai" "${INSTALL_DIR}/${BINARY_NAME}"
  fi
  
  echo "✓ Installed bonsai to ${INSTALL_DIR}/${BINARY_NAME}"
  
  # Verify installation
  if command -v "$BINARY_NAME" >/dev/null 2>&1; then
    INSTALLED_VERSION=$("$BINARY_NAME" --version 2>/dev/null || echo "unknown")
    echo "✓ bonsai is ready to use (version: $INSTALLED_VERSION)"
  else
    echo "Warning: bonsai was installed but is not in your PATH"
    echo "Add $INSTALL_DIR to your PATH or run: export PATH=\"$INSTALL_DIR:\$PATH\""
  fi
}

main() {
  echo "bonsai installer"
  echo "================"
  
  detect_platform
  echo "Detected platform: $PLATFORM"
  
  VERSION=$(get_latest_version)
  echo "Latest version: $VERSION"
  
  install_binary "$VERSION" "$PLATFORM"
}

main "$@"
