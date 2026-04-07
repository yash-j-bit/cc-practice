#!/bin/bash
# hn-summary.sh — Fetch top HN stories and output a summary

set -euo pipefail

BASE_URL="https://hacker-news.firebaseio.com/v0"
DATE=$(date '+%Y年%-m月%-d日')
COUNT=10
FORMAT="md"
CATEGORIZE=false
MIN_COMMENTS=0

usage() {
  cat <<EOF
Usage: hn-summary.sh [OPTIONS]
  --help              使い方を表示
  --count N           取得件数（デフォルト: 10）
  --format FORMAT     出力形式 (md|html|json)
  --categorize        カテゴリ別に記事を分類して出力
  --min-comments N    コメント数がN以上の記事のみ対象
EOF
  exit 0
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)         usage ;;
    --count)        COUNT="${2:?--count requires a number}"; shift 2 ;;
    --format)       FORMAT="${2:?--format requires md|html|json}"; shift 2 ;;
    --categorize)   CATEGORIZE=true; shift ;;
    --min-comments) MIN_COMMENTS="${2:?--min-comments requires a number}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Validate format
case "$FORMAT" in
  md|html|json) ;;
  *) echo "Error: --format は md / html / json のいずれかを指定してください。" >&2; exit 1 ;;
esac

# Fetch with retry
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

echo "Fetching top ${COUNT} Hacker News stories..." >&2

# Step 1: Fetch stories
stories_json="["
first=true
while IFS= read -r id; do
  item=$(fetch_with_retry "$BASE_URL/item/$id.json")
  title=$(echo "$item"    | jq -r '.title       // ""')
  url=$(echo "$item"      | jq -r '.url         // "https://news.ycombinator.com/item?id='"$id"'"')
  score=$(echo "$item"    | jq -r '.score       // 0')
  comments=$(echo "$item" | jq -r '.descendants // 0')

  # Apply --min-comments filter
  if (( comments < MIN_COMMENTS )); then
    sleep 1
    continue
  fi

  $first || stories_json+=","
  stories_json+=$(printf '{"id":%s,"title":%s,"url":%s,"score":%s,"comments":%s}' \
    "$id" \
    "$(echo "$title" | jq -R .)" \
    "$(echo "$url"   | jq -R .)" \
    "$score" "$comments")
  first=false
  sleep 1
done < <(fetch_with_retry "$BASE_URL/topstories.json" | jq -r ".[0:${COUNT}][]")
stories_json+="]"

# Step 2: Output by format
case "$FORMAT" in
  json)
    echo "$stories_json" | jq .
    ;;

  html)
    echo "<!DOCTYPE html><html><head><meta charset='utf-8'><title>HN ${DATE}</title></head><body>"
    echo "<h1>Hacker News 注目記事まとめ（${DATE}）</h1><ul>"
    echo "$stories_json" | jq -r '.[] | "<li><a href=\"\(.url)\">\(.title)</a> ★\(.score) 💬\(.comments)</li>"'
    echo "</ul></body></html>"
    ;;

  md)
    if $CATEGORIZE; then
      echo "$stories_json" | claude -p "以下はHacker NewsのトップN記事のJSONリストです。

記事をカテゴリ別（例: AI/機械学習, セキュリティ, Web開発, ツール, その他）に分類して、
日本語のMarkdown形式で出力してください。

# Hacker News 注目記事まとめ（${DATE}）

各カテゴリをH2見出しにして、その下に記事を箇条書き：
- **[タイトル](URL)** ★スコア 💬コメント数 — 日本語で1文のサマリー

最後に「## 今日のハイライト」で2〜3行まとめ。"
    else
      echo "$stories_json" | claude -p "以下はHacker NewsのトップN記事のJSONリストです。

日本語のMarkdown形式でサマリーしてください。出力フォーマット：

# Hacker News 注目記事まとめ（${DATE}）

各記事を以下の形式で箇条書き：
- **[タイトル](URL)** ★スコア 💬コメント数 — 日本語で1文のサマリー

最後に「## 今日のハイライト」で全体を2〜3行でまとめてください。"
    fi
    ;;
esac
