#!/bin/bash
# hn-ratio.sh — Top HN stories ranked by score/comments ratio

curl -s https://hacker-news.firebaseio.com/v0/topstories.json \
| jq -r '.[0:20][]' \
| xargs -I {} curl -s https://hacker-news.firebaseio.com/v0/item/{}.json \
| jq -r '{title, score, comments: .descendants} | select(.comments != null and .comments > 0) | .ratio = (.score / .comments)' \
| jq -s 'sort_by(.ratio) | reverse | .[0:5]'
