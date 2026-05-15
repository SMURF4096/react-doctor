import type { ProjectInfo } from "../../../types/project-info.js";
import type { RuleSeverity } from "../../../plugin/utils/rule.js";

// Oxlint config entries accept the plugin's per-rule severities plus
// `"off"`, which the plugin type intentionally omits (an "off" rule is
// just one that's never registered). Re-export under a distinct name so
// duplicate-export warnings don't fire on `RuleSeverity` across layers.
export type OxlintRuleSeverity = RuleSeverity | "off";

export interface OxlintConfigOptions {
  pluginPath: string;
  project: ProjectInfo;
  customRulesOnly?: boolean;
  extendsPaths?: string[];
  ignoredTags?: ReadonlySet<string>;
}
