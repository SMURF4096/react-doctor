import type { ChangedFileLineRanges } from "./types/index.js";

// New-side hunk header: `@@ -<old> +<newStart>[,<newCount>] @@`. A missing
// count means one line; a zero count is a pure deletion (no new-side line), so
// it contributes no changed range. Mirrors the parser that previously lived in
// `action.yml`'s inline-review step — now the single source of truth.
const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parses a `git diff --unified=0` patch into the inclusive 1-based line ranges
 * each file added or modified on the new side. Files are keyed by the path in
 * the `+++ b/<path>` header (with `--relative`, relative to the diff's cwd).
 * Added/renamed/modified files appear; pure deletions (`+++ /dev/null`) are
 * skipped because they have no new-side line to report on.
 */
export const parseChangedLineRanges = (patch: string): ChangedFileLineRanges[] => {
  const rangesByFile = new Map<string, Array<readonly [number, number]>>();
  let currentRanges: Array<readonly [number, number]> | null = null;

  for (const line of patch.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim();
      if (target === "/dev/null") {
        currentRanges = null;
        continue;
      }
      const file = target.startsWith("b/") ? target.slice(2) : target;
      currentRanges = rangesByFile.get(file) ?? [];
      rangesByFile.set(file, currentRanges);
      continue;
    }
    if (currentRanges === null) continue;
    const hunk = HUNK_HEADER_PATTERN.exec(line);
    if (hunk === null) continue;
    const start = Number(hunk[1]);
    const lineCount = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (lineCount <= 0) continue;
    currentRanges.push([start, start + lineCount - 1]);
  }

  return [...rangesByFile]
    .filter(([, ranges]) => ranges.length > 0)
    .map(([file, ranges]) => ({ file, ranges }));
};
