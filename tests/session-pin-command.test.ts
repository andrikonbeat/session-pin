import assert from "node:assert/strict";
import test from "node:test";

import { parseSessionPinCommand } from "../src/session-pin-command.ts";

test("session-pin command accepts open, pin, unpin, and toggle actions", () => {
	assert.deepEqual(parseSessionPinCommand(""), { action: "open" });
	assert.deepEqual(parseSessionPinCommand("open"), { action: "open" });
	assert.deepEqual(parseSessionPinCommand("pin"), { action: "pin" });
	assert.deepEqual(parseSessionPinCommand("unpin"), { action: "unpin" });
	assert.deepEqual(parseSessionPinCommand("toggle"), { action: "toggle" });
});

test("session-pin command rejects unknown actions and extra arguments", () => {
	assert.deepEqual(parseSessionPinCommand("remove"), { action: "error", message: "Unknown action: remove" });
	assert.deepEqual(parseSessionPinCommand("pin now"), { action: "error", message: "Unexpected arguments: now" });
});
