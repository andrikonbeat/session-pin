import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface SessionPinPaths {
	agentHome: string;
	storePath: string;
	sessionRoots: string[];
}

function uniquePaths(paths: string[]): string[] {
	const seen = new Set<string>();
	return paths.filter((path) => {
		const canonical = resolve(path);
		if (seen.has(canonical)) return false;
		seen.add(canonical);
		return true;
	});
}

/**
 * Resolve the effective Pi/Gentle Shell homes without importing either shell.
 * The standard Pi and Gentle Shell session roots are both inspected so a
 * session pinned under one installation remains discoverable under the other.
 */
export function resolveSessionPinPaths(
	env: NodeJS.ProcessEnv = process.env,
	userHome: string = homedir(),
): SessionPinPaths {
	const agentHome = env.GENTLE_PI_AGENT_HOME?.trim() || env.PI_CODING_AGENT_DIR?.trim() || join(userHome, ".pi", "agent");
	const agentHomes = [
		env.GENTLE_PI_AGENT_HOME?.trim(),
		env.PI_CODING_AGENT_DIR?.trim(),
		join(userHome, ".pi", "agent"),
		join(userHome, ".gentle-shell", "agent"),
	].filter((path): path is string => Boolean(path));
	const sessionRoots = uniquePaths([
		...(env.PI_CODING_AGENT_SESSION_DIR?.trim() ? [env.PI_CODING_AGENT_SESSION_DIR.trim()] : []),
		...agentHomes.map((home) => join(home, "sessions")),
	]);

	return {
		agentHome: resolve(agentHome),
		storePath: join(resolve(agentHome), "session-pin", "pins.json"),
		sessionRoots,
	};
}
