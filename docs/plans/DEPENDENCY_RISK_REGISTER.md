# Dependency Risk Register

This register records explicitly accepted dependency findings that cannot currently be remediated without a disproportionate compatibility or security cost. It is operational evidence, not a product requirement or architecture decision. Each entry applies only to the exact advisory and dependency path recorded below; it does not waive review of other findings.

## DR-001 — Expo tooling transitively resolves vulnerable `uuid`

| Field | Value |
|---|---|
| Status | Temporarily accepted by the owner |
| Accepted | 2026-08-22 |
| Next mandatory review | 2026-09-22 |
| Advisory | [GHSA-w5hq-g745-h8pq / CVE-2026-41907](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |
| Severity | Moderate |
| Observed command | `corepack npm@11.12.1 audit --omit=dev` |
| Observed result | 10 moderate dependency-path findings; no high or critical production findings |
| Dependency path | `expo@57.0.15` → `@expo/config-plugins` → `xcode@3.0.1` → `uuid@7.0.3` |
| Affected behavior | Caller-supplied buffer bounds handling in the `uuid` v3, v5, and v6 APIs |
| Current use | `xcode@3.0.1` calls `uuid.v4()`; the approved MVP is Android-only and does not execute Xcode project tooling |

### Decision

Keep Expo SDK 57 and its supported dependency graph unchanged. Do not force `uuid@11.1.1` outside `xcode@3.0.1`'s declared `^7.0.3` compatibility range, downgrade Expo, or adopt an unstable Expo prerelease solely to silence this finding.

This is a bounded risk acceptance, not a claim that the dependency is patched or that the audit passes. Pull requests and handoffs must continue to disclose the expected audit result accurately.

### Evidence and rationale

- Expo SDK `57.0.15` was the newest stable SDK 57 patch available when reviewed.
- The newest stable patches in Expo SDK lines 57 through 41 remained within the npm advisory's affected Expo range.
- Testing Expo `40.0.1`, the first older stable line outside that Expo range, produced 36 production findings: 2 critical, 22 high, 11 moderate, and 1 low. Downgrading would materially worsen security and compatibility.
- A scoped `xcode` → `uuid@11.1.1` override produced a clean isolated production audit and preserved the currently used `uuid.v4()` API in a compatibility probe, but it crosses a declared major-version boundary. The owner chose not to carry that unsupported override.
- The advisory identifies the vulnerable APIs as v3, v5, and v6 with caller-provided buffers; `xcode@3.0.1` uses v4. This lowers current exploitability but does not remove the vulnerable package from the graph.

### Compensating controls

- Keep the npm lockfile committed and review all dependency-graph changes.
- Keep weekly Dependabot checks and pull-request dependency review enabled.
- Do not introduce application use of the affected `uuid` v3, v5, or v6 buffer APIs.
- Do not treat this exception as permission for any new advisory, dependency path, severity, or runtime use.
- Continue using stable Expo releases and supported Expo/React Native version pairs.

### Mandatory reconsideration triggers

Reassess and either remediate or explicitly renew this entry at the earliest of:

- 2026-09-22;
- a stable Expo or `@expo/config-plugins` release removes or updates the affected dependency;
- the advisory, severity, exploitability, or affected-version range changes;
- the dependency begins executing in an Android application/runtime path;
- iOS implementation or Xcode project generation enters scope;
- public-release security review; or
- any high or critical production vulnerability appears in this dependency path.

Renewal requires a fresh production audit, dependency-path inspection, supported-version search, exploitability review, and explicit owner approval. Remove this entry after a supported dependency graph resolves the advisory and the production audit confirms it.
