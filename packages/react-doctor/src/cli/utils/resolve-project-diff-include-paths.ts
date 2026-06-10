import { filterSourceFiles } from "@react-doctor/core";
import type { ChangedFileLineRanges, DiffInfo } from "@react-doctor/core";
import { resolveProjectRelativeDirectory } from "./resolve-project-relative-directory.js";
import { toForwardSlashes } from "./path-format.js";

export const resolveProjectDiffIncludePaths = (
  rootDirectory: string,
  projectDirectory: string,
  diffInfo: DiffInfo,
): string[] => {
  const relativeProjectDirectory = resolveProjectRelativeDirectory(rootDirectory, projectDirectory);
  if (relativeProjectDirectory === null) return [];

  const changedSourceFiles = filterSourceFiles(diffInfo.changedFiles);
  if (relativeProjectDirectory.length === 0) return changedSourceFiles;

  const projectPrefix = `${relativeProjectDirectory}/`;
  return changedSourceFiles.flatMap((filePath) => {
    const normalizedFilePath = toForwardSlashes(filePath);
    if (!normalizedFilePath.startsWith(projectPrefix)) return [];
    const projectRelativePath = normalizedFilePath.slice(projectPrefix.length);
    return projectRelativePath.length > 0 ? [projectRelativePath] : [];
  });
};

/**
 * Re-keys repo-relative changed line ranges (from `getChangedLineRanges`) to
 * the scanned project, mirroring `resolveProjectDiffIncludePaths`'s boundary
 * rule so the `lines` scope filter inside `inspect()` matches the project-
 * relative diagnostic paths. Files outside the project are dropped.
 */
export const resolveProjectChangedLineRanges = (
  rootDirectory: string,
  projectDirectory: string,
  ranges: ReadonlyArray<ChangedFileLineRanges>,
): ChangedFileLineRanges[] => {
  const relativeProjectDirectory = resolveProjectRelativeDirectory(rootDirectory, projectDirectory);
  if (relativeProjectDirectory === null) return [];

  if (relativeProjectDirectory.length === 0) {
    return ranges.map((entry) => ({ file: toForwardSlashes(entry.file), ranges: entry.ranges }));
  }

  const projectPrefix = `${relativeProjectDirectory}/`;
  return ranges.flatMap((entry) => {
    const normalizedFilePath = toForwardSlashes(entry.file);
    if (!normalizedFilePath.startsWith(projectPrefix)) return [];
    const projectRelativePath = normalizedFilePath.slice(projectPrefix.length);
    return projectRelativePath.length > 0
      ? [{ file: projectRelativePath, ranges: entry.ranges }]
      : [];
  });
};
