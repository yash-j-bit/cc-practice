#!/bin/bash
# hn-summary.sh — Fetch top 10 HN stories and output a Japanese Markdown summary

set -euo pipefail

BASE_URL="https://hacker-news.firebaseio.com/v0"
DATE=$(date '+%Y年%-m月%-d日')

echo "Fetching top 10 Hacker News stories..." >&2

# Step 1: Fetch top 10 stories as JSON
stories=$(
  curl -s "$BASE_URL/topstories.json" | jq -r '.[0:10][]' | \
  while read -r id; do
    item=$(curl -s "$BASE_URL/item/$id.json")
    title=$(echo "$item" | jq -r '.title // ""')
    url=$(echo "$item"   | jq -r '.url   // "https://news.ycombinator.com/item?id='"$id"'"')
    score=$(echo "$item" | jq -r '.score // 0')
    printf '{"id":%s,"title":%s,"url":%s,"score":%s}\n' \
      "$id" "$(echo "$title" | jq -R .)" "$(echo "$url" | jq -R .)" "$score"
    sleep 1
  done
)

# Step 2: Summarize with Claude, injecting date into prompt
echo "$stories" | claude -p "以下はHacker Newsのトップ10記事のJSONリストです。

これを日本語のMarkdown形式でサマリーしてください。出力フォーマット：

# Hacker News 注目記事まとめ（${DATE}）

各記事を以下の形式で箇条書き：
- **[タイトル](URL)** ★スコア — 日本語で1文のサマリー

最後に「## 今日のハイライト」セクションで全体を2〜3行でまとめてください。"
