# Browser acceptance plan

Run `npm test` first. For legacy new-ID-only cases below, disable **Alert whenever available work is found after a page refresh**. With the default enabled, verify available unclaimed work sounds once on initial load and once after every refresh, with no extra alert from same-document startup retries. Empty or picked-only refreshes stay silent. Then load the root directory unpacked in Chrome. Keep an authenticated Avala dashboard open, enable debug mode, and use actual work or a local DevTools-created sanitized fixture within the live work container. Never click/claim tasks through automation. Test data should be clearly synthetic and removed by reloading.

| Case | Steps and expected result |
|---|---|
| Empty dashboard | Confirm NO_WORK; history batches never alert. |
| Initial baseline | Clear known batches with default initial setting; scan existing batches; no alert. |
| One new batch | After baseline, add/observe one real new ID; one alert and unread badge. |
| Same ID after refresh | Reload several times; no repeated alert. |
| Several new IDs | Render two cards in one update; one combined alert. |
| Existing update | Change counts; no alert by default. Enable update alerts; subsequent changes give an update alert. |
| Temporary absence | Remove then restore an ID before retention; no new alert. |
| Re-alert option | Enable the shortest disappearance threshold; restore after that duration; one new alert. |
| Restart | Restart Chrome and manually stop/restart the extension worker; known IDs remain suppressed. |
| Two tabs | Open the same dashboard twice and scan simultaneously; one alert per new ID. |
| Dynamic updates | Add cards without reloading; observer detects within debounce plus scheduling time. |
| Slow load | Render work after 20 seconds; discovery observer detects it after bounded retries ended. |
| SPA replacement | Remove work container, navigate away and back; observer reconnects. |
| Changed/ambiguous DOM | Include history in the candidate container or invalid selectors; diagnostic, no false alert. Configure inspected selectors and retest. |
| Cooldown | Set 30 seconds; detect A, then B/C; B/C persist in queue and combine at the next eligible alarm. Stop worker during wait and verify recovery. |
| Test channels | Test each enabled channel, check volume 0/100, dismiss toast, use keyboard navigation. No real batch/history created. |
| Desktop click | Click alert with existing Avala tabs; correct window focuses. Close all tabs then click; one new Avala tab opens. |
| Auto-refresh | Leave existing refresher enabled for repeated cycles; no extra refreshes, duplicate alerts or blocked clicks. |
| Current dashboard cards | After an empty baseline, show Available cards with six-character ID badges and Start Working buttons, as in the screenshot. Detect each ID and alert once. Refresh with the same IDs: silent. Task history and In Progress cards never count as new work. |
| Late card hydration | Render the Available Work heading in its own wrapper, then insert cards into a sibling grid after startup retries end. Detection reconnects and alerts for new IDs. |
| Retention/reset | Confirm reset dialog cancellation preserves state. Accept reset and verify fresh baseline. Lifecycle tests cover expiry without waiting days. |
| Errors | Disable OS notifications/audio; inspect error diagnostics. Storage/notification crashes cannot guarantee exactly-once delivery (README). |

Live browser acceptance is pending access to the authenticated dashboard. Do not claim this matrix has passed solely from fixture tests.

### Picked vs. new work (1.0.4)

- A card showing In Progress / Resume / Continue: no new-work alert, including after refresh and with initial-alert or update-alert settings enabled.
- Empty dashboard followed by another empty refresh: silent.
- Empty dashboard followed by a new unclaimed card: one alert; repeat refresh: silent.
- Picked card and a separate unclaimed card together: alert only for the unclaimed ID.
- Pick a task during its cooldown wait: remove its queued alert on the next confirmed scan.
- A currently sounding alert remains stoppable through Stop alert.
