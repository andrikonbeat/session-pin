import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogSession } from "../src/session-catalog.ts";
import { SessionSwitcherView, type SessionSwitcherResult } from "../src/session-switcher-view.ts";

const theme = {
	fg: (_color: string, text: string) => text,
	bg: (_color: string, text: string) => text,
};

const entries: CatalogSession[] = [
	{
		id: "session-pinned",
		cwd: "/work/project",
		name: "Pinned work",
		path: "/tmp/session-pinned.jsonl",
		messageCount: 5,
		pinned: true,
		available: true,
	},
	{
		id: "session-other",
		cwd: "/work/project",
		name: "Other work",
		path: "/tmp/session-other.jsonl",
		messageCount: 2,
		pinned: false,
		available: true,
	},
];

test("the switcher toggles the selected pin with Ctrl+F inside the overlay", async () => {
	const toggled: string[] = [];
	const view = new SessionSwitcherView({
		theme: theme as never,
		scope: "all",
		load: async () => entries,
		togglePin: async (entry) => {
			toggled.push(entry.id);
		},
		done: () => {},
		requestRender: () => {},
	});
	await view.initialize();

	view.handleInput("\x06");
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.deepEqual(toggled, ["session-pinned"]);
});

test("the switcher uses Tab for project/all scope and Enter to resume", async () => {
	const scopes: string[] = [];
	let result: SessionSwitcherResult | undefined;
	const view = new SessionSwitcherView({
		theme: theme as never,
		scope: "all",
		load: async (scope) => {
			scopes.push(scope);
			return entries;
		},
		togglePin: async () => {},
		done: (value) => {
			result = value;
		},
		requestRender: () => {},
	});
	await view.initialize();

	view.handleInput("\t");
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.deepEqual(scopes, ["all", "project"]);

	view.handleInput("\r");
	assert.deepEqual(result, { type: "resume", path: "/tmp/session-pinned.jsonl" });
});
