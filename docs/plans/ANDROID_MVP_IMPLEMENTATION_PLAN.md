# Android MVP Implementation Plan

## 1. Plan control

| Field | Value |
|---|---|
| Plan status | Implementation-ready except for the explicit blockers in Section 3 |
| Scope | Approved personal-first Android MVP only |
| Product source | `PRODUCT_SPEC.md` v0.1.27 |
| Domain source | `CONTEXT.md`, read in full on 2026-08-21 |
| Technical source | `ARCHITECTURE.md` v0.1.10 |
| Repository policy | `AGENTS.md`, read in full on 2026-08-21 |
| Output type | Planning artifact only; this plan adds no application code or product behavior |

The Product Spec owns observable behavior, the Architecture owns implementation boundaries, and Context owns terminology. A ticket may refine an implementation detail only where the approved documents permit it. A discovery that changes scope, behavior, privacy, security, retention, or failure semantics must stop and enter change control.

## 2. Delivery strategy

The work is organized into dependency-ordered tickets under eight epics. Ticket order is the default pull order; explicitly listed parallel work may proceed concurrently after its dependencies pass.

The smallest deployable usable vertical slice is **VS-1: authenticated Unscheduled Task management**:

1. the allowlisted owner signs in through Google;
2. creates a title-only Unscheduled Task;
3. reloads, views, and edits it;
4. deletes it only after confirmation; and
5. logs out with protected local cleanup.

VS-1 proves the repository, mobile-to-API contract, database ownership, authentication, local secret handling, and basic Task lifecycle without pretending to validate the differentiating context engine. The smallest **context-aware hypothesis slice**, VS-2, adds one Scheduled Reminder and one Saved Place Context under flat OR, Evaluation Episode deduplication, one grouped-capable detailed push, authenticated detail, and per-Task action. VS-2 cannot complete until the geofencing proof gate closes.

## 3. Contradictions, gaps, and decision gates

### 3.1 Blocking documentation conflict

- **DOC-001 — source-version drift (resolved 2026-08-22).** `ARCHITECTURE.md` §1 now identifies Product Spec v0.1.27 as the current product constraint. The correction is administrative: Architecture §§3.16 and 8 already contain the production-MVP owner allowlist and completed stack-status boundary. It changes no architecture boundary or product behavior.

### 3.2 Missing product-visible decisions

- **PD-001 — Saved Place region radius (resolved 2026-08-22).** Home and Work/School Anchors use a fixed 300-metre MVP region. The value is not user-configurable and may be tuned only during testing. Product Spec v0.1.26 records the decision as OD-051.
- **PD-002 — complete Task-list ordering (resolved 2026-08-22).** Product Spec v0.1.27 / OD-052 and RULE-043 order overdue Deadline-bearing items first, then future Deadline-bearing items, then no-Deadline items, with deterministic creation-time and canonical-ID tie-breakers.

These require Product Spec change control with affected IDs and acceptance updates; they are not ADR-only decisions.

### 3.3 Required engineering decisions or evidence gates

| ID | Decision/evidence | Must close before | Resolution artifact |
|---|---|---|---|
| TD-001 | Reverify and pin the workspace bootstrap: Expo/React Native/Android SDK baseline, Node, npm, NestJS, Drizzle, and root quality tooling. Supabase CLI/PostgreSQL and Terraform/provider version evidence stays with the later tickets that introduce those toolchains. | MVP-003 and every later ticket that consumes the bootstrap toolchain | Lockfiles/configuration plus bootstrap evidence; Architecture §8 permits this. |
| TD-002 | Choose environment-specific Android application IDs, deep-link schemes, EAS project/build identities, Firebase projects, OAuth redirects, and the owner allowlist value. | MVP-008, MVP-011 | Environment inventory; secrets stay outside Git. |
| TD-003 | Document the global NestJS `ValidationPipe` unknown-field policy and bounded request/input limits. Any user-visible limit not entailed by the spec enters change control. | MVP-005 | Narrow technical decision under Architecture §§3.10 and 6. |
| TD-004 | Promote `expo-location` or activate the preapproved Kotlin `GeofencingClient` fallback from physical-device evidence. | MVP-020 | Geofencing spike report and keep/fallback decision. |
| TD-005 | Define the allowlisted recognized map-link domains/forms and parser behavior; unsupported input must still fall back to manual confirmation. | MVP-022 | Security-reviewed adapter decision and fixtures. |
| TD-006 | Select the immediate Undo presentation duration and process-exit presentation. The spec explicitly classifies these as design details and excludes cross-restart Undo. | MVP-017 | UX/technical note; no recovery semantics may change. |
| TD-007 | Set deterministic bounded retry counts/backoff, dispatcher cadence, queue timeouts, and concurrency without changing canonical Retry Exhausted or reminder-time semantics. | MVP-032, MVP-036, MVP-041 | Environment configuration with failure tests. |
| TD-008 | Set database pool/connection budgets, Cloud Run maximums, provider hard quotas, budget thresholds, container base digest, and backup key/custody procedure from free-tier evidence. | MVP-008, MVP-010, MVP-047 | Reviewed operational configuration and runbook. |
| TD-009 | Select Snooze input controls and validation capable of expressing a user-selected positive elapsed duration. A product-visible minimum, maximum, or restricted preset-only list needs change control. | MVP-038 | UX/validation decision. |

No other owner-level stack decision is open. These technical decisions should use `docs/decisions/` only when the result is both hard to reverse and surprising with real alternatives; evidence/configuration belongs in the relevant plan, runbook, or module documentation instead of an automatic ADR.

### 3.4 Decision register

This register records the implementation blockers identified at baseline freeze. It is a coordination record, not a source of product behavior or an ADR. Product-visible decisions remain open until the Product Spec changes through Appendix A.1; technical gates close only through the stated evidence.

| ID | Status | Accountable role | Resolution boundary | Blocks |
|---|---|---|---|---|
| DOC-001 | Resolved — administrative correction | Implementation lead | Architecture v0.1.9 cites Product Spec v0.1.27; no behavior changed. | None |
| PD-001 | Resolved — product decision | Product owner | Product Spec v0.1.26 / OD-051: fixed 300-metre MVP region; testing-tunable, not user-configurable. | None |
| PD-002 | Resolved — product decision | Product owner | Product Spec v0.1.27 / OD-052 / RULE-043 defines deterministic Task-list ordering. | None |
| TD-001 | Resolved — bootstrap evidence (2026-08-22) | Implementation lead | `.nvmrc`, `package.json`, and `package-lock.json` pin current Node 24 LTS 24.19.0, npm 11.12.1, Expo SDK 57.0.15 / React Native 0.86.2, NestJS 11.2.1, Drizzle 0.45.2 / Kit 0.31.10, TypeScript 5.9.3, ESLint 10.9.0, Prettier 3.9.6, and Jest 29.7.0. The compatible TypeScript 5.9 line is deliberate: the selected `typescript-eslint` 8.56.1 supports TypeScript below 6. Provider/local-stack and infrastructure pinning belongs to the ticket that introduces each toolchain. | None |
| TD-002 | Open — environment configuration | Implementation lead | Environment inventory; secret values remain outside Git. | MVP-008, MVP-011 |
| TD-003 | Open — implementation decision | API engineering | Reviewed validation policy and bounded input configuration; any product-visible limit enters product change control. | MVP-005 |
| TD-004 | Open — physical-device evidence | Mobile engineering | Geofencing spike report selecting `expo-location` or the pre-approved Kotlin fallback. | MVP-020 |
| TD-005 | Open — security-reviewed implementation decision | Mobile and API engineering | Recognized map-link allowlist, parser behavior, and fixtures. | MVP-022 |
| TD-006 | Open — UX/implementation decision | Product owner and mobile engineering | Immediate Undo presentation note; it cannot add cross-restart recovery. | MVP-017 |
| TD-007 | Open — operational configuration | API engineering | Deterministic retry, dispatcher, timeout, and concurrency configuration with failure evidence. | MVP-032, MVP-036, MVP-041 |
| TD-008 | Open — operational evidence | Infrastructure engineering | Reviewed free-tier budgets, quotas, container digest, and backup custody runbook. | MVP-008, MVP-010, MVP-047 |
| TD-009 | Open — UX/implementation decision | Product owner and mobile engineering | Snooze controls capable of a user-selected positive elapsed duration; product-visible bounds require change control. | MVP-038 |

## 4. Recommended milestone phases

| Milestone | Outcome | Tickets |
|---|---|---|
| M0 — Baseline and proof gates | Frozen sources, bootstrap evidence, decision register, geofence evidence started | MVP-001–MVP-003, MVP-019 |
| M1 — Secure platform foundation | Reproducible monorepo, encrypted device store, contracts, schema, runtime topology, environments, observability, backup | MVP-002–MVP-010 |
| M2 — Core usable Task slice | OAuth owner access, session/device cleanup, VS-1 Task CRUD and base Context model | MVP-011–MVP-015 |
| M3 — Lifecycle and temporal behavior | Recurrence, recovery, settings, fixed/current-local/elapsed time behavior | MVP-016–MVP-018, MVP-032 |
| M4 — Device-only location foundation | Proven region adapter, Saved Places, Specific Destinations, permission health, offline Event capture | MVP-019–MVP-025 |
| M5 — Context and opportunity engine | Places, Episode fan-out, transient matching, direct transition evaluation, atomic eligibility/outbox | MVP-026–MVP-031 |
| M6 — Delivery, actions, digest, and recovery | FCM, grouped preview, authenticated detail, actions, digest, offline replay, Retry Exhausted | MVP-034–MVP-041 |
| M7 — Trust, release, and alignment | Retention/deletion, security/privacy evidence, accessibility, physical matrix, release validation, final audit | MVP-042–MVP-048 |

## 5. Implementation epics and tickets

### Epic A — Baseline, repository, and development foundation

#### MVP-001 — Freeze the approved baseline and open the decision register

- **Objective:** Reconcile DOC-001, record PD-001/PD-002 and TD-001–TD-009, and establish ticket-to-requirement trace before code work.
- **Requirements / ACs:** Section 6.4 items 1, 2, and 7; Appendix A.1–A.3; no functional behavior implemented.
- **Architecture:** §1 Source-of-truth boundary; §8 Technical-decision status; §9 Change log.
- **Dependencies:** None.
- **Expected change surface:** `docs/ARCHITECTURE.md` document control, `docs/plans/`, optionally qualifying `docs/decisions/` records after decisions exist.
- **Tests:** Markdown/link check; manual version/ID cross-reference audit.
- **Security/privacy:** Prevent an obsolete baseline from omitting owner-only access or other current approved constraints.
- **Done:** Canonical versions agree, each blocker has an owner/status, and no unresolved product decision is represented as an engineering assumption.
- **Technical decision required:** No.

#### MVP-002 — Bootstrap the production-track npm workspace and quality gates

- **Objective:** Create the approved monorepo skeleton, strict TypeScript, ESLint, Prettier, Jest foundations, and one reproducible root check command.
- **Requirements / ACs:** NFR-005; Section 6.4 item 7; supports all ACs.
- **Architecture:** §3 Technology choices; §§3.7, 3.13, 3.14; §5 Repository strategy; §7 Verification.
- **Dependencies:** MVP-001. TD-001 is the first in-ticket bootstrap evidence gate, not a separate dependency.
- **Expected change surface:** root `package.json`, lockfile, workspace/TS/lint/format/Jest configs, `apps/mobile/`, `apps/api/`, `packages/{api-client,contracts,config}/`, `.github/workflows/` check workflow.
- **Tests:** Root format/lint/type/test command succeeds on empty scaffolds; generated-code and lockfile drift checks are wired.
- **Security/privacy:** CI permissions read-only by default; no secrets, generated credentials, analytics, crash SDK, or production-only packages.
- **Done:** A clean clone can install deterministically and run the same checks locally and in CI.
- **Technical decision required:** No owner decision. TD-001 must be resolved and recorded as this ticket's first slice; any discovery that would change approved architecture, product behavior, privacy, scope, or cost boundaries stops for change control.

#### MVP-003 — Build the deterministic local integration environment

- **Objective:** Provide pinned local Supabase Postgres/Auth through repository-owned Docker Compose, pinned Supabase CLI migration tooling, and application-owned fakes for Places, Maps links, FCM, Tasks, and Scheduler.
- **Requirements / ACs:** REL-008; AC-015, AC-029; foundation for provider-related ACs.
- **Architecture:** §§3.13, 5, 7; implementation rule for fakes and explicit preview tests.
- **Dependencies:** MVP-002.
- **Expected change surface:** `supabase/config.toml`, local Compose configuration, non-sensitive seeds, `apps/api/src/shared/providers/`, test fixtures, local environment scripts, `.env.example`.
- **Tests:** Rebuild local stack from versioned inputs; default tests prove zero real-provider traffic; fakes cover timeout, throttle, duplicate, malformed, and permanent rejection.
- **Security/privacy:** Synthetic identities/tasks/locations only; local services bind locally; generated credentials and runtime data ignored.
- **Done:** Ordinary tests are deterministic, no-charge, and offline from paid providers; real preview tests are separately named and opt-in.
- **Technical decision required:** No; exact CLI/image versions close through TD-001.

#### MVP-004 — Implement the SQLCipher and SecureStore storage foundation

- **Objective:** Define encrypted local schema/migrations and fail-closed key lifecycle for precise targets, display data, queues, throttle state, and protected diagnostics.
- **Requirements / ACs:** FR-143–FR-145, FR-155, FR-161, FR-172, FR-179; AC-023–AC-025, AC-037, AC-043, AC-052, AC-059; PRIV-005, PRIV-013, PRIV-018, PRIV-020; SEC-004, SEC-005.
- **Architecture:** Technology choices; §§3.1, 3.7; §4; §§6–7.
- **Dependencies:** MVP-002.
- **Expected change surface:** `apps/mobile/src/database/`, local migration fixtures, SecureStore key service, Android backup-exclusion/config plugin, corruption/key-loss recovery boundary.
- **Tests:** Physical DB/journal plaintext inspection; migrations; locked/background access; backup exclusion; logout/deletion/key invalidation/corruption; assert no plaintext fallback.
- **Security/privacy:** SQLCipher key and product session only in SecureStore; DB and key excluded from backup/transfer; Current-location Snapshot never enters schema.
- **Done:** Structured local state is encrypted and transactional, failure deletes unreadable data safely, and no raw coordinate reaches non-approved storage.
- **Technical decision required:** No; key behavior is approved.

#### MVP-005 — Establish runtime-validated HTTP contracts and generated client

- **Objective:** Make NestJS OpenAPI the transport source, generate the mobile client, and validate every untrusted HTTP/route/deep-link boundary.
- **Requirements / ACs:** FR-103–FR-105, FR-150; AC-002, AC-003, AC-029; SEC-001, SEC-002, SEC-009.
- **Architecture:** §§3.10, 5, 6, 7.
- **Dependencies:** MVP-002.
- **Expected change surface:** `packages/contracts/`, `packages/api-client/`, NestJS DTOs/pipes, OpenAPI generation and CI drift scripts.
- **Tests:** Unknown/malformed/bounded input, malicious paths/query/body, sanitized errors, generated-client drift, and proof that valid DTOs still require ownership/domain authorization.
- **Security/privacy:** No semantic request bodies in logs; DTO validation is never authorization; identifiers are opaque and owner checks remain server-side.
- **Done:** One executable contract generates the client and CI rejects drift or invalid boundary handling.
- **Technical decision required:** **Yes** — TD-003.

#### MVP-006 — Create the authoritative coordinate-free schema and migration path

- **Objective:** Implement the planned entities, ownership/RLS, uniqueness/idempotency, canonical timestamps, and explicit reviewed SQL migrations with no coordinate columns.
- **Requirements / ACs:** FR-102–FR-145, FR-148–FR-150, FR-152–FR-179 as their persisted state requires; AC-001–AC-029, AC-033–AC-061 as applicable; PRIV-005, PRIV-013, PRIV-020; SEC-002, SEC-010, SEC-011.
- **Architecture:** §§3.11, 4, 5, 6, 7.
- **Dependencies:** MVP-003, MVP-005.
- **Expected change surface:** `supabase/migrations/`, `database/seeds/`, Drizzle schema/repositories, RLS/ownership policies, migration job entry point.
- **Tests:** Empty/previous-state migration, interruption, uniqueness, two-account ownership, prohibited coordinate-column scan, retention timestamps, rollback/recovery rehearsal.
- **Security/privacy:** Every user row has an enforceable owner; service-readable coordinate/geographic fields and decryption keys are structurally prohibited.
- **Done:** Reviewed SQL builds the schema deterministically, migration runs only as singleton job, and schema tests prove isolation and coordinate absence.
- **Technical decision required:** No product decision; migration recovery mechanics may require a qualifying technical record.

#### MVP-007 — Separate API and private worker runtime roles

- **Objective:** Produce one hardened NestJS image with fixed API/worker entry points, least-privilege role boundaries, health checks, and no accidental cross-exposure.
- **Requirements / ACs:** FR-150, FR-178; AC-029, AC-058; SEC-001, SEC-006; REL-008.
- **Architecture:** §§2, 3.9, 3.12, 5–7.
- **Dependencies:** MVP-002, MVP-005.
- **Expected change surface:** `apps/api/src/entrypoints/{api,worker}.ts`, module composition, container files, health endpoints.
- **Tests:** Each image role starts only its entry point; worker rejects public/invalid invocation; non-root image, signals, layer/content/SBOM/vulnerability inspection.
- **Security/privacy:** API cannot send pushes/administer queues without need; worker cannot deploy infrastructure; no credentials or source/build tools in runtime image.
- **Done:** The same immutable digest runs as two independently limited services with verified privilege separation.
- **Technical decision required:** Container base digest closes through TD-008.

#### MVP-008 — Provision isolated free-tier-targeted environments and IAM

- **Objective:** Use Terraform to create development, preview, and owner-only production-MVP Google resources, remote state, WIF, secrets, quotas, budgets, and Singapore placement.
- **Requirements / ACs:** FR-180; AC-063; SEC-001, SEC-006, SEC-009; NFR-008.
- **Architecture:** §§3.3, 3.6, 3.8, 3.9, 3.15, 3.16; §§5–7.
- **Dependencies:** MVP-001, MVP-002; TD-002, TD-008.
- **Expected change surface:** `infra/terraform/{bootstrap,environments,modules}/`, provider lockfile, Secret Manager references, deployment workflows.
- **Tests:** Terraform format/validate/security/plan, state access/versioning/locking, OIDC claim restrictions, least privilege, environment isolation, quota/budget fail-closed behavior.
- **Security/privacy:** No static service-account keys; owner allowlist before data or expensive work; preview identities/credentials isolated; primary regional data in approved Singapore regions.
- **Done:** Reviewed plans create bounded scale-to-zero environments without recurring paid dependencies and production apply requires protected approval.
- **Technical decision required:** **Yes** — TD-002 and TD-008.

#### MVP-009 — Add privacy-first operational observability

- **Objective:** Provide content-free API/worker logs and protected, opt-in local diagnostics sufficient to distinguish canonical workflow stages and failures.
- **Requirements / ACs:** FR-146, FR-150, FR-153, FR-178, FR-179; AC-029, AC-034, AC-058, AC-059; PRIV-010, PRIV-020; REL-012, REL-014; NFR-006.
- **Architecture:** §§3.5, 6, 7.
- **Dependencies:** MVP-004, MVP-007, MVP-008.
- **Expected change surface:** shared logging/reason-code library, Cloud Logging Terraform, SQLCipher diagnostics tables, redaction tests/runbook.
- **Tests:** Synthetic incident diagnosis; field-allowlist inspection; induced sensitive failures; seven-day purge; prove no hosted crash/replay/screenshot/analytics stream.
- **Security/privacy:** Exclude Task text, precise/derived location, destination/provider data, credentials/tokens, headers, bodies, payloads, screenshots, and semantic IDs.
- **Done:** Approved failures are diagnosable using opaque identities/reason codes and all records disappear by the canonical boundary.
- **Technical decision required:** No.

#### MVP-010 — Establish encrypted backup and restore discipline

- **Objective:** Implement weekly encrypted external logical exports for eligible Supabase state, maximum 30-day age, separate key custody, and monthly isolated restore drills.
- **Requirements / ACs:** FR-148, FR-179; AC-027, AC-059; PRIV-008, PRIV-020; SEC-003, SEC-011.
- **Architecture:** §§3.3, 6, 7.
- **Dependencies:** MVP-006, MVP-008, MVP-009; TD-008.
- **Expected change surface:** backup/restore scripts or protected jobs, `docs/runbooks/backup-restore.md`, retention configuration, restore-test fixtures.
- **Tests:** Creation/encryption, plaintext-remnant inspection, 30-day expiry, isolated restoration, and filters proving deleted/expired Tasks, accounts, history, and settled queues do not return.
- **Security/privacy:** Backup receives primary-store protections; no device coordinates; no user-facing deleted-item recovery path.
- **Done:** A recorded restore drill succeeds on eligible state and resurrects nothing prohibited.
- **Technical decision required:** **Yes** — key custody and off-site target under TD-008.

### Epic B — Identity, session, and account control

#### MVP-011 — Implement Google PKCE authentication, product sessions, and owner access gate

- **Objective:** Authenticate with minimum Google identity scopes, persist/refresh only the Supabase product session, and reject every non-owner identity in production before provisioning or provider work.
- **Requirements / ACs:** FR-101, FR-166, FR-167, FR-171, FR-180; AC-001, AC-047, AC-048, AC-051, AC-063; SEC-001, SEC-002, SEC-004, SEC-009, SEC-014.
- **Architecture:** Technology choices; §§3.7, 3.16; §§6–7.
- **Dependencies:** MVP-004–MVP-008; TD-002.
- **Expected change surface:** mobile auth routes/services, SecureStore session adapter, API auth/JWKS guards, owner-allowlist guard, environment configuration.
- **Tests:** Valid/cancel/failure/state/nonce/redirect/replay/wrong-client/revoked/over-scoped flows; owner/non-owner/signed-out; two-account preview isolation.
- **Security/privacy:** `openid email` only; exact redirect allowlist; code exchange once; no Google service/provider-token persistence; allowlist is not a substitute for ownership.
- **Done:** Only the configured owner can access production-MVP product state, and valid preview users remain mutually isolated.
- **Technical decision required:** **Yes** — application identities, redirects, and owner value under TD-002.

#### MVP-012 — Register the Device and implement safe logout cleanup

- **Objective:** Maintain coordinate-free Device/health identity and make logout remove session, precise local data, display data, geofences, queues, and unusable keys.
- **Requirements / ACs:** FR-145, FR-172; AC-025, AC-052; PRIV-005, PRIV-013, PRIV-018; SEC-004, SEC-005; REL-011.
- **Architecture:** §§3.1, 3.7, 4, 6, 7.
- **Dependencies:** MVP-004, MVP-006, MVP-011.
- **Expected change surface:** mobile device/session services, API devices module, SQLCipher cleanup transaction, geofence cleanup hook.
- **Tests:** Logout online/offline/restart, second-user login, queued work present, key invalidation, geofence cleanup, no prior-user display/upload.
- **Security/privacy:** Device identifiers are opaque; old queued data cannot cross accounts; no coordinate sync or transfer workflow.
- **Done:** Logout requires reauthentication and no previous-account sensitive local state can be read, registered, or replayed.
- **Technical decision required:** No.

#### MVP-013 — Implement irreversible account deletion

- **Objective:** Require fresh Google reauthentication and deliberate confirmation, revoke immediately, clear local state, delete active cloud data within 24 hours, and age backups out within 30 days.
- **Requirements / ACs:** FR-105, FR-148, FR-149, FR-172, FR-179; AC-025, AC-027, AC-028; PRIV-006, PRIV-008, PRIV-020; SEC-010, SEC-011.
- **Architecture:** §§2, 3.1, 3.3, 4, 6, 7.
- **Dependencies:** MVP-006, MVP-010–MVP-012.
- **Expected change surface:** mobile account settings/confirmation/status, API account-deletion command, worker deletion workflow, local wipe hooks, backup deletion markers.
- **Tests:** Cancelled/failed/fresh reauth, immediate access revocation, 24h active-system boundary, 30d backup boundary, queued stale work, restore, recovery denial, Google-account preservation.
- **Security/privacy:** No long-lived content-bearing deletion evidence; all user-owned resources are owner-authorized; deletion is irreversible.
- **Done:** Observable deletion completes within approved bounds and no active/restore path resurrects the account.
- **Technical decision required:** No.

### Epic C — Core Task, Context, lifecycle, and time model

#### MVP-014 — Deliver Task list and one-off Task CRUD

- **Objective:** Build VS-1 Task creation, validation, owner-only list/detail/edit, explicit-confirmation deletion, Unscheduled state, and minimal Recently Completed surface.
- **Requirements / ACs:** FR-102–FR-105, FR-109, FR-110; AC-001–AC-003, AC-005, AC-006; SEC-002, SEC-009; NFR-003.
- **Architecture:** §§3.7, 3.10, 4–7.
- **Dependencies:** MVP-005, MVP-006, MVP-011.
- **Expected change surface:** `apps/mobile/app/` Task routes, `features/tasks/`, API tasks module, contracts/client, repositories.
- **Tests:** Empty/valid title, create/reload/edit without duplication, owner isolation, cancel/confirm deletion, Unscheduled display, Recently Completed ownership; component/API/E2E.
- **Security/privacy:** Task text stays out of logs/analytics/crash data; destructive confirmation accessible; delayed work cannot restore deleted content.
- **Done:** VS-1 Task CRUD works end to end, including deterministic mixed-Deadline ordering.
- **Technical decision required:** No.

#### MVP-015 — Add flat-OR Context configuration, Scheduled Reminder, and Deadline

- **Objective:** Let one Task retain multiple enabled Contexts; implement separate Scheduled Reminder and Deadline fields; preserve Unscheduled Tasks and exact supported Context-kind validation.
- **Requirements / ACs:** FR-106–FR-110; AC-004–AC-006; PI-002, PI-003; RULE-001–RULE-003.
- **Architecture:** §§2, 3.7, 3.10, 4–7.
- **Dependencies:** MVP-014.
- **Expected change surface:** mobile structured-capture forms, contracts, contexts module, Task detail/edit, domain validation/tests.
- **Tests:** Multiple Context persistence, one-match OR, unsupported kind rejection, no-context behavior, Deadline does not notify, one-off reminder resolves immutable instant.
- **Security/privacy:** Forms/runtime boundaries validate all values; Context values remain owner-only and absent from telemetry.
- **Done:** Contexts are additive siblings under flat OR, Deadline/Reminder remain distinct, and no unsupported type is saved.
- **Technical decision required:** No; user-facing input limits that exceed spec require change control under TD-003.

#### MVP-016 — Implement recurrence and logical Task Occurrences

- **Objective:** Support daily, selected-weekday, every-N-local-day, and every-N-local-week recurrence with stable logical occurrence identities and approved timezone/DST/manual-clock behavior.
- **Requirements / ACs:** FR-111–FR-115, FR-117, FR-129; AC-007, AC-008, AC-061; REL-003, REL-010.
- **Architecture:** §§2, 4, 6, 7.
- **Dependencies:** MVP-006, MVP-014, MVP-015.
- **Expected change surface:** shared temporal/domain utilities, API tasks/occurrences modules, worker recurrence handler, mobile recurrence forms.
- **Tests:** Four modes, invalid intervals, gap/fold, travel, forward skip/backward no-duplicate, duplicate scheduler delivery, occurrence uniqueness.
- **Security/privacy:** Retain only authoritative recurrence and occurrence state; no Task content in scheduler payloads/logs.
- **Done:** Exactly one logical current occurrence is materialized per approved civil slot and one-off Tasks never recur.
- **Technical decision required:** No.

#### MVP-017 — Implement Done, immediate Undo, one-off Reopen, and recurring commit

- **Objective:** Make completion idempotent; preserve valid fatigue/dedup/ack records; support one-off Reopen before 30 elapsed days; defer recurring successor until Undo closes.
- **Requirements / ACs:** FR-116, FR-117, FR-134, FR-163; AC-008, AC-044, AC-060; RULE-005, RULE-006, RULE-042; REL-003, REL-010.
- **Architecture:** §§4, 6, 7.
- **Dependencies:** MVP-006, MVP-014, MVP-016.
- **Expected change surface:** Task/occurrence commands, recovery records, mobile undo/reopen surfaces, worker successor commit.
- **Tests:** Repeated/racing Done/Undo, affordance close, before/exact 30d, history non-replay, still-valid/expired record preservation, deletion invalidation.
- **Security/privacy:** Recovery never restores expired/deleted history; action targets explicit owned Task/occurrence; no recycle bin.
- **Done:** Same identity returns only in approved window, exactly one successor/current occurrence exists, and deletion always wins.
- **Technical decision required:** **Yes** — TD-006 presentation duration/details.

#### MVP-018 — Implement Quiet Hours and digest settings/onboarding

- **Objective:** Store current-local Quiet Hours and an enabled 8:00 PM digest suggestion requiring confirmation/change, with conflict visibility and disable/change controls.
- **Requirements / ACs:** FR-138, FR-140, FR-141; AC-021, AC-036, AC-061; RULE-016, RULE-018.
- **Architecture:** §§2, 3.7, 4, 6, 7.
- **Dependencies:** MVP-011, MVP-014.
- **Expected change surface:** mobile onboarding/settings, API user settings, contracts, temporal membership utilities.
- **Tests:** Overnight intervals, conflict at onboarding/later change, disable/re-enable, timezone/DST fold/gap/manual-clock presentation.
- **Security/privacy:** Settings are owner-authorized; no location permission required; no analytics instrumentation.
- **Done:** Confirmed settings persist and conflicts are visible without silently moving times.
- **Technical decision required:** No.

### Epic D — Device-only location targets and geofencing

#### MVP-019 — Execute the mandatory physical-device geofencing proof gate

- **Objective:** Determine whether `expo-location`/`expo-task-manager` meets approved best-effort behavior before general region-monitoring implementation.
- **Requirements / ACs:** FR-151; AC-030; PRIV-001–PRIV-005; NFR-001, NFR-002; REL-001, REL-009.
- **Architecture:** Technology choices; §3.2; §§6–8.
- **Dependencies:** MVP-002, MVP-004; PD-001 is needed to test final Saved Place behavior, but adapter reliability can be tested with documented spike radii.
- **Expected change surface:** time-boxed spike app/config, `docs/plans/geofencing-proof.md`, device/scenario evidence; no production feature code is promoted by convenience alone.
- **Tests:** Physical API 30, current API, aggressive OEM; foreground/background/process death/recent-app removal/reboot/revocation/recovery/Play Services interruption/duplicates/offline handoff/battery. Force-stop is documented unsupported.
- **Security/privacy:** Transition reaches only coordinate-free encrypted queue; no Snapshot retained; spike uses synthetic targets and no server coordinate.
- **Done:** Published matrix supports an explicit `expo-location` keep or native-fallback activation decision.
- **Technical decision required:** **Yes** — TD-004 evidence gate.

#### MVP-020 — Implement the selected geofence adapter and health reconciliation

- **Objective:** Register, restore, remove, rearm, and reconcile Saved Place and Specific Destination regions behind one application interface.
- **Requirements / ACs:** FR-120, FR-146, FR-151, FR-162–FR-164, FR-172; AC-010, AC-026, AC-030, AC-044, AC-045, AC-052; PRIV-002, PRIV-004; REL-001, REL-009.
- **Architecture:** §§2, 3.2, 3.7, 5–7.
- **Dependencies:** MVP-019; MVP-004.
- **Expected change surface:** `features/geofencing/`, background task or native Expo/Kotlin module, boot/restart registration, health adapter.
- **Tests:** Register/update/remove/restore, duplicate callback, inside/restart, exit/reentry, permission/service/Play Services loss and recovery, logout cleanup, physical matrix regression.
- **Security/privacy:** OS receives only active configured regions; no continuous sampling; coordinate never enters logs/server/queue metadata.
- **Done:** Selected adapter passes proof scenarios, reports degraded state honestly, and unregisters deterministically.
- **Technical decision required:** **Yes** — TD-004.

#### MVP-021 — Implement Home and Work/School Saved Places

- **Objective:** Support zero/one Home and zero/one Work-or-School, inspection/update/deletion, and arrival/departure Context selection.
- **Requirements / ACs:** FR-118–FR-121, FR-147, FR-149, FR-155; AC-009, AC-010, AC-028, AC-037; PRIV-005–PRIV-007, PRIV-013.
- **Architecture:** §§2, 3.1, 3.4, 4–7.
- **Dependencies:** MVP-004, MVP-014, MVP-020.
- **Expected change surface:** mobile places settings/capture, local Anchor tables, API coordinate-free anchor references, Task Context picker.
- **Tests:** Zero/home/secondary/both/third attempt, arrival/departure, update/delete, dependent Context disable/flag, stale Event non-recreation, storage/server inspection.
- **Security/privacy:** Exact Anchor point stays SQLCipher/OS geofence only; server gets opaque identity/class/non-coordinate state; re-entry after reinstall/device change.
- **Done:** Two optional slots behave exactly as approved, and deletion stops monitoring without affecting non-location Tasks.
- **Technical decision required:** No. Saved Place capture UX may reuse approved map adapters, but it may not invent a new target type.

#### MVP-022 — Implement Specific Destination capture and protected detail

- **Objective:** Capture one Task-bound arrival point through address search, pin, or recognized map link; confirm it; discard input/candidates; show protected label/address/map in Task detail.
- **Requirements / ACs:** FR-159–FR-161, FR-165; AC-041–AC-043, AC-046; PRIV-017, PRIV-018; SEC-006, SEC-008.
- **Architecture:** §§3.1, 3.4, 4–7.
- **Dependencies:** MVP-004, MVP-014, MVP-015; TD-002 provider keys, TD-005.
- **Expected change surface:** `features/places/capture/`, `react-native-maps`, thin Expo/Kotlin Autocomplete module, link parser, local destination tables, coordinate-free API reference.
- **Tests:** Address/pin/supported link, unsupported/arbitrary/private/unresolvable link, cancel/failure, manual pin fallback, session tokens/field masks, direct device-provider traffic, no residue.
- **Security/privacy:** Query/link/candidates/provider IDs/coordinates never reach backend, durable queue, logs, diagnostics, backup, analytics, or crash data; keys are app/package/signature/API/quota restricted.
- **Done:** A confirmed destination is usable from protected local detail, inputs are gone, and server surfaces remain coordinate-free.
- **Technical decision required:** **Yes** — TD-005 and environment key restrictions under TD-002.

#### MVP-023 — Enforce Specific Destination capacity and lifecycle

- **Objective:** Enforce 250 m arrival-only, one per Task, 20 active per device, no silent eviction, deterministic unregister/re-register, and recurring retention.
- **Requirements / ACs:** FR-160, FR-162–FR-164; AC-042, AC-044, AC-045, AC-060; RULE-027–RULE-029.
- **Architecture:** §§3.2, 4, 6, 7.
- **Dependencies:** MVP-017, MVP-020, MVP-022.
- **Expected change surface:** destination registration coordinator, capacity UI, Task lifecycle hooks, local registration state.
- **Tests:** 20/21 limit, consuming Tasks display, other Context save, completion/delete/remove/replace/logout, Undo/Reopen with/without capacity, recurring completion, stale callbacks, exit/reentry.
- **Security/privacy:** No region eviction exposes or mutates another Task; removed regions and local details are purged; stale Events cannot recreate them.
- **Done:** Capacity is visible and deterministic, restored Tasks follow current rules, and one-off/recurring cleanup matches the spec.
- **Technical decision required:** No.

#### MVP-024 — Implement permission, service, and Degraded Capability UX

- **Objective:** Request only just-in-time permissions, report notification/location/service/config/retry degradation with recovery guidance, and preserve non-location use.
- **Requirements / ACs:** FR-146, FR-147; AC-026, AC-030, AC-058; PRIV-004; REL-001, REL-009, REL-014; NFR-004.
- **Architecture:** §§2, 3.2, 3.7, 6, 7.
- **Dependencies:** MVP-011, MVP-014, MVP-020.
- **Expected change surface:** mobile capability-health model/UI, permission service, current health API records/reason codes.
- **Tests:** Deny/revoke/restore notification/background/foreground location and services; invalid config; persistent Retry Exhausted; accessibility/recovery guidance; unaffected Task flows.
- **Security/privacy:** Permission is purpose-explained and optional for unrelated behavior; current health contains no coordinates/content and persists only until verified recovery.
- **Done:** No degraded capability is shown healthy, recovery clears only after verification, and non-location Tasks remain usable.
- **Technical decision required:** No.

#### MVP-025 — Capture, queue, synchronize, and age coordinate-free location Events

- **Objective:** Create idempotent transition Events in SQLCipher, survive restart/offline, sync under owner identity, and apply 15-minute freshness/seven-day retention rules.
- **Requirements / ACs:** FR-122, FR-143, FR-145, FR-156, FR-168–FR-170, FR-174, FR-179; AC-011, AC-023, AC-038, AC-049, AC-050, AC-054; REL-002, REL-003, REL-013.
- **Architecture:** §§2, 3.1, 4, 6, 7.
- **Dependencies:** MVP-004, MVP-006, MVP-012, MVP-020.
- **Expected change surface:** mobile background Event producer/queue, API event ingestion, opportunities event store, sync worker, purge hooks.
- **Tests:** Offline/restart/duplicate/out-of-order; 14m/exact15m/stale/24h/7d; completed/deleted target; direct Expired Opportunity versus Missed Evaluation; no historical lookup.
- **Security/privacy:** Payload exactly opaque target ID/kind/transition/time; no raw coordinate/Snapshot; logout/account deletion makes queue unusable; retention clock never resets.
- **Done:** Fresh Events evaluate at most once, stale Events produce only approved evidence, and expired entries perform no effect and are removed.
- **Technical decision required:** Retry settings close through TD-007 in MVP-041.

### Epic E — Place provider, Evaluation Episodes, and opportunity evaluation

#### MVP-026 — Implement the Place Capability provider adapter and five mappings

- **Objective:** Map exactly grocery/supermarket, pharmacy, bank/ATM, convenience store, and mall to Google Places Nearby (New) behind a replaceable adapter.
- **Requirements / ACs:** FR-123, FR-124, FR-157; AC-012, AC-039; PRIV-011, PRIV-015; NFR-007.
- **Architecture:** Technology choices; §§3.3, 3.13, 5–7.
- **Dependencies:** MVP-003, MVP-008.
- **Expected change surface:** API places provider interface/Google adapter, mapping/config, deterministic fixtures, quotas/budgets.
- **Tests:** Mapping fixtures; confirmed open/closed/unknown/no-result; inside/outside 1 km; field masks; outage/throttle; exact five UI choices and no business preference controls.
- **Security/privacy:** Provider sees one transient approved search origin only; no business/provider result persisted/logged; billing hard quota and minimum fields.
- **Done:** Adapter returns only transient normalized results and application matching can deterministically select the nearest confirmed-open compatible result.
- **Technical decision required:** Provider quota values close through TD-008; provider choice is approved.

#### MVP-027 — Build the Evaluation Episode coordinator and location-access gate

- **Objective:** Permit exactly four Place Capability trigger classes, require an Applicable Task, fan out to all such Tasks, enforce persistent 15-minute foreground throttle, and share one transient Snapshot/query batch.
- **Requirements / ACs:** FR-122, FR-125–FR-128, FR-156, FR-174–FR-176; AC-013, AC-014, AC-038, AC-054–AC-056; PRIV-003, PRIV-005, PRIV-011, PRIV-014; NFR-002, NFR-007.
- **Architecture:** §§2, 3.1, 4, 6, 7.
- **Dependencies:** MVP-004, MVP-025, MVP-026.
- **Expected change surface:** mobile location-reason gate/snapshot acquisition, API opportunities Episode coordinator, Effective Place Query grouping, throttle state.
- **Tests:** No applicable Task; four triggers; every excluded trigger; failure consumes foreground window; restart/concurrency; manual/transition bypass; one Snapshot; one query per distinct capability; later Episode fresh.
- **Security/privacy:** Every location request has approved reason; Snapshot is never queued/persisted/logged/cached; automatic and Find Nearby paths are separate.
- **Done:** Only approved paths acquire location, all Applicable Tasks wake, and transient data is destroyed at the boundary.
- **Technical decision required:** No.

#### MVP-028 — Evaluate Place Capability matches and query-scoped failures

- **Objective:** Match each Task independently against shared transient results, create no Opportunity for unusable results, and isolate one query failure from other capabilities.
- **Requirements / ACs:** FR-125–FR-127, FR-150, FR-157, FR-158, FR-176, FR-178; AC-013, AC-015, AC-039, AC-040, AC-056, AC-058; RULE-021–RULE-023.
- **Architecture:** §§2, 4, 6, 7.
- **Dependencies:** MVP-026, MVP-027.
- **Expected change surface:** opportunities/place evaluator, provider-result normalization, Outcome/reason codes, provider failure mapping.
- **Tests:** Nearest confirmed-open, closed/unknown/no result, independent capability outage, per-Task hard gates, fresh manual recovery, no business data persistence.
- **Security/privacy:** Persist capability and Outcome only; discard result set; no business name/address/provider ID/distance in cloud history or notifications.
- **Done:** Every applicable Task receives an independent, correct evaluation from shared data and failures never invent an Opportunity.
- **Technical decision required:** No.

#### MVP-029 — Implement isolated Find Nearby

- **Objective:** Let the user request one fresh nearest usable result for one Task/capability without creating an Event, Episode, Opportunity, Notification, fan-out, or retained result.
- **Requirements / ACs:** FR-127, FR-158, FR-175; AC-040, AC-055; PRIV-003, PRIV-005, PRIV-011, PRIV-015; NFR-007.
- **Architecture:** §§2, 3.4, 4, 6, 7.
- **Dependencies:** MVP-024, MVP-026.
- **Expected change surface:** mobile Task action/result surface, transient API/place adapter call, contracts that return only current interaction data.
- **Tests:** One Task/one capability/one fresh Snapshot/search; permission/network/no result; cancel/navigation teardown; verify no other Task wakes and no persistence/indicator/activity/notification.
- **Security/privacy:** Business fields exist only in current authenticated interaction and are not cached, queued, logged, backed up, or analyzed.
- **Done:** Fresh result is useful and disappears with the interaction; all automatic semantics remain untouched.
- **Technical decision required:** No.

#### MVP-030 — Implement flat-OR eligibility, Hard Gates, deduplication, and atomic outbox

- **Objective:** Evaluate Task status, Snooze, current-local Quiet Hours, elapsed cooldown, OR Context match, and Episode dedup; atomically create at most one candidate per Task and outbox work.
- **Requirements / ACs:** FR-107, FR-130, FR-131, FR-136, FR-138, FR-139; AC-004, AC-016, AC-017, AC-019, AC-021, AC-061; PI-003, PI-005; RULE-003, RULE-004, RULE-007.
- **Architecture:** §§2, 4, 6, 7.
- **Dependencies:** MVP-006, MVP-015, MVP-018.
- **Expected change surface:** API opportunities domain/application services, hard-gate policies, cooldown/dedup repositories, transactional notification outbox.
- **Tests:** Each gate independently; simultaneous Contexts; duplicate/replay; timezone/DST/manual clock; explicit Reminder/Snooze bypass; transaction rollback and race tests.
- **Security/privacy:** Structured reason codes only; candidate selection owner-scoped; transaction contains no raw coordinate or business result.
- **Done:** One Task/Episode yields no more than one candidate, suppressed/expired states remain distinct, and no notification work exists without a committed evaluation.
- **Technical decision required:** No.

#### MVP-031 — Evaluate Saved Place and Specific Destination transitions

- **Objective:** Match direct target/transition Contexts, produce Expired Opportunities for stale proven matches, enforce Specific Destination outside-inside/rearm behavior, and wake Place Capability evaluation separately.
- **Requirements / ACs:** FR-121, FR-122, FR-125, FR-164, FR-168–FR-170; AC-011, AC-045, AC-049, AC-050, AC-055; RULE-025, RULE-029, RULE-031–RULE-033.
- **Architecture:** §§2, 4, 6, 7.
- **Dependencies:** MVP-021, MVP-023, MVP-025, MVP-027, MVP-030.
- **Expected change surface:** opportunities transition evaluator, target/transition match policies, rearm state, activity Outcome creation.
- **Tests:** Matching/opposite/duplicate; direct match plus unrelated capability fan-out; stale direct versus place-only; remain-inside/restart; exit/reentry in/out cooldown.
- **Security/privacy:** Server operates on opaque target identity/kind/transition/time only; exact target and destination label never enter history.
- **Done:** Direct and wake-up semantics are separated, no cooldown expiry manufactures an arrival, and stale transitions never catch up.
- **Technical decision required:** No.

#### MVP-032 — Dispatch fixed reminders and current-local recurrence safely

- **Objective:** Use at most three shared Scheduler jobs and private worker handlers to evaluate immutable one-off reminder instants and materialize current-local recurrence slots idempotently.
- **Requirements / ACs:** FR-110–FR-117, FR-129, FR-135, FR-150; AC-006–AC-008, AC-019, AC-029, AC-036, AC-061; REL-003, REL-005, REL-010.
- **Architecture:** §§2, 3.3, 3.9, 4, 6, 7.
- **Dependencies:** MVP-007, MVP-008, MVP-015–MVP-017, MVP-030; TD-007.
- **Expected change surface:** worker temporal dispatchers, Scheduler/Tasks Terraform, logical-slot claims, fixed-instant queries.
- **Tests:** Due/not-due, duplicate/out-of-order invocation, gap/fold/travel/manual jumps, dispatcher restart, private IAM rejection, no Deadline-only notification.
- **Security/privacy:** Scheduler/task payloads carry minimum opaque IDs; no Task text or coordinates; worker is privately IAM-invoked.
- **Done:** Due work is processed once under stable identities without per-Task Scheduler jobs or catch-up behavior.
- **Technical decision required:** **Yes** — TD-007 cadence and bounded retry.

#### MVP-033 — Build Recent Opportunity Indicator and Recent Activity

- **Objective:** Show one compact 24-hour indicator for detected Opportunities and a separate 24-hour detail surface for Outcomes, Notification States, failures, and actions.
- **Requirements / ACs:** FR-152–FR-154, FR-169, FR-170, FR-178, FR-179; AC-033–AC-035, AC-050, AC-058, AC-059; RULE-014, RULE-015.
- **Architecture:** §§3.7, 4–7.
- **Dependencies:** MVP-014, MVP-025, MVP-030.
- **Expected change surface:** mobile Task list/activity routes, API activity queries, action entry points, retention-aware view models.
- **Tests:** Deliverable/Suppressed/Expired/failed states; Missed/Event Sync Failed no indicator; exact 24h boundary; details/reasons; suppressed Open/Done/Snooze idempotency.
- **Security/privacy:** No exact coordinate, business, destination label/address, or semantic telemetry; visibility does not extend seven-day persistence.
- **Done:** List stays compact, detail is understandable, and current Degraded Capability remains separate from historical visibility.
- **Technical decision required:** No.

### Epic F — Notification delivery, authenticated actions, digest, and offline recovery

#### MVP-034 — Implement Android notification permission and FCM token lifecycle

- **Objective:** Request notification permission after disclosure, obtain/rotate native FCM tokens, associate them with the Device, and disable invalid tokens.
- **Requirements / ACs:** FR-146, FR-150, FR-177; AC-026, AC-029, AC-031, AC-057; PRIV-019; SEC-006.
- **Architecture:** Technology choices; §§3.5, 3.9, 6, 7.
- **Dependencies:** MVP-008, MVP-011, MVP-012, MVP-024.
- **Expected change surface:** mobile notifications service/config, API devices token endpoints, worker transport interface, Firebase environment config.
- **Tests:** Grant/deny/revoke, token rotation/invalidation/logout, environment separation, build artifact secret scan, disclosure before enablement.
- **Security/privacy:** Token is sensitive, owner/device-scoped, absent from logs; no service-account key in app/repo; MVP sends no analytics.
- **Done:** Valid token registration is recoverable and invalid/revoked tokens cannot receive further app sends.
- **Technical decision required:** Environment IDs/credentials close through TD-002.

#### MVP-035 — Build grouped envelopes, frozen detailed previews, and opaque routing

- **Objective:** Group all and only same-Episode Deliverable Tasks, order/freeze rows, expose at most three title/reason rows plus count, and route taps to complete owner-authorized detail.
- **Requirements / ACs:** FR-018, FR-023, FR-132, FR-133, FR-137, FR-177; AC-017, AC-018, AC-020, AC-022, AC-057; PRIV-019; SEC-015; RULE-039.
- **Architecture:** §§2, 4, 6, 7.
- **Dependencies:** MVP-006, MVP-030, MVP-034.
- **Expected change surface:** notifications envelope/association modules, preview selection/order, opaque route store/resolver, mobile deep-link route validation.
- **Tests:** Single/three/4+/six Tasks, suppressed exclusion, separate Episodes, deadline/created/ID ties, randomized completion, retry freeze, hidden membership, signed-out/wrong-owner/tamper/expired/deleted routes.
- **Security/privacy:** Only displayed rows/count/opaque non-authorizing route/necessary metadata leave boundary; no semantic Task ID, hidden title, destination/business detail, or action token.
- **Done:** One Episode is never split/cross-grouped and body tap reveals the complete current list only after session and ownership checks.
- **Technical decision required:** No; exact copy is a non-normative design detail within approved reason categories.

#### MVP-036 — Send direct FCM pushes and record truthful delivery state

- **Objective:** Process outbox work through private Cloud Tasks, send direct FCM with least privilege, apply bounded retry, and distinguish submitted/failed from seen or delivered.
- **Requirements / ACs:** FR-133, FR-139, FR-150, FR-178; AC-018, AC-020, AC-029, AC-058; REL-003, REL-008, REL-014.
- **Architecture:** §§2, 3.3, 3.9, 6, 7.
- **Dependencies:** MVP-007–MVP-009, MVP-034, MVP-035; TD-007.
- **Expected change surface:** worker notification handler, FCM adapter, outbox claim/state transitions, Cloud Tasks Terraform, token error handling.
- **Tests:** Acceptance/transient/permanent rejection, duplicate Tasks invocation, retry exhaustion, invalid token, grouped per-Task state/cooldown, API/worker privilege tests.
- **Security/privacy:** ADC/service identity only; diagnostics contain opaque message/status/error; payload content never logged; failed push is not manually resent.
- **Done:** Submission begins cooldown per included Task only, failure begins none, and no state claims user receipt/viewing.
- **Technical decision required:** **Yes** — TD-007 retry/backoff.

#### MVP-037 — Implement Done, Snooze, and Not useful action semantics

- **Objective:** Apply idempotent per-Task actions online: Done lifecycle; elapsed-duration Snooze with immutable due reminder; Not useful bound to original Opportunity and requiring new Episode plus cooldown.
- **Requirements / ACs:** FR-134–FR-136, FR-154, FR-173; AC-019, AC-024, AC-035, AC-053; REL-005, REL-006.
- **Architecture:** §§2, 4, 6, 7.
- **Dependencies:** MVP-017, MVP-030; TD-009.
- **Expected change surface:** notifications actions module, Task/Opportunity commands, mobile action sheets/forms, one-time reminder creation.
- **Tests:** Repeat/race, grouped row isolation, timezone/DST/manual clock, original Context ended, Not useful duplicate/new Episodes, future/passed Snooze replay.
- **Security/privacy:** Action requires owned explicit Task/Opportunity; feedback content retention seven days except minimum unresolved action record; no OS mutating token.
- **Done:** Each action changes only approved state once, Snooze preserves Contexts, and Not useful never completes/disables/snoozes.
- **Technical decision required:** **Yes** — TD-009 controls/bounds.

#### MVP-038 — Implement Authenticated Notification Detail

- **Objective:** Resolve any notification tap to the complete current authorized Task/reason list and expose only in-app per-Task Done, Snooze, and Not useful controls.
- **Requirements / ACs:** FR-132, FR-134, FR-137, FR-177; AC-017–AC-020, AC-057; SEC-002, SEC-015.
- **Architecture:** §§2, 3.7, 4, 6, 7.
- **Dependencies:** MVP-011, MVP-035, MVP-037.
- **Expected change surface:** mobile notification-detail route/UI, API route resolver/detail endpoint, per-row action binding.
- **Tests:** Owner/signed-out/wrong-owner/tampered/expired/deleted; navigation only; grouped hidden rows; action targets one row; TalkBack and large text.
- **Security/privacy:** Route is opaque/non-authorizing; full membership and mutations require session and server ownership; no OS direct actions.
- **Done:** Tap/dismiss mutates nothing, invalid resolution leaks nothing, and owner actions remain unambiguous per Task.
- **Technical decision required:** No.

#### MVP-039 — Generate the fallback digest

- **Objective:** Run at most once per current-local day, independently compute approved eligibility, group into one detailed envelope, and implement per-Task Digest Acknowledgement.
- **Requirements / ACs:** FR-109, FR-139–FR-142, FR-177; AC-005, AC-020–AC-022, AC-036, AC-057, AC-061; REL-007.
- **Architecture:** §§2, 3.9, 4, 6, 7.
- **Dependencies:** MVP-018, MVP-030, MVP-032, MVP-035–MVP-038; TD-007 dispatcher config.
- **Expected change surface:** worker digest selector/dispatcher, acknowledgements, settings queries, notification detail list flow.
- **Tests:** Every included/excluded category; one/three/4+ order; successful/failed submission; cooldown; quiet hours; gap/fold/travel/clock jumps; list tap acknowledges none, Task open one.
- **Security/privacy:** Digest creates no Opportunity/indicator; preview disclosure follows identical three-row cap; hidden membership server-side.
- **Done:** One eligible daily envelope is produced without catch-up/duplicate and later eligibility changes only through approved Task-specific acknowledgement/action.
- **Technical decision required:** Dispatcher cadence closes through TD-007.

#### MVP-040 — Implement durable offline action queue and synchronization

- **Objective:** Queue Done/Not useful/Snooze in SQLCipher, survive restart, replay idempotently under original identity, and expire at 30 elapsed days without mutation.
- **Requirements / ACs:** FR-144, FR-145, FR-173, FR-179; AC-024, AC-025, AC-053, AC-059; SEC-005; REL-002, REL-003, REL-006, REL-011.
- **Architecture:** §§3.1, 3.7, 4, 6, 7.
- **Dependencies:** MVP-004, MVP-012, MVP-037.
- **Expected change surface:** mobile queue repository/synchronizer, API idempotent action endpoints, recovery/settlement state.
- **Tests:** Offline/restart/reconnect/duplicate/out-of-order; target complete/delete; Opportunity removed; Snooze future/passed; just-before/exact30d; logout/other user.
- **Security/privacy:** Protected account-bound queue; no raw coordinates; canonical clock cannot reset; settled entry deleted within 24h and no later than underlying deadline.
- **Done:** Authorized applicable actions apply once; stale/inapplicable/expired actions perform no mutation and are removed on schedule.
- **Technical decision required:** Retry policy closes through TD-007 in MVP-041.

#### MVP-041 — Implement bounded retry, Retry Exhausted, and safe recovery

- **Objective:** Standardize provider/queue retry and map exhaustion to Missed Evaluation, failed Notification, Event Sync Failed, or Needs Attention without error pushes or inferred lifecycle changes.
- **Requirements / ACs:** FR-145, FR-146, FR-150, FR-178; AC-015, AC-023, AC-024, AC-029, AC-058; REL-002, REL-003, REL-008, REL-014.
- **Architecture:** §§3.3, 3.5, 6, 7.
- **Dependencies:** MVP-009, MVP-025, MVP-028, MVP-036, MVP-040; TD-007.
- **Expected change surface:** shared retry policy/config, worker/queue handlers, capability health/recovery UI, sanitized operational reason codes.
- **Tests:** Exhaust each governed stage, restart/manual replay/pre/post retention, later genuine Event, fresh manual context check, digest eligibility, verified health recovery.
- **Security/privacy:** No error Notification; no indefinite retry/retention; manual location recovery obtains fresh Snapshot; content-free logs.
- **Done:** Every exhausted stage has the canonical visible state and only its approved retention-bounded recovery path.
- **Technical decision required:** **Yes** — TD-007.

### Epic G — Retention, deletion, security, and privacy verification

#### MVP-042 — Enforce all retention clocks, purges, and location-history deletion

- **Objective:** Purge activity visibility at 24h; derived/Event/notification/feedback/log records at seven days; settled transports by the earlier deadline; actions/recovery/backups at 30 days; support independent retained location-history deletion.
- **Requirements / ACs:** FR-105, FR-145, FR-149, FR-153, FR-179; AC-002, AC-023, AC-024, AC-027, AC-028, AC-034, AC-059; PRIV-006, PRIV-020; SEC-010, SEC-011; REL-012.
- **Architecture:** §§3.3, 4, 6, 7.
- **Dependencies:** MVP-006, MVP-009, MVP-010, MVP-013, MVP-025, MVP-033, MVP-040, MVP-041.
- **Expected change surface:** worker purge jobs, repository deletion methods, local purge, location-history UI/API, restore filters/runbooks.
- **Tests:** Just-before/exact 24h/7d/30d, settled/unsettled/exhausted entries, retry/upload/refresh/restore non-renewal, explicit Task/target/history/account deletion, separate authoritative state.
- **Security/privacy:** Canonical time only; purge whole transport entries; current health/configuration persists appropriately; no deletion-evidence content exception.
- **Done:** Every app-controlled store honors the same matrix and no retry, restore, or stale queue resurrects data.
- **Technical decision required:** No.

#### MVP-043 — Complete authentication, authorization, input, and abuse tests

- **Objective:** Prove every cloud operation authenticates, every user-owned resource independently authorizes ownership, and public boundaries reject malformed/replayed/abusive input.
- **Requirements / ACs:** FR-101, FR-150, FR-166–FR-172, FR-177, FR-180; AC-001, AC-029, AC-031, AC-047, AC-048, AC-051, AC-052, AC-057, AC-063; SEC-001, SEC-002, SEC-009, SEC-014, SEC-015.
- **Architecture:** §§3.10, 3.16, 6, 7.
- **Dependencies:** MVP-005, MVP-011–MVP-013, MVP-035–MVP-041.
- **Expected change surface:** API/mobile security suites, malicious fixtures, endpoint test matrix, CI security jobs.
- **Tests:** At least two accounts for every resource; signed-out/owner/non-owner/wrong-client/tampered/expired/deleted/replay; bounded bodies/depth/collections; route/link/callback fuzz; rate/quota behavior.
- **Security/privacy:** Production owner allowlist checked before expensive work; validation never replaces authorization; errors reveal no extra current data.
- **Done:** The endpoint/resource matrix has no untested owner boundary and all AC security paths pass in isolated environments.
- **Technical decision required:** No; exact bounds close through TD-003.

#### MVP-044 — Perform storage, network, payload, and telemetry privacy inspection

- **Objective:** Verify the complete MVP data flow against device-only coordinates, transient Snapshots/results, detailed-preview limits, protected local state, and no analytics/crash stream.
- **Requirements / ACs:** FR-155–FR-161, FR-165, FR-177, FR-179; AC-031, AC-037, AC-038, AC-040, AC-041, AC-043, AC-046, AC-056, AC-057, AC-059; PRIV-001–PRIV-020 MVP-applicable clauses; SEC-003–SEC-008, SEC-015.
- **Architecture:** §§2, 3.1, 3.4, 3.5, 4, 6, 7.
- **Dependencies:** MVP-004, MVP-009, MVP-021–MVP-041, MVP-042.
- **Expected change surface:** privacy test harness/checklists, network/payload/storage inspection fixtures, `docs/privacy/mvp-data-flow.md`, remediation tickets only where needed.
- **Tests:** DB/journal/cache/queue/backup/log/build/network/FCM/OS surfaces under success/failure/cancel/delete/logout/reinstall; memory-lifetime checks; secret scans.
- **Security/privacy:** This ticket verifies rather than weakens every approved boundary; test data is synthetic and inspection artifacts contain no real sensitive values.
- **Done:** Evidence shows no prohibited coordinate/content/provider/action/hidden-row data on any inspected surface and ordinary MVP use emits no analytics stream.
- **Technical decision required:** No; any discovered mismatch blocks release and may require change control.

### Epic H — Platform quality, release validation, and final alignment

#### MVP-045 — Make every core flow accessible and resilient at large text

- **Objective:** Meet the approved native WCAG 2.2 AA-aligned baseline for Task, permission, notification detail, recovery, and destructive flows.
- **Requirements / ACs:** NFR-004; AC-030; Section 6.4 items 5 and 6.
- **Architecture:** §§3.7, 7.
- **Dependencies:** All user-facing feature tickets MVP-011–MVP-041.
- **Expected change surface:** mobile components/routes, accessibility labels/roles/announcements, layout/status styles, Maestro flows.
- **Tests:** TalkBack order/announcements/actions, 200% text, 48 dp targets, contrast, non-color-only status, Accessibility Scanner, destructive confirmation.
- **Security/privacy:** Accessibility text must not disclose more detail than the visual surface; protected detail remains authenticated.
- **Done:** Every core flow remains complete and understandable without sight, precise touch, default text size, or color perception.
- **Technical decision required:** No.

#### MVP-046 — Pass the physical Android and background-reliability matrix

- **Objective:** Validate a development/release build on physical Android 11/API 30 and the current Android platform, including background geofencing and real process/device failure modes.
- **Requirements / ACs:** FR-151; AC-030, AC-037, AC-044, AC-045, AC-049, AC-054; NFR-001, NFR-002; REL-001, REL-009.
- **Architecture:** §§3.2, 3.8, 7.
- **Dependencies:** MVP-019–MVP-025, MVP-034–MVP-045.
- **Expected change surface:** device matrix/evidence, EAS development/preview profiles, defect tickets; application changes only through traced fixes.
- **Tests:** Manifest/install API29 rejection; physical API30/current; Saved/Specific regions; background/process death/recent-app removal/reboot; offline/replay; permission recovery; travel/DST/manual clock where reproducible; battery observation.
- **Security/privacy:** Synthetic places/tasks; no route tracking; device logs sanitized; force-stop documented as unavailable until reopen.
- **Done:** Required physical matrix passes with documented best-effort limitations and no iOS claim.
- **Technical decision required:** Current platform/build versions are reverified under TD-001.

#### MVP-047 — Validate CI, infrastructure, release artifact, and free-tier controls

- **Objective:** Produce a reproducible signed Android MVP artifact and reviewed immutable API/worker digest without making store publication or OTA a completion dependency.
- **Requirements / ACs:** FR-151, FR-180; AC-030, AC-063; SEC-003, SEC-006; NFR-001, NFR-005, NFR-008.
- **Architecture:** §§3.3, 3.6, 3.8, 3.12–3.16; §§5–7.
- **Dependencies:** MVP-002, MVP-007–MVP-010, MVP-043–MVP-046; TD-001, TD-002, TD-008.
- **Expected change surface:** GitHub workflows, EAS profiles/config, Terraform plans, artifact/SBOM/provenance reports, release runbook.
- **Tests:** Same root checks; immutable Action pins; fork secret denial; OIDC; protected apply; manifest minSdk; environment IDs/keys; container digest identity; quotas/budgets/connections; no production OTA/store dependency.
- **Security/privacy:** Separate credentials per environment; no static keys; signing/upload recovery documented without committing secrets; only owner production access.
- **Done:** Reproducible artifacts and environments pass all gates within approved no-recurring-charge assumptions or stop for explicit owner cost approval.
- **Technical decision required:** **Yes** — TD-001, TD-002, TD-008 evidence values.

#### MVP-048 — Run final requirement alignment and prepare personal validation

- **Objective:** Prove every MVP Must and AC is covered/passing, every exclusion remains absent, and prepare the private four-week evidence procedure without adding analytics or retention.
- **Requirements / ACs:** Section 6.4; Section 6.5; AC-032, AC-062; all FR-101–FR-180 and AC-001–AC-063 through their owner tickets.
- **Architecture:** §1; §§6–8.
- **Dependencies:** MVP-001–MVP-047.
- **Expected change surface:** trace/audit report, release checklist, private-evidence instructions/template under `docs/plans/`; no product analytics or production feature code.
- **Tests:** Requirement-by-requirement result review; explicit exclusion inspection; controlled same-Task/same-Episode duplicate suite; critical-defect audit; artifact/device evidence links.
- **Security/privacy:** Four-week tally remains user-controlled outside app storage; no record retention is extended; personal validation does not authorize public release.
- **Done:** Every Must has passing evidence or approved exception, no blocker/open MVP product decision remains, exclusions are absent, and completion is signed off before four-week use begins.
- **Technical decision required:** No new decision; unresolved earlier gates block completion.

## 6. Critical path

The critical path is:

`MVP-001 → MVP-002 → MVP-005/MVP-006 → MVP-008 → MVP-011 → MVP-014/MVP-015 → MVP-030 → MVP-019/MVP-020 → MVP-021/MVP-025 → MVP-027/MVP-031 → MVP-034/MVP-035/MVP-036 → MVP-037/MVP-038 → MVP-039/MVP-041/MVP-042 → MVP-043–MVP-047 → MVP-048`

The two longest-risk branches are the physical geofencing proof and the combined notification/offline/retention state machine. MVP-019 should start in M0, before feature work makes an Expo geofencing implementation expensive to replace. PD-001 must close before final Saved Place work, but it does not block the platform reliability proof or non-location VS-1.

## 7. Parallelizable work

After MVP-001 and MVP-002:

- MVP-003 (local stack), MVP-004 (SQLCipher), MVP-005 (contracts), MVP-007 (runtime/container), and MVP-019 (geofence proof) can proceed in parallel.
- MVP-008 (Terraform/IAM) can proceed beside MVP-006 (schema) once environment identifiers are known.
- MVP-009 (observability) and MVP-010 (backup) can proceed beside core UI after their infrastructure/schema dependencies exist.
- MVP-016 (recurrence), MVP-018 (settings), MVP-022 (destination capture), and MVP-026 (Places adapter) can proceed in separate modules after shared contracts are stable.
- MVP-034 (token lifecycle), MVP-035 (envelope model), and MVP-040 (offline action transport) can proceed in parallel once the relevant data model and action contracts exist.
- MVP-043 (security matrix), MVP-044 (privacy inspection harness), and MVP-045 (accessibility harness) should be built incrementally, not postponed wholesale to M7; M7 is their final evidence pass.

Do not parallelize two tickets that both change the same domain invariant without first agreeing the contract. In particular, recurrence/recovery, evaluation/outbox, and notification/action state transitions need one canonical implementation owner at a time.

## 8. Risks and likely rework

| Risk | Likely rework | Control |
|---|---|---|
| `expo-location` fails process/OEM tests | Replace provisional adapter with custom Expo/Kotlin module | Run MVP-019 in M0; keep the interface narrow; do not build features against Expo APIs directly. |
| PD-001 closes late | Saved Place registration, fixtures, and UX retest | Resolve before MVP-021; do not encode a temporary radius in production paths. |
| SQLCipher/native module/build incompatibility | Expo config/native integration changes | Prove encrypted DB and development build early in MVP-004. |
| Cross-cloud Supabase/Cloud Run latency or connection exhaustion | Pooling/transaction/worker budget tuning | Measure in preview, cap instances/connections, keep API and worker budgets separate. |
| Temporal edge cases | Schema or occurrence identity migration | Build stable identities and clock abstraction before UI polish; exhaustive gap/fold/travel/manual-clock tests. |
| Grouped Notification semantics drift | Envelope/action/history schema changes | Model per-Task associations from the first migration and freeze preview selection in one service. |
| Offline/retry/retention coupling | Queue schema and purge rewrite | Store canonical original/settlement/expiry times at creation and never derive retention from retry timestamps. |
| Provider mapping quality in the Philippines | Capability adapter/mapping changes | Synthetic fixtures plus controlled local preview tests; do not persist provider results to compensate. |
| Free-tier pauses/quotas | Cold-start UX and operational tuning | Visible degradation, hard quotas/budgets, manual recovery, and explicit cost approval before paid use. |
| No hosted crash SDK | Slower diagnosis of device-only failures | Strong local protected diagnostics, reason-code server logs, reproducible physical matrix; do not weaken privacy for convenience. |
| Input-bound choices are guessed | User-visible behavior/spec rewrite | Keep product-visible TD-003/TD-009 choices blocked until change control where necessary. |

## 9. Explicitly deferred production work

The following must not enter an MVP ticket unless separately promoted through change control:

- iOS/APNs release support and iOS region-budget policy (FUT-001);
- AI/model/SDK/prompt/vector/embedding implementation and voice-first capture (FUT-002, FUT-003);
- additional custom Saved Places (FUT-004);
- coordinated multi-device behavior, device transfer, or production precise-target E2EE sync (FUT-005, FR-034, PRIV-016, SEC-013);
- weather Contexts (FUT-006);
- independent business-proximity/dynamic business geofences (FUT-007);
- business preferences/exclusions (FUT-008);
- routing/detour-aware suggestions or broader discovery (FUT-009);
- full offline Task viewing/creation/editing and conflict resolution (FUT-010);
- nested/AND/Boolean rule builder (FUT-011);
- calendar authorization, share-to-app, inbox/message reading, or reply detection (FUT-012/NG-003);
- collaboration/shared Tasks (FUT-013);
- automatic real-world completion (FUT-014);
- public-release export/archive (FUT-015);
- monetization/public launch, public registration, load balancer/Cloud Armor, production SLAs, paid data plane, or scale architecture (FUT-016);
- Generic Notification privacy selector (FUT-017) or direct OS Notification actions (FUT-018);
- product analytics, Sentry/hosted mobile crash reporting, replay, screenshots, or long-lived telemetry;
- Play Store publication and production EAS Update/OTA rollout as MVP completion dependencies;
- microservices, n8n/Telegram/Tasker/Shortcuts, PostGIS, route tracking, arbitrary scraping, private-listing extraction, or automatic escalation.

## 10. Suggested issue labels

Use a small composable label taxonomy:

- Type: `type:feature`, `type:infrastructure`, `type:test`, `type:docs`, `type:spike`, `type:decision`, `type:security`.
- Area: `area:mobile`, `area:api`, `area:database`, `area:auth`, `area:tasks`, `area:time`, `area:location`, `area:places`, `area:notifications`, `area:offline`, `area:infra`, `area:privacy`.
- Workflow: `status:needs-decision`, `status:blocked`, `status:needs-physical-device`, `status:needs-preview`, `status:needs-security-review`.
- Risk: `risk:critical`, `risk:high`, `risk:medium`, `risk:low`.
- Scope: `scope:mvp`, `scope:production-deferred`, `scope:no-behavior-change`.
- Trace: prefer issue fields for FR/AC IDs; if labels are required, use only coarse `trace:requirements` rather than creating 143 ID labels.

Every implementation issue should have exactly one type, one primary area, `scope:mvp`, a milestone, and explicit FR/AC fields. Production-deferred issues stay out of the MVP milestones and default project view.

## 11. Recommended GitHub Project workflow

Use one repository Project with these statuses:

1. **Backlog** — traced but not yet dependency-ready.
2. **Needs decision** — PD/TD gate is explicit; no implementation begins.
3. **Ready** — dependencies and decisions closed; acceptance/test plan complete.
4. **In progress** — one accountable owner; solo-developer WIP limit 2, with at most one high-risk state-machine ticket.
5. **In review** — code/doc review and requirement alignment underway.
6. **Verification** — preview, physical device, security, privacy, migration, or operational evidence still required.
7. **Blocked** — external/provider/device failure with blocker and next check recorded.
8. **Done** — ticket Definition of Done and cited AC evidence pass; dependent tickets may start.

Recommended Project fields:

- Ticket ID and Epic
- Milestone
- Priority (`P0` blocker, `P1` critical path, `P2` parallel/support, `P3` post-MVP only)
- Risk
- Primary area
- Requirements IDs
- Acceptance-criterion IDs
- Architecture sections
- Decision gate (`none`, PD/TD ID)
- Environment (`local`, `preview`, `production-MVP`)
- Verification (`unit`, `integration`, `contract`, `migration`, `Maestro`, `physical device`, `security`, `privacy`)
- Dependency tickets
- Evidence link

Automation should move an issue to Ready only when dependencies and decisions are closed; opening a PR moves it to In review; merge moves it to Verification, not Done, when physical/preview evidence remains. Branch protection requires the root check, generated-contract drift, migration/schema checks, secret/dependency scans, and applicable Terraform checks. Production apply/release remains a protected manual approval.

## 12. Coverage audit

### 12.1 Functional requirement coverage

| Requirements | Covering tickets |
|---|---|
| FR-101 | MVP-011, MVP-043 |
| FR-102–FR-105 | MVP-014, MVP-017, MVP-042 |
| FR-106–FR-110 | MVP-014, MVP-015, MVP-032 |
| FR-111–FR-117 | MVP-016, MVP-017, MVP-032 |
| FR-118–FR-121 | MVP-020, MVP-021 |
| FR-122 | MVP-025, MVP-027, MVP-031 |
| FR-123–FR-124 | MVP-026 |
| FR-125–FR-128 | MVP-027–MVP-029 |
| FR-129 | MVP-016, MVP-032 |
| FR-130–FR-131 | MVP-030 |
| FR-132–FR-133 | MVP-035, MVP-036, MVP-037 |
| FR-134–FR-136 | MVP-017, MVP-037, MVP-038, MVP-040 |
| FR-137 | MVP-035–MVP-037 |
| FR-138–FR-142 | MVP-018, MVP-030, MVP-039 |
| FR-143–FR-145 | MVP-004, MVP-025, MVP-040–MVP-042 |
| FR-146–FR-147 | MVP-024, MVP-041 |
| FR-148–FR-150 | MVP-013, MVP-036, MVP-041, MVP-042 |
| FR-151 | MVP-019, MVP-046, MVP-047 |
| FR-152–FR-154 | MVP-033, MVP-038, MVP-042 |
| FR-155–FR-156 | MVP-004, MVP-021, MVP-025, MVP-027, MVP-044 |
| FR-157–FR-158 | MVP-026, MVP-028, MVP-029, MVP-044 |
| FR-159–FR-161 | MVP-022, MVP-023, MVP-044 |
| FR-162–FR-165 | MVP-020, MVP-023, MVP-031, MVP-035 |
| FR-166–FR-167 | MVP-011, MVP-043 |
| FR-168–FR-170 | MVP-025, MVP-031, MVP-042 |
| FR-171–FR-173 | MVP-011, MVP-012, MVP-038, MVP-040 |
| FR-174–FR-176 | MVP-025, MVP-027, MVP-028 |
| FR-177 | MVP-034, MVP-035, MVP-037, MVP-039 |
| FR-178 | MVP-036, MVP-041 |
| FR-179 | MVP-004, MVP-010, MVP-025, MVP-040–MVP-042 |
| FR-180 | MVP-008, MVP-011, MVP-043, MVP-047 |

All FR-101–FR-180 are assigned. Assignment is not evidence of completion; MVP-048 requires passing acceptance evidence.

### 12.2 Acceptance-criterion coverage

| Acceptance criteria | Primary covering tickets |
|---|---|
| AC-001–AC-003 | MVP-011, MVP-014 |
| AC-004–AC-006 | MVP-014, MVP-015, MVP-030, MVP-032 |
| AC-007–AC-008 | MVP-016, MVP-017, MVP-032 |
| AC-009–AC-011 | MVP-021, MVP-025, MVP-031 |
| AC-012–AC-015 | MVP-026–MVP-028, MVP-041 |
| AC-016–AC-019 | MVP-030, MVP-035–MVP-038 |
| AC-020–AC-022 | MVP-035, MVP-036, MVP-038, MVP-039 |
| AC-023–AC-025 | MVP-004, MVP-012, MVP-025, MVP-040–MVP-042 |
| AC-026–AC-029 | MVP-013, MVP-024, MVP-036, MVP-041, MVP-042 |
| AC-030–AC-032 | MVP-043–MVP-048 |
| AC-033–AC-036 | MVP-018, MVP-033, MVP-038, MVP-039, MVP-042 |
| AC-037–AC-040 | MVP-004, MVP-021, MVP-025–MVP-029, MVP-044 |
| AC-041–AC-043 | MVP-022, MVP-023, MVP-044 |
| AC-044–AC-046 | MVP-017, MVP-020, MVP-022, MVP-023, MVP-031, MVP-035, MVP-044 |
| AC-047–AC-048 | MVP-011, MVP-043 |
| AC-049–AC-050 | MVP-025, MVP-031, MVP-042 |
| AC-051–AC-053 | MVP-011, MVP-012, MVP-038, MVP-040 |
| AC-054–AC-056 | MVP-027, MVP-028, MVP-044 |
| AC-057–AC-059 | MVP-035–MVP-044 |
| AC-060–AC-061 | MVP-016–MVP-018, MVP-023, MVP-030, MVP-032, MVP-039 |
| AC-062 | MVP-048 |
| AC-063 | MVP-008, MVP-011, MVP-043, MVP-047 |

All AC-001–AC-063 are assigned.

### 12.3 Scope audit result

- Every atomic MVP requirement FR-101–FR-180 is covered by at least one ticket.
- Every acceptance criterion AC-001–AC-063 is covered by at least one ticket.
- Privacy, security, authorization, retention, offline, notification, and device-only location constraints have dedicated implementation and independent verification tickets.
- The architecture's mandatory geofence, bootstrap, free-tier, migration, IAM, container, contract, and physical-device gates are scheduled before release.
- Production-only and explicitly excluded capabilities are listed in Section 9 and appear in no MVP Definition of Done.
- DOC-001, PD-001, and PD-002 are resolved through documented change control; TD-001–TD-009 are explicitly assigned evidence or decision points.

Subject to those blockers, this plan is complete for implementation sequencing. It does not declare the MVP complete and does not authorize public release.
