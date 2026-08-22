# Ayaw Kalimti Domain Glossary

This glossary defines the canonical product language for Ayaw Kalimti. It contains domain meaning only. Implementation details and release requirements belong in PRODUCT_SPEC.md.

## Core terms

### User

The owner of an isolated Ayaw Kalimti account and its data. A User owns Devices, Tasks, Saved Places, settings, and retained history.

### Device

An authenticated mobile installation with permissions, local queue state, and a push-delivery address. A Device belongs to one User and may become inactive or lose permissions.

### Task

A user-defined statement of work. Every supported item uses the same general Task model rather than a specialized reply, errand, or reminder type.

A Task may be one-off or recurring. It may have zero or more Opportunity Contexts. Completion offers an immediate Undo. A completed one-off Task may be reopened for 30 elapsed days after completion; confirmed deletion is terminal and unrecoverable.

### Unscheduled Task

A Task with no enabled Opportunity Context.

An Unscheduled Task appears in the Task list and may qualify for the fallback digest, but it does not independently create a contextual notification.

“Anytime” MUST NOT be used as the name of an always-true Opportunity Context.

### Opportunity Context

A user-visible condition that may independently make a Task eligible for a notification.

Examples include a Scheduled Reminder, arrival at or departure from a Saved Place, arrival at a Specific Destination, proximity to a relevant Place Capability, and a production weather condition.

Every enabled Opportunity Context on a Task is a sibling evaluated with flat OR semantics: any one Context may match. An Opportunity Context is not a Deadline, a Recurrence rule, an Evaluation Event, or a Hard Gate.

### Flat OR eligibility

The rule that any one enabled Opportunity Context may make a Task eligible.

For example, if “Buy medicine” has Leaving Work OR Near Pharmacy OR Friday at 5 PM, Leaving Work may create eligibility even when no pharmacy is nearby.

Flat OR eligibility does not bypass Hard Gates.

### Hard Gate

A mandatory condition that can suppress notification delivery even after an Opportunity Context matches.

Task completion or deletion, active snooze, Quiet Hours, cooldown, and duplicate suppression are Hard Gates within their defined scopes.

### Quiet Hours

A user-configured interval that silences automatic notifications from Ayaw Kalimti.

Automatic Saved Place, Specific Destination, Place Capability, application-open, manual-check, and fallback-digest notifications respect Quiet Hours. A matching contextual Opportunity is recorded as a Suppressed Opportunity, remains visible through the Recent Opportunity Indicator and Recent Activity, and is not sent later when Quiet Hours end. A later, independent Evaluation Episode after Quiet Hours may notify if every other applicable Hard Gate permits it.

An explicit Scheduled Reminder or Snooze reminder bypasses Quiet Hours because the user deliberately selected its time.

Quiet Hours use the device's current local wall time, including overnight intervals. A timezone, daylight-saving, or manual-clock boundary creates no Event or catch-up delivery; both instances of a repeated local time have the same Quiet-Hours membership.

### Cooldown

A fatigue-control elapsed-time interval after a notification during which otherwise eligible notifications for the same Task may be suppressed.

The MVP automatic cooldown is one hour per Task. It applies to automatic Saved Place, Specific Destination, Place Capability, application-open, manual-check, and fallback-digest notifications. Those notifications both respect and start the cooldown.

An explicit Scheduled Reminder or a Snooze reminder bypasses both Quiet Hours and the automatic cooldown because it represents a time the user explicitly requested.

Production users can configure their automatic cooldown. Timezone, daylight-saving, and manual wall-clock changes do not shorten, extend, reset, or duplicate an elapsed cooldown.

### Scheduled Reminder

A time-based Opportunity Context. A one-off reminder resolves the selected local date and time in the device timezone used at creation to one immutable instant. A selected time in a daylight-saving gap resolves to the first valid instant afterward; a repeated time uses the earlier of the two valid instants. Later timezone, daylight-saving, or manual-clock changes do not move that instant. Reaching it may make the Task eligible for a notification.

### Deadline

The time by which the user intends the Task to be completed. A Deadline resolves the selected local date and time in the device timezone used at creation to one immutable instant. A selected time in a daylight-saving gap resolves to the first valid instant afterward; a repeated time uses the earlier of the two valid instants. Later timezone or clock changes affect its displayed local representation, not the instant.

A Deadline affects overdue state, urgency, and sorting. The Task list shows overdue Deadline-bearing items first, then future Deadline-bearing items, then no-Deadline items; it uses earliest Deadline, then oldest creation time, then canonical identity as the applicable ordering keys. A Deadline does not independently create a notification. A user who wants notification at the Deadline adds a Scheduled Reminder at that time.

### Recurrence

A rule that creates Task Occurrences on a repeating local-calendar cadence. MVP daily, selected-weekday, every-N-day, and every-N-week rules follow the device's current local date and wall time; day and week intervals are calendar-based rather than fixed 24- or 168-hour durations.

Recurrence is not an Opportunity Context and does not independently create a notification. Each resulting Task Occurrence uses the Task’s enabled Opportunity Contexts. A future, not-yet-created occurrence follows the current device timezone. A nonexistent daylight-saving time resolves to the first valid instant after the gap; a repeated local time creates exactly one occurrence at the earlier valid instant. A forward manual-clock jump skips crossed recurrence slots without catch-up, and a backward change never duplicates an occurrence.

### Task Occurrence

One actionable instance of a recurring Task.

Completing a Task Occurrence does not complete or delete the parent recurring Task. Its completion remains provisional during the immediate Undo affordance; the successor occurrence is not created until that affordance closes. Undo before successor creation restores the same occurrence to Pending. Once the successor exists, the prior completion cannot be undone.

### Completion Undo

The immediate, lightweight reversal offered after completing a one-off Task or recurring occurrence. It restores the same identity and does not replay historical Events or Notifications or restore deleted history. Every automatic cooldown, Evaluation Episode deduplication record, and Digest Acknowledgement that remains valid at restoration time stays effective.

### Reopen

The authenticated action that returns the same completed one-off Task to Active while less than 30 elapsed days have passed since completion. At exactly 30 days it is no longer available. Reopen does not recover a deleted Task or restore historical Events, Notifications, or deleted history. Every automatic cooldown, Evaluation Episode deduplication record, and Digest Acknowledgement that remains valid at restoration time stays effective.

### Location Context Target

The user-facing intention attached to a location-based Opportunity Context. It is exactly one of:

- Saved Place: a reusable meaningful location.
- Specific Destination: one exact Task-bound destination.
- Place Capability: any nearby place capable of satisfying the Task.

Provider place types and taxonomies are internal mappings, not additional user-facing target types.

### Saved Place

A reusable meaningful location explicitly configured by the user, such as Home or Work/School. A Saved Place is backed by an Anchor, which represents its monitored region and transition state.

Arrival at and departure from a Saved Place may be configured as separate Opportunity Contexts.

### Anchor

The domain entity that backs a Saved Place and its operating-system region monitoring. Users reason about Saved Places; the product uses Anchors to register and process transitions. Home and Work/School Anchors use a fixed 300-metre MVP region; users cannot configure it, although testing may tune it.

The MVP supports zero or one Home Anchor and zero or one Work/School Anchor. Both slots are optional. Without an Anchor or location permission, non-location Tasks, Scheduled Reminders, Recurrence, and the Fallback Digest remain usable.

In the MVP, exact Anchor coordinates exist only in application-private protected device storage and the operating system's geofence service. They are never stored in a server database or server backup. Cloud records contain only an opaque Anchor identifier, its Home/Work/School classification, and non-coordinate operational state. Reinstalling the app or changing devices requires the user to re-enter Anchors.

Production may synchronize Anchor coordinates only as end-to-end encrypted ciphertext. Decryption keys remain with the user's devices and are never available to the service. A new device requires approval from an existing device or a user-held recovery key; without either, Anchors must be re-entered. Plaintext coordinates remain prohibited from server persistence.

### Specific Destination

An exact address or map point attached to one Task for an arrival Opportunity, such as a Marketplace pickup point or wedding venue. It is not automatically added to Saved Places.

The MVP permits at most one Specific Destination per Task, supports arrival only, and uses a fixed 250-metre region. The user may set it through address search, a map pin, or a recognized map link. The MVP does not scrape arbitrary pages or search private listing content; if a link cannot be safely resolved to a map point, the user selects the location manually.

The Android MVP monitors at most 20 active Specific Destinations per device. This bounds simultaneous monitoring, not long-term retention, and is testing-tunable but not user-configurable. The app never silently evicts a monitored region: at capacity it shows which Tasks consume slots and leaves the additional destination Context disabled while allowing the Task to retain other Contexts. A one-off destination is unregistered when its Task is completed or deleted. Undoing completion or reopening that Task attempts to re-register the same destination under the ordinary permission, capability, and 20-region rules; lack of capacity leaves the Context visibly disabled and never evicts another region. Any destination is unregistered when removed or replaced or when the user logs out or deletes the account. An enabled recurring Task retains its destination.

Crossing from outside to inside creates one Evaluation Episode and may notify subject to every Hard Gate. Duplicate callbacks, remaining inside after the one-hour cooldown expires, and app restart while still inside do not create another Episode. A confirmed exit rearms the destination. A later re-entry creates a new Opportunity: it is suppressed without catch-up if cooldown is active and may notify if cooldown has expired and every other gate permits it.

In the MVP, the exact coordinate, confirmed destination label, any available address, and map association follow the same device-only protection boundary as an Anchor coordinate. Task details may show them from protected local data, but the original capture query or map link is discarded and the product never invents an address for a pin that has none. Cloud history and authenticated Recent Activity identify only a Specific Destination arrival and contain no label, address, venue, link, or coordinate. A Detailed Notification Preview may show the user-authored Task title and a generic Specific Destination arrival reason, but the product does not add the destination label, address, venue, link, or coordinate. Production may synchronize the point and display metadata only as end-to-end encrypted ciphertext whose keys are unavailable to the service.

### Place Capability

A user-facing description of the kind of nearby place that could satisfy a Task, rather than a fixed destination. Examples include grocery/supermarket, pharmacy, bank/ATM, convenience store, and mall.

The place provider's categories and type codes are implementation details mapped internally to the selected capability. The user is not required to understand or choose from the provider's full taxonomy.

### Applicable Place Capability Task

An Active one-off Task or current Pending Task Occurrence with at least one enabled Place Capability Context.

Notification Hard Gates do not remove it from evaluation; they are applied independently after a Context matches. Completed, deleted, non-current, and disabled work is not applicable.

### Current-location Snapshot

A precise device-location reading requested for one permitted active Place Capability Evaluation Episode.

At most one snapshot is acquired during an Episode and shared transiently across every applicable Task evaluation. One may also be acquired for an explicit Find Nearby interaction and used only for its selected Task and Place Capability. It may be transmitted to the official place provider, directly or through in-memory service processing, but is never persisted in an application or server database, cache, durable queue, log, analytics system, crash report, or backup. It is discarded when the Episode or interaction finishes.

An automatic application-foreground Place Capability Evaluation Episode may start at most once per rolling 15-minute window and only while at least one Applicable Place Capability Task exists. The window begins when the automatic attempt starts even if location acquisition or the provider later fails. A user-initiated manual check and an otherwise-permitted Saved Place transition or Specific Destination arrival evaluation bypass and do not alter that foreground window. Window expiry does not itself start a check, and this evaluation throttle is separate from the per-Task notification cooldown.

### Effective Place Query

The complete set of provider-search inputs that determine whether Tasks can safely share one transient search result set.

For the MVP, the query signature includes the Current-location Snapshot, Place Capability mapping, fixed one-kilometre radius, confirmed-open rule, and requested provider fields. Task identity is not part of the signature. Production also includes each effective radius, business preference or exclusion, and any other approved input that can change the result.

Within one Evaluation Episode, the product performs at most one provider search per distinct Effective Place Query and shares that result set only with the applicable Tasks. Each Task is still matched and gated independently. The Snapshot and results are discarded after the Episode and cannot be reused by a later Episode.

### MVP Place Match

A confirmed-open result compatible with the Task's Place Capability within one kilometre of the Current-location Snapshot.

When more than one result qualifies, the nearest result is used. A closed result, unknown opening status, or no result does not match and does not create an Opportunity. The one-kilometre radius is fixed for MVP users but may be tuned during testing. Production users can customize the radius.

Production uses a global one-kilometre default and permits an advanced per-Place-Capability-Context override from 250 metres through 10 kilometres.

Cloud history and authenticated in-app reasons store only the matched Place Capability and Opportunity Outcome. They do not retain the business name, address, provider place identifier, or distance. A Detailed Notification Preview may name the Place Capability as its reason but does not name the business or expose its address, provider identifier, or distance.

### Find Nearby

A user action on one selected Task and Place Capability that requests one new Current-location Snapshot and performs one fresh transient search for the nearest currently usable result.

Find Nearby is a separate non-Opportunity interaction. It does not create an Evaluation Event or Episode, wake other Tasks, create an Opportunity, or send a Notification. The result is displayed for the current interaction and is not retained in cloud history or other app-controlled persistence. Find Nearby does not reuse an earlier business result because availability and the user's location may have changed.

### Evaluation Event

An observation that causes the product to evaluate one or more Tasks, such as a Saved Place transition, Specific Destination arrival, application-open check, manual context check, or Scheduled Reminder firing.

An Evaluation Event is not necessarily one of the evaluated Task’s Opportunity Contexts.

A sufficiently recent Saved Place transition or Specific Destination arrival, an eligible automatic application-foreground check, and a user-initiated manual check each wake every Applicable Place Capability Task. The triggering Event directly satisfies only Contexts that actually match it. A Scheduled Reminder, Recurrence, Deadline, digest run, cooldown expiry, or passage of time alone does not start a Place Capability evaluation.

A queued location Event remains eligible to produce a Notification only through 15 minutes after its recorded occurrence. Reconnection does not turn it into a new transition. A fresh Place Capability evaluation uses a new Current-location Snapshot rather than a queued coordinate.

After 15 minutes, a directly evidenced Saved Place or Specific Destination match may become an Expired Opportunity, while a Place Capability check that can no longer be performed becomes a Missed Evaluation. This time limit does not apply to queued Done, Snooze, or Not useful actions.

### Opportunity Evaluation

The recorded evaluation of one Task for a particular Evaluation Event, including Context matches, Hard-Gate results, and the resulting Opportunity Outcome. A Context match creates an Opportunity even if a Hard Gate suppresses Notification delivery.

### Evaluation Episode

A logical wake-up boundary that groups duplicate or replayed Evaluation Events for deduplication.

The MVP Episode boundaries are:

- One logical arrival at or departure from an Anchor.
- One logical arrival at a Specific Destination.
- One Scheduled Reminder firing.
- One eligible automatic application-foreground check.
- One user-initiated manual context check.

A place result inherits the Evaluation Episode that caused the place search. Duplicate or replayed observations remain in the same Episode. A later independent Saved Place transition, Specific Destination arrival, Scheduled Reminder, eligible automatic foreground check, or manual check creates a new Episode.

### Opportunity

A detected chance to perform a Task because at least one Opportunity Context matched during an Evaluation Episode.

An Opportunity exists regardless of whether a Notification is submitted. Hard Gates determine the Opportunity Outcome after detection.

### Opportunity Outcome

The result of applying freshness and Hard Gates to a detected Opportunity. It is separate from Notification State.

Important outcomes include:

- Deliverable: every applicable Hard Gate permits a Notification.
- Suppressed Opportunity: a Hard Gate prevents a Notification.
- Expired Opportunity: a directly evidenced location match arrived too late for Notification eligibility.

### Notification State

The delivery lifecycle associated with a Notification, kept separate from the Opportunity Outcome and Task lifecycle. Relevant states include queued, submitted, and failed. A Suppressed or Expired Opportunity has no submitted Notification.

Notification submitted means the Notification was successfully handed to the configured delivery pipeline; it is not proof the user received or saw it. Notification failed means submission or delivery could not be completed.

### Suppressed Opportunity

An Opportunity for which one or more Opportunity Contexts matched but an applicable Hard Gate prevented a Notification.

A Suppressed Opportunity is not a Notification.

### Expired Opportunity

A Saved Place or Specific Destination Context match directly evidenced by a queued transition Event that was processed more than 15 minutes after it occurred.

An Expired Opportunity never sends a catch-up Notification. If its original occurrence remains within the 24-hour visibility window, it sets the Recent Opportunity Indicator and appears in Recent Activity at that original time.

### Missed Evaluation

A permitted evaluation that could not determine whether a Context matched. For example, a stale location Event cannot be used to reconstruct a historical Place Capability search after the user may have moved, and an exhausted place-provider attempt may end before a match can be established.

A Missed Evaluation is not an Opportunity, does not set the Recent Opportunity Indicator, and may appear only as diagnostic detail in Recent Activity or capability health.

### Recent Opportunity Indicator

A compact marker on a Task showing that at least one Opportunity, including an Expired Opportunity, was detected during the last 24 hours.

It does not distinguish Opportunity Outcome or Notification State. A Missed Evaluation or Event Sync Failed result alone does not set it. Those details belong in Recent Activity.

### Recent Activity

The user-visible 24-hour history of detected Opportunities, Opportunity Outcomes, Notification States, Missed Evaluations, Event Sync Failed and other Retry Exhausted results, and user actions.

Recent Activity may explain suppression, expiry, missed evaluation, and delivery state but must not display exact coordinates. Entries use the original occurrence time rather than a later upload time and remain visible for 24 elapsed hours. The underlying approved coordinate-free records may persist for at most seven elapsed days; upload, retry, or replay does not restart either clock.

### Notification

A user-visible communication about one or more eligible Tasks. The MVP operating-system surface uses a Detailed Notification Preview. A single-Task preview identifies the Task and gives a short reason. A same-Episode or Fallback Digest preview supplies every Task-title/reason row when it contains at most three Tasks; above three, it supplies exactly three rows followed by `+N more`, where N is the number of undisplayed Tasks. One Evaluation Episode is never split to avoid this limit.

The only MVP operating-system interaction is tapping the Notification body to open Authenticated Notification Detail. The operating-system surface exposes no app-defined Done, Snooze, or Not useful control, and tapping or dismissing it invokes no Task lifecycle or feedback action. Opening a digest's multi-Task list acknowledges no Task; subsequently opening one specific Task from that list acknowledges only that Task.

### Detailed Notification Preview

The MVP content shown by the operating system and carried through any third-party push provider. Each displayed row contains the user-authored Task title and one concise approved reason. A contextual reason may identify a Scheduled Reminder, Snooze, Saved Place name and transition, generic Specific Destination arrival, or matched Place Capability. A Fallback Digest identifies itself as a digest and uses a concise non-Opportunity reason indicating that each displayed Task remains unresolved; exact copy remains a design detail.

A one-Task contextual Notification supplies one row. A same-Episode group or Fallback Digest with at most three Tasks supplies every row; one with more than three supplies exactly three rows and a `+N more` footer. Tasks with a Deadline sort by Deadline timestamp ascending, placing overdue Tasks first and the nearest future Deadline next; Tasks without a Deadline follow by `Task.created_at` ascending. Equal Deadline timestamps use `Task.created_at` ascending and then canonical `Task.id` ascending; equal no-Deadline creation times use canonical `Task.id` ascending. The selected rows and order are frozen for that delivery envelope and its retries. Only displayed rows, the total or remaining count, an opaque open-routing reference, and necessary delivery and grouping metadata pass through the push provider. Undisplayed Task titles, reasons, identifiers, and the complete membership remain server-side. Tapping opens the complete authenticated list.

The product does not add raw coordinates, an exact address, a Specific Destination label or venue, a map link, a business identity, a provider place identifier, or distance. A user-authored Task title is shown as written and can itself contain sensitive information; the product must disclose that lock-screen and push-provider exposure.

### Generic Notification Preview

An optional privacy-preserving production presentation that may later replace Task and reason content with neutral app copy and minimum non-semantic routing metadata. It does not reveal Task content, a schedule or Deadline, an Opportunity Context or reason, a Saved Place, a Specific Destination, a Place Capability, a business, or other location-derived detail.

It is not an MVP capability. Production privacy-level customization, defaults, and compatible direct actions remain future design work.

### Authenticated Notification Detail

The in-app destination reached by tapping a Notification after the app validates the product session and the user's ownership of the referenced data. It shows every current authorized Task and approved reason associated with the envelope, including rows omitted behind `+N more`, and provides applicable per-Task Done, Snooze, and Not useful controls. Notification routing data grants no access by itself.

### Notification action

A Task-scoped Done, Snooze, Not useful, or approved acknowledgement interaction performed inside the authenticated app. It must be safe to repeat. Tapping or dismissing an MVP operating-system Notification is navigation or operating-system behavior, not a Task action.

### Snooze

A user action that selects an elapsed duration and creates a one-time Scheduled Reminder at the immutable due instant derived when Snooze is accepted.

When that elapsed duration ends, the Task may notify if it remains unresolved even when the original location Context is no longer true. The Snooze reminder bypasses Quiet Hours and the automatic cooldown. Snooze does not remove or rewrite the original Opportunity Contexts, and timezone, daylight-saving, or manual wall-clock changes do not shorten, extend, or duplicate it.

An offline Snooze applies only if its derived due instant remains in the future when synchronized. If its elapsed duration ended while offline, the product does not create an immediate stale reminder; it leaves the Task active and marks the action Needs Attention so the user can choose another duration.

### Needs Attention

A visible synchronization result indicating that a queued user instruction cannot currently be applied as originally requested and requires a new decision. It is not a Notification, Opportunity, completion, or silent failure. An unresolved queued user action and any associated recovery entry expire 30 elapsed days after its original action time and are removed; the instruction never applies afterward, and the user must issue a new action if the intent remains.

### Retry Exhausted

The operational result after a bounded automatic retry policy ends without success. It is not a Task state, Opportunity, Notification, acknowledgement, or completion. It never creates an error Notification or changes current authoritative Task state by inference; a still-active unresolved Task remains unresolved.

A place lookup that exhausts before establishing a match becomes a Missed Evaluation. An exhausted push attempt after a match leaves Notification State failed. An exhausted queued Evaluation Event becomes Event Sync Failed. An exhausted still-applicable queued user action remains durable only through its 30-day lifetime and becomes Needs Attention rather than being falsely applied; at expiry the instruction and recovery entry are removed, and continuing intent requires a new action. An inapplicable action follows its existing conflict or removal rule.

### Event Sync Failed

The Retry Exhausted result for a queued Evaluation Event that could not reach authoritative processing. It is not evidence that a Context matched and does not create an Opportunity, Notification, or Recent Opportunity Indicator. The entry preserves its original occurrence time and idempotency identity only within the Event's seven-day retention limit. A safe replay is authorized only before that limit and remains subject to the ordinary location-freshness rules; a separate manual context check creates a fresh Event, Episode, and Current-location Snapshot.

### Degraded Capability

A persistent in-app health state showing that a provider, queue, permission, or required device capability is currently unable to perform its responsibility reliably. It remains visible until a later verified success or recovery clears it, even after the related entry ages out of the 24-hour Recent Activity view.

### Not useful

A notification action meaning that the Task remains valid but the surfaced Opportunity was not useful.

Not useful records the matched Context reasons without altering or disabling them. The Task remains active. Another automatic notification requires both a new Evaluation Episode and expiration of the Task’s automatic cooldown. An offline Not useful action remains bound to its original Opportunity and cannot be applied to a later one.

Not useful is not Done, Snooze, dismissal of the Task, or permanent disabling of a Context.

### Fallback Digest

A configurable summary of qualifying unresolved Tasks. It is a fallback surface, not evidence that a real-world Opportunity was detected. Its Detailed Notification Preview identifies itself as a digest, shows at most three Task-title/non-Opportunity-reason rows plus `+N more` when needed, and opens the complete authenticated Task list when tapped.

At a digest run, an active unresolved Task may qualify only if it has had neither an intervening successful Notification submission nor a Digest Acknowledgement since the preceding digest. A final failed Notification State does not count as a successful submission for this calculation. Unscheduled Tasks, Tasks with unacknowledged Suppressed or Expired Opportunity Outcomes, Tasks with a final failed Notification State, and Tasks with Missed Evaluations or Event Sync Failed may qualify. Completed or deleted Tasks, actively snoozed Tasks, future Task Occurrences, and Tasks whose only Scheduled Reminder is still in the future do not qualify.

Retry Exhausted creates no special digest override. Affected Tasks qualify or do not qualify under the same Task-state, Notification-submission, and Digest-Acknowledgement rules as every other Task.

The preceding digest itself does not permanently exclude a Task: an unresolved, unacknowledged Task may appear again in the next daily digest. The digest respects Quiet Hours and the automatic cooldown. A digest suppressed by Quiet Hours is not sent later as a catch-up. A digest is not an Opportunity and does not create a Recent Opportunity Indicator.

MVP onboarding suggests 8:00 PM in the device's current local time and requires the user to confirm or change it. The selected time must be outside current Quiet Hours. A later settings conflict is shown to the user rather than silently moving the digest time.

The digest follows the device's current local timezone and may run at most once per local calendar day. A timezone change or forward manual-clock jump that crosses the selected time does not cause catch-up; that local day is skipped when necessary. A nonexistent daylight-saving time uses the first valid instant after the gap, and a repeated time runs once at the earlier valid instant. A backward clock change never duplicates a run.

### Digest Acknowledgement

A recorded user interaction showing awareness of a specific Task after the preceding digest.

Opening a Task from its Recent Activity entry, opening one specific Task from a digest's authenticated list, or applying Done, Snooze, or Not useful counts as a Digest Acknowledgement for that Task only. Merely opening Task details directly from the Task list does not count and does not disable later digest eligibility. Tapping a digest to open its multi-Task list acknowledges none of its Tasks.

### Retention Clock

The elapsed lifetime measured from a record's canonical occurrence or creation time. Upload, replay, retry, state refresh, and timezone or wall-clock changes do not restart it.

Recent Activity is visible for 24 elapsed hours. Coordinate-free Events, evaluations, Notification records, feedback, sensitive derived-history records, and sanitized operational logs remain in active app-controlled systems for at most seven elapsed days. Authoritative Task and Context configuration, current lifecycle state, recurrence settings, fixed reminder or Deadline instants, creation timezone, Quiet Hours, and current capability health are not derived history and remain while needed by the active product state.

A transport-queue entry is settled only after it is applied, deduplicated, cancelled, rendered inapplicable, or terminally expired with no authorized replay remaining. The entire transport entry is deleted within 24 elapsed hours after settlement and no later than its underlying record's retention deadline; an entry that settles at that deadline is deleted then. Any separate authoritative record follows its own retention rule. Retry Exhausted alone does not settle replayable work. An unresolved Evaluation Event cannot outlive its seven-day record limit. An unresolved queued user action and recovery entry cannot outlive 30 elapsed days from its original action time.

Encrypted backups have a maximum age of 30 days. Restoring a backup must reapply retention and deletion cutoffs and must never resurrect expired history, settled queues, deleted history, a deleted Task, or a deleted account. Residual encrypted backup data is not a user recovery path.

## Canonical relationships

- A Task has zero or more Opportunity Contexts.
- A Task with zero Opportunity Contexts is an Unscheduled Task.
- Any one enabled Opportunity Context may match.
- Every Hard Gate must permit delivery.
- A Recurrence creates Task Occurrences.
- A Deadline describes intended completion time.
- A Scheduled Reminder may create notification eligibility.
- Recurrence and Quiet Hours use current-local calendar and wall time; one-off reminders and Deadlines preserve fixed instants; cooldown, Snooze, retention, and recovery windows use elapsed time.
- Completion offers immediate Undo. A one-off Task may be reopened for 30 elapsed days; recurring Undo closes when the successor occurrence is created; confirmed Task deletion is irreversible; Undo and Reopen preserve every still-valid cooldown, Episode-deduplication record, and Digest Acknowledgement without restoring expired or deleted history.
- An Evaluation Event invokes evaluation.
- An Opportunity is detected when a Context matches.
- Hard Gates determine the Opportunity Outcome.
- Notification State separately records whether delivery was queued, submitted, or failed.
- A location Event is Notification-eligible only when processed within 15 minutes of its occurrence.
- A directly evidenced stale Saved Place or Specific Destination match becomes an Expired Opportunity without catch-up delivery.
- A stale Place Capability check becomes a Missed Evaluation, not a historical search or an Opportunity.
- A contextual Opportunity Notification is submitted only for a Deliverable Opportunity; a Fallback Digest is a separate non-Opportunity Notification.
- All Deliverable Task candidates from one Evaluation Episode share one external Notification envelope; candidates from other Episodes and Suppressed or Expired Opportunities never join it, and every Task retains independent state and actions.
- MVP operating-system Notification previews and push-provider payloads contain at most three Task-title/approved-reason rows. A larger same-Episode group or digest adds `+N more` without sending hidden Task content; tapping opens the complete authenticated, authorized list.
- MVP operating-system Notifications are tap-to-open only. Done, Snooze, and Not useful are per-Task controls inside Authenticated Notification Detail. Opening a digest list acknowledges no Task, while opening one Task from it acknowledges that Task only.
- Retry Exhausted sends no error Notification, never resolves a Task by inference, and does not change ordinary future-Event or digest eligibility within the approved seven-day Event and 30-day queued-action limits.
- A location-based Opportunity Context targets exactly one Saved Place, Specific Destination, or Place Capability.
- Provider place taxonomies remain internal mappings rather than user-facing location intentions.
- MVP Anchor and Specific Destination coordinates remain on the device; cloud transition records use opaque location-target identity without coordinates.
- Production precise-location synchronization may store only end-to-end encrypted ciphertext that the service cannot decrypt.
- The Android MVP monitors at most 20 active Specific Destinations at once, unregisters ended one-off destinations, and never silently evicts an active region.
- A Specific Destination notifies on a genuine outside-to-inside arrival; cooldown expiry while remaining inside does not create another arrival.
- At most one Current-location Snapshot exists transiently within one active Place Capability Evaluation Episode or explicit Find Nearby interaction and is not persisted or reused across those boundaries.
- Automatic application-foreground Place Capability evaluation starts at most one Episode per rolling 15-minute window and only when an applicable Active Task exists; manual checks and otherwise-permitted region-transition evaluations bypass without altering this foreground throttle.
- Every permitted location-evaluation trigger wakes every Applicable Place Capability Task, while directly matching only the Contexts actually evidenced by the Event.
- One Place Capability Episode shares one transient Current-location Snapshot and at most one provider search/result set per distinct Effective Place Query; per-Task decisions remain independent and no result survives the Episode.
- Find Nearby performs one fresh, isolated lookup for the selected Task and Place Capability; it wakes no other Task and creates no Evaluation Event, Episode, Opportunity, or Notification.
- An MVP Place Match requires the nearest confirmed-open compatible result within one kilometre.
- Cloud Place Capability history retains capability and Outcome only; Find Nearby performs a fresh transient search.
- Quiet Hours suppress automatic notifications without replaying them later.
- Explicit Scheduled Reminders and Snooze reminders bypass Quiet Hours and the automatic cooldown.
- A Fallback Digest summarizes qualifying Tasks but is not itself an Opportunity.
- Recent Activity is visible for 24 hours; approved derived records and sanitized logs expire within seven days, settled transport-queue entries within 24 hours and no later than their underlying deadline, unresolved queued actions and recovery entries within 30 days, and encrypted backups within 30 days.
