<!--
Title: <type>(<optional-scope>): <concise outcome> (#<issue>)
Use `Closes #...` only when merge completes the full ticket definition of done.
Use `Refs #...` when approved non-automatable verification must remain open after merge.
-->

## Summary

<!-- Describe the observable outcome and why this change is needed. -->

## Issue and traceability

- Issue: <!-- Closes #... OR Refs #... -->
- Requirements and acceptance criteria: <!-- FR-...; AC-...; PRIV-...; SEC-... -->
- Architecture sections: <!-- docs/ARCHITECTURE.md sections -->
- Parent epic and dependencies: <!-- #...; None if not applicable -->

## Scope

- [ ] The change implements only the linked issue.
- [ ] No production-only or explicitly deferred feature was added to the MVP.
- [ ] Product, domain, and architecture documentation remains aligned, or approved documentation changes are included and explained.

## Security and privacy

<!-- Identify affected trust boundaries, authorization, sensitive data, retention, offline, notification, and device-only location considerations. Enter "No affected boundary" only with a short justification. -->

- [ ] External and cross-boundary input is validated where applicable.
- [ ] Authorization and ownership are enforced independently of client-supplied identifiers where applicable.
- [ ] No secret, exact location, coordinate, credential, provider token, or prohibited sensitive data is exposed or committed.
- [ ] Applicable security/privacy findings are resolved; none are deferred.

## Verification

| Check or scenario | Result | Evidence |
|---|---|---|
| <!-- command/check --> | <!-- Passed/Failed/Not run --> | <!-- output, artifact, or explanation --> |

### Incomplete non-automatable verification

<!-- If none, write "None." Otherwise list the missing physical-device, preview-provider, or operational evidence, why it is incomplete, its risk, and the follow-up. Use `Refs #...`; the issue must move to Verification and remain open. -->

## Review and merge checklist

- [ ] Required deterministic checks pass.
- [ ] Review conversations and findings are resolved.
- [ ] Generated artifacts, migrations, dependency/lockfile changes, and final diff were inspected as applicable.
- [ ] The issue reference uses `Closes` only if the complete definition of done is satisfied; otherwise it uses `Refs`.
- [ ] The change is eligible for squash merge by the human owner.
