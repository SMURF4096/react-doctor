import type { Diagnostic, ReactDoctorConfig, ScoreResult } from "../../types.js";
import { calculateScore } from "../../utils/calculate-score.js";
import { mergeAndFilterDiagnostics } from "../../utils/merge-and-filter-diagnostics.js";
import { createBrowserReadFileLinesSync } from "./create-browser-read-file-lines.js";

export interface ProcessBrowserDiagnosticsInput {
  rootDirectory: string;
  projectFiles: Record<string, string>;
  diagnostics: Diagnostic[];
  userConfig?: ReactDoctorConfig | null;
  score?: ScoreResult | null;
}

export interface ProcessBrowserDiagnosticsResult {
  diagnostics: Diagnostic[];
  score: ScoreResult | null;
}

export const processBrowserDiagnostics = async (
  input: ProcessBrowserDiagnosticsInput,
): Promise<ProcessBrowserDiagnosticsResult> => {
  const readFileLinesSync = createBrowserReadFileLinesSync(input.rootDirectory, input.projectFiles);
  const userConfig = input.userConfig ?? null;
  const diagnostics = mergeAndFilterDiagnostics(
    input.diagnostics,
    input.rootDirectory,
    userConfig,
    readFileLinesSync,
  );
  const score = input.score !== undefined ? input.score : await calculateScore(diagnostics);
  return { diagnostics, score };
};
