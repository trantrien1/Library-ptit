import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const nextBuildDir = resolve(projectRoot, ".next");

if (existsSync(nextBuildDir)) {
	rmSync(nextBuildDir, { recursive: true, force: true });
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
delete env.npm_config_node_options;
delete env.npm_package_config_node_options;

const nextBin = resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev"], {
	cwd: projectRoot,
	env,
	stdio: "inherit",
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	process.exit(code ?? 0);
});

child.on("error", (error) => {
	console.error(error);
	process.exit(1);
});
