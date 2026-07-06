# Heal Sentinel

AI code review that refuses praise.

v0.1.1 ships the working core analyzer, CLI, public demo surface, GitHub
Action wrapper, MCP wrapper, Claude Skill manifest, doctrine catalog, and
Skybridge manifest.

## Local Quickstart

```bash
cd heal-sentinel
npm test
node bin/heal-sentinel.mjs examples/sample.diff --json
```

## CLI

```bash
tfb-heal-sentinel <diff-file> --json --severity-floor high
```

Exit codes:

- `0`: no findings or all findings have named fallback acceptance.
- `2`: unresolved findings.

## Report Contract

`analyze(diff, options)` returns:

- `verdict`: `NO_BYPASS`, `BYPASS_ACCEPTED_WITH_NAMED_FALLBACK`, or `NO_FINDINGS`
- `findings`: ranked findings with rule, doctrine, severity, file, line, snippet,
  riverbed, and heal shape
- `doctrines_invoked`
- `metrics`
- `actions`, `skips`, `errors`
- `fallback`

## Release Hold

This repo is private. The public package is intentionally marked `private: true`
and `UNLICENSED` until CEO release approval and Skybridge admission. See
`PUBLIC_RELEASE_APPROVAL.md`.
