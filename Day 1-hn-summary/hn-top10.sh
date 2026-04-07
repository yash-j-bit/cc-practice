#!/bin/bash
# hn-top10.sh — Fetch top 10 Hacker News stories with title and URL

BASE_URL="https://hacker-news.firebaseio.com/v0"

ids=$(curl -s "$BASE_URL/topstories.json" | jq '.[0:10][]')

echo "["
first=true
for id in $ids; do
  item=$(curl -s "$BASE_URL/item/$id.json")
  title=$(echo "$item" | jq -r '.title // ""')
  url=$(echo "$item"   | jq -r '.url   // "https://news.ycombinator.com/item?id='"$id"'"')
  score=$(echo "$item" | jq -r '.score // 0')

  $first || echo ","
  printf '  {"id":%s,"title":%s,"url":%s,"score":%s}' \
    "$id" \
    "$(echo "$title" | jq -R .)" \
    "$(echo "$url"   | jq -R .)" \
    "$score"
  first=false
  sleep 1
done
echo ""
echo "]"
