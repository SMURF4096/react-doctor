# react-doctor

## 0.2.0-beta.5

### Patch Changes

- [#271](https://github.com/millionco/react-doctor/pull/271) [`7a7ec84`](https://github.com/millionco/react-doctor/commit/7a7ec84fad631d96f70279394be5f086b8424d17) Thanks [@aidenybai](https://github.com/aidenybai)! - **Per-surface diagnostic controls (CLI).** New
  `cli/utils/inspect-flags.ts` flag + companion
  `cli/utils/resolve-cli-inspect-options.ts` and
  `cli/utils/validate-mode-flags.ts` plumbing wire the new
  `@react-doctor/core` surface filter into `cli/commands/inspect.ts`
  and `inspect.ts`. Design + Tailwind cleanup categories are demoted
  from the default PR-comment surface so they no longer dominate code
  review output, while still appearing in the CLI report and at the
  CI failure gate. Documented in the package README and the new
  `action.yml` knobs.

- Inherits the rule-fix wave from
  `oxlint-plugin-react-doctor@0.2.0-beta.5` (rules are bundled into
  the CLI):
  `no-secrets-in-client-code` scoping
  ([#252](https://github.com/millionco/react-doctor/pull/252)),
  `nextjs-no-side-effect-in-get-handler` safe local bindings
  ([#260](https://github.com/millionco/react-doctor/pull/260)),
  `async-defer-await` false-positive fixes
  ([#265](https://github.com/millionco/react-doctor/pull/265)),
  `js-length-check-first` `&&`-chain detection
  ([#269](https://github.com/millionco/react-doctor/pull/269)),
  `async-parallel` test / browser-fixture suppression
  ([#270](https://github.com/millionco/react-doctor/pull/270)),
  `js-combine-iterations` lazy `Iterator` skip
  ([#272](https://github.com/millionco/react-doctor/pull/272)), and
  `no-prevent-default` framework awareness
  ([#274](https://github.com/millionco/react-doctor/pull/274)).

- [#266](https://github.com/millionco/react-doctor/pull/266) [`529015d`](https://github.com/millionco/react-doctor/commit/529015d1d89441c4708f49413ecd540db7c04255) Thanks [@aidenybai](https://github.com/aidenybai)! - Scope React Native rules to per-package boundaries. Previously every
  `rn-*` rule fired on every file in a project whose top-level framework
  was detected as React Native or Expo — even on sibling workspaces that
  were clearly web targets. In a mixed RN + web monorepo (`apps/mobile`
  alongside `apps/web` and `packages/storybook`) the rules would noisily
  report issues against Next.js, Vite, Docusaurus, Storybook, and plain
  React DOM packages where they don't apply.

  React Native rules now walk up to the file's nearest `package.json`
  before running. The rule body is skipped when the package declares a
  web-only framework (`next`, `vite`, `react-scripts`, `gatsby`,
  `@remix-run/react`, `@docusaurus/core`, `@storybook/*`, or plain
  `react-dom` without an RN sibling) and stays active when the package
  declares `react-native`, `expo`, `react-native-tvos`, `react-native-windows`,
  `react-native-macos`, anything under the `@react-native/` or
  `@react-native-` community namespaces (`@react-native-firebase/*`,
  `@react-native-async-storage/*`, `@react-native-community/*`, …), or
  Metro's top-level `"react-native"` resolution field.

  The detection is bidirectional: a web-rooted monorepo (root
  `package.json` declares `next` or `vite`) still loads `rn-*` rules
  when any workspace targets React Native or Expo, so the rules now
  fire on `apps/mobile` of a `next`-rooted repo as well as the inverse
  layout that the file-level boundary alone covered.

  `rn-no-raw-text` additionally skips raw text inside `Platform.OS === "web"`
  branches: `if`, `?:`, and `&&` / `||` short-circuits, the mirror
  `Platform.OS !== "web"` else branches, `switch (Platform.OS) { case "web": … }`
  case bodies, and the `web` arm of `Platform.select({ web: …, default: … })`.
  Optional chaining (`Platform?.OS`) and the TS non-null assertion
  (`Platform.OS!`) parse the same way as the bare form. The walker stops
  at function and `Program` boundaries so JSX defined inside a callback
  hoisted out of a `Platform.OS` branch does not inherit the parent
  guard.

  Native-only file extensions (`.ios.tsx`, `.android.tsx`, `.native.tsx`)
  keep the rule active even when the surrounding package classification
  is ambiguous.

- Updated dependencies [[`529015d`](https://github.com/millionco/react-doctor/commit/529015d1d89441c4708f49413ecd540db7c04255)]:
  - oxlint-plugin-react-doctor@0.2.0-beta.5

## 0.2.0-beta.4

### Patch Changes

- Add `oxlint-plugin-react-doctor` to `dependencies` so it is installed
  alongside the CLI. The bundler correctly externalises the plugin (oxlint
  loads it by file path at runtime) but it was missing from the published
  dependency list, causing `ERR_MODULE_NOT_FOUND` on `npx react-doctor`.
- Updated dependencies []:
  - oxlint-plugin-react-doctor@0.2.0-beta.4

## 0.2.0-beta.3

### Patch Changes

- [`10d5de8`](https://github.com/millionco/react-doctor/commit/10d5de804fe9c03fa9f18e5350bb26965a5108ac) — Fix workspace packages
  (`@react-doctor/core`, `@react-doctor/project-info`,
  `@react-doctor/types`) not being bundled into the published `dist/`
  output, which caused
  `ERR_MODULE_NOT_FOUND: Cannot find package '@react-doctor/core'`
  on `npx react-doctor` after the package extraction in beta.2.
  Vite config now treats the workspace dependencies as bundle-time
  inputs.

- Inherits the
  [#253](https://github.com/millionco/react-doctor/pull/253) `no-barrel-import`
  index-resolution fix from
  `oxlint-plugin-react-doctor@0.2.0-beta.3` (rules are bundled into
  the CLI).

- Updated dependencies []:
  - oxlint-plugin-react-doctor@0.2.0-beta.3

## 0.2.0-beta.2

### Minor Changes

- [#249](https://github.com/millionco/react-doctor/pull/249) [`f0198e2`](https://github.com/millionco/react-doctor/commit/f0198e2f2d9560a15bdb4a78f4a378ca2ac5fcdd) Thanks [@aidenybai](https://github.com/aidenybai)! - **Internal-package extraction.** The CLI no longer vendors project
  detection, the oxlint runner, scoring, or the shared type layer
  inline — those modules now live in
  `@react-doctor/types`, `@react-doctor/project-info`, and
  `@react-doctor/core` and are consumed as workspace dependencies.
  Bundled into `dist/` on publish (see also
  [#253](https://github.com/millionco/react-doctor/pull/253) bundler
  follow-up in beta.3). The `react-doctor`, `react-doctor inspect`,
  and `react-doctor install` binaries are surface-compatible with
  0.1.6.

- [#250](https://github.com/millionco/react-doctor/pull/250) [`6e2ee9d`](https://github.com/millionco/react-doctor/commit/6e2ee9d474fddbde4c1246ff65b2f3e5bb3a42fc) Thanks [@aidenybai](https://github.com/aidenybai)! - **CLI reorganised.** `src/cli/` is now split into `commands/` +
  `utils/`, mirroring the layout ported from `react-grab`. Each
  subcommand has a dedicated module (`inspect`, `install`, version /
  help). No user-visible change to flags or output.

### Patch Changes

- [#208](https://github.com/millionco/react-doctor/pull/208) [`8556b31`](https://github.com/millionco/react-doctor/commit/8556b31d8e4e165f791db0aa60a6b038b18ec777) Thanks [@aidenybai](https://github.com/aidenybai)! - **User-feedback sweep.** Reduce false positives across the design /
  Tailwind / state-and-effects rule groups, surface per-rule scoring
  contributions in `react-doctor inspect`, and add `--severity` /
  `--rule-set` CLI options plus their `react-doctor.config.json`
  counterparts. Closes the bulk of the feedback collected on 0.1.x.

- [#174](https://github.com/millionco/react-doctor/pull/174) — Forward
  `reactMajorVersion` through the programmatic `diagnose()` entry
  point so embedders running react-doctor inside their own pipeline
  (Vercel AI Code Review sandbox and friends) get the same React-19
  rule gating the CLI gets.

- [#202](https://github.com/millionco/react-doctor/pull/202) [`53fa4df`](https://github.com/millionco/react-doctor/commit/53fa4dffe837e0157fb850fef700fccaaec191ea) Thanks [@aidenybai](https://github.com/aidenybai)! - Detect the project's Tailwind version (`tailwindcss` in `package.json`,
  including pnpm and Bun catalog references) and gate Tailwind-aware
  rules on it. `design-no-redundant-size-axes` (which suggests collapsing
  `w-N h-N` → `size-N`) now stays silent on Tailwind v3.0 … v3.3 — those
  versions predate the `size-N` shorthand and the suggestion would
  generate classes that don't compile. The rule still fires on Tailwind
  v3.4+, v4+, and when the Tailwind version cannot be resolved.

  A new `tailwindVersion` field is added to `ProjectInfo` and printed
  during scans so it's visible alongside the detected React version and
  framework.

## 0.1.6

### Patch Changes

- fix

## 0.1.5

### Patch Changes

- b06b768: `diagnose()` now falls back to the first nested React subproject when the
  requested directory has no root `package.json`, instead of crashing with
  `No package.json found in <directory>`. This unblocks external review
  runners (e.g. the Vercel AI Code Review sandbox) that point `diagnose()`
  at the cloned repo root for projects whose `package.json` lives in a
  subfolder like `apps/web`. When neither the root nor any nested
  subdirectory contains a React project, `diagnose()` now throws a clearer
  `No React project found in <directory>` error.
- fix

## 0.1.4

### Patch Changes

- fix

## 0.1.3

### Patch Changes

- fix

## 0.1.2

### Patch Changes

- fix

## 0.1.1

### Patch Changes

- fix

## 0.1.0

### Minor Changes

- d71a6bf: feat(react-doctor): ship rules as an ESLint plugin (`react-doctor/eslint-plugin`)

  The same React Doctor rule set that powers the CLI scan and the
  `react-doctor/oxlint-plugin` export is now available as a first-class
  ESLint plugin. Drop it into your `eslint.config.js` flat config and
  diagnostics surface inline through whichever IDE / agent / pre-commit
  hook already speaks ESLint — no separate `react-doctor` invocation
  needed.

  ```js
  // eslint.config.js
  import reactDoctor from "react-doctor/eslint-plugin";

  export default [
    reactDoctor.configs.recommended,
    reactDoctor.configs.next, // composable framework presets
    reactDoctor.configs["react-native"],
    reactDoctor.configs["tanstack-start"],
    reactDoctor.configs["tanstack-query"],
    // reactDoctor.configs.all, // every rule at react-doctor's default severity
  ];
  ```

  The exported `recommended`, `next`, `react-native`, `tanstack-start`,
  `tanstack-query`, and `all` configs reuse the exact severity maps the
  react-doctor CLI emits to oxlint, so behavior stays in lock-step
  between engines. You can also cherry-pick individual rules under the
  `react-doctor/*` namespace.

  The visitor signatures inside each rule are already ESLint-compatible
  (`create(context) => visitors`); the new export wraps each rule with
  the ESLint-required `meta` (`type`, `docs.url`, `schema`) and exposes
  the plugin shape ESLint v9 flat configs expect. Closes
  [#143](https://github.com/millionco/react-doctor/issues/143).

- d71a6bf: feat(react-doctor): adopt the project's existing oxlint / eslint config and factor those rules into the score

  When a project has a JSON-format oxlint or eslint config (`.oxlintrc.json`
  or `.eslintrc.json`) at the scanned directory or any ancestor up to the
  nearest project boundary (`.git` directory or monorepo root),
  react-doctor now folds that config into the same scan via oxlint's
  `extends` field. The user's existing rules fire alongside the curated
  react-doctor rule set, and the resulting diagnostics count toward the
  0–100 health score — no separate `oxlint` / `eslint` invocation needed.

  **Behavior change on upgrade.** Projects with an existing
  `.oxlintrc.json` / `.eslintrc.json` will see new diagnostics flow into
  the score on first run; the score may drop. Set
  `"adoptExistingLintConfig": false` in `react-doctor.config.json` (or the
  `"reactDoctor"` key in `package.json`) to preserve the previous
  behavior. `customRulesOnly: true` also implies opt-out, since that mode
  runs only the `react-doctor/*` plugin.

  **Resilience.** If oxlint can't load the user's config (broken JSON,
  missing plugin, unknown rule name), react-doctor logs the reason on
  stderr and retries the scan once without `extends` so the score is
  still computed off the curated rule set instead of failing the whole
  lint pass.

  **Coverage broadened.** Diagnostics on `.ts` and `.js` files are now
  reported (previously the parser dropped everything that wasn't `.tsx`
  / `.jsx`). This affects react-doctor's own JS-performance / bundle-size
  rules in addition to adopted user rules.

  **Limitations.** Only JSON configs are picked up: oxlint's `extends`
  cannot evaluate JS or TS, so flat configs (`eslint.config.js`),
  `.eslintrc.{js,cjs}`, and `oxlint.config.ts` are silently skipped.
  Rule-level severities (`"rules": {...}`) flow through, but
  category-level enables (`"categories": {...}`) do not — react-doctor's
  local categories block always wins. Closes #143.

- d71a6bf: feat(react-doctor): add 11 new lint rules — 3 state / correctness, 8 design system

  **3 new state / correctness rules** (all `warn`):

  - `react-doctor/no-direct-state-mutation` — flags `state.foo = x` and
    in-place array mutators (`push` / `pop` / `shift` / `unshift` /
    `splice` / `sort` / `reverse` / `fill` / `copyWithin`) on `useState`
    values. Tracks shadowed names through nested function params and
    locals so a handler that re-binds the state name doesn't
    false-positive.
  - `react-doctor/no-set-state-in-render` — flags only **unconditional**
    top-level setter calls so the canonical
    `if (prev !== prop) setPrev(prop)` derive-from-props pattern stays
    clean.
  - `react-doctor/no-uncontrolled-input` — catches `<input value={…}>`
    without `onChange` / `readOnly`, `value` + `defaultValue` conflicts,
    and `useState()` flip-from-undefined. Bails on JSX spread props
    (`{...register(…)}`, Headless UI, Radix) where `onChange` may come
    from spread.

  **8 new design-system rules in `react-ui.ts`** (all `warn`):

  - `react-doctor/design-no-bold-heading` —
    `font-bold` / `font-extrabold` / `font-black` or inline
    `fontWeight ≥ 700` on `h1`–`h6`.
  - `react-doctor/design-no-redundant-padding-axes` — collapse
    `px-N py-N` → `p-N`.
  - `react-doctor/design-no-redundant-size-axes` — collapse `w-N h-N` →
    `size-N`.
  - `react-doctor/design-no-space-on-flex-children` — use `gap-*` over
    `space-*-*`.
  - `react-doctor/design-no-em-dash-in-jsx-text` — em dashes in JSX
    text.
  - `react-doctor/design-no-three-period-ellipsis` — `Loading...` →
    `Loading…`.
  - `react-doctor/design-no-default-tailwind-palette` —
    `indigo-*` / `gray-*` / `slate-*` reads as the Tailwind template
    default; reports every offending token in the className (not just
    the first).
  - `react-doctor/design-no-vague-button-label` — `OK` / `Continue` /
    `Submit` etc.; recurses into `<>…</>` fragment children.

  Each new rule has dedicated regression tests covering both the
  positive trigger and the false-positive cases above.

  **Other**

  - Hoists shared regex / token patterns into the appropriate
    `constants.ts` per AGENTS.md.

- d71a6bf: remove(react-doctor): drop browser entrypoints, browser CLI, and the
  `react-doctor-browser` workspace package

  **Removed package exports.** `react-doctor/browser` and
  `react-doctor/worker` are no longer published. Imports of either subpath
  will fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`. If you depended on the
  in-browser diagnostics pipeline (caller-supplied `projectFiles` map +
  `runOxlint` callback running oxlint in a Web Worker), pin
  `react-doctor@0.0.47` or vendor the relevant modules from the
  `archive/browser` git branch.

  **Removed CLI subcommand.** `react-doctor browser …` (`start`, `stop`,
  `status`, `snapshot`, `screenshot`, `playwright`) is gone. The
  long-running headless Chrome session, ARIA snapshot helpers, screenshot
  capture, and `--eval` Playwright harness are no longer available from
  the CLI.

  **Removed companion package.** The `react-doctor-browser` npm package
  (headless browser automation, CDP discovery, system Chrome launcher,
  cross-browser cookie extraction) has been removed from the workspace.
  The last published version remains installable on npm but will not
  receive further updates.

  **Why.** The browser surface area was unused inside the monorepo (the
  website does not import it) and added a heavy dependency footprint
  (`playwright`, `libsql`, etc.) for a public API with no known internal
  consumers. Removing it tightens what `react-doctor` is responsible for —
  the diagnostics CLI, the Node `react-doctor/api`, and the
  `react-doctor/eslint-plugin` / `react-doctor/oxlint-plugin` exports.

  The full removed source remains available on the `archive/browser`
  branch for anyone who wants to fork or vendor the modules.

### Patch Changes

- 2aebfa6: fix(react-doctor): support block comment forms of `react-doctor-disable-line` / `react-doctor-disable-next-line`

  The inline-suppression matcher previously only recognized line comments
  (`// react-doctor-disable-…`). Block comments — including the JSX form
  `{/* react-doctor-disable-next-line … */}`, which is the only suppression
  form legal directly inside JSX — were silently ignored, forcing users to
  write `{/* // react-doctor-disable-line … */}` as a workaround. Both forms
  now work, and either accepts a comma- or whitespace-separated rule list
  or no rule id (suppress every diagnostic on the targeted line). Closes #144.

- 2aebfa6: fix(react-doctor): stop flagging `useState` as `useRef` when state reaches render through `useMemo`, derived values, or context `value`

  `rerender-state-only-in-handlers` (the rule that suggests "use `useRef`
  because this state is never read in render") only checked whether the
  state name appeared by name in the component's `return` JSX. That
  heuristic produced loud false positives for ordinary patterns:

  - state filtered/derived through `useMemo` → JSX uses the memo result
  - state passed as the `value` of a React Context Provider
  - state combined with other variables into a rendered constant

  Following the bad hint and converting these to `useRef` silently broke
  apps because `ref.current = …` does not trigger a re-render — search
  results stopped updating, dialogs stayed open, and context consumers
  saw stale snapshots.

  The rule now performs a transitive "render-reachable" analysis on
  top-level component bindings. A `useState` is only flagged when neither
  the value itself nor anything derived from it (recursively) appears
  anywhere in the rendered JSX, including attribute values like
  `<Context value={…}>`, `style={…}`, `className={…}`, etc. Truly
  transient state (e.g. a scroll position only stored to be ignored)
  still fires. Closes #146.

- fix

## 0.0.47

### Patch Changes

- fix
- 6a0e6d6: chore(react-doctor): bump oxlint to ^1.62.0

  Pulls in oxlint v1.61.0 + v1.62.0 improvements (additional Vue rules,
  jest/vitest rule splits, autofix for prefer-template, no-unknown-property
  support for React 19's precedence prop, jsx-a11y/anchor-is-valid attribute
  settings, and various correctness fixes). The release-line breaking
  changes are internal Rust API only — oxlint's CLI and config schema
  are unchanged.

- dbf200d: fix(react-doctor): filter React Compiler rules to those the loaded `eslint-plugin-react-hooks` actually exports

  Follow-up to the #141 fix in 0.0.46. The peer range `^6 || ^7` allows
  v6.x of `eslint-plugin-react-hooks`, which doesn't expose the
  `void-use-memo` rule (added in v7). When a v6 user had React
  Compiler detected, oxlint failed with
  `Rule 'void-use-memo' not found in plugin 'react-hooks-js'`. The
  config now introspects the loaded plugin's `rules` map and only
  enables `react-hooks-js/*` entries that the installed version
  actually exports — so future rule additions or removals can no
  longer crash a scan.

## 0.0.46

### Patch Changes

- c13a8df: fix(react-doctor): skip React Compiler rules when `eslint-plugin-react-hooks` isn't installed

  When a project had React Compiler detected but the optional peer
  `eslint-plugin-react-hooks` was not installed, oxlint failed with
  `react-hooks-js not found` because the React Compiler rules were
  emitted into the config without the corresponding plugin entry.
  Gate `REACT_COMPILER_RULES` on successful plugin resolution so a
  missing optional peer silently skips them instead of crashing the
  scan (#141).

- fix

## 0.0.45

### Patch Changes

- 6b07924: `react-doctor install` now delegates skill installation to
  [`agent-install`](https://www.npmjs.com/package/agent-install) `0.0.4`,
  which natively models **54 supported coding agents** (up from the 8 we
  previously hand-rolled).

  Behavior changes:

  - **Detection** is now the union of CLI binaries on `$PATH` (the previous
    signal) and config dirs in `$HOME` (`~/.claude`, `~/.cursor`,
    `~/.codex`, `~/.factory`, `~/.pi`, etc.). This catches agents the user
    has run at least once even if the CLI is no longer on `$PATH`, and vice
    versa.
  - **All 8 originally documented agents stay supported**: Claude Code,
    Codex, Cursor, Factory Droid, Gemini CLI, GitHub Copilot, OpenCode, Pi.
  - **46 newly supported agents** via upstream `agent-install@0.0.4`:
    Goose, Windsurf, Roo Code, Cline, Kilo Code, Warp, Replit, OpenHands,
    Qwen Code, Continue, Aider Desk, Augment, Cortex, Devin, Junie, Kiro
    CLI, Crush, Mux, Pochi, Qoder, Trae, Zencoder, and many more.
  - **Bug fix**: malformed `SKILL.md` frontmatter now surfaces as an error
    instead of a silent "installed for ..." success with zero files
    written. Build-time validation in `vite.config.ts` also catches this
    before publish.

- fix

## 0.0.44

### Patch Changes

- fix

## 0.0.43

### Patch Changes

- **Respect existing eslint / oxlint / prettier ignores by default.** React Doctor now honors `.gitignore`, `.eslintignore`, `.oxlintignore`, `.prettierignore`, and `.gitattributes` `linguist-vendored` / `linguist-generated` annotations, plus inline `// eslint-disable*` and `// oxlint-disable*` comments. Previously inline disable comments were neutralized so react-doctor saw through every prior suppression — this surprised users who had `eslint-disable` in place for legitimate reasons. **Behavior change:** existing users may see fewer findings (previously-suppressed code is now correctly suppressed). To restore the old "audit everything" behavior, set `"respectInlineDisables": false` in `react-doctor.config.json` or pass `--no-respect-inline-disables` on the CLI.
- **Internals:** the ignore-pattern collector now writes a single combined `--ignore-path` file rather than passing N `--ignore-pattern` args; this removes a `baseArgs`-length pressure point that could shrink batch sizes on large diffs. Boolean config fields (`lint`, `deadCode`, `verbose`, `customRulesOnly`, `share`, `respectInlineDisables`) are now coerced from the common `"true"` / `"false"` JSON-string typo at config-load time, with a warning. The `parseOxlintOutput` "no files to lint" workaround is now locale-agnostic (it skips any noise before the first `{`). The non-git audit-mode fallback walks the project tree directly instead of silently no-op'ing when `git grep` isn't available. New regression suite covers all of the above end-to-end.

## 0.0.42

### Patch Changes

- 79fb877: Fix `Dead code detection failed (non-fatal, skipping)` (#135). The plugin-failure detector now walks the error cause chain, matches Windows-style paths, plugin configs without a leading directory, and parser errors, so knip plugin loading errors are recovered from in more environments. The retry loop also now surfaces the original knip error after exhausting attempts (previously could throw a generic `Unreachable` error) and only disables knip plugin keys it actually recognizes. Dead-code and lint failures are now reported with the full cause chain instead of a single wrapped `Error loading …` line.
- 391b751: Fix knip step ignoring workspace-local config in monorepos (#136). When a workspace owns its own knip config (`knip.json`, `knip.jsonc`, `knip.ts`, etc.), `runKnip` now runs knip with `cwd = workspaceDirectory` so the config is discovered, instead of running from the monorepo root with `--workspace` and silently falling back to knip's defaults — which mass-flagged every file as `Unused file` for setups like TanStack Start whose entry layout doesn't match the defaults. Behavior for monorepos with a root-level `knip.json` containing a `workspaces` mapping is unchanged.

## 0.0.41

### Patch Changes

- fix

## 0.0.40

### Patch Changes

- fix

## 0.0.39

### Patch Changes

- 7da4ce4: Fix `TypeError: issues.files is not iterable` crash during dead code detection. Knip 6.x returns `issues.files` as an `IssueRecords` object instead of a `Set<string>`. The dead code pass now handles both shapes (and arrays) defensively.
- fix

## 0.0.37

### Patch Changes

- fix skill

## 0.0.36

### Patch Changes

- fix

## 0.0.35

### Patch Changes

- fix

## 0.0.34

### Patch Changes

- fix

## 0.0.33

### Patch Changes

- fix

## 0.0.32

### Patch Changes

- fix

## 0.0.31

### Patch Changes

- fix

## 0.0.30

### Patch Changes

- fix issues

## 0.0.29

### Patch Changes

- fix

## 0.0.28

### Patch Changes

- fix

## 0.0.27

### Patch Changes

- cleanip

## 0.0.26

### Patch Changes

- fix

## 0.0.25

### Patch Changes

- fix

## 0.0.24

### Patch Changes

- fix

## 0.0.23

### Patch Changes

- fix issues

## 0.0.22

### Patch Changes

- fix

## 0.0.21

### Patch Changes

- offline flag

## 0.0.20

### Patch Changes

- log err

## 0.0.19

### Patch Changes

- fix issues

## 0.0.18

### Patch Changes

- fix

## 0.0.17

### Patch Changes

- add lopgging

## 0.0.16

### Patch Changes

- fix: log lint errors

## 0.0.15

### Patch Changes

- export node api

## 0.0.14

### Patch Changes

- fix repo

## 0.0.13

### Patch Changes

- fix: skill

## 0.0.12

### Patch Changes

- fix

## 0.0.11

### Patch Changes

- fix: enviroment vars

## 0.0.10

### Patch Changes

- almost ready

## 0.0.9

### Patch Changes

- fix

## 0.0.8

### Patch Changes

- react doctor

## 0.0.7

### Patch Changes

- fix: deeplinking

## 0.0.6

### Patch Changes

- fix: improvements

## 0.0.5

### Patch Changes

- scores

## 0.0.4

### Patch Changes

- fix

## 0.0.3

### Patch Changes

- fix: noisiness

## 0.0.2

### Patch Changes

- init

## 0.0.1

### Patch Changes

- init
