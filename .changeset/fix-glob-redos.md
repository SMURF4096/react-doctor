---
"@react-doctor/core": patch
"react-doctor": patch
---

Harden glob pattern compilation against ReDoS:

- Replace the hand-rolled glob-to-regex compiler with [`picomatch`](https://github.com/micromatch/picomatch), the proven matcher behind `chokidar`, `fast-glob`, and `micromatch`. The previous compiler turned patterns like `**/**/**/**/**/foo.tsx` into nested optional `(?:.+/)?` groups whose backtracking is exponential in the number of `**` segments — a 20-deep pattern hung for over 30 seconds on a 60-character non-matching input.
- Reject obviously pathological patterns early with a clear `InvalidGlobPatternError` carrying the offending pattern and a human-readable reason, instead of crashing the scan. Limits live in `@react-doctor/core/constants` (`MAX_GLOB_PATTERN_LENGTH_CHARS = 1024`, `MAX_GLOB_PATTERN_WILDCARD_COUNT = 24`) and bound worst-case work regardless of the underlying engine. Real-world ignore patterns like `**/foo/**/bar/**/*.tsx` sit well under the cap.
- Surface invalid `ignore.files` and `ignore.overrides[*].files` entries as `[react-doctor] …` warnings on stderr and skip just the bad pattern, so a single typo no longer takes the whole scan down.
- Add regression tests covering the worst-case patterns (deeply-stacked globstars and dense `a*a*a*…` alternations) and the validation surface.
