# Upstream adoption guide

This document maps `session-pin` to the native Gentle Shell session selector described in [gentle-shell#2471](https://github.com/Gentleman-Programming/gentle-shell/issues/2471), phase 2.

## What can be reused unchanged

| `session-pin` module | Native selector responsibility |
| --- | --- |
| `src/pin-store.ts` | Persistent pin/unpin state keyed by session ID |
| `src/paths.ts` | Effective Pi/Gentle Shell home and session-root resolution |
| `src/session-catalog.ts` | Project/all-project discovery, cross-home deduplication, pinned-first ordering |
| `src/session-switcher-model.ts` | Filtering, display labels, scope transition |
| `src/session-switcher-view.ts` | TUI list and input behavior; adapt to the native component framework if needed |

`src/extension.ts` is intentionally the only Pi-specific adapter. A native Gentle Shell implementation should keep its own command/palette wiring and inject the native session source into the catalog.

## Recommended native behavior

1. Show a `Pinned` section before unpinned sessions.
2. Bind pin/unpin inside the native overlay, where the key does not conflict with editor bindings.
3. Resolve a pin by session ID, never by JSONL path or editable session name.
4. Resolve a pinned session across both Pi and Gentle Shell homes.
5. Keep an unavailable pinned row visible so the user can remove its pin.
6. Support current-project and all-project scopes.
7. Continue a selected session through the host's existing session-switch operation.

## Data compatibility

The standalone package and an upstream implementation should share the same on-disk schema:

```json
{
  "version": 1,
  "pins": {
    "SESSION_ID": {
      "pinnedAt": "2026-10-29T12:00:00.000Z",
      "label": "Optional display-name snapshot"
    }
  }
}
```

The `label` is display metadata only. The session ID remains the identity, so renames and home changes do not invalidate a pin.

## Integration boundary

The native selector should own:

- keyboard dispatch and conflict resolution
- final row rendering and section headings
- session continuation/cancellation behavior

The shared core should own:

- durable state and atomicity
- session discovery and deduplication
- pinned-first ordering
- unavailable-pin visibility

This split prevents the upstream implementation from duplicating persistence rules while allowing each UI to use its native components.
