import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import sessionPin, { SESSION_PIN_COMMAND } from "../src/extension.ts";

interface CapturedCommand {
	name: string;
	description: string;
	handler: (args: string, ctx: unknown) => Promise<void> | void;
}

async function fixture(): Promise<{
	dir: string;
	env: NodeJS.ProcessEnv;
	commands: CapturedCommand[];
	notifications: string[];
}> {
	const dir = await mkdtemp(join(tmpdir(), "session-pin-extension-"));
	const commands: CapturedCommand[] = [];
	const notifications: string[] = [];
	const env = {
		PI_CODING_AGENT_DIR: join(dir, "agent"),
		PI_CODING_AGENT_SESSION_DIR: join(dir, "agent", "sessions"),
	};
	const pi = {
		registerCommand: (name: string, registration: Omit<CapturedCommand, "name">) => {
			commands.push({ name, ...registration });
		},
	};
	sessionPin(pi as never, env);
	return { dir, env, commands, notifications };
}

function commandContext(notifications: string[]): unknown {
	return {
		mode: "tui",
		hasUI: true,
		cwd: "/work/project",
		ui: {
			notify: (message: string) => notifications.push(message),
			custom: async () => undefined,
		},
		sessionManager: {
			getCwd: () => "/work/project",
			getSessionId: () => "session-current",
			getSessionName: () => "Current work",
		},
		switchSession: async () => ({ cancelled: false }),
	};
}

test("the extension registers one session-pin command", async (t) => {
	const fixtureValue = await fixture();
	t.after(() => rm(fixtureValue.dir, { recursive: true, force: true }));
	assert.equal(fixtureValue.commands.length, 1);
	assert.equal(fixtureValue.commands[0]!.name, SESSION_PIN_COMMAND);
	assert.match(fixtureValue.commands[0]!.description, /pin/i);
});

test("pin, unpin, and toggle act on the current session", async (t) => {
	const fixtureValue = await fixture();
	t.after(() => rm(fixtureValue.dir, { recursive: true, force: true }));
	const command = fixtureValue.commands[0]!;
	const ctx = commandContext(fixtureValue.notifications);
	const storePath = join(fixtureValue.env.PI_CODING_AGENT_DIR!, "session-pin", "pins.json");

	await command.handler("pin", ctx);
	let persisted = JSON.parse(await readFile(storePath, "utf8")) as { pins: Record<string, { label?: string }> };
	assert.deepEqual(Object.keys(persisted.pins), ["session-current"]);
	assert.equal(persisted.pins["session-current"]!.label, "Current work");

	await command.handler("unpin", ctx);
	persisted = JSON.parse(await readFile(storePath, "utf8")) as { pins: Record<string, { label?: string }> };
	assert.deepEqual(persisted.pins, {});

	await command.handler("toggle", ctx);
	persisted = JSON.parse(await readFile(storePath, "utf8")) as { pins: Record<string, { label?: string }> };
	assert.deepEqual(Object.keys(persisted.pins), ["session-current"]);
	assert.deepEqual(fixtureValue.notifications, ["Session pinned.", "Session unpinned.", "Session pinned."]);
});

test("unknown command actions report an error without changing state", async (t) => {
	const fixtureValue = await fixture();
	t.after(() => rm(fixtureValue.dir, { recursive: true, force: true }));
	await fixtureValue.commands[0]!.handler("remove", commandContext(fixtureValue.notifications));
	assert.deepEqual(fixtureValue.notifications, ["Unknown action: remove"]);
});
