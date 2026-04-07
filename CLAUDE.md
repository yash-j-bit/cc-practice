# cc-practice — Claude Code Hands-on

## Project Overview
A hands-on learning project for Claude Code, organized by day.
Each day's exercises live in their own subdirectory (e.g. `Day 1-hn-summary/`).

## HN API Rules
- Base URL: `https://hacker-news.firebaseio.com/v0`
- **Rate limit**: Insert `sleep 1` between consecutive item fetches to avoid throttling.

## Output Format
- All summaries: **Markdown format, Japanese language**.
- Article lists: title, URL, score per item; finish with a 2–3 line highlight section.

## Scripts
| File | Purpose |
|------|---------|
| `Day 1-hn-summary/hn-top10.sh` | Fetch top 10 HN stories as JSON |
| `Day 1-hn-summary/hn-summary.sh` | Fetch + summarize via Claude (Japanese Markdown) |
| `Day 1-hn-summary/hn-ratio.sh` | Score-ratio analysis |

## セッション振り返り (Day 1)

### うまくいった指示のパターン
- 観点・ペルソナ・フォーマットを同時に指定すると出力品質が上がる（プロンプト B/C が A より具体的で実用的）
- パイプ (`./script.sh | claude -p "..."`) で段階的に処理を分割すると、デバッグしやすくスクリプトも再利用できる
- `sleep 1` を明示的に指定しておくことで、APIレートリミットによるエラーを防止できた

### 手戻りが発生した場面とその原因
- git commit 時に `user.email` / `user.name` が未設定でエラー → 事前に `git config --global` を済ませておく
- ルートに `CLAUDE.md` がなく `/init` の効果が確認できなかった → セッション開始時にファイル存在確認を習慣化する

### 次回のセッションで気をつけるべきこと
- 新しいマシン・環境では git identity を最初に設定する
- プロンプトは「何を・どの観点で・どの形式で」を明示する
- Claude の出力はそのまま採用せず、差分を確認してから承認する
