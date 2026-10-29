import { Input, SelectList, type SelectItem } from "@earendil-works/pi-tui";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";

import type { CatalogSession, SessionScope } from "./session-catalog.ts";
import {
	catalogSessionDescription,
	catalogSessionTitle,
	filterCatalogSessions,
	nextSessionScope,
} from "./session-switcher-model.ts";

export type ExtensionTheme = Parameters<Parameters<ExtensionUIContext["custom"]>[0]>[1];

export type SessionSwitcherResult = { type: "resume"; path: string };

export interface SessionSwitcherViewOptions {
	theme: ExtensionTheme;
	scope: SessionScope;
	load: (scope: SessionScope) => Promise<CatalogSession[]>;
	togglePin: (entry: CatalogSession) => Promise<void>;
	done: (result: SessionSwitcherResult | undefined) => void;
	requestRender: () => void;
	currentSessionId?: string;
	onUnavailable?: (entry: CatalogSession) => void;
	onError?: (error: unknown) => void;
	maxVisible?: number;
}

export class SessionSwitcherView {
	private readonly options: SessionSwitcherViewOptions;
	private readonly input: Input;
	private scope: SessionScope;
	private entries: CatalogSession[] = [];
	private list: SelectList;

	constructor(options: SessionSwitcherViewOptions) {
		this.options = options;
		this.scope = options.scope;
		this.input = new Input({ prompt: "Search: " });
		this.input.focused = true;
		this.list = this.createList([]);
	}

	async initialize(): Promise<void> {
		await this.reload();
	}

	render(width: number): string[] {
		const scopeLabel = this.scope === "all" ? "All projects" : "Current project";
		return [
			this.options.theme.fg("accent", "Session Pin"),
			this.options.theme.fg("muted", scopeLabel),
			...this.input.render(width),
			...this.list.render(width),
			"",
			this.options.theme.fg("muted", "Ctrl+F pin/unpin · Tab scope · Enter resume · Esc close"),
		];
	}

	invalidate(): void {
		this.input.invalidate();
		this.list.invalidate();
	}

	handleInput(data: string): void {
		if (data === "\x06") {
			void this.toggleSelectedPin();
			return;
		}
		if (data === "\t") {
			void this.toggleScope();
			return;
		}
		if (data === "\r" || data === "\n") {
			this.selectCurrent();
			return;
		}
		if (data === "\x1b") {
			this.options.done(undefined);
			return;
		}
		if (data === "\x1b[A" || data === "\x1b[B" || data === "\x1b[5~" || data === "\x1b[6~") {
			this.list.handleInput(data);
			return;
		}
		this.input.handleInput(data);
		this.rebuildList(this.list.getSelectedItem()?.value);
	}

	private async toggleSelectedPin(): Promise<void> {
		const selected = this.list.getSelectedItem();
		const entry = this.entries.find((candidate) => candidate.id === selected?.value);
		if (entry === undefined) return;
		try {
			await this.options.togglePin(entry);
			await this.reload();
			this.options.requestRender();
		} catch (error) {
			this.options.onError?.(error);
		}
	}

	private async toggleScope(): Promise<void> {
		this.scope = nextSessionScope(this.scope);
		try {
			await this.reload();
			this.options.requestRender();
		} catch (error) {
			this.options.onError?.(error);
		}
	}

	private selectCurrent(): void {
		const selected = this.list.getSelectedItem();
		const entry = this.entries.find((candidate) => candidate.id === selected?.value);
		if (entry === undefined) return;
		if (!entry.available || entry.path === undefined) {
			this.options.onUnavailable?.(entry);
			return;
		}
		this.options.done({ type: "resume", path: entry.path });
	}

	private async reload(): Promise<void> {
		const selectedId = this.list.getSelectedItem()?.value;
		this.entries = await this.options.load(this.scope);
		this.rebuildList(selectedId);
	}

	private rebuildList(selectedId: string | undefined): void {
		const filtered = filterCatalogSessions(this.entries, this.input.getValue());
		this.list = this.createList(filtered);
		if (selectedId !== undefined) {
			const index = filtered.findIndex((entry) => entry.id === selectedId);
			if (index >= 0) this.list.setSelectedIndex(index);
		}
	}

	private createList(entries: CatalogSession[]): SelectList {
		const items: SelectItem[] = entries.map((entry) => {
			const current = entry.id === this.options.currentSessionId ? " · current" : "";
			return {
				value: entry.id,
				label: `${entry.pinned ? "★ " : ""}${catalogSessionTitle(entry)}${current}`,
				description: catalogSessionDescription(entry),
			};
		});
		const list = new SelectList(items, this.options.maxVisible ?? 12, {
			selectedPrefix: (text) => this.options.theme.fg("accent", text),
			selectedText: (text) => this.options.theme.fg("accent", text),
			description: (text) => this.options.theme.fg("muted", text),
			scrollInfo: (text) => this.options.theme.fg("muted", text),
			noMatch: (text) => this.options.theme.fg("muted", text),
		});
		list.onSelect = (item) => {
			this.list = list;
			const entry = entries.find((candidate) => candidate.id === item.value);
			if (entry === undefined) return;
			if (!entry.available || entry.path === undefined) {
				this.options.onUnavailable?.(entry);
				return;
			}
			this.options.done({ type: "resume", path: entry.path });
		};
		list.onCancel = () => this.options.done(undefined);
		return list;
	}
}
