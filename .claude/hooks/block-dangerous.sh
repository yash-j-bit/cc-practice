#!/bin/bash
# block-dangerous.sh - 危険な Bash コマンドをブロック

set -u

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# rm -rf 系（rm -rf, rm -fr, rm -Rf, rm --recursive --force など）
if echo "$COMMAND" | grep -qE 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive[[:space:]]+--force|--force[[:space:]]+--recursive)'; then
  echo "ブロック: rm -rf 系のコマンドは禁止されています ($COMMAND)" >&2
  exit 2
fi

# git push --force / -f
if echo "$COMMAND" | grep -qE 'git[[:space:]]+push([[:space:]].*)?[[:space:]](--force|-f)([[:space:]]|$)'; then
  echo "ブロック: git push --force は禁止されています ($COMMAND)" >&2
  exit 2
fi

# git reset --hard も追加で警戒（共有ブランチ上で危険）
if echo "$COMMAND" | grep -qE 'git[[:space:]]+reset[[:space:]]+.*--hard'; then
  echo "ブロック: git reset --hard は禁止されています (--soft / --mixed を検討してください)" >&2
  exit 2
fi

exit 0
