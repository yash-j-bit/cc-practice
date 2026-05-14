#!/bin/bash
# protect-files.sh - 重要ファイルの編集をブロック

set -u

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

basename_file=$(basename "$FILE_PATH")

case "$basename_file" in
  .env|.env.local|.env.production|.env.development|.env.test)
    echo "ブロック: $basename_file の編集は禁止されています (秘密情報の混入を防ぐため)" >&2
    exit 2
    ;;
  package-lock.json|pnpm-lock.yaml|yarn.lock)
    echo "ブロック: $basename_file の手動編集は禁止されています (npm install を使ってください)" >&2
    exit 2
    ;;
esac

exit 0
