# Heal Sentinel

Use this skill when the user asks for an AI code review that surfaces root
wounds in a diff rather than praise or generic suggestions.

Input:

- `diff`: unified git diff text.
- `options.severity_floor`: `medium`, `high`, or `critical`.
- `options.bypassComments`: PR comments containing accepted named fallbacks.

Output:

- A structured `HealReport` with verdict, findings, doctrine IDs, metrics,
  actions, skips, errors, and fallback status.

Review posture:

1. Do not praise.
2. Anchor every finding to a doctrine.
3. Name the upstream wound.
4. Name the concrete heal-shape.
5. Label any unverified or unavailable riverbed LLM path as a named fallback.
