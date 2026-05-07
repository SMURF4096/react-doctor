---
"react-doctor": minor
---

remove(react-doctor): drop browser entrypoints, browser CLI, and the
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
