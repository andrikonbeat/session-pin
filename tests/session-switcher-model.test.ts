import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogSession } from "../src/session-catalog.ts";
import {
	catalogSessionDescription,
	catalogSessionTitle,
	filterCatalogSessions,
	nextSessionScope,
} from "../src/session-switcher-model.ts";

const entries: CatalogSession[] = [
	{
		id: "session-architecture",
		cwd: "/work/gentle-shell",
		name: "Session pin architecture",
		messageCount: 8,
		firstMessage: "Design the persistent store",
		pinned: true,
		available: true,
	},
	{
		id: "session-bug",
		cwd: "/work/other-project",
		name: "Parser regression",
		messageCount: 3,
		firstMessage: "The selector fails after rename",
		pinned: false,
		available: true,
	},
	{
		id: "session-deleted",
		cwd: "",
		name: "Deleted conversation",
		messageCount: 0,
		pinned: true,
		available: false,
	},
];

test("the switcher filters by title, id, cwd, and first message", () => {
	assert.deepEqual(filterCatalogSessions(entries, "architecture").map((entry) => entry.id), ["session-architecture"]);
	assert.deepEqual(filterCatalogSessions(entries, "PARSER").map((entry) => entry.id), ["session-bug"]);
	assert.deepEqual(filterCatalogSessions(entries, "gentle-shell").map((entry) => entry.id), ["session-architecture"]);
	assert.deepEqual(filterCatalogSessions(entries, "after rename").map((entry) => entry.id), ["session-bug"]);
	assert.equal(filterCatalogSessions(entries, "").length, 3);
});

test("the switcher title falls back from name to first message to id", () => {
	assert.equal(catalogSessionTitle(entries[0]!), "Session pin architecture");
	assert.equal(catalogSessionTitle(entries[1]!), "Parser regression");
	assert.equal(catalogSessionTitle({ ...entries[1]!, name: undefined }), "The selector fails after rename");
	assert.equal(catalogSessionTitle({ ...entries[2]!, name: undefined }), "session-deleted");
});

test("the switcher description exposes pin and availability state", () => {
	assert.match(catalogSessionDescription(entries[0]!), /pinned/i);
	assert.match(catalogSessionDescription(entries[1]!), /3 messages/i);
	assert.match(catalogSessionDescription(entries[2]!), /unavailable/i);
});

test("scope toggles between all projects and the current project", () => {
	assert.equal(nextSessionScope("all"), "project");
	assert.equal(nextSessionScope("project"), "all");
});
