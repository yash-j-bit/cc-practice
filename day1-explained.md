# Day 1 — What We Did and Why (Claude's Explanation)

---

## The Big Picture

Think of Day 1 as your first day learning how to *talk* to Claude Code and get real work done.
The project we used as a vehicle was a **Hacker News daily summary tool** — something small enough
to finish in a day, but real enough to teach you every important concept.

By the end of Day 1, you had a script you could run every morning and get a Japanese summary of
what the tech world was talking about. That's a genuine, useful thing. Everything we did was in
service of building that.

---

## Part 1 — Setting Up the Project

Before writing any code, we made sure the working environment was ready:
a directory (`Day 1-hn-summary/`), git initialised, and Claude Code running.

**Why bother with setup first?**
Because Claude Code works *inside your project*. It reads your files, understands your structure,
and later reads `CLAUDE.md` to know the rules. If your project is a mess, Claude's output will
reflect that.

---

## Part 2 — The Two Scripts

### `hn-top10.sh`

This is the **data fetcher**. It talks to the Hacker News Firebase API in two steps:

1. Get a list of top story IDs:
   ```
   GET /topstories.json → [123, 456, 789, ...]
   ```
2. For each ID, fetch the full article details:
   ```
   GET /item/123.json → { title, url, score, comments, ... }
   ```

It outputs a clean JSON array — nothing more. It doesn't summarise, it doesn't format.
It just fetches. This is intentional: **one script, one job**.

We use `curl` to make HTTP requests and `jq` to parse/format JSON.
If you've written VB.NET or C#, think of `curl` as `HttpClient.GetAsync()` and `jq` as
`JsonConvert.DeserializeObject()` — same idea, different syntax.

One important rule: `sleep 1` between each API call. The HN API will throttle you if you
hammer it. We saved this rule in Auto Memory so future sessions remember it automatically.

### `hn-summary.sh`

This is the **pipeline script**. It calls `hn-top10.sh`, takes the JSON output, and pipes it
directly into Claude:

```bash
./hn-top10.sh | claude -p "日本語でサマリーして..."
```

That single pipe (`|`) is the most important concept from Day 1. You're feeding structured data
into an AI and getting a formatted, human-readable result out. No API keys, no Python, no web app.
Just a shell pipe.

---

## Part 3 — One-Shot Mode vs Interactive Mode

| Mode | Command | When to use |
|------|---------|-------------|
| Interactive | `claude` | Building things step by step, iterating |
| One-shot | `claude -p "..."` | Scripting, pipelines, automation |

Interactive mode is like having a conversation. You ask, Claude responds, you refine.
One-shot mode is like calling a function — input goes in, output comes out, done.

Day 1 used both. We built the scripts in interactive mode, then used one-shot mode to run
the summary pipeline.

---

## Part 4 — Prompt Quality

We ran the same HN data through three different prompts and compared the output:

**Prompt A — "要約して" (Just summarise)**
Simple instruction. Claude does *something* but it's vague. You get a table, maybe a short comment.
Not very actionable.

**Prompt B — Perspective specified**
We asked for a tech-trend perspective, one line per article, three-line summary at the end.
Clearer structure → clearer output. Immediately more useful.

**Prompt C — Persona specified (Senior Engineer)**
We gave Claude a role: "You are a senior engineer. Pick the 3 most practically relevant technologies
and explain why they matter."
The output was the most useful of the three — it made decisions, gave reasoning, produced
something you could actually show to a team.

**The lesson**: The more precisely you specify *what, from what perspective, and in what format*,
the closer the output is to what you actually want. Vague in = vague out.

---

## Part 5 — CLAUDE.md

`CLAUDE.md` is a file Claude Code reads automatically at the start of every session.
It's how you pass project knowledge from one session to the next.

We put three things in ours:

1. **HN API rate limit rule** — always use `sleep 1` between calls
2. **Output format rule** — Markdown, Japanese language
3. **Session retrospective** — what went well, what caused rework, what to watch next time

Without `CLAUDE.md`, every session starts cold. Claude doesn't know your conventions,
your constraints, or your preferences. With it, you pick up exactly where you left off.

---

## Part 6 — The Homework Extensions

The base exercises got the scripts working. The homework made them *production-quality*.

### Error Handling (`fetch_with_retry`)

The original scripts would silently fail if the API was down. We added a retry function:
- Try up to 3 times
- Wait 2 seconds between attempts
- If all three fail, print a Japanese error message and exit with a non-zero code

This is important because scripts that fail silently are worse than scripts that don't exist.
You think it worked, but the output is garbage.

### Options Added

| Option | What it does |
|--------|-------------|
| `--help` | Prints usage instructions |
| `--count N` | Fetch N articles instead of 10 |
| `--format md\|html\|json` | Switch output format |
| `--categorize` | Group articles by category (AI, Security, Tools, etc.) |
| `--min-comments N` | Only include articles with at least N comments |

These turn a one-trick script into a reusable tool.

### `test.sh` — 12 Automated Tests

Tests cover:
- Output is not empty
- Output is valid JSON
- Exactly 10 items returned (or N when `--count N` is used)
- All items have required fields (title, url, score)
- `--help` exits with code 0
- Unknown options exit with non-zero code
- Invalid API URL exits with non-zero code
- `--format json` produces valid JSON
- `--format html` produces a DOCTYPE
- `--min-comments 999999` returns 0 results (all filtered out)

All 12 pass. The habit being built here: **don't trust that it works, prove it**.

---

## Part 7 — What the .NET Developer Should Take Away

You're used to a world where:
- Code runs in a runtime (CLR)
- You have types, compile-time checks, IDE autocomplete
- Errors are exceptions with stack traces

Bash is the opposite: loosely typed, runtime-only, errors are silent by default.
`set -euo pipefail` at the top of every script is your first line of defence —
it makes bash behave more like a strict language.

`curl + jq` is your `HttpClient + JsonConvert`. The pattern is identical, the syntax is not.

Claude Code's pipe pattern (`script | claude -p "..."`) is your LINQ chain — data flows through
transformations, each step doing one thing.

---

## Current State

Everything is committed to `main`. The scripts work. Tests pass. CLAUDE.md is set.
Auto Memory has the two project rules saved.

Next up: **Day 2 — Inventory Management** (`Day 2-inventory/`).
That's where TDD enters the picture.
