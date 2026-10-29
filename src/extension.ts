import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import { JsonPinStore } from "./pin-store.ts";
import { resolveSessionPinPaths } from "./paths.ts";
import { SessionCatalog, type CatalogSession } from "./session-catalog.ts";
import { parseSessionPinCommand } from "./session-pin-command.ts";
import { SessionSwitcherView, type SessionSwitcherResult } from "./session-switcher-view.ts";

export const SESSION_PIN_COMMAND = "session-pin";

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function toggleCurrentPin(
	ctx: ExtensionCommandContext,
	store: JsonPinStore,
	action: "pin" | "unpin" | "toggle",
): Promise<void> {
	const sessionId = ctx.sessionManager.getSessionId();
	if (!sessionId) {
		ctx.ui.notify("The current session is not persisted yet.", "warning");
		return;
	}
	const label = ctx.sessionManager.getSessionName();
	try {
		const pinned = await store.isPinned(sessionId);
		if (action === "pin" || (action === "toggle" && !pinned)) {
			await store.pin(sessionId, label !== undefined ? { label } : {});
			ctx.ui.notify("Session pinned.", "info");
			return;
		}
		await store.unpin(sessionId);
		ctx.ui.notify("Session unpinned.", "info");
	} catch (error) {
		ctx.ui.notify(`Could not update session pin: ${errorMessage(error)}`, "error");
	}
}

async function openSwitcher(ctx: ExtensionCommandContext, env: NodeJS.ProcessEnv): Promise<void> {
	if (ctx.mode !== "tui" || !ctx.hasUI) {
		ctx.ui.notify("The session switcher requires TUI mode.", "warning");
		return;
	}
	const paths = resolveSessionPinPaths(env);
	const store = new JsonPinStore(paths.storePath);
	const catalog = new SessionCatalog({
		cwd: ctx.sessionManager.getCwd(),
		sessionRoots: paths.sessionRoots,
		pinStore: store,
	});
	const result = await ctx.ui.custom<SessionSwitcherResult | undefined>(
		async (tui, theme, _keybindings, done) => {
			const view = new SessionSwitcherView({
				theme,
				scope: "all",
				currentSessionId: ctx.sessionManager.getSessionId(),
				load: (scope) => catalog.list(scope),
				togglePin: async (entry: CatalogSession) => {
					if (entry.pinned) {
						await store.unpin(entry.id);
						ctx.ui.notify("Session unpinned.", "info");
						return;
					}
					await store.pin(entry.id, entry.name !== undefined ? { label: entry.name } : {});
					ctx.ui.notify("Session pinned.", "info");
				},
				done,
				requestRender: () => tui.requestRender(),
				onUnavailable: (entry) => ctx.ui.notify(`Session ${entry.id} is unavailable.`, "warning"),
				onError: (error) => ctx.ui.notify(`Could not update session pin: ${errorMessage(error)}`, "error"),
			});
			await view.initialize();
			return view;
		},
		{
			overlay: true,
			overlayOptions: { anchor: "center", width: "80%", minWidth: 60, maxHeight: "80%" },
		},
	);
	if (result?.type === "resume") await ctx.switchSession(result.path);
}

/** Pi extension entry point. The core modules remain independently reusable. */
export default function sessionPin(pi: ExtensionAPI, env: NodeJS.ProcessEnv = process.env): void {
	pi.registerCommand(SESSION_PIN_COMMAND, {
		description: "Pin the current session or browse pinned sessions. Ctrl+F toggles a pin; Tab switches project scope.",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const command = parseSessionPinCommand(args);
			if (command.action === "error") {
				ctx.ui.notify(command.message, "error");
				return;
			}
			if (command.action === "open") {
				await openSwitcher(ctx, env);
				return;
			}
			const paths = resolveSessionPinPaths(env);
			await toggleCurrentPin(ctx, new JsonPinStore(paths.storePath), command.action);
		},
	});
}
