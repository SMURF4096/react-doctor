---
"react-doctor": patch
---

Redesign the scan output's summary and footer. The default (non-verbose) run no longer lists every warning rule — warnings are rolled into a single overflow line alongside the hidden errors (e.g. `+4 more rules and +50 optional warnings — run npx react-doctor@latest --verbose for details`). `--verbose` now renders warnings in the same boxed, titled, code-framed format as errors (with a "Learn more" docs link), instead of a separate compact list. The closing footer is restructured into a `Share:` / `Docs:` / `GitHub:` block (each with a one-line description) separated by a divider, and the share link now appears for monorepo runs too (gated the same way as single-project: shown unless CI, `--no-score`, or `share: false`). The scan spinner's worker count now reads as a dimmed `[~N workers]`.
