import { buildCapabilities, shouldEnableRule } from "./capabilities.js";
import {
  filterRulesToAvailable,
  resolveReactHooksJsPlugin,
  resolveYouMightNotNeedEffectPlugin,
  YOU_MIGHT_NOT_NEED_EFFECT_NAMESPACE,
} from "./plugin-resolution.js";
import type { JsPluginEntry } from "./plugin-resolution.js";
import { RULE_METADATA } from "./rule-metadata.js";
import {
  BUILTIN_A11Y_RULES,
  BUILTIN_REACT_RULES,
  FRAMEWORK_SPECIFIC_RULE_KEYS,
  GLOBAL_REACT_DOCTOR_RULES,
  NEXTJS_RULES,
  REACT_COMPILER_RULES,
  REACT_NATIVE_RULES,
  TANSTACK_QUERY_RULES,
  TANSTACK_START_RULES,
  YOU_MIGHT_NOT_NEED_EFFECT_RULES,
} from "./rule-maps.js";
import type { OxlintConfigOptions, RuleSeverity } from "./types.js";

export const createOxlintConfig = ({
  pluginPath,
  project,
  customRulesOnly = false,
  extendsPaths = [],
  ignoredTags = new Set<string>(),
}: OxlintConfigOptions) => {
  const reactHooksJsPlugin = resolveReactHooksJsPlugin(project.hasReactCompiler, customRulesOnly);
  const reactCompilerRules = reactHooksJsPlugin
    ? filterRulesToAvailable(
        REACT_COMPILER_RULES,
        "react-hooks-js",
        reactHooksJsPlugin.availableRuleNames,
      )
    : {};

  const youMightNotNeedEffectPlugin = resolveYouMightNotNeedEffectPlugin(customRulesOnly);
  const youMightNotNeedEffectRules = youMightNotNeedEffectPlugin
    ? filterRulesToAvailable(
        YOU_MIGHT_NOT_NEED_EFFECT_RULES,
        YOU_MIGHT_NOT_NEED_EFFECT_NAMESPACE,
        youMightNotNeedEffectPlugin.availableRuleNames,
      )
    : {};

  const jsPlugins: JsPluginEntry[] = [];
  if (reactHooksJsPlugin) jsPlugins.push(reactHooksJsPlugin.entry);
  if (youMightNotNeedEffectPlugin) jsPlugins.push(youMightNotNeedEffectPlugin.entry);

  const capabilities = buildCapabilities(project);

  const enabledReactDoctorRules: Record<string, RuleSeverity> = {};
  const allRuleMaps = [
    GLOBAL_REACT_DOCTOR_RULES,
    NEXTJS_RULES,
    REACT_NATIVE_RULES,
    TANSTACK_START_RULES,
    TANSTACK_QUERY_RULES,
  ];
  for (const ruleMap of allRuleMaps) {
    for (const [ruleKey, severity] of Object.entries(ruleMap)) {
      const metadata = RULE_METADATA.get(ruleKey);
      if (!metadata) {
        if (FRAMEWORK_SPECIFIC_RULE_KEYS.has(ruleKey)) continue;
        enabledReactDoctorRules[ruleKey] = severity;
        continue;
      }
      if (shouldEnableRule(metadata.requires, metadata.tags, capabilities, ignoredTags)) {
        enabledReactDoctorRules[ruleKey] = severity;
      }
    }
  }

  return {
    ...(extendsPaths.length > 0 ? { extends: extendsPaths } : {}),
    categories: {
      correctness: "off",
      suspicious: "off",
      pedantic: "off",
      perf: "off",
      restriction: "off",
      style: "off",
      nursery: "off",
    },
    plugins: customRulesOnly ? [] : ["react", "jsx-a11y"],
    jsPlugins: [...jsPlugins, pluginPath],
    rules: {
      ...(customRulesOnly ? {} : BUILTIN_REACT_RULES),
      ...(customRulesOnly ? {} : BUILTIN_A11Y_RULES),
      ...reactCompilerRules,
      ...youMightNotNeedEffectRules,
      ...enabledReactDoctorRules,
    },
  };
};
