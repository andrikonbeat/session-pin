export { JsonPinStore, PinStoreError, type PinRecord } from "./pin-store.ts";
export { resolveSessionPinPaths, type SessionPinPaths } from "./paths.ts";
export { SessionCatalog, type CatalogSession, type SessionScope } from "./session-catalog.ts";

/** The user-facing Pi adapter is added in the next work unit. */
export default function sessionPin(): void {}
