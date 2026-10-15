# usage-hud-claude-plugin

A Claude Code mod that draws a small band above the prompt, as a replacement for a status-line HUD. It has no runtime dependency (no Node package, no Python, no shell script) and runs the same on Windows and Linux.

```text
[Sonnet 5.5] │ game-dev-skills  git:(main)
Context ███░░░░░░░ 31% │ Usage ░░░░░░░░░░ 0% (resets in 4h 36m) │ Weekly █████████░ 91% (resets in 1d 20h) │ $1.50
```

## What it shows

| Item | Source |
| --- | --- |
| Model | `$.session.model()`, turned into `Sonnet 5.5` |
| Directory | last segment of `$.session.cwd()` |
| Git branch | `git rev-parse --abbrev-ref HEAD` in the session directory, read at most every 15 s |
| Context bar | `$.session.usage().context` (green below 70%, yellow below 90%, red from 90%) |
| Plan windows | `$.session.usage().rateLimits`: `five_hour` as Usage, `seven_day` as Weekly, with a reset countdown |
| Cost | `$.session.usage().cost`, when the host reports it |

The band redraws when the usage figures change and once a minute, so countdowns keep moving.

## Install

This repo is a single plugin. It is listed in the [magic-claude-code-plugin](https://github.com/kouui/magic-claude-code-plugin) marketplace:

```bash
claude plugin marketplace add kouui/magic-claude-code-plugin
claude plugin install usage-hud@magic-claude-code-plugin -s user
```

Try a local checkout without installing: `claude --plugin-dir <this folder>`.

## Limits

- The band is drawn **above** the prompt input, not below it. A mod cannot draw in the bottom status line.
- It is drawn on the terminal and Desktop surfaces. The VS Code chat panel and `claude -p` draw nothing.
- Collapse it with ctrl+x ctrl+a; the engine adds a `[-]` mark beside it.
- Plan windows are reported only for Claude.ai Pro and Max accounts, and only after the first response.
- Needs a Claude Code build that supports mods (2.1.287 or newer).

## Develop

```bash
claude plugin validate .
claude plugin test .
```

`hooks/format.ts` holds the pure helpers (bar, colors, model label, countdown); `hooks/register.ts` holds the hooks.

## Layout

```text
.claude-plugin/plugin.json
hooks/hooks.json
hooks/register.ts    # hooks: session.start, session.measure, turn.complete, ui.render
hooks/format.ts      # pure helpers
tests/               # format and band tests
```
