# session-pin

Objective: deliver an installable Pi package that lets users pin and reliably find long-running sessions, with a reusable core for upstream adoption in gentle-shell.
Branch: `feat/session-pin`; delivery strategy: `auto-chain` work-unit commits; test runner: `node --test` with TypeScript executed by Node's native type stripping.

## Specs

### S1
> Se me ocurrio una idea pero no se si ya esta implementada en gentle-shell, quiero poder pinnear y marcar una sesion dentro del menu /session para que no se me pierda entre todas las demas notas y poder identificarla para continuarla despues.

Check: a user can pin or unpin a session, see pinned sessions first, identify them, and continue one later.

### S2
> Vamos a implementar esto en gentle-shell crea un proyecto nuevo para trabajar que se llame session-pin debe ser algo que es usuario instale desde el presositorio de github que vamos a crear y que tambien este listo por si el creador de gentle-shell quiere implementarlo.

Check: the project is named `session-pin`, is installable from its GitHub repository, and separates reusable session-pinning behavior from its user-facing extension adapter.

## Tasks

- T1 — S1, S2 — Build the path-independent pin store and cross-home session catalog — route: inline — pending — commit: pending.
- T2 — S1, S2 — Build the Pi extension adapter and session switcher overlay — route: inline — pending — commit: pending.
- T3 — S1, S2 — Package, document, and verify the GitHub-installable extension — route: inline — pending — commit: pending.
- T4 — S1, S2 — Publish the repository, tag the installable release, and verify installation — route: inline — pending — commit: pending.

## Log

- L1 — 2026-10-29 10:39:29: "Se me ocurrio una idea pero no se si ya esta implementada en gentle-shell, quiero poder pinnear y marcar una sesion dentro del menu /session para que no se me pierda entre todas las demas notas y poder identificarla para continuarla despues."
- L2 — 2026-10-29 11:19:22: "Vamos a implementar esto en gentle-shell crea un proyecto nuevo para trabajar que se llame session-pin debe ser algo que es usuario instale desde el presositorio de github que vamos a crear y que tambien este listo por si el creador de gentle-shell quiere implementarlo."
- 2026-10-29 — Exploration confirmed that Pi 1.4.0 has no pin/favorite concept and its native `/resume` selector cannot be extended through the public extension API. The standalone package therefore exposes its own session switcher command while keeping storage, discovery, and ordering independent from the adapter so gentle-shell can adopt the same core for issue #2471 phase 2.
- 2026-10-29 — Architecture assumption: the public repository is `andrikonbeat/session-pin`; the pin identity is the durable session ID rather than a path or editable name; the store lives under the effective Pi/Gentle Shell agent home.
- 2026-10-29 — Delivery forecast exceeds 400 authored lines, so `auto-chain` is used: each coherent behavior slice is committed separately on `feat/session-pin` with its tests and documentation.
