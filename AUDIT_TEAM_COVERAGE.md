# Heal Sentinel Audit Team Coverage

Date: 2026-07-01

Scope: first public-facing Heal Sentinel build in `heal-sentinel/` and
`firebase/public/heal-sentinel/`.

OpenRouter status: attempted through `scripts/openrouter_fusion_call.py`.
The sandbox DNS path failed first. The escalated network call was then denied
by the approvals reviewer because the packet would disclose private workspace
details and operational receipts to an external model endpoint. External
OpenRouter audit is therefore blocked until the operator explicitly approves a
redacted packet after that disclosure risk is named.

## Receipts Observed

- `npm run verify`: 5 tests passed, build returned `ok: true`, and synced the
  browser demo library.
- `find heal-sentinel -name '*.mjs' -exec node --check {} \;`: passed when run
  after build. A first concurrent run raced with `npm run build` deleting and
  recreating `dist/`; this is a verification-method wound, not a product
  runtime wound.
- CLI clean diff: `NO_FINDINGS`.
- CLI sample diff: exit `2`, `NO_BYPASS`, 6 findings.
- MCP self-test: `ok: true`.
- Skybridge admission: `ADMIT · Tier B`.
- TFBthumb local-check: `ok=True`, vendored files `6`.
- TFBthumb browser verify: page settled and controls resolved for `Sample`,
  `Analyze`, `Copy`, and `Severity floor`; static result text was not resolved
  by this named-affordance pass.
- Playwright MCP browser receipt: desktop and mobile showed `NO_BYPASS`, 6
  findings, 4 doctrine entries, image loaded, no horizontal overflow.
- Security header probe against local Python static server: missing
  `x-content-type-options`, `referrer-policy`, `content-security-policy`,
  `permissions-policy`, and `strict-transport-security`.
- Firebase hosting config exists with global security headers, but the global
  CSP includes `'unsafe-inline'` and `'unsafe-eval'`, and no HSTS header was
  present in the config inspected.
- Dr Cron change gate self-test: 3 fixtures passed.
- Universal string watcher with real crontab access: 136 crons checked, 135 ok,
  1 warn, 0 fail, 5 overdue via heartbeat; 26/26 launch agents ok; 5/5 studio
  ports ok.
- Watcher heartbeat scan: 7 watchers found, 2 fresh, 5 stale.
- TFB Telescope reference battery: `python3 tfb_telescope/telescope_v0.py`
  returned `INSTRUMENT IS TRUSTWORTHY (sensitive + specific)` with positive
  control pass, real-target parallax pass, and dark-field null pass.
- Post-heal `npm run verify`: 6 tests passed, including hard-negative fixtures;
  build synced source, doctrine catalog, and release contracts.
- Post-heal `npm run release:gate`: `ok: true`,
  `decision: HOLD_WITH_NAMED_GAPS`; the gate checks stable post-build syntax,
  Drawbridge hard negatives, claim lock, app-specific headers, release string,
  Skybridge receipt, and TFBthumb proof surface.
- Post-heal `npm run release:ready`: intentionally blocked with
  `decision: BLOCKED` because public-ready claims still need the hosted receipt,
  fresh watcher receipt, and CEO approval.
- Post-heal strict preview header probe:
  `python3 scripts/security_header_probe.py http://127.0.0.1:4180/heal-sentinel/`
  returned `ok: true`, `missing_header_count: 0`.
- Post-heal TFBthumb browser verify against strict preview resolved reachable
  controls for `Analyze`, `Copy`, and `Result verdict`; `Result verdict` value
  was `NO_BYPASS`, and `Analysis report JSON` contained the full structured
  report.
- Post-heal Skybridge receipt exists at
  `release/skybridge-admission.receipt.json` with `ok: true`,
  `verdict: ADMIT`, `tier: B`.

## Seat Verdicts

| Seat | Verdict | Covered | Root Wound / Gap | Heal Before Public Release | Kill-Test / Receipt |
| --- | --- | --- | --- | --- | --- |
| Code Mechanic | GREEN | Tests, build, CLI paths, MCP self-test, post-build syntax pass, structured Result output, ordered release gate. | The race wound is healed by moving syntax checks into a stable post-build release gate. | Keep `npm run release:gate` as the one ordered receipt bundle; do not parallelize generated-output parse checks with build. | `npm run verify` + `npm run release:gate`. |
| TFB Drawbridge | GREEN | Clean diff, wound sample, broad refactor hard-negative, adversarial quoted-text hard-negative, and malformed input are covered. | Mention-vs-use was the hidden root wound: quoted payload containing the word "patch" fired as posture. | Lexical scanner now skips quoted fixture/payload mentions while preserving real posture findings. | `npm test` hard-negative fixture test plus sample diff still returns `NO_BYPASS`. |
| TFB Skybridge | GREEN | `skybridge.json` is scoped to `api.anthropic.com`, `connect-src`, and `storage:scoped`; durable receipt records `ADMIT`, Tier B. | Admission used to live only in terminal output and a dist placeholder kept surviving builds. | `npm run admit` now writes `release/skybridge-admission.receipt.json`; build copies release contracts into dist. | `npm run admit` then `npm run release:gate`. |
| David+ | YELLOW | Static app escapes rendered findings, has no secrets, has app-specific strict headers, strict preview header probe is green, clipboard-denied fallback exists. | Hosted-origin proof is still missing, and the wider Firebase global CSP remains broad for legacy surfaces. | Deploy/preview the Firebase site and run `security_header_probe` against the hosted `/heal-sentinel/` route before public-ready wording. | Strict local preview is green; hosted Firebase preview receipt remains required. |
| Dr Cron | GREEN | Static app does not need cron/tunnel; release string names route, expected response, security check, browser check, escalation surface, and owner. | The absence wound was an unrecorded route string; adding a cron would have been a new unnecessary surface. | Keep `ops/release-string.json` as the product string; only add cron if a future recurring check has a real owner and marker chain. | `npm run release:gate` checks the route string. |
| TFBthumb | GREEN | TFBthumb local substrate preflight green; strict-preview browser proof resolves `Result verdict` with value `NO_BYPASS`; JSON report surface contains full structured output. | Original proof only saw controls; result behavior was only in Playwright. | Result verdict is now a reachable control and clipboard fallback selects the structured report. | TFBthumb verify against strict preview plus Playwright visual/mobile receipt. |
| Watcher | YELLOW | Product route/watch contract exists in the release string and release gate. | Wider-substrate watcher heartbeat scan still had 5 stale watchers at audit time. That is environmental release risk, not a Heal Sentinel code wound. | Rerun/investigate the stale watcher set before hosted public-ready claim. | Fresh `watcher_heartbeat.py --stale 1800 --json` receipt. |
| TFB Telescope | GREEN | Claim lock exists; release gate fills claims from receipts; `release:ready` intentionally blocks public-ready wording. | The blurry release sentence wound is healed into separate claims with statuses, allowed wording, and missing receipts. | Keep claim edits pre-registered; do not move a claim to green after the fact without adding the receipt. | `npm run release:gate` returns `HOLD_WITH_NAMED_GAPS`; `npm run release:ready` blocks. |

## Ranked Release Concerns

1. **Hosted public-ready proof is still pending.** Local strict preview is green;
   Firebase hosted preview or deployed origin still needs the same header probe.
2. **CEO release approval is still pending.** `release:ready` blocks by design
   until the approval token and hosted receipts exist.
3. **Watcher environmental liveness is still pending.** Product route/watch is
   recorded, but the wider substrate had stale watchers during the audit.
4. **Legacy global Firebase CSP remains broad.** `/heal-sentinel/**` is strict;
   older surfaces still inherit the permissive catch-all and should be handled
   as their own family of wounds.
5. **OpenRouter external audit remains blocked by disclosure policy.** Any
   external model audit needs a redacted packet and explicit approval.

## Boundary

This audit does not claim public release readiness. The current build is strong
enough for local review and hosted preview hardening. Public publish should
wait for the hosted security-header receipt, fresh watcher receipt, and CEO
release approval. The gate now enforces that boundary.
