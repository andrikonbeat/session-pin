# session-pin

Pin the Pi sessions you still need, find them quickly, and resume them later.

`session-pin` is a local-first [Pi package](https://github.com/earendil-works/pi). It stores pins by Pi's durable session ID, so renaming a session or moving it between Pi and Gentle Shell session homes does not detach the pin.

## Install

Install the tagged release directly from GitHub:

```bash
pi install git:github.com/andrikonbeat/session-pin@v1
```

Restart Pi or run `/reload` after installing. Then use:

```text
/session-pin
```

## Use

### Session switcher

`/session-pin` opens a searchable session switcher with pinned sessions first.

| Key | Action |
| --- | --- |
| `Ctrl+F` | Pin or unpin the selected session |
| `Tab` | Switch between all projects and the current project |
| `Enter` | Resume the selected session |
| `Esc` | Close the switcher |

`Ctrl+F` is scoped to this overlay. It does not replace Pi's editor-level `Ctrl+F` binding.

### Current session

```text
/session-pin pin
/session-pin unpin
/session-pin toggle
```

These commands act on the current session and return immediately without opening the overlay.

## Session discovery and storage

The extension inspects both standard session roots:

- `~/.pi/agent/sessions`
- `~/.gentle-shell/agent/sessions`

It also honors `GENTLE_PI_AGENT_HOME`, `PI_CODING_AGENT_DIR`, and `PI_CODING_AGENT_SESSION_DIR`.

Pins are stored in:

```text
<effective-agent-home>/session-pin/pins.json
```

The file contains session IDs, pin timestamps, and optional name snapshots. It contains no conversation content. Writes are atomic and protected by a cross-process lock so concurrent Pi sessions do not overwrite each other's changes.

A corrupt store fails closed: the extension reports the error and never overwrites unreadable state.

## Upstream adoption

Pi's public extension API cannot add controls to the built-in `/resume` selector. The standalone package therefore provides `/session-pin` as its own switcher while keeping the reusable behavior in framework-neutral modules:

- `JsonPinStore` — durable, path-independent pin state
- `SessionCatalog` — cross-home discovery and pinned-first ordering
- `SessionSwitcherView` — the Pi TUI presentation layer
- `sessionPin` — the Pi command adapter

The same core can be embedded in Gentle Shell's native session overlay for [gentle-shell#2471](https://github.com/Gentleman-Programming/gentle-shell/issues/2471) phase 2. See [`docs/upstream-adoption.md`](docs/upstream-adoption.md).

## Compatibility

- Pi `1.4.0` or newer
- Node.js `22.19.0` or newer

## Development

```bash
npm install
npm test
npm run typecheck
```

## License

MIT
