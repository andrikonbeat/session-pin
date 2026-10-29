import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const STORE_VERSION = 1;
const LOCK_RETRY_MS = 20;
const LOCK_TIMEOUT_MS = 5_000;
const STALE_LOCK_MS = 30_000;

export interface PinRecord {
	sessionId: string;
	pinnedAt: string;
	label?: string;
}

interface StoredPin {
	pinnedAt: string;
	label?: string;
}

interface PinFile {
	version: typeof STORE_VERSION;
	pins: Record<string, StoredPin>;
}

export class PinStoreError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "PinStoreError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePinFile(content: string, filePath: string): PinFile {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch (error) {
		throw new PinStoreError(`Cannot read session pin store: ${filePath}`, { cause: error });
	}
	if (!isRecord(parsed) || parsed.version !== STORE_VERSION || !isRecord(parsed.pins)) {
		throw new PinStoreError(`Cannot read session pin store: ${filePath}`);
	}
	for (const [sessionId, pin] of Object.entries(parsed.pins)) {
		if (!isRecord(pin) || typeof pin.pinnedAt !== "string" || (pin.label !== undefined && typeof pin.label !== "string")) {
			throw new PinStoreError(`Cannot read session pin store: ${filePath}`);
		}
	}
	return parsed as unknown as PinFile;
}

function emptyPinFile(): PinFile {
	return { version: STORE_VERSION, pins: {} };
}

async function sleep(milliseconds: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** A small cross-process mutex implemented with atomic directory creation. */
async function acquireLock(lockPath: string): Promise<() => Promise<void>> {
	const deadline = Date.now() + LOCK_TIMEOUT_MS;
	while (true) {
		try {
			await mkdir(lockPath);
			return async () => {
				await rm(lockPath, { recursive: true, force: true });
			};
		} catch (error) {
			if (!isRecord(error) || error.code !== "EEXIST") throw error;
			try {
				const lockStat = await stat(lockPath);
				if (Date.now() - lockStat.mtimeMs > STALE_LOCK_MS) {
					await rm(lockPath, { recursive: true, force: true });
					continue;
				}
			} catch {
				continue;
			}
			if (Date.now() >= deadline) {
				throw new PinStoreError(`Timed out locking session pin store: ${lockPath}`);
			}
			await sleep(LOCK_RETRY_MS);
		}
	}
}

/**
 * Durable pin state keyed by Pi's stable session ID. Paths and editable names
 * are display metadata only, so renaming or moving a session keeps its pin.
 */
export class JsonPinStore {
	readonly filePath: string;

	constructor(filePath: string) {
		this.filePath = filePath;
	}

	async list(): Promise<PinRecord[]> {
		const data = await this.read();
		return Object.entries(data.pins)
			.map(([sessionId, pin]) => ({ sessionId, ...pin }))
			.sort((left, right) => left.sessionId.localeCompare(right.sessionId));
	}

	async isPinned(sessionId: string): Promise<boolean> {
		return (await this.read()).pins[sessionId] !== undefined;
	}

	async pin(sessionId: string, options: { label?: string } = {}): Promise<PinRecord> {
		return this.mutate((data) => {
			const existing = data.pins[sessionId];
			const record: StoredPin = {
				pinnedAt: existing?.pinnedAt ?? new Date().toISOString(),
				...(options.label !== undefined ? { label: options.label } : existing?.label !== undefined ? { label: existing.label } : {}),
			};
			data.pins[sessionId] = record;
			return { sessionId, ...record };
		});
	}

	async unpin(sessionId: string): Promise<boolean> {
		return this.mutate((data) => {
			if (data.pins[sessionId] === undefined) return false;
			delete data.pins[sessionId];
			return true;
		});
	}

	private async read(): Promise<PinFile> {
		try {
			return parsePinFile(await readFile(this.filePath, "utf8"), this.filePath);
		} catch (error) {
			if (isRecord(error) && error.code === "ENOENT") return emptyPinFile();
			throw error;
		}
	}

	private async mutate<T>(change: (data: PinFile) => T | Promise<T>): Promise<T> {
		await mkdir(dirname(this.filePath), { recursive: true });
		const release = await acquireLock(`${this.filePath}.lock`);
		let temporaryPath: string | undefined;
		try {
			const data = await this.read();
			const result = await change(data);
			temporaryPath = join(dirname(this.filePath), `.${randomUUID()}.tmp`);
			await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
			await rename(temporaryPath, this.filePath);
			return result;
		} finally {
			if (temporaryPath !== undefined) await rm(temporaryPath, { force: true });
			await release();
		}
	}
}
