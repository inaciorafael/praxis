import { spawn } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";

const cargoBin = join(homedir(), ".cargo", "bin");
const separator = process.platform === "win32" ? ";" : ":";
const pathKey =
	Object.keys(process.env).find((key) => key.toLowerCase() === "path") ??
	"PATH";

const child = spawn("tauri", process.argv.slice(2), {
	stdio: "inherit",
	shell: true,
	env: {
		...process.env,
		[pathKey]: `${cargoBin}${separator}${process.env[pathKey] ?? ""}`,
	},
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}

	process.exit(code ?? 0);
});
