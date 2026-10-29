export type SessionPinCommand =
	| { action: "open" }
	| { action: "pin" }
	| { action: "unpin" }
	| { action: "toggle" }
	| { action: "error"; message: string };

export function parseSessionPinCommand(input: string): SessionPinCommand {
	const trimmed = input.trim();
	if (!trimmed) return { action: "open" };
	const [action, ...extra] = trimmed.split(/\s+/);
	if (extra.length > 0) return { action: "error", message: `Unexpected arguments: ${extra.join(" ")}` };
	switch (action.toLocaleLowerCase()) {
		case "open":
			return { action: "open" };
		case "pin":
			return { action: "pin" };
		case "unpin":
			return { action: "unpin" };
		case "toggle":
			return { action: "toggle" };
		default:
			return { action: "error", message: `Unknown action: ${action}` };
	}
}
