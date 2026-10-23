const child = Bun.spawn([process.execPath, "node_modules/typescript/bin/tsc", "--noEmit"], {
  cwd: import.meta.dir + "/..", stdout: "inherit", stderr: "inherit",
});
const code = await child.exited;
if (code !== 0) process.exit(code);
export {};
