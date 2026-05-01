---
"react-doctor": patch
---

fix(react-doctor): skip React Compiler rules when `eslint-plugin-react-hooks` isn't installed

When a project had React Compiler detected but the optional peer
`eslint-plugin-react-hooks` was not installed, oxlint failed with
`react-hooks-js not found` because the React Compiler rules were
emitted into the config without the corresponding plugin entry.
Gate `REACT_COMPILER_RULES` on successful plugin resolution so a
missing optional peer silently skips them instead of crashing the
scan (#141).
