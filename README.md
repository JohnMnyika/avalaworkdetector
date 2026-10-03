# Avala Work Alert Pro

A local-only Chrome Manifest V3 extension that observes the rendered Avala worker dashboard, remembers work batches, and alerts for new work. No refresh loop, automatic claiming, login access, telemetry, remote code, or Avala API requests. Plain JavaScript: **the project root is directly loadable without a build**.

## Installation

1. Open Chrome 120 or newer and navigate to `chrome://extensions/`.
2. Enable **Developer mode**, select **Load unpacked**, and choose this project directory.
3. Open `https://avala.ai/`, log in yourself, and open the worker dashboard.
4. Reload an already-open Avala tab once after installing or updating the extension.
5. Pin the extension, open its popup, and confirm the status. Keep the dashboard open.
6. Open **Settings → Send test alert** to check your saved notification channels.

Keep your existing auto-refresh extension enabled. This extension never reloads the page, changes browser history, claims work, or intercepts clicks. Every reload initializes a fresh content observer while remembered batches remain in Chrome local storage.

**Live validation required:** the supplied screenshot shows an empty Available Work section and batch entries in Task history. A screenshot does not expose the DOM. No authenticated Avala browser session was available during implementation. The default detector is a conservative semantic adapter, not a verified Avala selector contract. Validate it against your actual empty and populated dashboard before relying on unattended alerts. Ambiguous structures show diagnostics instead of guessing.

## Project structure

- `manifest.json`: exact-origin permissions, content scripts, worker, popup, options.
- `detector.js`: isolated section discovery and batch extraction adapter.
- `contentScript.js`: observers, bounded load retries, manual scans, shadow-root alerts.
- `background.js`: serialized cross-tab storage, deduplication, notification delivery, cooldown queue, tab focus.
- `lib/storage.js`: defaults, settings validation, persistent state access.
- `lib/state.js`: independently testable batch lifecycle and state transitions.
- `popup.html`, `popup.js`, `options.html`, `options.js`, `ui.css`: accessible dark interface.
- `offscreen.html`, `offscreen.js`: locally synthesized two-note sound.
- `icons/`: packaged PNG toolbar icons.
- `tests/`: detector and lifecycle regression tests.
- `TEST_PLAN.md`: browser acceptance checks.

## Detection and persistence

The detector finds one visible exact-text `Available Work` heading, then seeks its content container without crossing a `Task history` or `Quick Actions` boundary. It confirms the exact empty message or extracts batch labels and full UUID task cards only inside the work container. Hidden entries and extension UI are excluded. An explicitly configured container that includes Task history is rejected. Uncertain layouts remain LOADING or ERROR.

Identity uses an explicit `data-batch-id`, a displayed full UUID (including line-wrapped UUIDs), the displayed `Work batch …` identifier, or a same-origin card URL. DOM position is never an identity. Unknown cards without reliable identity are not invented. Fields unavailable in the rendered card remain unset. Category and other site-specific metadata can be added to `parseCard` after inspecting the live DOM.

A section MutationObserver debounces changes by 400 ms. A lightweight discovery observer detects section removal, late rendering and DOM changes during SPA navigation. Initial scans retry at 0.5, 1, 2, 5 and 15 seconds, then rely on events. There is no continuous scan or refresh interval. A navigation which changes neither DOM nor browser events cannot be detected immediately; use Scan now if needed.

The service worker is the only state writer. Its serialized promise queue makes simultaneous tab reports compare against the most recently persisted state. `chrome.storage.local` holds known IDs, first/last seen timestamps, disappearance timestamps, baseline status, queued alerts, last scans, errors, recent history, unread IDs and daily totals. Page reloads, browser restarts and ordinary worker suspension preserve these records.

With refresh alerts disabled, the first valid scan silently establishes a baseline by default, including an empty baseline. Later unknown IDs alert once. Updates do not alert unless enabled. Missing/loading scans do not delete IDs. Confirmed disappearance can optionally allow re-alerting after the configured interval; fresh reports from another tab prevent immediate disappearance. The default retention is seven days since last seen. After expiration an ID can be new again.

Cooldown defaults to off. With cooldown enabled, newly detected IDs are persisted and deduplicated in a queue. Chrome alarms drain that queue when eligible; startup recovery and hourly maintenance repair scheduling. Browser sleep and Chrome alarm scheduling can delay queued delivery. Immediate alerts do not depend on an alarm.

## Notifications and controls

- **Desktop:** one combined notification for a detection group. Clicking focuses an existing Avala tab (preferably the reporting tab), or opens one if absent. It scrolls to Available Work when possible.
- **Sound:** optional gentle synthesized chime from an offscreen extension document, with volume control.
- **Badge:** unseen new-batch count; **Mark seen** clears it. Confirmed no-work state clears it when no other tab reports available work.
- **In-page:** dismissible shadow-root toast with View Work, configurable 5–30 second duration. It never clicks a batch.
- **Scan now:** requests immediate scans from open Avala tabs without reloading.
- **Test alert:** exercises enabled saved channels, without adding known batches or detection history. The temporary TEST badge restores after an alarm (about 30 seconds or later).

Settings include all four channels, detection/update switches, initial baseline behavior, cooldown, retention (1/3/7/14/30 days), optional disappearance re-alert (1/6/12/24/48 hours), sound volume, in-page duration, debug mode and selector overrides. Save before testing. Clearing known batches requires confirmation and restarts the initial baseline behavior; it does not uninstall or clear settings/history.

Desktop notification duration is controlled by Chrome and the OS. OS quiet mode, disabled site/extension notifications, audio routing, discarded tabs, sleeping devices and suspended rendering can prevent or delay alerts. Chrome must be running with a rendered logged-in Avala dashboard.

## Inspecting and updating selectors

1. In Avala, right-click **Available Work → Inspect**.
2. Find the smallest stable container that contains the heading and its available cards/empty message, **excluding Task history**.
3. Inspect an actual available card when work exists. Record a stable card selector, batch data attribute or same-origin work link. Do not derive selectors from screenshot positions or generated class names.
4. In DevTools, check your candidate with `document.querySelectorAll('YOUR_SELECTOR')`. It should select exactly the intended work container.
5. Save **Available Work container selector** and optionally **Batch card selector** in Settings. The card selector is relative to the container. Blank settings use semantic detection.
6. Enable debug mode, use Scan now, and check the popup diagnostics and content-script console. Verify a no-work page still ignores all history batches.
7. If the site uses different labels or metadata, update `findAvailableWorkSection` or `parseCard` in `detector.js`, add a sanitized representative fixture test, reload the extension, and reload Avala.

Do not share full logged-in page HTML containing account details. A sanitized fragment of the work section and adjacent heading is enough to improve the adapter.

## Testing and troubleshooting

`npm install` followed by `npm test` runs lifecycle and synthetic DOM regression tests. Dependencies are for development only and are not loaded by the extension. See `TEST_PLAN.md` for real Chrome tests; automated fixture tests cannot prove the authenticated site's layout or OS notification delivery.

If the popup says waiting: verify login and dashboard route, reload once after installation, inspect the section, enable debug mode and review its diagnostic. If Scan now cannot connect, reload Avala. If no sound or notification appears, test the saved settings and check OS notification/audio preferences. Inspect worker errors via `chrome://extensions/ → Service worker → Inspect`.

## Reliability boundaries and privacy

Known IDs are saved before notification side effects to prioritize preventing duplicate alerts. Chrome storage and notification delivery have no shared atomic transaction: a process crash in the small gap can lose an alert. Exact-once delivery cannot be guaranteed under an abrupt crash. History records `attempting`, `sent` or `channel-error`; `sent` means the channel calls completed, not that the user saw them. Channel failures are surfaced, not endlessly replayed. Multiple separate DOM updates can produce separate combined alerts; enable cooldown to group these.

Two tabs showing different snapshots may briefly show stale availability or metadata. Cross-tab identity deduplication still applies. Data is stored in the current Chrome profile only and is removed by uninstalling/clearing extension data. No external servers receive extension data.

Permissions: `storage` for persistence, `notifications` for desktop alerts, `alarms` for durable queue/cleanup scheduling, `offscreen` for optional sound, and only `https://avala.ai/*` for page observation and locating Avala tabs. No cookies, webRequest, broad tabs, scripting, or all-sites permission is requested. Other Avala subdomains are intentionally excluded.

Chrome API references: [alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms) and [offscreen audio](https://developer.chrome.com/docs/extensions/reference/api/offscreen).

## Loud repeating alerts (1.0.3)

Reload the extension and reopen Settings after updating. Choose **Loud alarm** or **Alarm + spoken announcement**, enable **Repeat every 6 seconds until stopped**, choose volume, save, then send a test alert. Both real and test alerts repeat until stopped. Existing volume settings are preserved; loud alarm and repetition are the defaults for the new fields.

**Stop alert** is available in the popup and Settings. Mark seen, clicking a desktop notification, or saving settings also stops playback. Monitoring continues afterward. Repeated playback does not create extra notifications or detection-history entries. Browser shutdown/reloading the extension ends playback; an old alarm is not replayed on restart.

Voice uses Chrome's `tts` permission to announce “Work has just arrived. Please check Avala.” (or a work-update message). A speech engine must be available in Chrome; if unavailable the tone alarm still plays and voice errors appear in diagnostics. The selected Chrome speech engine may be supplied by the OS or another extension. Only this fixed announcement is passed to it, never task/account data. See [Chrome speech API](https://developer.chrome.com/docs/extensions/reference/api/tts). Speaker/system volume still determines how far away you can hear it.

## Already-picked tasks (1.0.4)

Cards with a visible **In Progress** status or a **Resume / Continue** action are excluded from new-work detection. A page containing only these cards reports no new available work and the popup shows the number already picked. An empty refresh remains silent; new unclaimed cards appearing after that baseline trigger the alert. Mixed lists still detect new unclaimed cards while ignoring picked ones. A confirmed picked ID is removed from any pending cooldown alert. An alarm already playing can be silenced with Stop alert.

These status rules are based on the supplied screenshot; the actual unclaimed card DOM still needs live validation. Tests use representative synthetic markup and do not prove the authenticated site's structure.

## Alerts after refresh (1.0.5)

Available, unclaimed work now alerts once per dashboard page load by default, including work already remembered and work present on the first scan. Startup retries and repeated scans in the same document do not replay that alert. Empty and In Progress / Continue cards remain silent. Settings → Work detection → **Alert whenever available work is found after a page refresh** controls this behavior; disable it to restore new-ID-only alerts. Sound channel, volume and cooldown settings still apply.

The current dashboard's six-character ID badges with Available and Start Working labels are supported. Reload the extension at chrome://extensions, then refresh Avala to activate the update. Live sound delivery still requires verification in Chrome; automated tests cover refresh-to-audio message delivery and synthesized playback.
