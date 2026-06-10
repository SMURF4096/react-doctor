---
"@react-doctor/core": patch
"react-doctor": patch
---

Consolidate the scan-scope controls into one `--scope` flag (and `scope` config option) with four values, shared verbatim by the CLI and the GitHub Action:

- `full` (default) — the whole project, every issue. Whole-project checks (dead-code, environment, supply-chain) run only here.
- `files` — only the files changed vs the base, with all issues in them (no compare-to-main). What `--staged` and an uncommitted `--diff` did.
- `changed` — only issues the change introduced vs the base (the baseline delta). What `--diff <base>` and the action's `scope: changed` did.
- `lines` — only issues on the lines the change actually touched. New: previously this scoping existed only inside the GitHub Action's inline-review-comment step; it now lives in the engine, so the CI gate, score display, summary, and inline comments all honor one scope.

`--base <ref>` sets the comparison base for `files` / `changed` / `lines` (auto-detected when omitted). Behavior is unchanged by default: the CLI `--scope` defaults to `full` and the action `scope` input still defaults to `changed`. `--diff` / `config.diff` keep working as a deprecated alias (`--diff <base>` → `--scope changed --base <base>`, `--diff false` → `--scope full`) and emit a one-time deprecation warning; `--staged` is retained as the source selector and composes with `--scope files` / `--scope lines`.
