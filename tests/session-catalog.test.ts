import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { JsonPinStore } from "../src/pin-store.ts";
import { SessionCatalog } from "../src/session-catalog.ts";
import { resolveSessionPinPaths } from "../src/paths.ts";

function encodedCwd(cwd: string): string {
	return `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
}

async function writeSession(
	root: string,
	cwd: string,
	id: string,
	name: string | undefined,
	modifiedAt: string,
): Promise<void> {
	const dir = join(root, encodedCwd(cwd));
	await mkdir(dir, { recursive: true });
	const timestamp = new Date(modifiedAt).toISOString();
	const lines = [
		{ type: "session", version: 3, id, timestamp, cwd },
		...(name ? [{ type: "session_info", id: `${id}-info`, parentId: null, timestamp, name }] : []),
		{
			type: "message",
			id: `${id}-message`,
			parentId: name ? `${id}-info` : null,
			timestamp,
			message: { role: "user", content: `Continue ${id}`, timestamp: Date.now() },
		},
	];
	const file = join(dir, `${timestamp.replaceAll(":", "-")}_${id}.jsonl`);
	await writeFile(file, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8");
	const seconds = new Date(modifiedAt).getTime() / 1000;
	await utimes(file, seconds, seconds);
}

async function fixture(): Promise<{ dir: string; piRoot: string; gentleRoot: string; store: JsonPinStore }> {
	const dir = await mkdtemp(join(tmpdir(), "session-pin-catalog-"));
	const piRoot = join(dir, "pi", "sessions");
	const gentleRoot = join(dir, "gentle", "sessions");
	await mkdir(piRoot, { recursive: true });
	await mkdir(gentleRoot, { recursive: true });
	return { dir, piRoot, gentleRoot, store: new JsonPinStore(join(dir, "pins.json")) };
}

test("the catalog combines Pi and Gentle Shell homes and keeps pins first", async (t) => {
	const { dir, piRoot, gentleRoot, store } = await fixture();
	t.after(() => rm(dir, { recursive: true, force: true }));
	const currentCwd = join(dir, "project-a");
	const otherCwd = join(dir, "project-b");

	await writeSession(piRoot, currentCwd, "session-current", "Current work", "2026-10-29T10:00:00.000Z");
	await writeSession(gentleRoot, currentCwd, "session-older", "Older work", "2026-10-28T10:00:00.000Z");
	await writeSession(piRoot, otherCwd, "session-other", "Other project", "2026-10-29T11:00:00.000Z");
	await store.pin("session-older", { label: "Pinned snapshot" });

	const catalog = new SessionCatalog({ cwd: currentCwd, sessionRoots: [piRoot, gentleRoot], pinStore: store });
	const projectEntries = await catalog.list("project");
	assert.deepEqual(projectEntries.map((entry) => entry.id), ["session-older", "session-current"]);
	assert.equal(projectEntries[0]!.pinned, true);
	assert.equal(projectEntries[0]!.name, "Older work");
	assert.equal(projectEntries[0]!.path?.includes(gentleRoot), true);

	const allEntries = await catalog.list("all");
	assert.deepEqual(allEntries.map((entry) => entry.id), ["session-older", "session-other", "session-current"]);
});

test("a deleted pinned session remains visible so it can be unpinned", async (t) => {
	const { dir, piRoot, store } = await fixture();
	t.after(() => rm(dir, { recursive: true, force: true }));
	const cwd = join(dir, "project-a");
	await writeSession(piRoot, cwd, "session-present", "Present", "2026-10-29T10:00:00.000Z");
	await store.pin("session-present");
	await store.pin("session-missing", { label: "Deleted conversation" });

	const catalog = new SessionCatalog({ cwd, sessionRoots: [piRoot], pinStore: store });
	const entries = await catalog.list("project");
	assert.deepEqual(entries.map((entry) => [entry.id, entry.available]), [
		["session-present", true],
		["session-missing", false],
	]);
	assert.equal(entries[1]!.name, "Deleted conversation");
});

test("path resolution honors explicit homes and includes both standard session roots", () => {
	const home = join("/tmp", "session-pin-home");
	const paths = resolveSessionPinPaths(
		{
			PI_CODING_AGENT_DIR: join(home, "custom-agent"),
			PI_CODING_AGENT_SESSION_DIR: join(home, "custom-sessions"),
		},
		home,
	);

	assert.equal(paths.storePath, join(home, "custom-agent", "session-pin", "pins.json"));
	assert.deepEqual(paths.sessionRoots, [
		join(home, "custom-sessions"),
		join(home, "custom-agent", "sessions"),
		join(home, ".pi", "agent", "sessions"),
		join(home, ".gentle-shell", "agent", "sessions"),
	]);
});
