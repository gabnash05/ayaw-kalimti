# Ayaw Kalimti — System Architecture

## 1. Document Control

| Field | Value |
|---|---|
| System | Ayaw Kalimti |
| Document status | Approved architecture baseline — pre-implementation |
| Version | 0.1.11 |
| Product owner | Project owner (name TBD) |
| Last updated | 2026-08-31 |
| Initial content source | PRODUCT_SPEC.md version 0.1.23; current product constraints are version 0.1.27 |
| Intended audience | Engineers, security reviewers, operators, testers, and AI development agents |

### Source-of-truth boundary

This document is the canonical source of truth for system architecture, component responsibilities, technology choices, the planned technical data model, repository structure, implementation rules, and engineering verification strategy.

- [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) remains canonical for product behavior, scope, invariants, requirements, acceptance criteria, privacy obligations, and externally observable failure semantics.
- [CONTEXT.md](./CONTEXT.md) remains canonical for implementation-independent domain language.
- Future records under `docs/decisions/` explain qualifying hard-to-reverse technical choices; they do not replace this current architecture.
- If architecture conflicts with an approved product requirement, the product requirement wins and the conflict enters product change control rather than being silently implemented.

## 2. Confirmed architecture

This document records the approved implementation direction. It does not define product identity. A technology may be replaced while preserving every applicable requirement, invariant, and acceptance criterion.

The confirmed strategy is Option A: a production-track TypeScript mobile and backend system.

The main responsibility boundaries are:

1. The Android application stores exact MVP Saved Place and Specific Destination coordinates in protected device storage, registers permitted geofences, supports address search, map-pin selection, and recognized map links, captures structured Tasks, stores coordinate-free retention-bounded offline queue entries, evaluates current-local and elapsed-time device behavior, and reports permission health.
2. One NestJS container image is deployed through separate Cloud Run API and worker services. The public API service authenticates interactive requests and coordinates Task, Context, device, place, opportunity, and notification modules. It may process one Current-location Snapshot only in memory for an active Place Capability Evaluation Episode or explicit Find Nearby interaction. It batches one provider search per distinct Effective Place Query only within an Episode; Find Nearby performs one isolated selected-capability search. It MUST NOT persist or log the Snapshot or result sets.
3. PostgreSQL owns authoritative Task lifecycle, fixed reminder and Deadline instants plus creation timezone, civil recurrence rules and logical occurrence identities, elapsed cooldown and Snooze state, duplicate, Notification, queue-retention, and opaque location-target-reference state; it owns no MVP coordinate column.
4. The opportunity engine evaluates candidates and writes a notification outbox record in a transaction.
5. Cloud Scheduler invokes authenticated private worker endpoints for fixed-instant reminder, current-local recurrence, and current-local digest work; handlers use logical identities so timezone, DST, and manual-clock changes cannot duplicate authoritative effects.
6. Cloud Tasks invokes authenticated private worker endpoints for retryable, idempotent delivery work. The public API cannot impersonate Cloud Tasks or Cloud Scheduler, and the worker is not publicly invokable.
7. The notification worker freezes preview selection and order, then sends at most three displayed Task-title/reason rows, the total or remaining count, an opaque open-routing reference, and necessary delivery/grouping metadata directly to FCM for the Android MVP under PRIV-019; hidden envelope membership remains server-side. Its dedicated service identity receives only the Google Cloud permissions required for its worker duties. A provider interface isolates transport-specific code so production iOS can add direct APNs without changing Notification semantics.
8. Tapping an MVP operating-system Notification only routes to Authenticated Notification Detail. The API enforces session and ownership checks before returning the complete current Task/reason list or accepting per-Task Done, Snooze, or Not useful actions through the idempotent state model. Same-Episode grouping is mandatory and preview overflow never splits an Episode.

The phone detects platform Events and sends coordinate-free transition metadata. The backend decides whether they constitute a useful Opportunity; the database owns authoritative fatigue and deduplication state without raw coordinates; the delivery pipeline handles retries.

## 3. Technology choices

| Technology or approach | Current responsibility | Why selected | Known limitations and replacement condition | Status |
|---|---|---|---|---|
| TypeScript | Mobile, API, contracts, and primary tests | One language and shared tooling | Runtime validation remains necessary | Confirmed |
| Expo + React Native | Android MVP and later cross-platform mobile UI | Production-track native application with fast cross-platform development | Background behavior follows OS restrictions; native modules may later be needed | Confirmed |
| EAS Build | Development, preview, signed, and store builds | Reproducible native builds and signing workflow with a usable solo-developer free tier | The free plan has monthly build and queue limits; hosted credential custody and later production support/capacity require explicit review | Confirmed for free-tier MVP; paid plan or self-hosted build path considered only when usage or release requirements justify it |
| Expo Router | File-based mobile navigation, typed routes, and deep-link entry points | Expo's recommended navigation foundation is integrated with the selected framework and avoids a second hand-maintained route registry | Route parameters and deep links remain untrusted input and require validation; provider-specific or domain behavior MUST NOT live in route files | Confirmed |
| expo-location + expo-task-manager | Candidate implementation for Saved Place and Specific Destination region monitoring and background tasks | Fastest route to a production-shaped physical-device proof without abandoning Expo | Expo documents that Android terminated-app behavior is limited, swipe-away behavior varies by vendor, background support requires a development/release build, and force-stop cannot be treated as a deliverable event path. Current official limits are up to 100 Android geofences and 20 iOS regions; the MVP still uses its testing-tunable 20-Specific-Destination product cap | Provisional pending the mandatory geofencing proof gate; it MUST NOT become the committed implementation merely because the API is convenient |
| Custom Expo native module using Android GeofencingClient | Pre-approved fallback for Android region registration, transition receipt, boot re-registration, and health reporting | Preserves the Expo/React Native application while allowing direct control of the app's defining Android capability | Adds Kotlin, config-plugin, native lifecycle, OEM, upgrade, and physical-device test responsibility; it still cannot override Android force-stop or platform delivery limits | Activate only if the proof gate shows expo-location cannot meet the approved best-effort behavior |
| Expo SecureStore | Random SQLCipher database key and authentication/session secrets only | Uses operating-system-protected secret storage while keeping structured state in one transactional database | The SQLCipher key MUST remain available to approved background processing and therefore cannot require biometric interaction; reinstall, logout, deletion, or unrecoverable key loss makes the local database unavailable | Confirmed for MVP |
| Expo SQLite with SQLCipher | All structured local application state, including exact Saved Place and Specific Destination coordinates, destination display data, and coordinate-free Evaluation Event and action queues | Provides encrypted relational storage, transactions, migrations, and durable offline behavior without fragmenting structured state across stores | Requires a development/release build, explicit key lifecycle, backup exclusion, migration tests, and safe recovery; it is not authoritative server state and Current-location Snapshots remain prohibited | Confirmed for MVP |
| TanStack Query | Remote server-state fetching, invalidation, and in-memory caching | Established React Native server-state lifecycle without inventing request/cache machinery | MUST NOT become the source of truth for SQLCipher state, offline queues, domain state, or UI-only state; React Native focus and connectivity integration require explicit configuration | Confirmed |
| React Hook Form plus Zod | Mobile form state and runtime validation of user, route, link, and other untrusted application-boundary input | Keeps transient form mechanics separate from domain behavior while deriving safe TypeScript values from executable schemas | Schemas MUST NOT duplicate or redefine approved domain rules; generated TypeScript types alone do not perform runtime validation | Confirmed |
| NestJS modular monolith on the default Express adapter, with concrete DTOs, global `ValidationPipe`, `class-validator`, and `class-transformer` | API and worker modules, HTTP transport, request validation, transformation, and OpenAPI source metadata | Uses NestJS's broadest-supported middleware path while keeping business rules and authorization in application/domain services | DTO validation is not authorization or domain enforcement. Express remains the MVP adapter only while measured latency, throughput, memory, and compatibility are acceptable; Fastify is the pre-approved optimization candidate after MVP evidence | Confirmed for MVP; performance reviewed before public production |
| NestJS-generated OpenAPI document plus generated TypeScript client | Canonical HTTP transport contract and typed mobile client | Prevents handwritten client/endpoint drift while preserving server ownership of the public API schema | Generation and diff checks MUST be automated; generated static types do not validate runtime data, and the transport contract does not replace domain definitions | Confirmed approach |
| Supabase PostgreSQL | Authoritative relational data | Portable PostgreSQL, integrated identity support, and a free tier suitable for personal MVP validation | The free plan may pause after inactivity and provides no automatic backups or PITR. Runtime connections require verified TLS, bounded pooling, and a Cloud Run connection budget; MVP schemas and migrations MUST contain no raw-coordinate field | Confirmed for free-tier personal MVP; public production requires the paid-data-plane promotion gate below |
| Supabase Auth with Google OAuth/OpenID Connect | MVP identity federation and product-session issuance | Supports the confirmed Android Google sign-in, integrates account identity with PostgreSQL, and fits free-tier personal validation | Mobile flow MUST use Authorization Code with PKCE, asymmetric signing keys/JWKS verification, minimum `openid` and `email` scopes, allow-listed deep-link redirects, protected auto-refreshing product-session storage, and fresh Google reauthentication for account deletion | Confirmed for free-tier MVP; production security and capacity are reverified at promotion |
| Drizzle ORM plus generated, reviewed, explicit SQL migrations | Typed data access and versioned schema evolution | Lightweight and close to PostgreSQL while keeping the executed SQL visible and reviewable | `drizzle push` and application-startup migrations are prohibited in production; schema review MUST reject coordinate fields and raw-location payloads, and destructive changes require staged recovery planning | Confirmed approach |
| Google Places Nearby Search (New) | Transient Place Capability discovery and Find Nearby | Place coverage, supported internal type mapping, open status, distance, and a current monthly no-charge usage cap sufficient for personal MVP testing | Billing must be enabled even below the free usage cap. Active search origin and business result may be used only for the current request and MUST NOT be logged or persisted; strict field masks, quotas, budget alerts, third-party retention, mapping quality, and replacement conditions require review | Confirmed initial MVP provider within an enforced no-charge usage budget; paid usage requires later approval |
| `react-native-maps`, Google Maps SDK for Android, and a thin Expo/Kotlin module around Places SDK for Android Autocomplete (New) | Android map display, map-pin selection, address autocomplete, and confirmed Specific Destination capture | Uses mature Android-native Google surfaces while keeping provider-specific code behind application adapters | This is the approved initial path, not an irreversible dependency. Reconsider it if an official stable Expo map stack meets the requirements with less native code, compatibility degrades, provider cost/privacy terms materially change, or testing identifies an unacceptable constraint | Approved initial implementation; subject to later evidence-based reconsideration |
| Google Cloud Tasks | Retryable asynchronous delivery work | Durable authenticated Cloud Run delivery and a monthly free tier far above expected personal MVP traffic | At-least-once delivery requires idempotency; task payloads stay minimal and every retry is a billable operation after the free allowance | Confirmed for free-tier MVP; monitor operations before approving paid scale |
| Google Cloud Scheduler | Time, recurrence, and digest invocation | Managed recurring scheduling with three jobs per billing account free | At-least-once invocation requires idempotency. The MVP MUST use no more than three shared dispatcher jobs rather than one Scheduler job per Task or User | Confirmed for free-tier MVP; additional jobs require an explicit cost decision |
| expo-notifications plus direct FCM through Firebase Admin SDK | Android permission handling, native device-token registration, local presentation, and server-to-FCM delivery | Keeps the Expo mobile workflow while removing an additional semantic-payload processor; Cloud Run can authenticate through a dedicated least-privilege service identity and Application Default Credentials without a stored service-account key | FCM acceptance is not delivery or viewing; token rotation and invalidation require handling. Production iOS adds direct APNs behind the same transport interface rather than routing through Expo Push | Confirmed for Android MVP; APNs adapter required before iOS release |
| Two Google Cloud Run services from one NestJS container image | Public interactive API and private Scheduler/Tasks worker with separate entry points, service identities, scaling limits, and health checks | Preserves one modular codebase while isolating invocation, privilege, concurrency, failure, and scaling boundaries; both can scale to zero | Adds a second deployment target and potential cold start but no idle instance commitment. API and worker modules MUST NOT accidentally expose each other's entry points or privileges | Confirmed for free-tier-targeted MVP; paid availability and networking controls activate only at production promotion |
| Multi-stage hardened OCI container | Reproducible API/worker runtime artifact | Keeps build tools and development dependencies out of production while supporting one scanned, immutable artifact for both roles | Minimal images reduce interactive debugging; diagnostics must come from approved logs, health endpoints, and reproducible local/preview environments | Confirmed |
| Google Cloud Logging plus protected on-device diagnostics | Content-free API/worker operations, health signals, alerts, and explicitly shared mobile diagnostics | Fits the existing Google runtime, permits a seven-day application-log retention boundary, and avoids sending routine mobile telemetry to another processor | It deliberately omits hosted mobile crash reporting, replay, screenshots, and long-lived diagnostics. Reconsider a hosted crash provider only before public release and only if its actual plan can enforce the approved data and seven-day retention boundaries | Confirmed privacy-first MVP observability; Sentry excluded from MVP |
| Deferred analytics provider | Possible implementation of later approved product analytics | Provider selection should follow demonstrated need rather than drive the MVP | No third-party product analytics in the MVP or first public release; any later provider requires a new explicit privacy, security, and data-processing review | Deferred; no provider selected |
| npm workspaces | Repository organization | One lockfile and simple application/package grouping | Add Nx only if repository scale or CI measurements justify it | Confirmed initial approach |
| Repository-owned Docker Compose local stack, pinned Supabase CLI migration tooling, and application-owned provider fakes | Local PostgreSQL/Auth/RLS/migration work and deterministic Places, notification, queue, and scheduler tests | Explicit per-service loopback mappings prevent the local stack from changing Docker Desktop defaults or exposing services while retaining provider-standard migration inputs | Docker-compatible runtime is required; fakes cannot prove provider compatibility, so controlled preview integration and physical-device tests remain mandatory | Confirmed |
| GitHub Actions | Pull-request checks, reviewed Terraform plans, protected deployments, and release orchestration | Native repository controls, a usable free allowance, and short-lived Google Cloud authentication through GitHub OIDC and Workload Identity Federation | Workflows and third-party actions remain supply-chain inputs and require least privilege, immutable SHA pinning, environment protection, and review | Confirmed |
| TypeScript strict mode, ESLint flat config with type-aware `typescript-eslint`, and Prettier | Static correctness, repository-wide code policy, and deterministic formatting | Current standard tooling catches unsafe TypeScript behavior and keeps formatting separate from semantic linting | Type-aware linting is slower; CI is authoritative and mandatory Git hooks are deferred unless measured developer errors justify them | Confirmed |
| Terraform with a Google Cloud Storage remote backend | Google Cloud infrastructure, IAM, Cloud Run, Scheduler, Tasks, logging resources, budgets, and environment configuration | Widely supported declarative infrastructure with reviewable plans, provider locking, and GCS state locking/version recovery | Terraform state can contain sensitive values and the state bucket must exist before its backend. State access, bootstrap, drift, version upgrades, and licensing remain operational responsibilities; Supabase schema stays in reviewed SQL migrations | Confirmed; Terraform retained instead of OpenTofu |
| Google Secret Manager | Runtime secrets for deployed Google Cloud workloads | Central access control, auditability, rotation support, and native Cloud Run integration | Mobile public configuration is not made secret by placing it here; secret values should not pass through Terraform state when avoidable | Confirmed for deployed secrets |
| Singapore regional placement | Supabase `ap-southeast-1` and regional Google Cloud resources in `asia-southeast1` | Closest practical common provider location to the initial user in the Philippines and avoids routine inter-region application/database traffic | Cross-cloud traffic still incurs latency and possible egress; region selection is a data-location control, not proof of regulatory compliance, and must be remeasured before public release | Confirmed initial MVP placement; public-production review required |
| Owner-account MVP allowlist plus staged public edge protection | Restricts personal validation while defining the later public abuse boundary | Minimizes attack surface and paid edge infrastructure before external use while preserving a production-grade promotion path | The allowlist is not a public access model. Public release requires distributed application limits and managed edge/WAF controls with privacy-safe tuning | Confirmed |
| Provider-neutral AI interpretation gateway | Future typed/voice capture interpretation into a validated structured proposal | Prevents an AI vendor or model from owning domain semantics, tools, persistence, or authorization | No provider or AI SDK is selected for the MVP. A later provider must pass structured-output, privacy/retention, security, latency, availability, and cost gates | Approved production boundary; deferred from MVP |
| Jest, `jest-expo`, React Native Testing Library, and Supertest | Mobile, shared-domain, NestJS unit/integration, component, and HTTP-boundary tests | Jest is the default NestJS test framework and the supported Expo path, giving the repository one primary runner with environment-specific presets | Jest-based simulation cannot prove Android lifecycle, permission, Google Play services, OEM, geofence, or native-module behavior | Confirmed |
| Maestro | Small critical-path black-box flows against bundled Android applications | Exercises the accessibility-visible final application with low source instrumentation and an Expo-compatible adoption path | It does not replace lower-level tests or the physical-device geofencing matrix; flows remain few, deterministic, and high-value | Confirmed initial E2E layer |
| Detox | Possible later native-synchronized mobile testing | May help if critical native flows cannot be made reliable in Maestro | Higher setup and maintenance cost; no MVP dependency and no adoption without demonstrated Maestro coverage failure | Deferred alternative |
| EAS Update with controlled runtime compatibility, rollout, and rollback | Possible post-MVP/public-production JavaScript and asset updates | Can shorten compatible production fixes while retaining signed native-build boundaries | Not enabled or required for MVP validation. Native dependency, permission, background, security-boundary, or runtime-incompatible changes always require a new signed build; public use requires preview verification, protected approval, staged rollout, and tested rollback | Approved production-readiness policy; implementation deferred until public-release work |

The 2026-08-18 verification baseline is Expo SDK 57 with React Native 0.86 and a compatible Node version, plus NestJS 11 on a current Node LTS. Expo SDK 57 compiles and targets Android API 36; that target satisfies the Google Play target-API requirement taking effect for new applications and updates on 2026-08-31. The product explicitly overrides any broader Expo default by declaring effective `minSdkVersion = 30`, supports Android 11/API 30 and newer, and treats Android 17/API 37 as the current-platform compatibility target. Before project initialization and every release, engineering MUST reconfirm Expo, Android, Google Play, Node, and NestJS versions from official documentation, use the latest Expo-supported target API that satisfies Google Play, and record exact values in dependency and build manifests. Current dependency and platform values are implementation baselines rather than permanent product invariants; the Android 11/API 30 minimum is an approved product boundary until explicitly changed.

### 3.1 Encrypted local storage and key lifecycle

The application creates a cryptographically random SQLCipher key for the active local installation and stores only that key plus authentication/session secrets in Expo SecureStore. SQLCipher encrypts every structured local table, including precise targets, destination display data, Tasks cached for offline use, and Event/action queues. Current-location Snapshots remain transient and MUST NOT be written to the database.

SecureStore access to the database key MUST NOT require biometric or interactive authentication because approved background geofence handling must be able to open the database while the application UI is inactive. The SQLCipher database, its journals, and the SecureStore key are excluded from Android backup and device-transfer mechanisms. No plaintext database or plaintext fallback path is permitted.

Logout and account deletion remove the local database, journals, cached files, and SecureStore entries as one cleanup operation. Reinstallation, device change, SecureStore loss, key invalidation, or database-key mismatch causes the unreadable database to be deleted after safe diagnosis; cloud-authoritative state may be refetched after authentication, but precise targets and other device-only data require explicit re-entry. The application MUST NOT weaken encryption or attempt to recover by copying sensitive fields into plaintext.

### 3.2 Geofencing proof gate

Before the general mobile feature build commits to a geofencing library, a time-bounded technical spike MUST register, restore, trigger, and remove Saved Place and Specific Destination regions on physical Android 11/API 30 and current-Android devices, including at least one vendor with aggressive process management. It covers foreground, ordinary background, operating-system process death, recent-app removal, device reboot and re-registration, permission revocation/recovery, Google Play services interruption, duplicate transitions, and offline queue handoff. Android force-stop is recorded as an unavailable platform state until the user reopens the app rather than treated as a failed library test. The spike records battery behavior and whether a transition reaches the coordinate-free queue without retaining a Current-location Snapshot.

The MVP region adapter registers Home and Work/School Anchors at the Product Spec's fixed 300-metre radius and Specific Destinations at their fixed 250-metre radius. These values are testing-tunable only; the adapter exposes no user configuration for them.

`expo-location` is promoted from provisional only if that evidence meets the approved best-effort behavior on the required devices. Otherwise the project activates the custom Expo native-module fallback and repeats the same gate. This chooses the smallest implementation that actually works; it is not a prototype whose behavior may silently differ from the MVP.

### 3.3 Cost-stage and data-plane gates

The personal MVP targets no recurring platform charge while staying inside official free allowances. This cost objective does not weaken product privacy, authorization, deletion, retention, or idempotency rules and does not promise that a billing account or payment method is unnecessary.

MVP configuration uses Supabase Free, Cloud Run request-based billing with scale-to-zero and zero minimum instances, a conservative maximum instance count, at most three shared Cloud Scheduler jobs, Cloud Tasks below its free monthly operation allowance, direct FCM, Google Places quotas below the applicable no-charge SKU cap, and the EAS free build allowance. Budget alerts, hard service quotas where supported, and a documented shutdown response MUST prevent accidental cost growth. The free Supabase plan's pausing remains acceptable only for personal validation.

Because Supabase Free does not provide automatic backups, the MVP creates one logical database export every seven days using the Supabase CLI or an equivalent PostgreSQL-native dump. Each export is encrypted before it leaves the controlled backup process, stored in a user-controlled location outside Supabase and outside the repository, and retained for no more than 30 elapsed days. The encryption key is stored separately from the backup artifact; plaintext dumps and unencrypted temporary remnants are prohibited.

At least once per month, the newest backup is restored into an isolated disposable environment and checked for schema compatibility, ownership integrity, expected retained records, and absence of prohibited raw-location fields. The disposable restore and temporary material are destroyed after the check. A backup that has not passed a restore drill is not treated as proven recoverable.

Before public production, the hybrid data plane MUST pass a promotion review that selects a non-pausing paid database plan, automated backup/restore capability consistent with the approved retention boundary, verified TLS including certificate validation, an approved runtime pooler mode, bounded per-instance and fleet-wide connection budgets, region and measured latency/egress review, database network restrictions with stable Cloud Run egress when justified, administrator MFA, RLS and application-level ownership defense in depth, staging/load/restore tests, and documented provider-exit procedures. PITR, higher availability, static egress, support tier, and other paid controls are enabled only when the public-release risk or measured use justifies them.

### 3.4 Specific Destination map and address capture

The approved initial Android implementation uses `react-native-maps` with Google Maps SDK for map display and pin selection. Address autocomplete uses a small application-owned Expo/Kotlin native module around Google Places SDK for Android Autocomplete (New). Provider-specific types and callbacks terminate at application adapters so capture screens and domain code do not depend directly on Google response objects.

Autocomplete requests travel directly from the Android device to Google. The backend MUST NOT proxy, log, or retain address query text, candidate lists, provider place identifiers, or selected coordinates. Each autocomplete interaction uses a fresh session token, requests only the minimum fields required to confirm a destination, and discards transient candidates when the interaction ends. Only the user-confirmed destination enters the local SQLCipher database under the approved location boundary.

Development, preview, and production use separate Google Maps Platform credentials. Map and Places keys are separated where the platform permits, restricted to the required APIs and Android application identity through package name plus signing-certificate fingerprint, and governed by quotas and budget alerts. Keys embedded in the application are treated as restricted identifiers rather than secrets; unrestricted keys are prohibited.

Recognized Google map links are parsed and validated locally through an allowlisted link adapter. The app does not fetch or scrape arbitrary pages. If a supported link cannot be resolved safely, capture falls back to explicit map-pin selection and user confirmation.

This choice remains reviewable. Replacement requires evidence that the alternative preserves capture quality, the direct-to-provider privacy boundary, key restrictions, link fallback, physical-device compatibility, and production support without weakening the Product Spec. An official Expo map implementation is reconsidered when it is stable and meets those needs; it is not adopted merely to remove a small native module.

### 3.5 Privacy-first operational observability

Cloud Run application and worker logs use structured, allowlisted, content-free records routed to a dedicated Cloud Logging bucket with seven-day retention. Log-based health metrics and alerts may use coarse counts, latency, availability, retry, queue-age, and sanitized error-class fields. Logs MUST NOT contain Task text, Context values, coordinates or coordinate-derived values, destination data, provider results or identifiers, notification semantic payloads, credentials, tokens, persistent cross-service user identifiers, or request/response bodies.

The Android application retains sanitized diagnostics only inside SQLCipher for no more than seven elapsed days. Personal-MVP diagnostics leave the device only after an explicit user-initiated support action that shows the user what category of information will be shared. Ordinary application use sends no mobile crash, replay, screenshot, trace, or product-analytics stream. Local Android development tools may inspect an attached development build, but captured output is temporary development material and not a production telemetry channel.

Sentry is not part of the MVP because its current free-plan retention does not meet the approved seven-day application-data boundary. Before public release, a hosted crash provider may be reconsidered only after verifying enforceable retention, field-level minimization, deletion, region/subprocessor, consent, authorization, cost, and failure-isolation requirements against the actual contracted plan. Product operation MUST remain independent of that provider.

### 3.6 CI/CD, infrastructure, secrets, and software supply chain

GitHub Actions runs deterministic formatting, linting, type checking, tests, generated-contract drift checks, migration checks, secret scanning, dependency review, and Terraform validation. Pull requests receive a reviewed Terraform plan generated without production write authority. Production deployment requires a protected GitHub environment and explicit human approval; deployment jobs receive only the permissions and environment access needed for that operation.

GitHub Actions authenticates to Google Cloud with GitHub OIDC and Google Workload Identity Federation. Trust conditions restrict repository, branch or tag, workflow, and protected environment as applicable. Dedicated least-privilege service accounts separate planning, deployment, and runtime duties. Static Google service-account keys in GitHub, EAS, developer machines, or the repository are prohibited.

Terraform owns Google Cloud infrastructure and IAM. Supabase application schema remains owned by versioned SQL migrations so database evolution is not split across two schema tools. Terraform state uses a dedicated access-restricted GCS bucket with uniform bucket-level access, public-access prevention, object versioning, encryption at rest, state locking, auditability, and separate environment prefixes or roots. The state bucket and initial federation trust use a small documented bootstrap procedure because the backend must pre-exist. Local state, saved plan files, sensitive `.tfvars`, and `.terraform/` content are never committed.

Terraform and provider versions are constrained; `.terraform.lock.hcl` is committed. Pull requests run `terraform fmt`, `validate`, security/static checks, and a reviewable plan. Apply consumes the reviewed revision through the protected environment, not an unreviewed local plan. Scheduled drift detection is read-only and reports differences without automatic reconciliation. Force-unlock, state push, imports, and destructive replacement require an explicit runbook and human review.

Google Secret Manager stores deployed secret values, and Cloud Run reads them through its runtime identity. Terraform may create secret containers and IAM bindings, but secret values SHOULD enter through a separate controlled path so they do not appear in plans or state. Repository variables, mobile configuration, and API keys are classified explicitly; a client-embedded restricted API key is not mislabeled as a confidential secret.

Third-party GitHub Actions are pinned to immutable full commit SHAs, workflow permissions default to read-only, untrusted fork code cannot access deployment environments or secrets, and dependency lockfiles are committed. Dependabot and repository-native free security checks are enabled where available. Paid private-repository security products are a later risk-and-cost decision, not an MVP dependency. EAS builds occur only for deliberate development, preview, or release events so CI does not consume the free build allowance on every change.

### 3.7 Mobile application foundations

Expo Router owns route composition, navigation, and deep-link entry. Route files remain thin composition surfaces: feature behavior lives under `src/features`, background behavior under `src/background`, and provider integration behind services or adapters. Route parameters, notification open routes, OAuth callbacks, and incoming links are untrusted and MUST pass runtime validation and authorization before resolving data or causing an action.

TanStack Query owns only remote server-state request lifecycle, cache invalidation, and short-lived in-memory caching. React Native application-focus and connectivity signals are wired explicitly. It MUST NOT persist or replay the coordinate-free offline queue, replace SQLCipher, determine Task lifecycle, or silently apply a generic retry policy to non-idempotent mutations. Mutation retries follow the approved idempotency and queue rules.

React Hook Form owns transient mobile form interaction. Zod validates form values and other untrusted mobile-boundary input and may contribute shared contract schemas where that does not create a second source of product truth. Approved domain rules remain in domain/application services and server authorization; they are not hidden exclusively in UI schemas.

Ordinary component-local React state is the default for ephemeral UI state, with narrowly scoped Context only for truly shared presentation or session surfaces. No general global-state library is installed during bootstrap. A later library such as Zustand requires a demonstrated cross-feature state problem, explicit ownership boundaries, and proof that it will not duplicate TanStack Query, SQLCipher, authentication, or domain state.

### 3.8 Android build, signing, and production update policy

MVP work uses deliberate EAS development and internal preview builds needed for native modules, background behavior, and physical-device testing. It does not build a store-release pipeline or enable EAS Update merely to complete personal MVP validation. Development and preview have distinct Android application identifiers and environment-restricted Firebase, Maps, Places, deep-link, API, and OAuth configuration so they cannot impersonate production.

Before public Android release, the project adopts Google Play App Signing with a separate upload key. EAS may manage the upload credential initially; credential access, recovery, rotation, and off-repository backup procedures are documented and tested before submission. The app-signing key remains under Google Play's signing service, while loss or compromise of the upload key follows the supported upload-key reset process.

If EAS Update is enabled during production-readiness work, development, preview, and production use separate channels and environment configuration. The project follows Expo's supported `appVersion` runtime policy and adds a CI guard requiring the application/runtime version to change when native code, native dependencies, permissions, plugins, or runtime-affecting configuration changes. Every production update is first exercised against a preview build of the same compatible runtime, then receives protected human approval and a staged rollout with a tested rollback path.

An over-the-air update may change only compatible JavaScript and assets. It MUST NOT be used to bypass store review or signed-build verification for native capabilities, permissions, background execution, security boundaries, privacy disclosures, data migrations that cannot safely roll back, or any change that the installed runtime cannot support. The embedded signed update remains a recoverable baseline.

### 3.9 Cloud Run service topology and privilege isolation

The same reviewed container image supports two explicit process roles. The API entry point exposes only interactive product endpoints and uses an API-specific user-managed service identity. The worker entry point exposes only authenticated operational endpoints for Cloud Tasks and Cloud Scheduler and uses a separate worker identity. Neither role dynamically switches based on request input, and a deployment fails its health check if its configured role does not match the expected entry point.

The API is internet-reachable because the mobile application must call it, but every protected operation still requires a valid product session, ownership authorization, runtime validation, and the applicable idempotency rule. The worker service denies unauthenticated invocation and accepts only Google-signed invocation from explicitly authorized Cloud Tasks and Cloud Scheduler principals or service accounts. An opaque worker URL or header is not treated as authentication.

The API identity receives only the secrets and Google permissions required for interactive API behavior. The worker identity separately receives only the queue, scheduling, notification-delivery, and secret access required for approved jobs. Neither runtime identity can deploy infrastructure, modify IAM, read Terraform state, or act as the CI deployment identity. API and worker maintain separate concurrency, timeout, maximum-instance, database-connection, alert, and health settings while remaining at zero minimum instances for the personal MVP.

### 3.10 Server validation and HTTP-contract ownership

Concrete NestJS DTO classes define HTTP request shapes and use a globally configured `ValidationPipe` with transformation only where explicitly safe. Unknown properties are rejected or stripped according to one documented global policy, prohibited values never appear in validation error targets or logs, and identifiers, arrays, enums, timestamps, pagination, and bounded strings receive explicit validation. Route/query parsing uses concrete pipes or DTOs rather than TypeScript interfaces erased at runtime.

NestJS DTO metadata produces the reviewed OpenAPI document. Continuous integration generates the TypeScript mobile client from that document and fails when generated output is stale or when an unreviewed breaking contract change appears. Handwritten mobile transport types and handwritten copies of server DTOs are prohibited.

OpenAPI and generated TypeScript provide a transport contract, not trust. The mobile app runtime-validates untrusted external responses where a malformed value could cross a security, privacy, persistence, navigation, or native boundary. The server independently applies authenticated ownership, business invariants, coordinate prohibitions, idempotency, and persistence rules after DTO validation. Zod mobile/form schemas may shape user interaction but do not become a competing API or domain source of truth.

### 3.11 Database migration execution

Drizzle schema definitions generate versioned SQL migration files, but an engineer or agent reviews the actual SQL before merge. Continuous integration applies the complete migration chain to an empty PostgreSQL database and applies the proposed migration from the repository's previous schema state. Tests then run schema, ownership, RLS, retention, coordinate-prohibition, and application compatibility checks.

Database migration is a distinct protected deployment job using a dedicated least-privilege migration identity. It runs once before application rollout, uses PostgreSQL/Drizzle migration locking or an equivalent single-migrator guarantee, records the immutable migration identity and result without semantic user data, and stops deployment on failure. API or worker container startup MUST NOT apply migrations, and production MUST NOT use `drizzle-kit push`.

Production changes follow expand/migrate/contract when an old and new application revision may overlap: add backward-compatible structures, deploy compatible code, backfill through bounded resumable work where required, verify, and remove obsolete structures only in a later approved release. Table rewrites, column drops, destructive type changes, ownership/RLS changes, or retention-affecting changes require an explicit recovery plan, verified backup, isolated rehearsal, expected lock/runtime analysis, and protected approval. Rollback means an approved forward recovery or a proven compatible reversal; it is never assumed that arbitrary SQL can safely be undone.

### 3.12 HTTP adapter and container hardening

The MVP uses NestJS's default Express adapter because its compatibility, middleware ecosystem, and operational familiarity matter more than unmeasured framework throughput for this database- and provider-I/O-bound personal workload. Application modules avoid unnecessary direct Express dependencies so the adapter remains replaceable. Before public production, load tests measure representative interactive and worker traffic, cold starts, memory, latency percentiles, and database/provider saturation. Fastify is the pre-approved candidate only if HTTP-adapter overhead is material and compatibility tests pass; optimization after the MVP is expected where evidence justifies it.

One multi-stage Docker build produces the API/worker OCI image. The build stage compiles and tests from the locked dependency graph; the runtime contains only compiled output, production dependencies, required trust certificates, and runtime metadata. The runtime uses an approved maintained minimal Node base pinned by immutable digest, runs as a numeric non-root user, has no source maps containing sensitive source paths unless access is controlled, and excludes compilers, package managers, repository history, credentials, test fixtures, and development tools.

The container handles termination signals, stops accepting new work, drains only within the Cloud Run termination window, and exits deterministically. Filesystem writes are limited to bounded ephemeral paths because Cloud Run filesystem data is in-memory and non-durable. Builds emit an SBOM, run dependency and image vulnerability scans, preserve artifact provenance, and promote the same immutable digest from preview to production rather than rebuilding unreviewed source.

### 3.13 Local development and provider simulation

Repository-owned Docker Compose starts only the pinned development PostgreSQL and Supabase Auth services through a Docker-compatible runtime. Every published port is explicitly mapped to `127.0.0.1`, and the wrapper verifies both the resolved configuration and running bindings. This project-scoped boundary MUST NOT change Docker Desktop's global port-binding behavior or affect another Docker project. The pinned project-local Supabase CLI remains available for provider-standard migration tooling; it does not own local container startup. Local configuration, migration inputs, RLS policies, and non-sensitive deterministic seed fixtures are versioned; generated local credentials and runtime data are not. The local stack MUST NOT be exposed as a production or shared internet service.

Places, Maps-link resolution, FCM transport, Cloud Tasks, and Cloud Scheduler sit behind application-owned interfaces. Ordinary unit, component, integration, and migration tests use deterministic fakes or recorded synthetic contract fixtures containing no real Task, identity, coordinate, destination, token, or provider data. Failure fixtures cover timeout, malformed result, throttling, partial availability, duplicate invocation, retry, and permanent rejection without contacting a paid provider.

Fakes prove application behavior but never count as provider evidence. Controlled preview tests use restricted non-production credentials, hard quotas, synthetic locations/data, and dedicated test devices to verify actual Supabase OAuth, Google Maps/Places, FCM, Cloud Tasks, and Scheduler integration. Tests that can consume quota or mutate a hosted environment are clearly labeled, excluded from the default local test command, and require an explicit environment and authorization.

### 3.14 Code-quality and dependency policy

Every TypeScript project uses strict mode. The root ESLint flat configuration applies TypeScript-aware recommended safety rules with narrow documented per-environment overrides; application code does not suppress a rule without a local reason. Prettier owns formatting and `eslint-config-prettier` prevents formatting rules from competing with semantic linting.

One repository command runs formatting verification, ESLint, TypeScript compilation/type checking, unit and integration tests appropriate to the current environment, generated-code drift checks, and other deterministic static gates. GitHub Actions invokes the same underlying scripts rather than reimplementing them in workflow YAML. CI is the merge authority; mandatory Husky/lint-staged hooks are not installed during bootstrap. Developers and agents may use editor/save hooks or targeted commands, but a local hook cannot replace or weaken CI.

The npm lockfile is committed and reviewed. Dependabot groups routine compatible updates, while security updates may be isolated for faster review. Dependency changes require a stated use, maintenance/security/license check proportionate to risk, lockfile review, tests, and removal of obsolete packages. Automated audit output is triaged rather than blindly ignored or blindly forced into breaking upgrades. Unused-dependency tooling and mandatory pre-commit hooks are added only if repository evidence shows they provide more signal than configuration burden.

### 3.15 Runtime geography and data placement

The personal MVP uses Supabase's specific Singapore region, AWS `ap-southeast-1`, and deploys Cloud Run, Cloud Tasks, Artifact Registry, regional Scheduler resources where applicable, and region-selectable application logs or secrets in Google Cloud `asia-southeast1` whenever the service supports that placement. Using the exact Supabase region rather than a broad APAC selector makes the initial primary database location explicit.

Singapore is the closest practical common Supabase and Google Cloud location to the initial user in the Philippines. Google-only regions that may be geographically nearer do not improve the complete request path when the authoritative Supabase database remains elsewhere. Colocation means common metropolitan region, not common cloud network or availability zone: the application still measures TLS connection setup, query latency, egress, cold starts, and provider availability across Google Cloud and AWS.

This placement governs app-controlled primary data but does not claim that every external processor, notification network, OAuth provider, map provider, user-controlled backup, or support system processes data only in Singapore. Before public production, the promotion review reassesses the user population, legal/data-residency obligations, provider contracts, measured latency and egress, disaster recovery, database migration feasibility, and whether one region remains acceptable. A region move requires a protected migration plan and verification of deletion/retention boundaries in the former region.

### 3.16 Personal-MVP access and public abuse protection

The personal MVP production environment accepts product access only for the owner's explicitly configured Google-authenticated identity. The allowlist is enforced server-side after valid OAuth/OpenID Connect and Supabase session verification and before user data access or expensive work. Development and preview use separate projects, credentials, application identities, and controlled synthetic test accounts so multi-account authorization testing does not broaden production-MVP access. A rejected identity receives no product data, provider work, or partially provisioned usable account.

The MVP still enforces bounded request bodies, parsing depth and collection sizes, timeouts, authentication, ownership, idempotency, endpoint-specific concurrency, conservative Cloud Run maximum instances and database connections, and hard quotas/budgets on provider-backed operations. The owner allowlist does not excuse validation or make the API trusted. It avoids paying for and operating a public load balancer/WAF before public access exists.

Before public registration is enabled, the allowlist is replaced—not merely removed—by distributed application-layer limits keyed primarily by authenticated account and expensive operation, with careful treatment of shared IPs and privacy. Cloud Run moves behind an approved external application load balancer and Cloud Armor Standard or a reviewed equivalent. Rate and WAF rules start in preview mode, use content-free operational evidence, return appropriate bounded failures such as `429`, and are tuned before enforcement. Authentication, account creation, location/provider evaluation, export, deletion, and other high-cost or high-risk endpoints receive explicit abuse cases. Edge controls supplement rather than replace authorization, application quotas, provider quotas, validation, and cost shutdown controls.

### 3.17 Future AI interpretation boundary

No AI provider, model, SDK, prompt framework, vector database, or embedding store is added for the MVP. Structured manual Task capture remains complete and authoritative. When AI-assisted capture becomes active production work, an application-owned gateway compares eligible providers and current model versions using representative synthetic and privacy-reviewed evaluations for structured-output validity, clarification quality, latency, availability, retention/training terms, security controls, geographic processing, and total cost. Provider selection is a replaceable implementation decision recorded only then.

The gateway may send only the current user-submitted capture text or transcription and the minimum approved abstract vocabulary needed to interpret it. It MUST NOT send exact coordinates, stored addresses, provider place identifiers, authentication data, unrelated Tasks, retained history, notification history, or an account-wide profile. The UI discloses that user-authored capture content may itself be sensitive and is sent to the selected processor. Provider configuration must prohibit training on product content and use the shortest enforceable retention or verified zero-data-retention mode compatible with operation.

The model returns a schema-constrained `InterpretationProposal`: proposed Task fields, Context/tool kinds and parameters, confidence/ambiguity signals, and narrowly scoped clarification requests. It cannot call geofencing, maps, weather, calendars, notifications, persistence, or user-data APIs. Deterministic application code validates the proposal against the canonical domain, authorization, privacy, platform, and cost rules before presenting or applying it. Confirmation remains the default; the approved automatic mode may bypass the confirmation screen only after the same validation and ambiguity gates, and every saved result remains visible, editable, and reversible as the Product Spec requires.

Prompts and raw model responses are transient processor inputs and MUST NOT enter ordinary logs, analytics, crash monitoring, or long-term evaluation storage. Product operation, existing Tasks, and manual capture remain available when the provider is disabled, unavailable, over budget, or fails validation. A provider/model change must rerun the approved evaluation set and cannot silently change tool authority or product semantics.

Relevant implementation references:

- [Expo versions](https://docs.expo.dev/versions/latest/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Expo unit testing with Jest](https://docs.expo.dev/develop/unit-testing/)
- [EAS build profiles](https://docs.expo.dev/build/eas-json/)
- [EAS runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)
- [EAS Update deployment](https://docs.expo.dev/eas-update/deployment/)
- [Expo application credentials](https://docs.expo.dev/app-signing/app-credentials/)
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Expo local-storage guidance](https://docs.expo.dev/develop/user-interface/store-data/)
- [Expo SQLite and SQLCipher](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Android geofencing](https://developer.android.com/develop/sensors-and-location/location/geofencing)
- [Android 17](https://developer.android.com/about/versions/17)
- [Android API-level mapping](https://developer.android.com/guide/topics/manifest/uses-sdk-element.html)
- [Google Play target API requirements](https://developer.android.com/google/play/requirements/target-sdk)
- [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/)
- [Android application signing](https://developer.android.com/studio/publish/app-signing)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Expo notification-provider options](https://docs.expo.dev/guides/using-push-notifications-services/)
- [Firebase Admin SDK message sending](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk)
- [Cloud Run service identity](https://docs.cloud.google.com/run/docs/configuring/services/service-identity)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Google authentication](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase pricing and plan boundaries](https://supabase.com/pricing)
- [Supabase available regions](https://supabase.com/docs/guides/platform/regions)
- [Google Places Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [Google Places SDK for Android Autocomplete (New)](https://developers.google.com/maps/documentation/places/android-sdk/place-autocomplete)
- [`react-native-maps` Expo installation](https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md)
- [Google Maps Platform API security practices](https://developers.google.com/maps/api-security-best-practices)
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Cloud Logging buckets and retention](https://docs.cloud.google.com/logging/docs/buckets)
- [Google Cloud Scheduler](https://docs.cloud.google.com/scheduler/docs/overview)
- [Google Cloud Scheduler pricing](https://cloud.google.com/scheduler/pricing)
- [Google Cloud Tasks pricing](https://cloud.google.com/tasks/pricing)
- [Google Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Google Cloud Run locations](https://docs.cloud.google.com/run/docs/locations)
- [Google Cloud Armor rate limiting](https://docs.cloud.google.com/armor/docs/rate-limiting-overview)
- [Google Cloud Armor pricing](https://cloud.google.com/armor/pricing)
- [GitHub Actions OIDC for Google Cloud](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-google-cloud-platform)
- [GitHub dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review)
- [Terraform GCS backend](https://developer.hashicorp.com/terraform/language/backend/gcs)
- [Terraform configuration style](https://developer.hashicorp.com/terraform/language/style)
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing)
- [NestJS validation](https://docs.nestjs.com/techniques/validation)
- [NestJS Express and Fastify performance guidance](https://docs.nestjs.com/techniques/performance)
- [Maestro for React Native](https://docs.maestro.dev/platform-support/react-native)
- [TanStack Query for React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
- [Zod](https://zod.dev/)
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
- [Supabase CLI local development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Type-aware typescript-eslint](https://typescript-eslint.io/getting-started/typed-linting/)
- [Prettier installation and linter integration](https://prettier.io/docs/install)
- [Cloud Run container runtime contract](https://docs.cloud.google.com/run/docs/container-contract)
- [OpenAI API data controls as one future-provider example](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)
- [EAS pricing](https://expo.dev/pricing)

## 4. Planned technical data model

The current model contains these technical entities:

- users
- tasks
- task_contexts
- task_occurrences
- devices
- anchor_references containing opaque identity, Saved Place classification, and non-coordinate state only; production may add end-to-end encrypted coordinate ciphertext but never a service-readable coordinate or key
- specific_destination_references containing opaque identity, arrival transition, and non-coordinate state only; production may add an end-to-end encrypted target payload containing coordinate and sensitive display metadata, but never service-readable plaintext or a key
- evaluation_events
- opportunity_evaluations
- notifications
- notification_tasks
- notification_actions
- notification_outbox

Important properties include:

- Every user-owned record has an enforceable owner.
- Contexts are one-to-many from Task even though the MVP UI remains constrained.
- Evaluation Events and notification records have idempotency identities.
- A one-off Scheduled Reminder and Deadline store their immutable instant and creation timezone; recurrence and Quiet Hours store civil calendar/time fields; Task Occurrences have logical identities independent of duplicate scheduler delivery.
- Snooze stores its authoritative start, selected elapsed duration, and immutable due instant; cooldown stores its authoritative start and elapsed expiry.
- Recurring completion defers successor materialization until its immediate Undo affordance closes and commits idempotently; cross-restart Undo is not required. One-off completion records the 30-day Reopen boundary without treating that boundary as Task deletion.
- The MVP server schema has no raw-coordinate or geographic-point fields; Saved Place and Specific Destination coordinates exist only in protected device storage and Current-location Snapshots exist only in transient request processing.
- The local SQLCipher schema contains all structured local state, while its random key and authentication/session secrets exist only in SecureStore. Neither the local database nor its key participates in Android backup or device transfer.
- Production precise-location synchronization stores ciphertext only; decryption keys are absent from server schemas, secrets, logs, and backups.
- Cloud Place Capability history stores capability and Outcome only; business results from Find Nearby are transient and have no persistence entity.
- Raw location is not retained; privacy-safe derived reason codes carry canonical retention timestamps and follow FR-179.
- Notifications can contain multiple Tasks without merging their completion state.
- A Notification delivery envelope retains the complete ordered Task association server-side while exposing at most three semantic preview rows and the remaining count under PRIV-019. The opaque open-routing reference grants no additional access without authentication and ownership authorization; action identifiers belong only to authenticated in-app action records and are not MVP push controls.
- An Evaluation Episode identity supports deduplication.
- Queue records distinguish Retry Exhausted from settlement and carry canonical original, settlement, and expiry timestamps. Purge jobs delete entire settled transport entries within 24 hours and no later than the underlying deadline, remove action recovery entries at 30 days, and enforce seven-day Event, seven-day derived-history/log, and 30-day backup boundaries without resetting clocks on retry or restore.

The final schema and migration design MUST follow resolved retention, precise-target storage, recovery, recurrence, temporal, and occurrence decisions. This list is not an alternative product domain model.

## 5. Repository strategy

The intended repository organization is:

    ayaw-kalimti/
    ├── apps/
    │   ├── mobile/
    │   │   ├── app/
    │   │   └── src/
    │   │       ├── features/
    │   │       │   ├── tasks/
    │   │       │   ├── places/
    │   │       │   ├── geofencing/
    │   │       │   └── notifications/
    │   │       ├── background/
    │   │       ├── database/
    │   │       └── services/
    │   └── api/
    │       └── src/
    │           ├── entrypoints/
    │           │   ├── api.ts
    │           │   └── worker.ts
    │           ├── modules/
    │           │   ├── tasks/
    │           │   ├── contexts/
    │           │   ├── opportunities/
    │           │   ├── places/
    │           │   ├── notifications/
    │           │   └── devices/
    │           └── shared/
    ├── packages/
    │   ├── api-client/
    │   ├── contracts/
    │   └── config/
    ├── database/
    │   └── seeds/
    ├── supabase/
    │   ├── config.toml
    │   ├── migrations/
    │   └── seed.sql
    ├── infra/
    │   └── terraform/
    │       ├── bootstrap/
    │       ├── environments/
    │       │   ├── development/
    │       │   ├── preview/
    │       │   └── production/
    │       └── modules/
    ├── docs/
    │   ├── decisions/
    │   ├── privacy/
    │   └── runbooks/
    └── .github/workflows/

## 6. Implementation rules

- Every device Evaluation Event MUST carry an idempotency key.
- Mobile OAuth MUST use Authorization Code with PKCE through an approved native provider surface or external user agent, validate the callback, and exchange the code once.
- Google provider tokens MUST NOT be persisted when only identity is required; the Supabase product session belongs in operating-system-protected storage.
- Every retryable user action MUST carry an idempotency key.
- Every retained Event, action, evaluation, Notification, feedback item, log, and queue entry MUST carry or derive an immutable canonical retention start and expiry. Retry, replay, refresh, and restore MUST NOT move it.
- Recurrence handlers MUST derive a stable logical slot identity from the civil rule and selected local occurrence, resolve a DST gap to the first valid instant, choose the earlier valid instant in a fold, skip recurrence slots crossed by a forward manual-clock jump, and prevent a backward clock change from duplicating a slot.
- One-off Scheduled Reminders and Deadlines MUST persist an immutable instant plus creation timezone; cooldown and Snooze MUST use elapsed time; Quiet Hours MUST use current-device local wall time.
- A recurring completion MUST NOT materialize its successor until the immediate Undo affordance closes. Task deletion MUST invalidate recovery and delayed work before eligibility can resume.
- An Evaluation Episode identity MUST bound per-Task duplicate suppression.
- Eligibility and notification-outbox creation MUST use a transaction or an equivalent atomic mechanism.
- Bundling occurs after individual Task candidate selection.
- Rejected Opportunity Evaluations SHOULD use structured reason codes rather than verbose sensitive logs.
- Google Places MUST NOT be called when no Active Task requires Place Capability evaluation.
- One Place Capability Episode MUST share one Current-location Snapshot and at most one provider search/result set per distinct Effective Place Query across applicable Tasks.
- Place results MUST NOT be persisted or retained beyond their Evaluation Episode or explicit Find Nearby interaction. Find Nearby performs a fresh transient request for each interaction.
- Find Nearby MUST remain isolated to the selected Task and capability and MUST NOT create an Evaluation Event, Episode, Opportunity, Notification, or global fan-out.
- Place requests MUST use only necessary response field masks.
- Specific Destination capture MUST NOT scrape arbitrary pages or search private listing content; an unresolved map link falls back to explicit user selection or confirmation.
- Specific Destination map and autocomplete integrations MUST remain behind application adapters. Address queries, candidate lists, provider place identifiers, and coordinates travel device-to-provider only and MUST NOT enter backend requests, logs, analytics, or telemetry.
- Google map and Places credentials MUST be environment-separated, API-restricted, Android-package-and-signing-certificate-restricted, quota-limited, and monitored. Autocomplete MUST use fresh session tokens and minimum fields.
- Scheduler, task-queue, and notification handlers MUST be idempotent.
- FCM send responses and token errors MUST be checked. Retained delivery diagnostics are limited to opaque message identity, status, timestamp, and sanitized error code; semantic payload content is prohibited in telemetry.
- Invalid device tokens MUST be disabled.
- Transient delivery failures SHOULD use bounded retry with backoff.
- Retry exhaustion MUST follow RULE-040 and REL-014; a failed push is not manually resent, a manual location recovery uses a fresh Episode and Snapshot, and a still-applicable queued user action preserves its idempotency identity only through its 30-day lifetime.
- Purge and backup-restore workers MUST enforce FR-179 and PRIV-020, treat Retry Exhausted as unsettled only while replay remains authorized, and prevent resurrection of expired or explicitly deleted state.
- A successful FCM response or message identifier MUST NOT be labeled as proof of device delivery, user receipt, or viewing.
- MVP and the current production baseline MUST use Detailed Notification Previews under PRIV-019 and SEC-015. Push payloads may contain only the frozen set of at most three displayed Task-title/reason rows, total or remaining count, opaque open-routing reference, and necessary delivery/grouping metadata. Full membership and action identifiers stay server-side; prohibited precise destination and business fields remain excluded.
- Application logs and mobile diagnostics MUST use an explicit field allowlist, preserve the seven-day ceiling, and exclude semantic content, precise or derived location, destination/provider data, credentials, tokens, request bodies, screenshots, and replay.
- Google Cloud deployment MUST use GitHub OIDC and Workload Identity Federation with least-privilege identities; static service-account keys are prohibited.
- Terraform state MUST use the protected remote GCS backend and MUST NOT be committed. Secret values SHOULD bypass Terraform plans and state when the resource can reference a separately supplied Secret Manager version.
- CI workflows MUST default to read-only permissions, pin third-party actions to immutable full commit SHAs, prevent untrusted code from receiving secrets or deployment identity, and require protected-environment approval for production apply or release.
- Route, deep-link, notification-routing, OAuth-callback, form, map-link, and provider input MUST be treated as untrusted and runtime-validated before use. Navigation alone MUST NOT authorize data access or mutation.
- TanStack Query MUST remain a remote-state coordinator only; SQLCipher and the approved idempotent queue own durable device state and replay. Automatic mutation retries are prohibited unless the operation follows its approved idempotency policy.
- A global mobile state library MUST NOT be added until a documented state-ownership problem demonstrates that local React state, narrow Context, TanStack Query, SQLCipher, and the authentication client are insufficient.
- MVP completion MUST NOT depend on a public-store release pipeline or EAS Update. Production OTA publication, if enabled later, requires runtime compatibility, preview verification, protected approval, staged rollout, and rollback; native and security-boundary changes require a new signed build.
- API and worker deployments MUST use fixed, separate entry points, service identities, invocation policies, scaling/connection budgets, and health checks even though they share one image. The private worker MUST authenticate Cloud Tasks and Scheduler invocation through Google IAM rather than a shared secret or obscure URL.
- Every API request boundary MUST use concrete runtime-validatable NestJS DTOs or pipes. DTO validation MUST precede domain work but MUST NOT be treated as ownership authorization, domain validation, or permission to persist.
- The NestJS-generated OpenAPI document is the HTTP-contract source; the mobile client is generated and checked for drift. Handwritten duplicate API transport models are prohibited.
- Production migrations MUST run as a protected singleton deployment job from reviewed versioned SQL. API/worker startup migration and production `drizzle push` are prohibited; destructive or incompatible changes require expand/migrate/contract sequencing and explicit recovery evidence.
- Application modules SHOULD depend on NestJS abstractions rather than Express-specific request/response objects. Moving to Fastify requires measured post-MVP benefit plus complete adapter-compatibility, contract, and regression evidence.
- Production containers MUST be multi-stage, minimal, non-root, digest-pinned, scanned, provenance-linked, and free of build tools, development dependencies, credentials, and repository material. API and worker deployments promote the same reviewed digest.
- Ordinary local and CI tests MUST use the pinned local Supabase stack and deterministic provider fakes. Real-provider tests require an explicit preview environment, synthetic data, restricted credentials, and quotas and MUST NOT run as an implicit side effect of the default test command.
- TypeScript strict mode, type-aware ESLint, Prettier verification, generated-code drift, and applicable tests MUST block merge through reproducible repository scripts. Git hooks remain optional and MUST NOT be the only enforcement point.
- Personal-MVP primary data and regional Google workloads MUST use the approved Singapore placements where supported. Public release or a region move requires a new measured residency, latency, egress, contractual, recovery, and deletion review.
- The production-MVP API MUST enforce the configured owner identity allowlist after valid authentication and before product access or expensive work. Development/preview test identities MUST remain isolated from production. Public registration MUST NOT open until distributed application limits and reviewed edge/WAF controls replace the allowlist.
- AI interpretation MUST remain absent from the MVP and behind an application-owned provider-neutral gateway later. A model may propose only schema-constrained configuration and clarification; deterministic authorized code alone validates, persists, and invokes tools.
- Future AI provider input MUST be minimized to the current capture and approved abstract vocabulary, exclude precise targets, unrelated user data and credentials, and use verified no-training and minimum-retention controls. Prompts and raw responses MUST NOT enter ordinary telemetry or retained product history.

## 7. Verification strategy

- Unit tests cover Task lifecycle and recovery, fixed-instant and current-local scheduling, DST gaps/folds, elapsed timers, Context OR matching, gates, and action idempotency.
- API integration tests use at least two accounts to verify isolation.
- Authentication tests cover valid, cancelled, failed, tampered, replayed, over-scoped, signed-out, and expired-session flows.
- Contract generation is checked in continuous integration.
- Database tests cover transactions, logical occurrence uniqueness, migrations, every retention boundary and purge job, queue settlement, backup-restore filtering, and irreversible deletion.
- Local-storage tests inspect the physical database and journals for plaintext leakage, verify SQLCipher migrations, Android backup exclusion, locked-device background access without biometric prompts, logout/deletion cleanup, key invalidation, corruption recovery, and refusal to fall back to plaintext.
- Mobile component tests cover structured capture, health states, and actions.
- Jest is the primary repository test runner. `jest-expo` and React Native Testing Library cover mobile units/components, ordinary Jest covers shared/domain units, and NestJS testing utilities plus Supertest cover API modules and HTTP boundaries.
- Maestro covers a small set of critical bundled-application flows such as authentication handoff, Task capture, visible notification-detail navigation, and destructive confirmation. It does not attempt to simulate proof that belongs to the physical-device matrix.
- Test boundaries explicitly verify that route parameters, deep links, notification routes, OAuth callbacks, map links, API responses, and form inputs cannot bypass runtime validation, ownership, or authorization.
- The geofencing proof gate runs before the region-monitoring library is promoted and publishes a device/scenario result matrix plus the explicit keep-or-activate-fallback decision.
- Deployment checks verify the personal MVP's zero-minimum Cloud Run configuration, conservative maximum instances and database connections, three-or-fewer shared Scheduler jobs, service quotas, budget alerts, and current free-allowance assumptions. Crossing a no-charge boundary fails closed where the provider supports a hard quota and otherwise requires an explicit owner decision.
- Backup verification checks weekly encrypted export creation, separate key handling, 30-day expiry, absence of plaintext remnants, and a successful isolated restore drill at least monthly.
- Push verification covers native token registration and rotation, direct FCM sending through a least-privilege Cloud Run service identity, absence of static service-account keys, payload minimization, invalid-token disabling, bounded retry, and the distinction between provider acceptance and user receipt.
- Destination-capture verification covers adapter isolation, Google-key restrictions for every build environment and signing identity, minimum-field and session-token behavior, direct device-to-provider traffic, no backend or telemetry leakage, recognized-link validation, cancellation cleanup, and manual-pin fallback.
- Observability verification inspects Cloud Logging routing and seven-day retention, exercises the log-field allowlist and redaction tests, confirms mobile diagnostics expire from SQLCipher, and proves that ordinary MVP use sends no hosted crash, replay, screenshot, trace, or product-analytics stream.
- CI and infrastructure verification covers Terraform formatting, validation, static/security checks, provider lockfile consistency, reviewable plan output, protected apply, remote-state locking/versioning/access controls, drift reporting, GitHub OIDC claim restrictions, least-privilege service accounts, secret isolation, immutable Action pins, and denial of secrets to untrusted fork code.
- Production-readiness verification, outside MVP completion, covers separate application identities and provider credentials, EAS upload-credential recovery, Play App Signing, runtime-version CI enforcement, preview-to-production environment isolation, staged EAS Update rollout, rollback to a known compatible update or embedded update, and refusal to publish native-incompatible changes over the air.
- Service-topology tests prove that API and worker images start only in their declared role, worker endpoints reject public/invalid invocation, API identity cannot send notifications or administer queues unless explicitly required, worker identity cannot deploy or administer infrastructure, and independent limits prevent worker pressure from consuming the API connection budget.
- Contract tests cover global DTO validation, unknown and malformed fields, bounded input, sanitized errors, generated OpenAPI/client drift, backward compatibility, malicious route/query/body values, and the fact that valid DTOs still fail without ownership or domain authorization.
- Migration tests apply every migration from empty and previous schema states, enforce single execution, exercise interrupted and failed migration handling, reject prohibited coordinate columns, validate RLS/ownership/retention, and rehearse every destructive production change with its approved recovery path.
- HTTP-adapter verification runs representative load tests before public production and changes adapters only when measured application-level benefit survives compatibility, contract, memory, and cold-start comparison.
- Container verification inspects the final image user, layers, dependency set, exposed contents, signal behavior, bounded ephemeral writes, SBOM, vulnerability result, provenance, and preview-to-production digest identity.
- Local-development verification rebuilds the database/Auth environment from versioned configuration and migrations, proves that default tests make no provider calls, exercises fake failure modes, and runs separately authorized synthetic preview contracts against each real integration.
- Code-policy verification runs the same root check scripts locally and in CI, rejects stale generated output and formatting/lint/type errors, reviews lockfile-only and dependency changes, and confirms no merge depends solely on a bypassable local hook.
- Regional verification records the exact Supabase and Google resource regions, measures the cross-cloud path from Philippine test networks, checks region-selectable logs/secrets/backups, and prevents an unreviewed Terraform or provider change from moving app-controlled primary data.
- Access-control verification signs in as the allowlisted owner, a non-allowlisted valid Google identity, signed-out and tampered identities, and isolated preview test accounts; only the owner reaches production-MVP product data or expensive work. Public-promotion tests exercise distributed account/endpoint limits, Cloud Armor preview then enforcement, shared-IP behavior, provider quotas, `429` handling, and cost containment.
- Future AI acceptance uses synthetic and privacy-reviewed cases to test schema validity, minimal clarification, malicious or instruction-like capture text, missing/ambiguous details, provider outage and budget exhaustion, no direct tool authority, deterministic validation, default confirmation, automatic-mode equivalence, editability, prohibited-data absence, telemetry absence, and provider/model replacement regression.
- The resolved Android build manifest MUST declare effective `minSdkVersion = 30`; release verification inspects the built manifest and confirms the application is rejected below API 30.
- Physical tests on both Android 11/API 30 and the current Android platform cover Saved Place and Specific Destination geofences, permissions and revocation recovery, process termination, restart, offline queues, delayed transitions, travel, DST where reproducible, and forward/backward manual-clock changes.
- Capacity tests verify the 20-destination MVP limit, visible overflow, deterministic unregistering, Reopen re-registration, recurring retention, and no silent eviction.
- Recovery tests cover immediate Undo, the one-off 30-day boundary, recurring successor materialization, concurrent Done/Undo, and deletion with delayed work.
- Retention tests cover 24-hour visibility, seven-day active-history/log/Event limits, whole settled transport-entry cleanup, 30-day action and backup limits, clock non-renewal, and prohibited restoration.
- Dependency-failure tests cover Places, push, database, task queue, and scheduler behavior.
- Security verification covers local storage, built artifacts, secrets, authorization, deletion, and telemetry redaction.


## 8. Technical-decision status

The production-track mobile/backend boundaries and technology baseline are approved. The technology-stack grill closed in version 0.1.6 with no remaining owner-level stack question. A row marked Provisional, Alternative, Deferred, pending, or verified during bootstrap identifies an evidence gate or future scope boundary, not an unasked owner decision.

Version 0.1.6 confirms Singapore as the initial common runtime/data region, restricts the production MVP to the owner's authenticated identity while deferring paid public edge protection, and approves a provider-neutral, deterministic future AI interpretation boundary without selecting or adding an MVP provider.

Exact dependency versions, database connection budgets, container base digest, provider quotas, and geofencing-library promotion remain evidence-based bootstrap, release-verification, or spike outcomes. Any discovery that would change approved product behavior, privacy, scope, or these architecture boundaries enters change control rather than silently reopening the completed grill.

## 9. Change log

| Version | Date | Change | Effect |
|---|---|---|---|
| 0.1.0 | 2026-08-21 | Transferred the complete technical-strategy section from PRODUCT_SPEC.md into the canonical architecture document and recorded the active technology-grill scope. | Documentation ownership change only; no product behavior or approved architectural boundary changed. |
| 0.1.1 | 2026-08-21 | Confirmed SQLCipher for all structured local state with a SecureStore-held non-biometric database key and fail-closed key-loss cleanup; required weekly encrypted off-site logical exports with 30-day expiry and monthly restore drills for Supabase Free; replaced Expo Push with direct Android FCM through Firebase Admin and Cloud Run service identity, with a future direct-APNs adapter. | Closes three technology-grill decisions while keeping MVP recurring service cost at the free-tier level and reducing plaintext, data-loss, static-credential, and third-party payload exposure. |
| 0.1.2 | 2026-08-21 | Approved a reviewable Google-native Android map and address-capture path; selected seven-day Cloud Logging plus explicit protected mobile diagnostics while excluding Sentry from the MVP; confirmed GitHub Actions, Terraform with protected GCS state, Workload Identity Federation, Secret Manager, and baseline supply-chain controls. | Closes the map, observability, and delivery-infrastructure grill branches without changing product behavior or implementation-independent domain language. |
| 0.1.3 | 2026-08-21 | Confirmed Expo Router, TanStack Query, React Hook Form, Zod, and local-first UI-state ownership; standardized tests on Jest with Expo/Nest-specific tooling, Maestro critical paths, and physical-device geofence proof; approved Play App Signing and controlled EAS Update only as deferred production-readiness work. | Closes the mobile-foundation, test-stack, and Android-release branches while keeping store and OTA work outside MVP completion. |
| 0.1.4 | 2026-08-21 | Confirmed separate public API and private worker Cloud Run services from one NestJS image and distinct least-privilege identities; selected concrete NestJS DTOs and global ValidationPipe as the OpenAPI transport-contract source; required reviewed versioned Drizzle SQL through a protected singleton migration job with expand/migrate/contract controls. | Closes runtime isolation, API contract validation, and migration-deployment decisions without splitting the modular monolith or introducing a second domain source of truth. |
| 0.1.5 | 2026-08-21 | Kept Express for the MVP with a measured Fastify review after validation; required a minimal non-root immutable container with SBOM/scanning/provenance; selected pinned local Supabase and deterministic provider fakes with controlled real-integration previews; confirmed strict TypeScript, type-aware ESLint, Prettier, shared check scripts, CI authority, and evidence-gated hooks/tooling. | Closes HTTP/container, local-development, and code-policy choices while preserving optimization work for measured post-MVP needs. |
| 0.1.6 | 2026-08-21 | Selected Supabase Singapore `ap-southeast-1` and Google Cloud Singapore `asia-southeast1`; restricted the production MVP to the owner's allowlisted Google identity and deferred paid load-balancer/Cloud Armor controls until public promotion; approved a provider-neutral schema-constrained AI interpretation gateway with deterministic tool authority and no MVP provider. | Completes the technology-stack grill with a low-latency common region, proportionate personal-MVP attack surface, and a production AI path that cannot replace the domain model or gain direct tool authority. |
| 0.1.7 | 2026-08-22 | Corrected the document-control reference to the approved Product Spec v0.1.25. | Resolves DOC-001 source-version drift; no architecture boundary or product behavior changed. |
| 0.1.8 | 2026-08-22 | Aligned the geofence-adapter constraint with Product Spec v0.1.26: Home and Work/School Anchors use the fixed 300-metre MVP radius. | Implements the resolved product boundary without adding a user configuration surface. |
| 0.1.9 | 2026-08-22 | Updated document control to Product Spec v0.1.27 after its resolved Task-list ordering decision. | Keeps architecture's source reference current; sorting behavior remains owned by the Product Spec. |
| 0.1.10 | 2026-08-30 | Made `supabase/migrations/` the single authoritative location for reviewed PostgreSQL migrations and added the versioned local seed location to the repository strategy. | Aligns the approved SQL migration path with the pinned Supabase CLI replay workflow before application migrations exist; no product behavior or data model changed. |
| 0.1.11 | 2026-08-31 | Replaced Supabase CLI-owned local container startup with repository-owned Docker Compose while retaining the pinned CLI for migration tooling. | Enforces explicit project-scoped `127.0.0.1` service mappings after the CLI-generated containers were observed publishing wildcard host bindings; Docker Desktop global behavior and unrelated Docker projects remain unchanged. |
