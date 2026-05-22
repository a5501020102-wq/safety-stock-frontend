#!/bin/bash
# ============================================================
# Safety Stock Frontend — Install Git Hooks
# ============================================================
# 將 scripts/pre-commit 複製到 .git/hooks/pre-commit。
# .git/hooks/ 不在版本控制內，git clone 後需要執行此腳本一次。
#
# 用法：
#   bash scripts/install-hooks.sh
# ============================================================

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
SOURCE="$REPO_ROOT/scripts/pre-commit"
TARGET="$REPO_ROOT/.git/hooks/pre-commit"

if [ ! -f "$SOURCE" ]; then
    echo "[install-hooks] Error: $SOURCE not found."
    exit 1
fi

cp "$SOURCE" "$TARGET"
chmod +x "$TARGET"

echo "[install-hooks] Installed pre-commit hook → $TARGET"
echo "[install-hooks] Pre-commit will run: prettier --check, eslint, tsc --noEmit"
