#!/bin/bash
# hn-top10.sh — Fetch top N Hacker News stories with title, URL, score, comments

set -euo pipefail

BASE_URL="https://hacker-news.firebaseio.com/v0"
COUNT=10

usage() {
  cat <<EOF
Usage: hn-top10.sh [OPTIONS]
  --help       使い方を表示
  --count N    取得件数（デフォルト: 10）
EOF
  exit 0
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help) usage ;;
    --count) COUNT="${2:?--count requires a number}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Fetch top story IDs with retry
fetch_with_retry() {
  local url="$1"
  local attempt=0
  while (( attempt < 3 )); do
    local result
    result=$(curl -sf "$url" 2>/dev/null) && echo "$result" && return 0
    (( attempt++ ))
    echo "リトライ中... (${attempt}/3)" >&2
    sleep 2
  done
  echo "Error: Hacker News API に接続できません。ネットワーク接続を確認してください。" >&2
  exit 1
}

ids=$(fetch_with_retry "$BASE_URL/topstories.json" | jq ".[0:${COUNT}][]")

echo "["
first=true
for id in $ids; do
  item=$(fetch_with_retry "$BASE_URL/item/$id.json")
  title=$(echo "$item"    | jq -r '.title       // ""')
  url=$(echo "$item"      | jq -r '.url         // "https://news.ycombinator.com/item?id='"$id"'"')
  score=$(echo "$item"    | jq -r '.score       // 0')
  comments=$(echo "$item" | jq -r '.descendants // 0')

  $first || echo ","
  printf '  {"id":%s,"title":%s,"url":%s,"score":%s,"comments":%s}' \
    "$id" \
    "$(echo "$title" | jq -R .)" \
    "$(echo "$url"   | jq -R .)" \
    "$score" \
    "$comments"
  first=false
  sleep 1
done
echo ""
echo "]"
