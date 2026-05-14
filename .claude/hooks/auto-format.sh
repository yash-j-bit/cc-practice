#!/bin/bash
# auto-format.sh - inventory-ui の TS/TSX/CSS ファイルを Prettier で自動フォーマット

set -u

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

UI_DIR="$CLAUDE_PROJECT_DIR/Day 3-inventory-ui/inventory-ui"

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.css|*.json)
    if [[ "$FILE_PATH" == "$UI_DIR"* ]]; then
      cd "$UI_DIR" && npx prettier --write "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
esac

exit 0
