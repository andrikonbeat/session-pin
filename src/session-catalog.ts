import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { PinRecord } from "./pin-store.ts";
import { type JsonPinStore } from "./pin-store.ts";

export type SessionScope = "project" | "all";

export interface CatalogSession {
	id: string;
	cwd: string;
	name?: string;
	path?: string;
	created?: Date;
	modified?: Date;
	messageCount: number;
	firstMessage?: string;
	pinned: boolean;
	available: boolean;
}

interface SessionFile {
	id: string;
	cwd: string;
	name?: string;
	path: string;
	created?: Date;
	modified: Date;
	messageCount: number;
	firstMessage?: string;
}

interface SessionCatalogOptions {
	cwd: string;
	sessionRoots: string[];
	pinStore: JsonPinStore;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function encodedCwd(cwd: string): string {
	return `--${resolve(cwd).replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
}

async function listJsonFiles(directory: string): Promise<string[]> {
	try {
		const entries = await readdir(directory, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
			.map((entry) => join(directory, entry.name));
	} catch {
		return [];
	}
}

async function readSessionFile(filePath: string): Promise<SessionFile | undefined> {
	try {
		const [content, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
		const lines = content.split("\n").filter(Boolean);
		const header = lines.length > 0 ? JSON.parse(lines[0]!) as unknown : undefined;
		if (!isRecord(header) || header.type !== "session" || typeof header.id !== "string" || typeof header.cwd !== "string") {
			return undefined;
		}
		let name: string | undefined;
		let messageCount = 0;
		let firstMessage: string | undefined;
		for (const line of lines.slice(1)) {
			let entry: unknown;
			try {
				entry = JSON.parse(line) as unknown;
			} catch {
				continue;
			}
			if (!isRecord(entry)) continue;
			if (entry.type === "session_info" && typeof entry.name === "string") name = entry.name;
			if (entry.type !== "message") continue;
			messageCount += 1;
			if (firstMessage === undefined && isRecord(entry.message) && entry.message.role === "user") {
				const content = entry.message.content;
				if (typeof content === "string") firstMessage = content;
				else if (Array.isArray(content)) {
					const text = content.find((part) => isRecord(part) && part.type === "text" && typeof part.text === "string");
					if (isRecord(text) && typeof text.text === "string") firstMessage = text.text;
				}
			}
		}
		return {
			id: header.id,
			cwd: header.cwd,
			name,
			path: filePath,
			created: typeof header.timestamp === "string" ? new Date(header.timestamp) : undefined,
			modified: fileStat.mtime,
			messageCount,
			firstMessage,
		};
	} catch {
		return undefined;
	}
}

async function listProjectSessions(cwd: string, root: string): Promise<SessionFile[]> {
	const files = await listJsonFiles(join(root, encodedCwd(cwd)));
	return (await Promise.all(files.map(readSessionFile))).filter((session): session is SessionFile => session !== undefined);
}

async function listAllSessions(root: string): Promise<SessionFile[]> {
	let entries: Array<{ name: string; isDirectory(): boolean; isSymbolicLink(): boolean }> = [];
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch {
		return [];
	}
	const directories = entries
		.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
		.map((entry) => join(root, entry.name));
	const files = [...(await listJsonFiles(root)), ...(await Promise.all(directories.map(listJsonFiles))).flat()];
	return (await Promise.all(files.map(readSessionFile))).filter((session): session is SessionFile => session !== undefined);
}

/** Session discovery and ordering, independent from the Pi extension adapter. */
export class SessionCatalog {
	private readonly cwd: string;
	private readonly sessionRoots: string[];
	private readonly pinStore: JsonPinStore;

	constructor(options: SessionCatalogOptions) {
		this.cwd = options.cwd;
		this.sessionRoots = options.sessionRoots;
		this.pinStore = options.pinStore;
	}

	async list(scope: SessionScope): Promise<CatalogSession[]> {
		const [pins, sessions] = await Promise.all([
			this.pinStore.list(),
			this.readSessions(scope),
		]);
		const pinById = new Map(pins.map((pin) => [pin.sessionId, pin]));
		const sessionById = new Map<string, CatalogSession>();
		for (const session of sessions) {
			const existing = sessionById.get(session.id);
			if (existing !== undefined && (existing.modified?.getTime() ?? 0) >= (session.modified?.getTime() ?? 0)) continue;
			const pin = pinById.get(session.id);
			sessionById.set(session.id, {
				id: session.id,
				cwd: session.cwd,
				name: session.name ?? pin?.label,
				path: session.path,
				created: session.created,
				modified: session.modified,
				messageCount: session.messageCount,
				firstMessage: session.firstMessage,
				pinned: pin !== undefined,
				available: true,
			});
		}
		for (const pin of pins) {
			if (sessionById.has(pin.sessionId)) continue;
			sessionById.set(pin.sessionId, {
				id: pin.sessionId,
				cwd: "",
				name: pin.label,
				messageCount: 0,
				pinned: true,
				available: false,
			});
		}
		return [...sessionById.values()].sort((left, right) => {
			if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
			if (left.available !== right.available) return left.available ? -1 : 1;
			return (right.modified?.getTime() ?? 0) - (left.modified?.getTime() ?? 0) || left.id.localeCompare(right.id);
		});
	}

	private async readSessions(scope: SessionScope): Promise<SessionFile[]> {
		const groups = await Promise.all(this.sessionRoots.map((root) =>
			scope === "project" ? listProjectSessions(this.cwd, root) : listAllSessions(root),
		));
		return groups.flat();
	}
}
