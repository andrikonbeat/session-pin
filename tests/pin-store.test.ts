import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { JsonPinStore, PinStoreError } from "../src/pin-store.ts";

async function fixture(): Promise<{ dir: string; file: string; store: JsonPinStore }> {
	const dir = await mkdtemp(join(tmpdir(), "session-pin-store-"));
	const file = join(dir, "pins.json");
	return { dir, file, store: new JsonPinStore(file) };
}

test("pins are durable by session id and unpin removes only that id", async (t) => {
	const { dir, file, store } = await fixture();
	t.after(() => rm(dir, { recursive: true, force: true }));

	await store.pin("session-a", { label: "Architecture notes" });
	await store.pin("session-b");

	assert.deepEqual(await store.list(), [
		{ sessionId: "session-a", pinnedAt: (await store.list())[0]!.pinnedAt, label: "Architecture notes" },
		{ sessionId: "session-b", pinnedAt: (await store.list())[1]!.pinnedAt },
	]);

	const persisted = JSON.parse(await readFile(file, "utf8")) as { version: number; pins: Record<string, unknown> };
	assert.equal(persisted.version, 1);
	assert.deepEqual(Object.keys(persisted.pins).sort(), ["session-a", "session-b"]);

	await store.unpin("session-a");
	assert.deepEqual((await store.list()).map((pin) => pin.sessionId), ["session-b"]);
});

test("concurrent pin writes preserve every session", async (t) => {
	const { dir, store } = await fixture();
	t.after(() => rm(dir, { recursive: true, force: true }));

	await Promise.all([
		store.pin("session-a"),
		store.pin("session-b"),
		store.pin("session-c"),
		store.pin("session-d"),
	]);

	assert.deepEqual((await store.list()).map((pin) => pin.sessionId).sort(), [
		"session-a",
		"session-b",
		"session-c",
		"session-d",
	]);
});

test("a corrupt store fails closed and is never overwritten", async (t) => {
	const { dir, file, store } = await fixture();
	t.after(() => rm(dir, { recursive: true, force: true }));

	await writeFile(file, "{not-json", "utf8");
	await assert.rejects(() => store.pin("session-a"), PinStoreError);
	assert.equal(await readFile(file, "utf8"), "{not-json");
	assert.deepEqual(await readdir(dir), ["pins.json"]);
});
