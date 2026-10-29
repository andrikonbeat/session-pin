import type { CatalogSession, SessionScope } from "./session-catalog.ts";

export function catalogSessionTitle(entry: CatalogSession): string {
	return entry.name?.trim() || entry.firstMessage?.trim() || entry.id;
}

export function catalogSessionDescription(entry: CatalogSession): string {
	const details: string[] = [];
	if (!entry.available) details.push("Unavailable");
	if (entry.pinned) details.push("Pinned");
	details.push(`${entry.messageCount} ${entry.messageCount === 1 ? "message" : "messages"}`);
	if (entry.cwd) details.push(entry.cwd);
	return details.join(" · ");
}

export function filterCatalogSessions(entries: readonly CatalogSession[], query: string): CatalogSession[] {
	const needle = query.trim().toLocaleLowerCase();
	if (!needle) return [...entries];
	return entries.filter((entry) =>
		[entry.name, entry.id, entry.cwd, entry.firstMessage]
			.some((value) => value?.toLocaleLowerCase().includes(needle)),
	);
}

export function nextSessionScope(scope: SessionScope): SessionScope {
	return scope === "all" ? "project" : "all";
}
