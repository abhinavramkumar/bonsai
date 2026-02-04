#!/bin/sh
# bonsai installer
# Downloads and installs the bonsai binary from GitHub releases

set -e

GITHUB_REPO="abhinavramkumar/bonsai"
INSTALL_DIR="${BONSAI_INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="bonsai"

# Color output when stdout is a TTY or when explicitly requested (e.g. from bonsai upgrade)
# Use literal escape byte so we don't rely on printf %b (not all sh interpret it in args)
if [ -t 1 ] || [ -n "${BONSAI_INSTALL_COLOR}" ] || [ -n "${FORCE_COLOR}" ]; then
  ESC=$(printf '\033')
  C_RED="${ESC}[0;31m"
  C_GREEN="${ESC}[0;32m"
  C_YELLOW="${ESC}[0;33m"
  C_BOLD="${ESC}[1m"
  C_RESET="${ESC}[0m"
else
  C_RED='' C_GREEN='' C_YELLOW='' C_BOLD='' C_RESET=''
fi

info() { printf '%s%s%s\n' "${C_YELLOW}" "$1" "${C_RESET}"; }
success() { printf '%s%s%s\n' "${C_GREEN}" "$1" "${C_RESET}"; }
err() { printf '%s%s%s\n' "${C_RED}" "$1" "${C_RESET}"; }

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
      err "Error: Unsupported architecture: $ARCH"
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
      err "Error: Unsupported OS: $OS"
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
    err "Error: curl or wget is required"
    exit 1
  fi
  
  if [ -z "$VERSION" ]; then
    err "Error: Could not determine latest version"
    exit 1
  fi
  
  echo "$VERSION"
}

# Download and install binary
install_binary() {
  VERSION="$1"
  PLATFORM="$2"
  
  DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${VERSION}/bonsai-${PLATFORM}"
  
  info "Downloading bonsai ${VERSION} for ${PLATFORM}..."
  
  TMP_DIR=$(mktemp -d)
  trap "rm -rf $TMP_DIR" EXIT
  
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "${TMP_DIR}/bonsai" "$DOWNLOAD_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "${TMP_DIR}/bonsai" "$DOWNLOAD_URL"
  else
    err "Error: curl or wget is required"
    exit 1
  fi
  
  chmod +x "${TMP_DIR}/bonsai"
  
  # Check if install directory exists and is writable
  if [ ! -d "$INSTALL_DIR" ]; then
    info "Creating directory $INSTALL_DIR..."
    sudo mkdir -p "$INSTALL_DIR"
  fi
  
  if [ -w "$INSTALL_DIR" ]; then
    cp "${TMP_DIR}/bonsai" "${INSTALL_DIR}/${BINARY_NAME}"
  else
    info "Installing to $INSTALL_DIR (requires sudo)..."
    sudo cp "${TMP_DIR}/bonsai" "${INSTALL_DIR}/${BINARY_NAME}"
  fi
  
  success "Installed bonsai to ${INSTALL_DIR}/${BINARY_NAME}"
  success "bonsai ${VERSION} is ready. Run ${BINARY_NAME} --version to confirm."
}

main() {
  printf '%s%s%s%s%s\n' "${C_BOLD}" "${C_YELLOW}" "bonsai installer" "${C_RESET}"
  echo "================"
  
  detect_platform
  info "Detected platform: $PLATFORM"
  
  VERSION=$(get_latest_version)
  info "Latest version: $VERSION"
  
  install_binary "$VERSION" "$PLATFORM"
}

main "$@"
