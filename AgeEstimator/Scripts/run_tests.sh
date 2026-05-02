#!/usr/bin/env bash
# Run the platform-agnostic core tests with `swift test`.
# Requires Xcode (or just the Swift toolchain) on macOS.
set -euo pipefail

cd "$(dirname "$0")/.."
swift test "$@"
